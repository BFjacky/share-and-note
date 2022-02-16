# 任务优先级获取获

在 FiberRootNode 上和优先级有关的字段
* entangledLanes
* expiredLanes 
* finishedLanes
* mutableReadLanes
* pendingLanes
* pingedLanes
* suspendedLanes


```js
function getNextLanes(root, wipLanes) {
  // Early bailout if there's no pending work left.
  var pendingLanes = root.pendingLanes

  if (pendingLanes === NoLanes) {
    return NoLanes
  }

  var nextLanes = NoLanes
  var suspendedLanes = root.suspendedLanes
  var pingedLanes = root.pingedLanes 
  // Do not work on any idle work until all the non-idle work has finished,
  // even if the work is suspended.

  var nonIdlePendingLanes = pendingLanes & NonIdleLanes

  if (nonIdlePendingLanes !== NoLanes) {
    var nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes

    if (nonIdleUnblockedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes)
    } else {
      var nonIdlePingedLanes = nonIdlePendingLanes & pingedLanes

      if (nonIdlePingedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLanes(nonIdlePingedLanes)
      }
    }
  } else {
    // The only remaining work is Idle.
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
