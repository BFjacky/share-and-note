### React18 任务调度

#### 0、Fiber 数据结构

```ts
const Fiber: {
  alternate: FiberNode // 正在构造的 fiber 节点
}
```

#### 1、生成 update 对象,以链表方式链接

enqueueSetState 方法会生成一个 update 对象,并获取当前 fiber 节点的更新优先级,获取优先级的方法如下

```js
function requestUpdateLane(fiber) {
  var mode = fiber.mode
  // 判断当前是否以可中断并发模式进行渲染,如果不是的话则是同步优先级
  if ((mode & ConcurrentMode) === NoMode) {
    return SyncLane
  } else if (
    (executionContext & RenderContext) !== NoContext &&
    workInProgressRootRenderLanes !== NoLanes
  ) {
    // 这个更新是在 render 阶段生成的,React 并不支持这种更新的产生,之前的做法是将当前 render 的优先级赋值给这次更新,所以如果在一个组件调用 setState 并在同一次渲染发生,它会立即执行.理想的做法,我们想要移除这种特殊的 case,并把这个更新当作是 「interleaved event」 产生的
    // Regardless, this pattern is not officially supported.
    // This behavior is only a fallback. The flag only exists until we can roll
    // out the setState warning, since existing code might accidentally rely on
    // the current behavior.
    return pickArbitraryLane(workInProgressRootRenderLanes)
  }

  var isTransition = requestCurrentTransition() !== NoTransition

  // 如果是 useTransition 中产生的更新,则会怎样? FIXME:
  if (isTransition) {
    // updates at the same priority within the same event. To do this, the
    // inputs to the algorithm must be the same.
    //
    // The trick we use is to cache the first of each of these inputs within an
    // event. Then reset the cached values once we can be sure the event is
    // over. Our heuristic for that is whenever we enter a concurrent work loop.

    if (currentEventTransitionLane === NoLane) {
      // All transitions within the same event are assigned the same lane.
      currentEventTransitionLane = claimNextTransitionLane()
    }

    return currentEventTransitionLane
  }
  // 如果当前的 update 是由绑定在 React Element 上的事件产生的,在这里能获取当前事件的优先级,以离散事件的分发为例(dispatchDiscreteEvent),见下方代码及注释
  var updateLane = getCurrentUpdatePriority()

  if (updateLane !== NoLane) {
    return updateLane
  }
  // 这个更新在 React Element 之外产生,比如在原生事件的回调中更新 state
  var eventLane = getCurrentEventPriority()
  return eventLane
}
```

```js
function dispatchDiscreteEvent(
  domEventName,
  eventSystemFlags,
  container,
  nativeEvent,
) {
  // 获取之前的事件优先级
  var previousPriority = getCurrentUpdatePriority()
  var prevTransition = ReactCurrentBatchConfig.transition
  ReactCurrentBatchConfig.transition = 0

  try {
    // 设置当前的事件优先级
    setCurrentUpdatePriority(DiscreteEventPriority)
    // 如果当前事件绑定回调的话,这里 dispatch 会执行回调
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent)
  } finally {
    // 执行完回调后恢复之前的事件优先级
    setCurrentUpdatePriority(previousPriority)
    ReactCurrentBatchConfig.transition = prevTransition
  }
}
```

#### 2、调度任务逐个完成 update 任务

调度更新任务的入口方法是 `scheduleUpdateOnFiber`

