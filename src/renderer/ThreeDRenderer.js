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
    this.controls = null
  }
  
  /**
   * 初始化场景
   */
  init() {
    // 创建场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)
    
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
    this.container.appendChild(this.renderer.domElement)
    
    // 创建光线
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 10, 5)
    this.scene.add(directionalLight)
    
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
    
    // 开始渲染循环
    this.animate()
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
    
    const gridSize = Math.ceil(Math.sqrt(totalBlocks))
    const spacing = 1.2
    
    // 创建磁盘块网格
    for (let i = 0; i < totalBlocks; i++) {
      const row = Math.floor(i / gridSize)
      const col = i % gridSize
      
      const geometry = new THREE.BoxGeometry(1, 0.5, 1)
      const material = new THREE.MeshStandardMaterial({
        color: this.getBlockColor(disk, i),
        metalness: 0.1,
        roughness: 0.8
      })
      
      const block = new THREE.Mesh(geometry, material)
      block.position.set(
        (col - gridSize / 2) * spacing,
        0,
        (row - gridSize / 2) * spacing
      )
      block.userData = { blockNumber: i, type: 'diskBlock' }
      
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
      return 0x2d3748 // 空闲 - 深灰色
    } else if (disk.usedBlocks[blockNumber]) {
      // 使用文件对应的颜色
      const file = disk.usedBlocks[blockNumber]
      return getFileColor(file.id)
    } else {
      return 0xf56565 // 碎片 - 红色
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
    
    this.diskBlocks.forEach((block, index) => {
      if (index < disk.totalBlocks) {
        const targetColor = this.getBlockColor(disk, index)
        if (animate) {
          this.animateBlockColor(index, targetColor, 0.3)
        } else {
          block.material.color.setHex(targetColor)
        }
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

