<template>
  <div class="h-full bg-white p-4 overflow-y-auto">
    <h2 class="text-lg font-semibold mb-4 text-gray-800">数据面板</h2>
    
    <!-- 实时监控指标 -->
    <section class="mb-6">
      <h3 class="text-base font-semibold mb-3 text-gray-700">实时监控</h3>
      <div class="space-y-3">
        <div class="bg-gray-50 border border-gray-200 p-4 rounded-lg">
          <div class="text-xs text-gray-500 mb-1">磁盘利用率</div>
          <div class="text-2xl font-bold text-gray-800">{{ realtimeMetrics.diskUtilization.toFixed(1) }}%</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 p-4 rounded-lg">
          <div class="text-xs text-gray-500 mb-1">碎片率</div>
          <div class="text-2xl font-bold text-gray-800">{{ realtimeMetrics.fragmentRate.toFixed(1) }}%</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 p-4 rounded-lg">
          <div class="text-xs text-gray-500 mb-1">IO吞吐量</div>
          <div class="text-2xl font-bold text-gray-800">{{ realtimeMetrics.ioThroughput.toFixed(2) }} KB/s</div>
        </div>
        <div class="bg-gray-50 border border-gray-200 p-4 rounded-lg">
          <div class="text-xs text-gray-500 mb-1">平均响应时间</div>
          <div class="text-2xl font-bold text-gray-800">{{ realtimeMetrics.avgResponseTime.toFixed(2) }} ms</div>
        </div>
      </div>
    </section>
    
    <!-- 测试状态显示 -->
    <section v-if="testRunning" class="mb-6">
      <h3 class="text-base font-semibold mb-3 text-gray-700">测试状态</h3>
      <div class="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <div class="text-sm text-blue-800">
          <div class="font-medium mb-2">正在运行测试</div>
          <div class="text-xs text-blue-600">
            <div>测试类型: {{ currentTestType }}</div>
            <div>已执行: {{ testProgress.current }}/{{ testProgress.total }}</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, watch, ref } from 'vue'
import { usePerformanceStore } from '@/stores/performance'
import { useFileSystemStore } from '@/stores/fileSystem'

const performanceStore = usePerformanceStore()
const fileSystemStore = useFileSystemStore()

const realtimeMetrics = computed(() => performanceStore.realtimeMetrics)

// 测试状态
const testRunning = computed(() => {
  // 检查是否有正在进行的测试（通过检查最新的性能数据是否包含测试操作）
  const latestData = performanceStore.performanceData[performanceStore.performanceData.length - 1]
  return latestData && latestData.operation && latestData.operation.startsWith('simulation_')
})

const currentTestType = computed(() => {
  const latestData = performanceStore.performanceData[performanceStore.performanceData.length - 1]
  if (!latestData || !latestData.operation) return ''
  
  const typeMap = {
    'simulation_readwrite': '读写性能测试',
    'simulation_fragmentation': '碎片化测试',
    'simulation_concurrent': '并发操作测试',
    'simulation_defragment': '碎片整理测试',
    'simulation_comprehensive': '综合性能测试'
  }
  return typeMap[latestData.operation] || '未知测试'
})

const testProgress = computed(() => {
  const testData = performanceStore.performanceData.filter(d => 
    d.operation && d.operation.startsWith('simulation_')
  )
  return {
    current: testData.length,
    total: testData.length > 0 ? Math.max(...testData.map(d => d.step || 0)) : 0
  }
})

// 监听实时指标变化
watch(
  () => fileSystemStore.disk,
  () => {
    performanceStore.updateRealtimeMetrics({
      diskUtilization: fileSystemStore.diskUtilization,
      fragmentRate: fileSystemStore.disk.fragmentRate
    })
  },
  { deep: true, immediate: true }
)
</script>

