<template>
  <div class="w-full h-full flex flex-col" style="overflow: hidden;">
    <!-- 标题栏 -->
    <header class="app-header">
      <div class="header-content">
        <div class="header-left">
          <div class="logo-section">
            <span class="logo-icon">🗂️</span>
            <div class="logo-text">
              <h1 class="app-title">Fcon Viewer</h1>
              <p class="app-subtitle">文件系统可视化工具</p>
            </div>
          </div>
        </div>
        <div class="header-right">
          <a 
            href="https://github.com/Cyxuan0311/Fcon.git" 
            target="_blank" 
            rel="noopener noreferrer"
            class="github-link"
            title="查看 GitHub 仓库"
          >
            <GithubOutlined />
          </a>
        </div>
      </div>
    </header>
    
    <!-- 主内容区域 -->
    <div class="flex-1 flex" style="overflow: hidden; min-height: 0;">
      <!-- 左侧操作面板 -->
      <div 
        ref="operationPanelRef"
        class="h-full relative flex-shrink-0"
        :style="{ width: operationPanelWidth + 'px', minWidth: '200px', maxWidth: operationPanelMaxWidth + 'px' }"
      >
        <OperationPanel />
      </div>
      
      <!-- 操作面板可拖拽的分隔条 -->
      <div
        ref="operationResizerRef"
        class="resizer"
        :class="{ dragging: isResizingOperation }"
        @mousedown="startResizeOperation"
        title="拖拽调整操作面板宽度"
      ></div>
      
      <!-- 中间3D可视化区域 -->
      <div class="flex-1 relative" style="min-width: 0; width: 0;">
        <ThreeDVisualization :show-terminal="showTerminal" />
        <GuideModule :show="showGuide" @close="closeGuide" />
        <!-- 功能按钮组 -->
        <div v-if="!showGuide" class="absolute top-4 right-4 flex gap-2 z-40">
          <!-- 终端按钮 -->
          <Button 
            @click="showTerminal = true"
            :icon="h(ConsoleSqlOutlined)"
            title="打开终端"
          >
            终端
          </Button>
          <!-- 引导按钮 -->
          <Button 
            @click="showGuide = true"
            type="primary"
            :icon="h(BookOutlined)"
            title="显示教学引导"
          >
            教学引导
          </Button>
        </div>
        
        <!-- 终端窗口 -->
        <TerminalWindow :show="showTerminal" @close="showTerminal = false" />
      </div>
      
      <!-- 数据面板可拖拽的分隔条 -->
      <div
        ref="dataResizerRef"
        class="resizer"
        :class="{ dragging: isResizingData }"
        @mousedown="startResizeData"
        title="拖拽调整数据面板宽度"
      ></div>
      
      <!-- 右侧数据面板 -->
      <div 
        ref="dataPanelRef"
        class="h-full relative flex-shrink-0"
        :style="{ width: dataPanelWidth + 'px', minWidth: '150px', maxWidth: dataPanelMaxWidth + 'px' }"
      >
        <DataPanel />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, h } from 'vue'
import { ConsoleSqlOutlined, BookOutlined, GithubOutlined } from '@ant-design/icons-vue'
import { Button } from 'ant-design-vue'
import OperationPanel from './components/layout/OperationPanel.vue'
import ThreeDVisualization from './components/layout/ThreeDVisualization.vue'
import DataPanel from './components/layout/DataPanel.vue'
import GuideModule from './components/guide/GuideModule.vue'
import TerminalWindow from './components/terminal/TerminalWindow.vue'

const showGuide = ref(false)
const showTerminal = ref(false)

// 操作面板宽度调整相关
const operationPanelRef = ref(null)
const operationResizerRef = ref(null)
const operationPanelWidth = ref(300) // 默认宽度 300px
const operationPanelMaxWidth = ref(1000) // 最大宽度 1000px（增大）
const isResizingOperation = ref(false)
const operationStartX = ref(0)
const operationStartWidth = ref(0)

// 数据面板宽度调整相关
const dataPanelRef = ref(null)
const dataResizerRef = ref(null)
const dataPanelWidth = ref(250) // 默认宽度 250px
const dataPanelMaxWidth = ref(600) // 最大宽度 600px
const isResizingData = ref(false)
const dataStartX = ref(0)
const dataStartWidth = ref(0)

// 从 localStorage 加载保存的宽度
onMounted(() => {
  // 检查是否已经完成过引导
  const guideCompleted = localStorage.getItem('fs_viewer_guide_completed')
  if (!guideCompleted) {
    // 延迟显示引导，让用户先看到界面
    setTimeout(() => {
      showGuide.value = true
    }, 1000)
  }
  
  // 计算最大宽度（视口宽度的50%）
  operationPanelMaxWidth.value = Math.floor(window.innerWidth * 0.5)
  dataPanelMaxWidth.value = Math.floor(window.innerWidth * 0.4)
  
  // 加载保存的操作面板宽度
  const savedOperationWidth = localStorage.getItem('operation_panel_width')
  if (savedOperationWidth) {
    const width = parseInt(savedOperationWidth, 10)
    if (width >= 200 && width <= operationPanelMaxWidth.value) {
      operationPanelWidth.value = width
    }
  } else {
    // 如果没有保存的值，使用视口宽度的20%
    operationPanelWidth.value = Math.floor(window.innerWidth * 0.2)
  }
  
  // 加载保存的数据面板宽度
  const savedDataWidth = localStorage.getItem('data_panel_width')
  if (savedDataWidth) {
    const width = parseInt(savedDataWidth, 10)
    if (width >= 150 && width <= dataPanelMaxWidth.value) {
      dataPanelWidth.value = width
    }
  } else {
    // 如果没有保存的值，使用视口宽度的15%
    dataPanelWidth.value = Math.floor(window.innerWidth * 0.15)
  }
  
  // 监听窗口大小变化，更新最大宽度
  window.addEventListener('resize', handleWindowResize)
})

