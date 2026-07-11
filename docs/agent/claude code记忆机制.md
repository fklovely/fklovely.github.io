---
title: claude code记忆机制
date: 2026-04-25 17:30:00
tag:
  - Claude Code
description: 详解Claude Code的记忆过程和原理
---
# Claude code记忆机制
记忆是Agent非常重要的一部分，它将直接影响Agent的判断和行为，并最终影响用户的体验。试想一下，如果用户已经说了很多次重要信息，Agent下次执行时依然是全然不知的状态，这势必让用户深深失望。就像她已经说了无数次我爱你，你却依旧不以为意。
## CLAUDE.md
CLAUDE.md是全局的静态记忆，具有很高的优先级，CLAUDE.md有以下几个层级:
```markdown
1. Managed Memory（组织级）
路径：/etc/claude-code/CLAUDE.md
    /etc/claude-code/.claude/rules/*.md
• 代表信息：企业安全合规策略、组织编码规范、全局流程约束
• 谁配置：IT/系统管理员（需要 root 权限）
• 谁受益：该机器/组织上所有用户
• 典型内容：
  • "所有代码必须通过内部 npm registry"
  • "禁止生成包含明文密码的代码"
  • "PR 必须经过单元测试才能合并"
```
```markdown
2. User Memory（用户级）
路径：~/.claude/CLAUDE.md
      ~/.claude/rules/*.md
• 代表信息：用户个人的跨项目偏好、习惯、身份背景
• 谁配置：当前用户自己
• 谁受益：该用户的所有项目
• 典型内容：
  • "我是后端工程师，不熟悉前端，解释时多用后端类比"
  • "我更喜欢用 bun 而不是 npm"
  • "请用中文回复我"
  • "我讨厌在 diff 后面加总结"
```
```markdown
3. Project Memory（项目级）
路径：./CLAUDE.md
      ./.claude/CLAUDE.md
      ./.claude/rules/*.md
• 代表信息：项目特定的架构约定、技术栈、团队规范
• 谁配置：项目团队（提交到 git，全员共享）
• 谁受益：该项目的所有贡献者
• 典型内容：
  • "本项目使用 Hexagonal Architecture，业务逻辑在 domain/ 目录"
  • "所有 API 响应必须使用统一的 Result<T> 包装"
  • "数据库迁移文件命名规范：YYYY-MM-DD_description.sql"
  特殊机制：条件规则（.claude/rules/*.md）
  项目级的 .claude/rules/*.md 支持 frontmatter 条件匹配：
  ---
  paths:
    - "src/auth/**/*.ts"
  ---
  本目录下的文件涉及身份验证，修改时必须检查 session 安全性。
  只有操作匹配 paths 的文件时，这条规则才会被注入上下文。
```
```markdown
4. Local Memory（本地私有项目级）
路径：./CLAUDE.local.md
• 代表信息：项目级但不共享的私有上下文
• 谁配置：当前用户自己
• 谁受益：仅当前用户（不提交 git）
• 典型内容：
  • "我在本地使用 Docker Compose 启动依赖服务"
  • "我的本地测试数据库密码是...（仅本地有效）"
   • "我目前在本地调试这个特定的 bug，不要动 xxx 文件"
  ▌为什么需要这一层？因为有些项目上下文只对你个人有意义，或者包含敏感信息（如本地开发环境的凭据），不适合提交到共享仓
  ▌ 库。
```
<span style="color:red;">以上层级的优先级是递增的，也就是说User Memory的内容会优先于Managed Memory的内容</span>，其他以此类推。

## Auto Memory

上面提到的CLAUDE.md的4个层级均是静态记忆，而Auto Memory是用户在与Claude code交互过程中产生的记忆。Auto Memory可视为第5层级，优先级高于CLAUDE.md，但是并非所有的Auto Memory内容都会被加载。
### 四种记忆类型
Auto Memory中一共有4种不同的记忆类型:
- user:用户的身份、偏好、背景知识等。比如"用户目前在字节跳动工作"、"用户比较喜欢用Python进行编程"等。
- feedback:用户反馈的内容，比如"不要在响应的末尾进行总结"、"这次回答的风格非常好，下次保持"，用户对claude code行为的肯定和纠正都会被记录。
- project:项目的进展、决策截至日期等。比如"2026-4-25,fklovely提交了项目的一个关键PR"。
- reference:外部系统的定位信息。也就是说去哪里去找信息，比如"API 设计规范在 Confluence 的某个页面中"。

feedback类型的记忆有一个强制结构，记忆必须包括三个部分:规则本身、Why以及How to apply。为什么要这么做呢？因为feedback这类记忆，需要让模型知道为什么以及什么时候应用，举个例子，假如一条feedback是，"不要 mock 数据库"，Agent 会在所有测试中避免 mock。但如果记忆还包含"Why: 上季度 mock 测试通过但生产环境迁移失败"，Agent 就能判断——这条规则适用于集成测试，单元测试中的轻量级 mock 可能没问题。
project类型的记忆也有一个结构要求，那就是将相对日期转换为绝对日期，当用户说"周三之后合并冻结"，记忆必须存为"2026-07-01 后合并冻结"。原因很简单：记忆可能在几周后被另一次会话读取，此时"周四"已经毫无意义。
Memory.md是Auto Memory的索引文件，<span style="color:red;">claude code中的记忆均在本地以md文件格式存储</span>，打开你的.claude/projects/memory文件夹，就可以看到Memory.md文件，打开发现它的标题就是"Memory Index"。
每个.md记忆在Memory.md中以一行链接条目的形式存在:

