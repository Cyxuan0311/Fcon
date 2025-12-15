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
            <!-- 文件上传 -->
            <div>
              <div class="mb-2">
                <span class="text-sm text-gray-600 font-medium">导入示例文件</span>
              </div>
              <div class="relative">
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
                  上传JSON文件
                </Button>
              </div>
              <p class="text-xs text-gray-400 mt-1">支持导入文件系统配置JSON文件</p>
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
          </div>
        </TabPane>
        
        <!-- 文件目录标签页 -->
        <TabPane key="directory" tab="文件目录">
          <div class="pt-2">
            <DirectoryTree />
          </div>
        </TabPane>
      </Tabs>
      
      <!-- 碎片整理 -->
      <div class="mt-4 pt-4 border-t border-gray-200">
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
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, h, reactive } from 'vue'
import { UploadOutlined, UpOutlined, HomeOutlined } from '@ant-design/icons-vue'
import { Button, Select, InputNumber, Input, message, Modal, Tabs, Form, Card, Divider, Space } from 'ant-design-vue'
import { useFileSystemStore } from '@/stores/fileSystem'
import { usePerformanceStore } from '@/stores/performance'
import { DataCollector } from '@/data/DataCollector'
import { OperationPanel as OpPanel } from '@/interaction/OperationPanel'
import DirectoryTree from './DirectoryTree.vue'

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
}

// 切换到根目录
const switchToRoot = () => {
  fileSystemStore.setCurrentDirectory('root')
  selectedDirId.value = 'root'
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
  
  fileSystemStore.initDisk(totalBlocks.value, blockSize.value * 1024)
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
        const result = fileSystemStore.deleteFile(fileSystemStore.selectedItem.id)
        
        if (result.success) {
          const perfData = dataCollector.endOperation(
            'delete_file',
            fileSystemStore.fileSystemType,
            fileSystemStore.selectedItem.allocationAlgorithm
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
        const result = fileSystemStore.defragment()
        
        if (result.success) {
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
</style>
