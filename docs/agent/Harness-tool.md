---
title: Harness-02 Agent Tool
date: 2026-09-05 14:50:00
tag:
  - Harness
description: Agent Harness的第二章，Agent与Harness的核心机制，Tool。
---
# 4 Tools is all you need
上一篇我们说到，Agent loop其实就是一个判断是否调用工具并执行的简单`while(true)`循环，因此工具也就不可避免地是Agent的重中之重。对于一个coding agent来讲，其实只需要4个工具就够了，read、write、bash and edit。
前3个都非常好理解，edit工具其实就是精确替换工具，比如说我们用codex编辑文件时，要将`int a=3`，改为`int a=4`，这个时候就需要使用edit工具。以上4个工具基本可以满足绝大部分需求，因此它们也是最近十分流行的pi-Agent的仅有的四个默认工具。
## 工具应该具有什么？
一般来讲，我们非常容易想到的工具应该具有的属性有3个，也就是`name`、`description`、Schema以及一个`execute`方法。`name`当然是必不可少的，普遍意义上的标识符，`description`用来告诉LLM这个工具的用途以及参数应该怎么填。Schema即为LLM要填的参数。光有LLM填写文本形式的工具调用还不够，我们还需要在代码层面实际执行工具，这就需要一个`execute`方法，或者说`call`方法，名称是无所谓的，只要这个方法是用来说明工具的实际、具体执行的操作即可。
我们可以以刚才的edit工具为例:

```typescript
const replaceEditSchema = Type.Object(
	{
		oldText: Type.String({
			description:
				"Exact text for one targeted replacement. It must be unique in the original file and must not overlap with any other edits[].oldText in the same call.",
		}),
		newText: Type.String({ description: "Replacement text for this targeted edit." }),
	},
	{},
);
const editSchema = Type.Object(
	{
		path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
		edits: Type.Array(replaceEditSchema, {
			description:
				"One or more targeted replacements. Each edit is matched against the original file, not incrementally. Do not include overlapping or nested edits. If two changes touch the same block or nearby lines, merge them into one edit instead.",
		}),
	},
	{},
);
```

这里`editSchema`便是edit工具的schema，接受一个路径，以及一个`edits`数组。它还需要一个`execute`方法，下面给出一个可能的伪代码:

```text
异步函数 execute(调用ID, input, 取消信号, 进度回调, 会话上下文):

    如果 input.edits 不是数组，或者数组为空:
        抛出错误("至少需要一条替换")

    工作目录 = 会话上下文的工作目录，否则使用创建工具时的工作目录
    文件路径 = 根据工作目录解析 input.path

    返回 在该文件的修改队列中执行以下操作:
        // 同一文件的其他修改，需要等待本次操作结束

        检查是否已取消
        检查文件是否存在、是否可读写
        如果检查失败:
            抛出文件访问错误

        检查是否已取消
        原始文本 = 等待读取文件，并按 UTF-8 解码
        检查是否已取消

        BOM, 正文 = 分离文件开头的编码标记
        原换行风格 = 检测正文使用 LF 还是 CRLF
        标准正文 = 将正文中的换行统一为 LF

        基准内容, 新内容 = 计算全部替换(标准正文, input.edits)
            // 每条 oldText 都针对修改前的内容定位
            // 优先精确匹配，失败后尝试格式归一化匹配
            // 检查重复匹配和替换区间重叠
            // 全部检查通过后，再生成新内容
            // 任意检查失败则抛错，此时尚未写文件

        检查是否已取消

        最终文本 = BOM + 将新内容恢复为原换行风格
        等待写回文件(文件路径, 最终文本)
        检查是否已取消

        展示差异, 首个修改行号 = 生成展示用差异(基准内容, 新内容)
        标准补丁 = 生成标准补丁(基准内容, 新内容)

        返回 {
            content: ["成功替换了 N 个文本块"],
            details: {
                diff: 展示差异,
                patch: 标准补丁,
                firstChangedLine: 首个修改行号
            }
        }
```

