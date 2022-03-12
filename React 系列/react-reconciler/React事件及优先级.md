# React 事件、更新、任务优先级

浏览器可产生事件有两种,一种是浏览器规定的事件,通过用户的操作来触发,例如点击事件(click);另一种事件为自定义事件,这部分事件由开发者创建并派送.各种各样的事件回调、React 中生命周期的执行和定时器回调产生了 Dom 和数据状态的更新(页面不会平白无故发生更新),已知更新产生的来源,通过对事件来源进行分类,就可以来区分更新的优先级.

React 的优先级主要在三个维度上进行传递,优先级起源于事件,事件的优先级会传递到由该事件产生的更新上,更新的优先级最终会影响任务执行的优先级.

### 事件优先级是优先级的起点

React 将事件分为三个等级:

1. DiscreteEventPriority(SyncLane) - 由离散事件产生,优先级别最高
2. ContinuousEventPriority(InputContinuousLane) - 由连续事件产生
3. DefaultEventPriority(DefaultLane) - 由自定义事件产生

除了由事件产生的更新,在 React 中常见的更新来源还有:

1. 由生命周期的执行产生的更新
2. 由定时器回调产生的更新
   这两种更新所依赖的更新优先级从全局变量`currrentUpdatePriority`中获取, `currentUpdatePriority` 会在一个更新被执行时赋值,也就是`render` 阶段的时候会更新 `currentUpdatePriority`.

获取事件优先级的源码如下:

```js
function getEventPriority(domEventName) {
  switch (domEventName) {
    // Used by SimpleEventPlugin:
    case 'cancel':
    case 'click':
    case 'close':
    case 'contextmenu':
    case 'copy':
    case 'cut':
    case 'auxclick':
    case 'dblclick':
    case 'dragend':
    case 'dragstart':
    case 'drop':
    case 'focusin':
    case 'focusout':
    case 'input':
    case 'invalid':
    case 'keydown':
    case 'keypress':
    case 'keyup':
    case 'mousedown':
    case 'mouseup':
    case 'paste':
    case 'pause':
    case 'play':
    case 'pointercancel':
    case 'pointerdown':
    case 'pointerup':
    case 'ratechange':
    case 'reset':
    case 'resize':
    case 'seeked':
    case 'submit':
    case 'touchcancel':
    case 'touchend':
    case 'touchstart':
    case 'volumechange': // Used by polyfills:
    // eslint-disable-next-line no-fallthrough

    case 'change':
    case 'selectionchange':
    case 'textInput':
    case 'compositionstart':
    case 'compositionend':
    case 'compositionupdate': // Only enableCreateEventHandleAPI:
    // eslint-disable-next-line no-fallthrough

    case 'beforeblur':
    case 'afterblur': // Not used by React but could be by user code:
    // eslint-disable-next-line no-fallthrough

    case 'beforeinput':
    case 'blur':
    case 'fullscreenchange':
    case 'focus':
    case 'hashchange':
    case 'popstate':
    case 'select':
    case 'selectstart':
      return DiscreteEventPriority

    case 'drag':
    case 'dragenter':
    case 'dragexit':
    case 'dragleave':
    case 'dragover':
    case 'mousemove':
    case 'mouseout':
    case 'mouseover':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'scroll':
    case 'toggle':
    case 'touchmove':
    case 'wheel': // Not used by React but could be by user code:
    // eslint-disable-next-line no-fallthrough

    case 'mouseenter':
    case 'mouseleave':
    case 'pointerenter':
    case 'pointerleave':
      return ContinuousEventPriority

    case 'message': {
      // We might be in the Scheduler callback.
      // Eventually this mechanism will be replaced by a check
      // of the current priority on the native scheduler.
      var schedulerPriority = getCurrentPriorityLevel()

      switch (schedulerPriority) {
        case ImmediatePriority:
          return DiscreteEventPriority

        case UserBlockingPriority:
          return ContinuousEventPriority

        case NormalPriority:
        case LowPriority:
          // TODO: Handle LowSchedulerPriority, somehow. Maybe the same lane as hydration.
          return DefaultEventPriority

        case IdlePriority:
          return IdleEventPriority

        default:
          return DefaultEventPriority
      }
    }

    default:
      return DefaultEventPriority
  }
}
```

### 绑定、派发事件

