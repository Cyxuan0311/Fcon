/**
 * 命令解析器
 * 解析和执行终端命令
 */
export class CommandParser {
  constructor(fileSystemStore) {
    this.fileSystemStore = fileSystemStore
  }

  /**
   * 解析命令
   */
  async parse(command, history = []) {
    const parts = command.trim().split(/\s+/)
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1)
    
    // 保存历史记录供history命令使用
    this.commandHistory = history

    try {
      switch (cmd) {
        case 'help':
          return { output: this.getHelp() }
        case 'ls':
        case 'dir':
          return { output: this.listFiles(args) }
        case 'cd':
          return { output: await this.changeDirectory(args) }
        case 'pwd':
          return { output: this.printWorkingDirectory() }
        case 'mkdir':
          return { output: await this.makeDirectory(args) }
        case 'touch':
        case 'create':
          return { output: await this.createFile(args) }
        case 'rm':
        case 'delete':
          return { output: await this.removeFile(args) }
        case 'cat':
          return { output: this.catFile(args) }
        case 'stat':
          return { output: this.statFile(args) }
        case 'find':
          return { output: this.findFiles(args) }
        case 'tree':
          return { output: this.showTree(args) }
        case 'du':
          return { output: this.showDirectorySize(args) }
        case 'df':
          return { output: this.showDiskUsage() }
        case 'mv':
          return { output: await this.moveFile(args) }
        case 'info':
          return { output: this.showSystemInfo() }
        case 'history':
          return { output: this.showHistory(args) }
        case 'echo':
          return { output: this.echoText(args) }
        case 'cp':
          return { output: await this.copyFile(args) }
        case 'grep':
          return { output: this.grepFiles(args) }
        case 'head':
          return { output: this.headFiles(args) }
        case 'tail':
          return { output: this.tailFiles(args) }
        case 'wc':
          return { output: this.wordCount(args) }
        case 'sort':
          return { output: this.sortFiles(args) }
        case 'date':
          return { output: this.showDate() }
        case 'whoami':
          return { output: this.whoAmI() }
        case 'uname':
          return { output: this.uname(args) }
        case 'alias':
          return { output: this.handleAlias(args) }
        case 'clear':
        case 'cls':
          // clear命令由组件处理，这里不需要返回
          return { output: '' }
        case 'exit':
        case 'quit':
          // exit命令由组件处理
          return { output: '' }
        default:
          return { error: `命令未找到: ${cmd}。输入 'help' 查看可用命令。` }
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  /**
   * 获取帮助信息
   */
  getHelp() {
    return `可用命令:

文件操作:
  ls, dir           - 列出当前目录下的文件和目录
  cd <目录>         - 切换到指定目录
  pwd               - 显示当前工作目录路径
  mkdir <目录名>    - 创建新目录
  touch <文件名>    - 创建新文件（默认大小100KB）
  create <文件名>   - 创建新文件（默认大小100KB）
  rm <文件名>       - 删除文件或目录
  mv <源> <目标>    - 移动或重命名文件/目录
  cp <源> <目标>    - 复制文件
  cat <文件名>      - 显示文件信息
  stat <文件名>     - 显示文件详细信息

查找和浏览:
  find <名称>       - 在当前目录及子目录中查找文件
  grep <模式>       - 在文件名中搜索匹配模式
  tree [目录]       - 以树形结构显示目录
  du [目录]         - 显示目录大小

文件列表操作:
  head [-n N]       - 显示文件列表前N项（默认10项）
  tail [-n N]       - 显示文件列表后N项（默认10项）
  sort              - 按名称排序文件列表
  wc                - 统计文件数量、总大小等

系统信息:
  df                - 显示磁盘使用情况
  info              - 显示系统信息
  date              - 显示当前日期和时间
  whoami            - 显示当前用户信息
  uname [-a]        - 显示系统信息
  history [数量]     - 显示命令历史记录

其他:
  echo <文本>       - 输出文本
  alias             - 显示或设置命令别名
  help              - 显示此帮助信息
  clear, cls        - 清空终端屏幕
  exit, quit        - 退出终端

示例:
  mkdir test
  cd test
  touch file1.txt 200
  ls
  stat file1.txt
  find file
  tree
  df
  info`
  }

  /**
   * 列出文件
   */
  listFiles(args) {
    const currentDir = this.fileSystemStore.currentDirectory
    const files = this.fileSystemStore.getFilesByParent(currentDir)

    if (files.length === 0) {
      return '当前目录为空'
    }

    // 排序：目录在前，然后按名称排序
    const sorted = files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

    let output = `总计 ${files.length} 项\n\n`
    
    sorted.forEach(item => {
      const icon = item.type === 'directory' ? '[DIR]' : '[FILE]'
      const size = item.type === 'file' 
        ? this.formatSize(item.size) 
        : `${this.fileSystemStore.getFilesByParent(item.id).length} 项`
      const date = this.formatDate(item.createTime)
      
      output += `${icon.padEnd(8)} ${item.name.padEnd(30)} ${size.padStart(10)} ${date}\n`
    })

    return output
  }

  /**
   * 切换目录
   */
  async changeDirectory(args) {
    if (args.length === 0) {
      this.fileSystemStore.setCurrentDirectory('root')
      return '已切换到根目录'
    }

    const target = args[0]
    
    if (target === '..' || target === '../') {
      // 返回上级目录
      const currentDir = this.fileSystemStore.getFile(this.fileSystemStore.currentDirectory)
      if (currentDir && currentDir.parentId) {
        this.fileSystemStore.setCurrentDirectory(currentDir.parentId)
        return `已切换到: ${this.getPathString()}`
      } else {
        this.fileSystemStore.setCurrentDirectory('root')
        return '已切换到根目录'
      }
    }

    if (target === '/' || target === 'root') {
      this.fileSystemStore.setCurrentDirectory('root')
      return '已切换到根目录'
    }

    // 查找目录
    const currentDir = this.fileSystemStore.currentDirectory
    const files = this.fileSystemStore.getFilesByParent(currentDir)
    const dir = files.find(f => f.name === target && f.type === 'directory')

    if (dir) {
      this.fileSystemStore.setCurrentDirectory(dir.id)
      return `已切换到: ${this.getPathString()}`
    } else {
      throw new Error(`目录不存在: ${target}`)
    }
  }

  /**
   * 显示当前工作目录
   */
  printWorkingDirectory() {
    return this.getPathString()
  }

  /**
   * 创建目录
   */
  async makeDirectory(args) {
    if (args.length === 0) {
      throw new Error('用法: mkdir <目录名>')
    }

    const dirName = args[0]
    const result = this.fileSystemStore.createDirectory({
      name: dirName,
      parentId: this.fileSystemStore.currentDirectory
    })

    if (result.success) {
      return `目录 "${dirName}" 创建成功`
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * 创建文件
   */
  async createFile(args) {
    if (args.length === 0) {
      throw new Error('用法: touch <文件名> [大小KB]')
    }

    const fileName = args[0]
    const sizeKB = args[1] ? parseInt(args[1]) : 100 // 默认100KB

    const result = this.fileSystemStore.createFile({
      name: fileName,
      size: sizeKB * 1024,
      type: 'file',
      parentId: this.fileSystemStore.currentDirectory
    }, 'continuous')

    if (result.success) {
      return `文件 "${fileName}" 创建成功 (${sizeKB}KB)`
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * 删除文件
   */
  async removeFile(args) {
    if (args.length === 0) {
      throw new Error('用法: rm <文件名或目录名>')
    }

    const targetName = args[0]
    const currentDir = this.fileSystemStore.currentDirectory
    const files = this.fileSystemStore.getFilesByParent(currentDir)
    const target = files.find(f => f.name === targetName)

    if (!target) {
      throw new Error(`文件或目录不存在: ${targetName}`)
    }

    const result = this.fileSystemStore.deleteFile(target.id)

    if (result.success) {
      return `${target.type === 'directory' ? '目录' : '文件'} "${targetName}" 删除成功`
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * 获取路径字符串
   */
  getPathString() {
    const currentDir = this.fileSystemStore.currentDirectory
    if (currentDir === 'root') {
      return '/'
    }

    const path = []
    let currentId = currentDir
    const visited = new Set()

    while (currentId && currentId !== 'root' && !visited.has(currentId)) {
      visited.add(currentId)
      const dir = this.fileSystemStore.getFile(currentId)
      if (dir && dir.type === 'directory') {
        path.unshift(dir.name)
        currentId = dir.parentId
      } else {
        break
      }
    }

    return '/' + path.join('/')
  }

  /**
   * 格式化文件大小
   */
  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  /**
   * 格式化日期
   */
  formatDate(dateString) {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  /**
   * 显示文件信息（cat命令）
   */
  catFile(args) {
    if (args.length === 0) {
      throw new Error('用法: cat <文件名>')
    }

    const fileName = args[0]
    const currentDir = this.fileSystemStore.currentDirectory
    const files = this.fileSystemStore.getFilesByParent(currentDir)
    const file = files.find(f => f.name === fileName && f.type === 'file')

    if (!file) {
      throw new Error(`文件不存在: ${fileName}`)
    }

    return `文件名: ${file.name}
类型: 文件
大小: ${this.formatSize(file.size)}
块数: ${file.blocks.length}
分配算法: ${this.getAllocationAlgorithmName(file.allocationAlgorithm)}
创建时间: ${this.formatDate(file.createTime)}
文件ID: ${file.id}`
  }

  /**
   * 显示文件详细信息（stat命令）
   */
  statFile(args) {
    if (args.length === 0) {
      throw new Error('用法: stat <文件名或目录名>')
    }

    const targetName = args[0]
    const currentDir = this.fileSystemStore.currentDirectory
    const files = this.fileSystemStore.getFilesByParent(currentDir)
    const target = files.find(f => f.name === targetName)

    if (!target) {
      throw new Error(`文件或目录不存在: ${targetName}`)
    }

    let output = `名称: ${target.name}
类型: ${target.type === 'directory' ? '目录' : '文件'}
ID: ${target.id}
父目录: ${target.parentId === 'root' ? '根目录' : target.parentId}
创建时间: ${this.formatDate(target.createTime)}`

    if (target.type === 'file') {
      output += `
大小: ${this.formatSize(target.size)}
块数: ${target.blocks.length}
分配算法: ${this.getAllocationAlgorithmName(target.allocationAlgorithm)}
块列表: [${target.blocks.slice(0, 10).join(', ')}${target.blocks.length > 10 ? '...' : ''}]`
    } else {
      const children = this.fileSystemStore.getFilesByParent(target.id)
      output += `
子项数量: ${children.length}`
    }

    return output
  }

  /**
   * 查找文件（find命令）
   */
  findFiles(args) {
    if (args.length === 0) {
      throw new Error('用法: find <名称>')
    }

    const searchName = args[0].toLowerCase()
    const results = []
    const visited = new Set()

    const searchInDirectory = (dirId, path = '') => {
      if (visited.has(dirId)) return
      visited.add(dirId)

      const files = this.fileSystemStore.getFilesByParent(dirId)
      files.forEach(item => {
        const itemPath = path ? `${path}/${item.name}` : item.name
        if (item.name.toLowerCase().includes(searchName)) {
          results.push({
            path: itemPath,
            type: item.type,
            size: item.size,
            item
          })
        }
        if (item.type === 'directory') {
          searchInDirectory(item.id, itemPath)
        }
      })
    }

    searchInDirectory(this.fileSystemStore.currentDirectory)

    if (results.length === 0) {
      return `未找到匹配 "${args[0]}" 的文件或目录`
    }

    let output = `找到 ${results.length} 个匹配项:\n\n`
    results.forEach(result => {
      const icon = result.type === 'directory' ? '[DIR]' : '[FILE]'
      const size = result.type === 'file' 
        ? this.formatSize(result.size) 
        : `${this.fileSystemStore.getFilesByParent(result.item.id).length} 项`
      output += `${icon.padEnd(8)} ${result.path.padEnd(40)} ${size.padStart(10)}\n`
    })

    return output
  }

  /**
   * 显示目录树（tree命令）
   */
  showTree(args) {
    const targetDirId = args.length > 0 
      ? this.findDirectoryByName(args[0])
      : this.fileSystemStore.currentDirectory

    if (!targetDirId) {
      throw new Error(`目录不存在: ${args[0]}`)
    }

    const visited = new Set()
    let output = ''

    const buildTree = (dirId, prefix = '', isLast = true) => {
      if (visited.has(dirId)) return
      visited.add(dirId)

      const files = this.fileSystemStore.getFilesByParent(dirId)
      const sorted = files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      sorted.forEach((item, index) => {
        const isLastItem = index === sorted.length - 1
        const connector = isLastItem ? '└── ' : '├── '
        const icon = item.type === 'directory' ? '📁' : '📄'
        
        output += `${prefix}${connector}${icon} ${item.name}\n`

        if (item.type === 'directory') {
          const nextPrefix = prefix + (isLastItem ? '    ' : '│   ')
          buildTree(item.id, nextPrefix, isLastItem)
        }
      })
    }

    const dir = this.fileSystemStore.getFile(targetDirId)
    const dirName = dir ? dir.name : '根目录'
    output += `${dirName}\n`
    buildTree(targetDirId)

    return output
  }

  /**
   * 显示目录大小（du命令）
   */
  showDirectorySize(args) {
    const targetDirId = args.length > 0 
      ? this.findDirectoryByName(args[0])
      : this.fileSystemStore.currentDirectory

    if (!targetDirId) {
      throw new Error(`目录不存在: ${args[0]}`)
    }

    const visited = new Set()
    let totalSize = 0
    let fileCount = 0

    const calculateSize = (dirId) => {
      if (visited.has(dirId)) return
      visited.add(dirId)

      const files = this.fileSystemStore.getFilesByParent(dirId)
      files.forEach(item => {
        if (item.type === 'file') {
          totalSize += item.size
          fileCount++
        } else if (item.type === 'directory') {
          calculateSize(item.id)
        }
      })
    }

    calculateSize(targetDirId)

    const dir = this.fileSystemStore.getFile(targetDirId)
    const dirName = dir ? dir.name : '根目录'
    
    return `目录: ${dirName}
总大小: ${this.formatSize(totalSize)}
文件数: ${fileCount}
块数: ${Math.ceil(totalSize / this.fileSystemStore.disk.blockSize)}`
  }

  /**
   * 显示磁盘使用情况（df命令）
   */
  showDiskUsage() {
    const disk = this.fileSystemStore.disk
    const usedBlocks = Object.keys(disk.usedBlocks).length
    const freeBlocks = disk.freeBlocks.length
    const totalBlocks = disk.totalBlocks
    const usedSize = usedBlocks * disk.blockSize
    const freeSize = freeBlocks * disk.blockSize
    const totalSize = totalBlocks * disk.blockSize
    const usagePercent = ((usedBlocks / totalBlocks) * 100).toFixed(2)

    return `文件系统类型: ${this.fileSystemStore.fileSystemType}
总块数: ${totalBlocks}
已使用: ${usedBlocks} 块 (${this.formatSize(usedSize)}) - ${usagePercent}%
可用: ${freeBlocks} 块 (${this.formatSize(freeSize)})
块大小: ${this.formatSize(disk.blockSize)}
碎片率: ${disk.fragmentRate.toFixed(2)}%`
  }

  /**
   * 移动或重命名文件（mv命令）
   */
  async moveFile(args) {
    if (args.length < 2) {
      throw new Error('用法: mv <源文件> <目标文件或目录>')
    }

    const sourceName = args[0]
    const targetName = args[1]
    const currentDir = this.fileSystemStore.currentDirectory
    const files = this.fileSystemStore.getFilesByParent(currentDir)
    const source = files.find(f => f.name === sourceName)

    if (!source) {
      throw new Error(`文件或目录不存在: ${sourceName}`)
    }

    // 检查目标是否已存在
    const existingTarget = files.find(f => f.name === targetName)
    if (existingTarget && existingTarget.id !== source.id) {
      throw new Error(`目标已存在: ${targetName}`)
    }

    // 更新文件名
    source.name = targetName

    return `${source.type === 'directory' ? '目录' : '文件'} "${sourceName}" 已重命名为 "${targetName}"`
  }

  /**
   * 显示系统信息（info命令）
   */
  showSystemInfo() {
    const disk = this.fileSystemStore.disk
    const totalFiles = disk.files.filter(f => f.type === 'file').length
    const totalDirs = disk.files.filter(f => f.type === 'directory').length

    return `文件系统信息:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
文件系统类型: ${this.fileSystemStore.fileSystemType}
当前目录: ${this.getPathString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
磁盘配置:
  总块数: ${disk.totalBlocks}
  块大小: ${this.formatSize(disk.blockSize)}
  总容量: ${this.formatSize(disk.totalBlocks * disk.blockSize)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
使用情况:
  已使用: ${Object.keys(disk.usedBlocks).length} 块
  可用: ${disk.freeBlocks.length} 块
  利用率: ${this.fileSystemStore.diskUtilization.toFixed(2)}%
  碎片率: ${disk.fragmentRate.toFixed(2)}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
文件统计:
  文件数: ${totalFiles}
  目录数: ${totalDirs}
  总计: ${totalFiles + totalDirs}`
  }

  /**
   * 显示命令历史（history命令）
   */
  showHistory(args) {
    if (!this.commandHistory || this.commandHistory.length === 0) {
      return '暂无命令历史'
    }

    const limit = args.length > 0 ? parseInt(args[0]) : this.commandHistory.length
    const history = this.commandHistory.slice(-limit)

    let output = `命令历史 (最近 ${history.length} 条):\n\n`
    history.forEach((cmd, index) => {
      const num = this.commandHistory.length - history.length + index + 1
      output += `${num.toString().padStart(4)}  ${cmd}\n`
    })

    return output
  }

  /**
   * 输出文本（echo命令）
   */
  echoText(args) {
    if (args.length === 0) {
      return ''
    }
    return args.join(' ')
  }

  /**
   * 复制文件（cp命令）
   */
  async copyFile(args) {
    if (args.length < 2) {
      throw new Error('用法: cp <源文件> <目标文件>')
    }

    const sourceName = args[0]
    const targetName = args[1]
    const currentDir = this.fileSystemStore.currentDirectory
    const files = this.fileSystemStore.getFilesByParent(currentDir)
    const source = files.find(f => f.name === sourceName)

    if (!source) {
      throw new Error(`文件不存在: ${sourceName}`)
    }

    if (source.type === 'directory') {
      throw new Error('暂不支持复制目录')
    }

    // 检查目标是否已存在
    const existingTarget = files.find(f => f.name === targetName)
    if (existingTarget) {
      throw new Error(`目标文件已存在: ${targetName}`)
    }

    // 创建新文件（复制）
    const result = this.fileSystemStore.createFile({
      name: targetName,
      size: source.size,
      type: 'file',
      parentId: currentDir
    }, source.allocationAlgorithm)

    if (result.success) {
      return `文件 "${sourceName}" 已复制为 "${targetName}"`
    } else {
      throw new Error(result.error)
    }
  }

  /**
   * 在文件名中搜索（grep命令）
   */
  grepFiles(args) {
    if (args.length === 0) {
      throw new Error('用法: grep <模式>')
    }

    const pattern = args[0].toLowerCase()
    const currentDir = this.fileSystemStore.currentDirectory
    const files = this.fileSystemStore.getFilesByParent(currentDir)
    const matches = files.filter(f => f.name.toLowerCase().includes(pattern))

    if (matches.length === 0) {
      return `未找到匹配 "${args[0]}" 的文件`
    }

    let output = `找到 ${matches.length} 个匹配项:\n\n`
    matches.forEach(item => {
      const icon = item.type === 'directory' ? '[DIR]' : '[FILE]'
      const size = item.type === 'file' 
        ? this.formatSize(item.size) 
        : `${this.fileSystemStore.getFilesByParent(item.id).length} 项`
      output += `${icon.padEnd(8)} ${item.name.padEnd(30)} ${size.padStart(10)}\n`
    })

    return output
  }

  /**
   * 显示文件列表前N项（head命令）
   */
  headFiles(args) {
    const currentDir = this.fileSystemStore.currentDirectory
    const files = this.fileSystemStore.getFilesByParent(currentDir)
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

    let limit = 10
    if (args.length > 0 && args[0] === '-n' && args[1]) {
      limit = parseInt(args[1]) || 10
    } else if (args.length > 0 && args[0].startsWith('-')) {
      limit = parseInt(args[0].substring(1)) || 10
    }

    const headFiles = files.slice(0, limit)

    if (headFiles.length === 0) {
      return '当前目录为空'
    }

    let output = `前 ${headFiles.length} 项:\n\n`
    headFiles.forEach(item => {
      const icon = item.type === 'directory' ? '[DIR]' : '[FILE]'
      const size = item.type === 'file' 
        ? this.formatSize(item.size) 
        : `${this.fileSystemStore.getFilesByParent(item.id).length} 项`
      output += `${icon.padEnd(8)} ${item.name.padEnd(30)} ${size.padStart(10)}\n`
    })

    return output
  }

  /**
   * 显示文件列表后N项（tail命令）
   */
  tailFiles(args) {
    const currentDir = this.fileSystemStore.currentDirectory
    const files = this.fileSystemStore.getFilesByParent(currentDir)
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

    let limit = 10
    if (args.length > 0 && args[0] === '-n' && args[1]) {
      limit = parseInt(args[1]) || 10
    } else if (args.length > 0 && args[0].startsWith('-')) {
      limit = parseInt(args[0].substring(1)) || 10
    }

    const tailFiles = files.slice(-limit)

    if (tailFiles.length === 0) {
      return '当前目录为空'
    }

    let output = `后 ${tailFiles.length} 项:\n\n`
    tailFiles.forEach(item => {
      const icon = item.type === 'directory' ? '[DIR]' : '[FILE]'
      const size = item.type === 'file' 
        ? this.formatSize(item.size) 
        : `${this.fileSystemStore.getFilesByParent(item.id).length} 项`
      output += `${icon.padEnd(8)} ${item.name.padEnd(30)} ${size.padStart(10)}\n`
    })

    return output
  }

  /**
   * 统计文件信息（wc命令）
   */
  wordCount(args) {
    const currentDir = args.length > 0 
      ? this.findDirectoryByName(args[0]) || this.fileSystemStore.currentDirectory
      : this.fileSystemStore.currentDirectory

    const files = this.fileSystemStore.getFilesByParent(currentDir)
    const fileCount = files.filter(f => f.type === 'file').length
    const dirCount = files.filter(f => f.type === 'directory').length
    const totalSize = files
      .filter(f => f.type === 'file')
      .reduce((sum, f) => sum + f.size, 0)
    const totalBlocks = files
      .filter(f => f.type === 'file')
      .reduce((sum, f) => sum + f.blocks.length, 0)

    return `文件数: ${fileCount}
目录数: ${dirCount}
总大小: ${this.formatSize(totalSize)}
总块数: ${totalBlocks}
总计: ${files.length} 项`
  }

  /**
   * 排序文件列表（sort命令）
   */
  sortFiles(args) {
    const currentDir = this.fileSystemStore.currentDirectory
    let files = [...this.fileSystemStore.getFilesByParent(currentDir)]

    // 排序选项
    const reverse = args.includes('-r') || args.includes('--reverse')
    const bySize = args.includes('-s') || args.includes('--size')
    const byTime = args.includes('-t') || args.includes('--time')

    if (bySize) {
      files.sort((a, b) => {
        const sizeA = a.type === 'file' ? a.size : 0
        const sizeB = b.type === 'file' ? b.size : 0
        return reverse ? sizeB - sizeA : sizeA - sizeB
      })
    } else if (byTime) {
      files.sort((a, b) => {
        const timeA = new Date(a.createTime).getTime()
        const timeB = new Date(b.createTime).getTime()
        return reverse ? timeB - timeA : timeA - timeB
      })
    } else {
      // 默认按名称排序
      files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        const cmp = a.name.localeCompare(b.name)
        return reverse ? -cmp : cmp
      })
    }

    if (files.length === 0) {
      return '当前目录为空'
    }

    let output = `排序结果 (${files.length} 项):\n\n`
    files.forEach(item => {
      const icon = item.type === 'directory' ? '[DIR]' : '[FILE]'
      const size = item.type === 'file' 
        ? this.formatSize(item.size) 
        : `${this.fileSystemStore.getFilesByParent(item.id).length} 项`
      const date = this.formatDate(item.createTime)
      output += `${icon.padEnd(8)} ${item.name.padEnd(30)} ${size.padStart(10)} ${date}\n`
    })

    return output
  }

  /**
   * 显示日期时间（date命令）
   */
  showDate() {
    const now = new Date()
    return now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long'
    })
  }

  /**
   * 显示当前用户信息（whoami命令）
   */
  whoAmI() {
    return `用户: root
系统: 文件系统终端
当前目录: ${this.getPathString()}`
  }

  /**
   * 显示系统信息（uname命令）
   */
  uname(args) {
    const showAll = args.includes('-a') || args.includes('--all')
    
    if (showAll) {
      return `系统名称: 文件系统终端
节点名称: filesystem
版本: 1.0.0
机器: Web Browser
处理器: JavaScript Engine
操作系统: Web Platform`
    } else {
      return '文件系统终端'
    }
  }

  /**
   * 处理命令别名（alias命令）
   */
  handleAlias(args) {
    if (args.length === 0) {
      return `可用别名:
  ls    -> dir
  rm    -> delete
  touch -> create
  quit  -> exit
  cls   -> clear`
    }

    if (args.length === 1 && args[0] === '--help') {
      return `用法:
  alias              - 显示所有别名
  alias <名称>       - 显示指定别名
  alias <名称>=<命令> - 设置别名（暂不支持）`
    }

    return '设置别名功能暂未实现'
  }

  /**
   * 根据名称查找目录
   */
  findDirectoryByName(name) {
    const currentDir = this.fileSystemStore.currentDirectory
    const files = this.fileSystemStore.getFilesByParent(currentDir)
    const dir = files.find(f => f.name === name && f.type === 'directory')
    return dir ? dir.id : null
  }

  /**
   * 获取分配算法名称
   */
  getAllocationAlgorithmName(algorithm) {
    const names = {
      'continuous': '连续分配',
      'linked': '链接分配',
      'indexed': '索引分配'
    }
    return names[algorithm] || algorithm
  }
}

