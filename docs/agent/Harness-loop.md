---
title: Harness-01 Agent Loop
date: 2026-09-04 21:50:00
tag:
  - Harness
description: 今天起打算花费一个星期左右的时间，来完成我的Harness学习以及博客的写作。
---

# Harness大观

学习一个东西之前，我们需要先大致地了解它的本质，给它定个性，所谓Harness，大概就是使得Agent系统能够持久、稳定运行的东西。

一开始是Prompt工程，再到Context工程，后来人们发现其实工具系统、上下文的压缩、记忆机制等都大有文章，这些Agent的组成部分便是Harness，因此Agent也可以理解为LLM + Harness。

现在概念很多，又出现了一些新的名词，比如loop工程、graph工程等，但我觉得这些其实并没有脱离harness的范畴，graph工程甚至有点返璞归真了，其核心思想和Langgraph感觉没有区别。

现在的很多Agent项目，其实更加偏向于workflow，其执行路线是比较固定的，典型代表有客服系统，划分不同的阶段，每个阶段设置一个LLM，消息是顺序传递的，然后大多还会配合一个RAG机制。

这种架构是不够灵活的，不够Agentic，但很多时候人们也叫其Agent，似乎只要有大模型的参与就够了。所以这里做一个严格的区分，我们这个系列要讲的是严格的Agent。

## 简单的while循环

要了解Agent、了解Harness，我们应当先知道Agent是如何运行起来的，这就要求我们把握它的结构。

不同于workflow的整体线性结构，Agent整体是一个环，它是一个不断选择工具、执行工具获得结果、根据结果决定下一步是否结束/调用工具的过程，这个过程可以用一个while循环来很好地表达，下面的伪代码可以很清楚地表达Agent循环:

```javascript
while(true){
    await llmResponse(Prompts,Messages)
    if(!hasToolsCall){
        break;
    }
    toolResult=exectue(tool)
    Messages.add(toolResult)
}
```

主流的所有Agent系统，比如Claude code、Codex、pi等等，都跳脱不出这个简单的循环结构，主要就是以下几个步骤:

1. 给LLM提示词和消息，LLM会根据看到的消息进行回复，回复消息里可能包含工具调用。
2. 如果没有工具调用，结束Agent循环，也就是这次回复结束。
3. 否则执行调用的工具，将此次执行的结果添加到消息列表中，开启下一轮循环。

怎么样，是不是非常简单？

在实际的Agent系统Harness设计中，我们常常还会设计一些钩子，也就是Hooks，用于工具执行前后的一些操作，比如权限校验、用户审批等等。

修改后的伪代码可以是这样的:

```javascript
while(true){
    await llmResponse(Prompts,Messages)
    if(!hasToolsCall){
        break;
    }
    beforeToolExectue
    toolResult=execute(tool)
    Messages.add(toolResult)
    AfterToolExectue
}
```

以上基本就是对Agent loop的整体结构把握，下一篇文章会讲述工具机制。
