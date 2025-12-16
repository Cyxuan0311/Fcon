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
    this.controls = null
    this.hoveredBlock = null // 当前悬停的块
    this.highlightedBlocks = new Set() // 当前高亮（浮起）的块集合
    this.gridSize = 0 // 保存网格大小，用于优化上浮动画
    this.spacing = 1.15 // 保存块间距
    this.activeAnimations = new Map() // 跟踪每个块的活跃动画，防止被重置
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
    const gridHelper = new THREE.GridHelper(50, 50, 0x2a2a3a, 0x1a1a2a)
    gridHelper.position.y = -0.5
    this.scene.add(gridHelper)
    
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
   * 动画循环
   */
  animate() {
    requestAnimationFrame(() => this.animate())
    
    // 更新控制器（必须每帧调用，用于阻尼效果）
    if (this.controls) {
      this.controls.update()
    }
    
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
   * 销毁渲染器
   */
  dispose() {
    if (this.renderer) {
      this.renderer.dispose()
      this.container.removeChild(this.renderer.domElement)
    }
  }
}

