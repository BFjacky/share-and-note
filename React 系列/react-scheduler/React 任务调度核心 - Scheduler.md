## React 调度器 Scheduler

Scheduler 是 React 内部一个关于任务优先级调度的包,**你只需要将任务以及任务的优先级交给它, 它就可以帮你进行任务的协调调度**, 目前 Scheduler 只被用于 React, 但 React 团队计划将它变成一个更加通用的包.

### Scheduler 概念
我们知道 JavaScript 是单线程的, 如果一个同步任务占用时间很长, 就会导致掉帧和卡顿. 因此需要把一个耗时的任务及时中断掉, 去执行更重要的任务(比如用户交互、UI渲染), 后续再执行该耗时任务.
Scheduler 实现了对任务的调度处理,并能够及时中断长时间占用主线程的任务,主要是通过以下两个方式来实现:
1. 宏观上管控每个任务的优先级,按照优先级对任务进行调用,并在超时占用主线程时终止任务.
2. 微观上将每个任务拆分成任务链的形式,需要调用方将一个耗时的长任务拆分成可分开逐步执行的任务链,在任务链中的每个子任务执行完后都是可被打断的.

### Scheduler 源码解析

#### Scheduler 结构
入口文件为 Scheduler.js,目前仅仅依赖了四个其他文件,分别为 
* SchedulerMinHeap.js 是一个小顶堆的算法实现,用于任务的排序,常常被用来解 topK 问题.
* SchedulerFeatureFlags.js 一些数值常量
* SchedulerPriorities.js 各优先级枚举
* SchedulerProfiling.js 一个关于日志的模块

#### SchedulerMinHeap 
实现了小顶堆的数据结构,小顶堆相比排好序的数组更适合作为任务队列的结构,在 Scheduler 中的 timerQueue 和 taskQueue 均为需要频繁插入新元素的容器结构,排好序的数组插入新值并排序需要 O(n) 时间复杂度,小顶堆插入新值并保持小顶堆性质需要 O(logn) 时间复杂度,小顶堆在频繁插入元素时的效率更高一些.

#### timerQueue & taskQueue
在 scheduler 中维护了两个队列,timerQueue 为未来可执行的任务,taskQueue 为当前可执行的任务.
同时有一个方法 **advanceTimers()** 用于将 timerQueue 中可立即执行的任务从 timerQueue 移到 taskQueue.

#### startTime & expirationTime
在 timerQueue 中,任务按照 startTime 进行排序,startTime 越小代表任务被转移到 taskQueue 越迫切
在 taskQueue 中,任务按照 expirationTime 进行排序,expirationTime 越小代表任务的执行越迫切

#### unstable_scheduleCallback 入口函数,生成任务调度
unstable_scheduleCallback 接收三个参数 
* priorityLevel 任务优先级
* callback 任务执行回调
* options:{delay:Number} 任务延迟
unstable_scheduleCallback 会根据传入的优先级来设置任务的过期时间,根据 options.delay 来设置任务的最早开始时间,并根据任务的最早开始时间来将任务分别放入 timerQueue 和 taskQueue

#### shouldYieldToHost 
判断当前是否应该让出主线程,这里利用了一个新的浏览器 API **navigator.scheduling.isInputPending**,这个API是为了权衡用户输入响应以及页面加载、脚本执行效率而制定的。当浏览器有需要处理的输入事件时，调用isInputPending()会返回true，在不传入任何参数的情况下，将会检测所有类型的输入事件，包括按键、鼠标、滚轮触控等DOM UI事件，也可以手动传入一个包含事件类型的数组参数。
shouldYieldToHost 会根据当前宏任务的运行时间和 isInputPending() 共同判断是否需要让出主线程.

#### requestHostTimeout & cancelHostTimeout
requestHostTimeout 和 cancelHostTimeout 为一对函数,对于在 timerQueue 中尚不可以执行的任务通过 setTimeout 将任务延后执行.cancelHostTimeout 为取消延后执行任务的方法.
 
#### requestHostCallback & schedulePerformWorkUntilDeadline
requestHostCallback 为调起执行 taskQueue 中的任务的方法.其会调用 schedulePerformWorkUntilDeadline 来开启一个宏任务,在 scheduler 中会优先使用 MessageChannel 来产生新的宏任务,这里没有优先使用 setTimeout 的原因是即使给 setTimeout 设置延迟为 0 ms,在递归调用时仍然会有 4~5ms 的延迟.

#### performWorkUntilDeadline & flushWork & workLoop
performWorkUntilDeadline & flushWork & workLoop 三个方法为任务调度的核心部分,通过这个三个方法的执行,将 taskQueue 中的可执行任务逐渐消费、执行.
* performWorkUntilDeadline 记录本次宏任务开始的时间,调用 flushWork 来执行任务,根据是否已清空 taskQueue 来控制是否开启下一波宏任务来执行任务
* flushWork 调用 cancelHostTimeout 来取消调用延时的任务,调用 workLoop 来循环执行可执行任务
* workLoop 的执行分为几个重要步骤:
    1. 调用 advanceTimers 将 timerQueue 中可执行任务的转移到 taskQueue.
    2. 循环获取 taskQueue 中过期时间最早的任务,若该任务未过期且 **shouldYieldToHost** 需要让出主线程则会终止任务执行(React可中断任务)
    3. 执行当前任务回调,并获取任务回调的返回值**continuationCallback**,若存在**continuationCallback**则继续调度执行该回调,若该任务未返回后续任务,则将该任务从 taskQueue 中移除(子任务链的实现).
    4. 跳出循环后判断 taskQueue 任务队列是否清空,若清空则调用 requestHostTimeout 延时执行尚不可执行的任务.

#### demo
在这个文件中模拟了使用 Scheduler 进行任务调度,当插入其他更重要的任务后,Scheduler 仍然能让出一部分时间给主线程执行其他任务.
[Scheduler 调度 demo.md](./index.html) 