<template>
  <div class="simple-directory-tree">
    <!-- 当前目录路径显示 -->
    <div v-if="currentDirectoryPath.length > 0" class="current-path">
      <div class="path-item" @click="navigateToRoot">
        <span class="path-separator">/</span>
        <span class="path-name">根目录</span>
      </div>
      <div
        v-for="(dir, index) in currentDirectoryPath"
        :key="dir.id"
        class="path-item"
        @click="navigateToDirectory(dir.id)"
      >
        <span class="path-separator">/</span>
        <span class="path-name">{{ dir.name }}</span>
      </div>
    </div>
    
    <div v-if="currentItems.length === 0" class="empty-tree">
      暂无文件
    </div>
    <TreeItem
      v-for="item in currentItems"
      :key="item.id"
      :item="item"
      :selected-id="selectedId"
      :level="0"
      @select="$emit('select', $event)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useFileSystemStore } from '@/stores/fileSystem'
import TreeItem from './TreeItem.vue'

const props = defineProps({
  selectedId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['select'])

const fileSystemStore = useFileSystemStore()

// 获取当前目录下的文件
const currentItems = computed(() => {
  const allFiles = fileSystemStore.files || []
  const currentDir = fileSystemStore.currentDirectory || 'root'
  
  // 筛选出当前目录下的文件
  const dirFiles = allFiles.filter(f => {
    if (!f) return false
    // 如果当前目录是根目录
    if (currentDir === 'root') {
      return f.parentId === 'root' || !f.parentId || f.parentId === ''
    }
    // 否则筛选出当前目录下的文件
    return f.parentId === currentDir
  })
  
  if (!dirFiles || dirFiles.length === 0) {
    return []
  }
  
  return dirFiles.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
})

// 获取当前目录路径
const currentDirectoryPath = computed(() => {
  const path = []
  let currentId = fileSystemStore.currentDirectory
  
  if (!currentId || currentId === 'root') {
    return []
  }
  
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

// 导航到根目录
const navigateToRoot = () => {
  fileSystemStore.setCurrentDirectory('root')
  fileSystemStore.selectedItem = null
}

// 导航到指定目录
const navigateToDirectory = (dirId) => {
  fileSystemStore.setCurrentDirectory(dirId)
  fileSystemStore.selectedItem = null
}
</script>

<style scoped>
.simple-directory-tree {
  font-size: 13px;
}

.current-path {
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  font-size: 11px;
}

.path-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: opacity 0.2s;
}

.path-item:hover {
  opacity: 0.8;
}

.path-separator {
  color: rgba(255, 255, 255, 0.4);
  margin-right: 0.25rem;
}

.path-name {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.path-item:first-child .path-separator {
  display: none;
}

.empty-tree {
  padding: 1rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}
</style>
