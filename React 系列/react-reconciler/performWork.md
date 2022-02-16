# 任务的执行函数

performSyncWorkOnRoot
performConcurrentWorkOnRoot

```js
// This is the entry point for synchronous tasks that don't go
// through Scheduler
function performSyncWorkOnRoot(root) {
  {
    syncNestedUpdateFlag()
  }

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Should not already be working.')
  }

  flushPassiveEffects()
  var lanes = getNextLanes(root, NoLanes)

  if (!includesSomeLane(lanes, SyncLane)) {
    // There's no remaining sync work left.
    ensureRootIsScheduled(root, now())
    return null
  }

  var exitStatus = renderRootSync(root, lanes)

  if (root.tag !== LegacyRoot && exitStatus === RootErrored) {
    // If something threw an error, try rendering one more time. We'll render
    // synchronously to block concurrent data mutations, and we'll includes
    // all pending updates are included. If it still fails after the second
    // attempt, we'll give up and commit the resulting tree.
    var errorRetryLanes = getLanesToRetrySynchronouslyOnError(root)

    if (errorRetryLanes !== NoLanes) {
      lanes = errorRetryLanes
      exitStatus = recoverFromConcurrentError(root, errorRetryLanes)
    }
  }

  if (exitStatus === RootFatalErrored) {
    var fatalError = workInProgressRootFatalError
    prepareFreshStack(root, NoLanes)
    markRootSuspended$1(root, lanes)
    ensureRootIsScheduled(root, now())
    throw fatalError
  } // We now have a consistent tree. Because this is a sync render, we
  // will commit it even if something suspended.

  var finishedWork = root.current.alternate
  root.finishedWork = finishedWork
  root.finishedLanes = lanes
  commitRoot(root) // Before exiting, make sure there's a callback scheduled for the next
  // pending level.

  ensureRootIsScheduled(root, now())
  return null
}
```

```js
// This is the entry point for every concurrent task, i.e. anything that
// goes through Scheduler.
function performConcurrentWorkOnRoot(root, didTimeout) {
  {
    resetNestedUpdateFlag()
  } // Since we know we're in a React event, we can clear the current
  // event time. The next update will compute a new event time.

  currentEventTime = NoTimestamp
  currentEventTransitionLane = NoLanes

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Should not already be working.')
  } // Flush any pending passive effects before deciding which lanes to work on,
  // in case they schedule additional work.

  var originalCallbackNode = root.callbackNode
  var didFlushPassiveEffects = flushPassiveEffects()

  if (didFlushPassiveEffects) {
    // Something in the passive effect phase may have canceled the current task.
    // Check if the task node for this root was changed.
    if (root.callbackNode !== originalCallbackNode) {
      // The current task was canceled. Exit. We don't need to call
      // `ensureRootIsScheduled` because the check above implies either that
      // there's a new task, or that there's no remaining work on this root.
      return null
    }
  } // Determine the next lanes to work on, using the fields stored
  // on the root.

  var lanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes,
  )

  if (lanes === NoLanes) {
    // Defensive coding. This is never expected to happen.
    return null
  } // We disable time-slicing in some cases: if the work has been CPU-bound
  // for too long ("expired" work, to prevent starvation), or we're in
  // sync-updates-by-default mode.
  // TODO: We only check `didTimeout` defensively, to account for a Scheduler
  // bug we're still investigating. Once the bug in Scheduler is fixed,
  // we can remove this, since we track expiration ourselves.

  var shouldTimeSlice =
    !includesBlockingLane(root, lanes) &&
    !includesExpiredLane(root, lanes) &&
    !didTimeout
  var exitStatus = shouldTimeSlice
    ? renderRootConcurrent(root, lanes)
    : renderRootSync(root, lanes)

  if (exitStatus !== RootIncomplete) {
    if (exitStatus === RootErrored) {
      // If something threw an error, try rendering one more time. We'll
      // render synchronously to block concurrent data mutations, and we'll
      // includes all pending updates are included. If it still fails after
      // the second attempt, we'll give up and commit the resulting tree.
      var errorRetryLanes = getLanesToRetrySynchronouslyOnError(root)

      if (errorRetryLanes !== NoLanes) {
        lanes = errorRetryLanes
        exitStatus = recoverFromConcurrentError(root, errorRetryLanes)
      }
    }

    if (exitStatus === RootFatalErrored) {
      var fatalError = workInProgressRootFatalError
      prepareFreshStack(root, NoLanes)
      markRootSuspended$1(root, lanes)
      ensureRootIsScheduled(root, now())
      throw fatalError
    } // Check if this render may have yielded to a concurrent event, and if so,
    // confirm that any newly rendered stores are consistent.
    // TODO: It's possible that even a concurrent render may never have yielded
    // to the main thread, if it was fast enough, or if it expired. We could
    // skip the consistency check in that case, too.

    var renderWasConcurrent = !includesBlockingLane(root, lanes)
    var finishedWork = root.current.alternate

    if (
      renderWasConcurrent &&
      !isRenderConsistentWithExternalStores(finishedWork)
    ) {
      // A store was mutated in an interleaved event. Render again,
      // synchronously, to block further mutations.
      exitStatus = renderRootSync(root, lanes) // We need to check again if something threw

      if (exitStatus === RootErrored) {
        var _errorRetryLanes = getLanesToRetrySynchronouslyOnError(root)

        if (_errorRetryLanes !== NoLanes) {
          lanes = _errorRetryLanes
          exitStatus = recoverFromConcurrentError(root, _errorRetryLanes) // We assume the tree is now consistent because we didn't yield to any
          // concurrent events.
        }
      }

      if (exitStatus === RootFatalErrored) {
        var _fatalError = workInProgressRootFatalError
        prepareFreshStack(root, NoLanes)
        markRootSuspended$1(root, lanes)
        ensureRootIsScheduled(root, now())
        throw _fatalError
      }
    } // We now have a consistent tree. The next step is either to commit it,
    // or, if something suspended, wait to commit it after a timeout.

    root.finishedWork = finishedWork
    root.finishedLanes = lanes
    finishConcurrentRender(root, exitStatus, lanes)
  }

  ensureRootIsScheduled(root, now())

  if (root.callbackNode === originalCallbackNode) {
    // The task node scheduled for this root is the same one that's
    // currently executed. Need to return a continuation.
    return performConcurrentWorkOnRoot.bind(null, root)
  }

  return null
}
```
