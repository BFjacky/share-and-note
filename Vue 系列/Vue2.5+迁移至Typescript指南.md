# Vue2.5+迁移至Typescript指南

## 为什么要迁移至Typescript
- Javascript本身是动态弱类型的语言，这样的特点导致了Javascript代码中充斥着很多``Uncaught TypeError``的报错，给开发调试和线上代码稳定都带来了不小的负面影响。
- Typescript提供了静态类型检查，使很多类型错误在编写时就已经发现，不会带到测试阶段。
- 同时，Javascript不定义model就可以使用一个对象，有人喜欢这样的灵活性，的确这样的语法在model不复杂的时候可以快速的开发出需要的功能，但一旦model庞大，找一个需要的属性值都不知道从何找起。而在Typescript中，我们需要使用TS中的``interface type``等方式先定义出model，才可以调用其属性值，所以Typescript极大的提高了代码的可读性。

## 可行性
因为TypeScript是JavaScript的超集，TypeScript 不会阻止 JavaScript 的运行，即使存在类型错误也不例外，这能让你的 JavaScript 逐步迁移至 TypeScript。所以可以慢慢地做迁移，一次迁移一个模块，选择一个模块，重命名.js文件到.ts，在代码中添加类型注释。当你完成这个模块时，选择下一个模块。

## 如何将已有的Vue项目迁移至Typescript



