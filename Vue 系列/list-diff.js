/**
 * list diff 算法
 * 在 list-diff2 上进行了简化
 * 时间复杂度 O(n)
 * 优化了代码结构
 */
 const diff = function(oldList, newList) {
    const remove = function(index) {
      moves.push({ index, type: 'remove' })
    }
    const insert = function(index, item) {
      moves.push({ item, index, type: 'insert' })
    }
    const listToMap = function(list) {
      const map = {}
      list.forEach((item, index) => {
        map[item] = index
      })
      return map
    }
  
    const moves = []
    let oldListLength = oldList.length
    const newListMap = listToMap(newList)
  
    oldList.forEach((item, index) => {
      if (newListMap[item] === undefined) {
        oldList[index] = 'NEED_TO_BE_DELETE'
        remove(index)
      }
    })
  
    // 删除 oldList 中不存在于 newList 的元素
    oldList = oldList.filter(item => item !== 'NEED_TO_BE_DELETE')
  
    let i = 0 // oldList 游标
    let j = 0 // newList 游标
    while (i < oldList.length && j < newList.length) {
      if (oldList[i] === newList[j]) {
        i++
        j++
        continue
      } else if (oldList[i + 1] === newList[j]) {
        // 这部相当于移动，在diff算法中只将此步进行了移动
        remove(j)
        i += 2
        j++
      } else {
        insert(j, newList[j])
        j++
      }
    }
  
    // oldList 插入已经完成，现在需要移除尾部多余的元素
    moves.forEach(move => {
      move.type === 'remove' ? oldListLength-- : oldListLength++
    })
    while (oldListLength > newList.length) {
      remove(--oldListLength)
    }
  
    return moves
  }
  
  const patches = function(oldList, moves) {
    moves.forEach(item => {
      if (item.type === 'remove') {
        oldList.splice(item.index, 1)
      } else {
        oldList.splice(item.index, 0, item.item)
      }
    })
    return oldList
  }
  
  const oldList = [1, 2, 3, 5, 9, 4, 5, 10]
  const newList = [5, 3, 1, 6, 1, 9, 4, 2, 7]
  const moves = diff(oldList, newList)
  const patchedResult = patches(oldList, moves)
  console.log(patchedResult, newList)
  