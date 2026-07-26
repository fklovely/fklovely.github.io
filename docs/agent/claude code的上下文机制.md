---
title: claude code的Context Engineering
date: 2026-07-11 19:02:00
tag:
  - Claude Code
description: 看了很多篇资料，详细地讲一下Claude code的上下文工程，相信你会有所收获
---
# 上下文工程
上下文工程是Agent系统中至关重要的一环，我觉得它的核心理念就是"如何给模型减负？"，模型的上下文终究是有限的，其中可能有很多信息是无用的，这会影响使用效率和模型的输出质量。接下来我可能会结构稍微乱一些地展开叙述。
## 大结果持久化到磁盘(Context Offloading)

这是一个很典型的交换思想，如果一个工具返回的结果非常大，超过其规定的maxResultSizeChars（一般默认为50000字符），则将其结果转移到磁盘中，在上下文窗口里只留下一个持久化的路径，以及前2000字节的预览，在需要时调用Read工具读回来。在上下文中保留的可能是这样的:
<persisted-output>
Output too large (48.8KB). Full output saved to: C:\...\tool-results\toolu_xxx.txt

Preview (first 2KB):
前 2KB 内容……
...
</persisted-output>
这里有一个非常需要注意的点，如果说以后要读回来的话，那么大结果还是会被读取到上下文中，这样一来一回上下文不是反而被消耗的更多吗?如果只看一轮，且写盘以后百分百被重新读取的话，确实是这样的。但是当我们把视角拉长，我们会发现，如果没有Context Offloading，那么第5轮，写进了一个2MB的结果到上下文，之后的每次请求都会携带它，这个成本是很高的，且不利于模型的注意力，使用Context Offloading则只有几KB的空间占用，且根据经验，写盘后的绝大多数，是不需要再次被拿回来的，这样就高效很多。
这里面还有一个问题，offloading之后只给模型看到了persist路径和前2KB的截断内容，那这截断里可能会损失掉关键信息啊，换言之，这不导致claude code很大可能要再回去拿吗？其实不一定，claude code完全可以通过工具去persist file里搜索信息，比如使用grep搜索关键词。如果使用一个子agent对ToolResult进行摘要总结是否可行呢？我个人感觉可行，但是要注意几点，首先就是成本会上升，更贵，而且不够稳定，生成摘要可能会面临模型超时、降级等风险，还有就是不够精确，因为摘要模型不知道输出结果的重点在哪里，可能反而会损失掉更多的信息。

## Compact
提起上下文工程，就不得不提到Compact机制，也就是压缩。过去我在学习Agent的时候，常常能看到的压缩技巧有摘要和滑动窗口，算是两种非常自然的想法，比较简单粗暴，但其实即便是摘要，我们也不得不考虑如何产生更好的摘要，如何在摘要后使得Agent不迷失方向，因此这里面的学问也是不少的。
### microcompact
这是Claude code中设计得十分精妙的瘦身机制，它针对的是工具的输出结果，将部分ToolResult直接删除，只留下一个占位符"Old tool result content cleared",这里有一个非常重要的点，因为如果删除掉ToolResult的话，按照我们的通常理解，这毫无疑问会破坏掉cache，这是不可接受的，关键就在于Anthropic加了额外的手段。
#### 基于时间的microcompact
Claude code中的cache是有时间限制的，一般为5分钟，命中后会刷新时间，但其实5分钟并不算久，你可能上个厕所的功夫，回来缓存就失效了，这个时候microcompact就完美地发挥了功效:反正缓存已经失效了，需要重建缓存了，删点ToolResult怎么了。这里有个十分重要的点在于，不是所有的ToolResult都会被microcompact影响，claude code限定为八个工具:Read、Grep、Glob、Bash、WebFetch、WebSearch、FileWrite、FileEdit。为什么是这八个工具呢？我觉得可以分为3类来看原因：
1.Read、Grep、Glob。这三个工具返回的都是本地项目在某个时间的观察快照，而项目的修改可能是比较频繁的，我们需要更权威、实时的结果，因此可以删去其ToolResult。同时如果文件没有被修改的话，它还是幂等的，是可复现的。
2.Bash，其执行结果是典型的高体积、低信息密度，比如返回大量日志，不过Bash并不是幂等的，因此这里实际是有取舍的。
3.WebFetch、WebSearch，它们的结果通常会被claude code当场使用，随着时间推移，其价值会越来越低，但其也并非幂等，也仍然有取舍。
4.FileWrite、FileEdit，编辑工具的结果已经被持久化到文件系统中，因此当然不需要再保留其结果。
这个删ToolResult是怎么个删法？其实就是扫描ToolResult，将比较早的是上面8个工具的结果删去，简单高效。
#### 缓存编辑的microcompact
上面基于时间的microcompact针对的是缓存已经过期的情况，但是如果缓存没过期的话该怎么办呢？Anthropic使用了一种叫做cache_edits的方法，它是Anthropic提供的一种协议级别的操作。
它会构建一个cache_edits块，在工具结果上添加一个cache-reference，告诉服务端删除这些cache-reference所指向的内容。那么这里有一个问题是，到底是怎么做的，使得可以删除内容而保持cache不损失呢？

