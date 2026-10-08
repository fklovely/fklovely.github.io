---
title: Harness-03 Agent Hooks
date: 2026-09-16 14:08:00
tag:
  - Harness
description: 关键周期的额外处理-Hooks
---
# 什么是Hooks
我在之前的Harness开篇有简单地提到过hook,比如我们在工具执行前后通常会执行相关的一些操作，对于hook，我的个人理解就是在Agent运行的某个时间节点，例如工具执行前后、打算结束当前轮次时，所设计、执行的相关操作。当然我们本身不会设计过多的hooks，而是应该更多地把配置交给Harness的用户，我们需要做好的是Hook的配置、执行等机制。
## Hooks的属性
我觉得我们设计一个东西，首先得考虑到它的属性，比如对于一个人，那么就会有高矮胖瘦这些属性，我们需要抽象出一些共同的性质，来对Hook进行描述。我们首先可以从我刚才说过的，Agent的事件节点来划分，我们容易想到`PreToolUse`、`PostToolUse`、`PreCompact`、`PostCompact`等，这是一类。
## 以PreToolUse为例
这是一个十分常用的Hook，在工具真正执行前设置一个钩子，进行相应的操作。
