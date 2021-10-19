## Promise 使用、原理以及实现过程

#### 1.什么是 Promise

promise 是目前 JS 异步编程的主流解决方案，遵循 Promises/A+ 方案。

#### 2.Promise 原理简析

（1）promise 本身相当于一个状态机，拥有三种状态

- pending
- fulfilled
- rejected
  一个 promise 对象初始化时的状态是 pending，调用了 resolve 后会将 promise 的状态扭转为 fulfilled，调用 reject 后会将 promise 的状态扭转为 rejected，这两种扭转一旦发生便不能再扭转该 promise 到其他状态。

（2）promise 对象原型上有一个 then 方法，then 方法会返回一个新的 promise 对象，并且将回调函数 return 的结果作为该 promise resolve 的结果，then 方法会在一个 promise 状态被扭转为 fulfilled 或 rejected 时被调用。then 方法的参数为两个函数，分别为 promise 对象的状态被扭转为 fulfilled 和 rejected 对应的回调函数

#### 3.Promise 如何使用

构造一个 promise 对象，并将要执行的异步函数传入到 promise 的参数中执行，并且在异步执行结束后调用 resolve( ) 函数，就可以在 promise 的 then 方法中获取到异步函数的执行结果

```js
new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve()
  }, 1000)
}).then(
  res => {},
  err => {}
)
```

同时在 Promise 还为我们实现了很多方便使用的方法:

* **Promise.resolve** 
Promise.resolve 返回一个 fulfilled 状态的 promise

```js
const a = Promise.resolve(1)
a.then(
  res => {
    // res = 1
  },
  err => {}
)
```

* **Promise.all** 
Promise.all 接收一个 promise 对象数组作为参数，只有全部的 promise 都已经变为 fulfilled 状态后才会继续后面的处理。Promise.all 本身返回的也是一个 promise

```js
const promise1 = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('promise1')
  }, 100)
})
const promise2 = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('promise2')
  }, 100)
})
const promises = [promise1, promise2]

Promise.all(promises).then(
  res => {
    // promises 全部变为 fulfilled 状态的处理
  },
  err => {
    // promises 中有一个变为 rejected 状态的处理
  }
)
```

* **Promise.race**
Promise.race 和 Promise.all 类似，只不过这个函数会在 promises 中第一个 promise 的状态扭转后就开始后面的处理（fulfilled、rejected 均可）

```js
const promise1 = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('promise1')
  }, 100)
})
const promise2 = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('promise2')
  }, 1000)
})
const promises = [promise1, promise2]

Promise.race(promises).then(
  res => {
    // 此时只有 promise1 resolve 了，promise2 仍处于 pending 状态
  },
  err => {}
)
```

**配合 async await 使用**

现在的开发场景中我们大多会用 async await 语法糖来等待一个 promise 的执行结果，使代码的可读性更高。**async** 本身是一个语法糖，将函数的返回值包在一个 promise 中返回。

```js
// async 函数会返回一个 promise
const p = async function f() {
  return 'hello world'
}
p.then(res => console.log(res)) // hello world
```

**开发技巧**

在前端开发上 promise 大多被用来请求接口，Axios 库也是开发中使用最频繁的库，但是频繁的 try catch 扑捉错误会让代码嵌套很严重。考虑如下代码的优化方式

```js
const getUserInfo = async function() {
  return new Promise((resolve, reject) => {
    // resolve() || reject()
  })
}
// 为了处理可能的抛错,不得不将 try catch 套在代码外边，一旦嵌套变多，代码可读性就会急剧下降
try {
  const user = await getUserInfo()
} catch (e) {}
```

好的处理方法是在异步函数中就将错误 catch，然后正常返回，如下所示 👇

```js
const getUserInfo = async function() {
  return new Promise((resolve, reject) => {
    // resolve() || reject()
  }).then(
    res => {
      return [res, null] // 处理成功的返回结果
    },
    err => {
      return [null, err] // 处理失败的返回结果
    }
  )
}

const [user, err] = await getUserInfo()
if (err) {
  // err 处理
}

// 这样的处理是不是清晰了很多呢
```

#### 4.Promise 源码实现

知识的学习需要知其然且知其所以然，所以通过一点点实现的一个 promise 能够对 promise 有着更深刻的理解。

（1）首先按照最基本的 promise 调用方式实现一个简单的 promise （基于 ES6 规范编写），假设我们有如下调用方式

```js
new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve(1)
  }, 1000)
})
  .then(
    res => {
      console.log(res)
      return 2
    },
    err => {}
  )
  .then(
    res => {
      console.log(res)
    },
    err => {}
  )
```

