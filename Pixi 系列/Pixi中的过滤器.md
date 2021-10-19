# Pixi 中的渲染过滤

PIXI 允许我们直接给被渲染的对象更新着色器，来实现自定义的渲染效果，这些功能在 PIXI.Filter 类下，并且 PIXI 为我们内置了一些常见的着色器用于更新渲染效果。

>这篇文章会对下面的这个「关羽」角色进行一系列特效渲染：

![image](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c137675a65b14bb8b82d47fc60450c38~tplv-k3u1fbpfcp-watermark.image)

### 内置过滤器

使用内置的过滤器可以避免编写着色器，下面这个内置的过滤器可以让渲染的对象变得模糊

```js
// 新建过滤器
const blurFilter = new PIXI.filters.BlurFilter()
blurFilter.blur = 5
const guanyuSprite = new PIXI.Sprite()
// 将过滤器添加到精灵上
guanyuSprite.filters = [blurFilter]
```

![image](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8d136a363fc94365bcb3360557419405~tplv-k3u1fbpfcp-watermark.image)

### 自定义过滤器

除了使用 PIXI 为我们内置的过滤器，我们还可以自定义过滤器，不过这需要一些着色器相关的知识，如果不太熟悉，也可以先抛开那部分内容，专注看一下 PIXI 中自定义过滤器的方法。

我们这次的过滤器只对片元着色器进行更改。

```js
const customFragShader = `
    precision highp float;   // 定义 GPU 运算时的浮点数精度
    varying vec2 vTextureCoord;   // 经过插值计算后的纹理单元坐标
    uniform sampler2D uSampler;   // 纹理单元编号
    uniform vec3 robeColor;       // 由着色器外部传入的长袍颜色
    void main(void) {
        vec4 activeFragColor = texture2D(uSampler, vTextureCoord);  // 获取当前片元对应的纹理颜色
        if( activeFragColor.r > (robeColor.r - 0.2) &&              
            activeFragColor.r < (robeColor.r + 0.2) &&
            activeFragColor.g > (robeColor.g - 0.2) &&
            activeFragColor.g < (robeColor.g + 0.2) &&
            activeFragColor.b > (robeColor.b - 0.2) &&
            activeFragColor.b < (robeColor.b + 0.2) ){              // 判断当前片元的纹理颜色是否符合长袍的颜色
            gl_FragColor = vec4(1.,activeFragColor);                // 将修改过的颜色赋值给当前片元
        }else{
            gl_FragColor = activeFragColor;                         // 将对应的纹理颜色赋值给当前片元
        }
    }
`
```

创建好片元着色器后，我们可以创建 PIXI 过滤器了：

```js
const customFilter = new PIXI.Filter(undefined, customFragShader) // 顶点着色器使用默认着色器
customFilter.uniforms.robeColor = new Float32Array([0.3, 0.5, 0.4]) // 将长袍的颜色值传到着色器中
```

下面可以看一下效果，通过修改片元着色器将角色身上绿色部分的片元渲染成了粉色。
![image](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6a590663d1a345f0a9ff2338cbf73b6a~tplv-k3u1fbpfcp-watermark.image)

着色器相关的内容需要相对系统地学习，如果暂时不理解也没有关系，可以先了解一下通过编写着色器我们能实现哪些效果。这个网站是一个在线着色器调试平台，同时也内置了大量的着色器作品 https://shaderfrog.com/app。

### 更复杂的自定义 PIXI 过滤器

除了上面这个简单的过滤器效果，我们还能够实现一些更加复杂的效果，需要进行相对多的计算，在开始前我们需要先了解一些 PIXI 为片元着色器内置的一些 `Uniform 变量`。

- `inputSize.x inputSize.y` 为片元着色器上使用的纹理的像素宽高
- `inputSize.z inputSize.w` 为 inputSize.x 和 inputSize.y 的倒数
- `outputFrame.x outputFrame.y` 为 DisplayObject 左上角在整个画布的像素位置
- `outputFrame.z outputFrame.w` 为 DisplayObject 的像素宽高
- `inputClamp x、y、z、w` 分别为左上角 和 右下角的纹理坐标

