# Pixi 中的渲染优化

在 Pixi 中,批量渲染使 Pixi 成为了更快的 Webgl 渲染引擎，这种渲染方式减少了执行渲染和将数据上传到 GPU 的次数，不过这种渲染方式也有一些限制：

- 使用类似的数据结构存储不同渲染目标的数据信息
- 使用相同的着色器
- 提前绑定使用到的纹理到 GPU 中
- 在某个时刻，需要占用相对较高的内存来进行批量渲染

### AbstractBatchRenderer

Pixi 中和批量渲染行为相关的逻辑主要在这个类中实现，位于 `core/src/batch/AbstractBatchRenderer.ts`
其中最核心的功能便在这段代码中：

```ts
    flush(): void
    {
        if (this._vertexCount === 0)
        {
            return;
        }

        this._attributeBuffer = this.getAttributeBuffer(this._vertexCount);
        this._indexBuffer = this.getIndexBuffer(this._indexCount);

        this._aIndex = 0;
        this._iIndex = 0;
        this._dcIndex = 0;

        this.buildTexturesAndDrawCalls();
        this.updateGeometry();

        this.drawBatches();

        // reset elements buffer for the next flush
        this._bufferSize = 0;
        this._vertexCount = 0;
        this._indexCount = 0;
    }

```

接下来便一步步看这个方法都做了哪些事情

#### 1.通过 `getAttributeBuffer` 获取一个存储属性的 ArrayBuffer

```ts
getAttributeBuffer(size: number): ViewableBuffer{
    const roundedP2 = nextPow2(Math.ceil(size / 8));
    const roundedSizeIndex = log2(roundedP2);
    const roundedSize = roundedP2 * 8;

    if (this._aBuffers.length <= roundedSizeIndex)
    {
        this._iBuffers.length = roundedSizeIndex + 1;
    }

    let buffer = this._aBuffers[roundedSize];

    if (!buffer)
    {
        this._aBuffers[roundedSize] = buffer = new ViewableBuffer(roundedSize * this.vertexSize * 4);
    }

    return buffer;
}
```
在这个方法的前三行根据传入的 size 计算本次开辟的 ArrayBuffer 的容量应为多少，在这个方法中，为了避免频繁开辟若干大小不一的内存，通过 `nextPow2` 方法，以 2 的幂次间隔来开辟不同容量的 ArrayBuffer。

最后申请的 ArrayBuffer 容量为 `roundedSize * this.vertexSize * 4`，其中 roundedSize 为基于 2 的幂次间隔的 ArrryBuffer 中所需存放的顶点数量，`this.vertexSize` 在赋值的地方可以找到值为 6，为每个顶点所需占用数据量，这 6 个数据分别为：
1. 顶点 X 轴坐标
2. 顶点 Y 轴坐标
3. 纹理 X 轴坐标
4. 纹理 Y 轴坐标
5. 片元颜色
6. 纹理单元编号
最后的` * 4 `则为一个 Float32 数据所需要的字节数。


#### 2. 通过 `getIndexBuffer` 获取一个存储顶点的 ArrayBuffer
Pixi 最终会使用 `gl.drawElements` 方法进行绘制，这种绘制方法可以复用顶点坐标数据，但是需要创建顶点索引数据用来存放绘制时选择的顶点。这个方法和 `getAttributeBuffer` 功能类似。


#### 3. 通过 `buildTexturesAndDrawCalls` 准备需要绘制的纹理和顶点数据
这个方法通过两部分逻辑完成绘制数据的准备工作：

1. 将全部的渲染内容分成多个渲染批次
这个方法将需要绘制的内容分成若干批次，将每一批需要绘制的顶点数据、纹理数据，批次的数量由所需绑定的纹理数量和GPU支持的纹理单元上限决定，在 webgl 中可以通过 `gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)` 获取 GPU 支持绑定的纹理单元上限。核心代码如下：
```ts
if (texArray.count >= MAX_TEXTURES)
{
    batch.boundArray(texArray, boundTextures, TICK, MAX_TEXTURES);
    this.buildDrawCalls(texArray, start, i);
    start = i;
    texArray = textureArrays[++countTexArrays];
    ++TICK;
}
```

2. 将某一批渲染内容所需的数据打包到 ArrayBuffer 中
批量渲染的方式是指执行一次`gl.drawElements`方法，但是需要绘制多个内容，所以在绘制前，需要将所有的顶点数据、索引数据、纹理单元编号等数据按绘制的顺序打包到一个 ArrayBuffer 中，并在随后作为属性传入 GPU 中参与运算。

将数据逐一填入 ArrayBuffer 的代码如下：
```ts
for (let i = 0; i < vertexData.length; i += 2)
{
    float32View[aIndex++] = vertexData[i];
    float32View[aIndex++] = vertexData[i + 1];
    float32View[aIndex++] = uvs[i];
    float32View[aIndex++] = uvs[i + 1];
    uint32View[aIndex++] = argb;
    float32View[aIndex++] = textureId;
}
```


#### 4. 通过 `updateGeometry` 将纹理图片以外的数据绑定到绑定到GPU
[VAO](http://www.jiazhengblog.com/blog/2017/04/17/3127/)
在前几步逻辑执行中将绘制每一个角色所需的数据都存储在了 Javascript 进程中，如果想要在 Gpu 执行绘制时能访问到这些数据，还需将这些数据绑定到 Gpu 所使用的内存中。

处理这部分逻辑的是 `GeometrySystem` & `BufferSystem` 这两个类，其中有关数据绑定也有很多复杂的流程细节，会在另一篇文章中详述。

#### 5. 通过 `drawBatches` 进行最终的绘制
将已经完成批次分割的绘制任务，按顺序进行绘制，在每一次绘制前，会进行纹理的卸载和绑定。