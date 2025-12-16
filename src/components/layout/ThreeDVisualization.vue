<template>
  <div class="w-full h-full relative bg-gray-900">
    <!-- 左侧切换按钮 -->
    <div v-if="!showTerminal" class="view-switcher">
      <div class="view-switcher-content">
        <button
          :class="['view-switch-btn', { active: currentView === 'disk' }]"
          @click="switchView('disk')"
          title="磁盘可视化"
        >
          <DatabaseOutlined />
          <span>磁盘</span>
        </button>
        <button
          :class="['view-switch-btn', { active: currentView === 'tree' }]"
          @click="switchView('tree')"
          title="文件结构可视化"
        >
          <ApartmentOutlined />
          <span>结构</span>
        </button>
        <button
          :class="['view-switch-btn', { active: currentView === 'index' }]"
          @click="switchView('index')"
          title="索引可视化"
        >
          <FileSearchOutlined />
          <span>索引</span>
        </button>
      </div>
    </div>
    
    <!-- 索引可视化搜索框 -->
    <div v-if="currentView === 'index' && !showTerminal" class="index-search-box">
      <div class="search-box-content">
        <SearchOutlined class="search-icon" />
        <input
          ref="searchInputRef"
          v-model="searchFileName"
          @input="handleSearchInput"
          @keydown.enter="handleSearchInput"
          @keydown.ctrl.a.prevent="selectAllText"
          @dblclick="selectAllText"
          type="text"
          placeholder="输入文件名进行搜索..."
          class="search-input"
        />
        <button
          v-if="searchFileName"
          @click="clearSearch"
          class="clear-btn"
          title="清空搜索"
        >
          <CloseOutlined />
        </button>
      </div>
      <div v-if="searchedFile" class="search-result-info">
        <span class="result-label">找到文件：</span>
        <span class="result-name">{{ searchedFile.name }}</span>
        <span class="result-algorithm">（{{ getAlgorithmName(searchedFile.allocationAlgorithm) }}）</span>
      </div>
    </div>
    
    <!-- 状态面板 - 显示当前选中的文件/文件夹信息 -->
    <div class="status-panel">
      <div class="status-panel-content">
        <div class="status-item">
          <span class="status-label">当前选中：</span>
          <span v-if="currentSelectedFile" class="status-value">
            <span :class="['file-type-badge', currentSelectedFile.type === 'file' ? 'file-badge' : 'dir-badge']">
              {{ currentSelectedFile.type === 'file' ? '文件' : '文件夹' }}
            </span>
            <span class="file-name">{{ currentSelectedFile.name }}</span>
            <span v-if="currentSelectedFile.type === 'file'" class="file-size">
              ({{ formatFileSize(currentSelectedFile.size) }})
            </span>
            <span v-if="currentSelectedFile.blocks && currentSelectedFile.blocks.length > 0" class="file-blocks">
              - 占用 {{ currentSelectedFile.blocks.length }} 个块
            </span>
          </span>
          <span v-else class="status-value empty">未选中</span>
        </div>
        <div v-if="hoveredFile" class="status-item hover-info">
          <span class="status-label">鼠标悬停：</span>
          <span class="status-value">
            <span :class="['file-type-badge', hoveredFile.type === 'file' ? 'file-badge' : 'dir-badge']">
              {{ hoveredFile.type === 'file' ? '文件' : '文件夹' }}
            </span>
            <span class="file-name">{{ hoveredFile.name }}</span>
          </span>
        </div>
        <div v-if="selectedConnection" class="status-item connection-info">
          <span class="status-label">连接关系：</span>
          <span class="status-value">
            <span class="connection-arrow">→</span>
            <span :class="['file-type-badge', selectedConnection.parent.type === 'file' ? 'file-badge' : 'dir-badge']">
              {{ selectedConnection.parent.type === 'file' ? '文件' : '文件夹' }}
            </span>
            <span class="file-name">{{ selectedConnection.parent.name }}</span>
            <span class="connection-arrow">→</span>
            <span :class="['file-type-badge', selectedConnection.child.type === 'file' ? 'file-badge' : 'dir-badge']">
              {{ selectedConnection.child.type === 'file' ? '文件' : '文件夹' }}
            </span>
            <span class="file-name">{{ selectedConnection.child.name }}</span>
          </span>
        </div>
      </div>
    </div>
    
    <!-- 3D可视化容器 -->
    <div ref="containerRef" class="w-full h-full"></div>
    
    <!-- 侧边栏目录树 - 毛玻璃效果 -->
    <div class="directory-tree-panel">
      <div class="directory-tree-header">
        <h3 class="directory-tree-title">
          <FolderOutlined class="text-blue-500" />
          文件目录
        </h3>
      </div>
      <div class="directory-tree-content">
        <SimpleDirectoryTree 
          @select="handleFileSelect"
          :selected-id="fileSystemStore.selectedItem?.id"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { FolderOutlined, DatabaseOutlined, ApartmentOutlined, FileSearchOutlined, SearchOutlined, CloseOutlined } from '@ant-design/icons-vue'
