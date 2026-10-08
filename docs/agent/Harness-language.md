---
title: Harness-00 Agent Language
date: 2026-09-05 16:17:00
tag:
  - Harness
description: 从主流Agent系统看Agent开发的语言选择
---
# Agent系统语言的选择
"工欲善其事，必先利其器"，这是很多教程偏爱的一句话。构建Agent系统、做好Harness，肯定是要编写程序的，那么就涉及到编程语言的选择。
我们很容易想到使用Python构建Agent，因为我们知道LLM是用Python进行训练的，但是LLM只是Agent的一个组件，虽说是很重要的甚至是核心，LLM并不表现出Python友好的特性，我们构建Agent/harness，大量的时间都在等待模型回复和工具执行结果，这启示我们需要使用一种具有强大异步I/O并发能力的语言，我们容易想到Java或者Go，然而，目前市面上大多数Agent都选择了TypeScript。
## Node.js
就算你没有构建过Agent，但只要有过点编程经验，就不会对Node.js这个名词感到陌生，它实在是被使用地太过广泛了。Node.js是javascript的运行时，这是什么意思呢？也就是说，虽然javascript规定了变量怎么定义、函数怎么定义，但是真正运行代码时，靠的是Node.js，就像CPython之于Python一样。不过Node.js并非javascript的唯一runtime，目前Bun也在兴起(Claude code严选)。
### Node.js的异步并发模型
首先最需要明确的一点是，Node.js并非只有一个单线程，而是一个执行javascript代码的单线程+多线程/操作系统并行处理IO+事件循环调度结果。事件循环，也就是Event Loop，可以理解为主线程中的一个`while`循环，类似下面这种:
```text
while (程序还没结束) {
  检查有没有到期的 timer;
  检查有没有完成的 I/O;
  检查有没有可以执行的 callback;
  执行它们;
}
```
假如现在来了一个异步方法，它执行相关的IO操作，那么javascript会在`await`的地方，将这个函数挂起，转头去执行别的代码，等到事件循环监控到可以继续刚才的代码了，就回去执行完函数，这就是回调的过程(Call Back)。那Node.js的强大并发能力从何而来呢？就在于上面提到的多线程和操作系统并行I/O，更具体一点是OS Async I/O以及libuv库，libuv是一个用C语言编写的高性能的异步I/O库，它就是为Node.js而开发出来的。
考虑网络场景，假如现在有10000个连接请求，那么Node.js的处理过程大概是下面这种:

```text
Request 1 ─┐
Request 2 ─┤
Request 3 ─┤
...        ├──→ Event Loop → JavaScript Thread
Request N ─┘
```

也就是Node.js告诉操作系统:这个 socket 有数据时通知我,那个 socket 可写时通知我,另一个 socket 建立连接时通知我，这就是事件驱动I/O。这里其实OS通知的也是libuv，因为Event Loop本身就是来自于libuv的。
文件I/O则主要依赖于libuv的Thread Pool，也就是线程池，worker thread会执行相关文件操作，完成后会通知事件循环。事件循环处理事件也是有优先级的，依次是timer、pending callbacks、poll以及check，其中绝大部分I/O d的callback在poll阶段执行。

## Async and Stream
Async代表着异步，在TS中使用`async`和`await`非常自然，是一种很清晰易读的同步风格的语法，比如下面这种：
```javascript
async function modernStyle() {
  const response = await apiCall(prompt);
  const result = await processResponse(response);
  console.log(result);
}
```
Stream，也就是流式输出，是Agent中广泛采用的方式，它一边可以提高用户的体验，一边也可以减少内存的占用，这两条都是比较容易理解的。而Node.js在流式输出上，就有得天独厚的优势。首先就是我们上面提到的事件循环，LLM每返回一个chunk，事件循环发现可以callback了，就让主线程去执行，这种搭配非常自然。更重要的是，Node.js有极其成熟的Stream系统，Stream是它的一等公民，是Node I/O模型的核心抽象。
Node.js的Stream有成熟的背压机制，也就是可以调节写入和输出，或者说readable和writable，readable就是从文件中读取数据，writable则是将数据写到文件中，或者一个是从客户端读取数据，另一个是向客户端写入数据。假如readable读的太快，而writable没有来得及发送，就会导致塞满硬盘，而Node.js的背压机制可以很好地预防这一点。Node.js把不同数据源统一成了相同的抽象，不管是HTTP请求、TCP socket还是LLM response，都可以用这四个统一:Readable、Writable、Duplex以及Transform。前两个我们已经说过，Duplex就是双工，收发都可以，Transform代表转换数据，比如将数据进行压缩、大小写转换等。我们可以使用`pipe()`将四种类型联通起来，`pipe()`起到的就是类似水管的作用，
比如`fs.createReadStream("input.log").fs.createWriteStream("output.txt");`一个从文件读，一个向文件写。现代Node.js还提供了`pipeline()`，一种封装，比如我们可以这样写:

```javascript
pipeline(
  readable,
  transform,
  writable
);
```

在构建Agent时，我们常常使用各家封装好的SDK，比如:

```javascript
const stream = await client.responses.create({
  model: "...",
  input: "hello",
  stream: true,
});
```

然后我们可以`for await(const data of stream)`来消费流式传过来的chunk。既然SDK已经帮我们进行了封装，那Node.js的流还有什么意义呢？当然还是有的，比如我们拿到数据后，还需要将数据发送到我们的系统中，发送到浏览器上，这其实就是我们刚刚提到的readable和writable，自然就可以利用Node.js的背压、错误处理等机制。
## Zod
ts给js加上了类型系统，但是类型系统只能检查静态类型错误，比如说定义一个接收number类型的函数，你把一个string变量传进去，这个是可以运行前就发现问题的。但是Agent系统运行时，大量的数据类型都是不可知的，LLM的输出、Tool Call的参数等，这就需要在运行时做校验。过去在Python中，Pydantic在这方面很出色，在ts中，我们使用Zod。
Zod的基本用法就是定义一个Schema＋运行时校验，下面举个具体的例子:
```javascript
import { z } from "zod";
const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
});

```
我们用`z.object`定义Schema，`z.string()`和`z.number()`说明了name和age的期望类型，这种定义相当优美，因为它让人一目了然。我们紧接着可以使用`UserSchema.parse`来校验数据，假设现在数据为data，如果满足定义的期望类型约束，那么就通过，否则抛出异常，在实际的使用中，我们常常使用`safeParse`方法，即使校验失败也不抛出异常，而是返回`success:false`，以及error信息，这十分有利于Agent的错误自检。
Zod还有一个十分强大的功能就是可以从Schema反向生成ts类型，比如:
```typescript
type User = z.infer<typeof UserSchema>;
```
此时User和下面的写法等价:
```typescript
type User = {
  name: string;
  age: number;
};
```
所以就不需要重复写:

```typescript
type User = {
  name: string;
  age: number;
};

const UserSchema = ...
```
这个功能确实非常方便。同时Zod的表达能力也是非常强的，想定义最大最小可以使用`.max()`、`.min()`，默认值可以使用`.default()`，可选可以使用`.optional()`等等。