我们首先要实现一个 Promise 的类，这个类的构造函数会传入一个函数作为参数，并且向该函数传入 resolve 和 reject 两个方法。
初始化 Promise 的状态为 pending。

```js
class MyPromise {
  constructor(executor) {
    this.executor = executor
    this.value = null
    this.status = 'pending'

    const resolve = value => {
      if (this.status === 'pending') {
        this.value = value          // 调用 resolve 后记录 resolve 的值
        this.status = 'fulfilled'   // 调用 resolve 扭转 promise 状态
      }
    }

    const reject = value => {
      if (this.status === 'pending') {
        this.value = value          // 调用 reject 后记录 reject 的值
        this.status = 'rejected'    // 调用 reject 扭转 promise 状态
      }
    }

    this.executor(resolve, reject)
  }
```

（2）接下来要实现 promise 对象上的 then 方法，then 方法会传入两个函数作为参数，分别作为 promise 对象 resolve 和 reject 的处理函数。
这里要注意三点：

- then 函数需要返回一个新的 promise 对象
- 执行 then 函数的时候这个 promise 的状态可能还没有被扭转为 fulfilled 或 rejected
- 一个 promise 对象可以同时多次调用 then 函数

```js
class MyPromise {
  constructor(executor) {
    this.executor = executor
    this.value = null
    this.status = 'pending'
    this.onFulfilledFunctions = [] // 存放这个 promise 注册的 then 函数中传的第一个函数参数
    this.onRejectedFunctions = [] // 存放这个 promise 注册的 then 函数中传的第二个函数参数
    const resolve = value => {
      if (this.status === 'pending') {
        this.value = value
        this.status = 'fulfilled'
        this.onFulfilledFunctions.forEach(onFulfilled => {
          onFulfilled() // 将 onFulfilledFunctions 中的函数拿出来执行
        })
      }
    }
    const reject = value => {
      if (this.status === 'pending') {
        this.value = value
        this.status = 'rejected'
        this.onRejectedFunctions.forEach(onRejected => {
          onRejected() // 将 onRejectedFunctions 中的函数拿出来执行
        })
      }
    }
    this.executor(resolve, reject)
  }

  then(onFulfilled, onRejected) {
    const self = this
    if (this.status === 'pending') {
      /**
       *  当 promise 的状态仍然处于 ‘pending’ 状态时，需要将注册 onFulfilled、onRejected 方法放到 promise 的 onFulfilledFunctions、onRejectedFunctions 备用
       */
      return new MyPromise((resolve, reject) => {
        this.onFulfilledFunctions.push(() => {
          const thenReturn = onFulfilled(self.value)
          resolve(thenReturn)
        })
        this.onRejectedFunctions.push(() => {
          const thenReturn = onRejected(self.value)
          resolve(thenReturn)
        })
      })
    } else if (this.status === 'fulfilled') {
      return new MyPromise((resolve, reject) => {
        const thenReturn = onFulfilled(self.value)
        resolve(thenReturn)
      })
    } else {
      return new MyPromise((resolve, reject) => {
        const thenReturn = onRejected(self.value)
        resolve(thenReturn)
      })
    }
  }
}
```

对于以上完成的 **MyPromise** 进行测试，测试代码如下

```js
const p = new MyPromise((resolve, reject) => {
  setTimeout(() => {
    resolve(1)
  }, 1000)
})

p.then(res => {
  console.log('first then', res)
  return res + 1
}).then(res => {
  console.log('first then', res)
})

p.then(res => {
  console.log(`second then`, res)
  return res + 1
}).then(res => {
  console.log(`second then`, res)
})

/**
 *  输出结果如下：
 *  first then 1
 *  first then 2
 *  second then 1
 *  second then 2
 */
```

（3）在 promise 相关的内容中，有一点常常被我们忽略，当 then 函数中返回的是一个 promise 应该如何处理？
考虑如下代码：

```js
// 使用正确的 Promise
new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve()
  }, 1000)
})
  .then(res => {
    console.log('外部 promise')
    return new Promise((resolve, reject) => {
      resolve(`内部 promise`)
    })
  })
  .then(res => {
    console.log(res)
  })

/**
 * 输出结果如下：
 * 外部 promise
 * 内部 promise
 */
```

通过以上的输出结果不难判断，当 then 函数返回的是一个 promise 时，promise 并不会直接将这个 promise 传递到下一个 then 函数，而是会等待该 promise resolve 后，将其 resolve 的值，传递给下一个 then 函数，找到我们实现的代码的 then 函数部分，做以下修改：