import { useFileSystemStore } from '@/stores/fileSystem'
import { ThreeDRenderer } from '@/renderer/ThreeDRenderer'
import { clearFileColors } from '@/utils/colorGenerator'
import SimpleDirectoryTree from './SimpleDirectoryTree.vue'

const props = defineProps({
  showTerminal: {
    type: Boolean,
    default: false
  }
})

const containerRef = ref(null)
const fileSystemStore = useFileSystemStore()
let renderer = null
let currentlyHighlightedFileId = null // 跟踪当前高亮的文件ID

// 视图切换
const currentView = ref('disk') // 'disk'、'tree' 或 'index'

// 状态面板相关
const currentSelectedFile = ref(null)
const hoveredFile = ref(null)
const selectedConnection = ref(null) // 选中的连接关系

// 索引可视化相关
const searchFileName = ref('')
const searchedFile = ref(null)
const searchInputRef = ref(null)

// 切换视图
const switchView = (view) => {
  if (currentView.value === view) return
  currentView.value = view
  selectedConnection.value = null // 清除连接选择
  
  if (renderer) {
    if (view === 'disk') {
      // 切换到磁盘可视化：显示磁盘块，隐藏文件结构树和索引可视化
      renderer.showDiskView()
      renderer.hideIndexVisualization()
    } else if (view === 'tree') {
      // 切换到文件结构可视化：隐藏磁盘块，显示文件结构树
      // 如果树不存在，先创建
      if (!renderer.fileStructureTree && fileSystemStore.files.length > 0) {
        renderer.createFileStructureTree(fileSystemStore.files)
      }
      renderer.showTreeView()
      renderer.hideIndexVisualization()
    } else if (view === 'index') {
      // 切换到索引可视化：隐藏磁盘块和文件结构树
      renderer.hideDiskView()
      if (renderer.fileStructureTree) {
        renderer.fileStructureTree.visible = false
      }
      renderer.showIndexVisualization()
      // 如果有搜索的文件，显示其索引可视化
      if (searchedFile.value) {
        renderer.visualizeFileIndex(searchedFile.value)
      }
      // 自动聚焦搜索框
      nextTick(() => {
        if (searchInputRef.value) {
          searchInputRef.value.focus()
        }
      })
    }
  }
}

// 处理搜索输入
const handleSearchInput = () => {
  if (!searchFileName.value.trim()) {
    clearSearch()
    return
  }
  
  // 在文件列表中搜索匹配的文件
  const files = fileSystemStore.files
  const searchTerm = searchFileName.value.trim().toLowerCase()
  
  const foundFile = files.find(file => 
    file.type === 'file' && 
    file.name.toLowerCase().includes(searchTerm)
  )
  
  if (foundFile) {
    searchedFile.value = foundFile
    if (renderer && currentView.value === 'index') {
      renderer.visualizeFileIndex(foundFile)
    }
  } else {
    searchedFile.value = null
    if (renderer && currentView.value === 'index') {
      renderer.clearIndexVisualization()
    }
  }
}

// 清空搜索
const clearSearch = () => {
  searchFileName.value = ''
  searchedFile.value = null
  if (renderer && currentView.value === 'index') {
    renderer.clearIndexVisualization()
  }
  // 清空后重新聚焦输入框
  if (searchInputRef.value) {
    searchInputRef.value.focus()
  }
}

// 全选文本
const selectAllText = (event) => {
  if (searchInputRef.value) {
    event.preventDefault()
    searchInputRef.value.select()
  }
}

