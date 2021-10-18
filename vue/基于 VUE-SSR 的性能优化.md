# 基于 VUE-SSR 的性能优化 

关于 SSR（全称 Server-side-render），每一个前端同学一定都很熟悉，我们知道 SSR 可以减少白屏等待时间，对 SEO 友好，容易被搜索引擎抓取到，但是我们该怎么写好一个 SSR 项目呢？下面这篇文章由一道著名的面试题为起点，带你一步一步揭开 SSR 的奥秘。

## 著名面试题：从浏览器中输入 URL 发生了什么。

这个过程简单概括为几大步：

1. DNS 解析
2. TCP 连接
3. 发送 HTTP 请求
4. 服务器处理请求并返回 HTTP 报文
5. 浏览器解析渲染页面

作为一个前端工程师我们应该关注 3、4、5。

浏览器发送 HTTP 请求前，会首先检查该资源是否存在缓存，有以下请求头、响应头作为缓存标识：Expires、Cache-Control、Last-Modified、if-Modified-Since、Etag、if-None-Match，下面来给他们分个类。

## 缓存分为强缓存、协商缓存两种

#### 强缓存
  当浏览器准备发送 Http 请求请求一条资源时，它检查之前曾经发过这条资源，而且这条资源当时的响应结果带了 Expires 这个响应头并设置了一个绝对的时间 `Expires: Wed, 21 Oct 2021 00:00:00 GMT`,这个时候浏览器一看，这条资源到 2021 年才过期呢，就不会发送请求了，而是直接取之前的返回结果。
  Expires 是 http1.0 时代的强缓存依据，在 http1.1 又补充了 Cache-Control 这个响应头作为强缓存依据，Cache-Control 的通常用法是 `Cache-Control: max-age=31600`，它表示资源有效时间，是一个相对的时间。Cache-Control 的存在解决了当服务器时间和客户端时间（浏览器的时间实际上是依赖系统时间的，而我们是能够随意修改系统时间的）不一致引发的问题，我们发出的 http 资源的强缓存依然有效，不会时间变长也不会变短。

#### 协商缓存

* Last-Modified If-Modified-Since (http1.0)
  一个请求响应时会返回一个响应头 Last-Modified 表示这个资源上次修改的时间,下次相同的资源请求会带上 If-Modified-Since 这个请求头，值和上次的 Last-Modified 相同，服务端通过判断 If-Modified-Since 这个时间是否是当前资源的最后修改时间来决定是否使用缓存。如果可以使用缓存就会以 304 状态码返回。
  这个方式有着和 Expires 响应头类似的弊病：强依赖系统时间，当系统时间发生变化时，这个 Header 所带来的缓存是否过期的信息将无法被信赖。

* Etag If-None-Match (http1.1)
  和上面的过程非常类似，服务端第一次返回资源时会生成一个资源的摘要，作为响应头 Etag 返回给客户端。
  客户端请求时通过 If-none-match 带上之前 Etag 的值，服务端来比较 If-none-match 和当前资源的摘要是否一致来判断是否命中缓存。

## Webpack 与浏览器缓存的配合

通过浏览器缓存机制我们可以极大的减少浏览器请求的资源量，加快页面的展现。在现代前端项目中，浏览器缓存机制往往是配合 Webpack 来实现的，我们一般通过 Webpack 对项目进行打包。在 Webpack 中核心配置主要有 entry、output、module、plugin，通过以下最基础的配置来对 Webpack 配置有一个基础的印象。

