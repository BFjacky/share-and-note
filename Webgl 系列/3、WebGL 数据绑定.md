# WebGL 数据绑定

### 数据抽象

在 2D 渲染中,我们需要绘制一个矩形,并赋予它一张图片,由于 WebGL 绘制的最小单元是三角形,首先我们需要抽象出一个三角形类(BaseTriangle).

#### 三角形类

在三角形类中输入数据为三个点的数据,每个点的数据结构如下:

```js
{
    x, // 点 X 坐标
    y, // 点 Y 坐标
    z, // 点 Z 坐标
    color, // 点的颜色,用于颜色插值
    texture, // 该点绑定的纹理
    textureCoord, // 若有纹理,该点的纹理坐标
}
```

并根据上面的原始内容,生产一个 **webglData** 方便进行数据绑定

```js
this._webglData = {
  verticles: {
    data: verticles, // 数据
    attribute: 'apos', // 属性名称
    countPerVerticle: 3, // 该属性每个顶点的值的数量,对应着色器中的向量 vec3
    bytePerValue: 4, // 该属性每个值所占的字节数
  },
  textureCoord: {
    data: textureCoord,
    attribute: 'aTextureCoord',
    countPerVerticle: 2,
    bytePerValue: 4,
  },
  colors: {
    data: colors,
    attribute: 'a_color',
    countPerVerticle: 4,
    bytePerValue: 1,
  },
  ...
}
```

### 精灵类

每个 2D 精灵是由通过两个三角形来渲染的,同时精灵类的输入数据应该更加符合调用方的理解
通过 position(位置)\size(大小)\rotation(自转角度) 来确定一个精灵四个顶点的物理坐标,通过 texture 属性来确定覆盖在精灵上面的纹理.

```js
  constructor({ position, size, rotation,texture }) {
    this.position = position // {x,y}
    this.size = size // {width,height}
    this.rotation = rotation // 一般以逆时针为正角度方向(平面坐标系 x 轴正方向)角度 0~360
    this.texture = texture
  }
```

在 Sprite 中会通过四个顶点来创建对应的三个三角形

```js
this._triangles = [
  new BaseTriangle(this._points.slice(0, 3)),
  new BaseTriangle([this._points[0], this._points[2], this._points[3]]),
]
```

### 缓冲类

通过精灵类和三角形类我们已经得到渲染目标物体所需要的顶点数据,但目前为止,顶点数据还是存放在 Cpu 的内存中,通过缓冲类,我们会将这部分数据绑定到 Gpu 内存中,以致在着色器程序运行时能够访问到这些数据.

在绑定之前我们首先要将数据由顶点数据输入到一个 ArrayBuffer 中,下面的方法实现了由顶点数据、顶点索引数据生成 ArrayBuffer,下面我们一步一步拆解这个方法的实现

```js
static from(triangles) {
    const verticleAttributes = Buffer.extractVerticleAtributes(triangles)
    const {verticleAttributeABByteLength, verticleIndexABByteLength} = Buffer.calculateArrayBufferByteLength(triangles)
    const {verArrayBuffer,arrayBufferViewMap,indexArrayBuffer,indexUint32View} = Buffer.createArrayBuffer(verticleAttributeABByteLength, verticleIndexABByteLength)

    let verBytesOffset = 0
    let idxBytesOffset = 0
    // 逐形状
    for (let i = 0; i < triangles.length; i++) {
      // 逐顶点
      for (let verIdx = 0; verIdx < POINT_COUNT_PER_TRIANGLE; verIdx++) {
        for (const attribute of verticleAttributes) {
          const { key, bytePerValue, countPerVerticle } = attribute
          for (
            let countIndex = 0;
            countIndex < countPerVerticle;
            countIndex++
          ) {
            arrayBufferViewMap[bytePerValue][verBytesOffset / bytePerValue] =
              triangles[i][key].data[verIdx * countPerVerticle + countIndex]
            verBytesOffset += bytePerValue
          }
        }
      }
      // 逐索引
      for (
        let indexIdx = 0;
        indexIdx < triangles[i].indexes.length;
        indexIdx++
      ) {
        indexUint32View[idxBytesOffset / 4] = triangles[i].indexes[indexIdx]
        idxBytesOffset += 4
      }
    }

    return new Buffer(
      verArrayBuffer,
      verticleAttributes,
      indexArrayBuffer,
      indexUint32View.length,
    )
}
```

