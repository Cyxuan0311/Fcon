import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { FileSystemCore } from '@/core/FileSystemCore'
import { clearFileColors } from '@/utils/colorGenerator'

export const useFileSystemStore = defineStore('fileSystem', () => {
  // 文件系统类型
  const fileSystemType = ref('FAT32') // FAT32 | Ext4 | NTFS
  
  // 磁盘参数
  const disk = ref({
    id: 'disk-1',
    totalBlocks: 1000,
    blockSize: 4096, // 4KB
    freeBlocks: [],
    usedBlocks: {},
    fragmentRate: 0,
    files: [] // 文件列表存储在disk中
  })
  
  // 文件系统核心实例
  let fileSystemCore = null
  
  // 初始化fileSystemCore（如果需要）
  const ensureFileSystemCore = () => {
    if (!fileSystemCore) {
      if (disk.value.totalBlocks > 0) {
        fileSystemCore = new FileSystemCore(fileSystemType.value, disk.value)
      } else {
        // 即使没有初始化磁盘，也创建一个实例以便获取文件列表
        fileSystemCore = new FileSystemCore(fileSystemType.value, disk.value)
      }
    }
    return fileSystemCore
  }
  
  // 当前选中的文件/目录
  const selectedItem = ref(null)
  
  // 当前工作目录
  const currentDirectory = ref('root')
  
  // 计算属性
  const diskUtilization = computed(() => {
    const usedCount = Object.keys(disk.value.usedBlocks).length
    return (usedCount / disk.value.totalBlocks) * 100
  })
  
  const files = computed(() => disk.value.files || [])
  
  // 初始化磁盘
  const initDisk = (totalBlocks, blockSize) => {
    // 清除之前的文件颜色映射
    clearFileColors()
    
    disk.value.totalBlocks = totalBlocks
    disk.value.blockSize = blockSize
    disk.value.freeBlocks = Array.from({ length: totalBlocks }, (_, i) => i)
    disk.value.usedBlocks = {}
    disk.value.fragmentRate = 0
    disk.value.files = []
    selectedItem.value = null
    currentDirectory.value = 'root'
    
    // 重新创建文件系统核心实例
    fileSystemCore = new FileSystemCore(fileSystemType.value, disk.value)
  }
  
  // 设置文件系统类型
  const setFileSystemType = (type) => {
    fileSystemType.value = type
    if (fileSystemCore) {
      fileSystemCore.fileSystemType = type
    }
  }
  
  // 创建目录
  const createDirectory = (dirInfo) => {
    if (!fileSystemCore) {
      fileSystemCore = new FileSystemCore(fileSystemType.value, disk.value)
    }
    
    try {
      const directory = fileSystemCore.createDirectory(dirInfo)
      return { success: true, directory }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  
  // 创建文件
  const createFile = (fileInfo, allocationAlgorithm = 'continuous') => {
    if (!fileSystemCore) {
      fileSystemCore = new FileSystemCore(fileSystemType.value, disk.value)
    }
    
    try {
      const file = fileSystemCore.createFile(fileInfo, allocationAlgorithm)
      return { success: true, file }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  
  // 删除文件
  const deleteFile = (fileId) => {
    if (!fileSystemCore) {
      fileSystemCore = new FileSystemCore(fileSystemType.value, disk.value)
    }
    
    try {
      const result = fileSystemCore.deleteFile(fileId)
      if (selectedItem.value?.id === fileId) {
        selectedItem.value = null
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  
  // 碎片整理
  const defragment = () => {
    if (!fileSystemCore) {
      fileSystemCore = new FileSystemCore(fileSystemType.value, disk.value)
    }
    
    try {
      const result = fileSystemCore.defragment()
      return { success: true, ...result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  
  // 获取文件
  const getFile = (fileId) => {
    if (!fileSystemCore) {
      return null
    }
    return fileSystemCore.getFile(fileId)
  }
  
  // 获取目录下的文件
  const getFilesByParent = (parentId = 'root') => {
    ensureFileSystemCore()
    if (!fileSystemCore) {
      return []
    }
    return fileSystemCore.getFilesByParent(parentId)
  }
  
  // 递归获取目录及其所有子目录下的所有文件
  const getAllFilesInDirectory = (dirId = 'root') => {
    const allFiles = []
    const visited = new Set()
    
    const collectFiles = (currentDirId) => {
      if (visited.has(currentDirId)) return
      visited.add(currentDirId)
      
      const items = getFilesByParent(currentDirId)
      items.forEach(item => {
        if (item.type === 'file') {
          allFiles.push(item)
        } else if (item.type === 'directory') {
          // 递归获取子目录的文件
          collectFiles(item.id)
        }
      })
    }
    
    collectFiles(dirId)
    return allFiles
  }
  
  // 设置当前目录
  const setCurrentDirectory = (dirId) => {
    currentDirectory.value = dirId
  }
  
  // 从JSON导入文件系统数据
  const importFromJSON = (jsonData) => {
    try {
      // 验证JSON数据结构
      if (!jsonData || typeof jsonData !== 'object') {
        return { success: false, error: '无效的JSON数据格式' }
      }
      
      // 验证必需字段
      if (!jsonData.disk || !jsonData.disk.totalBlocks || !jsonData.disk.blockSize) {
        return { success: false, error: 'JSON数据缺少必需的磁盘配置信息' }
      }
      
      // 清除之前的文件颜色映射
      clearFileColors()
      
      // 设置文件系统类型
      if (jsonData.fileSystemType) {
        fileSystemType.value = jsonData.fileSystemType
      }
      
      // 初始化磁盘
      const totalBlocks = jsonData.disk.totalBlocks
      const blockSize = jsonData.disk.blockSize
      
      disk.value.totalBlocks = totalBlocks
      disk.value.blockSize = blockSize
      disk.value.fragmentRate = jsonData.disk.fragmentRate || 0
      
      // 导入文件列表
      if (jsonData.disk.files && Array.isArray(jsonData.disk.files)) {
        disk.value.files = jsonData.disk.files.map(file => ({
          ...file,
          // 确保必需字段存在
          id: file.id || `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: file.type || 'file',
          size: file.size || 0,
          blocks: file.blocks || [],
          parentId: file.parentId || 'root',
          createTime: file.createTime || new Date().toISOString(),
          allocationAlgorithm: file.allocationAlgorithm || 'continuous'
        }))
      } else {
        disk.value.files = []
      }
      
      // 重建usedBlocks映射
      disk.value.usedBlocks = {}
      disk.value.freeBlocks = []
      
      // 遍历所有文件，重建usedBlocks
      disk.value.files.forEach(file => {
        if (file.blocks && file.blocks.length > 0) {
          file.blocks.forEach(blockNum => {
            disk.value.usedBlocks[blockNum] = file
          })
        }
      })
      
      // 计算空闲块
      for (let i = 0; i < totalBlocks; i++) {
        if (!disk.value.usedBlocks[i]) {
          disk.value.freeBlocks.push(i)
        }
      }
      
      // 如果JSON中有freeBlocks，使用它（但需要验证）
      if (jsonData.disk.freeBlocks && Array.isArray(jsonData.disk.freeBlocks)) {
        // 验证freeBlocks是否与usedBlocks一致
        const jsonFreeBlocks = new Set(jsonData.disk.freeBlocks)
        const calculatedFreeBlocks = new Set(disk.value.freeBlocks)
        
        // 如果差异不大，使用JSON中的freeBlocks（可能包含碎片信息）
        if (Math.abs(jsonFreeBlocks.size - calculatedFreeBlocks.size) < totalBlocks * 0.1) {
          disk.value.freeBlocks = jsonData.disk.freeBlocks
        }
      }
      
      // 重新创建文件系统核心实例
      fileSystemCore = new FileSystemCore(fileSystemType.value, disk.value)
      
      // 重置选中项和当前目录
      selectedItem.value = null
      currentDirectory.value = 'root'
      
      return {
        success: true,
        data: {
          fileSystemType: fileSystemType.value,
          totalBlocks,
          blockSize,
          fragmentRate: disk.value.fragmentRate,
          files: disk.value.files
        }
      }
    } catch (error) {
      console.error('导入JSON数据错误:', error)
      return { success: false, error: error.message || '导入数据时发生未知错误' }
    }
  }
  
  return {
    fileSystemType,
    disk,
    files,
    selectedItem,
    currentDirectory,
    diskUtilization,
    initDisk,
    setFileSystemType,
    setCurrentDirectory,
    createDirectory,
    createFile,
    deleteFile,
    defragment,
    getFile,
    getFilesByParent,
    getAllFilesInDirectory,
    importFromJSON
  }
})

