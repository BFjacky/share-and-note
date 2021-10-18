## 在Vue项目中实现权限控制管理
对于一般稍大一些的后台管理系统，往往有很多个人员需要使用，而不同的人员也对应了不同的权限系统，后端的权限校验保障了系统的安全性，而前端的权限校验则提供了优秀的交互体验。

### 校验方式
前端对用户的权限信息进行校验往往在两个方面进行限制
- 路由不可见
- 元素不可见

通过以上两个方式，来将用户权限之外的内容隐藏掉。

### 路由不可见实现方法
在router.js中的``meta``字段中加入该路由的访问权限列表``auths``字段。
```js
{
    path: 'edit',
    name: 'edit',
    meta: {
        title: '编辑账户',
        auths:['edit_account']
    },
    component: () => import('pathToComponent/component.vue'),
},
```
Vue.router中提供了导航守卫，我们这里使用`全局前置守卫`对路由跳转进行权限校验
``router.beforeEach(to,from,next)``
参数`to`是即将进入的路由对象，我们可以在对象中拿到之前在router.js中定义的`route`对象，并获得`auths`字段
```js
router.beforeEach((to,from,next)=>{
    const hasAuth = function(needAuths，haveAuths){     //判断用户是否拥有权限的function
        // implement 
    }
    const havaAuths = []; // 用户拥有的权限列表
    if(!hasAuth(to.meta.auths,haveAuths)){
        //没有权限重定位到其他页面，往往是401页面
        next({replace:true,name:'otherRouteName'})
    }
    //权限校验通过,跳转至对应路由
    next();
})
```
在有侧边栏的后台管理中，还需要对侧边栏的路由导航进行隐藏，这里同样是通过拿到``route.meta.auths``字段进行过滤。


### 元素不可见实现方法
因为某些页面中会有一些特殊的接口调用或数据展示受到权限控制显示。前端通过控制元素的展示来隐藏掉用户不具有权限的元素，避免点击了某一个button导致接口401报错这样不友好的交互体验。
全局注册一个[directive](https://cn.vuejs.org/v2/guide/custom-directive.html)。
```js
//acl.js
const aclDirective = {
    inserted:function(el,binding){ // 在被绑定的元素插入到dom中时
        const hasAuth = function(needAuths，haveAuths){ //判断用户是否拥有权限的function
            // implement 
        }
        const havaAuths = []; // 用户拥有的权限列表
        if(!hasAuth(binding.value,haveAuths)){ //binding.value 可以获得绑定指令时传入的参数
            el.style = "display:none"; //修改元素的可见状态
        }
    }
}
//main.js
Vue.directive('acl',aclDirective); //全局注册指令
```
在需要控制显示的组件上我们就可以通过``v-acl``进行权限控制
```html
<button v-acl="['edit_access']">编辑账户</button>
```