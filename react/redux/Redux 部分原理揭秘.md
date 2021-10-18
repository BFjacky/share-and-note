# Redux 部分原理揭秘

### Provider

使用 Redux 需要用一个 Provider 将根元素包起来，它的原理也比较简单，就是使用 React 提供的用于处理跨级组件通信的 context，将 store 注入到子孙组件中。

### bindActionCreators

bindActionCreators 做的事情非常简单，就是把 actionCreator 用 dispatch 包一下，返回可以直接调用的函数。

```js
function addTodo(text) {
  return {
    type: 'ADD_TODO',
    text
  }
}
function removeTodo(id) {
  return {
    type: 'REMOVE_TODO',
    id
  }
}
const TodoActionCreators = [addTodo, removeTodo]
const boundActionCreators = bindActionCreators(TodoActionCreators, store.dispatch)
/**
 * {
 *  addTodo:Function
 *  removeTodo:Function 
 * }
 */
```

### combineReducers

随着应用越来越大，我们需要对 reducer 进行拆分，拆分后每个函数管理 state 中的一部分。之后我们需要将多个 reducer 合并到一起。



### applyMiddleware
这是 redux 中比较复杂的方法，涉及到了 redux 提供的中间件机制。

关于 中间件 先看下面这张图
![](https://user-gold-cdn.xitu.io/2018/6/15/16402829f39b787c?imageslim)

因为 redux 中处理 action 的 reducer 要求是没有副作用的纯函数，那么就无法实现一些有副作用的 action。

为此 redux 提供了中间件的方式来扩充 redux 的功能
![](https://user-gold-cdn.xitu.io/2018/6/15/16402829f54070ae?imageView2/0/w/1280/h/960/format/webp/ignore-error/1)


applyMiddleware 的代码非常精短，我们也很容易解读这个函数的作用

```js
export default function applyMiddleware(...middlewares) {
  return createStore => (...args) => {
    // 利用传入的createStore和reducer和创建一个store
    const store = createStore(...args)
    let dispatch = () => {
      throw new Error()
    }
    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args)
    }
    // 让每个 middleware 带着 middlewareAPI 这个参数分别执行一遍
    const chain = middlewares.map(middleware => middleware(middlewareAPI))
    // 接着 compose 将 chain 中的所有匿名函数，组装成一个新的函数，即新的 dispatch
    dispatch = compose(...chain)(store.dispatch)
    return {
      ...store,
      dispatch
    }
  }
}
```

它将 store.getState 、 dispatch 方法传送给每个中间件，然后利用 compose 函数生成一个新的 dispatch 函数。

### 中间件

一个什么都没有做的**中间件**的源码就是这样

```js
const doNothingMidddleware = ({ dispatch, getState }) => next => action =>
  next(action)
```

上面的中间件看起来也许有点费解，但是我们把它带入到 applyMiddleware 的方法中就很好理解了。

```js
// 首先传入了一个 不能被调用的 dispatch 函数，表示在中间件中不允许 dispatch。
let dispatch = () => {
  throw new Error()
}
const middlewareAPI = {
  getState: store.getState,
  dispatch: (...args) => dispatch(...args)
}

// 之后调用了每一个 middleware
const chain = middlewares.map(middleware => middleware(middlewareAPI))
/** 这时 chain 为若干如下的方法
 * (next) => {
 *  return function(action){
 *      next(action)
 *  }
 * }
 */

// 最后会生成一个增强的 dispatch
dispatch = compose(...chain)(store.dispatch)
/**
 chain 中的最后一个 middleware 接到 store.dispatch 作为参数，并返回自己包装过 的 dispatch 给前一个函数，前一个函数的 next 则为这个包装过的 dispatch,自己的 next 为 store.dispatch。也就是说在返回的自定义 dispatch 中我们可以实现自己的想要的功能。
 */
// 这样返回的 dispatch 将会按照 applyMiddleware 中的顺序按顺序调用 中间件。
```

**总结**

applyMiddleware 函数的作用返回了一个包含了所有 middleware 增强了的 dispatch 函数。
所以这下你 dispatch 一个 action 的时候，这个 action 会先进入到各个中间件中，最后被 store.dispatch 发出去。也就是如下这张图。

![](https://user-gold-cdn.xitu.io/2018/6/15/16402829f54070ae?imageView2/0/w/1280/h/960/format/webp/ignore-error/1)

### 异步中间件对比

笔者整理了 5 个常用的 redux 中间件，并对其进行了简单的对比。

#### 1.redux-thunk

这个中间件允许你 dispatch 一个函数,这个函数要返回一个函数接收 store.dispatch 作为变量，通过这种方式可以在函数中进行异步任务并 dispatch 相应的 action。

这是最简单暴力的方式，缺点如下：

- 需要写大量的 reducer 处理过渡态、完成态、失败态。
- 无法直接确定哪一个 action 是最后一次 dispatch 出去的，可能因为延时发生老的 action 覆盖新的 action。
- 自由度更高带来的问题就是可控性更差，代码不规范。

#### 2.redux-promise

这个中间件允许你 dispatch 一个 promise，拿到 promise 的结果后再 dispatch 真正的结果。

这个方法是最不具备可操作性的方法，因为它完全限制了开发者的干预，缺点如下：

- 无法处理过渡态，监听不到 promise 状态的变化。
- 无法处理 action 竞态 问题。

#### 3.redux-pack

这是一个 redux-promise 的加强版，提供了 handle 方法处理 promise 的不同状态。

缺点如下：

- 无法处理 action 竞态问题。

#### 4.[redux-saga](https://redux-saga-in-chinese.js.org/)

redux-saga 使用 generator 作为异步处理手段，为什么不用 promise，因为 promise 不能够取消、暂停执行。和 saga 的语义有些出入。

redux-saga 中，我们会编写一些 saga，当 dispatch 一个 action 时会首先匹配这些 saga，并等待任务完成后，dispatch 真正的 action 到 reducer 中。

redux-saga 提供了一些辅助函数如 takeEvery、takeLatest 等方便我们处理多个 action 互相竞争的问题，并且能够取消其他 action 的执行。

通过 react-saga 中的一些内置的 api，我们可以更加方便的控制系统中的若干功能。

#### 5.[redux-observable](https://redux-observable-cn.js.org/)

在 redux-observable 中，他们管处理 action 的这个东西叫 epics。在 epic 中，它接收 actions 流作为参数并返回 actions 流。

rxjs 的特点就是 redux-observable 的特点了，在处理异步编程上比 generator 和 promise 要舒适很多。

对比 redux-saga 来说学习路线还要更陡峭一些。但是大多是 rxjs 的相关知识，本身 rxjs 作为处理异步的解决方案是非常优秀且全面的，值得前端开发者深入学习。


对于状态复杂的中、大型系统来说，redux-observable 和 redux-saga 都是很不错的选择，取决于你更喜欢用 generator 还是 observable 来处理异步行为。