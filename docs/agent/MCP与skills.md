---
title: MCP与Skills
date: 2026-06-22 13:03:00
tag:
  - Generic
cover: /covers/mcp_vs_skills_cartoon_infographic.png
description: 非常经典的一道概念辨析面试题
---

# MCP vs Skills

MCP 与 Skills 是每个 Agent 工程师的老朋友了。今天看起来 Skills 依旧风头正盛，MCP 则没有刚提出时那么热闹，但这道概念辨析题依旧很经典，也很适合用来判断一个人是否真正理解 Agent 系统的外部能力扩展方式。

## MCP

MCP（Model Context Protocol）也就是模型上下文协议，由 Anthropic 于 2024 年 11 月提出。它的主要目的，是统一大模型对外部工具和上下文资源的调用方式。

注意，MCP 本身是协议，而不是某一个具体工具。它更像一套约定：Agent 要怎么发现外部能力、怎么描述参数、怎么发起调用、怎么拿到返回结果。

在很多教程里，MCP 通常由三个部分构成：

| 角色 | 通俗理解 | 示例 |
|------|----------|------|
| Host | 用户真正交互的 Agent 应用 | Claude Code、Cursor、桌面 Agent |
| Client | Host 内部负责连接 MCP Server 的组件 | Agent 系统里的连接器或适配脚本 |
| Server | 能力提供方 | 数据库服务、文件服务、搜索服务 |

需要注意的是，MCP Server 不一定是远程服务，也可以运行在本地。本地 Server 常见的通信方式是 `stdio`，也就是操作系统为程序提供的标准输入、标准输出、标准错误这一组基础通信通道，与具体编程语言无关；远程 Server 则可以通过 HTTP 类传输方式与 Client 通信。

既然 MCP 是一个标准通信协议，那么它究竟“标准”在哪里呢？主要体现在下面几个方面。

### 1. 标准化消息结构

MCP 规定 Client 和 Server 之间使用 JSON-RPC 2.0 消息，包括：

- 请求：`request`
- 成功响应：`result`
- 错误响应：`error`
- 单向通知：`notification`

比如，发起一个工具调用请求时：

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "query_orders",
    "arguments": {
      "date": "2026-06-21"
    }
  }
}
```

Server 返回结果时，也要遵循统一结构：

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "共查询到 42 笔订单"
      }
    ]
  }
}
```

可以看到，请求里需要有 `id`、`method` 和 `params`，响应里的 `id` 需要与请求对应。这样 Client 才能知道：这次返回结果，究竟对应的是哪一次调用。

### 2. 标准化操作方法

MCP 定义了一组统一的方法名，例如：

```text
initialize
tools/list
tools/call
resources/list
resources/read
prompts/list
prompts/get
```

以工具为例：

- `tools/list`：请告诉我你有哪些工具。
- `tools/call`：请调用这个工具，并传入这些参数。

这就是协议的价值。只要大家都遵守同一套方法名和消息结构，不同 Agent 与不同服务之间就可以更容易地连接起来。

### 3. 标准化工具描述

MCP 规定工具需要通过 JSON Schema 描述。也就是说，Server 需要用结构化方式告诉 Client：

- 工具叫什么名字；
- 工具可以做什么；
- 工具接收哪些参数；
- 哪些参数是必填的；
- 参数分别是什么类型；
- 参数是否有枚举值、格式约束等。

比如：

```json
{
  "name": "query_orders",
  "description": "查询指定日期的订单",
  "inputSchema": {
    "type": "object",
    "properties": {
      "date": {
        "type": "string",
        "description": "查询日期，格式为 YYYY-MM-DD"
      },
      "status": {
        "type": "string",
        "enum": ["success", "failed"]
      }
    },
    "required": ["date"]
  }
}
```

这样一来，Agent 不需要靠猜来理解工具，而是可以从结构化 Schema 中知道应该传什么参数、哪些参数不能省略、哪些值是合法的。

### 4. 标准化连接流程

MCP 还规定了 Client 与 Server 建立连接时的基本流程：

```text
Client                     Server
  │                          │
  │──── initialize ─────────>│
  │                          │
  │<── 版本和能力信息 ───────│
  │                          │
  │──── initialized ────────>│
  │                          │
  │──── tools/list ─────────>│
```

初始化时，双方会交换一些关键信息：

