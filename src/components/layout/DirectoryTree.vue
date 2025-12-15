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
        v-if="currentPath !== 'root'"
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
        v-for="item in currentItems"
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
            <span v-if="item.type === 'file'">{{ formatSize(item.size) }}</span>
            <span v-else>{{ getChildCount(item.id) }} 项</span>
            <span class="ml-2">{{ formatTime(item.createTime) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <span
            class="w-3 h-3 rounded-full border border-gray-300"
            :style="{ backgroundColor: getItemColor(item.id) }"
          ></span>
        </div>
      </div>
      
      <div v-if="currentItems.length === 0" class="text-center text-gray-400 py-8 text-sm">
        当前目录为空
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
import { FolderOutlined, FileOutlined, FolderAddOutlined, UpOutlined, RightOutlined } from '@ant-design/icons-vue'
import { Button, Modal, Input, message } from 'ant-design-vue'
import { useFileSystemStore } from '@/stores/fileSystem'
import { getFileColor, colorToCss } from '@/utils/colorGenerator'

const fileSystemStore = useFileSystemStore()

const currentPath = ref('root')
const showCreateDirDialog = ref(false)
const newDirName = ref('')

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
}

// 处理项双击
const handleItemDoubleClick = (item) => {
  if (item.type === 'directory') {
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

