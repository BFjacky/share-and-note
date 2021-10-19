## 移动端适配 flexible rem 布局方案全面讲解

> 如果你看了很多篇文章，对 flexible 的解决方案一直还有一种不太了解的朦胧感觉，那么这篇文章会帮你从背景角度一步一步解析为何会有 flexible 这套解决方案，以及这套解决方案是如何作用的。

### 为什么不能直接用 px 进行布局

设计师基于 iphone6（375px 逻辑像素） 的页面尺寸给了你一个非常简单的设计稿
![iphone6.jpg](/img/bVby5e1)

你很快用如下的代码实现了，在 chrome 控制台打开 iphone6 查看效果，和设计稿丝毫不差。

```html
<div class="box1"></div>
<div class="box2"></div>
<style>
  .box1 {
    width: 100px;
    height: 100px;
    border: 1px solid red;
    position: fixed;
    left: 10px;
  }

  .box2 {
    width: 100px;
    height: 100px;
    border: 1px solid red;
    position: fixed;
    right: 10px;
  }
</style>
```

但是选则机型为 iphone5 时页面变成了这个样子。
![iphone5.jpg](/img/bVby5eS)
会发现在 iphone5 的页面下两个方块的间距和方块大小比起来变得非常小，这样我们认为这个网页在不同屏幕尺寸的手机上产生了不同的显示效果。
这个时候肯定有同学说了，那这个设计图我用 vw 去还原就好了。的确使用 vw 还原设计图是可以做到的，但 vw 目前的兼容性仍然有问题，测试很可能甩过来一个 vivo-x7 告诉你页面乱掉了。

### Flexible 是如何解决以上问题的

设计师在 375px ( iphone6 逻辑像素宽度 ) 的页面上画出了这个设计图，则该 100px 的方块在不同尺寸的手机上的大小实际应该为 `(100px/375px)*{屏幕逻辑像素宽度}`，然而我们不可能为每一种尺寸都在 css 上写一个 px 宽度。这时可以使用 rem，我们可以通过设置根节点的 font-size 来使不同尺寸的手机的 1rem 对应的 px 值不同。

上面的话读起来很绕，我写起来很绕，那么我将 100px 在 iphone5 和 iphone6 上的不同数值列个表
| 手机型号 | 逻辑像素宽度 | 根节点 font-size | rem 数值| px 数值|
| :------| :------ | :------ |:------ |:------ |
| iphone5 | 320 px| 64 px | (100/75) rem| (100/75)*64 px|
| iphone6 | 375 px| 75 px | (100/75) rem|(100/75)*75 px|

这样在 iphone6 的屏幕尺寸上以 100px 渲染出来的盒子大小才能在 iphone5 的屏幕尺寸上以相同的比例渲染出来，在 iphone5 上渲染宽度为 `(100/75)*64px == 85.33px`，所以 flexible 的源码中`refreshRem`函数就是在计算不同手机尺寸应当设置的`根节点 font-size`，如下所示。

```js
function refreshRem() {
  var width = docEl.getBoundingClientRect().width
  if (width / dpr > 540) {
    // 这里是为了适配 ipad 和 android 平板横屏的情况（请暂时无视这个 if 语句）
    width = 540 * dpr
  }
  var rem = width / 10 // 将屏幕宽度分为 10 份，每份为 1rem
  docEl.style.fontSize = rem + 'px'
  flexible.rem = win.rem = rem
}
```

### 著名的 1px 像素问题

如果读这篇文章同学在之前有读过其他地方的文章会认为我上面的解释是错误的，因为其他的文章在上面均使用的`屏幕物理像素`作为基准，并配合设置 `<viewport content="width=device-width,user-scalable=no,initial-scale=${scale}">` 实现,其实，如果没有 1px 像素的问题是不需要设置 `initial-scale` 的。在文章的前半部分着重讲解了如何用 rem 实现类似 vw 的效果，下面是关于 `1px` 像素问题的来龙去脉。

#### 什么是 1px 像素问题

首先需要区分 物理像素 和 逻辑像素，物理像素即为显示器上的最小显示单元，逻辑像素也就是 css 像素，是在网页上渲染时的最小单位。而物理像素与逻辑像素之比 (物理像素/逻辑像素) 称之为 dpr (device pixel ratio)，`iphone 5`的物理像素宽度为 640px，逻辑像素宽度为 320px，则 iphone5 的 dpr 为 2。意味着在 css 上写 1px 的宽度，在 iphone5 的显示屏幕上实际渲染了 2px 的物理像素，使得我们在 `dpr>=2` 的手机上设置 `border-width:1px` 看起来非常的粗。

#### 如何解决 1px 像素问题

为了解决这个问题，`flexible`对上面的方案进行了优化。将 `initial-scale` 设置为 `1/dpr`,这样 dpr 为 2 的手机就会将页面缩小至 1/2 显示，这个时候设置 `border-width:1px` 就真的是 1px 物理像素。但是不能因为这个修改影响其他地方的布局，其实解决方案也很简单，就是将`根节点的 font-size = font-size * dpr` ，来将布局大小放大回正常的样子（但实际不是这样写的，是因为当设置了 scale = 1/2 时，`documentn.documentElement.getBoundingClientRect().width` 取得逻辑像素值会增大至 2 倍，所以不需要额外进行 `根节点的 font-size = font-size * dpr`）。
```js
var width = docEl.getBoundingClientRect().width
var rem = width / 10 // 将屏幕宽度分为 10 份，每份为 1rem
docEl.style.fontSize = rem + 'px'
```
### 字体不能使用 rem，可能会出现小数
在 flexible 中有这样一行代码 `` docEl.setAttribute('data-dpr', dpr);``这样我们可以在自己的 css 中根据`data-dpr`来设置不同 dpr (可以理解为页面缩放比例) 下的字体大小
```css
[data-dpr='1'] .text{
    font-size: 12px;
}
[data-dpr='2'] .text{
    font-size: 24px;
}
[data-dpr='3'] .text{
    font-size: 36px;
}
```

### 上面设计图的正确还原方式
在你的浏览器中打开这段代码并在移动端不同机型上进行切换，会得到正确的设计图还原效果。
```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <script type="text/javascript" src="http://g.tbcdn.cn/mtb/lib-flexible/0.3.2/??flexible_css.js,flexible.js">
  </script>
  <title>Document</title>
</head>

<body>
  <div class="box1"></div>
  <div class="box2"></div>
  <style>
    .box1 {
      width: 2.666666666666667rem; // 100px ÷ 37.5px(375px设计稿上的根 font-size 大小) = 2.666666666666667rem ，使用 css 预处理器的可以写一个函数
      height: 2.666666666666667rem;
      border: 1px solid red;
      position: fixed;
      left: 0.2666666666666667rem;
      top: 0.2666666666666667rem;
    }

    .box2 {
      width: 2.666666666666667rem;
      height: 2.666666666666667rem;
      border: 1px solid red;
      position: fixed;
      right: 0.2666666666666667rem;
      top: 0.2666666666666667rem;
    }
  </style>
</body>

</html>
```

### Flexible 中源码的其他部分
希望看完这篇文章的你，再去这里再好好看一下源码的实现细节部分：[flexible 源码](https://github.com/amfe/lib-flexible/blob/master/src/flexible.js)