```js
const path = require('path')
const { ProgressPlugin } = require('webpack')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const VueLoaderPlugin = require('vue-loader/lib/plugin-webpack4')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const handler = (percentage, message, ...args) => {
  console.info('构建进度:', percentage)
}
module.exports = {
  mode: 'production', // 可选值有 'node' || 'development' || 'production' production 会设置 process.env.NODE_ENV = 'production' 并开启一些优化插件
  entry: './main.js', // Webpack 打包开始的入口文件
  output: {
    // 完成打包后的输出规则
    path: path.resolve(__dirname, 'dist/'), // 输出到当前目录的 dist 目录下
    filename: '[name].[hash].js' // 文件会按照 [name].[hash].js 的命名规则进行命名
  },

  /**
   * Webpack 只能够解析 Js 模块，当遇到非 Js 的模块、文件时，需要通过 loader 将其转换成 Js
   */

  module: {
    rules: [
      { test: /\.vue$/, use: 'vue-loader' }, // 将 Vue 文件转换为 html、css、js 三部分
      {
        test: /\.(css|less)$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'less-loader'] //  Less => Css => Js => 最后利用 MiniCssExtractPlugin.loader 抽离出 css 文件。
      },
      {
        test: /\.js$/,
        use: ['babel-loader'] // 利用 babel 将 ES 高版本代码编译为 ES5
      }
    ]
  },
  /**
   * Loader 的存在能够让 Webpack 识别并转换任何的代码，但是缺少在打包过程中对资源进行操作的方式，Plugin 通过 Webpack 内置的钩子函
   * 数给我们提供了强大的扩展性，我们可以利用 Plugin 做很多事情。
   */

  plugins: [
    new CleanWebpackPlugin(), // 在打包前清空 output 的目标目录
    new VueLoaderPlugin(), // 配合 Vue-loader 使用，将 Vue-loader 转换出 Js 代码重新根据 rules 配置的 loader 进行转换
    new HtmlWebpackPlugin({
      // 利用指定的 html 模版在构建结束后生成一个 html 文件并引入构建后资源。
      template: 'index.html'
    }),
    new MiniCssExtractPlugin({
      // 将本来内置在 Js 的样式代码抽离成单独的 css 文件
      filename: '[name].[hash].css',
      chunkFilename: '[id].[hash].css'
    }),
    new ProgressPlugin(handler) // 打印构建进度
  ]
}
```

