<template>
  <div class="h-full overflow-y-auto">
    <!-- 当前路径导航 -->
    <div class="mb-4 bg-gray-50 border border-gray-200 p-3 rounded-lg">
      <div class="flex items-center gap-2 text-sm">
        <span class="text-gray-500">当前路径:</span>
        <div class="flex items-center gap-1 flex-wrap">
          <button
            @click="navigateTo('root')"
            class="hover:text-blue-600 transition-colors text-gray-700"
            :class="currentPath === 'root' ? 'text-blue-600 font-semibold' : ''"
          >
            根目录
          </button>
          <template v-for="(dir, index) in pathList" :key="dir.id">
            <span class="text-gray-400">/</span>
            <button
              @click="navigateTo(dir.id)"
              class="hover:text-blue-600 transition-colors text-gray-700"
              :class="index === pathList.length - 1 ? 'text-blue-600 font-semibold' : ''"
            >
              {{ dir.name }}
            </button>
          </template>
        </div>
      </div>
    </div>
    
    <!-- 搜索框 -->
    <div class="mb-4">
      <Input
        v-model:value="searchKeyword"
        placeholder="搜索文件或目录..."
        size="large"
        :prefix="h(SearchOutlined)"
        allow-clear
        @clear="handleSearchClear"
      />
      <div v-if="searchKeyword && searchResults.length > 0" class="mt-2 text-xs text-gray-500">
        找到 {{ searchResults.length }} 个结果
      </div>
      <div v-if="searchKeyword && searchResults.length === 0" class="mt-2 text-xs text-gray-400">
        未找到匹配的结果
      </div>
    </div>
    
    <!-- 目录操作按钮 -->
    <div class="mb-4 flex gap-2">
      <Button
        @click="showCreateDirDialog = true"
        type="primary"
        class="flex-1"
        :icon="h(FolderAddOutlined)"
        size="middle"
      >
        新建目录
      </Button>
      <Button
        v-if="currentPath !== 'root' && !searchKeyword"
        @click="navigateToParent"
        class="flex-1"
        :icon="h(UpOutlined)"
        size="middle"
      >
        返回上级
      </Button>
    </div>
    
    <!-- 文件目录列表 -->
    <div class="space-y-1">
      <div
        v-for="item in displayItems"
        :key="item.id"
        @click="handleItemClick(item)"
        @dblclick="handleItemDoubleClick(item)"
        class="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-200"
        :class="selectedItem?.id === item.id ? 'bg-blue-50 border-blue-200' : ''"
      >
        <component 
          :is="item.type === 'directory' ? FolderOutlined : FileOutlined"
          class="text-lg"
          :class="item.type === 'directory' ? 'text-blue-500' : 'text-gray-600'"
        />
        <div class="flex-1 min-w-0">
          <div class="font-medium truncate flex items-center gap-2 text-gray-800">
            <span>{{ item.name }}</span>
            <Button
              v-if="item.type === 'directory'"
              @click.stop="navigateTo(item.id)"
              size="small"
              type="link"
              class="opacity-0 group-hover:opacity-100 transition-opacity p-0 h-auto"
              :icon="h(RightOutlined)"
              title="进入目录"
            >
            </Button>
          </div>
          <div class="text-xs text-gray-500">
            <span v-if="searchKeyword && searchKeyword.trim() !== ''" class="text-gray-400">
              {{ getItemPath(item) }}
            </span>
            <template v-else>
              <span v-if="item.type === 'file'">{{ formatSize(item.size) }}</span>
              <span v-else>{{ getChildCount(item.id) }} 项</span>
              <span class="ml-2">{{ formatTime(item.createTime) }}</span>
            </template>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <Button
            v-if="item.type === 'directory'"
            @click.stop="handleDeleteDirectory(item)"
            size="small"
            type="text"
            danger
            class="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
            :icon="h(DeleteOutlined)"
            title="删除目录"
          >
          </Button>
          <span
            class="w-3 h-3 rounded-full border border-gray-300"
            :style="{ backgroundColor: getItemColor(item.id) }"
          ></span>
        </div>
      </div>
      
      <div v-if="displayItems.length === 0 && !searchKeyword" class="text-center text-gray-400 py-8 text-sm">
        当前目录为空
      </div>
      <div v-if="displayItems.length === 0 && searchKeyword" class="text-center text-gray-400 py-8 text-sm">
        未找到匹配 "{{ searchKeyword }}" 的文件或目录
      </div>
    </div>
    
    <!-- 创建目录对话框 -->
    <Modal
      v-model:open="showCreateDirDialog"
      title="创建新目录"
      @ok="createDirectory"
      @cancel="cancelCreateDir"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm mb-2">目录名称</label>
          <Input
            v-model:value="newDirName"
            placeholder="输入目录名称"
            @pressEnter="createDirectory"
          />
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick, h } from 'vue'
import { FolderOutlined, FileOutlined, FolderAddOutlined, UpOutlined, RightOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Button, Modal, Input, message } from 'ant-design-vue'
import { useFileSystemStore } from '@/stores/fileSystem'
import { getFileColor, colorToCss } from '@/utils/colorGenerator'

