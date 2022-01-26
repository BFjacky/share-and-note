# Babel

> 在 Babel 使用上的一些总结

babel 做代码转译主要进行两部分工作,
1、对 es6+ 的代码语法的转换,如 ()=> ; {...obj} ;
2、对 es6+ 的新 API 的支持,如 Array.prototype.includes

<!-- 上面的第一部分功能通过 plugin 进行转换,第二部分功能通过引入core-js(polyfill)进行全局的修改来支持或进行代码的动态替换. -->

### 代码语法替换

对不支持的语法进行替换,需要依赖 babel 中提供的插件,如`@babel/plugin-proposal-object-rest-spread`,能够对对象扩展元素符进行替换.babel 提供了预设插件机制 preset，preset 中可以预设置一组插件来便捷的使用这些插件所提供的功能。目前，babel 官方推荐使用@babel/preset-env 预设插件.@babel/preset-env​ 主要的作用是用来转换那些已经被正式纳入 TC39 中的语法。所以它无法对那些还在提案中的语法进行处理，对于处在 stage 中的语法，需要安装对应的 plugin 进行处理。

### ES6+API 支持

对 ES6+ 的 API 进行支持有两种方式

#### 1. 引入 polyfill

引入 polyfill 会对全局环境的一些类的原型进行修改,来支持在一些浏览器上本不支持的方法,如 `Array.prototype.includes`,那我们怎么判断在项目中需要引入哪些 polyfill 呢?有两种方式:

- 自动引入
  在 `babel.config.js` 中我们可以将 `useBuiltIns` 属性设置为 `usage`,如下,当设置了 `useBuiltIns` 为 `usage` 时需要同步设置 corejs 版本.这种配置方式会自动在经过 babel 转译的文件中引入所需的 polyfill.

```js
module.exports = [
  '@babel/preset-env',
  {
    useBuiltIns: 'usage',
    corejs: 3, // 也可配置成 2
  },
]
```

- 手动引入
  在 `babel.config.js` 中我们可以将 `useBuiltIns` 属性设置为 `entry`, `@babel/preset-env` 将会根据目标环境直接引用特定的模块,我们需要首先将 `core-js/stable` & `regenerator-runtime/runtime` 引入到代码中
  ```js
  import 'core-js/stable'
  import 'regenerator-runtime/runtime'
  ```
  它会被替换为
  ```js
  require('core-js/modules/es.symbol.js')
  require('core-js/modules/es.symbol.description.js')
  require('core-js/modules/es.symbol.async-iterator.js')
  require('core-js/modules/es.symbol.has-instance.js')
  require('core-js/modules/es.symbol.is-concat-spreadable.js')
  // ...
  ```

基于引入 polyfill 进行的转译会对全局对象进行污染替换,下面是另一种方式,不会对全局产生影响

#### 2. 动态替换

利用 @babel/runtime, runtime 的核心思想是以模拟替换的方式来解决兼容性问题。
需要配合使用`@babel/runtime-corejs3`&`@babel/plugin-transform-runtime`,这种情况下需要安装 `@babel/runtime-corejs3`,并且需要安装到 dependencies 中.babel 配置需要做如下变动:

```js
const plugins = [
  [
    '@babel/plugin-transform-runtime',
    {
      corejs: 3,
    },
  ],
]
```

同样对这两行代码进行编译:
```js
const a = [1, 3].includes(1)
const ab = () => {}
```
编译后的输出:
```js
"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");

var _includes = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/includes"));

var _context;

var a = (0, _includes["default"])(_context = [1, 3]).call(_context, 1);

var ab = function ab() {};
```
可以看到动态替换方式是将 includes 方法做了替换


### core-js@3 && core-js-pure@3
* core-js@3 污染全局的 polyfill 包，供@babel/preset-env 使用
* core-js-pure@3 不污染全局的 runtime 包，供@babel/runtime-corejs3 使用，在安装@babel/runtime-corejs3 的时候自动安装


### loose 模式
loose 模式会将转译后的代码更像用 es5 手写的代码,但是在实现上有不符合 es6 规范的地方


### useBuiltIns 不同参数区别
如果我们没有将 env preset 的 "useBuiltIns" 选项的设置为 "usage" ，就必须在其他代码之前 require 一次完整的 polyfill。

- useBuiltIns: usage 代码中不用主动 import，babel 会自动将代码里已使用到的且 browserslist 环境不支持的 polyfill 导入。
- useBuiltIns: entry 需要在代码运行之前导入，会将 browserslist 环境不支持的所有 polyfill 都导入。这样 babel 就只会在入口处导入所有 polyfill，不会在代码再单独添加 polyfill 代码。
- useBuiltIns: false 只做了语法转换，不会导入任何 polyfill 进来，并且 corejs 配置将无效。


### 总结

目前，babel 处理兼容性问题有两种方式：
1. 引入 polyfill
2. 动态替换

两种方案一个依赖核心包 core-js，一个依赖核心包 core-js-pure，两种方案各有优缺点：

引入 polyfill 很明显的缺点就是会造成全局污染，注入冗余的代码；优点是可以根据浏览器对新特性的支持度来选择性的进行兼容性处理；
动态替换的方式解决了 polyfill 方式的缺点，但是不能根据浏览器对新特性的支持度来选择性的进行兼容性处理，也就是说只要在代码中识别到的 api，并且该 api 也存在 core-js-pure 包中，就会自动替换，这样一来就会造成一些不必要的转换，从而增加代码体积。

所以，polyfill 方式比较适合业务项目，动态替换方式比较适合 npm 包的开发.