```js
function scheduleUpdateOnFiber(fiber, lane, eventTime) {
  // 检查是否有嵌套的更新(例如在render函数中调用了setState。), 如果有嵌套的更新需要抛出异常
  checkForNestedUpdates()
  // 从产生更新的节点开始，往上一直循环到root，目的是将fiber.lanes一直向上收集，收集到父级节点的childLanes中，childLanes是识别这个fiber子树是否需要更新的关键。,这里返回的是一个 FiberRootNode(FIXME:fiberNode.stateNode 的意义?)
  var root = markUpdateLaneFromFiberToRoot(fiber, lane)

  if (root === null) {
    return null
  } // Mark that the root has a pending update.
  // 在root上标记更新，也就是将update的lane放到root.pendingLanes中，每次渲染的优先级基准：renderLanes就是取自root.pendingLanes中最紧急的那一部分lanes。 给 root 正在处理任务的 lane 添加新的 lane: root.pendingLanes |= updateLane
  markRootUpdated(root, lane, eventTime)

  if (
    (executionContext & RenderContext) !== NoLanes &&
    root === workInProgressRoot
  ) {
    // This update was dispatched during the render phase. This is a mistake
    // if the update originates from user space (with the exception of local
    // hook updates, which are handled differently and don't reach this
    // function), but there are some internal React features that use this as
    // an implementation detail, like selective hydration.
    warnAboutRenderPhaseUpdatesInDEV(fiber) // Track lanes that were updated during the render phase

    workInProgressRootRenderPhaseUpdatedLanes = mergeLanes(
      workInProgressRootRenderPhaseUpdatedLanes,
      lane,
    )
  } else {
    // This is a normal update, scheduled from outside the render phase. For
    // example, during an input event.
    {
      if (isDevToolsPresent) {
        addFiberToLanesMap(root, fiber, lane)
      }
    }

    warnIfUpdatesNotWrappedWithActDEV(fiber)

    // FIXME: 如果当前 update 的节点已经是 workInProgressRoot 了会如何处理,什么时候会触发这个情况??
    if (root === workInProgressRoot) {
      // Received an update to a tree that's in the middle of rendering. Mark
      // that there was an interleaved update work on this root. Unless the
      // `deferRenderPhaseUpdateToNextBatch` flag is off and this is a render
      // phase update. In that case, we don't treat render phase updates as if
      // they were interleaved, for backwards compat reasons.
      if ((executionContext & RenderContext) === NoContext) {
        workInProgressRootInterleavedUpdatedLanes = mergeLanes(
          workInProgressRootInterleavedUpdatedLanes,
          lane,
        )
      }

      if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
        // The root already suspended with a delay, which means this render
        // definitely won't finish. Since we have a new update, let's mark it as
        // suspended now, right before marking the incoming update. This has the
        // effect of interrupting the current render and switching to the update.
        // TODO: Make sure this doesn't override pings that happen while we've
        // already started rendering.
        markRootSuspended$1(root, workInProgressRootRenderLanes)
      }
    }

    // 这里进入另一个和任务调度有关的重要方法,见下方详解
    ensureRootIsScheduled(root, eventTime)

    if (
      lane === SyncLane &&
      executionContext === NoContext &&
      (fiber.mode & ConcurrentMode) === NoMode && // Treat `act` as if it's inside `batchedUpdates`, even in legacy mode.
      !ReactCurrentActQueue$1.isBatchingLegacy
    ) {
      // Flush the synchronous work now, unless we're already working or inside
      // a batch. This is intentionally inside scheduleUpdateOnFiber instead of
      // scheduleCallbackForFiber to preserve the ability to schedule a callback
      // without immediately flushing it. We only do this for user-initiated
      // updates, to preserve historical behavior of legacy mode.
      resetRenderTimer()
      flushSyncCallbacksOnlyInLegacyMode()
    }
  }

  return root
}
```

