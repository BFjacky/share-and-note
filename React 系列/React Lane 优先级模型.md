## React Lane 优先级模型

### 抛开 React 来理解 Lane 模型

React Lane 本身和 React 的任务调度功能有着非常多的耦合,而 React 的任务调度十分复杂,想要理清楚其功能、思想并不是一件容易的事,所以这篇文章期望单独阐述 React Lane 模型本身,而不设计过多 React 的相关知识,个人理解,用一句话来概括 Lane 模型就是:**React Lane 是通过位运算的方式来代表多种优先级的枚举,以达到减少内存占用和优化运行性能的目的**

### React Lane 的巧妙之处

首先需要了解位运算的符号和规则:
| 位运算            | 用法     | 描述                                                                        |
| ----------------- | -------- | --------------------------------------------------------------------------- |
| 按位与(`&`)       | `a & b`  | 两个比特为都为 1 时, 结果为 1, 否则为 0                    |
| 按位或(`\|`)      | `a \| b` | 两个比特为都为 0 时, 结果为 0, 否则为 1                    |
| 按位非(`~`)       | `~ a`    | 反转比特为, 即 0 变成 1, 1 变成 0                                   |
| 按位异或(`^`)     | `a ^ b`  | 两个比特为相同时, 结果为 0, 否则为 1                       |
| 左移(`<<`)        | `a << b` | 将 a 的二进制形式向左移 b (< 32) 比特位, 右边用 0 填充                      |
| 有符号右移(`>>`)  | `a >> b` | 将 a 的二进制形式向右移 b (< 32) 比特位, 丢弃被移除的位, 左侧以最高位来填充 |
| 无符号右移(`>>>`) | `a >> b` | 将 a 的二进制形式向右移 b (< 32) 比特位, 丢弃被移除的位, 并用 0 在左侧填充  |


一般情况下我们会用枚举来区分不同类型,在进行批量数据的类型判断时需要进行多次数组遍历来达成,看下面的例子

```js
const PriorityEnum = {
    sync: 0,   // 同步任务
    io: 1,     // io 任务
    userBlock: 2,  // 用户事件响应任务
    offScreen: 3,  // 离屏任务
}
// 将任务队列中全部的 userBlock、offScreen 任务挑出来执行,则需要进行这样的判断
const userBlockAndOffScreen = [PriorityEnum.userBlock, PriorityEnum.offScreen]
const tasks = [{priority: 1},{priority: 0},{priority: 3},...] // 省略多余任务
tasks.filter(task => userBlockAndOffScreen.includes(task.priority))
// 这种判断方式会随着优先级等级的细分而增加更多的时间复杂度
```

如果是基于位运算实现的优先级管理(车道模型),可以按照如下方式组织代码

```js
const SyncLane = 0b0001; // 同步任务
const IoLane = 0b0010;  // io 任务
const UserBlockLane = 0b0100;  // 用户事件响应任务
const OffScreenLane = 0b1000;  // 离屏任务

const userBlockAndOffScreen = UserBlockLane | OffScreenLane
const tasks = [{priority: IoLane},{priority: SyncLane},{priority: OffScreenLane},...] // 省略多余任务
tasks.filter(task => userBlockAndOffScreen & task.priority) // 通过位运算来将任务过滤出来,位运算的方式有着更好的性能
```

通过位运算的方式通过方便的将任务列表中符合优先级条件的任务筛选出来

### React Lane 的筛选技巧

当我们的代码中需要使用一些枚举值时,理论上都可以通过位运算(lane 模型)来替代,下面的例子是通过位运算和数组遍历的方式来分别进行枚举类型的处理.

判断类型交集

```js
// 位运算方式
function includesSomeLane(a: Lanes, b: Lanes) {
  return (a & b) !== 0
}
// 枚举数组遍历方式
function includesSomeLane(a: Array, b: Arrany) {
  return a.find((item) => b.includes(item))
}
```

判断类型子集

```js
function isSubsetOfLanes(set: Lanes, subset: Lanes | Lane) {
  return (set & subset) === subset
}
function isSubsetOfLanes(set: Array, subset: Array | Number) {
  return Array.isArray(subset)
    ? subset.every((item) => set.includes(item))
    : set.includes(subset)
}
```

获取类型并集

```js
function mergeLanes(a: Lanes | Lane, b: Lanes | Lane) {
  return a | b
}
function mergeLanes(a: Array | Number, b: Array | Number) {
    const results = []
    const totalItems = [Array.isArray(a)?...a:a,Array.isArray(b)?...b:b]
    totalItems.forEach(item=>{
        if(!results.includes(item)){
            results.push(item)
        }
    })
    return results
}
```

移除子集

```js
function removeLanes(set: Lanes, subset: Lanes | Lane) {
  return set & ~subset
}
function removeLanes(set: Array, subset: Array | Number) {
  return set.filter((item) =>
    Array.isArray(subset) ? !subset.includes(item) : subset !== item,
  )
}
```

获取交集

```js
function intersectLanes(a: Lanes | Lane, b: Lanes | Lane) {
  return a & b
}
function intersectLanes(a: Array | Number, b: Array | Number) {
  const aArr = Array.isArray(a) ? a : [a]
  const bArr = Array.isArray(b) ? b : [b]
  return aArr.filter((item) => bArr.includes(item))
}
```

获取最小枚举值

```js
function getMinimumLane(lanes: Lanes) {
  return lanes & -lanes
}
function getMinimumLane(lanes: Array) {
  return lanes.reduce((acc, cur) => {
    return Math.min(acc, cur)
  })
}
```

获取最大枚举值
```js
function getMaximumLane(lanes: Lanes): Lane {
  const index = 31 - clz32(lanes);
  return index < 0 ? 0 : 1 << index;
}
function getMinimumLane(lanes: Array) {
  return lanes.reduce((acc, cur) => {
    return Math.max(acc, cur)
  })
}
```

由此可以看到使用位运算来代替枚举对性能的提升会是很明显的.当然位运算的方式也有很明显的缺点:**1.可读性差2.受31位的限制(枚举总量不得超过31)**
### React Lane 优先级管理对比 ExpirationTime 优先级管理

基于到期时间进行优先级管理,只能够将任务按照线性排列,在这样的条件下,如果想要执行一批优先级较高的任务只能通过 `ExpirationTime < CuurentTime` 进行判断,假如有这样一个场景:
有 A、B 两个个任务,A 任务的 ExpirationTime = 0,B 任务的 ExpirationTime = 1,执行 A 任务为 IO 任务,预计要耗时(1000ms),执行 B 任务预计要耗时(1ms),在这种情况下,优先执行 B 任务对任务调度、用户体验更有利.但是在 ExpirationTime 优先级体系下只能按照 ExpirationTime 的排列大小对任务进行优先级管理.

为了解决上面的问题需要给任务加上一个标签,用来标记任务为 IO 任务、用户行为任务、同步任务等.将任务进行分类后,便可以在批量处理任务时优先选择更重要的任务进行处理,而不是更早加入调度队列的任务.
