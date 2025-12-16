import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { gsap } from 'gsap'
import { getFileColor, clearFileColors, removeFileColor } from '@/utils/colorGenerator'

/**
 * Three.js 3D渲染器
 * 负责初始化Three.js场景、相机、渲染器，封装磁盘、目录树、文件节点的3D模型创建与动画控制
 */
export class ThreeDRenderer {
  constructor(container) {
    this.container = container
    this.scene = null
    this.camera = null
    this.renderer = null
    this.raycaster = null
    this.mouse = new THREE.Vector2()
    this.diskBlocks = []
    this.directoryTree = null
    this.fileNodes = new Map() // 文件ID -> 3D节点
    this.onSelectCallback = null
    this.onHoverCallback = null // 悬停回调
    this.onConnectionSelectCallback = null // 连接线选择回调
    this.controls = null
    this.hoveredBlock = null // 当前悬停的块
    this.highlightedBlocks = new Set() // 当前高亮（浮起）的块集合
    this.gridSize = 0 // 保存网格大小，用于优化上浮动画
    this.spacing = 1.15 // 保存块间距
    this.activeAnimations = new Map() // 跟踪每个块的活跃动画，防止被重置
    this.fileStructureTree = null // 文件结构树组
    this.fileStructureNodes = new Map() // 文件结构节点映射
    this.fileStructureLines = [] // 文件结构连接线
    this.currentView = 'disk' // 当前视图：'disk'、'tree' 或 'index'
    this.gridHelper = null // 网格辅助对象
    // 索引可视化相关
    this.indexVisualizationGroup = null // 索引可视化组
    this.indexBlocks = [] // 索引可视化中的块
    this.indexLines = [] // 索引可视化中的连接线
    this.indexLabels = [] // 索引可视化中的标签
    this.indexInfoPanel = null // 索引信息面板
    this.textLabelCache = new Map() // 文字标签缓存（性能优化）
    this.sharedGeometry = new Map() // 共享几何体缓存
    this.sharedMaterial = new Map() // 共享材质缓存
  }
  
  /**
   * 初始化场景
   */
  init() {
    // 创建场景
    this.scene = new THREE.Scene()
    // 使用更现代的深色背景，带一点蓝色调
    this.scene.background = new THREE.Color(0x0f1419)
    
    // 创建相机
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    this.camera.position.set(0, 10, 20)
    this.camera.lookAt(0, 0, 0)
    
    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    // 启用阴影（如果需要）
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.container.appendChild(this.renderer.domElement)
    
    // 优化光照系统
    // 环境光 - 提供基础照明
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambientLight)
    
    // 主方向光 - 模拟太阳光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(15, 20, 10)
    directionalLight.castShadow = true
    directionalLight.shadow.mapSize.width = 2048
    directionalLight.shadow.mapSize.height = 2048
    this.scene.add(directionalLight)
    
    // 补充光源 - 从另一侧提供柔和照明
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight.position.set(-10, 10, -5)
    this.scene.add(fillLight)
    
