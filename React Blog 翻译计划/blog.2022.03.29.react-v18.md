> 原文链接 https://reactjs.org/blog/2022/03/29/react-v18.html

# React v18.0

在我们的上一篇推送中,我们分享了关于[升级到 React18](https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html)的逐步骤引导,在这篇推送中,我们将会展示 React18 中的新特性和这些新特性未来的价值.

在最新的主版本中,包含了一些开箱即用的改进功能,如自动批量处理、新的 API `startTransition` 、支持 Suspensede 的服务端流式渲染.

许多 React18 的新特性建立在 concurrent 渲染模式之上,这是一种可以解锁强大新能力的幕后更新, `concurrent` 模式是可选的,只在你使用 `concurrent` 特性的时候才会开启,但是我们认为 `concurrent` 渲染模式将会在人们构建前端应用中发挥巨大的影响.

我们已经花费了数年来调研和发展 React concurrent 模式,并且,我们为已有用户格外用心地提供了一个渐进式的更新方式.上个夏天,我们成立了 [React 18 工作小组](https://reactjs.org/blog/2021/06/08/the-plan-for-react-18.html)来收集社区中前端专家们的反馈,确保在 React 生态中有一个平滑的升级体验.

如果你错过了它,我们分享了 React 2021 开发者大会中的大量愿景

- 在这篇[演讲](https://www.youtube.com/watch?v=FZ0cG47msEk&list=PLNG_1j3cPCaZZ7etkzWA7JfdmKWT0pMsa)中,我们解释了 React 18 如何满足我们的使命 - 使开发者更轻松、容易地创建极好的用户体验.
- [Shruti Kapoor 讲解了如在 React18 中使用新特性](https://twitter.com/shrutikapoor08)
- [Shaundai Person](https://twitter.com/shaundai)给我们了一个关于[服务端流式渲染](https://www.youtube.com/watch?v=pj5N-Khihgc&list=PLNG_1j3cPCaZZ7etkzWA7JfdmKWT0pMsa&index=4)的概览

下面是此版本中预期内容的完整概述,从 Concurrent 渲染模式开始.

React Native 用户注意事项: React 18 将会在新的 React Native 架构中加入,想要了解更多,查看 [React 会议演讲](https://www.youtube.com/watch?v=FZ0cG47msEk&t=1530s)

# What is Concurrent React

React 18 中新增最重要的内容是 concurrency, 我们希望你从来不去考虑它.虽然对依赖库维护人员较为复杂.,但我们认为它很大程度上能够适用于应用开发者.

本质上讲, concurrency 不是一个特性,而是一个新的幕后机制来让 React 可以同时准备多个 UI 版本,你可以把 concurrency 当成一个实现细节, 开启 concurrency 是很有价值的.在 React 内部 concurrency 的实现使用的了精细、复杂的技术,如优先级队列和多级缓冲,但是你不会在我们公共的 API 文档找到这些概念.

我们设计 API 文档时,努力去把实现细节隐藏起来,作为一个 React 开发者,只需要关注想要达到的用户体验,React 会去处理如何实现这样的用户体验,所有我们不期望 React 开发者了解内部的 concurrency 工作原理.

然而, concurrent React 要比平常的实现细节更重要,它是 React 核心渲染模型中的基础更新.所以如果了解 concurrency 的工作方式不是非常重要,可能更值得了解它是什么.

Concurrent React 中一个关键测的属性是可打断的,当你首次升级到 React 18 还没有添加任何 concurrent 特性,React 更新的渲染将会和之前版本的 React 版本一样在一个不可打断、同步的单一事务中,在同步渲染模式下,一旦更新开始被渲染了,没有什么可以在它呈现到屏幕前打断它.

在 concurrent 渲染模式中,并不总是这样的,React 可以开始渲染一个更新,并在中间暂停,稍后继续.它设置会放弃进行中的渲染.React 会保证当渲染被打断后的 UI 一致性.为了实现这个,它会等到整个构建树构建完成了再执行 DOM 变更.在这个能力加持下,React 可以在后台不阻塞主线城的情况下准备新的一屏.这意味着 UI 可以在执行大量渲染任务的中间,对用户输入立刻做出响应.创建一个流畅的用户体验.

另一个例子是状态复用, Concurrent React 可以从屏幕上移除 UI 中的一部分,然后复用之前的状态把它们加回去.当用户从当前屏切走并返回时,React 应该能够恢复之前屏幕的状态.在即将到来的小版本中,我们计划添加一个新的组件 Offscreen 来实现这个功能.同样的,你也可以使用 Offscreen 在后台准备新的 UI ,在用户展示它之前就准备好.

concurrent 渲染是一个强大的新工具,大多数的新特性被构建出来并利用了这个特性,包括 Suspencse transitions 和 streaming server render,但是 React18 只是一个在这新基础上的开端.

# Gradually Adopting Concurrent Features

从技术上来讲,concurrent 渲染是一个破坏性的变更,concurrent 渲染是可以被打断的,所以组件的表现会有一些轻微不同.

在我们的测试中,我们已经升级了数千个组件到 React 18.我们发现几乎所有已经存在的组件都能在不进行任何变更的情况下锲和 concurrent 渲染模式.然而其中有一些组件是需要额外的迁移工作的,React 18 新的渲染行为只会在你使用新功能的时候开启

整体的升级策略是让你的应用在 React18 上运行而不需要破坏任何已经存在的代码.然后你可以以你的方式逐渐的开始添加 concurrent 功能.在开发环境下,你可以使用[严格模式](https://reactjs.org/docs/strict-mode.html)来让和 concurrent 相关的 bug 显露出来.严格模式虽然不会影响到线上环境的行为,但是在开发环境会记录额外的警告日志,并双重调用那些应该是幂等的函数.严格模式不会捕捉到所有的错误,但是它能够高效的阻止大多数常见类型的错误.

在你升级到 React18 之后,你可以立刻开始使用 concurrent 特性.例如,你可以使用 startTransition 在不阻塞用户交互行为的情况下进行页面之间的导航.或者使用 useDeferredValue 来节流昂贵的重新渲染.

然而,从长远来看,我们希望你在应用中使用 concurrent 的方式是使用一个支持 concurrent 框架.在大多数情况下,你不需要直接与 concurrent API 进行交互.例如,路由依赖库可以自动的将导航包裹在 startTransition 中,来代替开发者手动在路由导航时手动调用 startTransition.

依赖库支持 concurrent 需要一些时间.为了让依赖库能够更简单的使用上 concurrent 新特性,我们提供了一些新的 API.与此同时,也请开发者多给依赖库维护者一点耐心,我们正逐渐迁移整个 React 生态系统.

想要了解更多信息,可以看我们之前的推送,[如何升级到 React18](https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html)

# Suspense in Data Frameworks

在 React18 中,你可以开始在一个武断、不灵活的框架中使用 Suspense 来获取数据,如 Relay、Next.js、Hydrogen、Remix.技术上通过 Suspense 获取数据是可行的,但是不是值得推广的策略.

将来我们会提供额外的原始方法来让通过 Suspense 获取数据这件事变得简单,不再使用那些不灵活的框架.但是, Suspense 最好能和你的应用架构深深的整合在一起,你的路由、数据层级、服务端渲染环境.所以长期来看,库和框架在 React 生态中会扮演一个至关重要的角色.

在之前版本的 React 中,你也可以在浏览器端基于 React.lazy 使用 Suspense 来做代码分割.但是我们的愿景是远比加载代码要更多的,目标是扩展对 Suspense 的支持,并使 Suspense 回退能够处理所有的异步操作.

# Server Components is Still in Development

[Server Components](https://reactjs.org/blog/2020/12/21/data-fetching-with-react-server-components.html) 是一个即将到来的功能,允许开发者跨服务端、浏览器端构建应用.这样可以将浏览器的富交互性融合进传统服务端渲染,提升它的体验.Server Components 不是本来就和 Concurrent React 配套的,但是它设计出来,能够很好的与 Concurrent 特性合作,如 Suspense 、 Streaming server Rendering.

Server Components 还处在试验阶段,预期在 18.x 的小版本中放出这个功能的初版,同时,我们与 Next.js、Hydrogen 和 Remix 等框架合作,来推进提案并为广泛采用做好准备.

# What's New in React18

## New Feature: AutoMatic Batching

批量处理是 React 将多个状态的变更合并到一次渲染中来提升体验,若没有自动批处理,React 只会将 React Event 回调中产生的更新批量处理.那些在 Promise、SetTimeout、原生事件回调或任何其他的事件回调产生的更新都不会被批量处理.在自动批处理的功能下,这些更新都会被自动的批量处理.
想要了解更多,可以看这篇推送:[React18 自动批处理减少渲染更新](https://github.com/reactwg/react-18/discussions/21

## New Feature: Transitions

Transition 是 React 中一个新的概念来区分紧急和非紧急的更新.

- 紧急更新:那些直接的交互行为,如输入、点击、触摸等等
- 非紧急更新:从一个视图向另一个视图过渡的 UI 效果.

紧急更新需要即时的响应来匹配我们进行物理操作时的直觉反应.否则他们会觉出现了错误.但是,transitions 是不一样的,其过渡的每一帧效果不被期望全面的呈现在屏幕上.

举个栗子,当你在下拉框中选择了一个过滤器,你会期望过滤器本身能够在你点击时快速响应.但是,实际的数据可以是独自过度显示的.短时间的延时是不容易察觉的,并且经常遇到的.并且,如果你在全部渲染完成成前再次更改过滤器,你只关心最后一次的结果.

通常情况下,为了最好的用户体验,一个用户的输入行为既会产生紧急更新、也会产生非紧急更新.你可以在输入事件中使用 startTransion API 来通知 React 哪些更新是紧急的、哪些是非紧急的.

当诸如点击、触摸等紧急的更新触发时,那些被包裹在 startTransition 中的非紧急更新将会被打断.如果一个非紧急更新被用户打断了(如输入了非常的字符),React 将会丢弃正在未完成且老旧的渲染工作,并只渲染最后的更新.

- useTransition: 一个 hook 来开启 transition, 包括一个返回值来追踪更新状态
- startTransition: 一个方法来开启 transition(当 hook 不可用时使用此方法)

Transition 将会被加入到 concurrent 渲染中,这将允许更新可以被打断.如果渲染内容被重新挂起,transitions 也会通知 React 继续展示当前的内容,并在后台默默渲染 transition 的内容.(查阅 [Suspense RFC](https://github.com/reactjs/rfcs/blob/main/text/0213-suspense-in-react-18.md) 获取更多信息)

[transitions 文档](https://reactjs.org/docs/react-api.html#transitions)

## New Suspense Features

在组件树的一部分还没有准备好呈现时,Suspense 可以让你声明式的指定它的加载状态

Suspense 使”UI 加载状态”成为 React 编程模型中一流的声明式概念.这可以让我们在其基础上构建更高级的功能.

几年前我们推出了一个阉割版的 Suspense.只支持了在 React.lazy 中进行代码分割的使用场景,并不支持服务端渲染时的场景.

在 React 18 中,我们为 Suspense 扩展了服务端渲染场景的支持,同时也扩展了其对 concurrent 渲染模式的支持.

Suspense 与 Transition API 相结合使用是最好的工作方式,如果你在 transition 中进行挂起,React 会阻止已经渲染好的内容被 fallback 替换.React 会延迟整个渲染直到足够的数据已经加载完了,避免一个糟糕的加载中状态进行展示.

了解更多,查阅 RFC [Suspense in React 18](https://github.com/reactjs/rfcs/blob/main/text/0213-suspense-in-react-18.md)

## New Client and Server Rendering APIs

在这次发布的版本中,我们有机会来重新设计用于浏览器端和服务端渲染的 API.这允许开发者在升级到 React 18 之后继续使用 React17 中来的渲染 API

React DOM Client:
这些新的 API 现在从 react-dom/client 中导出.

- createRoot: 渲染或写在一个根组件.用来替换 ReactDOM.render. React18 的新特性需要使用此方法.
- hydrateRoot: 一个构建服务端渲染应用的新方法,使用它来与 React DOM 服务端 API 相结合,而不是 ReactDOM.hydrate, React18 的新特性需要使用此方法.

createRoot 和 hydrateRoot 接收一个新的参数 `onRecoverableError`,当 React 在渲染或 hydration 时出错并恢复时可以通知到开发者.在默认情况下,React 会在较老的浏览器中使用 [reportError](https://developer.mozilla.org/en-US/docs/Web/API/reportError) 或 console.error

[React DOM client API 文档](https://reactjs.org/docs/react-dom-client.html)

React DOM Server:

这些新的 API 从 react-dom/server 中暴露出来,并全面支持服务端 Streaming Suspense 渲染模式.

- `renderToPipeableStream`: 用于 Node 环境的流式传输
- `renderToReadableStream`: 用于现代的非常见运行时环境,如 Deno 和 [Cloudflare workers](https://developers.cloudflare.com/workers/get-started/guide/)

[React DOM server API 文档](https://reactjs.org/docs/react-dom-server.html)

## New Strict Mode Behaviors

在将来,我们会添加一个功能,让 React 能够在保留状态的同时添加、移除部分的 UI.例如,当用户从一个其他页面切回来,React 应该能够立刻将原有的页面展现出来.为了实现这样的场景,React 将会在卸载和重载树组件时使用与之前相同的组件状态.

这个特性将会让 React 获得一个开箱即用的优秀性能表现,但是要求组件能够在多次创建、销毁时组件的副作用是可以被迅速恢复的.大多数副作用不需要任何改动就能正常工作,但一部分副作用认为组件只会创建、销毁一次.

为了能够让这些错误显露出来,React18 引入了一个仅在开发模式存在的检查行为,这个新的检查行为会自动地卸载、重载每一个组件,在第二次挂载组件时恢复之前挂载时的状态.

在 React 进行卸载和重载组件之前, React 会首次安装组件并创建其副作用.

[状态复用文档介绍](https://reactjs.org/docs/strict-mode.html#ensuring-reusable-state)

## New Hooks

### useId

`useId` 是一个新的 Hook,用来在浏览器端和服务端生成独一无二的 id,来避免服务端渲染的不匹配.它主要用在那些需要与基于 id 访问的 API 整合的组件库.这个解决了自从 React17 甚至更早就存在的一个问题,但是在 React 18 中这个问题更为重要,因为新的 Streaming 服务端渲染模式会交付乱序的 Html,[相关文档在此](https://reactjs.org/docs/hooks-reference.html#useid)

> `useId` 不是为了生成列表中的 `key` 值, key 值需要从你的数据中生成.

### useTransition

useTransition 和 startTransition 让开发者可以标记哪些更新是非紧急的,其他的更新将会被默认标记为紧急.React会让那些紧急的更新(如输入行为)打断非紧急的状态更新(如搜索结果的列表渲染),[相关文档](https://reactjs.org/docs/hooks-reference.html#usetransition)

### useDeferredValue
useDeferredValue 允许开发者推迟重新渲染一个树中非紧急的部分.这个和防抖行为很像,但是和防抖相比有一些它自己的优势.推迟渲染没有一个固定的时间,所以 React 会在首次渲染展示在页面上之后立刻尝试进行被推迟的渲染.被推迟的渲染行为是可以被打断的并且不会阻塞用户输入行为.[相关文档](https://reactjs.org/docs/hooks-reference.html#usedeferredvalue)

### useSyncExternalStore
useSybncExternalStore 允许外部的状态存储通过同步更新的方式来支持 concurrent 渲染模式,这个 hook 取缔了从外部订阅数据状态时对 `useEffect` 的需求,推荐任何结合React外部状态的库使用这个 Hook

> useSyncExternalStore 应该用在库里,而不是用在业务代码中.


### useInsertionEffect
useInsertionEffect 是一个新的 hook 用来解决 CSS-in-JS 库在渲染时注入样式的性能问题.煮沸你已经创建了一个 CSS-in-JS 的依赖库,否则我们不希望你用这种方式.这个 hook 会在 DOM 变更后、 layout 副作用读取新的 layout 之前运行.这个解决了 React 17 甚至更之前都存在的一个问题,但是在 React 18 上变得更加重要,因为 React 18 会在 concurrent 渲染时让出控制权给浏览器,浏览器就会有机会来重新计算布局.[相关文档](https://reactjs.org/docs/hooks-reference.html#useinsertioneffect)

> useInsertionEffect 应该用来依赖库而不是业务代码中


# How to Upgrade

查看[如何升级到 React18](https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html) 来获取逐步的介绍和破坏性变更和值得注意的点