### 安装依赖
Vue官方提供了一个库[Vue-class-component](https://github.com/vuejs/vue-class-component)，用于让我们使用Ts的类声明方式来编写vue组件代码。[Vue-property-decorator](https://github.com/kaorun343/vue-property-decorator)则是在Vue-class-component的基础上提供了装饰器的方式来编写代码。首先我们需要在package.json中引入这两个依赖。

我的项目是基于vue-cli@3.X创建的，还需要在项目中引入``@vue/cli-plugin-typescript`` ``typescript``两个依赖来完成Typescript的编译。

### 配置tsconfig.json
在项目根目录新建``tsconfig.json``,并引入以下代码
```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "strict": true,
    "jsx": "preserve",
    "importHelpers": true,
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "sourceMap": true,
    "baseUrl": ".",
    "noFallthroughCasesInSwitch":true,
    "noImplicitAny":true,
    "noImplicitReturns":true,
    "noImplicitThis":true,
    "types": [
      "webpack-env"
    ],
    "paths": {
      "@/*": [
        "./app/common/*"
      ],
      "_app/*": [
        "./app/*"
      ],
      "_c/*": [
        "./app/common/components/*"
      ],
      "api/*": [
        "./app/service/*"
      ],
      "assets/*": [
        "./app/assets/*"
      ]
    },
    "lib": [
      "esnext",
      "dom",
      "dom.iterable",
      "scripthost"
    ],
  },
  "include": [      //  在此出填写你的项目中需要按照typescript编译的文件路径
    "app/**/*.ts",
    "app/**/*.tsx",
    "app/**/*.d.ts",
    "app/**/*.vue",
  ],
  "exclude": [
    "node_modules"
  ]
}
```
特别需要注意的是，现在的vue项目中大多使用了`webpack`的`alias`来解析路径,在tsconfig.json中需要配置``path``属性，让typescript同样认识在webpack中配置的路径别名。

### 添加全局声明文件
因为在ts文件中是无法识别vue文件的，所以需要在项目根目录新建``shims-vue.d.ts``文件，添加以下代码，来让ts识别vue文件。
```ts
import Vue from 'vue';

declare module '*.vue' {
  export default Vue;
}
```

### 由下而上的迁移
因为是迁移已经存在的项目，不建议开始就把`main.js`重命名为`main.ts`,对于绝大多数Vue项目，`main.js`引入了太多的依赖，我们应该首先从依赖着手，自下而上的迁移Typescript。对于项目中一些偏底层，甚至是框架维护者所提供的库函数，我们不关心其实现逻辑，所以没有必要将其改写为`ts`文件，只需要给其加`声明文件`供我们的业务代码调用即可。

在我的项目中，service层的逻辑非常简单，仅仅是传参数调用接口，没有添加任何其他的逻辑，逻辑如此简单其实没有什么必要改写为ts文件，所以我为service层的文件编写声明文件，来为调用service层的代码提供类型声明。

### 声明文件编写方法
一个js文件如下
```js
//service.js
import axios from '@/libs/api.request'
export default {
    /**
     * 创建账户
     * @param {Object} data
     * @param {String} data.accountType optinal
     * @param {String} data.username
     * @param {String} data.password
     * @param {String} data.gender X | F | M
     * @param {String} data.email
     * @param {Number} data.level
     */

    createAccount(data) {
        return axios.request({
            url: `/api/account/createUser`,
            method: 'post',
            data: data
        }).then((res) => [res, null]).catch((err) => [null, err]);
    },
}
```
可以看到，在使用typescript之前，对于一个函数的参数和返回值等信息的提示是通过`jsdoc`实现的，能够在调用时确定参数类型及名称，但`jsdoc`毕竟只是注释，并不能提供类型校验，所以在这里我们为其编写声明文件，编写后的声明文件如下
```ts
//service.d.ts
interface createAccountParams {
    accountType?: string,
    username: string,
    password: string,
    gender: 'X' | 'F' | 'M',
    email: string,
    level?: number
}
interface createAccountReturn {
    userId: string,
}
export interface Service {
    createAccount(data: createAccountParams): createAccountReturn
}
```
这样一个service层的接口文件的声明文件就编写完成了，我们往往在main.js中将service.js导出的实例绑定在了Vue原型上，使得我们可以在vue组件中通过vm.$service方便访问service实例。但是Typescript并不知道Vue实例上有什么属性，这时需要我们在之前添加的``shims-vue.d.ts``文件中添加几行代码。
```ts
import Vue from 'vue';
import Service from "pathToService/service.d.ts";

declare module '*.vue' {
  export default Vue;
}

declare module "vue/types/vue" {
  interface Vue {
    $service: Service
  }
}
```
得力于typescript中提供的模块补充功能，我们可以在node_modules/vue/types/vue中补充我们需要在Vue上提供的属性。

### 改写Vue文件
我们需要将原来的vue文件改写成使用``vue-property-decorator``编写的方式。
```html
<script lang="ts">
import {Component,Vue} from "vue-property-decorator";

@Component
export default class MyComponent extends Vue{
    // 声明data
    form: {
        accountType?: string,
        username: string,
        password: string,
        gender: 'X' | 'F' | 'M',
        email: string,
        level?: number
    } = {
        username:'',
        password:'',
        gender:'X',
        email:''
    };

    // 声明methods
    async submit(): void {
        //调用上面的service接口
        const [res,err] = await this.$service.createAccount(this.form);
    }
}
</script>
```

至此一个Vue项目迁移至Typescript的过程就已经完成了，剩下的工作就是将代码中其他的文件一步步由js迁移到typescript中。

### 把方法绑定到Vue实例下
除了我们之前提到过的将自己编写的``service``挂载到vue实例上，大家一定清楚在vue项目中，我们经常会调用``this.$refs`` ``this.$router`` ``this.$store``等等，typescript也会检查这些属性是否被绑定在了vue实例上，那么我们并没有在类型系统中声明这些值，按道理应该报``Property '$refs' does not exist on type [your_component_name]``
真相是``$refs`` ``vue-router`` ``vuex``都已经给我们声明了相应的类型，我们可以``cd ./node_modules/vue/types/``目录中去查看
截取少量代码如下所示:
```js
export interface Vue {
  readonly $el: Element;
  readonly $options: ComponentOptions<Vue>;
  readonly $parent: Vue;
  readonly $root: Vue;
  readonly $children: Vue[];
  readonly $refs: { [key: string]: Vue | Element | Vue[] | Element[] };
  readonly $slots: { [key: string]: VNode[] | undefined };
  readonly $scopedSlots: { [key: string]: NormalizedScopedSlot | undefined };
  readonly $isServer: boolean;
  readonly $data: Record<string, any>;
  readonly $props: Record<string, any>;
  readonly $ssrContext: any;
  readonly $vnode: VNode;
  readonly $attrs: Record<string, string>;
  readonly $listeners: Record<string, Function | Function[]>;
}
```
只要正常的在依赖中安装了``vue-router`` ``vuex``就已经通过**模块补充**的方式将类型添加到了vue实例上。

在一些项目中，``vue-router`` ``vuex``这些依赖不是通过安装在依赖中引入的，而是通过index.html引入的cdn资源文件，这样在开发过程中我们就无法获取其类型。
这个时候我们可以通过安装``@types``依赖的方式将类型系统补充到项目中,如``npm install @types/jquery --save-dev``。
不幸的是``vue-router``和``vuex``的types包已经废弃了，只能通过手动去github上下载对应版本的``vue-router`` ``vuex``将types文件引入到项目中，你可以像我一样在项目中新建一个types目录，引入需要的类型声明文件。
![](https://user-gold-cdn.xitu.io/2019/7/16/16bf9bb70f178a6b?w=387&h=296&f=jpeg&s=17005)
这样就可以直接在vue实例上访问到``$store`` ``$router``等属性了。
同理当你想要引入其他的组件库上的一些类型文件时，也是这样的方式。

### 一些需要注意的问题
在vue开发过程中我们会使用``this.$refs``去访问某一个具体实例的方法，但是这在ts中是访问不到的
常见的，比如要想要使用form组件中的validate方法，我们需要给其加上类型断言
``this.$refs.form.validate()``变为``(this.$refs.form as Vue & {validate:Function}).validate()``
来告诉编译器``this.$refs.form``上有``validate``方法。
因为类型断言前提条件是是当 S 类型是 T 类型的子集，或者 T 类型是 S 类型的子集时，S 能被成功断言成 T，所以需要在类型断言时合并Vue类型。

同时也可以通过``vue-property-decorator``提供给我们的装饰器一劳永逸的将该``refs``添加到``computed``属性上
```js
import { Vue, Component, Ref } from 'vue-property-decorator'
import Form from '@/path/to/another-component.vue'
@Component
export default class YourComponent extends Vue {
  @Ref() readonly form!: Form
}
```
等同于
```js
export default {
  computed() {
    form: {
      cache: false,
      get() {
        return this.$refs.form as Form
      }
    },
  }
}
```
这样我们就可以通过 ``this.form.validate()``来做表单校验了

### 新手容易遇到的一些问题
#### 疑问1：interface和type有什么区别？
type 可以声明基本类型别名，联合类型，元组等类型

eg.`type a = string;`是被允许的，

interface 会自动声明合并
```ts
interface person{
    gender:string
    age:number
}
interface person{
    name:string
}
```

#### 疑问2: 错误 Property 'hideContent' has no initializer and is not definitely assigned in the constructor.
`strictPropertyInitialization`属性会在`strict`设置为`true`时自动被设置为`true`。
但这个属性并不合理，它要求每个实例的属性都有初始值，我们在`tsconfig`将其设置为false就好了。

#### 疑问3: 赋值兼容性
```ts
interface person {
    name:string
    age:number
}
interface student {
    name:string
    age:number
    stuid:string
}
let person: person= {
    name:'name',
    age:1
}
let student: student = {
    name:'name',
    age:1,
    stuid:'stuid'
};

person = student  //这样是可以的
student = person  //这样不允许
```


>未完待续，欢迎补充