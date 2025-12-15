<template>
  <div class="w-full h-full flex">
    <!-- 左侧操作面板 -->
    <OperationPanel class="w-[20%]" />
    
    <!-- 中间3D可视化区域 (50%) -->
    <div class="flex-1 relative">
      <ThreeDVisualization />
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
    
    <!-- 右侧数据面板 (15%) -->
    <DataPanel class="w-[15%]" />
  </div>
</template>

<script setup>
import { ref, onMounted, h } from 'vue'
import { ConsoleSqlOutlined, BookOutlined } from '@ant-design/icons-vue'
import { Button } from 'ant-design-vue'
import OperationPanel from './components/layout/OperationPanel.vue'
import ThreeDVisualization from './components/layout/ThreeDVisualization.vue'
import DataPanel from './components/layout/DataPanel.vue'
import GuideModule from './components/guide/GuideModule.vue'
import TerminalWindow from './components/terminal/TerminalWindow.vue'

const showGuide = ref(false)
const showTerminal = ref(false)

onMounted(() => {
  // 检查是否已经完成过引导
  const guideCompleted = localStorage.getItem('fs_viewer_guide_completed')
  if (!guideCompleted) {
    // 延迟显示引导，让用户先看到界面
    setTimeout(() => {
      showGuide.value = true
    }, 1000)
  }
})

const closeGuide = () => {
  showGuide.value = false
}
</script>

