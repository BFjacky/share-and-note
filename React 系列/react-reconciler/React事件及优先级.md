# React 事件、更新、任务优先级

React 的优先级在三个维度上进行传递,优先级起源于事件,事件的优先级会传递到更新的优先级,更新的优先级最终会影响任务执行的优先级.

### 事件优先级是优先级的起点

UI 交互产生数据状态的变化,而事件又是产生 UI 交互的源头,在 React 中事件优先级是其他优先级的起点,并且将所有的事件划分了等级,React 按照事件的紧急程度,将其划分了三个等级:

1. DiscreteEventPriority(SyncLane)
2. ContinuousEventPriority(InputContinuousLane)
3. DefaultEventPriority(DefaultLane)

获取事件优先级的方法如下(FIXME: 其中的 message 事件?)

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

在定义了事件优先级之后需要对这些不同优先级的事件进行派发,来触发绑定在这些事件上的回调函数,对于不同优先级的事件,React 绑定了不同的事件处理函数来区分

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

以离散事件为例,通过 `setCurrentUpdatePriority` 设置当前的全局事件优先级,然后派发事件(执行对应的回调),执行完成事件后再恢复之前的事件记录.通过这种方式就可以在创建更新时得到当前的事件优先级.

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

我们省略 `dispatchEvent` 到执行事件回调中间的过程处理(TODO:这里涉及到 React 对事件的复杂处理,后面再看)
在执行`setState`之后会获取本次更新所需要的优先级

```js
var lane = requestUpdateLane(fiber)
```

在 `requestUpdateLane` 中会通过 `getCurrentUpdatePriority` 获取事件设置的 `currentUpdatePriority` 优先级,通过以上的内容就能够理解在 React 中是如何通过`事件优先级`来影响`更新优先级`的

### 将更新优先级绑定到 Fiber 节点

在一个 `setState` 执行后,产生的更新会挂到相应的 `fiberNode.updateQueue` 属性下,并且 React 会通过 `markUpdateLaneFromFiberToRoot` 方法将本次更新所处的 `lane优先级` 挂载到当前 fiberNode 节点及其祖先节点.也就是说当产生了一更新,并且确定其优先级后,React 首先做的就是将优先级挂载到其影响的 Fiber 节点.

### 根据节点优先级调度任务

截取 ensureRootIsScheduled 中的部分代码,来展示通过更新优先级调度任务的过程

```js
function ensureRootIsScheduled(root, currentTime) {
  // *** 省略部分代码 ***
  // 获取当前需要执行的若干优先级
  var nextLanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes,
  )
  // 如果当前没有需要执行的优先级,清空回调
  if (nextLanes === NoLanes) {
    if (existingCallbackNode !== null) {
      cancelCallback$1(existingCallbackNode)
    }
    root.callbackNode = null
    root.callbackPriority = NoLane
    return
  }
  // 获取当前执行的若干优先级中最高的一个
  var newCallbackPriority = getHighestPriorityLane(nextLanes) // Check if there's an existing task. We may be able to reuse it.

  // 标记当前任务的优先级为最高优先级
  var existingCallbackPriority = root.callbackPriority

  // *** 省略部分代码 ***
}
```

当确定了本次调度的优先级后,要开始真正进行任务调度的执行了

```js
function ensureRootIsScheduled(root, currentTime) {
  // *** 省略部分代码 ***
  // 判断当前执行的优先级是否是同步优先级
  if (newCallbackPriority === SyncLane) {
    // 区分 React render 模式
    if (root.tag === LegacyRoot) {
      // FIXME: 这部分变量标记作用是什么? didScheduleLegacyUpdate, 以及 scheduleLegacySyncCallback 与 scheduleSyncCallback 的区别
      if (ReactCurrentActQueue$1.isBatchingLegacy !== null) {
        ReactCurrentActQueue$1.didScheduleLegacyUpdate = true
      }

      scheduleLegacySyncCallback(performSyncWorkOnRoot.bind(null, root))
    } else {
      scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root))
    }

    // 上面的调度会将任务加入到同步队列,下面会在当前的宏任务中添加微任务来执行任务,(也就是说同步任务是在同一个宏任务队列中完成的)
    {
      //FIXME: what is act?
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
    // 非同步优先级的任务由`DiscreteEventPriority`以外的事件来触发
    var schedulerPriorityLevel

    // 将React的任务优先级转换为 Scheduler 中的任务优先级,进行相应的任务调度
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
  // *** 省略部分代码 ***
}
```

### 总结

在 React 中,我们可以认为出现了三种优先级设定,1.事件优先级,2.更新优先级(节点、任务优先级),3.调度优先级

- 在事件优先级中,将离散事件和连续事件区分开来,并给予离散事件更高的优先级,来保证用户 UI 的响应,事件优先级是其他优先级的起点.

- 更新优先级来源于事件优先级.如果在事件回调中产生了更新,更新的优先级便是该事件的优先级.同时,当产生了一个更新后,React 还会修改其绑定的 fiber 节点所对应的优先级 lanes,使得 React 可以获取当前 fiber 树中,优先级最高的一批更新是什么,并开始通过 Scheduler 进行任务调度.

- 当任务被送进 Scheduler 中进行调度时,如果此时没有更高的更新打断当前调度,那么被送进 Scheduler 中的任务,将会遵照 Scheduler 的调度方式逐个执行.关于 Scheduler 的调度可以看这篇源码解析:[React 任务调度核心Scheduler](../react-scheduler/React%20任务调度核心%20-%20Scheduler.md) 