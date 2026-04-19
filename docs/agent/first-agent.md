---
title: Agent 专题开篇
date: 2026-04-19
tag:
  - Agent
description: Agent 专题开篇，列一下会写哪些方向
---

# Agent 专题开篇

这是 Agent 分类的第一篇。后续这里会记录一些围绕 LLM Agent 的学习和实践。

## 预计会写的方向

- **基础概念**：Function Calling、Tool Use、ReAct 范式
- **框架实战**：LangChain、LlamaIndex、AutoGPT、CrewAI
- **Multi-Agent 协作**：角色分工、通信、任务编排
- **RAG**：检索增强生成的工程化做法
- **评估与安全**：Agent 行为评测、防越狱

```python
# 一个最小的 function-calling 示例
from anthropic import Anthropic

client = Anthropic()
response = client.messages.create(
    model="claude-opus-4-7",
    tools=[{...}],
    messages=[{"role": "user", "content": "帮我查一下天气"}]
)
```

---

*此篇作为分类占位，正式内容慢慢补。*
