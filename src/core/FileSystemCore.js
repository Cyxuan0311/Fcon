/**
 * 文件系统核心模块
 * 封装不同文件系统（FAT32/Ext4/NTFS）的核心逻辑
 */
export class FileSystemCore {
  constructor(fileSystemType, disk) {
    this.fileSystemType = fileSystemType
    this.disk = disk
  }
  
  /**
   * 创建目录
   * @param {Object} dirInfo - 目录信息
   * @returns {Object} 创建的目录对象
   */
  createDirectory(dirInfo) {
    // 确保files数组存在
    if (!this.disk.files) {
      this.disk.files = []
    }
    
    // 检查目录名是否已存在
    const existingDir = this.disk.files.find(
      f => f.name === dirInfo.name && 
      f.type === 'directory' && 
      f.parentId === (dirInfo.parentId || 'root')
    )
    if (existingDir) {
      throw new Error(`目录 "${dirInfo.name}" 已存在`)
    }
    
    // 验证父目录是否存在
    if (dirInfo.parentId && dirInfo.parentId !== 'root') {
      const parentDir = this.disk.files.find(f => f.id === dirInfo.parentId && f.type === 'directory')
      if (!parentDir) {
        throw new Error('父目录不存在')
      }
    }
    
    const directory = {
      id: `dir-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: dirInfo.name,
      type: 'directory',
      size: 0, // 目录不占用数据空间
      blocks: [], // 目录不分配磁盘块
      parentId: dirInfo.parentId || 'root',
      createTime: new Date().toISOString(),
      allocationAlgorithm: null // 目录不需要分配算法
    }
    
    // 添加到文件列表
    this.disk.files.push(directory)
    
    return directory
  }
  
  /**
   * 创建文件
   * @param {Object} fileInfo - 文件信息
   * @param {string} allocationAlgorithm - 分配算法
   * @returns {Object|null} 创建的文件对象，失败返回null
   */
  createFile(fileInfo, allocationAlgorithm = 'continuous') {
    // 确保files数组存在
    if (!this.disk.files) {
      this.disk.files = []
    }
    
    // 检查文件名是否已存在（在同一父目录下）
    const existingFile = this.disk.files.find(
      f => f.name === fileInfo.name && 
      f.type === 'file' &&
      f.parentId === (fileInfo.parentId || 'root')
    )
    if (existingFile) {
      throw new Error(`文件 "${fileInfo.name}" 已存在`)
    }
    
    // 验证父目录是否存在
    if (fileInfo.parentId && fileInfo.parentId !== 'root') {
      const parentDir = this.disk.files.find(f => f.id === fileInfo.parentId && f.type === 'directory')
      if (!parentDir) {
        throw new Error('父目录不存在')
      }
    }
    
    // 检查磁盘空间
    const requiredBlocks = Math.ceil(fileInfo.size / this.disk.blockSize)
    if (this.disk.freeBlocks.length < requiredBlocks) {
      throw new Error('磁盘空间不足')
    }
    
    const file = {
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: fileInfo.name,
      type: fileInfo.type || 'file',
      size: fileInfo.size,
      blocks: [],
      parentId: fileInfo.parentId || 'root',
      createTime: new Date().toISOString(),
      allocationAlgorithm
    }
    
    // 根据分配算法分配磁盘块
    const blocks = this.allocateBlocks(file.size, allocationAlgorithm)
    
    if (blocks.length < requiredBlocks) {
      throw new Error('无法分配足够的磁盘块')
    }
    
    file.blocks = blocks
    
    // 更新磁盘状态
    blocks.forEach(blockNum => {
      const freeIndex = this.disk.freeBlocks.indexOf(blockNum)
      if (freeIndex > -1) {
        this.disk.freeBlocks.splice(freeIndex, 1)
      }
      this.disk.usedBlocks[blockNum] = file
    })
    
    // 添加到文件列表
    this.disk.files.push(file)
    
    // 更新碎片率
    this.updateFragmentRate()
    
    return file
  }
  
  /**
   * 删除文件
   * @param {string} fileId - 文件ID
   * @returns {boolean} 是否删除成功
   */
  deleteFile(fileId) {
    if (!this.disk.files) {
      throw new Error('文件列表不存在')
    }
    
    const file = this.disk.files.find(f => f.id === fileId)
    if (!file) {
      throw new Error('文件不存在')
    }
    
    // 如果是目录，检查是否有子文件
    if (file.type === 'directory') {
      const children = this.disk.files.filter(f => f.parentId === fileId)
      if (children.length > 0) {
        throw new Error('目录不为空，无法删除')
      }
    }
    
    // 释放磁盘块
    this.releaseBlocks(file.blocks)
    
    // 从文件列表中移除
    const index = this.disk.files.findIndex(f => f.id === fileId)
    if (index > -1) {
      this.disk.files.splice(index, 1)
    }
    
    // 更新碎片率
    this.updateFragmentRate()
    
    return true
  }
  
  /**
   * 分配磁盘块
   * @param {number} size - 需要的大小（字节）
   * @param {string} algorithm - 分配算法
   * @returns {number[]} 分配的块号数组
   */
  allocateBlocks(size, algorithm) {
    const blockCount = Math.ceil(size / this.disk.blockSize)
    
    switch (algorithm) {
      case 'continuous':
        return this.continuousAllocation(blockCount)
      case 'linked':
        return this.linkedAllocation(blockCount)
      case 'indexed':
        return this.indexedAllocation(blockCount)
      default:
        return this.continuousAllocation(blockCount)
    }
  }
  
  /**
   * 连续分配
   */
  continuousAllocation(blockCount) {
    const blocks = []
    const freeBlocks = [...this.disk.freeBlocks].sort((a, b) => a - b)
    
    // 查找连续的空闲块
    for (let i = 0; i <= freeBlocks.length - blockCount; i++) {
      let isContinuous = true
      const startBlock = freeBlocks[i]
      
      // 检查后续块是否连续
      for (let j = 1; j < blockCount; j++) {
        const expectedBlock = startBlock + j
        if (i + j >= freeBlocks.length || freeBlocks[i + j] !== expectedBlock) {
          isContinuous = false
          break
        }
      }
      
      if (isContinuous) {
        // 分配连续块
        for (let j = 0; j < blockCount; j++) {
          blocks.push(freeBlocks[i + j])
        }
        break
      }
    }
    
    return blocks
  }
  
  /**
   * 链接分配
   */
  linkedAllocation(blockCount) {
    const blocks = []
    const freeBlocks = [...this.disk.freeBlocks]
    
    // 链接分配不需要连续，只需要分配足够的块
    for (let i = 0; i < blockCount && freeBlocks.length > 0; i++) {
      // 随机选择一个空闲块（模拟实际文件系统的行为）
      const randomIndex = Math.floor(Math.random() * freeBlocks.length)
      blocks.push(freeBlocks.splice(randomIndex, 1)[0])
    }
    
    return blocks
  }
  
  /**
   * 索引分配
   */
  indexedAllocation(blockCount) {
    const blocks = []
    const freeBlocks = [...this.disk.freeBlocks]
    
    if (freeBlocks.length < blockCount + 1) {
      return blocks // 空间不足
    }
    
    // 分配索引块（第一个块作为索引块）
    blocks.push(freeBlocks.shift())
    
    // 分配数据块（不需要连续）
    for (let i = 0; i < blockCount && freeBlocks.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * freeBlocks.length)
      blocks.push(freeBlocks.splice(randomIndex, 1)[0])
    }
    
    return blocks
  }
  
  /**
   * 释放磁盘块
   * @param {number[]} blocks - 要释放的块号数组
   */
  releaseBlocks(blocks) {
    blocks.forEach(blockNum => {
      // 添加到空闲块列表
      if (!this.disk.freeBlocks.includes(blockNum)) {
        this.disk.freeBlocks.push(blockNum)
      }
      // 从已使用块中移除
      delete this.disk.usedBlocks[blockNum]
    })
    
    // 排序空闲块列表
    this.disk.freeBlocks.sort((a, b) => a - b)
  }
  
  /**
   * 更新碎片率
   */
  updateFragmentRate() {
    const usedBlocks = Object.keys(this.disk.usedBlocks).map(Number).sort((a, b) => a - b)
    if (usedBlocks.length === 0) {
      this.disk.fragmentRate = 0
      return
    }
    
    let fragmentCount = 0
    for (let i = 1; i < usedBlocks.length; i++) {
      if (usedBlocks[i] !== usedBlocks[i - 1] + 1) {
        fragmentCount++
      }
    }
    
    this.disk.fragmentRate = (fragmentCount / usedBlocks.length) * 100
  }
  
  /**
   * 碎片整理
   * @param {string} algorithm - 整理算法
   * @returns {Object} 整理结果
   */
  defragment(algorithm = 'compact') {
    const usedBlocks = Object.keys(this.disk.usedBlocks).map(Number).sort((a, b) => a - b)
    if (usedBlocks.length === 0) {
      return { success: true, movedBlocks: 0 }
    }
    
    // 紧凑式整理：将所有已使用的块移动到磁盘前部
    const fileBlockMap = new Map() // 文件ID -> 块数组
    
    // 收集每个文件使用的块
    usedBlocks.forEach(blockNum => {
      const file = this.disk.usedBlocks[blockNum]
      if (file) {
        if (!fileBlockMap.has(file.id)) {
          fileBlockMap.set(file.id, [])
        }
        fileBlockMap.get(file.id).push(blockNum)
      }
    })
    
    // 按文件整理块
    let newBlockIndex = 0
    const blockMapping = new Map() // 旧块号 -> 新块号
    
    fileBlockMap.forEach((blocks, fileId) => {
      blocks.sort((a, b) => a - b)
      blocks.forEach(oldBlockNum => {
        const newBlockNum = newBlockIndex++
        blockMapping.set(oldBlockNum, newBlockNum)
      })
    })
    
    // 更新文件块号和磁盘状态
    let movedBlocks = 0
    fileBlockMap.forEach((blocks, fileId) => {
      const file = this.disk.files?.find(f => f.id === fileId)
      if (file) {
        const newBlocks = blocks.map(oldBlock => blockMapping.get(oldBlock))
        const oldBlocks = [...file.blocks]
        file.blocks = newBlocks
        
        // 更新磁盘状态
        oldBlocks.forEach(oldBlock => {
          delete this.disk.usedBlocks[oldBlock]
          if (!this.disk.freeBlocks.includes(oldBlock)) {
            this.disk.freeBlocks.push(oldBlock)
          }
        })
        
        newBlocks.forEach(newBlock => {
          this.disk.usedBlocks[newBlock] = file
          const freeIndex = this.disk.freeBlocks.indexOf(newBlock)
          if (freeIndex > -1) {
            this.disk.freeBlocks.splice(freeIndex, 1)
          }
        })
        
        movedBlocks += blocks.length
      }
    })
    
    // 更新空闲块列表
    this.disk.freeBlocks = Array.from({ length: this.disk.totalBlocks }, (_, i) => i)
      .filter(blockNum => !this.disk.usedBlocks[blockNum])
      .sort((a, b) => a - b)
    
    // 更新碎片率
    this.updateFragmentRate()
    
    return { success: true, movedBlocks }
  }
  
  /**
   * 获取文件信息
   * @param {string} fileId - 文件ID
   * @returns {Object|null} 文件对象
   */
  getFile(fileId) {
    return this.disk.files?.find(f => f.id === fileId) || null
  }
  
  /**
   * 获取目录下的文件列表
   * @param {string} parentId - 父目录ID
   * @returns {Array} 文件列表
   */
  getFilesByParent(parentId = 'root') {
    return this.disk.files?.filter(f => f.parentId === parentId) || []
  }
}