### AutoCompact
AutoCompact是最后的压缩手段，我们经常看到的"claude code正在压缩上下文"就是在执行这个操作，可以说是我们最容易直观感受到的claude code操作之一了。
#### 压缩的阈值
常见的压缩阈值可能是采用的百分比的方法，例如在上下文达到90%时进行压缩，Claude code则使用一个固定的值，具体是这样计算的:
effectiveWindow= modelContextWindow- min(modelMaxOutputTokens, 20,000)

autoCompactThreshold= effectiveWindow- 13,000
所以autoCompactThreshold=modelContextWindow- min(modelMaxOutputTokens, 20,000)-13,000
这里modelContextWindow就是模型的最大上下文，modelMaxOutputTokens是模型的最大输出token。后面减去一个固定的13k。

说是阈值，但其实我们也可以手动执行/compact命令进行压缩，而且手动的压缩可以传一段指令，可以重点关注一些内容，最大程度保留你想保留的。如果是自动模式的话，提示词会让摘要禁止生成下一步做什么之类的问题，因为摘要一般是在运行过程中压缩出来的，得继续干活才行。
#### 压缩的细节
Claude Code的压缩还是有挺多讲究的，不是简单粗暴地来一句"给出上下文的摘要"，首先就是压缩后的上下文会有4段结构，边界标记、摘要、附件以及Hook。
边界标记会给出本次压缩是自动/人工，压缩前的token是多少，最后一条消息id，摘要顾名思义就是摘要，附件包含的内容则比较多了，有最近读取的文件+ 后台异步 Agent 状态+ Plan 文件+ Plan Mode+ 已调用 Skills+ Deferred Tools 信息+ Agent 定义列表+ MCP Instructions。Hook则是用户配置的动态Hook，可能返回additional Context信息。
Claude code给压缩的提示词有200多行，其中反复强调了不要调用工具，源码提到早期的Sonnet 4.6偶尔会无视指令，所以这一点需要反复强调才行。模型会被告知先生成一份草稿，然后再给出摘要，带xml标签的格式:
<analysis>
[模型的推理草稿，分析对话哪些重要]
</analysis>

<summary>
[结构化的摘要，按 9 个清单分块]
</summary>
采用一个COT的技巧，提高摘要生成的质量，最终进入摘要的只会有summary部分，这里的9个清单包括:
1	Primary Request	用户的所有显式请求和意图
2	Key Technical Concepts	讨论的技术概念、框架
3	Files and Code	检查/修改/创建的文件及关键代码片段
4	Errors and Fixes	遇到的错误及修复方式，特别是用户反馈
5	Problem Solving	已解决的问题和进行中的排查
6	All User Messages	所有非工具结果的用户消息（原文）
7	Pending Tasks	待完成的任务
8	Current Work	压缩前正在进行的工作（最详细）
9	Optional Next Step	下一步计划（包含原始对话的直接引用）
同时在压缩后的开头，会添加一句"本会话是从之前一次因为上下文耗尽而中断的对话延续过来的。以下摘要概括了之前的对话内容。"
再单独地讲一讲附件信息，上面提到过，附件会包括最近读取的文件，这里的限制是最近的5个读取的文件，每个最多5k token，Skills则限制单个5k token，最多25k token。然后Claude.md的内容不进压缩，只会被清空缓存，压缩后再次使用getUserContext获取。系统提示词也不会进入压缩中。

#### Session Memory