```js
then(onFulfilled, onRejected) {
    const self = this
    if (this.status === 'pending') {
        return new MyPromise((resolve, reject) => {
        this.onFulfilledFunctions.push(() => {
            const thenReturn = onFulfilled(self.value)
            if (thenReturn instanceof MyPromise) {
                // 当返回值为 promise 时，等该内部的 promise 状态扭转时，同步扭转外部的 promise 状态
                thenReturn.then(resolve, reject)
            } else {
                resolve(thenReturn)
            }
        })
        this.onRejectedFunctions.push(() => {
            const thenReturn = onRejected(self.value)
            if (thenReturn instanceof MyPromise) {
                // 当返回值为 promise 时，等该内部的 promise 状态扭转时，同步扭转外部的 promise 状态
                thenReturn.then(resolve, reject)
            } else {
                resolve(thenReturn)
            }
        })
        })
    } else if (this.status === 'fulfilled') {
        return new MyPromise((resolve, reject) => {
            const thenReturn = onFulfilled(self.value)
            if (thenReturn instanceof MyPromise) {
                // 当返回值为 promise 时，等该内部的 promise 状态扭转时，同步扭转外部的 promise 状态
                thenReturn.then(resolve, reject)
            } else {
                resolve(thenReturn)
            }
        })
    } else {
        return new MyPromise((resolve, reject) => {
            const thenReturn = onRejected(self.value)
            if (thenReturn instanceof MyPromise) {
                // 当返回值为 promise 时，等该内部的 promise 状态扭转时，同步扭转外部的 promise 状态
                thenReturn.then(resolve, reject)
            } else {
                resolve(thenReturn)
            }
        })
    }
}
```

(4) 之前的 promise 实现代码仍然缺少很多细节逻辑，下面会提供一个相对完整的版本，注释部分是增加的代码，并提供了解释。

```js
class MyPromise {
  constructor(executor) {
    this.executor = executor
    this.value = null
    this.status = 'pending'
    this.onFulfilledFunctions = []
    this.onRejectedFunctions = []
    const resolve = value => {
      if (this.status === 'pending') {
        this.value = value
        this.status = 'fulfilled'
        this.onFulfilledFunctions.forEach(onFulfilled => {
          onFulfilled()
        })
      }
    }
    const reject = value => {
      if (this.status === 'pending') {
        this.value = value
        this.status = 'rejected'
        this.onRejectedFunctions.forEach(onRejected => {
          onRejected()
        })
      }
    }
    this.executor(resolve, reject)
  }

  then(onFulfilled, onRejected) {
    const self = this
    if (typeof onFulfilled !== 'function') {
      // 兼容 onFulfilled 未传函数的情况
      onFulfilled = function() {}
    }
    if (typeof onRejected !== 'function') {
      // 兼容 onRejected 未传函数的情况
      onRejected = function() {}
    }
    if (this.status === 'pending') {
      return new MyPromise((resolve, reject) => {
        this.onFulfilledFunctions.push(() => {
          try {
            const thenReturn = onFulfilled(self.value)
            if (thenReturn instanceof MyPromise) {
              thenReturn.then(resolve, reject)
            } else {
              resolve(thenReturn)
            }
          } catch (err) {
            // catch 执行过程的错误
            reject(err)
          }
        })
        this.onRejectedFunctions.push(() => {
          try {
            const thenReturn = onRejected(self.value)
            if (thenReturn instanceof MyPromise) {
              thenReturn.then(resolve, reject)
            } else {
              resolve(thenReturn)
            }
          } catch (err) {
            // catch 执行过程的错误
            reject(err)
          }
        })
      })
    } else if (this.status === 'fulfilled') {
      return new MyPromise((resolve, reject) => {
        try {
          const thenReturn = onFulfilled(self.value)
          if (thenReturn instanceof MyPromise) {
            thenReturn.then(resolve, reject)
          } else {
            resolve(thenReturn)
          }
        } catch (err) {
          // catch 执行过程的错误
          reject(err)
        }
      })
    } else {
      return new MyPromise((resolve, reject) => {
        try {
          const thenReturn = onRejected(self.value)
          if (thenReturn instanceof MyPromise) {
            thenReturn.then(resolve, reject)
          } else {
            resolve(thenReturn)
          }
        } catch (err) {
          // catch 执行过程的错误
          reject(err)
        }
      })
    }
  }
}
```

（5）至此一个相对完整的 promise 已经实现，但他仍有一些问题，了解**宏任务、微任务**的同学一定知道，promise 的 then 函数实际上是注册一个微任务，then 函数中的参数函数并不会同步执行。
查看如下代码：

