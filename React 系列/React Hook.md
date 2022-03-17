## React Hook

React Hook 是在函数组件上支持状态存储的方案,在函数组件上有了保持状态的能力,看到这个功能首先产生的疑问是:

1. 函数组件不会有实例,调用了函数组件后会返回一个 ReactElement,那么函数组件是如何保留自己的状态的呢?
2. 多个 react-hooks 用什么来记录每一个 hooks 的顺序的?或者说:为什么不能条件语句中，声明 hooks? hooks 声明为什么在组件的最顶部？
3. function 函数组件中的 useState，和 class 类组件 setState 有什么区别？
4. react 是如何确定 useState 的调用所对应的组件呢?
5. 其他官方 Hook, 如 useEffect,useMemo,useRef 的实现原理是什么?(useRef 不需要依赖注入，就能访问到最新的改变值？)
6. useMemo 是怎么对值做缓存的？如何应用它优化性能？
7. 为什么两次传入 useState 的值相同，函数组件不更新?

#### useState Hook

函数组件与类组件不一样,没有自己的实例来存储状态信息,函数组件的状态是存储在 React 内部一个被称为`hook`的对象.
在首次渲染一个函数组件时调用`useState`方法会创建一个新的 `hook` 对象,并将该 `hook` 对象绑定在函数组件对应的 `fiber` 节点上.当一个函数组件有多个 `hook` 存在时,会将这些 `hook` 以链表的形式进行存储,其源码如下:

```js
function mountWorkInProgressHook() {
  var hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  }

  if (workInProgressHook === null) {
    // This is the first hook in the list
    currentlyRenderingFiber$1.memoizedState = workInProgressHook = hook
  } else {
    // Append to the end of the list
    workInProgressHook = workInProgressHook.next = hook
  }

  return workInProgressHook
}
```

从这里已经可以得到,函数组件的状态并不在函数内部,而是绑定在了函数组件对应的`fiber`节点上.
**(至此回答上面第 1 个问题)**
同时,观察 React 源码中关于创建 hook 的写法和我们在函数组件中调用 `useState` 的写法,我们可以发现,每次通过 `useState` 创建的 hook 是没有`唯一标识(id)`的,那么函数组件中多次通过`useState`创建并绑定在`fiber`节点上的多个`hook`是如何与组件内部的`useState`状态对应起来的?由于`hook`没有`唯一标识`,那么只能是通过顺序对应了.

当我们完成了首次渲染,由更新产生第二次渲染时,函数组件需用通过`useState`获取组件状态,React 会根据`fiber`节点上绑定的`hook`链表逐个获取`hook`中存储的状态,如果`useState`放在条件分支中,就会产生函数中`useState`的顺序与 React 内部`fiber`节点上的`hook`链表无法对应的问题.下面是部分源码

```js
function updateWorkInProgressHook() {
  var nextCurrentHook

  if (currentHook === null) {
    var current = currentlyRenderingFiber$1.alternate

    if (current !== null) {
      // 获取 fiber 节点上的 hook 对象
      nextCurrentHook = current.memoizedState
    } else {
      nextCurrentHook = null
    }
  } else {
    // 获取 fiber 节点上的 hook 链表的下一个 hook 对象
    nextCurrentHook = currentHook.next
  }
  // 省略...
}
```

**(至此回答上面第 2 个问题)**
类似 `const [content,setContent] = useState(0)` 返回的第二个值`setContent`为一个函数,用来修改`useState`监听的状态值,当我们通过`setContent`修改状态时,实际上和类组件中 `setState` 的行为是类似的,都会去创建一个更新,并调用`ensureRootIsScheduled` 来触发一次渲染,不同点是`setState`创建的更新绑定在了 `fiber` 节点上,`setContent` 创建的更新同时绑定在`fiber`节点对象和`hook`对象上.
当进行更新渲染时,函数组件会通过`updateFunctionComponent`来调用函数组件构建新的`fiber`节点,此时调用`useState`会将之前创建的更新依次应用在相应的`状态`上.
关于第三个问题,其实在我的视角里没有找到明显的差异
**(至此回答上面第 3 个问题)**
当渲染一个函数组件时,会当我们在首次渲染函数组件时,会创建其对应的 hook 对象,并将 hook 对象绑定在当前函数组件对应的`fiber`节点上,代码如下:

```js
function mountWorkInProgressHook() {
  var hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  }

  if (workInProgressHook === null) {
    // This is the first hook in the list
    currentlyRenderingFiber$1.memoizedState = workInProgressHook = hook
  } else {
    // Append to the end of the list
    workInProgressHook = workInProgressHook.next = hook
  }

  return workInProgressHook
}
```

除了将 `hook` 对象绑定到相应的 `fiber` 节点上外,还需要绑定对应的 `disptch` 函数,使得在函数组件中更新状态时,能够定位到发起更新的 `fiber` 节点,其代码如下:

```js
function mountState(initialState) {
  // *** 省略部分代码 ***
  var dispatch = (queue.dispatch = dispatchSetState.bind(
    null,
    currentlyRenderingFiber$1,
    queue,
  ))
  return [hook.memoizedState, dispatch]
}
```

**(至此回答上面第 4 个问题)**

#### useEffect

除了 `useState` 以外,在 React 中还有官方提供的常用的 hook 方法 `useEffect`, `useEffect` 产生的 effect 链表与 state 产生的链表是两个不同的链表,当一次渲染完成后的下一次宏任务循环通过 `flushPassiveEffects` 来执行副作用函数

