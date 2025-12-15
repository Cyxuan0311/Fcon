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
    
    <!-- 性能图表 -->
    <section class="mb-6">
      <h3 class="text-base font-semibold mb-3 text-gray-700">性能图表</h3>
      <div class="mb-2">
        <Button.Group>
          <Button 
            @click="switchChartType('bar')"
            :type="chartType === 'bar' ? 'primary' : 'default'"
            size="middle"
          >
            柱状图
          </Button>
          <Button 
            @click="switchChartType('line')"
            :type="chartType === 'line' ? 'primary' : 'default'"
            size="middle"
          >
            折线图
          </Button>
          <Button 
            @click="switchChartType('pie')"
            :type="chartType === 'pie' ? 'primary' : 'default'"
            size="middle"
          >
            饼图
          </Button>
        </Button.Group>
      </div>
      <div ref="chartContainer" class="w-full bg-gray-50 border border-gray-200 rounded" style="height: 256px; min-height: 256px;"></div>
    </section>
    
    <!-- 数据导出 -->
    <section>
      <Button 
        @click="exportData"
        type="primary"
        class="w-full"
        size="large"
      >
        导出数据
      </Button>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, onBeforeUnmount, watch, computed, nextTick } from 'vue'
import { Button, message } from 'ant-design-vue'
import { usePerformanceStore } from '@/stores/performance'
import { useFileSystemStore } from '@/stores/fileSystem'
import { ChartRenderer } from '@/renderer/ChartRenderer'
import { DataProcessor } from '@/data/DataProcessor'
import * as XLSX from 'xlsx'

const performanceStore = usePerformanceStore()
const fileSystemStore = useFileSystemStore()
const chartContainer = ref(null)
const chartType = ref('bar') // bar | line | pie
let chartRenderer = null
let resizeObserver = null

const realtimeMetrics = computed(() => performanceStore.realtimeMetrics)

onMounted(async () => {
  // 等待 DOM 完全渲染
  await nextTick()
  
  if (chartContainer.value) {
    // 确保容器有尺寸
    const checkContainer = () => {
      if (chartContainer.value && chartContainer.value.clientWidth > 0 && chartContainer.value.clientHeight > 0) {
        chartRenderer = new ChartRenderer(chartContainer.value)
        chartRenderer.init()
        updateChart()
        
        // 监听容器大小变化
        resizeObserver = new ResizeObserver(() => {
          if (chartRenderer) {
            chartRenderer.resize()
          }
        })
        resizeObserver.observe(chartContainer.value)
      } else {
        // 如果容器还没有尺寸，延迟重试
        setTimeout(checkContainer, 100)
      }
    }
    
    checkContainer()
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

onUnmounted(() => {
  if (chartRenderer) {
    chartRenderer.dispose()
  }
})

// 监听性能数据变化，更新图表
watch(
  () => performanceStore.performanceData,
  () => {
    updateChart()
  },
  { deep: true }
)

// 监听实时指标变化
watch(
  () => fileSystemStore.disk,
  () => {
    performanceStore.updateRealtimeMetrics({
      diskUtilization: fileSystemStore.diskUtilization,
      fragmentRate: fileSystemStore.disk.fragmentRate
    })
    // 如果当前是饼图，实时更新
    if (chartType.value === 'pie') {
      updateChart()
    }
  },
  { deep: true, immediate: true }
)

const updateChart = () => {
  if (!chartRenderer || !chartRenderer.chart) return
  
  const data = performanceStore.performanceData
  if (data.length === 0) {
    // 显示空状态
    chartRenderer.updateChart({
      title: { text: '暂无数据', left: 'center' },
      graphic: {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: '暂无性能数据',
          fontSize: 16,
          fill: '#999'
        }
      }
    })
    return
  }
  
  if (chartType.value === 'bar') {
    // 按操作类型统计
    const stats = DataProcessor.statisticsByOperation(data)
    const operations = Object.keys(stats)
    const durations = operations.map(op => stats[op].avgDuration)
    
    chartRenderer.renderBarChart(
      operations.map((op, index) => ({
        operation: op === 'create_file' ? '创建文件' : 
                   op === 'delete_file' ? '删除文件' : 
                   op === 'defragment' ? '碎片整理' : op,
        duration: durations[index]
      }))
    )
  } else if (chartType.value === 'line') {
    // 时间序列数据
    const recentData = data.slice(-20) // 最近20条
    chartRenderer.renderLineChart(recentData)
  } else if (chartType.value === 'pie') {
    // 磁盘空间占比
    const disk = fileSystemStore.disk
    const used = Object.keys(disk.usedBlocks).length
    const free = disk.freeBlocks.length
    chartRenderer.renderPieChart({ 
      used, 
      free,
      blockSize: disk.blockSize || 4096 // 传递块大小用于格式化显示
    })
  }
}

const switchChartType = (type) => {
  chartType.value = type
  updateChart()
}

const exportData = () => {
  const data = performanceStore.performanceData
  if (data.length === 0) {
    message.warning('暂无数据可导出')
    return
  }
  
  // 转换为Excel格式
  const worksheet = XLSX.utils.json_to_sheet(
    data.map(item => ({
      操作类型: item.operation === 'create_file' ? '创建文件' : 
                item.operation === 'delete_file' ? '删除文件' : 
                item.operation === 'defragment' ? '碎片整理' : item.operation,
      耗时: item.duration,
      IO次数: item.ioCount,
      吞吐量: item.throughput,
      文件系统类型: item.fileSystemType,
      算法: item.algorithm,
      时间: item.timestamp
    }))
  )
  
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '性能数据')
  
  // 导出文件
  const fileName = `性能数据_${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(workbook, fileName)
  
  message.success('数据导出成功！')
}
</script>

