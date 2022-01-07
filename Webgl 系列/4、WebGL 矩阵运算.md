# WebGL 矩阵运算

> 这一章的内容,需要线性代数作为前置知识,如果没有学习过或已经忘的差不多了,可以先去了解一下.

大学期间学习线性代数中的矩阵运算,总是无法理解为什么要设计这样的运算规则,没想到工作两年之后,居然会再次使用到大学期间学习的数学知识,而且搞懂了曾经的疑问.

### 理解矩阵运算

矩阵运算的本质是方程组的运算,假设我们有一组输入值 x1,x2,我们通过一系列方程元算后会得到一个组输出值 y1,y2.如下所示

```js
a1 * x1 + a2 * x2 = y1
a3 * x1 + a4 * x2 = y2
```

我们可以将上面的方程组转换成**矩阵乘以向量**的形式

```js
a1,a2     x1       y1
       X       =
a3,a4     x2       y2
```

通过矩阵运算,我们将一组输入值计算出输出的结果值,在 WebGL 中,矩阵运算的主要用途是计算顶点坐标值以及颜色值.

### 模型矩阵

模型矩阵将局部坐标系下的顶点坐标转化到世界坐标系下.为了方便使用角色的坐标,在角色身上,我们往往会以角色中心点为坐标原点建立平面直角坐标系,在这个坐标系下,角色左上点的坐标为{x:-1,y:1},右下点的坐标为{x:1,y:-1},如下面的代码所示:

```js
// 左上角顶点
this._points[0] = {
  x: -1,
  y: 1,
  z: this.position.z,
}
// 左下角顶点
this._points[1] = {
  x: -1,
  y: -1,
  z: this.position.z,
}
// 右下角顶点
this._points[2] = {
  x: 1,
  y: -1,
  z: this.position.z,
}
// 右上角顶点
this._points[3] = {
  x: 1,
  y: 1,
  z: this.position.z,
}
```

角色上局部坐标系最终需要向世界坐标系进行转换,这时便利用**模型矩阵 X 局部坐标**来得出世界坐标,其过程分为下面两步

```js
// 第一步: 计算模型矩阵
const spriteModelMatrix = this._renderer.matrixSystem.update2DSpriteModelMatrix(
  {
    size: this.size,
    rotation: this.rotation,
    position: this.position,
    xRange: 2,
    yRange: 2,
  },
)
// 第一步: 利用模型矩阵进行坐标变换
this._points.forEach((point) => {
  const newPoint = this._renderer.matrixSystem.transform2DSpritePoints({
    spriteModelMatrix,
    point,
  })
  point.x = newPoint.x
  point.y = newPoint.y
})
```

### 计算模型矩阵

在这里我们会使用一个库**gl-matrix**,可以方便的通过方法调用进行矩阵运算,同时其内部也预制了一些通用的矩阵,方便我们使用

```js
/**
 *
 * @param {*} obj
 * @property {number} obj.size.width  世界坐标系下宽度
 * @property {number} obj.size.height 世界坐标系下高度
 * @property {number} obj.rotation    世界坐标系旋转角度
 * @property {number} obj.position.x  世界坐标系中心点 X 坐标
 * @property {number} obj.position.y  世界坐标系中心点 Y 坐标
 * @property {number} obj.localSize.width   局部坐标系下宽度
 * @property {number} obj.localSize.height   局部坐标系下高度
 * @returns
 */
update2DSpriteModelMatrix({ size, rotation, position,localSize }) {
    const xScale = size.width / localSize.width
    const yScale = size.height / localSize.height
    // 缩放变换
    const scaleMatrix = mat3.fromScaling(mat3.create(), [xScale, yScale])
    // 平移变换
    const translationMatrix = mat3.fromTranslation(mat3.create(), [
        position.x / xScale,
        position.y / yScale,
    ])
    // 旋转变换
    const rotationMatrix = mat3.fromRotation(
        mat3.create(),
        Matrix.degreeToRad(rotation),
    )
    const matrix1 = mat3.multiply(
        mat3.create(),
        translationMatrix,
        rotationMatrix,
    )
    this.spriteModelMatrix = mat3.multiply(mat3.create(), scaleMatrix, matrix1)
    return this.spriteModelMatrix
}
```