React 采用合成事件的方式来处理事件回调,我们绑定在`ReactElement`上的事件回调会在原生事件触发后,被 React 主动触发,其目的之一也是能够根据不同事件类型来分别触发.对于不同优先级的事件,React 绑定了不同的事件处理函数来区分.下面是关于不同优先级事件派发方式的源码:其目的是为不同优先级的事件创建不同的派发事件函数,派发事件的函数会在派发事件(调用回调)前设置当前正在派发的事件优先级,以便由事件产生的更新能够获取其优先级.

```js
function createEventListenerWrapperWithPriority(
  targetContainer,
  domEventName,
  eventSystemFlags,
) {
  var eventPriority = getEventPriority(domEventName)
  var listenerWrapper

  switch (eventPriority) {
    case DiscreteEventPriority:
      listenerWrapper = dispatchDiscreteEvent
      break

    case ContinuousEventPriority:
      listenerWrapper = dispatchContinuousEvent
      break

    case DefaultEventPriority:
    default:
      listenerWrapper = dispatchEvent
      break
  }

  return listenerWrapper.bind(
    null,
    domEventName,
    eventSystemFlags,
    targetContainer,
  )
}
```

```js
function dispatchDiscreteEvent(
  domEventName,
  eventSystemFlags,
  container,
  nativeEvent,
) {
  var previousPriority = getCurrentUpdatePriority()
  var prevTransition = ReactCurrentBatchConfig.transition
  ReactCurrentBatchConfig.transition = 0

  try {
    setCurrentUpdatePriority(DiscreteEventPriority)
    dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent)
  } finally {
    setCurrentUpdatePriority(previousPriority)
    ReactCurrentBatchConfig.transition = prevTransition
  }
}
```

### Fiber 节点优先级

通过上面的解析,应该可以比较清晰的理解`事件优先级`和`更新优先级`,以及`事件优先级`是如何影响`更新优先级`的,接下来还需要将优先级更新到 fiber 节点上
`markUpdateLaneFromFiberToRoot` 方法会将更新的优先级记录在产生的更新的`Fiber`节点及其祖先节点,在`Fiber`节点上有若干和优先级相关的字段:

1. pingedLanes
2. suspendedLanes 被中断的任务优先级
3. lanes
4. childLanes
5. pendingLanes fiber节点当前需要处理的任务优先级
6. finishedLanes
7. expiredLanes
8. entangledLanes

### 任务调度

优先级传递到`Fiber`节点后,最终会影响 React 若干更新任务的执行顺序.

其任务调度大致遵寻先 StarvedLanes 后 higherPriorityLanes,当开启一波任务调度时,首先要找出当前已超时的低优先级任务,将其挂载在`expiredLanes`属性上,并最先执行这些任务(FIXME: 存疑是否是最先执行 🤨,TODO: getNextLanes 确定接下来要执行的优先级),getNextLanes 的代码及逻辑如下:
这部分代码的逻辑比较绕,这个函数的功能是为当前应处理的任务优先级拍个序,根据代码逻辑整理优先级排序为(优先级由高到低):
1. pendingLanes & NonIdleLanes & ~suspendedLanes
2. pendingLanes & NonIdleLanes & pingedLanes
3. pendingLanes & IdleLanes & ~suspendedLanes
4. pingedLanes
出现在渲染被中断后的任务优先级:
5. 