```markdown
- [用户角色](user_role.md) — 数据科学家，专注可观测性
- [简洁回复偏好](feedback_terse.md) — 不要尾部总结
- [合并冻结](project_freeze.md) — 2026-03-05 移动端发布冻结
- [Bug 追踪](reference_linear.md) — 管道 Bug 在 Linear INGEST 项目
```
<span style="color:red;">Memory.md的内容每次会话都会被加载</span>，这样可以让Agent快速地知道有哪些记忆可以使用，不依赖于之后的检索。
但是如果全部条目均被注入到system prompt中，会带来上下文爆炸的风险，因此claude code做了两条限制:
- 注入的条数不超过200
- 每一行的长度不超过200KB

### 检索方式
不同于很多Agent系统做的基于RAG的长期记忆方案，claude code选择直接使用Sonnet模型进行语义对比召回。

claude code会对memory文件夹下的除了MEMORY.md以外的所有.md文件进行前30行的读取，然后按照时间排序，只取前200个记忆。
Sonnet会根据用户的输入判断应该采用哪些记忆，取前5个进行召回。每次记忆召回时会进行`alreadySurfaced`过滤，避免召回之前已经召回过的记忆。

扫描的结果被格式化为清单，清单格式为:
- [feedback] feedback_terse.md (2026-03-28T10:30:00Z): 用户不希望在响应末尾看到总结
- [project] project_freeze.md (2026-03-01T09:00:00Z): 2026-03-05 合并冻结，移动端发布
格式中的 ISO 时间戳至关重要——它让 Sonnet 能判断记忆的新鲜度。一个月前的"合并冻结"记忆很可能已过时，Sonnet 可以据此降低其优先级。

### 记忆的新鲜度问题
记忆是会过期的，也会有漂移问题，对于我们人类而言，常常会记错事情，对于Agent系统同样如此。
因此memoryAge.ts 会将 记忆的mtime 转为人类可读的字符串，比如47 天 → "47 days ago"，对于超过一天的记忆，系统会注入警告文本："Memories are point-in-time observations, not live state — claims about code behavior or file:line citations may be outdated."

同时系统也要求不得盲信记忆，系统提到一个函数，必须grep看其是否还存在，如果记忆提到一个文件路径，用 Glob/Read 验证它是否存在。
### 记忆是如何被写入的？
一个非常自然的想法是主Agent自己写入，但是这样不利于主Agent的上下文维护，会让上下文变得更杂，Claude Code的做法是采用Hook，也就是钩子，当一轮query结束，也就是主Agent不再调用工具时，通过Stop Hook触发，它会fork一份主对话，并复用prompt cache，同时这个记忆提取的过程会有两层机制:
1.频率控制，会通过hasMemoryWritesSince()来检查本轮主Agent是否已经写入了记忆，如果有的话，则跳过提取记忆Agent。
2.并发防护，假如当前提取Agent还在运行，而主Agent又结束了一轮，此时不会再启动一个新的提取Agent，而是将新请求暂存为pendingContext，等旧提取完成再开始执行，并只处理新的主Agent消息内容。

提取Agent的工具权限：1.Read / Grep / Glob这类只读工具。2.可以使用Bash命令，但是也只能执行只读命令。3.Edit / Write，但是只能在记忆目录内使用，会通过isAutoMemPath()进行路径的校验。
其他的所有工具都会拒绝。

提取提示词的设计:1.高效率，在src/services/extractMemories/prompts.ts中指出，提取分为两个步骤，Turn 1: 并行发起所有读取；Turn 2: 并行发起所有写入。这最大化了工具调用的并行度，通常 2 个回合就能完成工作（硬上限是 5 个回合）。2.防重复，Agent需要先看是否已有类似记忆，再决定是否创建新的记忆。3.范围限制：MUST only use content from last ~${newMessageCount} messages——只从最新的消息中提取，不重新处理已处理过的历史。

## autoDream
记忆既然有写入，就势必有更新和遗忘。autoDream就是Claude code中负责Auto Memory更新和遗忘的机制。

autoDream的触发需要满足以下4个条件:
- AutoDream和Auto Memory开关开启
- 距离上次触发已过24小时
- 用户新建了5个以上的会话
- 当前没有其他autoDream进程
### 整理Memory的机制
autoDream首先会检查当前有哪些记忆，比如使用ls命令得到"user_role.md" "feedback_testing.md"（以下统称topic文件）。

然后会搜集新的信息，主要有以下几个方法:
- 阅读每日日志`logs/YYYY/MM/DD.md`
- 使用`Grep`在代码库中搜索记忆中提到的函数/文件名是否存在
- `Grep`会话转录，会话转录就是你与Claude code的对话历史，一般是sessionId.jsonl文件

模型会根据搜集到的新信息进行推理，决定topic文件是否应该新建、更新或者删除。

## 记忆是如何注入会话的？
在前面我们讲解了记忆的生成、检索等一系列机制，但是还有一个关键的问题是，CLAUDE.md和MEMORY.md这些内容在会话中存在于哪里呢？或者说在一次调用api请求模型回答中，存在于哪一部分？是不是系统提示词？答案是否定的，因为显然CLAUDE.md和MEMORY.md是属于变化的比较多的，而系统提示词是要力求稳定的，这样才能不破坏cache。

发送给模型的上下文可以分为三部分，分别是系统提示词、tools Schema、以及messages，messages的最前面一部分叫做User Context，CLAUDE.md和MEMORY.md文件就存在于此。而通过Sonnet召回的规则则是作为Message中的User Message类型注入到对话中。