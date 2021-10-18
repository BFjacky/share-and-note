## Nodejs 识别图片类型

通过切文件名称后缀来获得图片格式的方式是不准确的，因为文件后缀是可以被强行更改的，这样一个.gif 图片也可以被保存成.jpg,

那么在 Node 上我们如何做文件类型的校验呢

### 通过文件头标识判断图片格式

其实很简单，每个图片文件都有文件头标识，各种格式的图片的文件头标识都是不一样，所以可以通过判断文件头的标识来识别图片格式。

通过在网上找资料，汇总了如下的 图片文件头标识:

> 1.JPEG/JPG - 文件头标识 (2 bytes): ff, d8 文件结束标识 (2 bytes): ff, d9
> 2.TGA - 未压缩的前 5 字节 00 00 02 00 00 - RLE 压缩的前 5 字节 00 00 10 00 00
> 3.PNG - 文件头标识 (8 bytes) 89 50 4E 47 0D 0A 1A 0A
> 4.GIF - 文件头标识 (6 bytes) 47 49 46 38 39(37) 61
> 5.BMP - 文件头标识 (2 bytes) 42 4D B M
> 6.PCX - 文件头标识 (1 bytes) 0A
> 7.TIFF - 文件头标识 (2 bytes) 4D 4D 或 49 49
> 8.ICO - 文件头标识 (8 bytes) 00 00 01 00 01 00 20 20
> 9.CUR - 文件头标识 (8 bytes) 00 00 02 00 01 00 20 20
> 10.IFF - 文件头标识 (4 bytes) 46 4F 52 4D
> 11.ANI - 文件头标识 (4 bytes) 52 49 46 46

`知识点:` 1 字节(bytes) = 8 bits,上面的数字均为 16 进制也就占 4bits 空间,每两个 16 进制数字占一字节

### 如何判断

通过将图片资源的二进制流与该标识做比对，即可判断图片格式。

因为实现逻辑非常简单，具体的实现逻辑看代码和注释就就好，在这里贡献出来给大家参考，方便大家开发使用。

```js
function getImageSuffix(fileBuffer) {
  // 将上文提到的 文件标识头 按 字节 整理到数组中
  const imageBufferHeaders = [
    { bufBegin: [0xff, 0xd8], bufEnd: [0xff, 0xd9], suffix: '.jpg' },
    { bufBegin: [0x00, 0x00, 0x02, 0x00, 0x00], suffix: '.tga' },
    { bufBegin: [0x00, 0x00, 0x10, 0x00, 0x00], suffix: '.rle' },
    {
      bufBegin: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      suffix: '.png'
    },
    { bufBegin: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], suffix: '.gif' },
    { bufBegin: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], suffix: '.gif' },
    { bufBegin: [0x42, 0x4d], suffix: '.bmp' },
    { bufBegin: [0x0a], suffix: '.pcx' },
    { bufBegin: [0x49, 0x49], suffix: '.tif' },
    { bufBegin: [0x4d, 0x4d], suffix: '.tif' },
    {
      bufBegin: [0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x20, 0x20],
      suffix: '.ico'
    },
    {
      bufBegin: [0x00, 0x00, 0x02, 0x00, 0x01, 0x00, 0x20, 0x20],
      suffix: '.cur'
    },
    { bufBegin: [0x46, 0x4f, 0x52, 0x4d], suffix: '.iff' },
    { bufBegin: [0x52, 0x49, 0x46, 0x46], suffix: '.ani' }
  ]
  for (const imageBufferHeader of imageBufferHeaders) {
    let isEqual
    // 判断标识头前缀
    if (imageBufferHeader.bufBegin) {
      const buf = Buffer.from(imageBufferHeader.bufBegin)
      isEqual = buf.equals(
        //使用 buffer.slice 方法 对 buffer 以字节为单位切割
        fileBuffer.slice(0, imageBufferHeader.bufBegin.length)
      )
    }
    // 判断标识头后缀
    if (isEqual && imageBufferHeader.bufEnd) {
      const buf = Buffer.from(imageBufferHeader.bufEnd)
      isEqual = buf.equals(fileBuffer.slice(-imageBufferHeader.bufEnd.length))
    }
    if (isEqual) {
      return imageBufferHeader.suffix
    }
  }
  // 未能识别到该文件类型
  return ''
}
```

通过这种方式我们就能在`Node`中准确地识别图片格式。


文章很短，希望能帮到你~