<template>
  <div v-if="show" class="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white p-6 rounded-lg shadow-2xl z-50 max-w-lg border-2 border-blue-500">
    <div class="flex justify-between items-center mb-4">
      <div class="flex items-center gap-2">
        <span class="text-2xl">📚</span>
        <h3 class="text-xl font-bold text-gray-800">教学引导</h3>
      </div>
      <button 
        @click="close" 
        class="text-gray-500 hover:text-gray-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
      >
        ×
      </button>
    </div>
    
    <div class="mb-4">
      <div class="text-sm text-gray-500 mb-2">
        步骤 {{ currentStep + 1 }} / {{ guides.length }}
      </div>
      <div class="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
        <p class="text-gray-800 leading-relaxed">{{ currentGuide.text }}</p>
        <div v-if="currentGuide.details" class="mt-3 text-sm text-gray-600">
          <p class="font-semibold mb-1">{{ currentGuide.details.title }}</p>
          <ul class="list-disc list-inside space-y-1">
            <li v-for="item in currentGuide.details.items" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>
    </div>
    
    <div class="flex justify-between items-center">
      <button 
        v-if="hasPrev"
        @click="prevStep"
        class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-gray-700 transition-colors"
      >
        ← 上一步
      </button>
      <div v-else></div>
      
      <div class="flex gap-2">
        <button 
          @click="skipGuide"
          class="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-gray-600 text-sm transition-colors"
        >
          跳过引导
        </button>
        <button 
          v-if="hasNext"
          @click="nextStep"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          下一步 →
        </button>
        <button 
          v-else
          @click="close"
          class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          完成 ✓
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const currentStep = ref(0)
const guides = ref([
  { 
    text: '欢迎使用文件系统可视化工具！🎉 这个工具将帮助您直观理解文件系统的核心原理，包括磁盘块分配、目录结构、碎片整理等概念。',
    details: {
      title: '工具特点：',
      items: [
        '3D可视化展示磁盘块分配过程',
        '支持多种分配算法（连续、链接、索引）',
        '实时性能数据监控和图表展示',
        '交互式操作体验'
      ]
    }
  },
  { 
    text: '📦 第一步：初始化磁盘。请选择文件系统类型（FAT32/Ext4/NTFS），设置总块数和块大小，然后点击"初始化磁盘"按钮。',
    details: {
      title: '磁盘参数说明：',
      items: [
        '总块数：磁盘的总容量（建议100-10000）',
        '块大小：每个磁盘块的大小（建议4KB）',
        '文件系统类型：影响分配策略和性能'
      ]
    }
  },
  { 
    text: '📁 第二步：创建文件。输入文件名和大小，选择分配算法（连续/链接/索引），点击"创建文件"。观察3D可视化区域中磁盘块的变化！',
    details: {
      title: '分配算法说明：',
      items: [
        '连续分配：文件占用连续的磁盘块，访问速度快但易产生碎片',
        '链接分配：文件块通过链表连接，空间利用率高但访问较慢',
        '索引分配：使用索引块管理文件块，平衡了性能和空间'
      ]
    }
  },
  { 
    text: '🗑️ 第三步：删除文件。在3D可视化区域点击文件节点或磁盘块选中文件，然后点击"删除选中文件"。观察磁盘块的释放过程。',
    details: {
      title: '删除操作说明：',
      items: [
        '删除文件会释放占用的磁盘块',
        '释放的块会变为空闲状态',
        '频繁创建删除可能导致磁盘碎片'
      ]
    }
  },
  { 
    text: '🔧 第四步：碎片整理。当碎片率较高时（>5%），可以执行碎片整理。系统会将分散的磁盘块重新排列，提高访问效率。',
    details: {
      title: '碎片整理说明：',
      items: [
        '碎片整理会移动磁盘块到连续区域',
        '整理后碎片率会显著降低',
        '整理过程会消耗一定时间'
      ]
    }
  },
  { 
    text: '📊 第五步：查看性能数据。右侧数据面板显示实时监控指标和性能图表。您可以切换不同的图表类型（柱状图/折线图/饼图）查看数据。',
    details: {
      title: '性能指标说明：',
      items: [
        '磁盘利用率：已使用块占总块数的百分比',
        '碎片率：磁盘碎片化程度',
        'IO吞吐量：每秒处理的IO操作量',
        '平均响应时间：操作的平均耗时'
      ]
    }
  },
  { 
    text: '🎓 恭喜！您已经掌握了基本操作。现在可以自由探索文件系统的各种特性，尝试不同的分配算法，观察它们对性能的影响。祝您学习愉快！',
    details: {
      title: '进阶探索：',
      items: [
        '尝试创建不同大小的文件，观察分配策略',
        '对比不同分配算法的性能差异',
        '观察碎片整理前后的磁盘状态变化',
        '导出性能数据进行分析'
      ]
    }
  }
])

const currentGuide = computed(() => guides.value[currentStep.value] || guides.value[0])
const hasNext = computed(() => currentStep.value < guides.value.length - 1)
const hasPrev = computed(() => currentStep.value > 0)

const nextStep = () => {
  if (hasNext.value) {
    currentStep.value++
  }
}

const prevStep = () => {
  if (hasPrev.value) {
    currentStep.value--
  }
}

const close = () => {
  emit('close')
  // 保存引导状态到本地存储
  localStorage.setItem('fs_viewer_guide_completed', 'true')
}

const skipGuide = () => {
  close()
}

// 监听show变化，重置步骤
watch(() => props.show, (newVal) => {
  if (newVal) {
    currentStep.value = 0
  }
})
</script>