对于局部坐标系上的**x1,y1**,我们想获取其世界坐标系上的坐标值**x2,y2**,需要跟着下面的变换思路一步步来:
1、若局部坐标系旋转*rotation*角度,我们需要将局部坐标系旋转*-rotation*角度使局部坐标系和世界坐标系平行,那么相应的将局部坐标系上的坐标点旋转*rotation*角度即可实现局部坐标系旋转*-rotation*角度的效果**rotationMatrix**
2、最后是平移变换,若局部坐标系原点相对于世界坐标系原点有*x,y*位移,那么需要将局部坐标系位移*-x,-y*来使局部坐标系与世界坐标系完全重合,相应的为将局部坐标系上的坐标位移*x,y*,由此得出平移变换矩阵**translationMatrix**
3、将局部坐标系的宽高由 **localSize** 转换为 **size**,相应的局部坐标系上的坐标值需要放大 size/localSize 的倍数,由此得到缩放变换矩阵**scaleMatrix**
4、最终进行新坐标的计算(**⚠️ 矩阵乘法不具备交换律**):
worldCoord = scaleMatrix _ translationMatrix _ rotationMatrix \* localCoord

### 视图矩阵

视图矩阵作用一句话简明表达就是世界坐标系转换到摄像机坐标系。在 2D 渲染中,一般不会有观察位置的变化,这里也先忽略掉这部分内容

### 投影矩阵

投影矩阵主要有正交投影和透视投影,在 2D 渲染中一般会用正交投影,正交投影的功能也比较简单,依然是一次坐标系的变化,由世界坐标系转换为 WebGL 舞台的坐标系,在 gl-matrix 为我们提供正交矩阵的计算,我们只需要传入相应的参数即可
**const orthoMatrix = mat4.orthoNO(mat4.create(), 0, this.stageWidth, 0, this.stageHeight, this.stageDepth, 0)**
其参数如下

```js
/**
 * Generates a orthogonal projection matrix with the given bounds.
 * The near/far clip planes correspond to a normalized device coordinate Z range of [-1, 1],
 * which matches WebGL/OpenGL's clip volume.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} left 视锥体左边界值
 * @param {number} right 视锥体右边界值
 * @param {number} bottom 视锥体底部边界值
 * @param {number} top 视锥体顶部边界值
 * @param {number} near 视锥体近截面
 * @param {number} far 视锥体远截面
 * @returns {mat4} out
 */
export function orthoNO(out, left, right, bottom, top, near, far) {}
```

正交投影实际上是一次平移变换+缩放变换,我们设视锥体的上下左右近远四个位置为(t,b,l,r,n,f)
平移变换做如下映射:
* (t+b)/2 映射到 0 => -(t+b)/2
* (r+l)/2 映射到 0 => -(r+l)/2
* (n+f)/2 映射到 0 => -(n+f)/2
缩放变换便是做如下映射:
* t-b 映射到 (1 - -1) => 2/(t-b)
* r-l 映射到 (1 - -1) => 2/(r-l)
* n-f 映射到 (-1 - 1) => 2/(f-n) **z轴上的映射与x、y轴不同是因为WebGL中默认使用左手坐标系,但一般进行图形化开发时,使用右手坐标系更多**

将其整理成矩阵后,由于先做了平移变化,还需要将平移变换的值与缩放变换的值相乘,最终得到的矩阵如下:
该矩阵是建立在 Webgl 采用左手坐标系的情况下建立的,即在z轴上,-1 指向屏幕外,1指向屏幕内
```js
export function orthoNO(out, left, right, bottom, top, near, far) {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);
  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = -2 * nf;
  out[11] = 0;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;
  return out;
}
```
经过正交矩阵的变换,我们已经可以讲空间里的坐标点映射到剪切空间中了

参考文章
**https://zhuanlan.zhihu.com/p/122411512**
