<template>
  <div ref="containerRef" class="w-full h-full bg-gray-900"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useFileSystemStore } from '@/stores/fileSystem'
import { ThreeDRenderer } from '@/renderer/ThreeDRenderer'
import { clearFileColors } from '@/utils/colorGenerator'

const containerRef = ref(null)
const fileSystemStore = useFileSystemStore()
let renderer = null

onMounted(() => {
  if (containerRef.value) {
    renderer = new ThreeDRenderer(containerRef.value)
    renderer.init()
    
    // 设置选中回调
    renderer.setOnSelectCallback((file) => {
      fileSystemStore.selectedItem = file
    })
    
    // 初始化磁盘可视化
    if (fileSystemStore.disk.totalBlocks > 0) {
      renderer.createDisk(fileSystemStore.disk)
    }
    
    // 初始化目录树
    if (fileSystemStore.files.length > 0) {
      renderer.createDirectoryTree(fileSystemStore.files)
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
      // 如果磁盘刚初始化，或者总块数发生变化，重新创建磁盘
      const shouldRecreate = 
        renderer.diskBlocks.length === 0 || 
        oldDisk.totalBlocks === 0 ||
        oldDisk.totalBlocks !== newDisk.totalBlocks
      
      if (shouldRecreate) {
        clearFileColors() // 清除所有文件颜色映射
        renderer.createDisk(newDisk)
        // 调整相机位置以适应新的磁盘大小
        renderer.adjustCameraForDisk(newDisk)
      } else {
        renderer.updateDiskBlocks(newDisk, true) // 使用动画
      }
    } else if (renderer && newDisk.totalBlocks === 0) {
      // 如果总块数为0，清除所有磁盘块
      renderer.diskBlocks.forEach(block => renderer.scene.remove(block))
      renderer.diskBlocks = []
    }
  },
  { deep: true, immediate: true }
)

// 监听文件列表变化，更新目录树
watch(
  () => fileSystemStore.files,
  (newFiles) => {
    if (renderer) {
      renderer.createDirectoryTree(newFiles)
    }
  },
  { deep: true }
)

// 监听当前目录变化，只显示当前目录及其子目录的文件块
watch(
  () => fileSystemStore.currentDirectory,
  (newDir) => {
    if (renderer && fileSystemStore.disk.totalBlocks > 0) {
      // 如果是根目录，显示所有块
      if (newDir === 'root') {
        renderer.showAllBlocks(fileSystemStore.disk)
      } else {
        // 递归获取当前目录及其所有子目录下的所有文件
        const allFiles = fileSystemStore.getAllFilesInDirectory(newDir)
        
        // 更新磁盘可视化，只显示当前目录的文件块
        renderer.showDirectoryFilesOnly(allFiles, fileSystemStore.disk)
      }
    }
  },
  { immediate: true }
)
</script>

