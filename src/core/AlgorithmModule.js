/**
 * 算法模块
 * 实现连续分配、链接分配、索引分配、磁盘调度等算法
 */
export class AlgorithmModule {
  /**
   * 磁盘调度算法 - FCFS (先来先服务)
   * @param {number[]} requests - 请求序列
   * @param {number} currentPosition - 当前磁头位置
   * @returns {Object} 调度结果
   */
  static fcfs(requests, currentPosition) {
    const sequence = [...requests]
    let totalMovement = 0
    let current = currentPosition
    
    const movements = sequence.map(request => {
      const movement = Math.abs(request - current)
      totalMovement += movement
      current = request
      return { from: current - movement, to: request, distance: movement }
    })
    
    return {
      sequence,
      totalMovement,
      movements,
      avgSeekTime: totalMovement / sequence.length
    }
  }
  
  /**
   * 磁盘调度算法 - SSTF (最短寻道时间优先)
   * @param {number[]} requests - 请求序列
   * @param {number} currentPosition - 当前磁头位置
   * @returns {Object} 调度结果
   */
  static sstf(requests, currentPosition) {
    const sequence = []
    const remaining = [...requests]
    let current = currentPosition
    let totalMovement = 0
    
    while (remaining.length > 0) {
      // 找到距离当前位置最近的请求
      let nearestIndex = 0
      let nearestDistance = Math.abs(remaining[0] - current)
      
      for (let i = 1; i < remaining.length; i++) {
        const distance = Math.abs(remaining[i] - current)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = i
        }
      }
      
      const nextRequest = remaining.splice(nearestIndex, 1)[0]
      sequence.push(nextRequest)
      totalMovement += nearestDistance
      current = nextRequest
    }
    
    return {
      sequence,
      totalMovement,
      avgSeekTime: totalMovement / sequence.length
    }
  }
  
  /**
   * 磁盘调度算法 - SCAN (扫描算法)
   * @param {number[]} requests - 请求序列
   * @param {number} currentPosition - 当前磁头位置
   * @param {number} maxBlock - 最大块号
   * @param {string} direction - 扫描方向 'up' | 'down'
   * @returns {Object} 调度结果
   */
  static scan(requests, currentPosition, maxBlock, direction = 'up') {
    const sequence = []
    const remaining = [...requests]
    let current = currentPosition
    let totalMovement = 0
    
    // 分离当前磁头位置两侧的请求
    const left = remaining.filter(r => r < current).sort((a, b) => b - a)
    const right = remaining.filter(r => r >= current).sort((a, b) => a - b)
    
    if (direction === 'up') {
      // 先向右扫描
      right.forEach(request => {
        sequence.push(request)
        totalMovement += Math.abs(request - current)
        current = request
      })
      // 到达边界后向左扫描
      if (left.length > 0) {
        totalMovement += Math.abs(maxBlock - current)
        current = maxBlock
        left.forEach(request => {
          sequence.push(request)
          totalMovement += Math.abs(request - current)
          current = request
        })
      }
    } else {
      // 先向左扫描
      left.forEach(request => {
        sequence.push(request)
        totalMovement += Math.abs(request - current)
        current = request
      })
      // 到达边界后向右扫描
      if (right.length > 0) {
        totalMovement += Math.abs(0 - current)
        current = 0
        right.forEach(request => {
          sequence.push(request)
          totalMovement += Math.abs(request - current)
          current = request
        })
      }
    }
    
    return {
      sequence,
      totalMovement,
      avgSeekTime: totalMovement / sequence.length
    }
  }
  
  /**
   * 计算碎片率
   * @param {Object} disk - 磁盘对象
   * @returns {number} 碎片率 (0-1)
   */
  static calculateFragmentRate(disk) {
    const usedBlocks = Object.keys(disk.usedBlocks).map(Number).sort((a, b) => a - b)
    if (usedBlocks.length === 0) return 0
    
    let fragmentCount = 0
    for (let i = 1; i < usedBlocks.length; i++) {
      if (usedBlocks[i] !== usedBlocks[i - 1] + 1) {
        fragmentCount++
      }
    }
    
    return fragmentCount / usedBlocks.length
  }
}