// 获取分配算法名称
const getAlgorithmName = (algorithm) => {
  const names = {
    'continuous': '连续分配',
    'linked': '链式分配',
    'indexed': '索引分配'
  }
  return names[algorithm] || '未知'
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// 处理文件选择（从目录树选择时触发）
const handleFileSelect = (file) => {
  if (!file) return
  
  // 实现切换行为：如果点击的是已选中的项，收起；否则弹出
  if (fileSystemStore.selectedItem?.id === file.id && currentlyHighlightedFileId === file.id) {
    // 点击已选中的项，收起
    fileSystemStore.selectedItem = null
    currentlyHighlightedFileId = null
    if (renderer) {
      renderer.resetAllBlocks()
    }
  } else {
    // 点击新的项，弹出
  fileSystemStore.selectedItem = file
    currentlyHighlightedFileId = file.id
    
  if (renderer && file) {
      // 确保磁盘块已创建后再触发弹出效果
      if (renderer.diskBlocks && renderer.diskBlocks.length > 0) {
        // 只有从目录树选择时才触发磁盘块弹出效果
        renderer.highlightFileBlocks(file)
      } else {
        // 如果磁盘块还没创建，快速重试（减少延迟时间）
        setTimeout(() => {
          if (renderer && renderer.diskBlocks && renderer.diskBlocks.length > 0 && fileSystemStore.selectedItem?.id === file.id) {
    renderer.highlightFileBlocks(file)
          }
        }, 50) // 从100ms减少到50ms
      }
    }
  }
}

onMounted(() => {
  if (containerRef.value) {
    renderer = new ThreeDRenderer(containerRef.value)
    renderer.init()
    
    // 设置选中回调（从3D场景点击时，只更新选中项，不触发弹出效果）
    renderer.setOnSelectCallback((file) => {
      fileSystemStore.selectedItem = file
      // 注意：这里不调用 highlightFileBlocks，弹出效果只在目录树选择时触发
    })
    
    // 设置悬停回调（鼠标悬停在磁盘块上时）
    if (renderer.setOnHoverCallback) {
      renderer.setOnHoverCallback((file) => {
        hoveredFile.value = file
      })
    }
    
    // 设置连接线选择回调
    if (renderer.setOnConnectionSelectCallback) {
      renderer.setOnConnectionSelectCallback((connection) => {
        selectedConnection.value = connection
        // 清除文件选择，因为选择了连接线
        currentSelectedFile.value = null
        fileSystemStore.selectedItem = null
      })
    }
    
    // 初始化磁盘可视化
    if (fileSystemStore.disk.totalBlocks > 0) {
      renderer.createDisk(fileSystemStore.disk)
    }
    
    // 根据当前视图显示相应内容（默认是磁盘视图）
    if (currentView.value === 'disk') {
      renderer.showDiskView()
      // 确保文件结构树被隐藏（如果存在）
      if (renderer.fileStructureTree) {
        renderer.fileStructureTree.visible = false
      }
    } else {
      // 初始化文件结构树
      if (fileSystemStore.files.length > 0) {
        renderer.createFileStructureTree(fileSystemStore.files)
      }
      renderer.showTreeView()
    }
  }
})

onUnmounted(() => {
  if (renderer) {
    renderer.dispose()
  }
})

// 监听磁盘变化，更新可视化
watch(
  () => fileSystemStore.disk,
  (newDisk, oldDisk) => {
    if (renderer && newDisk.totalBlocks > 0) {
      // 判断是否需要重新创建磁盘
      // 1. 如果磁盘块还没有创建
      // 2. 如果旧磁盘总块数为0（首次初始化）
      // 3. 如果总块数发生变化
      // 4. 如果块大小发生变化（重新配置参数）
      // 5. 如果文件列表为空（重新初始化磁盘）
      const shouldRecreate = 
        renderer.diskBlocks.length === 0 || 
        !oldDisk || oldDisk.totalBlocks === 0 ||
        oldDisk.totalBlocks !== newDisk.totalBlocks ||
        oldDisk.blockSize !== newDisk.blockSize ||
        (newDisk.files && newDisk.files.length === 0 && oldDisk.files && oldDisk.files.length > 0)
      
      if (shouldRecreate) {
        // 重新配置磁盘：先置灰所有块，然后重新创建
        if (renderer.grayAllBlocks) {
          renderer.grayAllBlocks()
        }
        
        clearFileColors() // 清除所有文件颜色映射
        renderer.createDisk(newDisk)
        
        // 根据当前视图显示相应内容
        if (currentView.value === 'disk') {
          renderer.showDiskView()
        } else {
          // 如果当前是树视图，创建文件结构树
          if (newDisk.files && newDisk.files.length > 0) {
            renderer.createFileStructureTree(newDisk.files)
          }
          renderer.showTreeView()
        }
        
        // 调整相机位置以适应新的磁盘大小
        renderer.adjustCameraForDisk(newDisk)
        // 应用当前目录的过滤
        renderer.filterBlocksByDirectory(fileSystemStore.currentDirectory, false)
        // 初始化后不应该有选中的项，因为文件列表为空
      } else {
        // 碎片整理或其他更新操作：先置灰所有块，然后更新
        if (renderer.grayAllBlocks) {
          renderer.grayAllBlocks()
        }
        
        // 等待置灰完成后再更新块的颜色
        setTimeout(() => {
          if (renderer) {
            renderer.updateDiskBlocks(newDisk, true) // 使用动画更新块的颜色
            
            // 等待块状态更新完成后再应用过滤和高亮
            setTimeout(() => {
              if (renderer) {
                // 应用当前目录的过滤
                renderer.filterBlocksByDirectory(fileSystemStore.currentDirectory, true)
                // 如果已有选中的项，触发弹出效果
                if (fileSystemStore.selectedItem) {
                  setTimeout(() => {
                    if (renderer && fileSystemStore.selectedItem) {
                      renderer.highlightFileBlocks(fileSystemStore.selectedItem)
                    }
                  }, 50)
                }
              }
            }, 150) // 等待颜色更新完成
          }
        }, 100) // 等待置灰完成
      }
    } else if (renderer && newDisk.totalBlocks === 0) {
      // 如果总块数为0，清除所有磁盘块
      if (renderer.resetAllBlocks) {
        renderer.resetAllBlocks()
      }
      renderer.diskBlocks.forEach(block => {
        if (block && block.parent) {
          renderer.scene.remove(block)
        }
      })
      renderer.diskBlocks = []
      if (renderer.highlightedBlocks) {
        renderer.highlightedBlocks.clear()
      }
    }
  },
  { deep: true, immediate: true }
)

// 监听文件列表变化，更新目录树
watch(
  () => fileSystemStore.files,
  (newFiles, oldFiles) => {
    if (renderer) {
      // 只在树视图下才创建/更新文件结构树
      if (currentView.value === 'tree' && newFiles.length > 0) {
        renderer.createFileStructureTree(newFiles)
      } else {
        // 如果在磁盘视图下，确保文件结构树被隐藏
        if (renderer.fileStructureTree) {
          renderer.fileStructureTree.visible = false
        }
      }
      
      // 如果文件数量减少（可能是删除了文件），需要置灰对应的块
      if (oldFiles && oldFiles.length > newFiles.length) {
        // 找出被删除的文件
        const deletedFiles = oldFiles.filter(oldFile => 
          !newFiles.find(newFile => newFile.id === oldFile.id)
        )
        
        // 将被删除的文件对应的块置灰
        deletedFiles.forEach(deletedFile => {
          if (renderer.grayFileBlocks) {
            renderer.grayFileBlocks(deletedFile)
          }
        })
        
        // 等待磁盘状态更新后，再更新所有块的颜色，确保删除的块和空闲块颜色完全一致
        setTimeout(() => {
          if (renderer && fileSystemStore.disk) {
            // 直接更新块的颜色，使用 getBlockColor 确保颜色一致
            renderer.diskBlocks.forEach((block, index) => {
              if (block && block.material && index < fileSystemStore.disk.totalBlocks) {
                const targetColor = renderer.getBlockColor(fileSystemStore.disk, index)
                block.material.color.setHex(targetColor)
                // 更新块的文件信息
                const file = fileSystemStore.disk.usedBlocks && fileSystemStore.disk.usedBlocks[index]
                block.userData.file = file || null
              }
            })
            // 应用当前目录的过滤
            renderer.filterBlocksByDirectory(fileSystemStore.currentDirectory, false)
          }
        }, 100) // 等待磁盘状态完全更新
      }
    }
  },
  { deep: true }
)

// 监听选中项变化，只在取消选择时重置块（不触发弹出效果）
// 弹出效果只在目录树选择时通过 handleFileSelect 触发
watch(
  () => fileSystemStore.selectedItem,
  (newItem, oldItem) => {
    // 更新状态面板显示的选中文件
    currentSelectedFile.value = newItem
    
    // 如果选中了文件，清除连接线选择
    if (newItem) {
      selectedConnection.value = null
      if (renderer && renderer.resetConnectionLines) {
        renderer.resetConnectionLines()
      }
    }
    
    // 如果选中项被清除（从有值变为null），重置所有块
    if (renderer && !newItem && oldItem) {
      renderer.resetAllBlocks()
      currentlyHighlightedFileId = null
    } else if (!newItem) {
      currentlyHighlightedFileId = null
    }
    // 注意：不在这里触发 highlightFileBlocks，弹出效果只在目录树选择时触发
  },
  { immediate: true }
)

// 监听当前目录变化，更新磁盘块显示（只显示当前目录下的文件块）
watch(
  () => fileSystemStore.currentDirectory,
  (newDir, oldDir) => {
    if (renderer && newDir !== undefined) {
      // 根据当前目录过滤显示磁盘块
      renderer.filterBlocksByDirectory(newDir, true)
    }
  },
  { immediate: true }
)

// 监听视图切换，自动聚焦搜索框
watch(
  () => currentView.value,
  (newView) => {
    if (newView === 'index' && !props.showTerminal) {
      // 延迟聚焦，确保DOM已更新
      nextTick(() => {
        setTimeout(() => {
          if (searchInputRef.value) {
            searchInputRef.value.focus()
            // 如果有文本，选中所有文本以便快速替换
            if (searchFileName.value) {
              searchInputRef.value.select()
            }
          }
        }, 100)
      })
    }
  }
)

// 监听终端显示状态，当终端关闭且当前在索引视图时，聚焦搜索框
watch(
  () => props.showTerminal,
  (isTerminalOpen) => {
    if (!isTerminalOpen && currentView.value === 'index') {
      nextTick(() => {
        setTimeout(() => {
          if (searchInputRef.value) {
            searchInputRef.value.focus()
          }
        }, 100)
      })
    }
  }
)
</script>

<style scoped>
/* 状态面板样式 */
.status-panel {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  min-width: 400px;
  max-width: 800px;
}

.status-panel-content {
  /* 毛玻璃效果 */
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.status-item.hover-info {
  opacity: 0.8;
  font-size: 0.8125rem;
}

.status-label {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.status-value {
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.status-value.empty {
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
}

.file-type-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.file-badge {
  background: rgba(59, 130, 246, 0.3);
  color: rgba(147, 197, 253, 1);
  border: 1px solid rgba(59, 130, 246, 0.5);
}

.dir-badge {
  background: rgba(16, 185, 129, 0.3);
  color: rgba(110, 231, 183, 1);
  border: 1px solid rgba(16, 185, 129, 0.5);
}

.file-name {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.file-size {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8125rem;
}

.file-blocks {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8125rem;
}

.status-item.connection-info {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 0.5rem;
  margin-top: 0.5rem;
}

.connection-arrow {
  color: rgba(88, 166, 255, 0.8);
  font-size: 1rem;
  margin: 0 0.5rem;
  font-weight: 600;
}

.directory-tree-panel {
  position: absolute;
  top: 1rem;
  left: 1rem;
  width: 12rem;
  max-height: calc(100% - 2rem);
  display: flex;
  flex-direction: column;
  
  /* 毛玻璃效果 */
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  overflow: hidden;
}

.directory-tree-header {
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.1);
}

.directory-tree-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

.directory-tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

/* 滚动条样式 */
.directory-tree-content::-webkit-scrollbar {
  width: 6px;
}

.directory-tree-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.directory-tree-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.directory-tree-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* 视图切换器样式 */
.view-switcher {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 200;
}

.view-switcher-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  
  /* 毛玻璃效果 */
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  padding: 0.5rem;
}

.view-switch-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.75rem 0.5rem;
  min-width: 60px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.75rem;
}

.view-switch-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.3);
}

