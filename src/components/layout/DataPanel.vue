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
    
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { usePerformanceStore } from '@/stores/performance'
import { useFileSystemStore } from '@/stores/fileSystem'

const performanceStore = usePerformanceStore()
const fileSystemStore = useFileSystemStore()

const realtimeMetrics = computed(() => performanceStore.realtimeMetrics)

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

