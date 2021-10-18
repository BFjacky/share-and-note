## Quill 实践指南

## quill 定制富文本编辑器

很多时候 `<textarea>` 并不能满足我们对文本输入的需求，当我们需要为输入的文本添加格式时，我们需要使用像 quill 这样的富文本编辑器来完成富文本的输入。

[github 仓库在这里](https://github.com/BFjacky/custom-quill)

接下来将会讲解如何在 quill 的基础上实现定制化的富文本编辑器。

### quill 简介

一个好的富文本编辑器的标志就是它能够支持多少种格式，而 quill 支持无限种类的格式。你可以在 quill 上定制任意种类的文本。并且，如果你不想自定义个任何功能，那么 quill 也是极易上手的，如下的一段代码就可以创建一个简单的富文本编辑器了。

```js
var quill = new Quill('#editor', {
  modules: { toolbar: true },
  theme: 'snow'
})
```

quill 自带了一套数据系统方便我们自由的扩展想要的功能，[Parchment](https://github.com/quilljs/parchment#parchment--) 和 [Delta](https://github.com/quilljs/delta#delta--)

#### Parchment 
Parchment 是抽象的文档模型，是一种与 Dom 树很类似的结构，Parchment 用于存储我们的文档结构，另外 Parchment 由 **Blot** 组成，关于 **Blot** 可以理解为 Parchment 的 Node 节点，Blot 中可以包含结构、内容、样式等。

#### Delta
Delta 是一个 Json 结构的数据，用来记录编辑器产生的变化。Delta 中的每一项数据代表了一次操作。
同时我们也可以通过 Delta 操作编辑器中的内容。
```js
new Delta().retain(2).delete(4)
```
retain(2) 表示跳过编辑器中前 2 个 Blot
delete(4) 表示删除编辑器中的接下来的 4 个 Blot

#### Blot
Blot 是 Parchment 的组成部分，是一种类似于 Dom Node 的结构，Blot 有其自己的[接口规范](https://github.com/quilljs/parchment/blob/master/src/blot/abstract/blot.ts)

在 Parchment 中主要有3种 Blot

**Block Blot**
 	块级元素的基本实现（可以在其内部插入其他的 Blot）
**Inline Blot**
 	内联元素的基本实现（可以在其内部插入其他 内联 的 Blot）
**Embed Blot**	
 	非文本叶子节点的基本实现（这种 Blot 内部不允许再插入其他的 Blot，通常用来实现 Dom 中 <img> <video> 这类标签对应的 Dom 结构）

Blot 一般通过调用 Parchment.create() 创建，我们可以覆盖 create 方法，并在覆盖的方法中通过 super 调用被我覆盖的方法，来保留 Blot 的默认行为。

一般情况下我们还需要实现 value() 方法，value() 方法返回 create() 方法中的参数值

```js
class MyBlot extends Parchment.Block {
	static create(value){
    	const node = super.create();
        // 接下来自定义其他功能
        node.setAttribute('attribute',value)
    }
    value(node){
    	return node.getAttribute('attribute')
    }
}
```

在我们自定义了一个 Blot 后，这时我们还不能在 quill 中使用它，还需要进行注册。
```js
MyBlot.blotName = 'MyBlot'
MyBlot.tagName= 'div'
MyBlot.className= "my-blot"
Quill.register(MyBlot)
```

关于 Quill 的前置知识介绍这么多，下面会通过一个 Demo 来加深理解.
#### 如何在 Quill 上定制功能

quill 提供了非常细粒度、定义良好的 API，我们可以在此基础之上定制化开发自己的富文本编辑器。（环境为 Vue + iview ，使用 iview 进行辅助样式开发）

首先我们从最简单的 demo 入手

```vue
<template>
  <div id="editor" class="editor"></div>
</template>
<script>
import Quill from "quill";
export default {
  mounted() {
    const quill = new Quill("#editor", {
      theme: "snow",
      placeholder: "请在此开始编辑..."
    });
  }
};
</script>
```

这是一个默认参数条件下的一个富文本编辑器，我们首先对 Toolbar 进行替换，Toolbar 是 modules 的一部分。

![avatar](http://neau-lib-static.test.upcdn.net/quill/resource/1577096134804-0.5dueaq751q4-toolbar.png)

我们需要在新建 quill 实例的时候覆盖原来的 toolbar，并使用的自己的 toolbar 元素。

```vue
<template>
  <div class="container">
    <div id="toolbar">
      <Tooltip content="加粗" placement="bottom">
        <button class="ql-bold"></button>
      </Tooltip>
      <Tooltip content="倾斜" placement="bottom">
        <button class="ql-italic"></button>
      </Tooltip>
      <Tooltip content="下划线" placement="bottom">
        <button class="ql-underline"></button>
      </Tooltip>
      <Tooltip content="删除线" placement="bottom">
        <button class="ql-strike"></button>
      </Tooltip>
    </div>
    <div id="editor" class="editor"></div>
  </div>
</template>
<script>
import Quill from "quill";
export default {
  mounted() {
    const quill = new Quill("#editor", {
      theme: "snow",
      modules: {
        toolbar: "#toolbar"
      },
      placeholder: "请在此开始编辑..."
    });
  }
};
</script>
<style lang="less" scoped></style>
```

会将我们的 toolbar 的样式变成如下的样子。

![avatar](http://neau-lib-static.test.upcdn.net/quill/resource/1577096835708-0.yek1n7xanb-toolbar.png)

quill 在初始化时会读取 #toolbar 元素，并获取其子节点的 classNames，对于 `ql-bold` ，quill 会截取 `ql-` 之后的部分，并且和已经注册的 handlers 做匹配，上面的 `bold` `italic` `underline` `strike` 存在注册好的 handler。当我们点击 toolbar 中的元素时便会调用 handler 对富文本内容进行格式化。

当我们需要添加一个本不存在的格式化效果时我们还需要在 modules 中补充它的 handler，下面添加一个可以添加卡片的按钮，并添加其对应的 handler。

```vue
<template>
  <div class="”container“">
    <div id="toolbar">
      <Tooltip content="添加卡片" placement="bottom">
        <button class="ql-card">
          <Icon type="md-card" />
        </button>
      </Tooltip>
    </div>
    <div id="editor" class="editor"></div>
  </div>
</template>
<script>
import Quill from "quill";
export default {
  mounted() {
    const quill = new Quill("#editor", {
      theme: "snow",
      modules: {
        toolbar: {
          container: "#toolbar",
          handlers: {
            card: () => { // 属性名称要与 ql-xxx 对应
              console.log(`点击了 card`);
            }
          }
        }
      },
      placeholder: "请在此开始编辑..."
    });
  }
};
</script>
<style lang="less" scoped></style>
```

接下来我们为这个按钮添加实际的效果。

在 Quill 中，使用 Blots 表示节点，我们可以认为 Blots 对应 Dom 中的 Node。当我们需要在 quill 中添加一自定义的 Blots 节点时，我们需要让其继承自 Blots 节点。

```js
const BlockEmbed = Quill.import('blots/block/embed')
function customCard(node) {
  // 在一个节点中插入自定义的 dom
  const leftDiv = document.createElement('div')
  leftDiv.className = 'media-container'
  const mediaDiv = document.createElement('div')
  mediaDiv.style['background-image'] = `url(${value.image})`
  mediaDiv.className = 'media'
  leftDiv.appendChild(mediaDiv)

  const rightDiv = document.createElement('div')
  rightDiv.className = 'content-container'

  const titleP = document.createElement('p')
  titleP.className = 'title'
  titleP.innerText = value.title

  const authorP = document.createElement('p')
  authorP.className = 'author'
  authorP.innerText = value.author

  const contentP = document.createElement('p')
  contentP.className = 'content'
  contentP.innerText = value.content

  rightDiv.appendChild(titleP)
  rightDiv.appendChild(authorP)
  rightDiv.appendChild(contentP)
  node.appendChild(leftDiv)
  node.appendChild(rightDiv)
}
// 自定义卡片节点
class CardBlot extends BlockEmbed {
  static create(value) {
    const node = super.create()
    // 新建节点时传入的数据
    node.dataset.title = value.title
    node.dataset.image = value.image
    node.dataset.content = value.content
    node.dataset.author = value.author

    customizeCard(node)

    node.setAttribute('contenteditable', false) // 设置该节点不可编辑

    return node
  }
  static value(node) {
    // 这里需要返回 create 函数中传入的数据
    return node.dataset
  }
}
CardBlot.blotName = 'card' // quill 中的标记名称
CardBlot.tagName = 'div' // dom 节点名称
CardBlot.className = 'card' // dom 中真实的 class 名称
Quill.register(CardBlot)
```

同时我们还需要添加对应的 handler

```js
const CARD_INFO = {
  title: 'Quill 编辑器',
  author: 'jhchen',
  content:
    'Quill是一种现代的富文本编辑器，旨在实现兼容性和可扩展性。它由Jason Chen和Byron Milligan创建，并由Slab积极维护。 ',
  image:
    'http://neau-lib-static.test.upcdn.net/quill/resource/1576812308405-0.0544z7sqq9au-quill.png'
}

new Quill('#editor', {
  theme: 'snow',
  modules: {
    toolbar: {
      container: '#toolbar',
      handlers: {
        card: () => {
          const addRange = this.quill.getSelection() || 0 // 获取当前光标选中的位置
          this.quill.insertEmbed(
            addRange,
            'card',
            CARD_INFO,
            Quill.sources.USER
          ) // 插入 card blots
          this.$nextTick(() => {
            this.quill.setSelection(addRange + 1, Quill.sources.SILENT)
          }) // 插入完成后将光标向后移动一位
        }
      }
    }
  },
  placeholder: '请在此开始编辑...'
})
```

至此我们就可以通过点击 `card` 图标来添加一个 card 了，但是这个 card 还没有添加样式，我们手动在显示 card 页面上添加样式就大功告成了。

通过这种方式，我们可以便可以在 quill 添加任意类型的内容。

#### 最后
[github 仓库这这里](https://github.com/BFjacky/custom-quill)。
对 quill 的使用有个整体印象，甚至可以方便的 copy 代码，在 demo 中实现了一个 **图片墙** 的功能，帮助大家开阔思路。

