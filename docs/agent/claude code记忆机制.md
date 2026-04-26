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
- feedback:用户反馈的内容，比如"不要再响应的末尾进行总结"、"这次回答的风格非常好，下次保持"，用户对claude code行为的肯定和纠正都会被记录。
- project:项目的进展、决策截至日期等。比如"2026-4-25,fklovely提交了项目的一个关键PR"。
- reference:外部系统的定位信息。也就是说去哪里去找信息，比如"API 设计规范在 Confluence 的某个页面中"。
### Memory.md索引文件
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
Sonnet对根据用户的输入判断应该采用哪些记忆，取前5个进行召回。每次记忆召回时会进行`alreadySurfaced`过滤，避免召回之前已经召回过的记忆。
### autoDream
记忆既然有写入，就势必有更新和遗忘。autoDream就是Claude code中负责Auto Memory更新和遗忘的机制。

autoDream的触发需要满足以下3个条件:
- 距离上次触发已过24小时
- 用户新建了5个以上的会话
- 当前没有其他autoDream进程
autoDream首先会检查当前有哪些记忆，比如使用ls命令得到"user_role.md" "feedback_testing.md"（以下统称topic文件）。

然后会搜集新的信息，主要有以下几个方法:
- 阅读每日日志`logs/YYYY/MM/DD.md`
- 使用`Grep`在代码库中搜索记忆中提到的函数/文件名是否存在
- `Grep`会话转录，会话转录就是你与Claude code的对话历史，一般是sessionId.jsonl文件

模型会根据搜集到的新信息进行推理，决定topic文件是否应该新建、更新或者删除。