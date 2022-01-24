# WebGL 纹理创建与绑定

在 Webgl 中使用纹理图片大致上分为两个步骤过程:1、加载纹理资源 2、绑定纹理资源 3、在着色器中使用纹理资源

### 1、加载纹理资源

在 gl.texImage2D 中,可以作为纹理像素源的数据类型如下

- ArrayBufferView
- ImageData
- HTMLImageElement
- HTMLCanvasElement
- HTMLVideoElement
- ImageBitmap

以 ImageData 类型的数据为例:

```js
// 提前准备好一个 canvas 用于图片处理
const canvas = document.createElement('canvas')
const canvasContenxt = canvas.getContext('2d')

const imageHtmlElement = new Image()
imageHtmlElement.onload = function () {
  canvas.width = Math.floor(imageHtmlElement.width * rate)
  canvas.height = Math.floor(imageHtmlElement.height * rate)
  canvasContenxt.clearRect(0, 0, canvas.width, canvas.height)
  canvasContenxt.drawImage(
    imageHtmlElement,
    0,
    0,
    imageHtmlElement.width,
    imageHtmlElement.height,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  // 获取 imageData
  const imageData = canvasContenxt.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  )
}
imageHtmlElement.src = 'xxx' // 图片资源链接
```

**ImageBitmap 具有低延迟的特性,但是不可以读取其中的像素数据,同时在 safari 上的兼容性很差**

### 2、绑定纹理资源

这一步主要是通过 Webgl 中一系列的 API 将纹理资源上传的 Gpu 中,其实也就是将资源从 Cpu 的内存中移动到 Gpu 的内存中,好让 Gpu 在着色时能访问到纹理数据

```js
// 提前准备好一张图片资源,可以为 ImageElement
const image = new Image()

// 创建纹理
var texture = gl.createTexture()
gl.bindTexture(gl.TEXTURE_2D, texture)

// 设置一些参数,前两行是将图片显示方式设置为延伸,后两行是设置图片像素点的采样方式
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

// 将图像上传到纹理
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
```

### 3、在着色器中使用纹理资源

纹理资源最终会在片元着色器中被使用,根据插值生成的纹理坐标,提取纹理中的颜色.

```c#
// 纹理
uniform sampler2D u_image;

// 从顶点着色器传入的纹理坐标
varying vec2 v_texCoord;

void main() {
   // 在纹理上寻找对应颜色值
   gl_FragColor = texture2D(u_image, v_texCoord);
}
```

### 4、整体优化

绑定纹理到 GPU 的过程是比较耗时且消耗性能的,所以当绑定了一张纹理后,我们需要将所有使用到该纹理的角色绘制出来,避免重复绑定该纹理.

同时,为了减少执行 `gl.drawElements` 的次数,优化渲染性能,我们需要一次绑定尽可能多的纹理来绘制更多的角色

通过下面的方法我们可以获得在当前终端上同时可以绑定的最大纹理数量

```js
const maxTextureLimit = webglContext.getParameter(
  webglContext.MAX_TEXTURE_IMAGE_UNITS,
)
```

将多张纹理绑定到 GPU 后,我们还需要设计一种方法,能够在着色器中选择从哪张纹理上读取像素数据

为了实现同时绑定多张纹理到 GPU 中,首先需要
1、在片段着色器中声明 sampler2D 类型的 uniform List,其中 `<<<uSamplerLength>>>` 要根据当前硬件设备支持的最大纹理数量进行动态替换.

```c#
uniform sampler2D uSamplers[<<<uSamplerLength>>>]
```

2、需要确认当前渲染的顶点需要从哪张纹理上读取像素数据,需要在顶点着色器中声明属性`aTextureId`,并将该属性插值传入片元着色器中`vTextureId`,在片元着色器中根据 GPU 支持的最大纹理绑定数量动态插入一段代码来判断当前需要从哪张纹理读取像素数据.

```c#
vec4 textureColor;
if(vTextureId < 1.){
    textureColor = texture2D(uSamplers[0], vTextureCoord);
}else if(vTextureId < 2.){
    textureColor = texture2D(uSamplers[1], vTextureCoord);
}else if(vTextureId < 3.){
    textureColor = texture2D(uSamplers[2], vTextureCoord);
}else if(vTextureId < 4.){
    textureColor = texture2D(uSamplers[3], vTextureCoord);
}else if(vTextureId < 5.){
    textureColor = texture2D(uSamplers[4], vTextureCoord);
}else if(vTextureId < 6.){
    textureColor = texture2D(uSamplers[5], vTextureCoord);
}else if(vTextureId < 7.){
    textureColor = texture2D(uSamplers[6], vTextureCoord);
}else if(vTextureId < 8.){
    textureColor = texture2D(uSamplers[7], vTextureCoord);
}
```

3、准备好着色器程序之后,我们只需要将当前等待渲染的三角形按照绑定的纹理进行分类,将引用相同纹理的三角形进行批量绘制,减少绘制次数