    // 点光源 - 提供局部高光
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 100)
    pointLight.position.set(0, 15, 0)
    this.scene.add(pointLight)
    
    // 添加网格地面（可选，用于更好的空间感）
    this.gridHelper = new THREE.GridHelper(50, 50, 0x2a2a3a, 0x1a1a2a)
    this.gridHelper.position.y = -0.5
    this.scene.add(this.gridHelper)
    
    // 创建射线投射器（用于鼠标交互）
    this.raycaster = new THREE.Raycaster()
    
    // 添加轨道控制器（支持鼠标拖拽、缩放、旋转）
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true // 启用阻尼效果，使旋转更平滑
    this.controls.dampingFactor = 0.05
    this.controls.enableZoom = true // 启用缩放
    this.controls.enablePan = true // 启用平移
    this.controls.minDistance = 5 // 最小缩放距离
    this.controls.maxDistance = 100 // 最大缩放距离
    this.controls.maxPolarAngle = Math.PI / 1.5 // 限制垂直旋转角度
    this.controls.target.set(0, 0, 0) // 设置旋转中心点
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => this.onWindowResize())
    
    // 监听鼠标事件（用于点击选择，不影响轨道控制）
    this.container.addEventListener('mousemove', (e) => this.onMouseMove(e))
    this.container.addEventListener('click', (e) => this.onMouseClick(e))
    this.container.addEventListener('mouseleave', () => this.onMouseLeave())
    
    // 开始渲染循环
    this.animate()
  }
  
  /**
   * 创建文本纹理
   * @param {string} text - 文本内容
   * @param {number} fontSize - 字体大小
   * @param {string} fontColor - 字体颜色
   * @param {string} bgColor - 背景颜色
   * @returns {THREE.CanvasTexture} 文本纹理
   */
  createTextTexture(text, fontSize = 32, fontColor = '#ffffff', bgColor = 'rgba(0, 0, 0, 0.8)') {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    // 设置画布大小
    canvas.width = 256
    canvas.height = 64
    
    // 绘制背景
    context.fillStyle = bgColor
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // 设置字体样式
    context.font = `bold ${fontSize}px Arial`
    context.fillStyle = fontColor
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    
    // 绘制文本（如果文本太长，进行截断）
    const maxWidth = canvas.width - 20
    let displayText = text
    if (context.measureText(text).width > maxWidth) {
      // 截断文本并添加省略号
      while (context.measureText(displayText + '...').width > maxWidth && displayText.length > 0) {
        displayText = displayText.slice(0, -1)
      }
      displayText += '...'
    }
    
    context.fillText(displayText, canvas.width / 2, canvas.height / 2)
    
    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }

  /**
   * 创建磁盘可视化
   * @param {Object} disk - 磁盘对象
   */
  createDisk(disk) {
    this.disk = disk // 保存磁盘对象引用
    
    // 清除旧的磁盘块
    this.diskBlocks.forEach(block => {
      if (block.parent) {
        this.scene.remove(block)
      }
    })
    this.diskBlocks = []
    
    const { totalBlocks } = disk
    if (totalBlocks === 0) {
      return // 如果没有块，不创建
    }
    
    this.gridSize = Math.ceil(Math.sqrt(totalBlocks))
    this.spacing = 1.15 // 稍微减小间距，让块更紧凑
    const gridSize = this.gridSize
    const spacing = this.spacing
    
    // 创建磁盘块网格
    for (let i = 0; i < totalBlocks; i++) {
      const row = Math.floor(i / gridSize)
      const col = i % gridSize
      
      // 使用圆角盒子几何体（通过增加分段数模拟圆角效果）
      const geometry = new THREE.BoxGeometry(0.95, 0.6, 0.95, 2, 2, 2)
      
      // 优化材质效果
      const blockColor = this.getBlockColor(disk, i)
      const material = new THREE.MeshStandardMaterial({
        color: blockColor,
        metalness: 0.3, // 增加金属感
        roughness: 0.4, // 降低粗糙度，更光滑
        transparent: true,
        opacity: 1.0,
        emissive: new THREE.Color(blockColor).multiplyScalar(0.1), // 添加微弱的自发光
        emissiveIntensity: 0.1
      })
      
      const block = new THREE.Mesh(geometry, material)
      block.position.set(
        (col - gridSize / 2) * spacing,
        0.3, // 稍微抬高，让块浮起来
        (row - gridSize / 2) * spacing
      )
      
      // 添加轻微的随机旋转，让视觉效果更自然
      block.rotation.y = (Math.random() - 0.5) * 0.1
      
      // 启用接收阴影
      block.receiveShadow = true
      block.castShadow = true
      
      // 获取块对应的文件信息
      const file = disk.usedBlocks && disk.usedBlocks[i]
      block.userData = { 
        blockNumber: i, 
        type: 'diskBlock',
        file: file || null
      }
      
      this.scene.add(block)
      this.diskBlocks.push(block)
    }
    
    // 保存磁盘引用
    this.disk = disk
  }

  
  /**
   * 调整相机位置以适应磁盘大小
   * @param {Object} disk - 磁盘对象
   */
  adjustCameraForDisk(disk) {
    if (!this.camera || !disk || disk.totalBlocks === 0) return
    
    const gridSize = Math.ceil(Math.sqrt(disk.totalBlocks))
    const spacing = 1.2
    const maxDimension = Math.max(gridSize * spacing, 10)
    
    // 根据磁盘大小调整相机距离
    const distance = maxDimension * 1.5
    this.camera.position.set(distance * 0.5, distance * 0.8, distance)
    this.camera.lookAt(0, 0, 0)
    
    // 更新控制器目标
    if (this.controls) {
      this.controls.target.set(0, 0, 0)
      this.controls.update()
    }
  }
  
  /**
   * 获取块颜色
   */
  getBlockColor(disk, blockNumber) {
    if (disk.freeBlocks.includes(blockNumber)) {
      // 空闲块 - 使用更柔和的深蓝灰色，带一点透明度感
      return 0x3a4a5c
    } else if (disk.usedBlocks[blockNumber]) {
      // 使用文件对应的颜色，增强饱和度
      const file = disk.usedBlocks[blockNumber]
      const baseColor = getFileColor(file.id)
      // 稍微增强颜色亮度
      const color = new THREE.Color(baseColor)
      color.r = Math.min(1, color.r * 1.1)
      color.g = Math.min(1, color.g * 1.1)
      color.b = Math.min(1, color.b * 1.1)
      return color.getHex()
    } else {
      // 碎片块 - 使用更明显的橙红色，带警告感
      return 0xff6b6b
    }
  }
  
  /**
   * 更新磁盘块颜色
   * @param {Object} disk - 磁盘对象
   * @param {boolean} animate - 是否使用动画
   */
  updateDiskBlocks(disk, animate = false) {
    this.disk = disk
    
    // 确保磁盘块数量匹配
    if (this.diskBlocks.length !== disk.totalBlocks) {
      // 如果数量不匹配，重新创建磁盘
      this.createDisk(disk)
      return
    }
    
    // 先停止所有活跃的高亮动画，并重置块的状态
    this.diskBlocks.forEach((block) => {
      if (!block) return
      
      // 停止活跃的高亮动画
      if (block.userData.highlightAnimations) {
        const anims = block.userData.highlightAnimations
        if (anims.position) anims.position.kill()
        if (anims.scale) anims.scale.kill()
        if (anims.emissive) anims.emissive.kill()
        if (anims.material) anims.material.kill()
        delete block.userData.highlightAnimations
      }
      
      // 从活跃动画集合中移除
      this.activeAnimations.delete(block)
      
      // 重置块的位置、缩放和材质属性（立即重置，不使用动画，因为后面会重新应用高亮）
      // 只重置 y 坐标（高度），x 和 z 坐标保持不变
      block.position.y = 0.3
      
      // 重置缩放
      block.scale.set(1, 1, 1)
      
      // 重置材质属性
      if (block.material) {
        block.material.emissiveIntensity = 0.1
        block.material.metalness = 0.3
        block.material.roughness = 0.4
      }
    })
    
    // 清除高亮块集合（因为块的文件信息已经改变，需要重新高亮）
    this.highlightedBlocks.clear()
    
    // 更新块的颜色和文件信息
    this.diskBlocks.forEach((block, index) => {
      if (index < disk.totalBlocks) {
        const targetColor = this.getBlockColor(disk, index)
        if (animate) {
          this.animateBlockColor(index, targetColor, 0.3)
        } else {
          block.material.color.setHex(targetColor)
        }
        
        // 更新块的文件信息
        const file = disk.usedBlocks && disk.usedBlocks[index]
        block.userData.file = file || null
      }
    })
  }
  
  /**
   * 创建目录树
   * @param {Array} files - 文件列表
   */
  createDirectoryTree(files) {
    // 清除旧的目录树节点
    this.fileNodes.forEach(node => {
      if (node.mesh) {
        this.scene.remove(node.mesh)
      }
      if (node.textMesh) {
        this.scene.remove(node.textMesh)
      }
      if (node.line) {
        this.scene.remove(node.line)
      }
    })
    this.fileNodes.clear()
    
    if (!files || files.length === 0) {
      return
    }
    
    // 构建树形结构
    const rootFiles = files.filter(f => f.parentId === 'root')
    const treeHeight = this.calculateTreeHeight(files)
    const startY = 8
    const spacing = 3
    
    // 创建根节点
    const rootGroup = new THREE.Group()
    rootGroup.position.set(0, startY, 0)
    this.scene.add(rootGroup)
    
    // 递归创建文件节点
    this.createFileNodes(rootFiles, files, rootGroup, 0, treeHeight, spacing)
  }
  
  /**
   * 计算树的高度
   */
  calculateTreeHeight(files) {
    const getDepth = (fileId, depth = 0) => {
      const children = files.filter(f => f.parentId === fileId)
      if (children.length === 0) return depth
      return Math.max(...children.map(child => getDepth(child.id, depth + 1)))
    }
    return getDepth('root')
  }
  
  /**
   * 创建文件节点
   */
  createFileNodes(files, allFiles, parentGroup, level, maxLevel, spacing) {
    if (files.length === 0) return
    
    const angleStep = (Math.PI * 2) / Math.max(files.length, 1)
    const radius = spacing * (maxLevel - level + 1)
    
    files.forEach((file, index) => {
      const angle = angleStep * index
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const y = -spacing * level
      
      // 创建文件节点（球体）
      const geometry = new THREE.SphereGeometry(0.3, 16, 16)
      // 使用文件对应的颜色
      const fileColor = getFileColor(file.id)
      const rgb = {
        r: (fileColor >> 16) & 0xff,
        g: (fileColor >> 8) & 0xff,
        b: fileColor & 0xff
      }
      // 计算较暗的发光颜色
      const emissiveColor = {
        r: Math.floor(rgb.r * 0.5),
        g: Math.floor(rgb.g * 0.5),
        b: Math.floor(rgb.b * 0.5)
      }
      const emissiveHex = (emissiveColor.r << 16) | (emissiveColor.g << 8) | emissiveColor.b
      
      const material = new THREE.MeshStandardMaterial({
        color: fileColor,
        emissive: emissiveHex,
        emissiveIntensity: 0.2
      })
      
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, y, z)
      mesh.userData = { fileId: file.id, file, type: 'fileNode' }
      
      // 添加文字标签（简化处理：使用几何体表示文件名）
      const textGeometry = new THREE.PlaneGeometry(1, 0.3)
      const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
      const textMesh = new THREE.Mesh(textGeometry, textMaterial)
      textMesh.position.set(x, y + 0.5, z)
      if (this.camera) {
        textMesh.lookAt(this.camera.position)
      }
      
      // 创建连接线（如果不是根节点）
      if (level > 0) {
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(x, y, z)
        ])
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x718096, opacity: 0.5, transparent: true })
        const line = new THREE.Line(lineGeometry, lineMaterial)
        parentGroup.add(line)
        
        // 存储节点信息
        this.fileNodes.set(file.id, { mesh, textMesh, line, file })
      } else {
        this.fileNodes.set(file.id, { mesh, textMesh, line: null, file })
      }
      
      parentGroup.add(mesh)
      parentGroup.add(textMesh)
      
      // 递归创建子节点
      const children = allFiles.filter(f => f.parentId === file.id)
      if (children.length > 0) {
        const childGroup = new THREE.Group()
        childGroup.position.set(x, y, z)
        parentGroup.add(childGroup)
        this.createFileNodes(children, allFiles, childGroup, level + 1, maxLevel, spacing)
      }
    })
  }
  
  /**
   * 动画更新块颜色
   */
  animateBlockColor(blockIndex, targetColor, duration = 0.5) {
    const block = this.diskBlocks[blockIndex]
    if (!block) return
    
    const material = block.material
    const currentColor = material.color.getHex()
    
    gsap.to(material.color, {
      r: (targetColor >> 16) / 255,
      g: ((targetColor >> 8) & 0xff) / 255,
      b: (targetColor & 0xff) / 255,
      duration,
      ease: 'power2.out'
    })
    
    // 添加闪烁效果
    gsap.to(block.scale, {
      x: 1.2,
      y: 1.2,
      z: 1.2,
      duration: 0.2,
      yoyo: true,
      repeat: 1,
      ease: 'power2.inOut'
    })
  }
  
  /**
   * 动画更新多个块
   */
  animateBlocks(blockIndices, targetColor, duration = 0.5) {
    blockIndices.forEach((blockIndex, index) => {
      setTimeout(() => {
        this.animateBlockColor(blockIndex, targetColor, duration)
      }, index * 50) // 错开动画时间
    })
  }
  
  /**
   * 高亮文件节点
   */
  highlightFileNode(fileId) {
    // 取消之前的高亮
    this.fileNodes.forEach(node => {
      node.mesh.material.emissiveIntensity = 0.2
    })
    
    const node = this.fileNodes.get(fileId)
    if (node) {
      gsap.to(node.mesh.material, {
        emissiveIntensity: 0.8,
        duration: 0.3
      })
      
      // 高亮对应的磁盘块
      if (node.file.blocks) {
        node.file.blocks.forEach(blockNum => {
          const block = this.diskBlocks[blockNum]
          if (block) {
            gsap.to(block.position, {
              y: 0.5,
              duration: 0.3,
              yoyo: true,
              repeat: 1,
              ease: 'power2.inOut'
            })
          }
        })
      }
    }
  }

  /**
   * 高亮文件/文件夹对应的磁盘块（向上弹出效果）
   * @param {Object} file - 文件或文件夹对象
   */
  highlightFileBlocks(file) {
    if (!file || !this.disk || !this.diskBlocks) {
      console.warn('highlightFileBlocks: 缺少必要参数', { file, hasDisk: !!this.disk, hasBlocks: !!this.diskBlocks })
      return
    }
    
    // 停止所有之前的高亮动画
    this.diskBlocks.forEach((block) => {
      if (!block) return
      
      // 如果有活跃的高亮动画，先停止它们
      if (block.userData.highlightAnimations) {
        const anims = block.userData.highlightAnimations
        if (anims.position) anims.position.kill()
        if (anims.scale) anims.scale.kill()
        if (anims.emissive) anims.emissive.kill()
        if (anims.material) anims.material.kill()
        delete block.userData.highlightAnimations
      }
      
      // 从活跃动画集合中移除
      this.activeAnimations.delete(block)
    })
    
    // 清除之前的高亮块集合（准备添加新的）
    this.highlightedBlocks.clear()
    
    // 收集需要高亮的块
    const blocksToHighlight = new Set()
    
    if (file.type === 'file') {
      // 如果是文件，直接获取其占用的块
      if (file.blocks && file.blocks.length > 0) {
        file.blocks.forEach(blockNum => {
          // 验证块号是否有效
          if (blockNum >= 0 && blockNum < this.diskBlocks.length) {
          blocksToHighlight.add(blockNum)
          } else {
            console.warn(`highlightFileBlocks: 文件 ${file.name} 的块号 ${blockNum} 无效`, { file, blockNum, totalBlocks: this.diskBlocks.length })
          }
        })
      } else {
        console.warn(`highlightFileBlocks: 文件 ${file.name} 没有分配块`, { file })
      }
    } else if (file.type === 'directory') {
      // 如果是目录，获取目录及其所有子目录下所有文件占用的块
      const allFiles = this.getAllFilesInDirectory(file.id)
      console.log(`highlightFileBlocks: 目录 ${file.name} 包含 ${allFiles.length} 个文件`, { directory: file, files: allFiles })
      
      allFiles.forEach(f => {
        if (f.blocks && f.blocks.length > 0) {
          f.blocks.forEach(blockNum => {
            // 验证块号是否有效
            if (blockNum >= 0 && blockNum < this.diskBlocks.length) {
            blocksToHighlight.add(blockNum)
            } else {
              console.warn(`highlightFileBlocks: 文件 ${f.name} 的块号 ${blockNum} 无效`, { file: f, blockNum, totalBlocks: this.diskBlocks.length })
            }
          })
        }
      })
    } else {
      console.warn(`highlightFileBlocks: 未知的文件类型 ${file.type}`, { file })
    }
    
    console.log(`highlightFileBlocks: 将为 ${file.name} (${file.type}) 高亮 ${blocksToHighlight.size} 个块`, { 
      file, 
      blockCount: blocksToHighlight.size,
      blocks: Array.from(blocksToHighlight).slice(0, 10) // 只显示前10个块号
    })
    
    // 清除之前的高亮块集合
    this.highlightedBlocks.clear()
    
    // 优化：按块的空间位置分组，同一组同时上浮，加快速度
    if (!this.disk || blocksToHighlight.size === 0) return
    
    // 使用保存的网格信息，如果没有则计算
    const gridSize = this.gridSize || Math.ceil(Math.sqrt(this.disk.totalBlocks))
    const spacing = this.spacing || 1.15
    
    // 按行分组块（根据块的Z坐标，即行号）
    const blocksByRow = new Map()
    const blockPositions = new Map() // 存储块的位置信息
    
    blocksToHighlight.forEach(blockNum => {
      const block = this.diskBlocks[blockNum]
      if (block) {
        // 添加到高亮块集合
        this.highlightedBlocks.add(block)
        
        // 计算块所在的行（根据Z坐标）
        const row = Math.round((block.position.z + (gridSize * spacing) / 2) / spacing)
        
        if (!blocksByRow.has(row)) {
          blocksByRow.set(row, [])
        }
        blocksByRow.get(row).push(block)
        blockPositions.set(block, { blockNum, row })
      }
    })
    
    // 按行号排序
    const sortedRows = Array.from(blocksByRow.keys()).sort((a, b) => a - b)
    
    // 优化：使用更短的延迟，同一行的块同时开始，不同行之间延迟很小
    sortedRows.forEach((row, rowIndex) => {
      const blocksInRow = blocksByRow.get(row)
      const delay = rowIndex * 3 // 每行之间只延迟3ms（从10ms减少到3ms）
      
      // 同一行的所有块同时开始动画
      blocksInRow.forEach(block => {
        setTimeout(() => {
          // 检查块是否仍然在高亮集合中（防止在动画期间被清除）
          if (!this.highlightedBlocks.has(block)) {
            return // 如果块不在高亮集合中，跳过动画
          }
          
          // 记录动画开始，防止被其他操作重置
          const animationId = `highlight_${Date.now()}_${Math.random()}`
          this.activeAnimations.set(block, animationId)
          
          // 向上弹出（减少动画时间，使用 overwrite 确保覆盖之前的动画）
          const positionTween = gsap.to(block.position, {
            y: 1.2,
            duration: 0.2, // 进一步减少动画时间
            ease: 'power2.out', // 使用更快的缓动函数
            overwrite: 'auto', // 自动覆盖之前的动画
            onComplete: () => {
              // 动画完成后，确保块保持在上浮状态
              if (this.activeAnimations.get(block) === animationId && this.highlightedBlocks.has(block)) {
                // 保持上浮状态，确保位置正确
                block.position.y = 1.2
                block.scale.set(1.2, 1.2, 1.2)
              }
            }
          })
          
          // 放大效果（减少动画时间，使用 overwrite 确保覆盖之前的动画）
          const scaleTween = gsap.to(block.scale, {
            x: 1.2,
            y: 1.2,
            z: 1.2,
            duration: 0.2, // 进一步减少动画时间
            ease: 'power2.out', // 使用更快的缓动函数
            overwrite: 'auto' // 自动覆盖之前的动画
          })
          
          // 添加发光效果（减少动画时间，增强视觉效果）
          if (!block.material.emissive) {
            // 使用块本身的颜色作为发光色
            block.material.emissive = new THREE.Color(block.material.color)
          } else {
            block.material.emissive.copy(block.material.color)
          }
          const emissiveTween =           gsap.to(block.material, {
            emissiveIntensity: 1.2, // 增强发光强度
            duration: 0.2, // 进一步减少动画时间
            overwrite: 'auto' // 自动覆盖之前的动画
          })
          
          // 添加边缘高光效果
          const materialTween = gsap.to(block.material, {
            metalness: 0.8, // 增加金属感
            roughness: 0.2, // 降低粗糙度，更光滑
            duration: 0.2, // 进一步减少动画时间
            overwrite: 'auto' // 自动覆盖之前的动画
          })
          
          // 存储动画引用，以便在需要时停止
          block.userData.highlightAnimations = {
            position: positionTween,
            scale: scaleTween,
            emissive: emissiveTween,
            material: materialTween,
            animationId: animationId
          }
          
        }, delay)
      })
    })
  }

  /**
   * 置灰特定文件的块（删除文件时使用）
   * @param {Object} file - 要置灰的文件对象
   */
  grayFileBlocks(file) {
    if (!file || !this.disk || !this.diskBlocks) return
    
    // 获取文件占用的所有块
    const blocksToGray = new Set()
    
    if (file.type === 'file') {
      // 如果是文件，直接获取其占用的块
      if (file.blocks && file.blocks.length > 0) {
        file.blocks.forEach(blockNum => {
          if (blockNum >= 0 && blockNum < this.diskBlocks.length) {
            blocksToGray.add(blockNum)
          }
        })
      }
    } else if (file.type === 'directory') {
      // 如果是目录，获取目录及其所有子目录下所有文件占用的块
      const allFiles = this.getAllFilesInDirectory(file.id)
      allFiles.forEach(f => {
        if (f.blocks && f.blocks.length > 0) {
          f.blocks.forEach(blockNum => {
            if (blockNum >= 0 && blockNum < this.diskBlocks.length) {
              blocksToGray.add(blockNum)
            }
          })
        }
      })
    }
    
    // 将对应的块置灰（设置为空闲块颜色，确保和空闲块完全一致）
    const freeBlockColor = 0x3a4a5c // 空闲块颜色，与 getBlockColor 中的定义一致
    blocksToGray.forEach(blockNum => {
      const block = this.diskBlocks[blockNum]
      if (block && block.material) {
        // 立即置灰，不使用动画，确保颜色和空闲块完全一致
        block.material.color.setHex(freeBlockColor)
        // 重置位置和缩放
        block.position.y = 0.3
        block.scale.set(1, 1, 1)
        // 重置材质属性，确保和空闲块完全一致
        block.material.emissiveIntensity = 0.1
        block.material.metalness = 0.3
        block.material.roughness = 0.4
        block.material.opacity = 1.0 // 确保不透明度为1
        // 清除文件信息
        block.userData.file = null
      }
    })
  }
  
  /**
   * 置灰所有块（碎片整理和重新配置时使用）
   */
  grayAllBlocks() {
    if (!this.diskBlocks || this.diskBlocks.length === 0) return
    
    // 停止所有活跃的高亮动画
    this.diskBlocks.forEach((block) => {
      if (!block) return
      
      // 停止活跃的高亮动画
      if (block.userData.highlightAnimations) {
        const anims = block.userData.highlightAnimations
        if (anims.position) anims.position.kill()
        if (anims.scale) anims.scale.kill()
        if (anims.emissive) anims.emissive.kill()
        if (anims.material) anims.material.kill()
        delete block.userData.highlightAnimations
      }
      
      // 从活跃动画集合中移除
      this.activeAnimations.delete(block)
    })
    
    // 清除高亮块集合
    this.highlightedBlocks.clear()
    
    // 将所有块置灰（使用空闲块颜色，确保和空闲块完全一致）
    const freeBlockColor = 0x3a4a5c // 空闲块颜色，与 getBlockColor 中的定义一致
    this.diskBlocks.forEach((block) => {
      if (!block) return
      
      // 立即置灰，确保颜色和空闲块完全一致
      if (block.material) {
        block.material.color.setHex(freeBlockColor)
        block.material.emissiveIntensity = 0.1
        block.material.metalness = 0.3
        block.material.roughness = 0.4
        block.material.opacity = 1.0 // 确保不透明度为1
      }
      
      // 重置位置和缩放
      block.position.y = 0.3
      block.scale.set(1, 1, 1)
      
      // 清除文件信息
      block.userData.file = null
    })
  }
  
  /**
   * 重置所有磁盘块（恢复原始状态）
   */
  resetAllBlocks() {
    if (!this.diskBlocks || this.diskBlocks.length === 0) return
    
    // 停止所有活跃的高亮动画
    this.diskBlocks.forEach((block) => {
      if (!block) return
      
      // 如果有活跃的高亮动画，先停止它们
      if (block.userData.highlightAnimations) {
        const anims = block.userData.highlightAnimations
        if (anims.position) anims.position.kill()
        if (anims.scale) anims.scale.kill()
        if (anims.emissive) anims.emissive.kill()
        if (anims.material) anims.material.kill()
        delete block.userData.highlightAnimations
      }
      
      // 从活跃动画集合中移除
      this.activeAnimations.delete(block)
    })
    
    // 清除高亮块集合
    this.highlightedBlocks.clear()
    
    this.diskBlocks.forEach((block, index) => {
      if (!block) return
      
      // 恢复位置（恢复到初始高度 0.3）
      gsap.to(block.position, {
        y: 0.3,
        duration: 0.3,
        ease: 'power2.out'
      })
      
      // 恢复大小
      gsap.to(block.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.3,
        ease: 'power2.out'
      })
      
      // 恢复发光
      if (block.material.emissive) {
        gsap.to(block.material, {
          emissiveIntensity: 0.1, // 恢复到初始的微弱发光
          duration: 0.3
        })
      }
      
      // 恢复材质属性
      gsap.to(block.material, {
        metalness: 0.3, // 恢复到初始金属度
        roughness: 0.4, // 恢复到初始粗糙度
        duration: 0.3
      })
      
    })
  }

  /**
   * 递归获取目录及其所有子目录下的所有文件
   * @param {string} dirId - 目录ID
   * @returns {Array} 文件列表
   */
  getAllFilesInDirectory(dirId) {
    if (!this.disk || !this.disk.files) return []
    
    const allFiles = []
    const visited = new Set()
    
    const collectFiles = (currentDirId) => {
      if (visited.has(currentDirId)) return
      visited.add(currentDirId)
      
      const items = this.disk.files.filter(f => f.parentId === currentDirId)
      items.forEach(item => {
        if (item.type === 'file') {
          allFiles.push(item)
        } else if (item.type === 'directory') {
          collectFiles(item.id)
        }
      })
    }
    
    collectFiles(dirId)
    return allFiles
  }

  /**
   * 根据目录过滤显示磁盘块
   * 只显示当前目录下文件占用的块，其他块变暗
   * @param {string} dirId - 目录ID，'root' 表示根目录
   * @param {boolean} animate - 是否使用动画
   */
  filterBlocksByDirectory(dirId, animate = true) {
    if (!this.disk || !this.diskBlocks || this.diskBlocks.length === 0) return
    
    // 确保材质支持透明度
    this.diskBlocks.forEach(block => {
      if (block && block.material) {
        block.material.transparent = true
      }
    })
    
    // 收集当前目录下所有文件占用的块
    const blocksInDirectory = new Set()
    
    if (dirId === 'root') {
      // 根目录：显示所有文件占用的块（包括所有子目录下的文件）
      // 获取所有文件（不仅仅是根目录下的直接文件）
      const allFiles = this.disk.files.filter(f => f.type === 'file')
      allFiles.forEach(file => {
        if (file.blocks && file.blocks.length > 0) {
          file.blocks.forEach(blockNum => {
            blocksInDirectory.add(blockNum)
          })
        }
      })
    } else {
      // 普通目录：只显示该目录及其子目录下文件占用的块
      const allFiles = this.getAllFilesInDirectory(dirId)
      allFiles.forEach(file => {
        if (file.blocks && file.blocks.length > 0) {
          file.blocks.forEach(blockNum => {
            blocksInDirectory.add(blockNum)
          })
        }
      })
    }
    
    // 更新所有块的显示状态（但不要重置高亮的块）
    this.diskBlocks.forEach((block, index) => {
      if (!block) return
      
      // 如果块正在高亮动画中，不要重置它的位置和缩放
      const isHighlighted = this.highlightedBlocks.has(block)
      
      const isInDirectory = blocksInDirectory.has(index)
      const isFreeBlock = this.disk.freeBlocks && this.disk.freeBlocks.includes(index)
      
      if (animate) {
        // 使用动画更新
        if (isInDirectory || isFreeBlock) {
          // 显示：恢复正常颜色和透明度
          gsap.to(block.material, {
            opacity: 1.0,
            duration: 0.3,
            ease: 'power2.out'
          })
          // 恢复原始颜色
          const targetColor = this.getBlockColor(this.disk, index)
          this.animateBlockColor(index, targetColor, 0.3)
          
          // 如果块不是高亮的，才重置位置（高亮的块保持上浮状态）
          if (!isHighlighted) {
            // 确保位置正确（但不要强制重置，避免干扰动画）
          }
        } else {
          // 隐藏：变暗
          gsap.to(block.material, {
            opacity: 0.2,
            duration: 0.3,
            ease: 'power2.out'
          })
          // 变灰
          gsap.to(block.material.color, {
            r: 0.3,
            g: 0.3,
            b: 0.3,
            duration: 0.3,
            ease: 'power2.out'
          })
          
          // 如果块不是高亮的，才重置位置
          if (!isHighlighted) {
            // 确保位置正确（但不要强制重置，避免干扰动画）
          }
        }
      } else {
        // 不使用动画，直接更新
        if (isInDirectory || isFreeBlock) {
          block.material.opacity = 1.0
          const targetColor = this.getBlockColor(this.disk, index)
          block.material.color.setHex(targetColor)
        } else {
          block.material.opacity = 0.2
          block.material.color.setRGB(0.3, 0.3, 0.3)
        }
        
        // 如果块不是高亮的，才重置位置
        if (!isHighlighted) {
          // 确保位置正确（但不要强制重置，避免干扰动画）
        }
      }
    })
  }
  
  /**
   * 高亮目录下的所有文件块
   * @param {Array} files - 文件列表
   */
  highlightDirectoryFiles(files) {
    // 先重置所有块的位置和发光
    this.diskBlocks.forEach(block => {
      // 重置位置
      gsap.to(block.position, {
        y: 0,
        duration: 0.2
      })
      
      // 重置发光
      if (block.material.emissive) {
        block.material.emissiveIntensity = 0
      }
    })
    
    // 收集所有需要高亮的块
    const blocksToHighlight = new Set()
    files.forEach(file => {
      if (file.blocks && file.blocks.length > 0) {
        file.blocks.forEach(blockNum => {
          blocksToHighlight.add(blockNum)
        })
      }
    })
    
    // 高亮显示这些块
    blocksToHighlight.forEach((blockNum, index) => {
      const block = this.diskBlocks[blockNum]
      if (block) {
        // 延迟动画，创建波浪效果
        setTimeout(() => {
          // 向上移动
          gsap.to(block.position, {
            y: 0.8,
            duration: 0.4,
            ease: 'power2.out'
          })
          
          // 添加发光效果
          if (block.material.emissive) {
            gsap.to(block.material, {
              emissiveIntensity: 0.5,
              duration: 0.4
            })
          }
          
          // 添加脉冲效果
          gsap.to(block.scale, {
            x: 1.1,
            y: 1.1,
            z: 1.1,
            duration: 0.3,
            yoyo: true,
            repeat: 1,
            ease: 'power2.inOut'
          })
        }, index * 30) // 每个块延迟30ms
      }
    })
  }
  
  /**
   * 只显示当前目录及其子目录的文件块，其他块变暗
   * @param {Array} files - 当前目录及其子目录的文件列表
   * @param {Object} disk - 磁盘对象
   */
  showDirectoryFilesOnly(files, disk) {
    if (!disk || !this.diskBlocks || this.diskBlocks.length === 0) return
    
    // 收集当前目录及其子目录中文件占用的所有块
    const directoryBlocks = new Set()
    files.forEach(file => {
      if (file && file.blocks && file.blocks.length > 0) {
        file.blocks.forEach(blockNum => {
          directoryBlocks.add(blockNum)
        })
      }
    })
    
    // 更新所有磁盘块的显示状态
    this.diskBlocks.forEach((block, blockNum) => {
      if (blockNum >= disk.totalBlocks || !block) return
      
      const isInDirectory = directoryBlocks.has(blockNum)
      const isFree = disk.freeBlocks && disk.freeBlocks.includes(blockNum)
      
      if (isInDirectory) {
        // 当前目录的文件块：正常显示，高亮
        const file = disk.usedBlocks && disk.usedBlocks[blockNum]
        const targetColor = file ? getFileColor(file.id) : 0x2d3748
        
        const r = ((targetColor >> 16) & 0xff) / 255
        const g = ((targetColor >> 8) & 0xff) / 255
        const b = (targetColor & 0xff) / 255
        
        gsap.to(block.material.color, {
          r,
          g,
          b,
          duration: 0.3,
          ease: 'power2.out'
        })
        
        // 添加发光效果
        if (!block.material.emissive) {
          block.material.emissive = new THREE.Color(0x000000)
        }
        const emissiveColor = {
          r: r * 0.5,
          g: g * 0.5,
          b: b * 0.5
        }
        gsap.to(block.material.emissive, {
          r: emissiveColor.r,
          g: emissiveColor.g,
          b: emissiveColor.b,
          duration: 0.3
        })
        gsap.to(block.material, {
          emissiveIntensity: 0.4,
          duration: 0.3
        })
        
        // 向上移动
        gsap.to(block.position, {
          y: 0.6,
          duration: 0.3,
          ease: 'power2.out'
        })
        
        // 恢复正常透明度和可见性
        block.material.transparent = false
        block.material.opacity = 1
        block.visible = true
      } else if (isFree) {
        // 空闲块：变暗
        gsap.to(block.material.color, {
          r: 0.08,
          g: 0.08,
          b: 0.08,
          duration: 0.3,
          ease: 'power2.out'
        })
        
        if (block.material.emissive) {
          gsap.to(block.material.emissive, {
            r: 0,
            g: 0,
            b: 0,
            duration: 0.3
          })
          gsap.to(block.material, {
            emissiveIntensity: 0,
            duration: 0.3
          })
        }
        
        // 降低位置
        gsap.to(block.position, {
          y: 0,
          duration: 0.3
        })
        
        // 降低透明度
        block.material.transparent = true
        gsap.to(block.material, {
          opacity: 0.15,
          duration: 0.3
        })
        block.visible = true
      } else {
        // 其他目录的文件块：变暗
        const file = disk.usedBlocks && disk.usedBlocks[blockNum]
        const originalColor = file ? getFileColor(file.id) : 0xf56565
        
        // 将颜色变暗（降低亮度到20%）
        const r = ((originalColor >> 16) & 0xff) * 0.2 / 255
        const g = ((originalColor >> 8) & 0xff) * 0.2 / 255
        const b = (originalColor & 0xff) * 0.2 / 255
        
        gsap.to(block.material.color, {
          r,
          g,
          b,
          duration: 0.3,
          ease: 'power2.out'
        })
        
        if (block.material.emissive) {
          gsap.to(block.material.emissive, {
            r: 0,
            g: 0,
            b: 0,
            duration: 0.3
          })
          gsap.to(block.material, {
            emissiveIntensity: 0,
            duration: 0.3
          })
        }
        
        // 降低位置
        gsap.to(block.position, {
          y: 0,
          duration: 0.3
        })
        
        // 降低透明度
        block.material.transparent = true
        gsap.to(block.material, {
          opacity: 0.15,
          duration: 0.3
        })
        block.visible = true
      }
    })
  }
  
  /**
   * 显示所有磁盘块（恢复正常显示）
   * @param {Object} disk - 磁盘对象
   */
  showAllBlocks(disk) {
    if (!disk || !this.diskBlocks || this.diskBlocks.length === 0) return
    
    this.diskBlocks.forEach((block, blockNum) => {
      if (blockNum >= disk.totalBlocks || !block) return
      
      const targetColor = this.getBlockColor(disk, blockNum)
      const r = ((targetColor >> 16) & 0xff) / 255
      const g = ((targetColor >> 8) & 0xff) / 255
      const b = (targetColor & 0xff) / 255
      
      gsap.to(block.material.color, {
        r,
        g,
        b,
        duration: 0.3,
        ease: 'power2.out'
      })
      
      if (block.material.emissive) {
        gsap.to(block.material.emissive, {
          r: 0,
          g: 0,
          b: 0,
          duration: 0.3
        })
        gsap.to(block.material, {
          emissiveIntensity: 0,
          duration: 0.3
        })
      }
      
      gsap.to(block.position, {
        y: 0,
        duration: 0.3
      })
      
      block.material.transparent = false
      block.material.opacity = 1
      block.visible = true
    })
  }
  
  /**
   * 设置选中回调
   */
  setOnSelectCallback(callback) {
    this.onSelectCallback = callback
  }
  
  /**
   * 设置悬停回调
   */
  setOnHoverCallback(callback) {
    this.onHoverCallback = callback
  }
  
  /**
   * 设置连接线选择回调
   */
  setOnConnectionSelectCallback(callback) {
    this.onConnectionSelectCallback = callback
  }
  
  /**
   * 动画循环
   */
  animate() {
    requestAnimationFrame(() => this.animate())
    
    // 更新控制器（必须每帧调用，用于阻尼效果）
    if (this.controls) {
      this.controls.update()
    }
    
    // 更新文件结构树的文本标签朝向相机
    if (this.currentView === 'tree' && this.fileStructureNodes && this.camera) {
      this.fileStructureNodes.forEach(nodeData => {
        if (nodeData.textMesh) {
          nodeData.textMesh.lookAt(this.camera.position)
        }
      })
    }
    
    // 更新索引可视化的文本标签朝向相机（性能优化：每3帧更新一次）
    if (this.currentView === 'index' && this.indexLabels && this.camera) {
      if (!this.labelUpdateFrame) this.labelUpdateFrame = 0
      this.labelUpdateFrame++
      if (this.labelUpdateFrame % 3 === 0) { // 每3帧更新一次
        this.indexLabels.forEach(label => {
          if (label) {
            label.lookAt(this.camera.position)
          }
        })
      }
    }
    
    // 信息面板固定位置，不需要旋转（已移除lookAt逻辑）
    
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera)
    }
  }
  
  /**
   * 窗口大小变化处理
   */
  onWindowResize() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }
  
  /**
   * 鼠标移动处理
   */
  onMouseMove(event) {
    const rect = this.container.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    // 检测鼠标悬停的块
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const intersects = this.raycaster.intersectObjects(this.diskBlocks, false)
    
    if (intersects.length > 0) {
      const block = intersects[0].object
      if (this.hoveredBlock !== block) {
        // 取消之前的高亮
        if (this.hoveredBlock) {
          this.hoverBlock(this.hoveredBlock, false)
        }
        // 高亮当前块
        this.hoveredBlock = block
        this.hoverBlock(block, true)
        
        // 触发悬停回调，通知当前悬停的文件
        if (this.onHoverCallback && block.userData) {
          const file = this.disk?.usedBlocks?.[block.userData.blockNumber]
          if (file) {
            this.onHoverCallback(file)
          } else {
            this.onHoverCallback(null) // 悬停在空闲块上
          }
        }
      }
    } else {
      // 没有悬停在块上
      if (this.hoveredBlock) {
        this.hoverBlock(this.hoveredBlock, false)
        this.hoveredBlock = null
        // 清除悬停回调
        if (this.onHoverCallback) {
          this.onHoverCallback(null)
        }
      }
    }
  }

  /**
   * 鼠标离开处理
   */
  onMouseLeave() {
    if (this.hoveredBlock) {
      this.hoverBlock(this.hoveredBlock, false)
      this.hoveredBlock = null
      // 清除悬停回调
      if (this.onHoverCallback) {
        this.onHoverCallback(null)
      }
    }
  }

  /**
   * 高亮/取消高亮块
   * @param {THREE.Mesh} block - 磁盘块
   * @param {boolean} highlight - 是否高亮
   */
  hoverBlock(block, highlight) {
    if (!block) return
    
    // 检查块是否是被高亮（浮起）的块
    const isHighlightedBlock = this.highlightedBlocks.has(block)
    
    // 如果有活跃的高亮动画，不要被悬停效果干扰
    if (isHighlightedBlock && block.userData.highlightAnimations) {
      // 高亮块保持上浮状态，只调整发光效果
      if (highlight) {
        // 增强发光
        if (block.material.emissive) {
          gsap.to(block.material, {
            emissiveIntensity: 1.5,
            duration: 0.2
          })
        }
      } else {
        // 恢复到高亮发光强度
        if (block.material.emissive) {
          gsap.to(block.material, {
            emissiveIntensity: 1.2,
            duration: 0.2
          })
        }
      }
      return // 不修改位置和缩放
    }
    
    if (highlight) {
      // 高亮：放大并添加发光效果
      // 如果已经是高亮块，保持更大的缩放
      const targetScale = isHighlightedBlock ? 1.25 : 1.15
      gsap.to(block.scale, {
        x: targetScale,
        y: targetScale,
        z: targetScale,
        duration: 0.2,
        ease: 'power2.out'
      })
      
      if (!block.material.emissive) {
        block.material.emissive = new THREE.Color(0xffffff)
      }
      
      // 如果是高亮块，使用更强的发光；否则使用普通悬停发光
      const targetEmissiveIntensity = isHighlightedBlock ? 1.5 : 0.5
      gsap.to(block.material, {
        emissiveIntensity: targetEmissiveIntensity,
        duration: 0.2
      })
      
      // 显示详细信息提示（通过更新标签）
    } else {
      // 取消高亮：恢复原始大小和发光
      // 如果是高亮块，恢复到高亮状态；否则恢复到初始状态
      if (isHighlightedBlock) {
        // 恢复到高亮状态（浮起状态）
        gsap.to(block.scale, {
          x: 1.2,
          y: 1.2,
          z: 1.2,
          duration: 0.2,
          ease: 'power2.out'
        })
        
        if (block.material.emissive) {
          // 恢复到高亮发光强度
          gsap.to(block.material, {
            emissiveIntensity: 1.2,
            duration: 0.2
          })
        }
      } else {
        // 恢复到初始状态
        gsap.to(block.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration: 0.2,
          ease: 'power2.out'
        })
        
        if (block.material.emissive) {
          gsap.to(block.material, {
            emissiveIntensity: 0.1, // 恢复到初始的微弱发光
            duration: 0.2
          })
        }
      }
      
    }
  }
  
  /**
   * 鼠标点击处理
   */
  onMouseClick(event) {
    this.raycaster.setFromCamera(this.mouse, this.camera)
    const intersects = this.raycaster.intersectObjects(this.scene.children, true)
    
    if (intersects.length > 0) {
      const object = intersects[0].object
      const userData = object.userData
      
      if (userData.type === 'fileNode' && userData.fileId) {
        // 选中文件节点
        if (this.onSelectCallback) {
          this.onSelectCallback(userData.file)
        }
        this.highlightFileNode(userData.fileId)
      } else if (userData.type === 'treeNode' && userData.fileId) {
        // 选中树节点
        if (this.onSelectCallback && userData.fileId !== 'root') {
          this.onSelectCallback(userData.file)
        }
      } else if (userData.type === 'connectionLine') {
        // 选中连接线
        if (this.onConnectionSelectCallback) {
          this.onConnectionSelectCallback({
            parent: userData.parentNode,
            child: userData.childNode,
            parentId: userData.parentId,
            childId: userData.childId
          })
        }
        // 高亮连接线
        this.highlightConnectionLine(object)
      } else if (userData.type === 'diskBlock') {
        // 选中磁盘块
        const file = this.disk?.usedBlocks?.[userData.blockNumber]
        if (file && this.onSelectCallback) {
          this.onSelectCallback(file)
        }
      }
    }
  }
  
  /**
   * 创建文件结构树形可视化
   * @param {Array} files - 文件列表
   */
  createFileStructureTree(files) {
    // 清除旧的文件结构树
    if (this.fileStructureTree) {
      this.scene.remove(this.fileStructureTree)
    }
    this.fileStructureNodes.clear()
    this.fileStructureLines = []
    
    if (!files || files.length === 0) {
      return
    }
    
    // 创建文件结构树组
    this.fileStructureTree = new THREE.Group()
    this.fileStructureTree.name = 'FileStructureTree'
    // 根据当前视图设置可见性（默认隐藏，由showTreeView控制）
    this.fileStructureTree.visible = this.currentView === 'tree'
    this.scene.add(this.fileStructureTree)
    
    // 构建树形结构数据
    const fileMap = new Map()
    files.forEach(file => {
      fileMap.set(file.id, file)
    })
    
    // 找到根节点（parentId === 'root' 或不存在）
    const rootFiles = files.filter(f => !f.parentId || f.parentId === 'root')
    
    // 计算树的最大深度和宽度
    const treeInfo = this.calculateTreeLayout(files, rootFiles)
    
    // 创建根节点
    const rootNode = {
      id: 'root',
      name: '/',
      type: 'directory',
      children: rootFiles
    }
    
    // 递归创建节点
    const visited = new Set()
    this.createTreeNode(rootNode, fileMap, files, 0, treeInfo, new THREE.Vector3(0, 0, 0), visited)
    
    // 调整相机位置以适应树形结构
    this.adjustCameraForTree(treeInfo)
  }
  
  /**
   * 计算树形布局信息
   */
  calculateTreeLayout(files, rootFiles) {
    // 使用更安全的方式计算深度，避免循环引用
    const visited = new Set()
    const getDepth = (fileId, depth = 0, maxDepth = 20) => {
      // 防止无限递归
      if (depth > maxDepth || visited.has(fileId)) {
        return depth
      }
      visited.add(fileId)
      
      const children = files.filter(f => f.parentId === fileId)
      if (children.length === 0) {
        visited.delete(fileId)
        return depth
      }
      
      const childDepths = children.map(child => getDepth(child.id, depth + 1, maxDepth))
      visited.delete(fileId)
      return Math.max(...childDepths, depth)
    }
    
    // 计算最大深度
    let maxDepth = 1
    if (rootFiles.length > 0) {
      visited.clear()
      const depths = rootFiles.map(f => {
        visited.clear()
        return getDepth(f.id, 1, 20)
      })
      maxDepth = Math.max(...depths, 1)
    }
    
    // 计算每层的最大宽度
    const levelWidths = []
    for (let level = 0; level < maxDepth; level++) {
      const levelFiles = files.filter(f => {
        let currentLevel = 0
        let current = f
        const path = new Set()
        
        // 向上查找父节点，计算层级
        while (current && current.parentId && current.parentId !== 'root' && currentLevel < 20) {
          if (path.has(current.id)) {
            break // 检测到循环
          }
          path.add(current.id)
          currentLevel++
          current = files.find(p => p.id === current.parentId)
          if (!current) break
        }
        
        return currentLevel === level
      })
      levelWidths.push(levelFiles.length)
    }
    
    const maxWidth = Math.max(...levelWidths, 1)
    
    return {
      maxDepth,
      maxWidth,
      levelHeight: 4, // 每层高度
      nodeSpacing: 3 // 节点间距
    }
  }
  
  /**
   * 创建文件夹几何体（文件夹图标形状）
   */
  createFolderGeometry() {
    const folderGroup = new THREE.Group()
    
    // 文件夹主体（矩形）
    const bodyGeometry = new THREE.BoxGeometry(0.8, 0.6, 0.1)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.3,
      roughness: 0.4
    })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.set(0, 0, 0)
    folderGroup.add(body)
    
    // 文件夹标签（小矩形，在顶部）
    const tabGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.1)
    const tabMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      metalness: 0.3,
      roughness: 0.4
    })
    const tab = new THREE.Mesh(tabGeometry, tabMaterial)
    tab.position.set(-0.15, 0.3, 0)
    folderGroup.add(tab)
    
    return folderGroup
  }
  
  /**
   * 创建文件几何体（文档图标形状）
   */
  createFileGeometry() {
    const fileGroup = new THREE.Group()
    
    // 文件主体（矩形，稍微倾斜）
    const bodyGeometry = new THREE.BoxGeometry(0.5, 0.7, 0.05)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.2,
      roughness: 0.6
    })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.rotation.z = -0.1
    body.position.set(0, 0, 0)
    fileGroup.add(body)
    
    // 文件折角（小三角形，右上角）
    const cornerShape = new THREE.Shape()
    cornerShape.moveTo(0, 0)
    cornerShape.lineTo(0.15, 0)
    cornerShape.lineTo(0, 0.15)
    cornerShape.lineTo(0, 0)
    const cornerGeometry = new THREE.ShapeGeometry(cornerShape)
    const cornerMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      side: THREE.DoubleSide
    })
    const corner = new THREE.Mesh(cornerGeometry, cornerMaterial)
    corner.position.set(0.2, 0.3, 0.03)
    corner.rotation.z = Math.PI / 4
    fileGroup.add(corner)
    
    return fileGroup
  }
  
  /**
   * 创建树节点
   */
  createTreeNode(node, fileMap, allFiles, level, treeInfo, position, visited = new Set()) {
    // 防止循环引用
    if (visited.has(node.id)) {
      console.warn('检测到循环引用，跳过节点:', node.id)
      return
    }
    visited.add(node.id)
    
    // 限制最大深度
    if (level > 10) {
      console.warn('达到最大深度，停止创建节点')
      visited.delete(node.id)
      return
    }
    
    const children = node.children || []
    const childCount = children.length
    
    // 创建节点几何体（目录用文件夹形状，文件用文档形状）
    let mesh
    if (node.type === 'directory' || node.id === 'root') {
      // 文件夹：使用文件夹图标
      const folderGroup = this.createFolderGeometry()
      folderGroup.position.copy(position)
      mesh = folderGroup
      
      // 为文件夹添加统一的材质颜色
      const nodeColor = node.id === 'root' ? 0x4a90e2 : getFileColor(node.id)
      folderGroup.children.forEach(child => {
        if (child.material) {
          child.material.color.setHex(nodeColor)
          child.material.emissive = new THREE.Color(nodeColor)
          child.material.emissiveIntensity = 0.2
        }
      })
    } else {
      // 文件：使用文档图标
      const fileGroup = this.createFileGeometry()
      fileGroup.position.copy(position)
      mesh = fileGroup
      
      // 为文件添加颜色（使用文件对应的颜色）
      const nodeColor = getFileColor(node.id)
      fileGroup.children.forEach(child => {
        if (child.material && child.material.color) {
          // 文件主体使用文件颜色，但保持较亮的白色
          if (child.material.color.getHex() === 0xffffff) {
            const r = ((nodeColor >> 16) & 0xff) / 255
            const g = ((nodeColor >> 8) & 0xff) / 255
            const b = (nodeColor & 0xff) / 255
            child.material.color.setRGB(Math.min(1, r + 0.3), Math.min(1, g + 0.3), Math.min(1, b + 0.3))
          }
          child.material.emissive = new THREE.Color(nodeColor)
          child.material.emissiveIntensity = 0.15
        }
      })
    }
    
    mesh.userData = { 
      fileId: node.id, 
      file: node,
      type: 'treeNode',
      level
    }
    
    this.fileStructureTree.add(mesh)
    this.fileStructureNodes.set(node.id, { mesh, node, position: position.clone() })
    
    // 创建文本标签
    if (node.name) {
      const textTexture = this.createTextTexture(
        node.name,
        28,
        '#ffffff',
        'rgba(0, 0, 0, 0.8)'
      )
      const textMaterial = new THREE.MeshBasicMaterial({
        map: textTexture,
        transparent: true,
        side: THREE.DoubleSide
      })
      const textGeometry = new THREE.PlaneGeometry(2.5, 0.6)
      const textMesh = new THREE.Mesh(textGeometry, textMaterial)
      textMesh.position.set(position.x, position.y + 1.2, position.z)
      if (this.camera) {
        textMesh.lookAt(this.camera.position)
      }
      this.fileStructureTree.add(textMesh)
      
      // 存储文本网格以便更新
      const nodeData = this.fileStructureNodes.get(node.id)
      if (nodeData) {
        nodeData.textMesh = textMesh
      }
    }
    
    // 如果有子节点，创建子节点
    if (childCount > 0) {
      // 计算子节点位置（水平排列）
      const totalWidth = (childCount - 1) * treeInfo.nodeSpacing
      const startX = position.x - totalWidth / 2
      const childY = position.y - treeInfo.levelHeight
      
      children.forEach((child, index) => {
        const childFile = fileMap.get(child.id)
        if (!childFile) return
        
        const childX = startX + index * treeInfo.nodeSpacing
        const childPosition = new THREE.Vector3(childX, childY, position.z)
        
        // 创建连接线（从父节点底部到子节点顶部）
        const lineStart = new THREE.Vector3(position.x, position.y - 0.5, position.z)
        const lineEnd = new THREE.Vector3(childPosition.x, childPosition.y + 0.5, childPosition.z)
        
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          lineStart,
          lineEnd
        ])
        const lineMaterial = new THREE.LineBasicMaterial({
          color: 0x718096,
          opacity: 0.5,
          transparent: true,
          linewidth: 2
        })
        const line = new THREE.Line(lineGeometry, lineMaterial)
        // 为连接线添加用户数据，包含父子节点信息
        line.userData = {
          type: 'connectionLine',
          parentNode: node,
          childNode: childFile,
          parentId: node.id,
          childId: childFile.id
        }
        this.fileStructureTree.add(line)
        this.fileStructureLines.push(line)
        
        // 递归创建子节点
        const childChildren = allFiles.filter(f => f && f.parentId === childFile.id)
        this.createTreeNode(
          { ...childFile, children: childChildren },
          fileMap,
          allFiles,
          level + 1,
          treeInfo,
          childPosition,
          visited
        )
      })
    }
  }
  
  /**
   * 调整相机位置以适应树形结构
   */
  adjustCameraForTree(treeInfo) {
    if (!treeInfo) return
    
    // 计算树的中心点和范围
    const centerY = -treeInfo.maxDepth * treeInfo.levelHeight / 2
    const distance = Math.max(treeInfo.maxWidth * treeInfo.nodeSpacing, treeInfo.maxDepth * treeInfo.levelHeight) * 1.5
    
    // 设置相机位置（从上方斜视）
    this.camera.position.set(0, distance * 0.6, distance)
    this.camera.lookAt(0, centerY, 0)
    
    // 更新控制器目标
    if (this.controls) {
      this.controls.target.set(0, centerY, 0)
      this.controls.update()
    }
  }
  
  /**
   * 显示磁盘视图
   */
  showDiskView() {
    this.currentView = 'disk'
    
    // 显示磁盘块
    this.diskBlocks.forEach(block => {
      if (block) {
        block.visible = true
      }
    })
    
    // 隐藏文件结构树（确保完全隐藏）
    if (this.fileStructureTree) {
      this.fileStructureTree.visible = false
      // 同时隐藏所有连接线
      this.fileStructureLines.forEach(line => {
        if (line) {
          line.visible = false
        }
      })
    }
    
    // 显示网格
    if (this.gridHelper) {
      this.gridHelper.visible = true
    }
    
    // 调整相机到磁盘视图
    if (this.disk && this.disk.totalBlocks > 0) {
      this.adjustCameraForDisk(this.disk)
    }
  }
  
  /**
   * 显示文件结构树视图
   */
  showTreeView() {
    this.currentView = 'tree'
    
    // 隐藏磁盘块
    this.diskBlocks.forEach(block => {
      if (block) {
        block.visible = false
      }
    })
    
    // 隐藏网格
    if (this.gridHelper) {
      this.gridHelper.visible = false
    }
    
    // 显示文件结构树
    if (this.fileStructureTree) {
      this.fileStructureTree.visible = true
      // 同时显示所有连接线
      this.fileStructureLines.forEach(line => {
        if (line) {
          line.visible = true
        }
      })
      
      // 更新文本标签朝向相机
      this.fileStructureNodes.forEach(nodeData => {
        if (nodeData.textMesh && this.camera) {
          nodeData.textMesh.lookAt(this.camera.position)
        }
      })
    } else {
      // 如果树不存在，重新创建
      if (this.disk && this.disk.files && this.disk.files.length > 0) {
        console.log('创建文件结构树，文件数量:', this.disk.files.length)
        this.createFileStructureTree(this.disk.files)
      } else {
        console.warn('无法创建文件结构树：没有文件数据', this.disk)
      }
    }
    
    // 重新调整相机位置
    if (this.fileStructureTree && this.fileStructureTree.visible) {
      const files = this.disk?.files || []
      if (files.length > 0) {
        const rootFiles = files.filter(f => !f.parentId || f.parentId === 'root')
        const treeInfo = this.calculateTreeLayout(files, rootFiles)
        this.adjustCameraForTree(treeInfo)
      }
    }
  }
  
  /**
   * 显示索引可视化视图
   */
  showIndexVisualization() {
    this.currentView = 'index'
    if (this.indexVisualizationGroup) {
      this.indexVisualizationGroup.visible = true
    }
    if (this.gridHelper) {
      this.gridHelper.visible = false
    }
  }
  
  /**
   * 隐藏索引可视化视图
   */
  hideIndexVisualization() {
    if (this.indexVisualizationGroup) {
      this.indexVisualizationGroup.visible = false
    }
  }
  
  /**
   * 隐藏磁盘视图
   */
  hideDiskView() {
    this.diskBlocks.forEach(block => {
      if (block) {
        block.visible = false
      }
    })
  }
  
  /**
   * 可视化文件的索引分配情况
   * @param {Object} file - 文件对象
   */
  visualizeFileIndex(file) {
    if (!file || file.type !== 'file' || !file.blocks || file.blocks.length === 0) {
      return
    }
    
    // 清除之前的可视化
    this.clearIndexVisualization()
    
    // 创建索引可视化组
    this.indexVisualizationGroup = new THREE.Group()
    this.indexVisualizationGroup.visible = true
    this.scene.add(this.indexVisualizationGroup)
    
    const algorithm = file.allocationAlgorithm || 'continuous'
    const blocks = file.blocks
    const blockSize = 0.8 // 块的大小
    const spacing = 1.0 // 块之间的间距
    const blocksPerRow = 20 // 每行块数
    
    // 确保disk信息可用（从fileSystemStore获取）
    if (!this.disk && file.disk) {
      this.disk = file.disk
    }
    
    // 根据分配算法进行不同的可视化
    if (algorithm === 'continuous') {
      this.visualizeContinuousAllocation(file, blocks, blockSize, spacing, blocksPerRow)
    } else if (algorithm === 'linked') {
      this.visualizeLinkedAllocation(file, blocks, blockSize, spacing, blocksPerRow)
    } else if (algorithm === 'indexed') {
      this.visualizeIndexedAllocation(file, blocks, blockSize, spacing, blocksPerRow)
    }
    
    // 调整相机位置（先调整相机，确保面板位置正确）
    this.adjustCameraForIndex(blocks.length, blocksPerRow)
    
    // 创建信息面板（在相机调整后创建，确保面板位置和朝向正确）
    this.createIndexInfoPanel(file)
  }
  
  /**
   * 可视化连续分配（直接块 -> 磁盘块）
   */
  visualizeContinuousAllocation(file, blocks, blockSize, spacing, blocksPerRow) {
    const directBlockColor = 0x4285f4 // 蓝色 - 直接块
    const diskBlockColor = 0x34a853 // 绿色 - 磁盘块
    const lineColor = 0xffffff // 白色连接线
    
    // 左侧：直接块区域，右侧：磁盘块区域
    const leftX = -6 // 直接块位置
    const rightX = 3 // 磁盘块位置
    const verticalSpacing = 1.2
    
    // 限制显示的块数量，避免过多（性能优化）
    const maxDisplayBlocks = Math.min(blocks.length, 8)
    const displayBlocks = blocks.slice(0, maxDisplayBlocks)
    
    // 性能优化：共享几何体和材质
    const directGeometry = new THREE.BoxGeometry(blockSize * 1.2, blockSize * 1.2, blockSize * 1.2)
    const directMaterial = new THREE.MeshLambertMaterial({ 
      color: directBlockColor,
      emissive: directBlockColor,
      emissiveIntensity: 0.3
    })
    const diskGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize)
    const diskMaterial = new THREE.MeshLambertMaterial({ 
      color: diskBlockColor,
      emissive: diskBlockColor,
      emissiveIntensity: 0.2
    })
    
    displayBlocks.forEach((blockNum, index) => {
      const y = (maxDisplayBlocks / 2 - index - 0.5) * verticalSpacing
      
      // 左侧：创建直接块（使用共享几何体和材质）
      const directMesh = new THREE.Mesh(directGeometry, directMaterial)
      directMesh.position.set(leftX, y, 0)
      directMesh.userData = { type: 'directBlock', blockNum, fileId: file.id }
      this.indexVisualizationGroup.add(directMesh)
      this.indexBlocks.push(directMesh)
      
      // 直接块标签（显示逻辑块号）
      // blocks数组中的值（blockNum）是逻辑块号
      const directLabel = this.createTextLabel(`直接块\n逻辑#${blockNum}`, 0.4, '#ffffff')
      directLabel.position.set(leftX, y, blockSize * 0.6 + 0.25)
      this.indexVisualizationGroup.add(directLabel)
      this.indexLabels.push(directLabel)
      
      // 右侧：创建磁盘块（使用共享几何体和材质）
      const diskMesh = new THREE.Mesh(diskGeometry, diskMaterial)
      diskMesh.position.set(rightX, y, 0)
      diskMesh.userData = { type: 'diskBlock', blockNum, fileId: file.id }
      this.indexVisualizationGroup.add(diskMesh)
      this.indexBlocks.push(diskMesh)
      
      // 磁盘块标签（显示物理块号）
      // 在连续分配中，逻辑块号和物理块号可能不同
      // 需要通过extent映射来查找物理块号
      let physicalInfo = `块#${blockNum}`
      if (file.extents && file.extents.length > 0 && this.disk?.blockSize) {
        const blockSizeBytes = this.disk.blockSize
        // 计算此逻辑块在文件中的字节偏移
        const logicalByteOffset = index * blockSizeBytes
        // 查找包含此逻辑偏移的extent
        const extent = file.extents.find(e => {
          return logicalByteOffset >= e.logicalOffset && 
                 logicalByteOffset < e.logicalOffset + e.length
        })
        if (extent) {
          // 计算物理块号
          // 物理偏移 = extent的物理偏移 + (逻辑块在extent中的偏移)
          const offsetInExtent = logicalByteOffset - extent.logicalOffset
          const physicalByteOffset = extent.physicalOffset + offsetInExtent
          const physicalBlock = Math.floor(physicalByteOffset / blockSizeBytes)
          physicalInfo = `块#${blockNum}\n物:${physicalBlock}`
        }
      }
      const diskLabel = this.createTextLabel(physicalInfo, 0.4, '#ffffff')
      diskLabel.position.set(rightX, y, blockSize / 2 + 0.3)
      this.indexVisualizationGroup.add(diskLabel)
      this.indexLabels.push(diskLabel)
      
      // 连接线：直接块 -> 磁盘块
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(leftX + blockSize * 0.6, y, 0),
        new THREE.Vector3(rightX - blockSize / 2, y, 0)
      ])
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: lineColor, 
        linewidth: 3,
        opacity: 0.8,
        transparent: true
      })
      const line = new THREE.Line(lineGeometry, lineMaterial)
      this.indexVisualizationGroup.add(line)
      this.indexLines.push(line)
      
      // 添加箭头
      const arrowX = (leftX + rightX) / 2
      const arrowGeometry = new THREE.ConeGeometry(0.1, 0.3, 8)
      const arrowMaterial = new THREE.MeshBasicMaterial({ color: lineColor })
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial)
      arrow.position.set(arrowX, y, 0)
      arrow.rotation.z = -Math.PI / 2
      this.indexVisualizationGroup.add(arrow)
      this.indexLines.push(arrow)
    })
    
    // 如果块数超过显示数量，添加省略号提示
    if (blocks.length > maxDisplayBlocks) {
      const ellipsisLabel = this.createTextLabel('...', 0.4, '#ffffff')
      ellipsisLabel.position.set(0, -maxDisplayBlocks / 2 * verticalSpacing - 1, 0)
      this.indexVisualizationGroup.add(ellipsisLabel)
      this.indexLabels.push(ellipsisLabel)
    }
    
    // 添加标题标签（增大尺寸）
    const title = this.createTextLabel(
      `连续分配（直接块）：共 ${blocks.length} 个块`,
      0.7,
      '#ffffff'
    )
    title.position.set(0, maxDisplayBlocks / 2 * verticalSpacing + 2, 0)
    this.indexVisualizationGroup.add(title)
    this.indexLabels.push(title)
  }
  
  /**
   * 可视化链式分配（每个块包含指向下一个块的指针）
   */
  visualizeLinkedAllocation(file, blocks, blockSize, spacing, blocksPerRow) {
    const blockColor = 0x4285f4 // 蓝色 - 数据块
    const pointerColor = 0xff6b6b // 红色 - 指针
    const lineColor = 0x34a853 // 绿色 - 连接线
    
    // 限制显示的块数量（性能优化）
    const maxDisplayBlocks = Math.min(blocks.length, 6)
    const displayBlocks = blocks.slice(0, maxDisplayBlocks)
    const verticalSpacing = 1.5
    const blockX = 0 // 块的水平位置
    
    // 性能优化：共享几何体和材质
    const blockGeometry = new THREE.BoxGeometry(blockSize * 1.5, blockSize * 1.2, blockSize * 1.2)
    const blockMaterial = new THREE.MeshLambertMaterial({ 
      color: blockColor,
      emissive: blockColor,
      emissiveIntensity: 0.2
    })
    const pointerGeometry = new THREE.SphereGeometry(0.2, 8, 8)
    // 使用MeshLambertMaterial支持emissive属性
    const pointerMaterial = new THREE.MeshLambertMaterial({ 
      color: pointerColor,
      emissive: pointerColor,
      emissiveIntensity: 0.6
    })
    
    const blockMeshes = []
    
    displayBlocks.forEach((blockNum, index) => {
      const y = (maxDisplayBlocks / 2 - index - 0.5) * verticalSpacing
      
      // 创建数据块（使用共享几何体和材质）
      const blockMesh = new THREE.Mesh(blockGeometry, blockMaterial)
      blockMesh.position.set(blockX, y, 0)
      blockMesh.userData = { type: 'linkedBlock', blockNum, fileId: file.id }
      this.indexVisualizationGroup.add(blockMesh)
      this.indexBlocks.push(blockMesh)
      blockMeshes.push({ mesh: blockMesh, x: blockX, y, blockNum })
      
      // 块编号标签（显示物理块号）
      // 在链式分配中，blocks数组存储的是物理块号（磁盘上的实际位置）
      // index是逻辑块号（文件内的顺序，从0开始），blockNum是物理块号
      let physicalBlock = blockNum // blocks数组中的值就是物理块号
      
      // 如果extents存在，从extent验证物理块号（确保一致性）
      if (file.extents && file.extents.length > 0 && this.disk?.blockSize) {
        const blockSizeBytes = this.disk.blockSize
        // 计算此逻辑块在文件中的字节偏移
        const logicalByteOffset = index * blockSizeBytes
        // 查找包含此逻辑偏移的extent
        const extent = file.extents.find(e => {
          return logicalByteOffset >= e.logicalOffset && 
                 logicalByteOffset < e.logicalOffset + e.length
        })
        if (extent) {
          // 从extent计算物理块号（验证blocks数组的值）
          const offsetInExtent = logicalByteOffset - extent.logicalOffset
          const physicalByteOffset = extent.physicalOffset + offsetInExtent
          const calculatedPhysicalBlock = Math.floor(physicalByteOffset / blockSizeBytes)
          // 使用从extent计算的物理块号（更准确，因为extent是真实的物理映射）
          physicalBlock = calculatedPhysicalBlock
        }
      }
      
      // 显示格式：块#物理块号 物:物理块号
      // 图片中显示"块#20 物:20"，表示这是物理块20
      const blockInfo = `块#${physicalBlock}\n物:${physicalBlock}`
      const blockLabel = this.createTextLabel(blockInfo, 0.4, '#ffffff')
      blockLabel.position.set(blockX, y, blockSize * 0.6 + 0.25)
      this.indexVisualizationGroup.add(blockLabel)
      this.indexLabels.push(blockLabel)
      
      // 在块内部添加指针指示（显示指向下一个块，使用共享几何体和材质）
      if (index < displayBlocks.length - 1) {
        const pointer = new THREE.Mesh(pointerGeometry, pointerMaterial)
        pointer.position.set(blockX + blockSize * 0.5, y, 0)
        this.indexVisualizationGroup.add(pointer)
        this.indexLines.push(pointer)
        
        // 指针标签（增大尺寸）
        const pointerLabel = this.createTextLabel('→', 0.4, pointerColor)
        pointerLabel.position.set(blockX + blockSize * 0.7, y, blockSize * 0.6 + 0.25)
        this.indexVisualizationGroup.add(pointerLabel)
        this.indexLabels.push(pointerLabel)
      } else {
        // 最后一个块显示NULL（增大尺寸）
        const nullLabel = this.createTextLabel('NULL', 0.4, '#ff0000')
        nullLabel.position.set(blockX + blockSize * 0.5, y, blockSize * 0.6 + 0.2)
        this.indexVisualizationGroup.add(nullLabel)
        this.indexLabels.push(nullLabel)
      }
      
      // 连接线：当前块 -> 下一个块
      if (index < displayBlocks.length - 1) {
        const nextY = (maxDisplayBlocks / 2 - index - 1.5) * verticalSpacing
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(blockX, y - blockSize * 0.6, 0),
          new THREE.Vector3(blockX, nextY + blockSize * 0.6, 0)
        ])
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color: lineColor, 
          linewidth: 4,
          opacity: 0.8,
          transparent: true
        })
        const line = new THREE.Line(lineGeometry, lineMaterial)
        this.indexVisualizationGroup.add(line)
        this.indexLines.push(line)
        
        // 添加箭头
        const arrowY = (y + nextY) / 2
        const arrowGeometry = new THREE.ConeGeometry(0.12, 0.3, 8)
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: lineColor })
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial)
        arrow.position.set(blockX, arrowY, 0)
        arrow.rotation.x = Math.PI / 2
        this.indexVisualizationGroup.add(arrow)
        this.indexLines.push(arrow)
      }
    })
    
    // 如果块数超过显示数量，添加省略号
    if (blocks.length > maxDisplayBlocks) {
      const ellipsisLabel = this.createTextLabel('...', 0.4, '#ffffff')
      ellipsisLabel.position.set(blockX, -maxDisplayBlocks / 2 * verticalSpacing - 1, 0)
      this.indexVisualizationGroup.add(ellipsisLabel)
      this.indexLabels.push(ellipsisLabel)
    }
    
    // 添加标题标签（增大尺寸）
    const title = this.createTextLabel(
      `链式分配：每个块包含指向下一个块的指针`,
      0.7,
      '#ffffff'
    )
    title.position.set(0, maxDisplayBlocks / 2 * verticalSpacing + 2, 0)
    this.indexVisualizationGroup.add(title)
    this.indexLabels.push(title)
  }
  
  /**
   * 可视化索引分配（一级索引 -> 直接块 -> 磁盘块）
   */
  visualizeIndexedAllocation(file, blocks, blockSize, spacing, blocksPerRow) {
    const indexColor = 0xfbbc05 // 黄色 - 一级索引块
    const directBlockColor = 0x4285f4 // 蓝色 - 直接块
    const diskBlockColor = 0x34a853 // 绿色 - 磁盘块
    const lineColor = 0xffffff // 白色连接线
    
    // 索引分配中：blocks[0]是索引块，blocks[1..n]是数据块
    if (blocks.length === 0) {
      return
    }
    
    const indexBlockNum = blocks[0] // 第一个块是索引块
    const dataBlocks = blocks.slice(1) // 其余块是数据块
    
    // 限制显示的数据块数量（性能优化）
    const maxDisplayBlocks = Math.min(dataBlocks.length, 6)
    const displayDataBlocks = dataBlocks.slice(0, maxDisplayBlocks)
    
    // 左侧：一级索引块
    const indexBlockX = -6
    const indexBlockY = 0
    const indexBlockSize = blockSize * 1.5
    
    // 性能优化：共享几何体和材质
    const indexGeometry = new THREE.BoxGeometry(indexBlockSize, indexBlockSize, indexBlockSize)
    const indexMaterial = new THREE.MeshLambertMaterial({ 
      color: indexColor,
      emissive: indexColor,
      emissiveIntensity: 0.5
    })
    const directGeometry = new THREE.BoxGeometry(blockSize * 1.2, blockSize * 1.2, blockSize * 1.2)
    const directMaterial = new THREE.MeshLambertMaterial({ 
      color: directBlockColor,
      emissive: directBlockColor,
      emissiveIntensity: 0.3
    })
    const diskGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize)
    const diskMaterial = new THREE.MeshLambertMaterial({ 
      color: diskBlockColor,
      emissive: diskBlockColor,
      emissiveIntensity: 0.2
    })
    
    // 创建一级索引块（blocks[0]）
    const indexMesh = new THREE.Mesh(indexGeometry, indexMaterial)
    indexMesh.position.set(indexBlockX, indexBlockY, 0)
    indexMesh.userData = { type: 'indexBlock', isIndexBlock: true, blockNum: indexBlockNum, fileId: file.id }
    this.indexVisualizationGroup.add(indexMesh)
    this.indexBlocks.push(indexMesh)
    
    // 一级索引块标签（显示块号）
    const indexLabel = this.createTextLabel(`一级索引\n块#${indexBlockNum}`, 0.5, '#000000')
    indexLabel.position.set(indexBlockX, indexBlockY, indexBlockSize / 2 + 0.4)
    this.indexVisualizationGroup.add(indexLabel)
    this.indexLabels.push(indexLabel)
    
    // 中间：直接块，右侧：磁盘块
    const directBlockX = -1.5
    const diskBlockX = 3
    const verticalSpacing = 1.2
    
    // 遍历数据块（blocks[1..n]），每个数据块对应一个直接块和一个磁盘块
    displayDataBlocks.forEach((blockNum, index) => {
      const y = (maxDisplayBlocks / 2 - index - 0.5) * verticalSpacing
      
      // 中间：创建直接块（使用共享几何体和材质）
      const directMesh = new THREE.Mesh(directGeometry, directMaterial)
      directMesh.position.set(directBlockX, y, 0)
      directMesh.userData = { type: 'directBlock', blockNum, fileId: file.id }
      this.indexVisualizationGroup.add(directMesh)
      this.indexBlocks.push(directMesh)
      
      // 直接块标签（显示逻辑块号，数据块的逻辑索引是index+1）
      const directLabel = this.createTextLabel(`直接块\n逻辑#${index + 1}`, 0.4, '#ffffff')
      directLabel.position.set(directBlockX, y, blockSize * 0.6 + 0.25)
      this.indexVisualizationGroup.add(directLabel)
      this.indexLabels.push(directLabel)
      
      // 右侧：创建磁盘块（使用共享几何体和材质）
      const diskMesh = new THREE.Mesh(diskGeometry, diskMaterial)
      diskMesh.position.set(diskBlockX, y, 0)
      diskMesh.userData = { type: 'diskBlock', blockNum, fileId: file.id }
      this.indexVisualizationGroup.add(diskMesh)
      this.indexBlocks.push(diskMesh)
      
      // 磁盘块标签（显示块号和物理地址）
      // 注意：index是数据块在displayDataBlocks中的索引（从0开始）
      // blocks[0]是索引块，blocks[1..n]是数据块
      // 所以数据块在文件中的逻辑字节偏移 = (index + 1) * blockSize（跳过索引块）
      let diskInfo = `块#${blockNum}`
      if (file.extents && file.extents.length > 0 && this.disk?.blockSize) {
        const blockSizeBytes = this.disk.blockSize
        // 计算此数据块在文件中的字节偏移（跳过索引块，索引块不占用文件数据空间）
        // 索引块只存储指针，不存储文件数据，所以数据块的逻辑偏移从0开始
        const logicalByteOffset = index * blockSizeBytes
        // 查找包含此逻辑偏移的extent
        const extent = file.extents.find(e => {
          return logicalByteOffset >= e.logicalOffset && 
                 logicalByteOffset < e.logicalOffset + e.length
        })
        if (extent) {
          // 计算物理块号
          const offsetInExtent = logicalByteOffset - extent.logicalOffset
          const physicalByteOffset = extent.physicalOffset + offsetInExtent
          const physicalBlock = Math.floor(physicalByteOffset / blockSizeBytes)
          diskInfo = `块#${blockNum}\n物:${physicalBlock}`
        }
      }
      const diskLabel = this.createTextLabel(diskInfo, 0.4, '#ffffff')
      diskLabel.position.set(diskBlockX, y, blockSize / 2 + 0.2)
      this.indexVisualizationGroup.add(diskLabel)
      this.indexLabels.push(diskLabel)
      
      // 连接线1：一级索引 -> 直接块（弧线）
      const startPos1 = new THREE.Vector3(indexBlockX + indexBlockSize / 2, indexBlockY, 0)
      const endPos1 = new THREE.Vector3(directBlockX - blockSize * 0.6, y, 0)
      // 计算弧线的中间点（向上弯曲）
      const midPoint1 = new THREE.Vector3(
        (startPos1.x + endPos1.x) / 2, 
        Math.max(startPos1.y, endPos1.y) + 1.5, // 向上弯曲
        0
      )
      
      // 创建弧线（使用二次贝塞尔曲线）
      const arcPoints = []
      const steps = 15 // 增加步数以获得更平滑的弧线
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        // 二次贝塞尔曲线公式：B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
        const arcX = (1 - t) * (1 - t) * startPos1.x + 2 * (1 - t) * t * midPoint1.x + t * t * endPos1.x
        const arcY = (1 - t) * (1 - t) * startPos1.y + 2 * (1 - t) * t * midPoint1.y + t * t * endPos1.y
        arcPoints.push(new THREE.Vector3(arcX, arcY, 0))
      }
      
      // 在弧线中点添加箭头
      const arcMidIndex = Math.floor(steps / 2)
      const arcMidPoint = arcPoints[arcMidIndex]
      const arcNextPoint = arcPoints[arcMidIndex + 1]
      const arcDirection = new THREE.Vector3(arcNextPoint.x - arcMidPoint.x, arcNextPoint.y - arcMidPoint.y, 0).normalize()
      const arcArrowGeometry = new THREE.ConeGeometry(0.1, 0.3, 8)
      const arcArrowMaterial = new THREE.MeshBasicMaterial({ color: lineColor })
      const arcArrow = new THREE.Mesh(arcArrowGeometry, arcArrowMaterial)
      arcArrow.position.copy(arcMidPoint)
      // 计算箭头朝向
      const arcTargetPoint = arcMidPoint.clone().add(arcDirection)
      arcArrow.lookAt(arcTargetPoint)
      arcArrow.rotateX(Math.PI / 2)
      this.indexVisualizationGroup.add(arcArrow)
      this.indexLines.push(arcArrow)
      
      const arcGeometry = new THREE.BufferGeometry().setFromPoints(arcPoints)
      const arcMaterial = new THREE.LineBasicMaterial({ 
        color: lineColor, 
        linewidth: 3,
        opacity: 0.8,
        transparent: true
      })
      const arcLine = new THREE.Line(arcGeometry, arcMaterial)
      this.indexVisualizationGroup.add(arcLine)
      this.indexLines.push(arcLine)
      
      // 连接线2：直接块 -> 磁盘块（直线）
      const lineGeometry2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(directBlockX + blockSize * 0.6, y, 0),
        new THREE.Vector3(diskBlockX - blockSize / 2, y, 0)
      ])
      const lineMaterial2 = new THREE.LineBasicMaterial({ 
        color: lineColor, 
        linewidth: 3,
        opacity: 0.8,
        transparent: true
      })
      const line2 = new THREE.Line(lineGeometry2, lineMaterial2)
      this.indexVisualizationGroup.add(line2)
      this.indexLines.push(line2)
      
      // 添加箭头
      const arrowX = (directBlockX + diskBlockX) / 2
      const arrowGeometry = new THREE.ConeGeometry(0.1, 0.3, 8)
      const arrowMaterial = new THREE.MeshBasicMaterial({ color: lineColor })
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial)
      arrow.position.set(arrowX, y, 0)
      arrow.rotation.z = -Math.PI / 2
      this.indexVisualizationGroup.add(arrow)
      this.indexLines.push(arrow)
    })
    
    // 如果数据块数超过显示数量，添加省略号
    if (dataBlocks.length > maxDisplayBlocks) {
      const ellipsisLabel = this.createTextLabel('...', 0.4, '#ffffff')
      ellipsisLabel.position.set(0, -maxDisplayBlocks / 2 * verticalSpacing - 1, 0)
      this.indexVisualizationGroup.add(ellipsisLabel)
      this.indexLabels.push(ellipsisLabel)
    }
    
    // 添加标题标签（增大尺寸）
    // 总块数 = 1个索引块 + N个数据块
    const title = this.createTextLabel(
      `索引分配（一级索引）：索引块#${indexBlockNum}，指向 ${dataBlocks.length} 个数据块`,
      0.7,
      '#ffffff'
    )
    title.position.set(0, maxDisplayBlocks / 2 * verticalSpacing + 2, 0)
    this.indexVisualizationGroup.add(title)
    this.indexLabels.push(title)
  }
  
  /**
   * 创建文本标签（优化版：更清晰的文字显示 + 性能优化）
   */
  createTextLabel(text, size, color) {
    // 性能优化：使用缓存避免重复创建相同文字的标签
    const cacheKey = `${text}_${size}_${color}`
    if (!this.textLabelCache) {
      this.textLabelCache = new Map()
    }
    if (this.textLabelCache.has(cacheKey)) {
      // 返回缓存的mesh的克隆
      const cachedMesh = this.textLabelCache.get(cacheKey)
      return cachedMesh.clone()
    }
    
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    
    // 根据文字长度和大小动态调整canvas尺寸
    const fontSize = Math.max(size * 32, 24) // 最小24px，确保清晰
    const padding = 20
    const lineHeight = fontSize * 1.2
    
    // 处理多行文本
    const lines = text.split('\n')
    const maxLines = Math.min(lines.length, 3) // 最多3行，避免过高
    
    // 设置字体（使用更清晰的字体）
    context.font = `bold ${fontSize}px "Microsoft YaHei", "SimHei", Arial, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    
    // 测量文字宽度（取最宽的行）
    let maxTextWidth = 0
    lines.forEach(line => {
      const textMetrics = context.measureText(line)
      maxTextWidth = Math.max(maxTextWidth, textMetrics.width)
    })
    
    // 设置canvas尺寸（根据文字宽度动态调整）
    canvas.width = Math.max(maxTextWidth + padding * 2, 128)
    canvas.height = (lineHeight * maxLines) + padding * 2
    
    // 启用文字平滑
    context.textBaseline = 'middle'
    context.textAlign = 'center'
    
    // 绘制背景（更不透明的背景，提高对比度）
    context.fillStyle = 'rgba(0, 0, 0, 0.95)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // 添加边框（提高可读性）
    context.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    context.lineWidth = 2
    context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)
    
    // 绘制每行文字
    lines.slice(0, maxLines).forEach((line, lineIndex) => {
      const y = padding + lineHeight / 2 + lineIndex * lineHeight
      
      // 绘制文字描边（黑色描边，提高在深色背景下的可读性）
      context.strokeStyle = 'rgba(0, 0, 0, 0.8)'
      context.lineWidth = 4
      context.lineJoin = 'round'
      context.miterLimit = 2
      context.strokeText(line, canvas.width / 2, y)
      
      // 绘制文字填充
      context.fillStyle = color
      context.fillText(line, canvas.width / 2, y)
    })
    
    // 创建纹理（启用高质量渲染）
    const texture = new THREE.CanvasTexture(canvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false // 禁用mipmap以提高清晰度
    
    const material = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true,
      alphaTest: 0.1 // 提高透明度阈值，减少边缘模糊
    })
    
    // 根据实际canvas尺寸计算几何体大小
    const aspectRatio = canvas.width / canvas.height
    const geometryHeight = size * 1.5 * maxLines // 根据行数调整高度
    const geometryWidth = geometryHeight * aspectRatio
    
    const geometry = new THREE.PlaneGeometry(geometryWidth, geometryHeight)
    const mesh = new THREE.Mesh(geometry, material)
    
    // 缓存mesh（但不缓存材质和纹理，因为会被克隆）
    this.textLabelCache.set(cacheKey, mesh)
    
    // 注意：不要覆盖 lookAt 方法，在 animate 方法中直接调用原生的 lookAt
    // 原生的 lookAt 方法会在 animate 循环中被调用
    
    return mesh
  }
  
  /**
   * 创建索引信息面板
   */
  createIndexInfoPanel(file) {
    // 移除旧的面板
    if (this.indexInfoPanel) {
      if (this.indexVisualizationGroup) {
        this.indexVisualizationGroup.remove(this.indexInfoPanel)
      }
      // 清理旧面板的资源
      if (this.indexInfoPanel.geometry) {
        this.indexInfoPanel.geometry.dispose()
      }
      if (this.indexInfoPanel.material) {
        if (this.indexInfoPanel.material.map) {
          this.indexInfoPanel.material.map.dispose()
        }
        this.indexInfoPanel.material.dispose()
      }
    }
    
    // 创建信息文本（包含物理地址信息）
    let extentInfo = ''
    if (file.extents && file.extents.length > 0) {
      const blockSizeBytes = this.disk?.blockSize || 4096
      extentInfo = `\nExtent映射（${file.extents.length}个）：\n`
      file.extents.slice(0, 5).forEach((extent, idx) => {
        // 计算逻辑块范围
        const logicalBlockStart = Math.floor(extent.logicalOffset / blockSizeBytes)
        const logicalBlockEnd = Math.floor((extent.logicalOffset + extent.length - 1) / blockSizeBytes)
        // 计算物理块范围
        const physicalBlockStart = Math.floor(extent.physicalOffset / blockSizeBytes)
        const physicalBlockEnd = Math.floor((extent.physicalOffset + extent.length - 1) / blockSizeBytes)
        
        // 格式化显示
        const logicalRange = logicalBlockStart === logicalBlockEnd 
          ? `块#${logicalBlockStart}` 
          : `块#${logicalBlockStart}-${logicalBlockEnd}`
        const physicalRange = physicalBlockStart === physicalBlockEnd 
          ? `块#${physicalBlockStart}` 
          : `块#${physicalBlockStart}-${physicalBlockEnd}`
        
        extentInfo += `  [${idx + 1}] 逻辑${logicalRange} → 物理${physicalRange}\n`
        extentInfo += `      偏移: ${extent.logicalOffset}B → ${extent.physicalOffset}B (${extent.length}B)\n`
      })
      if (file.extents.length > 5) {
        extentInfo += `  ... 还有${file.extents.length - 5}个extent\n`
      }
    } else {
      extentInfo = '\nExtent映射：无（未获取到物理地址信息）\n'
    }
    
    const infoText = `
文件ID：${file.id}
名称：${file.name}
设备ID：${file.deviceId || '未知'}
Inode：${file.inode || '未知'}
分配算法：${file.allocationAlgorithm || '未知'}
块数量：${file.blocks ? file.blocks.length : 0}
大小：${file.size} 字节
创建时间：${file.createTime || '未知'}
物理路径：${file.physicalPath ? (file.physicalPath.length > 50 ? file.physicalPath.substring(0, 50) + '...' : file.physicalPath) : '未知'}${extentInfo}
    `.trim()
    
    // 根据文本内容动态调整面板大小
    const lines = infoText.split('\n').filter(line => line.trim())
    const fontSize = 28 // 稍微减小字体，确保内容能完整显示
    const lineHeight = fontSize * 1.4
    const padding = 30
    const textHeight = lines.length * lineHeight + padding * 2
    const textWidth = 700 // 固定宽度，确保文本不会太宽
    
    // 计算面板尺寸（根据文本内容，使用更合理的比例）
    // canvas尺寸会影响纹理显示，面板尺寸需要与canvas成比例
    const canvasScale = 256 // canvas到3D空间的缩放比例
    const panelWidth = Math.max(3, textWidth / canvasScale)
    const panelHeight = Math.max(4, textHeight / canvasScale)
    
    const panelGeometry = new THREE.PlaneGeometry(panelWidth, panelHeight)
    // 创建材质，稍后应用纹理
    const panelMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      opacity: 0.95, 
      transparent: true,
      side: THREE.DoubleSide // 双面渲染
    })
    this.indexInfoPanel = new THREE.Mesh(panelGeometry, panelMaterial)
    
    // 固定面板位置和朝向（不旋转）
    // 位置：右侧，稍微上移，稍微靠前
    this.indexInfoPanel.position.set(6, 2, 0)
    // 固定朝向：朝向Z轴负方向（从相机看是正面）
    // PlaneGeometry默认朝向Z轴负方向，canvas已翻转，所以不需要旋转
    this.indexInfoPanel.rotation.set(0, 0, 0)
    
    // 根据文本内容计算canvas尺寸
    const canvasPadding = 40
    const canvasWidth = Math.max(800, textWidth + canvasPadding * 2)
    const canvasHeight = Math.max(600, textHeight + canvasPadding * 2)
    
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    
    // 绘制背景（更不透明，提高对比度）
    context.fillStyle = 'rgba(0, 0, 0, 0.95)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    // 添加边框
    context.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    context.lineWidth = 4
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
    
    // 设置字体（更大更清晰，使用上面计算的fontSize）
    context.font = `bold ${fontSize}px "Microsoft YaHei", "SimHei", Arial, sans-serif`
    context.textAlign = 'left'
    context.textBaseline = 'top'
    
    // 使用上面计算的lineHeight和padding
    const startY = canvasPadding
    
    // 绘制文本到临时canvas
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight
      
      // 确保文本在canvas范围内
      if (y + lineHeight > canvas.height - canvasPadding) {
        return // 超出范围，不绘制
      }
      
      // 绘制文字描边（提高可读性）
      context.strokeStyle = 'rgba(0, 0, 0, 0.8)'
      context.lineWidth = 6
      context.lineJoin = 'round'
      context.miterLimit = 2
      context.strokeText(line, canvasPadding, y)
      
      // 绘制文字填充
      context.fillStyle = '#ffffff'
      context.fillText(line, canvasPadding, y)
    })
    
    // 水平翻转canvas内容以修复镜像问题
    const flippedCanvas = document.createElement('canvas')
    flippedCanvas.width = canvas.width
    flippedCanvas.height = canvas.height
    const flippedContext = flippedCanvas.getContext('2d')
    // 水平翻转：先平移，再缩放
    flippedContext.translate(canvas.width, 0)
    flippedContext.scale(-1, 1)
    flippedContext.drawImage(canvas, 0, 0)
    
    // 再次水平翻转（修复镜像问题）
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = flippedCanvas.width
    finalCanvas.height = flippedCanvas.height
    const finalContext = finalCanvas.getContext('2d')
    // 再次水平翻转
    finalContext.translate(finalCanvas.width, 0)
    finalContext.scale(-1, 1)
    finalContext.drawImage(flippedCanvas, 0, 0)
    
    // 调试：验证canvas内容
    console.log('Canvas绘制完成（已翻转）:', {
      width: canvas.width,
      height: canvas.height,
      lines: lines.length,
      firstLine: lines[0] || '无内容'
    })
    
    // 创建纹理（使用最终翻转后的canvas）
    const texture = new THREE.CanvasTexture(finalCanvas)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    texture.flipY = true // Canvas纹理需要flipY=true以正确显示
    texture.needsUpdate = true // 确保纹理更新
    
    // 应用纹理到材质
    panelMaterial.map = texture
    panelMaterial.color.setHex(0xffffff) // 白色，确保纹理正确显示
    panelMaterial.needsUpdate = true
    
    // 更新材质
    this.indexInfoPanel.material = panelMaterial
    
    // 确保面板可见性
    this.indexInfoPanel.visible = true
    this.indexInfoPanel.renderOrder = 1000 // 确保面板在其他对象之上渲染
    
    // 添加到可视化组
    if (this.indexVisualizationGroup) {
      this.indexVisualizationGroup.add(this.indexInfoPanel)
    } else {
      console.warn('indexVisualizationGroup is null, cannot add info panel')
      // 如果组不存在，直接添加到场景
      if (this.scene) {
        this.scene.add(this.indexInfoPanel)
      }
    }
    
    // 面板固定位置和朝向，不需要旋转
    console.log('信息面板已创建（固定位置）:', {
      position: this.indexInfoPanel.position,
      rotation: this.indexInfoPanel.rotation,
      visible: this.indexInfoPanel.visible,
      hasTexture: !!panelMaterial.map
    })
    
    // 调试：输出面板信息
    console.log('信息面板已创建:', {
      position: this.indexInfoPanel.position,
      visible: this.indexInfoPanel.visible,
      hasTexture: !!panelMaterial.map,
      textureSize: canvas.width + 'x' + canvas.height,
      textLines: lines.length
    })
  }
  
  /**
   * 调整相机位置以适应索引可视化
   */
  adjustCameraForIndex(blockCount, blocksPerRow) {
    // 新的布局是垂直排列，需要从正面观察
    const maxDisplayBlocks = Math.min(blockCount, 10)
    const verticalHeight = maxDisplayBlocks * 1.5 // 垂直高度
    const horizontalWidth = 12 // 水平宽度（从左到右）
    
    // 根据内容大小调整距离
    const distance = Math.max(verticalHeight, horizontalWidth) * 1.5
    const distanceZ = Math.max(distance, 15)
    
    // 设置相机位置（从正面斜上方观察，能看到左右布局）
    this.camera.position.set(0, distance * 0.3, distanceZ)
    this.camera.lookAt(0, 0, 0)
    
    if (this.controls) {
      this.controls.target.set(0, 0, 0)
      this.controls.update()
    }
  }
  
  /**
   * 清除索引可视化
   */
  clearIndexVisualization() {
    if (this.indexVisualizationGroup) {
      this.scene.remove(this.indexVisualizationGroup)
      // 清理资源
      this.indexBlocks.forEach(block => {
        if (block.geometry) block.geometry.dispose()
        if (block.material) {
          if (Array.isArray(block.material)) {
            block.material.forEach(mat => mat.dispose())
          } else {
            block.material.dispose()
          }
        }
      })
      this.indexLines.forEach(line => {
        if (line.geometry) line.geometry.dispose()
        if (line.material) {
          if (Array.isArray(line.material)) {
            line.material.forEach(mat => mat.dispose())
          } else {
            line.material.dispose()
          }
        }
      })
      // 清理标签（注意：缓存的标签会被其他实例共享，所以只清理材质和纹理，不清理几何体）
      this.indexLabels.forEach(label => {
        if (label.material) {
          // 检查是否是缓存的标签（通过检查是否有userData标记）
          if (!label.userData.isCached) {
            if (label.material.map) label.material.map.dispose()
            label.material.dispose()
            if (label.geometry) label.geometry.dispose()
          }
        }
      })
      if (this.indexInfoPanel) {
        if (this.indexInfoPanel.geometry) this.indexInfoPanel.geometry.dispose()
        if (this.indexInfoPanel.material) {
          if (this.indexInfoPanel.material.map) this.indexInfoPanel.material.map.dispose()
          this.indexInfoPanel.material.dispose()
        }
      }
    }
    
    this.indexVisualizationGroup = null
    this.indexBlocks = []
    this.indexLines = []
    this.indexLabels = []
    this.indexInfoPanel = null
  }
  
  /**
   * 销毁渲染器
   */
  dispose() {
    this.clearIndexVisualization()
    if (this.renderer) {
      this.renderer.dispose()
      this.container.removeChild(this.renderer.domElement)
    }
  }
}