```js
function commitRootImpl(root, recoverableErrors, renderPriorityLevel) {
  // ...省略部分代码
  if (
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags ||
    (finishedWork.flags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHavePassiveEffects) {
      rootDoesHavePassiveEffects = true
      scheduleCallback$1(NormalPriority, function () {
        flushPassiveEffects()
        return null
      })
    }
  }
  // ...省略部分代码
}
```

当调用组件重新渲染时,也会执行 `useEffect`,此时创建副作用会根据所传的 `deps` 是否改变,来判断是否要挂载这个 `effect` 对象,这里创建 Effect Hook 的方式仍然是以顺序来确定的,印证了 Effect Hook 也不能在条件分支中创建.

```js
function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
  var hook = updateWorkInProgressHook()
  var nextDeps = deps === undefined ? null : deps
  var destroy = undefined

  if (currentHook !== null) {
    var prevEffect = currentHook.memoizedState
    destroy = prevEffect.destroy

    if (nextDeps !== null) {
      var prevDeps = prevEffect.deps
      // 判断 deps 是否发生变化
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memoizedState = pushEffect(hookFlags, create, destroy, nextDeps)
        return
      }
    }
  }
  currentlyRenderingFiber$1.flags |= fiberFlags
  hook.memoizedState = pushEffect(
    HasEffect | hookFlags,
    create,
    destroy,
    nextDeps,
  )
}
```

#### useLayoutEffect & useInsertionEffect

`useLayoutEffect` & `useInsertionEffect` 是另外的副作用,其创建过程与 `useEffect` 是一样的,区别在于其 effect 的标记值 `tag` 不同
`useInsertionEffect` 在 DOM 完成更新完成前执行,`useLayoutEffect` 在 DOM 更新完成后执行,不同 effect.tag 见下面代码:

```js
var NoFlags = 0 // 代表是否有需要触发的副作用
var HasEffect = 1 //代表是否有需要触发的副作用
var Insertion = 2 // React18 中新提供的副作用 : useInsertionEffect
var Layout = 4 // useLayoutEffect 对应的标记
var Passive = 8 // useEffect 对应的标记
```

useInsertionEffect 和 useLayoutEffect 两者的执行时机在源码中比较容易找到区别,可以看下面的代码及注释:

```js
// 执行 fiber 上所有的副作用,包括 DOM 变更和注册的 InsertionEffect, InsertionEffect 的执行发生在 Dom 变更之后和 fiber 树替换之前
commitMutationEffects(root, finishedWork, lanes) // useInsertionEffect

resetAfterCommit(root.containerInfo) // The work-in-progress tree is now the current tree. This must come after
// the mutation phase, so that the previous tree is still current during
// componentWillUnmount, but before the layout phase, so that the finished
// work is current during componentDidMount/Update.

root.current = finishedWork // The next phase is the layout phase, where we call effects that read

{
  markLayoutEffectsStarted(lanes)
}
// 执行 layoutEffect,此时 fiber 树已经完成完整的替换
commitLayoutEffects(finishedWork, root, lanes) // useLayoutEffect
```

在 `commitMutationEffects` 中, React 会按顺序将 DOM 修改的任务完成,然后执行 `InsertionEffect`,`commitMutationEffects`通过`commitMutationEffects_begin`&`commitMutationEffects_end`两个方法完成对 `fiber` 树的深度优先遍历,找到需要执行更新的 `fiber` 节点进行更新,
代码如下:

```js
function commitMutationEffects_begin(root, lanes) {
  while (nextEffect !== null) {
    var fiber = nextEffect // TODO: Should wrap this in flags check, too, as optimization
    // ... 省略部分代码
    var child = fiber.child

    if ((fiber.subtreeFlags & MutationMask) !== NoFlags && child !== null) {
      ensureCorrectReturnPointer(child, fiber)
      nextEffect = child
    } else {
      commitMutationEffects_complete(root, lanes)
    }
  }
}

function commitMutationEffects_complete(root, lanes) {
  while (nextEffect !== null) {
    var fiber = nextEffect
    setCurrentFiber(fiber)
    try {
      commitMutationEffectsOnFiber(fiber, root, lanes)
    } catch (error) {
      captureCommitPhaseError(fiber, fiber.return, error)
    }

    resetCurrentFiber()
    var sibling = fiber.sibling

    if (sibling !== null) {
      ensureCorrectReturnPointer(sibling, fiber.return)
      nextEffect = sibling
      return
    }

    nextEffect = fiber.return
  }
}
```

在注解

#### useMemo & useCallback

useMemo 和 useCallback 都是为了缓存函数组件的一些数据,避免这些数据作为 props 向下传递时,由于引用不同而导致子组件的重新渲染(作为 props 传递给其他组件时会导致像 PureComponent、shouldComponentUpdate、React.memo 等相关优化失效(因为每次都是不同的函数|对象)),useMemo 缓存的是值,useCallback 缓存的是函数.
其实现的方式和 `useEffect` 大体上有一致的思路,均是通过 `Object.is` 方法进行引用类型的浅比较

#### useRef

useRef 返回一个可变的 ref 对象，其 .current 属性被初始化为传入的参数（initialValue）。返回的 ref 对象在组件的整个生命周期内持续存在。

```js
function TextInputWithFocusButton() {
  const inputEl = useRef(null)
  const onButtonClick = () => {
    // `current` 指向已挂载到 DOM 上的文本输入元素
    inputEl.current.focus()
  }
  return (
    <>
      <input ref={inputEl} type="text" />
      <button onClick={onButtonClick}>Focus the input</button>
    </>
  )
}
```

#### 记录一个有趣的自定义 hook

```js
// 在Hooks中获取上一次指定的props
const usePrevProps = (value) => {
  const ref = React.useRef()
  React.useEffect(() => {
    ref.current = value
  })
  return ref.current
}
```
