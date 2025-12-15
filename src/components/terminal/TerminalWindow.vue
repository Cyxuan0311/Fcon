<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="close"
  >
    <div class="bg-gray-900 rounded-lg shadow-2xl w-4/5 h-4/5 flex flex-col border border-gray-700">
      <!-- 终端标题栏 -->
      <div class="bg-gray-800 px-4 py-2 rounded-t-lg flex items-center justify-between border-b border-gray-700">
        <div class="flex items-center gap-2">
          <div class="flex gap-1.5">
            <div class="w-3 h-3 rounded-full bg-red-500"></div>
            <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div class="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span class="text-gray-300 text-sm ml-2">文件系统终端</span>
        </div>
        <button
          @click="close"
          class="text-gray-400 hover:text-white transition-colors"
        >
          <span class="text-xl">×</span>
        </button>
      </div>

      <!-- 终端内容区域 -->
      <div
        ref="terminalContent"
        class="flex-1 overflow-y-auto p-4 font-mono text-sm text-green-400 bg-black"
        @click="focusInput"
      >
        <!-- 欢迎信息 -->
        <div v-if="commandHistory.length === 0" class="mb-4">
          <div class="text-green-400">欢迎使用文件系统终端！</div>
          <div class="text-gray-500 mt-2">输入 'help' 查看可用命令</div>
          <div class="text-gray-500">输入 'exit' 或按 ESC 关闭终端</div>
        </div>

        <!-- 命令历史记录 -->
        <div v-for="(item, index) in commandHistory" :key="index" class="mb-2">
          <!-- 命令提示符和输入 -->
          <div class="flex items-start">
            <span class="text-blue-400 mr-2">{{ item.prompt }}</span>
            <span class="text-white">{{ item.command }}</span>
          </div>
          <!-- 命令输出 -->
          <div
            v-if="item.output"
            class="ml-8 mt-1 text-gray-300 whitespace-pre-wrap"
            v-html="formatOutput(item.output)"
          ></div>
          <!-- 错误输出 -->
          <div
            v-if="item.error"
            class="ml-8 mt-1 text-red-400"
          >
            {{ item.error }}
          </div>
        </div>

        <!-- 当前命令输入行 -->
        <div class="flex items-start">
          <span class="text-blue-400 mr-2">{{ currentPrompt }}</span>
          <input
            ref="commandInput"
            v-model="currentCommand"
            @keyup.enter="executeCommand"
            @keyup.arrow-up="navigateHistory(-1)"
            @keyup.arrow-down="navigateHistory(1)"
            @keyup.esc="close"
            type="text"
            class="flex-1 bg-transparent text-white outline-none caret-green-400"
            autofocus
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useFileSystemStore } from '@/stores/fileSystem'
import { CommandParser } from '@/utils/commandParser'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const fileSystemStore = useFileSystemStore()
const commandParser = new CommandParser(fileSystemStore)

const terminalContent = ref(null)
const commandInput = ref(null)
const currentCommand = ref('')
const commandHistory = ref([])
const historyIndex = ref(-1)
const savedHistory = ref([]) // 保存的命令历史

// 当前提示符
const currentPrompt = computed(() => {
  const currentPath = fileSystemStore.currentDirectory
  if (currentPath === 'root') {
    return 'root@filesystem:~$'
  }
  const dir = fileSystemStore.getFile(currentPath)
  const dirName = dir ? dir.name : 'unknown'
  return `root@filesystem:${dirName}$`
})

// 关闭终端
const close = () => {
  emit('close')
}

// 聚焦输入框
const focusInput = () => {
  nextTick(() => {
    if (commandInput.value) {
      commandInput.value.focus()
    }
  })
}

// 执行命令
const executeCommand = async () => {
  const command = currentCommand.value.trim()
  if (!command) return

  // 处理clear命令
  if (command.toLowerCase() === 'clear' || command.toLowerCase() === 'cls') {
    commandHistory.value = []
    currentCommand.value = ''
    savedHistory.value.push(command)
    historyIndex.value = savedHistory.value.length
    focusInput()
    return
  }

  // 处理exit命令
  if (command.toLowerCase() === 'exit' || command.toLowerCase() === 'quit') {
    savedHistory.value.push(command)
    historyIndex.value = savedHistory.value.length
    close()
    return
  }

  // 保存到历史记录
  savedHistory.value.push(command)
  historyIndex.value = savedHistory.value.length

  // 解析和执行命令（传递历史记录用于history命令）
  const result = await commandParser.parse(command, savedHistory.value)

  // 添加到命令历史
  commandHistory.value.push({
    prompt: currentPrompt.value,
    command: command,
    output: result.output,
    error: result.error
  })

  // 清空当前命令
  currentCommand.value = ''

  // 滚动到底部
  nextTick(() => {
    if (terminalContent.value) {
      terminalContent.value.scrollTop = terminalContent.value.scrollHeight
    }
    focusInput()
  })
}

// 历史记录导航
const navigateHistory = (direction) => {
  if (savedHistory.value.length === 0) return

  historyIndex.value += direction

  if (historyIndex.value < 0) {
    historyIndex.value = 0
  } else if (historyIndex.value >= savedHistory.value.length) {
    historyIndex.value = savedHistory.value.length
    currentCommand.value = ''
    return
  }

  currentCommand.value = savedHistory.value[historyIndex.value]
}

// 格式化输出（支持HTML）
const formatOutput = (output) => {
  if (typeof output === 'string') {
    return output
      .replace(/\n/g, '<br>')
      .replace(/\[(\w+)\]/g, '<span class="text-blue-400">[$1]</span>')
  }
  return output
}

// 监听show变化，聚焦输入框
watch(() => props.show, (newVal) => {
  if (newVal) {
    nextTick(() => {
      focusInput()
      if (terminalContent.value) {
        terminalContent.value.scrollTop = terminalContent.value.scrollHeight
      }
    })
  }
})
</script>

<style scoped>
/* 终端样式 */
.terminal-content {
  background: #000;
  color: #00ff00;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #1a1a1a;
}

::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>