.view-switch-btn.active {
  background: rgba(59, 130, 246, 0.3);
  color: rgba(147, 197, 253, 1);
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
}

.view-switch-btn span {
  font-size: 0.75rem;
  font-weight: 500;
}

/* 索引搜索框样式 */
.index-search-box {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  width: 90%;
  max-width: 600px;
}

.search-box-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
}

.search-icon {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  padding: 0.25rem 0;
  /* 确保文本可以选中 */
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  /* 优化文本选中样式 */
  cursor: text;
  /* 选中文本的背景色 */
  transition: color 0.2s;
}

.search-input::selection {
  background-color: rgba(59, 130, 246, 0.6);
  color: rgba(255, 255, 255, 1);
}

.search-input::-moz-selection {
  background-color: rgba(59, 130, 246, 0.6);
  color: rgba(255, 255, 255, 1);
}

.search-input:focus {
  color: rgba(255, 255, 255, 1);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.clear-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.clear-btn:hover {
  color: rgba(255, 255, 255, 0.9);
}

.search-result-info {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(59, 130, 246, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
}

.result-label {
  color: rgba(255, 255, 255, 0.7);
}

.result-name {
  color: rgba(147, 197, 253, 1);
  font-weight: 600;
  margin: 0 0.25rem;
}

.result-algorithm {
  color: rgba(251, 188, 5, 1);
  font-weight: 500;
}
</style>

