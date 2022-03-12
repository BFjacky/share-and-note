# React 任务执行

在 React 中存在两棵 Fiber 树结构,一棵为`current`树,是当前已经完成渲染的树,代表着当前应用的状态.另一棵为`workInProgress`树,代表未来会应用到屏幕上的状态。
所有的更新都会在 workInProgress 树上进行,一旦所有的更新任务都完成了且 workInProgress 树被渲染到屏幕上，workInProgress 树就是 current 树了,这也就是 React 进行渲染的双缓冲技术.

React 的任务执行区分为同步任务执行和非同步任务执行,用到了这两个方法:

1. performSyncWorkOnRoot(执行同步任务)
2. performConcurrentWorkOnRoot(执行可被打断)

### 同步更新任务执行

在执行同步的更新任务时,会在`workLoopSync`方法中逐单元的去完成,从`FiberRootNode`开始,进行深度优先遍历,逐节点完成更新,
_截取 performUnitOfWork 部分代码_:

```js
// 完成当前节点的渲染后返回当前节点的字节点,继续进行渲染
next = beginWork$1(current, unitOfWork, subtreeRenderLanes)
// 将 fiber 节点的 props 改为更新后 props
unitOfWork.memoizedProps = unitOfWork.pendingProps
if (next === null) {
  // 若当前没有子节点了,则尝试回溯寻找未完成更新的兄弟节点
  completeUnitOfWork(unitOfWork)
} else {
  // 若仍有子节点,则继续进行节点更新
  workInProgress = next
}
```

### 异步更新任务执行

同步的渲染模式中,我们很好理解其渲染流程,由事件产生更新,在下一轮微任务中将更新应用到新的 Fiber 树上,最后将 Fiber 树上记录的节点信息渲染到 Dom 上就可以了.
对于可打断的渲染模式,我们比较容易就能想到这样的几个疑问 🤔️

1. 可打断的时机、纬度,当一个可以被打断的更新产生后,如果 React 需要对其进行打断,React 是在什么时机对其进行打断
2. 打断渲染后的恢复,当一个更新产生的状态、UI 变更被打断后,是如何在后续被恢复的.

带着这些疑问,来探索 ConCurrent 模式中的奥秘:

> 在 `React@18.0.0-beta-24dd07bd2-20211208` 版本中,由于 Scheduler 中存在的问题, React 没有对 InputContinuousLane 以及 DefaultLane 开放异步可打断的渲染模式,但是在 Suspense 组件以及 Transition 功能中使用了可打断的渲染模式.

_模拟的场景: 通过使用点击事件触发 Suspense 内的状态更新来触发 ConCurrent 更新_
React 检测到更新作用在一个 `SuspenseConponent` 组件时,会去检查其抛出的 promise,并在 promise 状态发生变更后重新更新未完成的组件状态,代码位于(`retryTimedOutBoundary->ensureRootIsScheduled`),由于更新在`Suspense`组件中,之前的同步更新产生了一个 `RetryLane` 级别的更新,此时在进行任务执行时会通过 `performConcurrentWorkOnRoot` 方法,而不是 `performSyncWorkOnRoot`

在 `performConcurrentWorkOnRoot` 中会去判断当前的任务是否可以通过可打断的方式渲染,如果可以会调用 `renderRootConcurrent` 方法进行渲染,否则调用`renderRootSync`;其判断方式则是依据当前更新的优先级和是否过期来判断的.

```js
var shouldTimeSlice =
  !includesBlockingLane(root, lanes) &&
  !includesExpiredLane(root, lanes) &&
  !didTimeout
var exitStatus = shouldTimeSlice
  ? renderRootConcurrent(root, lanes)
  : renderRootSync(root, lanes)
```

通过对两个方法的对比,我们可以看到,最终的实现差别在 `workLoopConcurrent` 和 `workLoopSync` 中比较明显:

```js
// workLoopConcurrent
while (workInProgress !== null && !shouldYield()) {
  performUnitOfWork(workInProgress)
}
// workLoopSync
while (workInProgress !== null) {
  performUnitOfWork(workInProgress)
}
```

由此可见,可中断渲染的中断时机就是此时,在`shouldYield`方法中会判断任务执行的时间是否超过了 5ms, 如果超过了 5ms 则会中断当前的任务(FIXME:在代码中没有找到官方所说的高优先级任务对低优先级任务的打断,后面有时间再找一找),至此,我们已经得到的上面**第 1 个问题**的答案.

如果更新耗时过久,导致任务没有执行完成,会进行一次新的任务调度,这样也就将主线程空了出来,并且在下一个宏任务中继续进行未完的更新

```js
var exitStatus = shouldTimeSlice
  ? renderRootConcurrent(root, lanes)
  : renderRootSync(root, lanes)

if (exitStatus !== RootInProgress) {
  // 如果任务已经结束...省略其中逻辑
}
// 如果任务仍未结束,则重新发起任务调度
ensureRootIsScheduled(root, now())
if (root.callbackNode === originalCallbackNode) {
  return performConcurrentWorkOnRoot.bind(null, root)
}
```

在后续的调度中也许由于任务超时的原因,也就不会再进行可打断的渲染了,会直接进行同步渲染.至此第二个问题也已经清晰了.

在阅读源码的同时也想到了两个新问题:
1. 如果一个可打断的更新没有被打断过,和同步渲染有没有区别?区别是什么?
2. React 是否支持高优先级更新对低优先级更新的打断 


各渲染模式类型枚举

```js
export const NoMode = /*                         */ 0b000000
// TODO: Remove ConcurrentMode by reading from the root tag instead
export const ConcurrentMode = /*                 */ 0b000001
export const ProfileMode = /*                    */ 0b000010
export const DebugTracingMode = /*               */ 0b000100
export const StrictLegacyMode = /*               */ 0b001000
export const StrictEffectsMode = /*              */ 0b010000
export const ConcurrentUpdatesByDefaultMode = /* */ 0b100000
```

各组件类型枚举

```js
var FunctionComponent = 0
var ClassComponent = 1
var IndeterminateComponent = 2 // Before we know whether it is function or class
var HostRoot = 3 // Root of a host tree. Could be nested inside another node.
var HostPortal = 4 // A subtree. Could be an entry point to a different renderer.
var HostComponent = 5
var HostText = 6
var Fragment = 7
var Mode = 8
var ContextConsumer = 9
var ContextProvider = 10
var ForwardRef = 11
var Profiler = 12
var SuspenseComponent = 13
var MemoComponent = 14
var SimpleMemoComponent = 15
var LazyComponent = 16
var IncompleteClassComponent = 17
var DehydratedFragment = 18
var SuspenseListComponent = 19
var ScopeComponent = 21
var OffscreenComponent = 22
var LegacyHiddenComponent = 23
var CacheComponent = 24
```