通过以上 Webpack 配置构建后构建的结果如下所示
![img](https://static.yunfei.tech/static/img/webpack-result.jpg)
在构建结果中我们能够看到，我们的输出的文件都按照根据本次构建的 hash 生成了一个文件名称中带有 hash 的文件，利用这个 hash 我们可以使用浏览器的强缓存,通过配置 `Cache-Control: max-age={很大的数字}`来是我们的静态资源能够保留在浏览器中，当下一次构建时会生成新的 hash，不会因为缓存而导致 Web 应用无法更新。

> 想要学习 Webpack，可以看一看 [Webpack 文档](https://www.webpackjs.com/concepts/)，如果想要深入的学习 [编写一个插件](https://webpack.docschina.org/contribute/writing-a-plugin/) 是不可错过的。

## 利用 CDN 对静态资源进行加速

CDN 全称是 Content Delivery Network(内容分发网络)，它的作用是减少传播时延，找最近的节点。通过以上缓存的方式我们解决了重复请求资源的效率问题，但是当第一次请求资源时，这好几 Mb 的内容够用户加载好一会儿了，如果都是从服务器中发出，可想而知服务器的贷款压力有多大。
CDN 的存在帮我们解决了这个问题，CDN 的主要作用就是减轻源站（服务器）负载，通过部署在全球各地的节点返回数据。真正的 CDN 可能在某个地区的运营商都会有一个专门的节点。
![img](https://static.yunfei.tech/static/img/cdn.jpg)

我们将内容上传至 CDN 源站中，当第一次访问该资源的时候会进行 DNS 查询获得该域名的 CNAME 记录，然后对新的 CNAME 进行 DNS 查询会得到一个离用户访问最近的边缘服务器的 IP 地址，用户浏览器与边缘服务器建立 TCP 链接，将 HTTP 请求发送到边缘服务器，边缘服务器检查是否有该资源，如果没有该资源会进行回源，向上一级 CDN 服务器请求该资源，直至找到该资源并返回给边缘服务器，边缘服务器会缓存该资源，并返回给用户。当另一个用户访问到同一个边缘服务器时，就能很快的获取该资源。

## Vue-Spa 使首屏加载变慢

在解释为何 Vue-Spa 使首屏加载变慢前我们首先需要了解当浏览器请求到资源后是如何渲染资源的。

1. 浏览器请求到 HTML 文档并构建文档对象模型（DOM）
2. 浏览器加载样式文件，构建层叠样式表模型（CSSOM）
3. 在 DOM 和 CSSOM 构建后会生成渲染树，包括一切将要被渲染的对象，除了`<head> display:none`等不可见的标签
4. 根据渲染树会进行 layout 过程，确定每个元素的位置、大小等，并最终调用操作系统绘制在显示屏幕上。

如果我们直接请求一个 html 文件就是上面的过程，这个过程非常快，在几毫秒就可以完成。

但是得力与前端技术的发展，我们开发的大型 WEB 应用无法通过一个 Html 就能传给用户使用，我们在 Html 中引入了很多很多 Javascript 文件，并通过 Javascript 来渲染我们的应用。以 Vue-Spa 为例我们重新讲解这个渲染过程。

1. 浏览器请求到 HTML 文档并构建文档对象模型（DOM)
2. 浏览器加载样式文件，构建层叠样式表模型（CSSOM）
3. 在 DOM 和 CSSOM 构建后会生成渲染树，包括一切将要被渲染的对象，除了`<head> display:none`等不可见的标签
4. 根据渲染树会进行 layout 过程，确定每个元素的位置、大小等，并最终调用操作系统 API 绘制在显示屏幕上。

浏览器依然会走以上这四步过程，但是因为我们的 html 中除了一些 `<script> <link>`以外几乎是空的，所以是白屏状态。

5. 浏览器并行下载 script link 资源（如果首次访问，这个过程非常长，在网络环境不好的时候甚至会长达十几秒）
6. 浏览器启动 V8 引擎执行我们的 Js 代码，以 Vue 为例：
   - 6.1 创建 Vue 实例，通过 Vue 中的 Observer 将 Vue 实例中的 data 变成可响应的，利用 Dep 进行依赖收集，为每一个 Vue 实例生成一个 Render-watcher 好让数据变化时能够通知 Vue 进行渲染。
   - 6.2 渲染过程会首先生成 Virtual-Dom，然后通过时间复杂度为 O(n) 的对比算法和老的 Old Virtual-Dom 进行对比，并同时调用平台（浏览器）的渲染 Api 进行 打补丁（Patch）
7. 浏览器构建新的 DOM 和 CSSOM，并修改 render-tree 进行回流，最终会根据新的元素位置、大小调用操作系统 API 绘制在显示屏幕上。

可以看到 Vue-Spa 比直接渲染 Html 的方式多出了 5、6、7 步骤，并且多出了几倍的耗时。

所以就有了骨架屏的优化思路，在第一次返回的 Html 中不反悔白屏的空内容了，而是返回一个骨架屏或者 Loading 的图标，提示用户耐心等待，但这不是用户想要看到的，用户希望看到**内容**。

## Vue-SSR 如何优化首屏加载

> Vue.js 是构建客户端应用程序的框架。默认情况下，可以在浏览器中输出 Vue 组件，进行生成 DOM 和操作 DOM。然而，也可以将同一个组件渲染为服务器端的 HTML 字符串，将它们直接发送到浏览器，最后将这些静态标记"激活"为客户端上完全可交互的应用程序。这样我们首屏就能够看到一部分内容，而不是空白、或者 loading 提示了。

### 最简单的实现

Vue-ssr 通过 createRender() 方法生成一个 renderer 实例，利用 renderer 对象我们可以将 vue 实例转换为 html。

```js
const app = new Vue({
  template: `<div>Hello World</div>`
})

const renderer = require('vue-server-renderer').createRenderer()

renderer.renderToString(app, (err, html) => {})
```

### 面向生产环境 SSR 还需要解决哪些问题

我们依然需要满足一套代码能在 Server 端和浏览器端同时运行，官方给出了如下的流程图。
![](https://pic3.zhimg.com/v2-08daea42db8838ab4762f25b68dc743a_r.jpg)

根据上图，我们可以看到，我们编写通用的 Web 代码，使用 `Webpack` 通过 `entry-server` 和 `entry-client` 两个入口打包出 `server-bundle` 和 `Client-bundle`,服务端使用 `server-bundle`渲染出的 Html 与 `client-bundle` 进行混合最终共同运行在浏览器上。

在生产环境中我们不会调用 `createRenderer` 这个方法来进行服务端渲染，因为 Server 端的代码会依赖 Client 端代码，使得 Server 端会随着 Client 端的代码更新频繁重启。在生产环境中我们使用 `createBundleRenderer` 来进行服务端渲染，也就是上图所用的流程。

#### 第一步、编写通用的 app.js

用户与客户端的关系是一对一，而与服务器的关系是多对一，所以不能像 Spa 那样使用一个单例的 Vue 实例，会造成不同用户之间的数据共享，我们首先要将之前的单例模式更改为工厂函数，动态生成`Vue` `Vue-router` `Vuex` 实例。

```js
import Vue from 'vue'
import App from './App.vue'
import { createRouter } from './router' // 背后是 new Router()
import { createStore } from './store' // 背后是 new Vuex.store()

export const createApp = () => {
  const router = createRouter()
  const store = createStore()
  const app = new Vue({
    router,
    store,
    render: h => h(App)
  })
  return { app, router, store }
}
```

#### 第二步、编写 entry-server、entry-client 两个入口文件

两个入口文件对应打包出得 bundle 文件分别执行不同的职责：

- 服务器端：仅在服务器端执行，将 Vue 实例渲染为 html 字符串，注入到模板页的对应位置中
- 客户端：仅在浏览器端执行，向模板页中注入 js、css 等静态资源
  具体解释看代码注释。

```js
// entry-server.js
import { createApp } from './app'
export default context => {
  // 因为有可能会是异步路由钩子函数或组件，所以我们将返回一个 Promise，
  // 以便服务器能够等待所有的内容在渲染前，
  // 就已经准备就绪。
  return new Promise((resolve, reject) => {
    const { app, router, store } = createApp() // 创建新的 Vue、Vue-router、Vuex 实例
    const { url } = context // context 是 Server 端传过来请求上下文，我们通过这个对象取出请求的 url
    router.push(url).catch(err => {
      // 将服务端的 Vue-router 的路径修改为 url
      reject(err)
    })

    // 等到 router 将可能的异步组件和钩子函数解析完
    router.onReady(() => {
      const matchedComponents = router.getMatchedComponents() // 获取当前路由匹配到的 Vue 组件实例
      if (!matchedComponents.length) {
        // 没有匹配到则抛出错误
        return reject({ code: 404 })
      }

      Promise.all(
        matchedComponents.map(
          // 运行匹配组件的 asyncData 钩子函数进行数据预取，并将预取的数据放在 Vuex 中。
          ({ asyncData }) =>
            asyncData &&
            asyncData({
              store,
              route: router.currentRoute
            })
        )
      )
        .then(() => {
          context.state = store.state // 将 vuex 的 state 赋值给 context.state ，最终将自动序列化为 window.__INITIAL_STATE__，并注入 HTML。
          resolve(app) // 返回 数据预取后的 Vue 实例
        })
        .catch(reject)
    })
  })
}
```

```js
// entry-client.js
import { createApp } from './app'
const { app, router, store } = createApp() // 创建新的 Vue、Vue-router、Vuex 实例

if (window.__INITIAL_STATE__) {
  // 将服务端预取的数据赋值给客户端的 vuex。
  store.replaceState(window.__INITIAL_STATE__)
}
router.onReady(() => {
  // 添加路由钩子函数，用于处理 asyncData.
  // 在初始路由 resolve 后执行，
  // 以便我们不会二次预取(double-fetch)已有的数据。
  // 使用 `router.beforeResolve()`，以便确保所有异步组件都 resolve。
  router.beforeResolve((to, from, next) => {
    // 我们只关心之前没有渲染的组件，所以我们对比它们，找出两个匹配列表的差异组件
    const matched = router.getMatchedComponents(to)
    const prevMatched = router.getMatchedComponents(from)
    let diffed = false
    const activated = matched.filter((c, i) => {
      return diffed || (diffed = prevMatched[i] !== c)
    })

    // 因为此时客户端 bundle 接管服务端渲染的 html，已经变成了一个单页应用，我们可以在代码中进行 router.push 来实现虚拟路由跳转，但是代码中不会执行 asyncData 数据预取这部分逻辑，所以这里我们要将新的组件中的 asyncData 拿出来执行。
    const asyncDataHooks = activated.map(c => c.asyncData).filter(_ => _)
    if (!asyncDataHooks.length) {
      return next()
    }
    Promise.all(asyncDataHooks.map(hook => hook({ store, route: to })))
      .then(() => {
        next()
      })
      .catch(next)
  })

  // 服务端渲染出得 html 在浏览器渲染后，会有一个 `data-server-rendered="true"` 的标记，标明这部分 Dom 是服务端渲染的，浏览器端的代码准备好后就会接管这部分 Dom，使其重新变为一个单页应用。
  app.$mount('#container')
})
```

#### 第三步、打包环境配置

我们需要在配置文件中生成两份配置文件分别为 `webpack.server.conf.js` `webpack.client.conf.js`

```js
const VueSSRServerPlugin = require('vue-server-renderer/server-plugin')

// webpack.server.conf.js 主要是和客户端构建不同的地方
module.exports = {
  // 这允许 webpack 以 Node 适用方式(Node-appropriate fashion)处理动态导入(dynamic import)，并且还会在编译 Vue 组件时，告知 `vue-loader` 输送面向服务器代码(server-oriented code)。
  target: 'node',

  // 入口文件为 entry-server.js
  entry: path.resolve(__dirname, '../code/client/src/entry-server.js'),

  // 此处告知 server bundle 使用 Node 风格导出模块(Node-style exports)
  output: {
    filename: 'server-bundle.js',
    libraryTarget: 'commonjs2'
  },

  // 因为 Node 可以依赖 node_modules 运行，所以不需要打包 node_modules 中的依赖，外置化应用程序依赖模块，可以使服务器构建速度更快，并生成较小的 bundle 文件。
  externals: nodeExternals({
    // 不要外置化 webpack 需要处理的依赖模块。你可以在这里添加更多的文件类型。例如，未处理 *.css 文件，
    whitelist: /\.css$/
  }),
  plugins: [
    // 这是将服务器的整个输出,构建为单个 JSON 文件的插件,默认文件名为 `vue-ssr-server-bundle.json`
    new VueSSRServerPlugin()
  ]
}
```

```js
// webpack.client.conf.js
const VueSSRClientPlugin = require('vue-server-renderer/client-plugin')

module.exports = {
  entry: {
    app: path.resolve(__dirname, '../code/client/src/entry-client.js')
  },
  plugins: [
    // 这是将客户端的整个输出,构建为单个 JSON 文件的插件,默认文件名为 `vue-ssr-client-manifest.json`
    new VueSSRClientPlugin()
  ]
}
```

通过 Vue 官方提供的 `vue-server-render/server-plugin` `vue-server-render/client-plugin` 两个插件我们在构建完成后生成了 `vue-ssr-server-bundle.json` `vue-ssr-client-manifest.json`。

- vue-ssr-server-bundle.json 里的内容为：

```json
// 这里的entry和files参数是vue-ssr-server-bundle.json中的entry和files字段，分别是应用的入口文件名和打包的文件内容集合。
{
  "entry": "server-bundle.js",
  "files": {
    "server-bundle.js": "module.exports=xxx..."
  }
}
```

- vue-ssr-client-manifest.json 里的内容为:

```json
{
  "publicPath": "/client/",
  "all": [                              // 客户端打包生成的全部资源文件
    "index.html",
    "static/js/app.7825d6691cb956e176c7.js",
    "static/js/manifest.ec516eefca3b4e60fa2e.min.js",
    "static/js/vendor.5c495484f630d50d4de0.js"
  ],
  "initial": [                          // 会以 preload 的形式插入到服务端生成的 html 中的资源文件
    "static/js/manifest.ec516eefca3b4e60fa2e.min.js",
    "static/js/vendor.5c495484f630d50d4de0.js",
  ],
  "async": [                            // 会以 prefetch 的形式插入到服务端生成的 html 中的资源文件
     "static/js/app.7825d6691cb956e176c7.js"
  ],
  "modules": {      // 项目的各个模块包含的文件的序号，对应all中文件的顺序
    "25965440": [
      3
    ],
    ...
  }
}
```

我们会在这里调用这两个文件，来生成服务端渲染的 html。

```js
const { createBundleRenderer } = require('vue-server-renderer')
const serverBundle = require('path-to-vue-ssr-server-bundle.json/vue-ssr-server-bundle.json')
const clientManifest = require('path-to-vue-ssr-client-manifest.json/vue-ssr-client-manifest.json')
const renderer = createBundleRenderer(serverBundle, {
  clientManifest
})
```

#### 第四步、起一个 Node 服务

监听 Http 请求并调用 renderer.renderToString 生成 html 返回给客户端

```js
const Koa = require('koa')
const koaRouter = require('koa-router')
const { createBundleRenderer } = require('vue-server-renderer')
const serverBundle = require('path-to-vue-ssr-server-bundle.json/vue-ssr-server-bundle.json')
const clientManifest = require('path-to-vue-ssr-client-manifest.json/vue-ssr-client-manifest.json')

const app = new Koa()
const router = koaRouter()

const renderer = createBundleRenderer(serverBundle, {  // 利用 serverBundle 和 clientManifest 生成 renderer
  clientManifest
})

const renderData = function(context) {
  // 包装 renderToString 方法
  return new Promise((resolve, reject) => {
    renderer.renderToString(context, (err, html) => {
      if (err) {
        return reject(err)
      }
      resolve(html)
    })
  })
}

router.get('*', async (ctx, next) => {
  let html
  try {
    html = await renderData(ctx)
  } catch (e) {
    if (e.code === 404) {  // 处理渲染的异常情况
      status = 404
      html = '404 | Not Found'
    } else {
      status = 500
      html = '500 | Internal Server Error'
    }
  }
  ctx.body = html // 返回构建的 html
})

app.use(router.routes()).use(router.allowedMethods())

app.listen(3000)
```

#### 一些其它的细节问题

在服务端渲染中，Vue 实例的生命周期只会执行 `beforeCreate` `created` 两个生命周期，在这两个生命周期要注意区分是在 server 环境还是在 浏览器环境，会占用全局内存的逻辑，如定时器、全局变量、闭包等，尽量不要放在 beforeCreate、created 钩子中，否则在 beforeDestory 方法中将无法注销，导致内存泄漏。

### SSR 性能优化

SSR 项目比 SPA 项目要占用更多的服务器资源用于`数据预取`与`html 渲染`，比较耗费 CPU 资源和网络资源，

#### 1、开启 Node 多进程

Node.js 虽然是单线程模型，但是其基于事件驱动、异步非阻塞模式，可以应用于高并发场景，避免了线程创建、线程之间上下文切换所产生的资源开销。但是却遇到大量计算，CPU 耗时的操作，则无法通过开启线程利用 CPU 多核资源，但是可以通过开启进程的方式，来利用服务器的多核资源。

- 通过 cluster 模块开启多进程
  cluster 管理多进程的方式为 主-从 模式，master 进程负责开启、调度 worker 进程，worker 进程负责处理请求和其他实际的 server 逻辑。

```js
const cluster = require('cluster')
const http = require('http')
let cupsLength = require('os').cpus().length

if (cluster.isMaster) {
  while (cupsLength--) {
    cluster.fork() // 复制出其他的 worker 进程
  }
} else {
  // 执行端口监听的逻辑。
}
```

- 通过 pm2 开启多进程
  pm2 也是使用了 Node.js 的 cluster 来做进程管理，但对于开发者来说更加友好，我们可以通过 pm2 清晰地看见整个集群的模式、状态，CPU 利用率甚至是内存大小。

```sh
pm2 start index.js -i max
```

#### 2、开启缓存

缓存可以利用 vue-ssr 提供的页面级缓存和组件缓存两种

* 页面级缓存：在创建 render 实例时利用最近最少使用算法来缓存当前请求的资源。

```js
const LRU = require('lru-cache')

const renderer = createRenderer({
  cache: LRU({
    max: 10000,
    maxAge: ...
  })
})
```

* 组件级缓存：可缓存组件还必须定义一个唯一的 name 选项。通过使用唯一的名称，每个缓存键 (cache key) 对应一个组件。如果 renderer 在组件渲染过程中进行缓存命中，那么它将直接重新使用整个子树的缓存结果。

```js
export default {
  name: 'item', // 必填选项
  props: ['item'],
  serverCacheKey: props => props.item.id,
  render(h) {
    return h('div', this.item.id)
  }
}s
```

* 利用 Redis 进行缓存：当我们将 SSR 应用程序部署在多服务、多进程下时，以上缓存方式的效果就大打折扣，因为每次请求被一个进程处理时，该进程可能并没有缓存过这条资源，但是其他的进程却缓存过多次，这样会导致缓存命中大打折扣，我们可以起一个 Redis 服务，专门用来存储需要缓存的资源。以下是利用 Redis 时首次渲染和第二次命中缓存渲染的时间：
   ![](https://static.yunfei.tech/static/img/blog_redis_time.jpeg)
- 首次加载因为缓存中没有数据，便会进行接口请求、数据库查询进行数据预取 耗时 263 ms，渲染耗时 10 ms。
- 第二次加载命中 redis 缓存不再需要数据预取和渲染，只花了与 redis 数据库通信的时间 2ms。

#### 3、 降级处理
当我们遇到大量的请求时，服务器压力过大或渲染出错时我们需要抛弃服务端渲染该用客户端渲染。

* 单次渲染降级
当某次请求的服务端渲染出错时，停止服务端渲染，并将 SPA 应用的 HTML 模板返回给用户。

* Cpu 压力过大降级
可以通过 Node 的 `os.loadavg()` 来获取最近 1 分钟的 cpu 占用率，当发现 Cpu 使用率过高时可以降级为 Spa 应用。


>最后，双手奉上开箱即用的 Demo 吧：[Vue-ssr 模版](https://github.com/BFjacky/vue-ssr-template)
