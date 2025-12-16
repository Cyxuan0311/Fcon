<template>
  <div class="h-full bg-white overflow-y-auto">
    <div class="p-4">
      <h2 class="text-lg font-semibold mb-4 text-gray-800">操作面板</h2>
      
      <!-- 使用Tabs切换文件系统配置和文件操作 -->
      <Tabs 
        v-model:activeKey="activeTab" 
        type="card"
        class="operation-tabs"
      >
        <!-- 文件系统配置标签页 -->
        <TabPane key="config" tab="文件系统配置">
          <div class="space-y-4 pt-2">
            <!-- 文件导入导出 -->
            <div>
              <div class="mb-2">
                <span class="text-sm text-gray-600 font-medium">文件系统配置</span>
              </div>
              <Space class="w-full" :size="8">
                <div class="flex-1 relative">
                  <input
                    ref="fileInput"
                    type="file"
                    accept=".json"
                    @change="handleFileUpload"
                    class="hidden"
                  />
                  <Button
                    @click.prevent="triggerFileInput"
                    type="primary"
                    class="w-full"
                    :icon="h(UploadOutlined)"
                    size="large"
                  >
                    导入JSON
                  </Button>
                </div>
                <Button
                  @click="exportFileSystemJSON"
                  class="flex-1"
                  :icon="h(DownloadOutlined)"
                  size="large"
                  :disabled="!fileSystemStore.disk || fileSystemStore.disk.totalBlocks === 0"
                >
                  导出JSON
                </Button>
              </Space>
              <p class="text-xs text-gray-400 mt-1">支持导入/导出文件系统配置JSON文件</p>
            </div>
            
            <Divider />
            
            <Form layout="vertical" :model="formData">
              <FormItem label="文件系统类型">
                <Select 
                  v-model:value="fileSystemType" 
                  @change="handleFileSystemChange"
                  size="large"
                  :options="[
                    { label: 'FAT32', value: 'FAT32' },
                    { label: 'Ext4', value: 'Ext4' },
                    { label: 'NTFS', value: 'NTFS' }
                  ]"
                />
              </FormItem>
              
              <FormItem label="总块数">
                <InputNumber 
                  v-model:value="totalBlocks" 
                  class="w-full"
                  size="large"
                  :min="100"
                  :max="10000"
                  placeholder="请输入总块数"
                />
              </FormItem>
              
              <FormItem label="块大小 (KB)">
                <InputNumber 
                  v-model:value="blockSize" 
                  class="w-full"
                  size="large"
                  :min="1"
                  :max="64"
                  placeholder="请输入块大小"
                />
              </FormItem>
            </Form>
            
            <Button 
              @click="initDisk"
              type="primary"
              class="w-full"
              size="large"
              :loading="isProcessing"
            >
              初始化磁盘
            </Button>
          </div>
        </TabPane>
        
        <!-- 文件操作标签页 -->
        <TabPane key="operation" tab="文件操作">
          <div class="space-y-4 pt-2">
            <!-- 当前目录显示和切换 -->
            <Card size="small" class="mb-4">
              <div class="space-y-3">
                <div>
                  <div class="text-xs text-gray-500 mb-1">当前目录</div>
                  <div class="text-base font-medium text-gray-800">
                    {{ getCurrentDirectoryName() }}
                  </div>
                </div>
                
                <Divider class="my-2" />
                
                <div>
                  <div class="text-xs text-gray-500 mb-2">切换到目录</div>
                  <Select
                    v-model:value="selectedDirId"
                    @change="switchDirectory"
                    size="large"
                    class="w-full"
                    :options="[
                      { label: '根目录', value: 'root' },
                      ...allDirectories.map(dir => ({
                        label: getDirectoryPath(dir),
                        value: dir.id
                      }))
                    ]"
                  />
                </div>
                
                <Space class="w-full" :size="8">
                  <Button
                    @click="switchToParent"
                    :disabled="fileSystemStore.currentDirectory === 'root'"
                    size="middle"
                    class="flex-1"
                    :icon="h(UpOutlined)"
                  >
                    上级
                  </Button>
                  <Button
                    @click="switchToRoot"
                    :disabled="fileSystemStore.currentDirectory === 'root'"
                    size="middle"
                    class="flex-1"
                    :icon="h(HomeOutlined)"
                  >
                    根目录
                  </Button>
                </Space>
              </div>
            </Card>
            
            <Form layout="vertical" :model="formData">
              <FormItem label="文件名">
                <Input 
                  v-model:value="fileName" 
                  placeholder="请输入文件名"
                  size="large"
                />
              </FormItem>
              
              <FormItem label="文件大小 (KB)">
                <InputNumber 
                  v-model:value="fileSize" 
                  class="w-full"
                  size="large"
                  :min="1"
                  placeholder="请输入文件大小"
                />
              </FormItem>
              
              <FormItem label="分配算法">
                <Select 
                  v-model:value="allocationAlgorithm" 
                  size="large"
                  :options="[
                    { label: '连续分配', value: 'continuous' },
                    { label: '链接分配', value: 'linked' },
                    { label: '索引分配', value: 'indexed' }
                  ]"
                />
              </FormItem>
            </Form>
            
            <Space direction="vertical" class="w-full" :size="12">
              <Button 
                @click="createFile"
                type="primary"
                class="w-full"
                size="large"
                :loading="isProcessing"
                style="background-color: #52c41a; border-color: #52c41a;"
              >
                创建文件
              </Button>
              <Button 
                @click="deleteFile"
                danger
                class="w-full"
                size="large"
                :disabled="!fileSystemStore.selectedItem"
              >
                删除选中文件
              </Button>
            </Space>
            
            <Divider />
            
            <!-- 碎片整理 -->
            <Button 
              @click="defragment"
              type="primary"
              class="w-full"
              size="large"
              :loading="isProcessing"
              style="background-color: #722ed1; border-color: #722ed1;"
            >
              执行碎片整理
            </Button>
          </div>
        </TabPane>
        
        <!-- 文件目录标签页 -->
        <TabPane key="directory" tab="文件目录">
          <div class="pt-2">
            <DirectoryTree />
          </div>
        </TabPane>
        
        <!-- 性能图表标签页 -->
        <TabPane key="performance" tab="性能图表">
          <div class="pt-2 space-y-4">
            <!-- 统计卡片 -->
            <div class="grid grid-cols-3 gap-3">
              <Card size="small" class="performance-stat-card">
                <div class="stat-item">
                  <div class="stat-label">总操作次数</div>
                  <div class="stat-value">{{ performanceStore.performanceData.length }}</div>
                </div>
              </Card>
              <Card size="small" class="performance-stat-card">
                <div class="stat-item">
                  <div class="stat-label">平均耗时</div>
                  <div class="stat-value">{{ averageDuration }} ms</div>
                </div>
              </Card>
              <Card size="small" class="performance-stat-card">
                <div class="stat-item">
                  <div class="stat-label">总吞吐量</div>
                  <div class="stat-value">{{ totalThroughput }} KB</div>
                </div>
              </Card>
            </div>
            
            <!-- 图表类型切换 -->
            <Card size="small" class="chart-control-card">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-gray-700">图表类型</span>
                <Button 
                  @click="exportData"
                  size="small"
                  type="link"
                  :icon="h(DownloadOutlined)"
                >
                  导出数据
                </Button>
              </div>
              <Button.Group class="w-full">
                <Button 
                  @click="switchChartType('bar')"
                  :type="chartType === 'bar' ? 'primary' : 'default'"
                  class="flex-1"
                  size="middle"
                >
                  操作耗时
                </Button>
                <Button 
                  @click="switchChartType('line')"
                  :type="chartType === 'line' ? 'primary' : 'default'"
                  class="flex-1"
                  size="middle"
                >
                  吞吐趋势
                </Button>
                <Button 
                  @click="switchChartType('pie')"
                  :type="chartType === 'pie' ? 'primary' : 'default'"
                  class="flex-1"
                  size="middle"
                >
                  空间占比
                </Button>
              </Button.Group>
            </Card>
            
            <!-- 图表容器 -->
            <Card size="small" class="chart-card">
              <div ref="chartContainer" class="chart-container"></div>
            </Card>
            
            <!-- 数据表格 -->
            <Card size="small" class="data-table-card">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-gray-700">操作记录</span>
                <span class="text-xs text-gray-500">最近 {{ Math.min(10, performanceStore.performanceData.length) }} 条</span>
              </div>
              <div class="performance-table">
                <table class="w-full">
                  <thead>
                    <tr>
                      <th>操作类型</th>
                      <th>耗时 (ms)</th>
                      <th>IO次数</th>
                      <th>吞吐量 (KB/s)</th>
                      <th>时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="performanceStore.performanceData.length === 0">
                      <td colspan="5" class="text-center text-gray-400 py-4">暂无数据</td>
                    </tr>
                    <tr v-for="item in recentPerformanceData" :key="item.timestamp">
                      <td>
                        <span class="operation-badge" :class="getOperationBadgeClass(item.operation)">
                          {{ getOperationName(item.operation) }}
                        </span>
                      </td>
                      <td>{{ item.duration.toFixed(2) }}</td>
                      <td>{{ item.ioCount || '-' }}</td>
                      <td>{{ item.throughput ? item.throughput.toFixed(2) : '-' }}</td>
                      <td class="text-xs text-gray-500">{{ formatTableTime(item.timestamp) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabPane>
      </Tabs>
    </div>
  </div>
  
  <!-- 导出JSON文件名输入弹窗 -->
  <Modal
    v-model:open="exportModalVisible"
    title="导出JSON文件"
    :width="500"
    @ok="handleExportConfirm"
    @cancel="handleExportCancel"
    okText="确定"
    cancelText="取消"
  >
    <div class="py-4">
      <FormItem label="文件名" :required="true">
        <Input
          v-model:value="exportFileName"
          placeholder="请输入文件名（不含扩展名）"
          size="large"
          @pressEnter="handleExportConfirm"
        />
      </FormItem>
      <p class="text-xs text-gray-400 mt-2">
        文件将保存为: <span class="font-mono">{{ exportFileName || 'filesystem' }}.json</span>
      </p>
    </div>
  </Modal>
</template>

<script setup>
import { ref, watch, computed, h, reactive, onMounted, onUnmounted, onBeforeUnmount, nextTick } from 'vue'
import { UploadOutlined, DownloadOutlined, UpOutlined, HomeOutlined } from '@ant-design/icons-vue'
import { Button, Select, InputNumber, Input, message, Modal, Tabs, Form, Card, Divider, Space } from 'ant-design-vue'
import { useFileSystemStore } from '@/stores/fileSystem'
import { usePerformanceStore } from '@/stores/performance'
import { DataCollector } from '@/data/DataCollector'
import { OperationPanel as OpPanel } from '@/interaction/OperationPanel'
import DirectoryTree from './DirectoryTree.vue'
import { ChartRenderer } from '@/renderer/ChartRenderer'
import { DataProcessor } from '@/data/DataProcessor'
import * as XLSX from 'xlsx'

const { TabPane } = Tabs
const { Item: FormItem } = Form

const fileSystemStore = useFileSystemStore()
const performanceStore = usePerformanceStore()
const dataCollector = new DataCollector()
const operationPanel = new OpPanel()

const fileSystemType = ref('FAT32')
const totalBlocks = ref(1000)
const blockSize = ref(4)
const fileName = ref('')
const fileSize = ref(100)
const allocationAlgorithm = ref('continuous')
const isProcessing = ref(false)
const selectedDirId = ref('root')
const fileInput = ref(null)
const activeTab = ref('config') // 当前激活的标签页

// 性能图表相关
const chartContainer = ref(null)
const chartType = ref('bar') // bar | line | pie
let chartRenderer = null
let resizeObserver = null

// 性能统计计算
const averageDuration = computed(() => {
  const data = performanceStore.performanceData
  if (data.length === 0) return '0.00'
  const sum = data.reduce((acc, item) => acc + item.duration, 0)
  return (sum / data.length).toFixed(2)
})

const totalThroughput = computed(() => {
  const data = performanceStore.performanceData
  if (data.length === 0) return '0.00'
  const sum = data.reduce((acc, item) => acc + (item.throughput || 0), 0)
  return (sum / 1024).toFixed(2) // 转换为KB
})

const recentPerformanceData = computed(() => {
  return performanceStore.performanceData.slice(-10).reverse() // 最近10条，倒序显示
})

// 获取操作名称
const getOperationName = (operation) => {
  const map = {
    'create_file': '创建文件',
    'delete_file': '删除文件',
    'defragment': '碎片整理'
  }
  return map[operation] || operation
}

// 获取操作徽章样式类
const getOperationBadgeClass = (operation) => {
  const map = {
    'create_file': 'badge-success',
    'delete_file': 'badge-danger',
    'defragment': 'badge-warning'
  }
  return map[operation] || ''
}

// 格式化表格时间
const formatTableTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 表单数据
const formData = reactive({
  fileSystemType: 'FAT32',
  totalBlocks: 1000,
  blockSize: 4,
  fileName: '',
  fileSize: 100,
  allocationAlgorithm: 'continuous'
})

// 获取所有目录（用于下拉选择）
const allDirectories = computed(() => {
  return fileSystemStore.files.filter(f => f.type === 'directory')
})

// 获取当前目录名称
const getCurrentDirectoryName = () => {
  if (fileSystemStore.currentDirectory === 'root') {
    return '根目录'
  }
  const dir = fileSystemStore.getFile(fileSystemStore.currentDirectory)
  return dir ? dir.name : '未知目录'
}

// 获取目录路径（用于下拉选择显示）
const getDirectoryPath = (dir) => {
  const path = []
  let currentId = dir.id
  const visited = new Set()
  
  while (currentId && currentId !== 'root' && !visited.has(currentId)) {
    visited.add(currentId)
    const d = fileSystemStore.getFile(currentId)
    if (d && d.type === 'directory') {
      path.unshift(d.name)
      currentId = d.parentId
    } else {
      break
    }
  }
  
  return '/' + path.join('/')
}

// 切换目录
const switchDirectory = () => {
  if (selectedDirId.value) {
    fileSystemStore.setCurrentDirectory(selectedDirId.value)
    // 清除选中项，让可视化根据新目录自动高亮
    fileSystemStore.selectedItem = null
  }
}

// 切换到父目录
const switchToParent = () => {
  const currentDir = fileSystemStore.getFile(fileSystemStore.currentDirectory)
  if (currentDir && currentDir.parentId) {
    fileSystemStore.setCurrentDirectory(currentDir.parentId)
    selectedDirId.value = currentDir.parentId
  } else {
    fileSystemStore.setCurrentDirectory('root')
    selectedDirId.value = 'root'
  }
  // 清除选中项，让可视化根据新目录自动高亮
  fileSystemStore.selectedItem = null
}

// 切换到根目录
const switchToRoot = () => {
  fileSystemStore.setCurrentDirectory('root')
  selectedDirId.value = 'root'
  // 清除选中项，让可视化根据新目录自动高亮
  fileSystemStore.selectedItem = null
}

// 监听当前目录变化，同步selectedDirId
watch(
  () => fileSystemStore.currentDirectory,
  (newDir) => {
    selectedDirId.value = newDir
  },
  { immediate: true }
)

// 监听文件系统类型变化
watch(() => fileSystemStore.fileSystemType, (newType) => {
  fileSystemType.value = newType
})

const handleFileSystemChange = () => {
  fileSystemStore.setFileSystemType(fileSystemType.value)
}

// 导出JSON相关状态
const exportModalVisible = ref(false)
const exportFileName = ref('')

// 导出文件系统JSON - 显示文件名输入弹窗
const exportFileSystemJSON = () => {
  const disk = fileSystemStore.disk
  
  if (!disk || disk.totalBlocks === 0) {
    message.warning('请先初始化磁盘')
    return
  }
  
  // 设置默认文件名
  exportFileName.value = `filesystem_${new Date().toISOString().split('T')[0]}`
  exportModalVisible.value = true
}

// 确认导出
const handleExportConfirm = () => {
  // 验证文件名
  if (!exportFileName.value || exportFileName.value.trim() === '') {
    message.warning('请输入文件名')
    return
  }
  
  // 清理文件名（移除非法字符）
  let fileName = exportFileName.value.trim()
  // 移除文件扩展名（如果用户输入了）
  fileName = fileName.replace(/\.json$/i, '')
  // 移除非法字符
  fileName = fileName.replace(/[<>:"/\\|?*]/g, '_')
  
  if (fileName === '') {
    message.warning('文件名不能为空')
    return
  }
  
  try {
    const disk = fileSystemStore.disk
    
    // 构建JSON数据
    const jsonData = {
      fileSystemType: fileSystemStore.fileSystemType,
      disk: {
        id: disk.id || 'disk-1',
        totalBlocks: disk.totalBlocks,
        blockSize: disk.blockSize,
        fragmentRate: disk.fragmentRate || 0,
        freeBlocks: disk.freeBlocks || [],
        usedBlocks: {}, // usedBlocks不需要导出，可以根据files重建
        files: (disk.files || []).map(file => ({
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          blocks: file.blocks || [],
          parentId: file.parentId || 'root',
          createTime: file.createTime || new Date().toISOString(),
          allocationAlgorithm: file.type === 'file' && file.allocationAlgorithm 
            ? file.allocationAlgorithm 
            : null
        }))
      }
    }
    
    // 转换为JSON字符串
    const jsonString = JSON.stringify(jsonData, null, 2)
    
    // 创建Blob对象
    const blob = new Blob([jsonString], { type: 'application/json' })
    
    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName}.json`
    
    // 触发下载
    document.body.appendChild(link)
    link.click()
    
    // 清理
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    // 关闭弹窗
    exportModalVisible.value = false
    exportFileName.value = ''
    
    message.success('文件系统配置导出成功！')
  } catch (error) {
    console.error('导出JSON错误:', error)
    message.error(`导出失败: ${error.message}`)
  }
}

// 取消导出
const handleExportCancel = () => {
  exportModalVisible.value = false
  exportFileName.value = ''
}

// 触发文件选择
const triggerFileInput = (event) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  if (fileInput.value) {
    fileInput.value.click()
  } else {
    console.error('文件输入元素未找到')
  }
}

// 处理文件上传
const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // 检查文件类型
  if (!file.name.endsWith('.json')) {
    message.warning('请上传JSON格式的文件')
    return
  }
  
  try {
    // 读取文件内容
    const text = await file.text()
    const jsonData = JSON.parse(text)
    
    // 解析并导入文件系统数据
    const result = fileSystemStore.importFromJSON(jsonData)
    
    if (result.success) {
      // 更新UI中的配置值
      fileSystemType.value = result.data.fileSystemType || 'FAT32'
      totalBlocks.value = result.data.totalBlocks || 1000
      blockSize.value = (result.data.blockSize || 4096) / 1024 // 转换为KB
      
      // 更新性能指标
      performanceStore.updateRealtimeMetrics({
        diskUtilization: fileSystemStore.diskUtilization,
        fragmentRate: result.data.fragmentRate || 0
      })
      
      message.success(`文件导入成功！\n- 文件系统: ${result.data.fileSystemType}\n- 总块数: ${result.data.totalBlocks}\n- 块大小: ${result.data.blockSize} 字节\n- 文件数: ${result.data.files?.length || 0}`)
    } else {
      message.error(`文件导入失败: ${result.error}`)
    }
  } catch (error) {
    console.error('文件解析错误:', error)
    message.error(`文件解析失败: ${error.message}\n请确保JSON文件格式正确`)
  } finally {
    // 清空文件输入
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

const initDisk = () => {
  const validation = operationPanel.validateAll({
    totalBlocks: totalBlocks.value,
    blockSize: blockSize.value
  })
  
  if (!validation.valid) {
    message.error(validation.errors[0].message)
    return
  }
  
  // 初始化前，先清除选中项，避免显示旧的块高亮
  fileSystemStore.selectedItem = null
  
  fileSystemStore.initDisk(totalBlocks.value, blockSize.value * 1024)
  
  // 强制触发磁盘更新（通过重新赋值触发响应式更新）
  const disk = fileSystemStore.disk
  fileSystemStore.disk = { ...disk }
  
  performanceStore.updateRealtimeMetrics({
    diskUtilization: 0,
    fragmentRate: 0
  })
  message.success('磁盘初始化成功！')
}

const createFile = async () => {
  if (isProcessing.value) return
  
  const validation = operationPanel.validateAll({
    fileName: fileName.value,
    fileSize: fileSize.value
  }, { disk: fileSystemStore.disk })
  
  if (!validation.valid) {
    message.error(validation.errors[0].message)
    return
  }
  
  isProcessing.value = true
  dataCollector.startOperation()
  
  try {
    const result = fileSystemStore.createFile({
      name: fileName.value,
      size: fileSize.value * 1024, // 转换为字节
      type: 'file',
      parentId: fileSystemStore.currentDirectory // 使用当前目录
    }, allocationAlgorithm.value)
    
    if (result.success) {
      const perfData = dataCollector.endOperation(
        'create_file',
        fileSystemStore.fileSystemType,
        allocationAlgorithm.value
      )
      performanceStore.addPerformanceData(perfData)
      performanceStore.updateRealtimeMetrics({
        diskUtilization: fileSystemStore.diskUtilization,
        fragmentRate: fileSystemStore.disk.fragmentRate
      })
      
      fileName.value = ''
      fileSize.value = 100
      message.success('文件创建成功！')
    } else {
      message.error(`创建失败: ${result.error}`)
    }
  } catch (error) {
    message.error(`创建失败: ${error.message}`)
  } finally {
    isProcessing.value = false
  }
}

const deleteFile = async () => {
  if (isProcessing.value) return
  
  if (!fileSystemStore.selectedItem) {
    message.warning('请先选择要删除的文件')
    return
  }
  
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除文件 "${fileSystemStore.selectedItem.name}" 吗？`,
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      if (isProcessing.value) return
      
      isProcessing.value = true
      dataCollector.startOperation()
      
      try {
        // 在删除前保存选中项的信息，因为删除后 selectedItem 会被清空
        const selectedItem = fileSystemStore.selectedItem
        const fileId = selectedItem.id
        const allocationAlgorithm = selectedItem.allocationAlgorithm || 'continuous' // 默认为连续分配
        
        const result = fileSystemStore.deleteFile(fileId)
        
        if (result.success) {
          // 删除文件后，立即将对应的磁盘块置灰
          // 通过触发磁盘更新来实现，但需要先置灰对应的块
          // 注意：这里需要在 ThreeDVisualization 中监听文件删除
          // 为了立即响应，我们通过更新磁盘来触发可视化更新
          const disk = fileSystemStore.disk
          fileSystemStore.disk = { ...disk }
          
          const perfData = dataCollector.endOperation(
            'delete_file',
            fileSystemStore.fileSystemType,
            allocationAlgorithm
          )
          performanceStore.addPerformanceData(perfData)
          performanceStore.updateRealtimeMetrics({
            diskUtilization: fileSystemStore.diskUtilization,
            fragmentRate: fileSystemStore.disk.fragmentRate
          })
          
          message.success('文件删除成功！')
        } else {
          message.error(`删除失败: ${result.error}`)
        }
      } catch (error) {
        message.error(`删除失败: ${error.message}`)
      } finally {
        isProcessing.value = false
      }
    }
  })
}

const defragment = async () => {
  if (isProcessing.value) return
  
  if (fileSystemStore.disk.fragmentRate < 5) {
    message.info('碎片率较低，无需整理')
    return
  }
  
  Modal.confirm({
    title: '确认碎片整理',
    content: '确定要执行碎片整理吗？这可能需要一些时间。',
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      if (isProcessing.value) return
      
      isProcessing.value = true
      dataCollector.startOperation()
      
      try {
        // 碎片整理前，先清除选中项，避免显示旧的块高亮
        fileSystemStore.selectedItem = null
        
        const result = fileSystemStore.defragment()
        
        if (result.success) {
          // 强制触发磁盘更新（通过重新赋值触发响应式更新）
          const disk = fileSystemStore.disk
          fileSystemStore.disk = { ...disk }
          
          const perfData = dataCollector.endOperation(
            'defragment',
            fileSystemStore.fileSystemType,
            'compact'
          )
          performanceStore.addPerformanceData(perfData)
          performanceStore.updateRealtimeMetrics({
            fragmentRate: fileSystemStore.disk.fragmentRate
          })
          
          message.success(`碎片整理完成！移动了 ${result.movedBlocks} 个块，碎片率降至 ${fileSystemStore.disk.fragmentRate.toFixed(2)}%`)
        } else {
          message.error(`碎片整理失败: ${result.error}`)
        }
      } catch (error) {
        message.error(`碎片整理失败: ${error.message}`)
      } finally {
        isProcessing.value = false
      }
    }
  })
}