```js
new Promise((resolve,reject)=>{
    console.log(`promise 内部`)
    resolve()
}).then((res)=>{
    console.log(`第一个 then`)
})
console.log(`promise 外部`)

/**
 * 输出结果如下：
 * promise 内部
 * promise 外部
 * 第一个 then
 */

// 但是如果使用我们写的 MyPromise 来执行上面的程序

new MyPromise((resolve,reject)=>{
    console.log(`promise 内部`)
    resolve()
}).then((res)=>{
    console.log(`第一个 then`)
})
console.log(`promise 外部`)
/**
 * 输出结果如下：
 * promise 内部
 * 第一个 then
 * promise 外部
 */
```

以上的原因是因为的我们的 then 中的 onFulfilled、onRejected 是同步执行的，当执行到 then 函数时上一个 promise 的状态已经扭转为 fulfilled 的话就会立即执行 onFulfilled、onRejected。
要解决这个问题也非常简单，将 onFulfilled、onRejected 的执行放在下一个事件循环中就可以了。

```js
if (this.status === 'fulfilled') {
  return new MyPromise((resolve, reject) => {
    setTimeout(() => {
      try {
        const thenReturn = onFulfilled(self.value)
        if (thenReturn instanceof MyPromise) {
          thenReturn.then(resolve, reject)
        } else {
          resolve(thenReturn)
        }
      } catch (err) {
        // catch 执行过程的错误
        reject(err)
      }
    })
  }, 0)
}
```

关于宏任务和微任务的解释，我曾在掘金上看到过一篇非常棒的文章，它用*银行柜台*的例子解释了为什么会同时存在宏任务和微任务两个队列，文章链接贴到文末感兴趣的可以看一下。

#### 5.Promise/A+ 方案解读

我们上面实现的一切逻辑，均是按照 [Promise/A+](https://promisesaplus.com/) 规范实现的，Promise/A+ 规范说的大部分内容已经在上面 promise 的实现过程中一一讲解。接下来讲述相当于一个汇总：

1. promise 有三个状态 pending、fulfilled、rejected，只能由 pending 向 fulfilled 、rejected 两种状态发生改变。
2. promise 需要提供一个 then 方法，then 方法接收 (onFulfilled,onRejected) 两个函数作为参数。
3. onFulfilled、onRejected 须在 promise 完成后后（状态扭转）后调用，且只能调用一次。
4. onFulfilled、onRejected 仅仅作为函数进行调用，不能够将 this 指向调用它的 promise。
5. onFulfilled、onRejected 必须在**执行上下文栈**只包含**平台代码**后才能执行。平台代码指 引擎，环境，Promise 实现代码。（PS:这处规范要求 onFulfilled、onRejected 函数的执行必须在 then 被调用的那个事件循环之后的事件循环。但是规范并没有要求是把它们作为一个*微任务*或是*宏任务*去执行，只是各平台的实现均把 Promise 的 onFulfilled、onRejected 放到微任务队列中去执行了)
6. onFulfilled、onRejected 必须是个函数，否则忽略。
7. then 方法可以被一个 promise 多次调用。
8. then 方法需要返回一个 promise。
9. Promise 的解析过程是一个抽象操作，将 Promise 和一个值作为输入，我们将其表示为 **\[[Resolve]](promise,x)**， **\[[Resolve]](promise,x)** 是创建一个 Resolve 方法并传入 promise,x（promise 成功时返回的值） 两个参数，如果 x 是一个 thenable 对象(含有 then 方法)，并且假设 x 的行为类似 promise， **\[[Resolve]](promise,x)** 会创造一个采用 x 状态的 promise，否则 **\[[Resolve]](promise,x)** 会用 x 来扭转 promise 的状态。取得输入的不同的 promise 实现方式可以进行交互，只要它们都暴露了 Promise/A+ 兼容方法即可。它也允许 promise 使用合理的 then 方法同化一些不合规范的 promise 实现。

第 9 点只看文档比较晦涩难懂，其实它是针对我们的 then 方法中的这行代码做的规范解释。

```js
return new MyPromise((resolve, reject) => {
  try {
    const thenReturn = onFulfilled(self.value)
    if (thenReturn instanceof MyPromise) {
      // 👈 就是这一行代码
      thenReturn.then(resolve, reject)
    } else {
      resolve(thenReturn)
    }
  } catch (err) {
    reject(err)
  }
})
```

