import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePerformanceStore = defineStore('performance', () => {
  // 性能数据列表
  const performanceData = ref([])
  
  // 实时监控指标
  const realtimeMetrics = ref({
    diskUtilization: 0,
    fragmentRate: 0,
    ioThroughput: 0,
    avgResponseTime: 0
  })
  
  // 添加性能数据
  const addPerformanceData = (data) => {
    performanceData.value.push({
      ...data,
      timestamp: new Date().toISOString()
    })
  }
  
  // 更新实时指标
  const updateRealtimeMetrics = (metrics) => {
    realtimeMetrics.value = {
      ...realtimeMetrics.value,
      ...metrics
    }
  }
  
  // 清空性能数据
  const clearPerformanceData = () => {
    performanceData.value = []
  }
  
  // 导出数据
  const exportData = () => {
    // TODO: 实现数据导出逻辑
    console.log('导出性能数据', performanceData.value)
  }
  
  return {
    performanceData,
    realtimeMetrics,
    addPerformanceData,
    updateRealtimeMetrics,
    clearPerformanceData,
    exportData
  }
})