// 性能图表相关方法
const switchChartType = (type) => {
  chartType.value = type
  updateChart()
}

const updateChart = () => {
  if (!chartRenderer || !chartRenderer.chart) return
  
  const data = performanceStore.performanceData
  if (data.length === 0) {
    // 显示空状态 - B端风格
    chartRenderer.updateChart({
      title: { 
        text: '暂无数据', 
        left: 'center',
        top: 'middle',
        textStyle: {
          color: '#8c8c8c',
          fontSize: 14,
          fontWeight: 'normal'
        }
      },
      graphic: {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: '暂无性能数据',
          fontSize: 13,
          fill: '#bfbfbf'
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

// 初始化图表
const initChart = async () => {
  await nextTick()
  
  if (chartContainer.value) {
    // 确保容器有尺寸
    const checkContainer = () => {
      if (chartContainer.value && chartContainer.value.clientWidth > 0 && chartContainer.value.clientHeight > 0) {
        if (!chartRenderer) {
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
          updateChart()
        }
      } else {
        // 如果容器还没有尺寸，延迟重试
        setTimeout(checkContainer, 100)
      }
    }
    
    checkContainer()
  }
}

// 监听标签页切换，初始化图表
watch(
  () => activeTab.value,
  async (newTab) => {
    if (newTab === 'performance') {
      await nextTick()
      initChart()
    }
  },
  { immediate: true }
)

// 监听性能数据变化，更新图表
watch(
  () => performanceStore.performanceData,
  () => {
    if (activeTab.value === 'performance') {
      updateChart()
    }
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
    // 如果当前是饼图且性能标签页激活，实时更新
    if (chartType.value === 'pie' && activeTab.value === 'performance') {
      updateChart()
    }
  },
  { deep: true, immediate: true }
)

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
</script>

<style scoped>
.operation-tabs :deep(.ant-tabs-content-holder) {
  padding-top: 16px;
}

.operation-tabs :deep(.ant-tabs-tab) {
  padding: 8px 16px;
  font-weight: 500;
}

.operation-tabs :deep(.ant-tabs-tab-active) {
  font-weight: 600;
}

.operation-tabs :deep(.ant-form-item-label > label) {
  font-weight: 500;
  color: #262626;
}

.operation-tabs :deep(.ant-card) {
  background: #fafafa;
  border: 1px solid #e8e8e8;
}

.operation-tabs :deep(.ant-card-body) {
  padding: 16px;
}

.operation-tabs :deep(.ant-divider) {
  margin: 16px 0;
}

/* B端性能图表样式 */
.performance-stat-card {
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  transition: all 0.3s;
}

.performance-stat-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
  font-weight: 400;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #262626;
  line-height: 1.2;
}

.chart-control-card {
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.chart-card {
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  min-height: 320px;
}

.chart-container {
  width: 100%;
  height: 300px;
  min-height: 300px;
}

.data-table-card {
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.performance-table {
  overflow-x: auto;
}

.performance-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.performance-table thead {
  background-color: #fafafa;
}

.performance-table th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #262626;
  border-bottom: 1px solid #e8e8e8;
  font-size: 12px;
  white-space: nowrap;
}

.performance-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
  color: #595959;
}

.performance-table tbody tr:hover {
  background-color: #fafafa;
}

.performance-table tbody tr:last-child td {
  border-bottom: none;
}

.operation-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 2px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
}

.badge-success {
  background-color: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.badge-danger {
  background-color: #fff2f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}

.badge-warning {
  background-color: #fffbe6;
  color: #faad14;
  border: 1px solid #ffe58f;
}
</style>