这个过程主要分为 3 步
1、`const {verticleAttributeABByteLength, verticleIndexABByteLength} = Buffer.calculateArrayBufferByteLength(triangles)` 计算容纳这些三角形数据所需要的 ArrayBuffer 长度
2、`const {verArrayBuffer,arrayBufferViewMap,indexArrayBuffer,indexUint32View} = Buffer.createArrayBuffer(verticleAttributeABByteLength, verticleIndexABByteLength)` 创建对应长度的 ArrayBuffer 及其视图.
3、将三角形中的顶点数据和顶点索引数据逐顶点的写入到 ArrayBuffer 中.

得到了包含顶点数据的 ArrayBuffer 后,我们需要将数据通过 WebGL 提供的 API 传输到 GPU 中,供着色器程序调用

```js
bind(webglContext, shaderProgram) {
    const verticlesBuffer = webglContext.createBuffer()
    webglContext.bindBuffer(webglContext.ARRAY_BUFFER, verticlesBuffer)
    webglContext.bufferData(
      webglContext.ARRAY_BUFFER,
      this._verArrayBuffer,
      webglContext.STATIC_DRAW,
    )

    const indexBuffer = webglContext.createBuffer()
    webglContext.bindBuffer(webglContext.ELEMENT_ARRAY_BUFFER, indexBuffer)
    webglContext.bufferData(
      webglContext.ELEMENT_ARRAY_BUFFER,
      this._indexArrayBuffer,
      webglContext.STATIC_DRAW,
    )

    const dataTypeMap = {
      4: webglContext.FLOAT,
      2: webglContext.SHORT,
      1: webglContext.UNSIGNED_BYTE,
    }

    const strideBytes = this._verticleAttributes.reduce((acc, cur) => {
      return acc + cur.countPerVerticle * cur.bytePerValue
    }, 0)

    let offset = 0
    for (const verAttribute of this._verticleAttributes) {
      const location = webglContext.getAttribLocation(
        shaderProgram,
        verAttribute.attribute,
      )
      webglContext.enableVertexAttribArray(location)
      webglContext.vertexAttribPointer(
        location,
        verAttribute.countPerVerticle,
        dataTypeMap[verAttribute.bytePerValue],
        false,
        strideBytes,
        offset,
      )
      offset += verAttribute.countPerVerticle * verAttribute.bytePerValue
    }
}
```

上面的 bind 方法主要做了两件事情,
1、将数据绑定到缓冲中:
缓冲操作是在 GPU 上获取顶点和其他顶点数据的一种方式。gl.createBuffer 创建一个缓冲；gl.bindBuffer 是设置缓冲为当前使用缓冲； gl.bufferData 将数据拷贝到缓冲.
2、从缓冲中提取数据传给顶点着色器的属性:
一旦数据存到缓冲中，还需要告诉 WebGL 怎么从缓冲中提取数据传给顶点着色器的属性。首先通过 `getAttribLocation` 获取属性的地址,一旦知道了属性的地址,我们还需要调用 `gl.enableVertexAttribArray(location)` 来告诉 WebGL 我们想从缓冲中提供数据。然后针对每个属性的地址,调用`gl.vertexAttribPointer` 告诉 WebGL 如何从当前的缓冲中获取数据
```js
gl.vertexAttribPointer(
    location,    // 属性地址
    countPerVerticle,    // 每个顶点该属性的值的数量(对应 float\vec2\vec3\vec4 等数据类型)
    typeOfData,       // 数据类型,如 gl.BYTE 有符号的8位整数，范围[-128, 127]
    normalizeFlag,    // 是否对数据进行归一化处理
    strideToNextPieceOfData,      // 顶点间的步长
    offsetIntoBuffer      // 数据起始的偏移量
);
```

至此,我们已经成功的将本次渲染所需的顶点数据传输到 Gpu 中了,这一部分内容主要是对顶点数据的数据结构进行整理,并通过 WebGL 提供的面向过程的方法将数据传输到 GPU 中,供顶点着色器程序运行时使用.
