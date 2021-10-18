## React 生命周期详解

>Tip:请不要死记生命周期的顺序和作用，要理解 React 将这些生命周期暴露出来给开发者调用是因为开发者有使用这些生命周期的需求，通过这些生命周期，我们可以完成一些事情。

### React 旧版生命周期
![](https://user-gold-cdn.xitu.io/2019/12/15/16f0a0b3df44f29c?imageView2/0/w/1280/h/960/format/webp/ignore-error/1)

React 的生命周期图如上所示，主要可分为 初始化阶段、挂载阶段、更新阶段、卸载阶段。
* **初始化阶段**
发生在 constructor 中的内容，在 constructor 中进行 state、props 的初始化，在这个阶段修改 state，不会执行更新阶段的生命周期，可以直接对 state 赋值。
* **挂载阶段**
对应的生命周期为：
    * 1.componentWillMount 
        发生在 render 函数之前，还没有挂载 Dom
    * 2.render 
    * 3.componentDidMount
        发生在 render 函数之后，已经挂载 Dom
* **更新阶段**
更新阶段分为由 state 更新引起和 props 更新引起
    * props
        * 1. componentWillReceiveProps(nextProps,nextState)
            这个生命周期主要为我们提供对 props 发生改变的监听，如果你需要在 props 发生改变后，相应改变组件的一些 state。在这个方法中改变 state 不会二次渲染，而是直接合并 state。
        * 2. shouldComponentUpdate(nextProps,nextState)
            这个生命周期需要返回一个 Boolean 类型的值，判断是否需要更新渲染组件，优化 react 应用的主要手段之一，当返回 false 就不会再向下执行生命周期了，在这个阶段不可以 setState()，会导致循环调用。
        * 3. componentWillUpdate(nextProps,nextState)
            这个生命周期主要是给我们一个时机能够处理一些在 Dom 发生更新之前的事情，如获得 Dom 更新前某些元素的坐标、大小等，在这个阶段不可以 setState()，会导致循环调用。
        **一直到这里 this.props 和 this.state 都还未发生更新**
        * 4. render
            执行 render 函数。
        * 5. componentDidUpdate(prevProps, prevState) 
            在此时已经完成渲染，Dom 已经发生变化，State 已经发生更新，prevProps、prevState 均为上一个状态的值。
    * state（具体同上）
        * 1. shouldComponentUpdate
        * 2. componentWillUpdate
        * 3. render
        * 4. componentDidUpdate

* **卸载阶段**
对应的生命周期为
    * componentWillUnmount
    componentWillUnmount 会在组件卸载及销毁之前直接调用。在此方法中执行必要的清理操作，例如，清除 timer，取消网络请求或清除在 componentDidMount  中创建的订阅等。componentWillUnmount 中不应调用 setState，因为该组件将永远不会重新渲染。组件实例卸载后，将永远不会再挂载它。


根据上面的生命周期可以理解所谓的 setState 是“异步”的并非 setState 函数插入了新的宏任务或微任务，而是在进行到 componentDidUpdate 这个生命周期之前，React 都不会更新组件实例的 state 值。

>**引发问题：** setState 在 setTimeout 和原生事件回调中却可以同步更新（ this.state 立即获得更新结果）是为什么呢？
**答案：** 在 React 中，如果是由 React 引发的事件处理（比如：onClick 引发的事件处理）或在钩子函数中，调用 setState 不会同步更新 this.state，除此之外的 setState 调用会同步执行this.setState。 “除此之外”指的是：绕过 React 通过 addEventListener 直接添加的事件处理函数和 setTimeout/setInterval 产生的异步调用。
**解释：** 每次 setState 产生新的state会依次被存入一个队列，然后会根据isBathingUpdates 变量判断是直接更新 this.state 还是放进 dirtyComponent 里回头再说。isBatchingUpdates 默认是 false，也就表示 setState 会同步更新 this.state。但是，当 React 在调用事件处理函数之前就会调用 batchedUpdates，这个函数会把 isBatchingUpdates 修改为 true，造成的后果就是由 React 控制的事件处理过程 setState 不会同步更新 this.state。
**解决方法：** 当我们想要依据上一个 state 的值来 setState 时，可以使用函数式 setState。
```js
function increment(state, props) {
  return {count: state.count + 1};
}
function incrementMultiple() {
  this.setState(increment);
  this.setState(increment);
  this.setState(increment);
}
```


### React 新版生命周期
React 16 中删除了如下三个生命周期。
* componentWillMount 
* componentWillReceiveProps 
* componentWillUpdate 

官方给出的解释是 react 打算在17版本推出新的 Async Rendering，提出一种可被打断的生命周期，而可以被打断的阶段正是实际 dom 挂载之前的虚拟 dom 构建阶段，也就是要被去掉的三个生命周期。
本身这三个生命周期所表达的含义是没有问题的，但 react 官方认为我们（开发者）也许在这三个函数中编写了有副作用的代码，所以要替换掉这三个生命周期，因为这三个生命周期可能在一次 render 中被反复调用多次。

取代这三个生命周期的是两个新生命周期

* static getDerivedStateFromProps(nextProps,nextState)
    * 在 React 16.3.0 版本中：在组件实例化、接收到新的 props 时会被调用
    * 在 React 16.4.0 版本中：在组件实例化、接收到新的 props 、组件状态更新时会被调用
    该方法可以返回一个对象，将会和 state 发生合并，且不会触发 re-render。
    这个生命周期主要为我们提供了一个可以在组件实例化或 props、state 发生变化后根据 props 修改 state 的一个时机，用来替代旧的生命周期中的 componentWillMount、ComponentWillReceiveProps。因为是一个静态方法，this 指向不是组件实例。

* getSnapshotBeforeUpdate（prevProps,prevState）
    在 render 函数调用之后，实际的 Dom 渲染之前，在这个阶段我们可以拿到上一个状态 Dom 元素的坐标、大小的等相关信息。用于替代旧的生命周期中的 componentWillUpdate。
    该函数的返回值将会作为 componentDidUpdate 的第三个参数出现。
