/**
 * 数据处理器
 * 对原始数据进行清洗、统计、对比分析
 */
export class DataProcessor {
  /**
   * 清洗性能数据
   * @param {Array} data - 原始数据
   * @returns {Array} 清洗后的数据
   */
  static cleanData(data) {
    return data.filter(item => {
      return item.duration > 0 && item.ioCount >= 0
    })
  }
  
  /**
   * 统计操作类型分布
   * @param {Array} data - 性能数据
   * @returns {Object} 统计结果
   */
  static statisticsByOperation(data) {
    const stats = {}
    
    data.forEach(item => {
      if (!stats[item.operation]) {
        stats[item.operation] = {
          count: 0,
          totalDuration: 0,
          totalIOCount: 0,
          avgDuration: 0,
          avgIOCount: 0
        }
      }
      
      stats[item.operation].count++
      stats[item.operation].totalDuration += item.duration
      stats[item.operation].totalIOCount += item.ioCount
    })
    
    // 计算平均值
    Object.keys(stats).forEach(operation => {
      const stat = stats[operation]
      stat.avgDuration = stat.totalDuration / stat.count
      stat.avgIOCount = stat.totalIOCount / stat.count
    })
    
    return stats
  }
  
  /**
   * 对比不同算法的性能
   * @param {Array} data - 性能数据
   * @param {string} operation - 操作类型
   * @returns {Object} 对比结果
   */
  static compareAlgorithms(data, operation) {
    const filtered = data.filter(item => item.operation === operation)
    const algorithms = {}
    
    filtered.forEach(item => {
      if (!algorithms[item.algorithm]) {
        algorithms[item.algorithm] = []
      }
      algorithms[item.algorithm].push(item)
    })
    
    const comparison = {}
    Object.keys(algorithms).forEach(algorithm => {
      const items = algorithms[algorithm]
      comparison[algorithm] = {
        avgDuration: items.reduce((sum, item) => sum + item.duration, 0) / items.length,
        avgIOCount: items.reduce((sum, item) => sum + item.ioCount, 0) / items.length,
        avgThroughput: items.reduce((sum, item) => sum + item.throughput, 0) / items.length
      }
    })
    
    return comparison
  }
  
  /**
   * 时间序列数据分组
   * @param {Array} data - 性能数据
   * @param {number} intervalMinutes - 时间间隔（分钟）
   * @returns {Array} 分组后的数据
   */
  static groupByTimeInterval(data, intervalMinutes = 5) {
    const groups = {}
    
    data.forEach(item => {
      const timestamp = new Date(item.timestamp)
      const interval = Math.floor(timestamp.getMinutes() / intervalMinutes)
      const key = `${timestamp.getHours()}:${interval * intervalMinutes}`
      
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
    })
    
    return Object.keys(groups).map(key => ({
      time: key,
      data: groups[key]
    }))
  }
}