因为 Promise 并不是 JS 一开始就有的标准，是被很多第三方独立实现的一个方法，所以无法通过 instanceof 来判断返回值是否是一个 promise 对象，所以为了使不同的 promise 可以交互，才有了我上面提到的第 9 条规范。当返回值 thenReturn 是一个 promise 对象时，我们需要等待这个 promise 的状态发生扭转并用它的返回值来 resolve 外层的 promise。

所以最后我们还需要实现 **\[[Resolve]](promise,x)**，来满足 promise 规范,规范如下所示。

![promiseRule](https://staticweb.keepcdn.com/fecommon/tmp/keepfile@1575605968758/promise-rule.jpg)

```js
/**
 * resolvePromise 函数即为根据 x 的值来决定 promise2 的状态的函数
 * @param {Promise} promise2  then 函数需要返回的 promise 对象
 * @param {any} x onResolve || onReject 执行后得到的返回值
 * @param {Function} resolve  MyPromise 中的 resolve 方法
 * @param {Function} reject  MyPromise 中的 reject 方法
 */
function resolvePromise(promise2, x, resolve, reject) {
  if (promise2 === x) {
    // 2.3.1 promise2 和 x 指向同一个对象
    reject(new TypeError())
    return
  }

  if (x instanceof MyPromise) {
    // 2.3.2 x 是一个 MyPromise 的实例，采用他的状态
    if (x.status === 'pending') {
      x.then(
        value => {
          resolvePromise(promise2, value, resolve, reject)
        },
        err => {
          reject(err)
        }
      )
    } else {
      x.then(resolve, reject)
    }
    return
  }

  if (x && (typeof x === 'function' || typeof x === 'object')) {
    // 2.3.3 x 是一个对象或函数
    try {
      const then = x.then // 2.3.3.1 声明 变量 then = x.then
      let promiseStatusConfirmed = false // promise 的状态确定
      if (typeof then === 'function') {
        // 2.3.3.3 then 是一个方法，把 x 绑定到 then 函数中的 this 上并调用
        then.call(
          x,
          value => {
            // 2.3.3.3.1 then 函数返回了值 value，则使用 [[Resolve]](promise, value)，用于监测 value 是不是也是一个 thenable 的对象
            if (promiseStatusConfirmed) return // 2.3.3.3.3 即这三处谁选执行就以谁的结果为准
            promiseStatusConfirmed = true
            resolvePromise(promise2, value, resolve, reject)
            return
          },
          err => {
            // 2.3.3.3.2  then 函数抛错 err ，用 err reject 当前的 promise
            if (promiseStatusConfirmed) return // 2.3.3.3.3 即这三处谁选执行就以谁的结果为准
            promiseStatusConfirmed = true
            reject(err)
            return
          }
        )
      } else {
        // 2.3.3.4  then 不是一个方法，则用 x 扭转 promise 状态 为 fulfilled
        resolve(x)
      }
    } catch (e) {
      // 2.3.3.2 在取得 x.then 的结果时抛出错误 e 的话，使用 e reject 当前的 promise
      if (promiseStatusConfirmed) return // 2.3.3.3.3 即这三处谁选执行就以谁的结果为准
      promiseStatusConfirmed = true
      reject(e)
      return
    }
  } else {
    resolve(x) // 2.3.4 如果 x 不是 object || function，用 x 扭转 promise 状态 为 fulfilled
  }
}
```
然后我们就可以用 resolcePromise 方法替换之前的这部分代码

```js
return new MyPromise((resolve, reject) => {
  try {
    const thenReturn = onFulfilled(self.value)
    if (thenReturn instanceof MyPromise) {
      thenReturn.then(resolve, reject)
    } else {
      resolve(thenReturn)
    }
  } catch (err) {
    reject(err)
  }
})

// 变成下面这样 👇 

return new MyPromise((resolve, reject) => {
  try {
    const thenReturn = onFulfilled(self.value)
    resolvePromise(resolve,reject)
  } catch (err) {
    reject(err)
  }
})
```

本篇文章不在于实现一个完整的 promise，但是通过对 promise 的尝试实现，已经对 promise 有了更加深入的了解，这样的实现过程可以帮助开发者在开发过程中更好的使用 promise 。如果希望能够实现一份完整的 promise，可以再仔细阅读一下下面的参考内容，并用 promise 的[测试用例](https://github.com/promises-aplus/promises-tests)来检验自己的实现结果。

**相关参考**
[Promise/A+ 规范](https://promisesaplus.com/)
[从零一步一步实现一个完整版的 Promise](https://juejin.im/post/5d59757f6fb9a06ae76405c6)
[微任务、宏任务与Event-Loop](https://juejin.im/post/5b73d7a6518825610072b42b)
