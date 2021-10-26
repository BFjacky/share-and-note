React 渲染主要分为三个阶段,第一个阶段是优先级调度,第二个阶段是构建 fiber 树,第三个阶段是进行 commit(更新 Dom)

在我们调用`setState`后,`enqueueSetState`会被调用,其主要代码如下

```js
function enqueueSetState(inst, payload, callback) {
  var fiber = get(inst) // 获取当前组件的 fiber 节点
  var eventTime = requestEventTime()
  var lane = requestUpdateLane(fiber)
  var update = createUpdate(eventTime, lane) // 生成一个 update 对象
  update.payload = payload

  if (callback !== undefined && callback !== null) {
    {
      warnOnInvalidCallback(callback, 'setState')
    }

    update.callback = callback
  }

  enqueueUpdate(fiber, update) // 将本次的 update 更新到 fiber 上的 updateQueue
  scheduleUpdateOnFiber(fiber, lane, eventTime) //
}
```

通过 enqueueSetState 的执行,会将需要的更新都绑定在对应的 fiber 节点上,之后会对这个 fiber 节点进行任务调度

```js
function scheduleUpdateOnFiber(fiber, lane, eventTime) {
  var root = markUpdateLaneFromFiberToRoot(fiber, lane) // 获取当前的 FiberRootNode
  if (root === workInProgressRoot) {
    // 如果已经处于 render 阶段,需要考虑是否要中断当前的渲染
    {
      workInProgressRootUpdatedLanes = mergeLanes(
        workInProgressRootUpdatedLanes,
        lane,
      )
    }
    if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
      markRootSuspended$1(root, workInProgressRootRenderLanes)
    }
  } // TODO: requestUpdateLanePriority also reads the priority. Pass the
  // priority as an argument to that function and this one.
  var priorityLevel = getCurrentPriorityLevel()
  if (lane === SyncLane) {
    if (
      // Check if we're inside unbatchedUpdates
      (executionContext & LegacyUnbatchedContext) !== NoContext && // Check if we're not already rendering
      (executionContext & (RenderContext | CommitContext)) === NoContext
    ) {
      schedulePendingInteractions(root, lane) // This is a legacy edge case. The initial mount of a ReactDOM.render-ed
      performSyncWorkOnRoot(root)
    } else {
      ensureRootIsScheduled(root, eventTime)
      schedulePendingInteractions(root, lane)

      if (executionContext === NoContext) {
        resetRenderTimer()
        flushSyncCallbackQueue()
      }
    }
  }
}
```
对于同步的任务,会将该任务放到一个同步队列中,并且通过 scheduler 调度尽快执行.
```js
function scheduleSyncCallback(callback) {
  if (syncQueue === null) {
    syncQueue = [callback];
    // 这里会调用 scheduler 进行任务调度, flushSyncCallbackQueueImpl 是将 syncQueue 中的任务逐一去执行
    immediateQueueCallbackNode = Scheduler_scheduleCallback(Scheduler_ImmediatePriority, flushSyncCallbackQueueImpl);
  } else {
    syncQueue.push(callback);
  }
}
```

