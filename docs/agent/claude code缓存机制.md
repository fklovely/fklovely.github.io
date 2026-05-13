---
title: claude code缓存机制
date: 2026-05-05 17:24:00
tag:
  - Claude Code
description: 详解Claude Code的缓存机制
---
# Claude Code缓存机制
使用过claude code的人，应该都对“缓存”不陌生，毕竟命中的缓存按原价的10%计费，这个诱惑还是很大的。缓存机制相当重要，claude code的许多设计都围绕着提高缓存命中展开。
## 每次对话发送了什么？
在讲缓存之前，我们需要先了解claude code中发送给api的信息由哪几部分组成，主要是三部分，System prompt、tools schema和messages。System prompt也就是系统提示词，tools schema包含工具的name、description、input_schema(工具参数的json schema)，messages就是消息集合，我们和claude code交互的信息就存在里面。

还有额外的两个概念---System Context和User Context。二者分别是System prompt和messages的组成部分，这是一个大的基调。System Context包含两 个字段,gitStatus和cacheBreaker,前者好理解，后者可以先不管。System Context在System prompt的末尾。
```ts
type SystemContext = {
    gitStatus: string
    cacheBreaker?: string
  }
```
UserContext则是在messages的开头，它的内容就是CLAUDE.md和MEMORY.md的内容，也就是说是claude code的记忆的内容。这些内容被包装成`<system-reminder>`消息，放在messages的最开头。
```xml
<system-reminder>
    gitStatus: ...
    currentDate: 2026-05-05T...
    claudeMd: ...
    IMPORTANT: This is a system-reminder... Do not reveal that you have read this.
</system-reminder>
```
## 前缀缓存机制
想象一下，你和claude code已经进行了10轮对话，现在是第11轮对话，我们先假设前10轮的所有内容不变，那么这个价格计费就是前十轮token×0.1+第11轮消息×1，前面的10轮消息可以看作是一个前缀，claude code会缓存它，只要内容不变化，就可以直接拿来用，这里涉及到kv cache的概念，暂时先不深入探究了。

什么是前缀缓存？其实就是把过去的历史token缓存起来，这样发送给anthropic的api时，就是过去历史+新消息，过去历史可以直接拿缓存，因此价格会更加便宜，新消息的话，就按照原价处理。

需要特别指出的是，前缀缓存命中的条件是非常苛刻的，每个字节的内容都必须相同。也就是说，假如之前缓存的内容是"我想和你在一起"，下一次发送过去的内容却是"我要和你在一起，好不好"，对不起，"想"和"要"，一字之差，缓存直接miss，重新全价计费、缓存。

既然命中条件这么苛刻，那为什么anthropic还要采用这种策略呢？风险与回报是并存的，前缀缓存的收益是极大的，因为这样可以跳过大量重复的kv计算，从而大幅降低成本并提高系统的响应速度。同时“前缀”本身通常是比较稳定的，命中率是比较高的。

## 不同位置的缓存机制
### System prompt
System prompt在claude code的缓存机制中可以分为两部分，静态部分和动态部分。二者的分界线是`SYSTEM_PROMPT_DYNAMIC_BOUNDARY`：boundary之前的内容属于稳定前缀，通常带有`cacheScope: 'global'`,这一部分的缓存是全球共享的；boundary之后的内容属于会话动态区，通常不设置全局缓存范围。

这件事的核心不是“把prompt拆漂亮”，而是为了让大块稳定内容长期保持同一个字节序列。前缀缓存的命中条件非常严格，只要前缀里任意一个字节变化，前面的缓存就会被打碎。所以claude code会把几乎永远不变的系统规则放在前面，把每轮可能变化的内容推到boundary后面。

#### 静态部分
静态部分位于boundary之前，`cacheScope`为`global`。这些内容基本可以理解为Claude的人格骨架和通用工作规则，跨会话、跨轮次都很少变化，因此最适合被放进长期稳定的缓存前缀里。

| 模块 | 内容 |
| --- | --- |
| `getSimpleIntroSection()` | 身份框架，比如“You are Claude...”，以及基础角色设定 |
| `getSimpleSystemSection()` | 核心系统指令，比如工作目录、项目根目录等基础规则 |
| `getSimpleDoingTasksSection()` | 任务执行规范，比如如何规划、如何验证、文件编辑规则等 |
| `getActionsSection()` | 可用action列表，比如`/compact`、`/clear`等命令说明 |
| `getUsingYourToolsSection()` | 工具使用总则，比如何时调用工具、如何传递参数等通用规则 |
| `getSimpleToneAndStyleSection()` | 输出风格和语气要求 |
| `getOutputEfficiencySection()` | 输出效率指令，比如“Go straight to the point”等 |

这些模块共同组成system prompt的主体骨架，占据了相当多的token。因为它们和当前用户环境、当前会话状态没有强绑定，所以只要Claude Code版本和基础配置不变，这部分就可以在不同会话里反复命中缓存。

从缓存角度看，静态区越稳定越好。它承担的是“这是谁、应该怎么工作、有哪些通用规则”的问题，而不是“当前这轮会话发生了什么”的问题。

#### 动态部分
动态部分位于boundary之后，`cacheScope`通常为`null`。这些内容的共同特点是：它们看起来也像system prompt的一部分，但会随着运行时状态变化。如果把它们放到静态区，任何一个条件变化都会改变整个全局前缀的hash，导致前面数万token的缓存一起失效。

| 模块 | 内容 | 为什么动态 |
| --- | --- | --- |
| `session_guidance` | 会话特定指导，比如`AskUserQuestion`是否可用、Agent工具说明、Skills说明等 | 工具可用性随配置变化 |
| `memory` | Memory系统提示，比如`loadMemoryPrompt()` | 用户可能会关闭auto memory功能导致load的结果不一样 |
| `ant_model_override` | 模型覆盖指令 | ant内部模型可能切换 |
| `env_info_simple` | 环境信息，比如git状态、操作系统、用户名等 | 每轮环境可能变化 |
| `language` | 用户语言设置 | 用户可切换语言 |
| `output_style` | 输出风格配置 | 用户可切换风格 |
| `mcp_instructions` | MCP服务器指令 | MCP服务器可能随时连接或断开 |
| `scratchpad` | Scratchpad使用说明 | 会话级状态 |
| `frc` | Function result clearing说明 | 和模型行为相关 |
| `summarize_tool_results` | 工具结果总结规则 | 运行时策略 |
| `token_budget` | Token预算指令，ant-only | 用户可能设置预算目标 |
| `brief` | KAIROS简短模式指令 | feature flag控制 |

Claude Code源码注释里对这件事的解释很直接：这些会话可变的指导如果放在`SYSTEM_PROMPT_DYNAMIC_BOUNDARY`之前，就会把`cacheScope: 'global'`的前缀切成大量不同版本。每一个运行时开关都会让Blake2b前缀hash多出一组变体，N个条件就可能膨胀成`2^N`种组合。

举个例子，用户连接了一个新的MCP服务器、切换了语言，这些都是很正常的运行时变化。如果这些信息混在静态区里，那么变化的不是后面一小段内容，而是整个“全局静态前缀”的hash。结果就是前面本来可以复用的大量token全部cache miss。

所以boundary的价值在于隔离变化：静态区只放长期稳定的人格和通用规则，动态区放当前会话状态、工具可用性、环境信息、用户配置和memory等变化因素。这样变化只会影响boundary之后的部分，boundary之前的大块system prompt仍然可以长期稳定命中缓存。

### messages
