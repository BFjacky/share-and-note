# PIXI 中的模型矩阵

在 Pixi 中我们可以找到 packInterleavedGeometry 这个方法，这个方法会对本次渲染所需的 attributes 进行赋值，其中包括了待渲染元素的顶点坐标、顶点索引、透明度、纹理单元 ID 这些信息，通过读取 vertexData 我们可以找到向顶点着色器传入的顶点信息。
![image](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/03225ecbcca747609b07822fa38583e0~tplv-k3u1fbpfcp-watermark.image)
这个渲染出的关公角色对应的四个顶点坐标是 `[0, 0, 212, 0, 212, 247, 0, 247]`,这个顶点坐标就是在 Pixi 坐标系下精灵矩形四个顶点的位置，Pixi 会将这个顶点数据传入顶点着色器中进行渲染，但 Webgl 中的坐标系为 x 轴、y 轴均为 [-1，1],所以在顶点着色器中需要进行坐标系转换，才能正确使用这些顶点的位置，用于坐标系转换的矩阵也称为模型矩阵。
![image](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9f379a7e5c2a444dbbc945ac4d43befc~tplv-k3u1fbpfcp-watermark.image)

```c#
//顶点着色器代码：
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;

void main(void)
{
    gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
}
```
在上方的顶点着色器的代码中，对传入的顶点位置进行了坐标转换，`projectionMatrix`便是其中的模型矩阵，我们可以找一找它赋值的地方。

```ts
// 计算 projectionMatrix 的函数
function calculateProjection(
  _destinationFrame: Rectangle,
  sourceFrame: Rectangle,
  _resolution: number,
  root: boolean,
): void {
  const pm = this.projectionMatrix
  const sign = !root ? 1 : -1

  pm.identity()

  pm.a = (1 / sourceFrame.width) * 2
  pm.d = sign * ((1 / sourceFrame.height) * 2)

  pm.tx = -1 - sourceFrame.x * pm.a
  pm.ty = -sign - sourceFrame.y * pm.d
}
```

在 `calculateProjection` 方法中会根据当前舞台的大小和坐标偏移计算出顶点着色器中的模型矩阵，在这个 800 \* 800 的坐标系下, projectionMatrix 的值为：

```js
projectionMatrix = {
  a: 0.0025, // x scale
  b: 0, // y skew
  c: 0, // x skew
  d: -0.0025, // y scale
  tx: -1, // x translation
  ty: 1, // y translation
  array: null, // 转换为 Float32Array 后的值
}
```

`projectionMatrix.a(x scale) & projectionMatrix.b(y scale)` 分别为将当前 pixi 坐标系转换成 webgl 坐标系所需的缩放倍数
`projectionMatrix.b(y skew) & projectionMatrix.c(x skew)` 分别为 Y 轴方向和 X 轴方向的斜切变换系数（通过这个参数可以实现渲染目标的倾斜效果，可以理解为当 Y 轴或 X 轴并非垂直或水平的时候所需要的坐标系变换参数）

通过下面的方程组可以将 pixi 上渲染目标的坐标位置转换成 webgl 的坐标位置。

```js
webglVertex.x =
  projectionMatrix.a * pixiVertex.x +
  projectionMatrix.c * pixiVertex.y +
  projectionMatrix.tx
webglVertex.y =
  projectionMatrix.d * pixiVertex.y +
  projectionMatrix.b * pixiVertex.x +
  projectionMatrix.ty
```

webglVertex 就是最终在 webgl 应该渲染的坐标位置。但为了方便、快速的在顶点着色器中进行计算，还需要将方程组转换成矩阵运算：
转换成矩阵的方式如下图所示：
![image](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7588c7fc7ad041eb82c4f805fa54c256~tplv-k3u1fbpfcp-watermark.image)
借助上面的示例我们可以将方程组转换为下面的矩阵运算：

```js
[a, c, tx    [pixiVertex.x,
 b, d, ty  *  pixiVertex.y,
 0, 0, 1]          1      ]
```

在 Matrix 类中也有一个将当前的 Matrix 数据转换成 projectionMatrix 的方法，这个方法就是将模型矩阵存入 Float32Array 的数组中，最后这个数组会作为模型矩阵数据被传入顶点着色器。

```js
toArray(transpose: boolean, out?: Float32Array): Float32Array
{
    if (!this.array)
    {
        this.array = new Float32Array(9);
    }
    const array = out || this.array;
    array[0] = this.a;
    array[1] = this.b;
    array[2] = 0;
    array[3] = this.c;
    array[4] = this.d;
    array[5] = 0;
    array[6] = this.tx;
    array[7] = this.ty;
    array[8] = 1;
}

```

### 总结

在这部分内容中涉及到了 PIXI 中两个比较重要的工具类和 PIXI 中一个核心插件类 ProjectionSystem

- PIXI.Matrix
  PIXI.Matrix 作为渲染所使用的模型矩阵的矩阵基类，在矩阵中包含了投影变换过程中坐标的缩放、倾斜、平移，通过这些参数也就可以实现任意两个二维坐标系上的坐标转换，一般情况下 Matrix 主要供 Pixi 内部使用，或用来作为构造 Transform 的参数。
- PIXI.Transform
  PIXI.Transform 主要作为坐标系的变换，往往由调用方来设置，Pixi 内部会将 Transform 的效果叠加到模型矩阵中。
- PIXI.ProjectionSystem
  PIXI.ProjectionSystem 主要用于管理、更新模型矩阵，并将最新的模型矩阵传递到着色器中。