```js
function ensureRootIsScheduled(root, currentTime) {
  // callbackNode 是一个进行任务执行的回调,如果 callbackNode 不为 null,可以理解为在之前的任务调度中已经当前的 fiberRoot 有尚未完成的任务,即任务被饿死了,FIXME:这时该如和处理该任务?
  var existingCallbackNode = root.callbackNode // Check if any lanes are being starved by other work. If so, mark them as
  // expired so we know to work on those next.

  markStarvedLanesAsExpired(root, currentTime) // Determine the next lanes to work on, and their priority.

  // 获取当前应执行任务的优先级,具体的获取方式比较复杂,FIXME:放到后面来看
  var nextLanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes,
  )

  if (nextLanes === NoLanes) {
    // Special case: There's nothing to work on.
    if (existingCallbackNode !== null) {
      cancelCallback$1(existingCallbackNode)
    }

    root.callbackNode = null
    root.callbackPriority = NoLane
    return
  } // We use the highest priority lane to represent the priority of the callback.

  var newCallbackPriority = getHighestPriorityLane(nextLanes) // Check if there's an existing task. We may be able to reuse it.

  var existingCallbackPriority = root.callbackPriority

  // 这里是一段复用逻辑,大致是当前任务的优先级已经是最高优先级,并且存在真实的任务(FIXME: 这里 act 是什么意思?),直接返回复用当前 task
  if (
    existingCallbackPriority === newCallbackPriority && // Special case related to `act`. If the currently scheduled task is a
    // Scheduler task, rather than an `act` task, cancel it and re-scheduled
    // on the `act` queue.
    !(
      ReactCurrentActQueue$1.current !== null &&
      existingCallbackNode !== fakeActCallbackNode
    )
  ) {
    {
      // If we're going to re-use an existing task, it needs to exist.
      // Assume that discrete update microtasks are non-cancellable and null.
      // TODO: Temporary until we confirm this warning is not fired.
      if (
        existingCallbackNode == null &&
        existingCallbackPriority !== SyncLane
      ) {
        error(
          'Expected scheduled callback to exist. This error is likely caused by a bug in React. Please file an issue.',
        )
      }
    } // The priority hasn't changed. We can reuse the existing task. Exit.

    return
  }

  // 新调度的任务优先级高于当前任务,则取消当前任务调度
  if (existingCallbackNode != null) {
    // Cancel the existing callback. We'll schedule a new one below.
    cancelCallback$1(existingCallbackNode)
  } // Schedule a new callback.

  var newCallbackNode

  // 这里根据不同的优先级选择不同的方法来执行任务,不同执行方法的区别后面再介绍
  if (newCallbackPriority === SyncLane) {
    // Special case: Sync React callbacks are scheduled on a special
    // internal queue
    // Legacy 模式下
    if (root.tag === LegacyRoot) {
      if (ReactCurrentActQueue$1.isBatchingLegacy !== null) {
        ReactCurrentActQueue$1.didScheduleLegacyUpdate = true
      }

      scheduleLegacySyncCallback(performSyncWorkOnRoot.bind(null, root))
    } else {
      // 这里会将任务放进同步任务队列,等待 flushSyncCallbacks 调用时执行
      scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root))
    }

    {
      // FIXME: 由于 act 的概念没明白,这里也没看懂
      // Flush the queue in a microtask.
      if (ReactCurrentActQueue$1.current !== null) {
        // Inside `act`, use our internal `act` queue so that these get flushed
        // at the end of the current scope even when using the sync version
        // of `act`.
        ReactCurrentActQueue$1.current.push(flushSyncCallbacks)
      } else {
        scheduleMicrotask(flushSyncCallbacks)
      }
    }

    newCallbackNode = null
  } else {
    var schedulerPriorityLevel

    switch (lanesToEventPriority(nextLanes)) {
      case DiscreteEventPriority:
        schedulerPriorityLevel = ImmediatePriority
        break

      case ContinuousEventPriority:
        schedulerPriorityLevel = UserBlockingPriority
        break

      case DefaultEventPriority:
        schedulerPriorityLevel = NormalPriority
        break

      case IdleEventPriority:
        schedulerPriorityLevel = IdlePriority
        break

      default:
        schedulerPriorityLevel = NormalPriority
        break
    }

    newCallbackNode = scheduleCallback$1(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root),
    )
  }

  root.callbackPriority = newCallbackPriority
  root.callbackNode = newCallbackNode
}
```