- MCP 协议版本；
- Client 支持哪些能力；
- Server 支持哪些能力；
- 软件名称和版本；
- 可选功能是否可用。

比如，一个 Server 可能会声明自己支持这些能力：

```json
{
  "capabilities": {
    "tools": {
      "listChanged": true
    },
    "resources": {
      "subscribe": true,
      "listChanged": true
    }
  }
}
```

这一步有点像双方先握手：先确认“你是谁”“你支持什么”“我能怎么调用你”，然后再进入真正的工具发现和调用阶段。

### 5. 标准化能力分类

MCP 把 Server 提供的主要能力分为三个核心概念：

| 类型 | 作用 | 示例 |
|------|------|------|
| Tools | 执行操作 | 查询数据库、创建工单、发送消息 |
| Resources | 提供上下文数据 | 文件、日志、数据库结构 |
| Prompts | 提供提示模板 | 代码审查模板、故障分析流程 |

例如，一个数据库 Server 可以这样组织能力：

```text
Tools
├── query_database
└── explain_query

Resources
├── database://schema
└── database://tables/orders

Prompts
└── analyze_slow_query
```

简单来说，Tools 负责“做事”，Resources 负责“给上下文”，Prompts 负责“提供一套可复用的提示流程”。

## Skills

相比 MCP，Skills 可以介绍的部分要少得多。通俗地讲，Skills 就是一套“做事情的流程”。是的，就是这么简单。

一个 Skill 的目录结构通常类似这样：

```text
my-skill/
├── SKILL.md               # 必需：元数据 + 核心工作流程
├── scripts/               # 可选：可执行脚本
├── references/            # 可选：参考资料、规范文档
├── assets/                # 可选：模板、示例、静态资源
└── agents/
    └── openai.yaml        # 可选：展示信息和外部依赖配置
```

其中，`SKILL.md` 是必需的，通常包含 YAML 前置元数据（frontmatter）以及 Markdown 格式的详细指令：

```markdown
---
name: my-skill
description: 技能描述，说明何时使用此 Skill
---

# 技能标题

[详细指令内容...]
```

这里的 `name` 和 `description` 是元数据。Agent 加载 Skills 列表时，通常只会先看到元数据；等它真正决定使用某个 Skill 时，才会继续读取 `SKILL.md` 里的详细内容。这就是所谓的渐进式披露。

这个设计非常实用。因为 Agent 不需要一开始就把所有技能的完整说明都塞进上下文里，只需要先看一眼“有哪些技能”“什么时候该用”，真正用到时再展开完整流程。这样既节省上下文，又能把复杂任务沉淀成可复用的操作手册。

## MCP 与 Skills 的对比

如果要一句话区分它们：

> MCP 解决的是“Agent 如何连接外部能力”，Skills 解决的是“Agent 如何按照经验把事情做好”。

更具体一点，可以这样对比：

| 维度 | MCP | Skills |
|------|-----|--------|
| 本质 | 通信协议 | 工作流说明 |
| 主要问题 | 如何发现、描述和调用外部工具或资源 | 如何把一类任务做得稳定、专业、可复用 |
| 作用对象 | 外部服务、工具、资源、提示模板 | Agent 的行为步骤、判断规则、参考资料 |
| 交互方式 | Client 与 Server 通过标准消息通信 | Agent 读取 Markdown 指令并按流程执行 |
| 产物形式 | MCP Server、工具 Schema、资源 URI、协议消息 | `SKILL.md`、脚本、参考文档、模板资源 |
| 强项 | 标准化连接，适合跨工具、跨系统集成 | 沉淀经验，适合复杂任务的流程化执行 |
| 局限 | 只规定“怎么连、怎么调”，不保证任务做得好 | 主要约束 Agent 行为，本身不是外部工具协议 |
| 典型场景 | 查询数据库、调用业务系统、读取外部资源 | 写文档、做代码审查、生成报表、处理特定领域任务 |

所以，MCP 和 Skills 并不是互相替代的关系，而是分工不同。

MCP 更像一套“插座标准”：只要接口统一，Agent 就能接上各种外部能力。Skills 更像一份“操作手册”：告诉 Agent 在某类任务里应该先做什么、再做什么、哪些坑要避开、哪些资料可以参考。

最理想的情况，是二者配合使用：MCP 负责把外部能力接进来，Skills 负责把这些能力组织成可靠的工作流程。前者解决“能不能接、怎么接”，后者解决“接上以后怎么做得好”。