```js
function getNextLanes(root, wipLanes) {
  var pendingLanes = root.pendingLanes
  // 首先判断当前 RootFiber 上是否有当前需要处理的更新
  if (pendingLanes === NoLanes) {
    return NoLanes
  }

  var nextLanes = NoLanes
  var suspendedLanes = root.suspendedLanes
  var pingedLanes = root.pingedLanes // Do not work on any idle work until all the non-idle work has finished,
  // even if the work is suspended.

  var nonIdlePendingLanes = pendingLanes & NonIdleLanes

  if (nonIdlePendingLanes !== NoLanes) {
    // 如果正在处理的任务优先级中包含非空闲任务优先级

    // 获取非空闲正在处理的任务中未被挂起的任务
    var nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes

    if (nonIdleUnblockedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes)
    } else {
      // 获取非空闲正在处理的任务中 比恩该饿 pinged 的任务
      var nonIdlePingedLanes = nonIdlePendingLanes & pingedLanes

      if (nonIdlePingedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLanes(nonIdlePingedLanes)
      }
    }
  } else {
    // 正在处理的任务只剩下空闲任务.
    var unblockedLanes = pendingLanes & ~suspendedLanes

    if (unblockedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLanes(unblockedLanes)
    } else {
      if (pingedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLanes(pingedLanes)
      }
    }
  }

  if (nextLanes === NoLanes) {
    // This should only be reachable if we're suspended
    // TODO: Consider warning in this path if a fallback timer is not scheduled.
    return NoLanes
  } // If we're already in the middle of a render, switching lanes will interrupt
  // it and we'll lose our progress. We should only do this if the new lanes are
  // higher priority.

  if (
    wipLanes !== NoLanes &&
    wipLanes !== nextLanes && // If we already suspended with a delay, then interrupting is fine. Don't
    // bother waiting until the root is complete.
    (wipLanes & suspendedLanes) === NoLanes
  ) {
    var nextLane = getHighestPriorityLane(nextLanes)
    var wipLane = getHighestPriorityLane(wipLanes)

    if (
      // Tests whether the next lane is equal or lower priority than the wip
      // one. This works because the bits decrease in priority as you go left.
      nextLane >= wipLane || // Default priority updates should not interrupt transition updates. The
      // only difference between default updates and transition updates is that
      // default updates do not support refresh transitions.
      (nextLane === DefaultLane && (wipLane & TransitionLanes) !== NoLanes)
    ) {
      // Keep working on the existing in-progress tree. Do not interrupt.
      return wipLanes
    }
  }

  if ((nextLanes & InputContinuousLane) !== NoLanes) {
    // When updates are sync by default, we entangle continuous priority updates
    // and default updates, so they render in the same batch. The only reason
    // they use separate lanes is because continuous updates should interrupt
    // transitions, but default updates should not.
    nextLanes |= pendingLanes & DefaultLane
  } // Check for entangled lanes and add them to the batch.
  //
  // A lane is said to be entangled with another when it's not allowed to render
  // in a batch that does not also include the other lane. Typically we do this
  // when multiple updates have the same source, and we only want to respond to
  // the most recent event from that source.
  //
  // Note that we apply entanglements *after* checking for partial work above.
  // This means that if a lane is entangled during an interleaved event while
  // it's already rendering, we won't interrupt it. This is intentional, since
  // entanglement is usually "best effort": we'll try our best to render the
  // lanes in the same batch, but it's not worth throwing out partially
  // completed work in order to do it.
  // TODO: Reconsider this. The counter-argument is that the partial work
  // represents an intermediate state, which we don't want to show to the user.
  // And by spending extra time finishing it, we're increasing the amount of
  // time it takes to show the final state, which is what they are actually
  // waiting for.
  //
  // For those exceptions where entanglement is semantically important, like
  // useMutableSource, we should ensure that there is no partial work at the
  // time we apply the entanglement.

  var entangledLanes = root.entangledLanes

  if (entangledLanes !== NoLanes) {
    var entanglements = root.entanglements
    var lanes = nextLanes & entangledLanes

    while (lanes > 0) {
      var index = pickArbitraryLaneIndex(lanes)
      var lane = 1 << index
      nextLanes |= entanglements[index]
      lanes &= ~lane
    }
  }

  return nextLanes
}
```

### 根据节点优先级调度任务
完成获取当前需要处理的任务优先级,需要开始进行任务调度,对于同步任务,会在当前宏任务中创建一个微任务用于执行`performSyncWorkOnRoot`.对于非同步任务,则会根据获取的任务优先级利用 `Scheduler` 进行任务调度 `scheduleCallback$1(schedulerPriorityLevel, performConcurrentWorkOnRoot.bind(null, root));`

`performSyncWorkOnRoot`和`performConcurrentWorkOnRoot`两个方法会在另一篇文章中单独讲解.


### 总结

在 React 中,我们可以认为出现了三种优先级设定,1.事件优先级,2.更新优先级(节点、任务优先级),3.调度优先级

- 在事件优先级中,将离散事件和连续事件区分开来,并给予离散事件更高的优先级,来保证用户 UI 的响应,事件优先级是其他优先级的起点.

- 更新优先级来源于事件优先级.如果在事件回调中产生了更新,更新的优先级便是该事件的优先级.同时,当产生了一个更新后,React 还会修改其绑定的 fiber 节点所对应的优先级 lanes,使得 React 可以获取当前 fiber 树中,优先级最高的一批更新是什么,并开始通过 Scheduler 进行任务调度.

- 当任务被送进 Scheduler 中进行调度时,如果此时没有更高的更新打断当前调度,那么被送进 Scheduler 中的任务,将会遵照 Scheduler 的调度方式逐个执行.关于 Scheduler 的调度可以看这篇源码解析:[React 任务调度核心 Scheduler](../react-scheduler/React%20任务调度核心%20-%20Scheduler.md)