// 处理窗口大小变化
const handleWindowResize = () => {
  operationPanelMaxWidth.value = Math.floor(window.innerWidth * 0.5)
  dataPanelMaxWidth.value = Math.floor(window.innerWidth * 0.4)
  
  // 确保当前宽度不超过新的最大宽度
  if (operationPanelWidth.value > operationPanelMaxWidth.value) {
    operationPanelWidth.value = operationPanelMaxWidth.value
  }
  if (dataPanelWidth.value > dataPanelMaxWidth.value) {
    dataPanelWidth.value = dataPanelMaxWidth.value
  }
}

// 开始调整操作面板大小
const startResizeOperation = (e) => {
  isResizingOperation.value = true
  operationStartX.value = e.clientX
  operationStartWidth.value = operationPanelWidth.value
  
  // 添加全局事件监听
  document.addEventListener('mousemove', handleResizeOperation)
  document.addEventListener('mouseup', stopResizeOperation)
  
  // 防止文本选择
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  
  e.preventDefault()
}

// 处理操作面板调整大小
const handleResizeOperation = (e) => {
  if (!isResizingOperation.value) return
  
  const diff = e.clientX - operationStartX.value
  const newWidth = operationStartWidth.value + diff
  
  // 限制宽度范围
  const minWidth = 200
  operationPanelWidth.value = Math.max(minWidth, Math.min(operationPanelMaxWidth.value, newWidth))
}

// 停止调整操作面板大小
const stopResizeOperation = () => {
  if (isResizingOperation.value) {
    isResizingOperation.value = false
    
    // 移除全局事件监听
    document.removeEventListener('mousemove', handleResizeOperation)
    document.removeEventListener('mouseup', stopResizeOperation)
    
    // 恢复文本选择
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    
    // 保存宽度到 localStorage
    localStorage.setItem('operation_panel_width', operationPanelWidth.value.toString())
  }
}

// 开始调整数据面板大小
const startResizeData = (e) => {
  isResizingData.value = true
  dataStartX.value = e.clientX
  dataStartWidth.value = dataPanelWidth.value
  
  // 添加全局事件监听
  document.addEventListener('mousemove', handleResizeData)
  document.addEventListener('mouseup', stopResizeData)
  
  // 防止文本选择
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  
  e.preventDefault()
}

// 处理数据面板调整大小
const handleResizeData = (e) => {
  if (!isResizingData.value) return
  
  const diff = dataStartX.value - e.clientX // 注意：数据面板是从右向左调整，所以是反向
  const newWidth = dataStartWidth.value + diff
  
  // 限制宽度范围
  const minWidth = 150
  dataPanelWidth.value = Math.max(minWidth, Math.min(dataPanelMaxWidth.value, newWidth))
}

// 停止调整数据面板大小
const stopResizeData = () => {
  if (isResizingData.value) {
    isResizingData.value = false
    
    // 移除全局事件监听
    document.removeEventListener('mousemove', handleResizeData)
    document.removeEventListener('mouseup', stopResizeData)
    
    // 恢复文本选择
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    
    // 保存宽度到 localStorage
    localStorage.setItem('data_panel_width', dataPanelWidth.value.toString())
  }
}

// 组件卸载时清理
onUnmounted(() => {
  document.removeEventListener('mousemove', handleResizeOperation)
  document.removeEventListener('mouseup', stopResizeOperation)
  document.removeEventListener('mousemove', handleResizeData)
  document.removeEventListener('mouseup', stopResizeData)
  window.removeEventListener('resize', handleWindowResize)
})

const closeGuide = () => {
  showGuide.value = false
}
</script>

<style scoped>
.resizer {
  width: 4px;
  background-color: #e5e7eb;
  cursor: col-resize;
  position: relative;
  flex-shrink: 0;
  transition: background-color 0.2s;
  z-index: 10;
}

.resizer:hover {
  background-color: #3b82f6;
}

.resizer:active {
  background-color: #2563eb;
}

/* 扩大可拖拽区域，提升用户体验 */
.resizer::before {
  content: '';
  position: absolute;
  left: -4px;
  right: -4px;
  top: 0;
  bottom: 0;
  cursor: col-resize;
  z-index: 1;
}

/* 拖拽时的视觉反馈 */
.resizer.dragging {
  background-color: #2563eb;
}

/* 标题栏样式 */
.app-header {
  height: 64px;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
  z-index: 100;
}

.header-content {
  height: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo-icon {
  font-size: 2rem;
  line-height: 1;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.logo-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.app-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.app-subtitle {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 400;
  line-height: 1.2;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.github-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.5rem;
  transition: all 0.3s;
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
}

.github-link:hover {
  color: rgba(255, 255, 255, 1);
  background-color: rgba(255, 255, 255, 0.1);
  transform: scale(1.1);
}

.github-link .anticon {
  font-size: 1.5rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .app-header {
    height: 56px;
  }
  
  .header-content {
    padding: 0 1rem;
  }
  
  .logo-icon {
    font-size: 1.5rem;
  }
  
  .app-title {
    font-size: 1rem;
  }
  
  .app-subtitle {
    font-size: 0.6875rem;
  }
  
  .header-info {
    gap: 1rem;
  }
  
  .info-item span:not(.anticon) {
    display: none;
  }
}
</style>