看上去是不是没那么简单？这里面我觉得需要着重学习的有两点，一个是工具真正执行前的参数校验，一个就是并发控制，凡是涉及到读写的地方都会涉及到并发控制，Agent里的工具当然也不例外。这个具体的`edits`工具只是一个例子，可以用来快速地建立一个初步印象，在进阶之后，就需要逐步进行抽象。
## 工具的统一抽象
我们都学习过C++、Java这种面向对象编程的语言，一切皆类，一切皆对象的思想深入人心，ts也可以当作一种面向对象编程的语言，而且更加灵活一些，比如不要求将方法写到类里。回到工具这里，我们在设计Harness时，就可以抽象出一个Tool类，不过这里我们不必定义一个类，使用接口就够了，因为我们只需要规定工具需要满足的字段和方法，在ts中，我们可以使用type或者interface，二者效果类似。比如我们可以这样声明:
```typescript
export type Tool<
  Input ,
  Output,
  P ,
>
```
这里便定义了一个Tool type，同时它相当的抽象，因为使用了泛型，这样做的好处是，我们可以每个工具具体定义自己的`InputSchema`和`OutputSchema`，`type Tool`起到一个规范的作用，我们还可以再定义一个`buildTool`工厂方法，比如:
```typescript
export type ToolDef=Tool<Any,Any,Any>
export function buildTool<D extends ToolDef>(def: D): Tool<D> {
  return {
    userFacingName: () => def.name,
    ...def,
  }
}
```
下面展示几个具体的例子，通过具体的工具定义来展示这种抽象的好处。先给出一个完整的`type Tool`定义:
```typescript
export type Tool<Input,Output,P,>={
	name:string
	inputSchema: Input
	description: string
	call(
    args: z.infer<Input>,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    parentMessage: AssistantMessage,
    onProgress?: ToolCallProgress<P>,
  ): Promise<ToolResult<Output>>

}
export type ToolResult<T> = {
  data: T
  newMessages?: (
    | UserMessage
    | AssistantMessage
    | AttachmentMessage
    | SystemMessage
  )[]
}
```
上面就是一个相对比较完整的`type Tool`定义，它规定了一个Tool需要具有三样东西:`name`、`inputSchema`以及一个`call`方法，同时我们完成了抽象，我们不必每个工具都定义一个type，而是专注于实现自身的Input和Output，比如，对于一个Glob工具，我们可以使用`buildTool`方法这样定义:
```typescript
const inputSchema = lazySchema(() =>
  z.strictObject({
    pattern: z.string().describe('The glob pattern to match files against'),
    path: z
      .string()
      .optional()
      .describe(
        'The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.',
      ),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    durationMs: z
      .number()
      .describe('Time taken to execute the search in milliseconds'),
    numFiles: z.number().describe('Total number of files found'),
    filenames: z
      .array(z.string())
      .describe('Array of file paths that match the pattern'),
    truncated: z
      .boolean()
      .describe('Whether results were truncated (limited to 100 files)'),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>
export const GlobTool = buildTool({
	name: Glob,
	inputSchema:inputSchema,
	description:`- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Agent tool instead`
	async call(input, { abortController, getAppState, globLimits }) {
    const start = Date.now()
    const appState = getAppState()
    const limit = globLimits?.maxResults ?? 100
    const { files, truncated } = await glob(
      input.pattern,
      GlobTool.getPath(input),
      { limit, offset: 0 },
      abortController.signal,
      appState.toolPermissionContext,
    )
    // Relativize paths under cwd to save tokens (same as GrepTool)
    const filenames = files.map(toRelativePath)
    const output: Output = {
      filenames,
      durationMs: Date.now() - start,
      numFiles: filenames.length,
      truncated,
    }
    return {
      data: output,
    }
  }

} satisfies ToolDef<InputSchema, Output>)

```
这样我们就完成了一个小闭环，理解起来也会容易很多。
## 工具的执行前校验
之前有提到过，很多工具在执行前需要进行参数校验，这属于一种防御措施，上面的type定义中，广泛地使用了Zod库来做运行时的校验，不过光有这个还不够，Zod库只能运行时判断参数的类型是否符合，就拿上面的Glob工具来说，path的类型需要是string，Zod能够在填入为number时发现出错了，但是如果path是一个不存在的路径呢？这就要求进一步的检验。因此我们可以给每个Tool定义一个`validateInput`方法，这个方法是可选的，不一定需要。还是以Glob工具为例，我们可以这样写它的`validateInput`方法:
```typescript
async validateInput({ path }): Promise<ValidationResult> {
    // If path is provided, validate that it exists and is a directory
    if (path) {
      const fs = getFsImplementation()
      const absolutePath = expandPath(path)

      // SECURITY: Skip filesystem operations for UNC paths to prevent NTLM credential leaks.
      if (absolutePath.startsWith('\\\\') || absolutePath.startsWith('//')) {
        return { result: true }
      }

      let stats
      try {
        stats = await fs.stat(absolutePath)
      } catch (e: unknown) {
        if (isENOENT(e)) {
          const cwdSuggestion = await suggestPathUnderCwd(absolutePath)
          let message = `Directory does not exist: ${path}. ${FILE_NOT_FOUND_CWD_NOTE} ${getCwd()}.`
          if (cwdSuggestion) {
            message += ` Did you mean ${cwdSuggestion}?`
          }
          return {
            result: false,
            message,
            errorCode: 1,
          }
        }
        throw e
      }

      if (!stats.isDirectory()) {
        return {
          result: false,
          message: `Path is not a directory: ${path}`,
          errorCode: 2,
        }
      }
    }
    return { result: true }
  },
```
当模型决定调用Glob工具后，可以先执行`inputSchema.safeParse(input)`做一个类型的Zod校验，如果通过再进行`GlobTool.validateInput(input)`，然后可能还要再经过一些运行前Hooks才能运行相应的`call`方法。

