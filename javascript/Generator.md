# Generator 函数

子例程： 只有当调用的子函数完全执行完毕，才会结束执行父函数
普通线程： 普通线程是抢先式的执行，哪个线程得到计算资源，由环境决定。
协程：可以由单线程实现、也可以由多线程实现，单线程下为多个函数（执行上下文），多线程下为多个线程。多个线程可以并行执行，但只有一个线程处于正在运行的状态，其他线程都处于暂停态，协程的执行权由协程自己分配。

Javascript 是单线程语言，只能保持一个调用栈，引入协程之后可以保存多个调用栈，抛出错误的时候能找出原始的调用栈，Generator 函数是 es6 对协程的不完全实现，因为只有 Generator 函数的调用者，可以交还执行权.

### Thunk 函数的含义

参数有两种求值策略，“传值引用”与“传名引用”，“传值引用”比较简单，但是会引起性能浪费。
编译器的“传名调用”的实现，往往是将参数放到一个临时函数中，然后将临时函数传入函数体，这个临时函数就叫做 Thunk 函数。

```js
function f(m) {
  return m * 2
}

f(x + 5)

// 等同于

var thunk = function() {
  return x + 5
}

function f(thunk) {
  return thunk() * 2
}
```

为了方便开发，在 Javascript 中，Thunk 函数替换的不是表达式，而是多参数函数，将其替换为一个只接受回调函数作为参数的单参数函数

```js
function thunkify() {
  return function(...args) {
    return function(callback) {
      return fn.call(this, ...args, callback)
    }
  }
}

const thunkifiedReadfile = thunkify(readFile)
thunkifiedReadfile(file)(callback)
```

### Generator 配合 Thunk 函数实现用同步代码编写异步程序

Generator 能够打断函数的执行,使用这种特性我们能够在函数体外执行异步任务，并将值返回给函数内部，如下代码段。

```js
const gen = function*() {
  const file = yield readFile(filename)
}

const g = gen()
const fn = g.next().value
fn((res, err) => {
  g.next(res)
})
```

### 基于 thunk 函数自动执行 Generator

我们将异步代码从程序内部搬离到程序外部，程序内部的代码变得简介，但是外部的代码仍然很复杂，我们需要一种方式，来简化 Generator 的执行。

通过以下这种方式我们能够自动执行 generator 中的代码，并在函数内外更替执行权限。

```js
const gen = function*() {
  const f1 = yield readFileThunk(file1)
  const f2 = yield readFileThunk(file2)
  const f3 = yield readFileThunk(file3)
}
const run = function(gen) {
  const g = gen()
  // next 作为回调函数传回到每个 readFileThunk 中
  const next = function(res, err) {
    const result = g.next(res)
    if (result.done) return
    const fn = result.value
    fn(next)
  }
  next()
}
run(gen)
```

### Generator 配合 Promise 实现用同步化代码编写异步程序。

Generator 能够打断函数的执行,使用这种特性我们能够在函数体外执行异步任务，并将值返回给函数内部，如下代码段。

```js
function* gen() {
  const result = yield fetch()
}
const g = gen()
const asyncFn = g.next().value
asyncFn.then(res => {
  g.next(res)
})
```

### 基于 Promise 自动执行 Generator

```js
const gen = function*() {
  const f1 = yield readFileThunk(file1)
  const f2 = yield readFileThunk(file2)
  const f3 = yield readFileThunk(file3)
}
const run = function(gen) {
  const g = gen()
  // next 作为回调函数传回到每个 readFileThunk 中
  const next = function(res) {
    const result = g.next(res)
    if (result.done) return
    result.value.then((res, err) => {
      next(res)
    })
  }
  next()
}
run(gen)
```

### co 模块

co 函数库其实就是将两种自动执行器（Thunk 函数和 Promise 对象），包装成一个库。使用 co 的前提条件是，Generator 函数的 yield 命令后面，只能是 Thunk 函数或 Promise 对象。

通过 co 模块我们能将异步代码变成如下的样子。
```js
const co = require('co')

function getFile() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve('file')
    }, 1000)
  })
}

co(function* a() {
  const file = yield getFile()
  console.log(file)
  return file
}).then(res => {
  console.log(res)
})
```