const fileSystemStore = useFileSystemStore()

const currentPath = ref('root')
const showCreateDirDialog = ref(false)
const newDirName = ref('')
const searchKeyword = ref('')

// 当前目录下的文件和目录
const currentItems = computed(() => {
  // 强制依赖files，确保创建后能立即显示
  const _ = fileSystemStore.files // 触发响应式
  return fileSystemStore.getFilesByParent(currentPath.value)
    .sort((a, b) => {
      // 目录排在前面
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
})

// 搜索功能：在整个文件系统中搜索
const searchResults = computed(() => {
  if (!searchKeyword.value || searchKeyword.value.trim() === '') {
    return []
  }
  
  const keyword = searchKeyword.value.trim().toLowerCase()
  const allFiles = fileSystemStore.files
  
  // 模糊搜索：匹配文件名或目录名
  return allFiles.filter(item => {
    const name = item.name.toLowerCase()
    return name.includes(keyword)
  })
})

// 显示的项目列表（有搜索时显示搜索结果，否则显示当前目录）
const displayItems = computed(() => {
  if (searchKeyword.value && searchKeyword.value.trim() !== '') {
    // 搜索模式：显示搜索结果，并包含路径信息
    return searchResults.value.sort((a, b) => {
      // 目录排在前面
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  } else {
    // 正常模式：显示当前目录
    return currentItems.value
  }
})

// 获取文件的完整路径（用于搜索结果显示）
const getItemPath = (item) => {
  if (item.parentId === 'root') {
    return `根目录 / ${item.name}`
  }
  
  const path = []
  let currentId = item.parentId
  const visited = new Set()
  
  while (currentId && currentId !== 'root' && !visited.has(currentId)) {
    visited.add(currentId)
    const dir = fileSystemStore.getFile(currentId)
    if (dir) {
      path.unshift(dir.name)
      currentId = dir.parentId
    } else {
      break
    }
  }
  
  return path.length > 0 ? `根目录 / ${path.join(' / ')} / ${item.name}` : `根目录 / ${item.name}`
}

// 清除搜索
const handleSearchClear = () => {
  searchKeyword.value = ''
}

// 当前选中的项
const selectedItem = computed(() => fileSystemStore.selectedItem)

// 路径列表（用于导航）
const pathList = computed(() => {
  if (currentPath.value === 'root') return []
  
  const path = []
  let currentId = currentPath.value
  const visited = new Set()
  
  while (currentId && currentId !== 'root' && !visited.has(currentId)) {
    visited.add(currentId)
    const dir = fileSystemStore.getFile(currentId)
    if (dir && dir.type === 'directory') {
      path.unshift(dir)
      currentId = dir.parentId
    } else {
      break
    }
  }
  
  return path
})

// 获取子项数量
const getChildCount = (dirId) => {
  return fileSystemStore.getFilesByParent(dirId).length
}

// 格式化文件大小
const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

// 格式化时间
const formatTime = (timeString) => {
  const date = new Date(timeString)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取项的颜色
const getItemColor = (itemId) => {
  return colorToCss(getFileColor(itemId))
}

// 处理项点击
const handleItemClick = (item) => {
  fileSystemStore.selectedItem = item
  
  // 如果正在搜索，点击后清除搜索并导航到文件所在目录
  if (searchKeyword.value && searchKeyword.value.trim() !== '') {
    // 如果是目录，直接导航；如果是文件，导航到其父目录
    if (item.type === 'directory') {
      searchKeyword.value = ''
      navigateTo(item.id)
    } else {
      searchKeyword.value = ''
      navigateTo(item.parentId || 'root')
      // 延迟选中文件，确保目录已切换
      setTimeout(() => {
        fileSystemStore.selectedItem = item
      }, 100)
    }
  }
}

// 处理项双击
const handleItemDoubleClick = (item) => {
  if (item.type === 'directory') {
    // 如果正在搜索，清除搜索并导航到目录
    if (searchKeyword.value) {
      searchKeyword.value = ''
    }
    navigateTo(item.id)
  }
}

// 导航到指定目录
const navigateTo = (dirId) => {
  currentPath.value = dirId
  fileSystemStore.setCurrentDirectory(dirId)
  fileSystemStore.selectedItem = null
}

// 监听store中的currentDirectory变化，同步currentPath
watch(
  () => fileSystemStore.currentDirectory,
  (newDir) => {
    if (currentPath.value !== newDir) {
      currentPath.value = newDir
    }
  },
  { immediate: true }
)

// 导航到父目录
const navigateToParent = () => {
  if (currentPath.value === 'root') return
  
  const currentDir = fileSystemStore.getFile(currentPath.value)
  if (currentDir) {
    navigateTo(currentDir.parentId || 'root')
  }
}

// 创建目录
const createDirectory = async () => {
  if (!newDirName.value.trim()) {
    message.warning('请输入目录名称')
    return
  }
  
  const result = fileSystemStore.createDirectory({
    name: newDirName.value.trim(),
    parentId: currentPath.value
  })
  
  if (result.success) {
    showCreateDirDialog.value = false
    newDirName.value = ''
  } else {
    message.error(`创建失败: ${result.error}`)
  }
}

// 取消创建目录
const cancelCreateDir = () => {
  showCreateDirDialog.value = false
  newDirName.value = ''
}

// 删除目录
const handleDeleteDirectory = (dir) => {
  if (!dir || dir.type !== 'directory') return
  
  // 检查目录是否为空
  const children = fileSystemStore.getFilesByParent(dir.id)
  if (children.length > 0) {
    message.warning(`目录 "${dir.name}" 不为空，无法删除。请先删除其中的文件或子目录。`)
    return
  }
  
  // 确认删除
  Modal.confirm({
    title: '确认删除目录',
    content: `确定要删除目录 "${dir.name}" 吗？此操作不可恢复。`,
    okText: '确定',
    cancelText: '取消',
    okType: 'danger',
    onOk: () => {
      const result = fileSystemStore.deleteFile(dir.id)
      
      if (result.success) {
        // 如果删除的是当前目录，导航到父目录
        if (currentPath.value === dir.id) {
          const parentDir = fileSystemStore.getFile(dir.parentId || 'root')
          if (parentDir && parentDir.type === 'directory') {
            navigateTo(parentDir.id)
          } else {
            navigateTo('root')
          }
        }
        
        // 如果删除的是选中的项，清除选中
        if (selectedItem.value?.id === dir.id) {
          fileSystemStore.selectedItem = null
        }
        
        message.success('目录删除成功！')
      } else {
        message.error(`删除失败: ${result.error}`)
      }
    }
  })
}

// 初始化时设置当前目录
onMounted(() => {
  fileSystemStore.setCurrentDirectory('root')
})

// 监听文件列表变化，确保创建后能立即显示
watch(
  () => fileSystemStore.files,
  () => {
    // 强制触发computed更新
  },
  { deep: true, immediate: true }
)

// 监听store中的currentDirectory变化，同步currentPath
watch(
  () => fileSystemStore.currentDirectory,
  (newDir) => {
    if (currentPath.value !== newDir) {
      currentPath.value = newDir
    }
  },
  { immediate: true }
)

// 监听选中项变化，更新当前路径（如果选中的是目录）
watch(() => fileSystemStore.selectedItem, (newItem) => {
  // 可以在这里添加其他逻辑
})
</script>

