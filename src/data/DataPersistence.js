/**
 * 数据持久化
 * 支持本地存储（LocalStorage）保存用户配置、操作记录、性能数据
 */
export class DataPersistence {
  static STORAGE_KEYS = {
    CONFIG: 'fs_viewer_config',
    PERFORMANCE_DATA: 'fs_viewer_performance',
    OPERATION_LOG: 'fs_viewer_operations'
  }
  
  /**
   * 保存配置
   * @param {Object} config - 配置对象
   */
  static saveConfig(config) {
    try {
      localStorage.setItem(this.STORAGE_KEYS.CONFIG, JSON.stringify(config))
    } catch (error) {
      console.error('保存配置失败', error)
    }
  }
  
  /**
   * 加载配置
   * @returns {Object} 配置对象
   */
  static loadConfig() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.CONFIG)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('加载配置失败', error)
      return null
    }
  }
  
  /**
   * 保存性能数据
   * @param {Array} data - 性能数据数组
   */
  static savePerformanceData(data) {
    try {
      localStorage.setItem(this.STORAGE_KEYS.PERFORMANCE_DATA, JSON.stringify(data))
    } catch (error) {
      console.error('保存性能数据失败', error)
    }
  }
  
  /**
   * 加载性能数据
   * @returns {Array} 性能数据数组
   */
  static loadPerformanceData() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.PERFORMANCE_DATA)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('加载性能数据失败', error)
      return []
    }
  }
  
  /**
   * 保存操作记录
   * @param {Object} operation - 操作记录
   */
  static saveOperationLog(operation) {
    try {
      const logs = this.loadOperationLog()
      logs.push({
        ...operation,
        timestamp: new Date().toISOString()
      })
      // 只保留最近1000条记录
      if (logs.length > 1000) {
        logs.shift()
      }
      localStorage.setItem(this.STORAGE_KEYS.OPERATION_LOG, JSON.stringify(logs))
    } catch (error) {
      console.error('保存操作记录失败', error)
    }
  }
  
  /**
   * 加载操作记录
   * @returns {Array} 操作记录数组
   */
  static loadOperationLog() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.OPERATION_LOG)
      return data ? JSON.parse(data) : []
    } catch (error) {
      console.error('加载操作记录失败', error)
      return []
    }
  }
  
  /**
   * 清空所有数据
   */
  static clearAll() {
    Object.values(this.STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
  }
}