利用上面的内置变量，我们会实现下面的效果，给精灵加上一个简陋的影子 😊

![image](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6d96cd4bab904eeba27db08aca5fe59c~tplv-k3u1fbpfcp-watermark.image)

#### 实现阴影的方式

在现实世界或复杂的光照引擎中，影子的产生会受到点光源、平行光、环境光的影响，真实的世界中光源非常多且互相之间会产生复杂的影响，在这样的场景下对阴影的效果的计算也非常复杂，我们可以先模拟一个平行光源所产生的阴影，这是最简单的。

为了能够渲染精灵的阴影，过滤器所占用的渲染面积要大于精灵本身，所以我们要给过滤器加一个内边距，同时将内边距数值作为 `uniform 变量`传到着色器中。

```js
const shadowFilter = new PIXI.Filter(undefined, shadowFragmentShader)
shadowFilter.padding = 200
shadowFilter.uniforms.filterPadding = 200
```

下面是片元着色器的代码：

```c#
precision highp float;          // 定义 GPU 运算时的浮点数精度
varying vec2 vTextureCoord;     // 经过插值计算后的纹理单元坐标

uniform sampler2D uSampler;     // 纹理单元编号
uniform vec4 inputSize;         // PIXI 内置 uniform 变量
uniform vec4 outputFrame;       // PIXI 内置 uniform 变量
uniform vec4 inputClamp;        // PIXI 内置 uniform 变量
uniform float filterPadding;    // 过滤器内边距
void main(void) {
    vec4 activeFragColor = texture2D(uSampler, vTextureCoord);      // 获取当前片元对应的纹理颜色
    float verticleDistanceFromActiveFragToTextureBottom = (inputClamp.w - vTextureCoord.t) * inputSize.y - filterPadding;  // 获取当前片元位置距离角色底部的像素距离
    float horizontalDistance = verticleDistanceFromActiveFragToTextureBottom;   // 根据影子的斜度计算当前片元对应的精灵片元的水平距离（先固定斜度为 45度）
    float correspondingXCoord = ((vTextureCoord.s * inputSize.x) - horizontalDistance) / inputSize.x;  // 获取当前片元所对应的源头片元 X 坐标
    float correspondingYCoord =  vTextureCoord.t;   // 获取当前片元所对应的源头片元 Y 坐标
    vec2 correspondingCoord = vec2(correspondingXCoord, correspondingYCoord);
    vec4 correspondingFragColor = texture2D(uSampler, correspondingCoord);  // 获取源头片元的颜色值
    if(activeFragColor.a > 0.8){
        gl_FragColor = activeFragColor;   // 当前片元为精灵本体渲染的片元
    }else{
        if(correspondingFragColor.a > 0.8){     // 当前片元的源头片元为非透明的
            gl_FragColor = vec4(0.0,0.0,0.0,0.5);    // 设置当前片元的颜色值为影子的颜色
        }else{      // 当前片元的源头片元为透明的
            gl_FragColor = vec4(0.,0.,0.,0.);
        }
    }
}
```

一般情况下，当我们通过方程组来计算一些结果值之后，为方便使用和加快运算，会将其转换成矩阵。
```c#
mat2 shadowCoefficient = mat2(1 , 0. , inputSize.z * inputSize.y , 1.); 
vec2 shadowConstant = vec2(filterPadding * inputSize.z - inputSize.z * inputSize.y * inputClamp.w, 0.);
vec2 correspondingCoord = shadowCoefficient * vTextureCoord + shadowConstant;  // 通过矩阵运算计算出 correspondingCoord
```

### 总结
通过着色器能够实现非常复杂的渲染效果，PIXI 为自定义着色器预留了简单的实现方式，在 PIXI 的帮助下，我们省去了复杂的声明变量、绑定目标、链接着色器等等一系列繁琐、复杂的过程，专注于着色器本身的编写，用最短的时间实现最炫酷的效果～