## 工具的并发控制
下面来讲一讲工具的并发，Harness里并发的核心理念即是设计合理的方案，使得多个工具在执行时，能够确保最终结果正确。比如现在有read工具以及write工具，这里面就涉及到并发控制，因为如果在write工具执行时，使用了read工具，那读取到的内容和write编写完成后的内容就会有出入。
很自然地，我们容易想到有些工具是可以并发的，典型代表就是一些只读工具，read、glob等，这两个工具之间是完全可以并发执行的，因为它们都不会修改文件。而write、edit这类工具则是不可并发的。我们容易想到，是否可并发，应该作为工具的一个属性，因此我们可以在Tool type里新增一个字段,`isConcurrencySafe`，代表工具是否是并发安全的。一般地，我们容易觉得只要是只读的工具都是并发安全的，反之则不是，也就是说如果不是只读的工具，它的`isConcurrencySafe`就应该设为false。但其实是不一定的，因为我们可以通过一些其他的保护措施来弥补这一点。举个例子，我们现在有个工具TaskCreate，其功能便是创造一个待办清单，我们在使用claude code时，经常会和这个工具打交道，这个工具不是只读的，它是会向磁盘写入数据的，同时它在写任务条目时，会给条目编号，如果多个TaskCreate工具并发，就会发生问题，那这个时候我们还能将其`isConcurrencySafe`设置为True吗？可以，只不过要加锁。也就是一个TaskCreate在工作时，会锁住整个任务列表，让其他TaskCreate无法写入，这样就实现了并发安全。
我们知道，大模型在回复时，是流式输出的，也就是一个或者好几个token断断续续地往外蹦，因此我们不必等到所有的工具调用块都被完整输出后，再去调用工具，这样就慢了太多，我们可以在拿到了一个完整的工具调用块后，立刻执行这个工具即可，只不过要和刚才的`isConcurrencySafe`联系起来:如果当前没有任何工具执行，那可立刻执行；如果此工具和正在执行的工具都是并发安全的，那么也可以并发执行，否则就需要串行等待了。
我们可以考虑这样的一个流式并行执行器StreamingToolExector，同时定义一个`TrackedTool` type，一个工具的执行可以有四种状态:`ToolStatus = 'queued' | 'executing' | 'completed' | 'yielded'`,
```typescript
type TrackedTool = {
  id: string
  block: ToolUseBlock
  assistantMessage: AssistantMessage
  status: ToolStatus
  isConcurrencySafe: boolean
  promise?: Promise<void>
  results?: Message[]
  pendingProgress: Message[]
  contextModifiers?: Array<(context: ToolUseContext) => ToolUseContext>
}

export class StreamingToolExecutor {
  private tools: TrackedTool[] = []
  private toolUseContext: ToolUseContext
  private hasErrored = false
  private erroredToolDescription = ''
  private siblingAbortController: AbortController
  private discarded = false
  private progressAvailableResolve?: () => void
  private turnSpan: LangfuseSpan | null = null
  private canExecuteTool(isConcurrencySafe: boolean): boolean {
    const executingTools = this.tools.filter(t => t.status === 'executing')
    return (
      executingTools.length === 0 ||
      (isConcurrencySafe && executingTools.every(t => t.isConcurrencySafe))
    )
  }
}
```
`canExecuteTool`方法便是上述并发控制思想的代码实现。`StreamingToolExecutor`维护了一个`TrackTool`数组，通过它可以维护和跟踪每个工具的状态，自然地，我们还需要一个`addTool`方法来向数组中写入工具状态。
### read与edit
这里介绍一下read与edit工具的小细节，模型在使用read工具进行内容的读取时，是会留下相应的缓存的，这个时候如果我们修改了文件的内容，而模型又调用了edit工具，edit首先会先查看当前内容和缓存是否相同，如果不同的话，会拒绝修改文件，同时告诉模型文件内容已经被修改，请重新读取。那如果是write或者edit工具的修改呢？答：这些工具修改内容的同时也会更新缓存。那如果是另一个Agent的工具的修改呢？每个Agent维护各自的缓存，另一个Agent修改后，需要重新读取，这是Multi Agent的内容。
