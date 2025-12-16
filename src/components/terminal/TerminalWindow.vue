<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 terminal-overlay"
    @click.self="close"
  >
    <div class="terminal-window bg-[#0d1117] rounded-lg shadow-2xl w-4/5 h-4/5 flex flex-col border border-[#30363d] overflow-hidden">
      <!-- 终端标题栏 -->
      <div class="bg-[#161b22] px-4 py-3 rounded-t-lg flex items-center justify-between border-b border-[#30363d] terminal-header">
        <div class="flex items-center gap-3">
          <div class="flex gap-1.5">
            <div class="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff3b30] transition-colors cursor-pointer" @click="close"></div>
            <div class="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#ff9500] transition-colors"></div>
            <div class="w-3 h-3 rounded-full bg-[#27c93f] hover:bg-[#1ed836] transition-colors"></div>
          </div>
          <div class="flex items-center gap-2 ml-2">
            <span class="text-[#58a6ff] text-lg">🚀</span>
            <span class="text-[#c9d1d9] text-sm font-medium">Spaceship Terminal</span>
            <span class="text-[#8b949e] text-xs ml-2">文件系统</span>
          </div>
        </div>
        <button
          @click="close"
          class="text-[#8b949e] hover:text-[#f85149] transition-colors p-1 rounded hover:bg-[#21262d]"
          title="关闭 (ESC)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- 终端内容区域 -->
      <div
        ref="terminalContent"
        class="flex-1 overflow-y-auto p-6 font-mono text-sm terminal-content bg-[#0d1117]"
        @click="focusInput"
        @wheel="handleWheel"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <!-- 欢迎信息 -->
        <div v-if="commandHistory.length === 0" class="mb-6 terminal-welcome">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-[#58a6ff] text-2xl">🚀</span>
            <div>
              <div class="text-[#c9d1d9] text-lg font-semibold">Spaceship Terminal</div>
              <div class="text-[#8b949e] text-xs">文件系统终端 v1.0</div>
            </div>
          </div>
          <div class="space-y-2 text-[#8b949e]">
            <div class="flex items-center gap-2">
              <span class="text-[#3fb950]">✓</span>
              <span>输入 <span class="text-[#58a6ff] font-mono">help</span> 查看可用命令</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[#3fb950]">✓</span>
              <span>输入 <span class="text-[#58a6ff] font-mono">exit</span> 或按 <span class="text-[#58a6ff] font-mono">ESC</span> 关闭终端</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[#3fb950]">✓</span>
              <span>使用 <span class="text-[#58a6ff] font-mono">↑↓</span> 键浏览命令历史</span>
            </div>
          </div>
          <div class="mt-6 pt-4 border-t border-[#30363d]">
            <div class="text-[#8b949e] text-xs flex items-center gap-2">
              <span class="text-[#58a6ff]">📁</span>
              <span>当前目录: <span class="text-[#58a6ff] font-mono">{{ getCurrentPathDisplay() }}</span></span>
            </div>
          </div>
        </div>

        <!-- 命令历史记录 -->
        <div v-for="(item, index) in commandHistory" :key="index" class="mb-3 terminal-command">
          <!-- 命令提示符和输入 -->
          <div class="flex items-start mb-1">
            <span class="terminal-prompt mr-2 select-none" v-html="item.prompt"></span>
            <span class="text-[#c9d1d9] command-text" v-html="highlightCommand(item.command)"></span>
          </div>
          <!-- 命令输出 -->
          <div
            v-if="item.output"
            class="ml-0 mt-1 text-[#c9d1d9] whitespace-pre-wrap terminal-output"
            v-html="formatOutput(item.output)"
          ></div>
          <!-- 错误输出 -->
          <div
            v-if="item.error"
            class="ml-0 mt-1 text-[#f85149] terminal-error"
          >
            <span class="text-[#f85149] mr-1">✗</span> {{ item.error }}
          </div>
        </div>

        <!-- 当前命令输入行 -->
        <div class="flex items-start terminal-input-line">
          <span class="terminal-prompt mr-2 select-none" v-html="currentPrompt"></span>
          <input
            ref="commandInput"
            v-model="currentCommand"
            @keyup.enter="executeCommand"
            @keyup.arrow-up="navigateHistory(-1)"
            @keyup.arrow-down="navigateHistory(1)"
            @keyup.esc="close"
            type="text"
            class="flex-1 bg-transparent text-[#c9d1d9] outline-none caret-[#58a6ff] terminal-input"
            autofocus
            spellcheck="false"
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

// 当前提示符（Spaceship主题风格）
const currentPrompt = computed(() => {
  const currentPath = fileSystemStore.currentDirectory
  if (currentPath === 'root') {
    return '<span class="spaceship-prompt-user">root</span><span class="spaceship-prompt-at">@</span><span class="spaceship-prompt-host">filesystem</span> <span class="spaceship-prompt-dir">~</span> <span class="spaceship-prompt-char">➜</span>'
  }
  const dir = fileSystemStore.getFile(currentPath)
  const dirName = dir ? dir.name : 'unknown'
  return `<span class="spaceship-prompt-user">root</span><span class="spaceship-prompt-at">@</span><span class="spaceship-prompt-host">filesystem</span> <span class="spaceship-prompt-dir">${dirName}</span> <span class="spaceship-prompt-char">➜</span>`
})

// 获取当前路径显示
const getCurrentPathDisplay = () => {
  const currentPath = fileSystemStore.currentDirectory
  if (currentPath === 'root') {
    return '/'
  }
  const path = []
  let currentId = currentPath
  const visited = new Set()
  
  while (currentId && currentId !== 'root' && !visited.has(currentId)) {
    visited.add(currentId)
    const dir = fileSystemStore.getFile(currentId)
    if (dir && dir.type === 'directory') {
      path.unshift(dir.name)
      currentId = dir.parentId
    } else {
      break
    }
  }
  
  return '/' + path.join('/')
}

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

  // 添加到命令历史（保存HTML格式的提示符 - Spaceship风格）
  const currentPath = fileSystemStore.currentDirectory
  const promptHtml = currentPath === 'root'
    ? '<span class="spaceship-prompt-user">root</span><span class="spaceship-prompt-at">@</span><span class="spaceship-prompt-host">filesystem</span> <span class="spaceship-prompt-dir">~</span> <span class="spaceship-prompt-char">➜</span>'
    : (() => {
        const dir = fileSystemStore.getFile(currentPath)
        const dirName = dir ? dir.name : 'unknown'
        return `<span class="spaceship-prompt-user">root</span><span class="spaceship-prompt-at">@</span><span class="spaceship-prompt-host">filesystem</span> <span class="spaceship-prompt-dir">${dirName}</span> <span class="spaceship-prompt-char">➜</span>`
      })()
  
  commandHistory.value.push({
    prompt: promptHtml,
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

// 格式化输出（Spaceship主题风格语法高亮）
const formatOutput = (output) => {
  if (typeof output === 'string') {
    // 使用占位符系统，避免重复处理和标签破坏
    const placeholders = []
    let placeholderIndex = 0
    
    // 生成占位符
    const createPlaceholder = (content) => {
      const placeholder = `__PLACEHOLDER_${placeholderIndex++}__`
      placeholders.push({ placeholder, content })
      return placeholder
    }
    
    // 恢复占位符
    const restorePlaceholders = (text) => {
      // 从后往前恢复，避免索引变化
      for (let i = placeholders.length - 1; i >= 0; i--) {
        const { placeholder, content } = placeholders[i]
        text = text.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), content)
      }
      return text
    }
    
    let result = output
    
    // 第一步：保护日期时间格式
    result = result.replace(/(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{1,2})/g, (match) => createPlaceholder(match))
    
    // 第二步：高亮 [DIR] 和 [FILE] 标签
    result = result.replace(/\[DIR\]/g, () => createPlaceholder('<span class="spaceship-dir-tag">[DIR]</span>'))
    result = result.replace(/\[FILE\]/g, () => createPlaceholder('<span class="spaceship-file-tag">[FILE]</span>'))
    
    // 第三步：高亮文件大小（带单位的数字）
    result = result.replace(/(\d+(?:\.\d+)?)\s+(B|KB|MB|GB)/g, (match, num, unit) => {
      return createPlaceholder(`<span class="spaceship-number">${num}</span> ${unit}`)
    })
    
    // 第四步：高亮"总计 X 项"模式
    result = result.replace(/(总计|文件数|目录数|总大小|总块数|块数):\s+(\d+)/g, (match, label, num) => {
      return createPlaceholder(`${label}: <span class="spaceship-number">${num}</span>`)
    })
    
    // 第五步：高亮独立的数字+单位（如 "6 项", "10 块"）
    // 使用单词边界确保不会匹配到其他数字
    result = result.replace(/\b(\d+)\s+(项|块)\b/g, (match, num, unit) => {
      return createPlaceholder(`<span class="spaceship-number">${num}</span> ${unit}`)
    })
    
    // 第六步：高亮路径（避免匹配已处理的占位符）
    result = result.replace(/(\/[^\s\n__]+)/g, (match) => {
      // 检查是否是占位符
      if (match.includes('__PLACEHOLDER_')) return match
      return createPlaceholder(`<span class="spaceship-path">${match}</span>`)
    })
    
    // 第七步：恢复所有占位符
    result = restorePlaceholders(result)
    
    // 第八步：高亮错误和成功信息
    result = result.replace(/(错误|失败|不存在|用法:)/g, '<span class="spaceship-error-text">$1</span>')
    result = result.replace(/(成功|完成|已)/g, '<span class="spaceship-success-text">$1</span>')
    
    // 第九步：高亮分隔线
    result = result.replace(/(━+)/g, '<span class="spaceship-separator">$1</span>')
    
    // 最后：替换换行符
    result = result.replace(/\n/g, '<br>')
    
    return result
  }
  return output
}

// 高亮命令（Spaceship主题风格语法高亮）
const highlightCommand = (command) => {
  if (!command) return ''
  
  // 高亮命令名
  const parts = command.split(/\s+/)
  if (parts.length > 0) {
    const cmd = parts[0]
    const args = parts.slice(1).join(' ')
    return `<span class="spaceship-command">${cmd}</span>${args ? ' <span class="spaceship-args">' + args + '</span>' : ''}`
  }
  return command
}

// 处理鼠标滚轮事件
const handleWheel = (event) => {
  if (!terminalContent.value) return
  
  // 检查是否需要滚动（内容是否超出可视区域）
  const element = terminalContent.value
  const hasScroll = element.scrollHeight > element.clientHeight
  
  if (!hasScroll) {
    // 如果内容不需要滚动，不阻止默认行为
    return
  }
  
  // 计算滚动距离（使用实际的delta值，支持不同鼠标的滚动速度）
  const delta = event.deltaY || event.detail || -event.wheelDelta
  
  // 执行滚动（使用浏览器原生滚动，更平滑）
  element.scrollTop += delta
  
  // 确保滚动在有效范围内
  const maxScroll = element.scrollHeight - element.clientHeight
  if (element.scrollTop < 0) {
    element.scrollTop = 0
  } else if (element.scrollTop > maxScroll) {
    element.scrollTop = maxScroll
  }
  
  // 如果已经滚动到边界，阻止默认行为以避免页面滚动
  if ((element.scrollTop === 0 && delta < 0) || 
      (element.scrollTop >= maxScroll && delta > 0)) {
    event.preventDefault()
  }
}

// 鼠标进入终端内容区域
const handleMouseEnter = () => {
  // 可以在这里添加一些交互效果
}

// 鼠标离开终端内容区域
const handleMouseLeave = () => {
  // 可以在这里添加一些交互效果
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
/* Spaceship主题样式 */
.terminal-overlay {
  animation: fadeIn 0.2s ease-out;
}

.terminal-window {
  animation: slideUp 0.3s ease-out;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
}

.terminal-header {
  user-select: none;
}

.terminal-content {
  background: #0d1117;
  color: #c9d1d9;
  line-height: 1.6;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  min-height: 0;
  max-height: 100%;
}

/* Spaceship提示符样式 */
.terminal-prompt {
  white-space: nowrap;
  font-weight: 500;
}

/* Spaceship提示符分段颜色 */
.spaceship-prompt-user {
  background: #58a6ff;
  color: #0d1117;
  padding: 2px 8px;
  border-radius: 3px 0 0 3px;
  font-weight: 600;
}

.spaceship-prompt-at {
  background: #58a6ff;
  color: #0d1117;
  padding: 2px 0;
}

.spaceship-prompt-host {
  background: #58a6ff;
  color: #0d1117;
  padding: 2px 8px 2px 4px;
  border-radius: 0 3px 3px 0;
  font-weight: 600;
}

.spaceship-prompt-dir {
  background: #1f6feb;
  color: #ffffff;
  padding: 2px 10px;
  border-radius: 3px;
  margin: 0 4px;
  font-weight: 500;
}

.spaceship-prompt-char {
  color: #58a6ff;
  margin-left: 6px;
  font-size: 1.1em;
}

/* 命令和参数高亮 */
.spaceship-command {
  color: #58a6ff;
  font-weight: 500;
}

.spaceship-args {
  color: #a5a5ff;
}

/* 输出高亮 */
.spaceship-dir-tag {
  color: #58a6ff;
  font-weight: 600;
  background: rgba(88, 166, 255, 0.1);
  padding: 1px 4px;
  border-radius: 2px;
}

.spaceship-file-tag {
  color: #79c0ff;
  font-weight: 600;
  background: rgba(121, 192, 255, 0.1);
  padding: 1px 4px;
  border-radius: 2px;
}

.spaceship-number {
  color: #79c0ff;
  font-weight: 500;
}

.spaceship-path {
  color: #a5a5ff;
  font-weight: 400;
}

.spaceship-error-text {
  color: #f85149;
  font-weight: 500;
}

.spaceship-success-text {
  color: #3fb950;
  font-weight: 500;
}

.spaceship-separator {
  color: #30363d;
}

/* 命令文本样式 */
.command-text {
  word-break: break-all;
}

/* 输出样式 */
.terminal-output {
  color: #c9d1d9;
  line-height: 1.8;
}

.terminal-error {
  color: #f85149;
  font-weight: 500;
}

.terminal-input {
  font-family: 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
  letter-spacing: 0.5px;
}

.terminal-input:focus {
  outline: none;
}

/* 欢迎信息样式 */
.terminal-welcome {
  border-left: 3px solid #58a6ff;
  padding-left: 1rem;
}

/* 命令历史样式 */
.terminal-command {
  transition: opacity 0.2s;
}

/* 滚动条样式 - Spaceship风格 */
.terminal-content::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.terminal-content::-webkit-scrollbar-track {
  background: #0d1117;
  border-radius: 5px;
}

.terminal-content::-webkit-scrollbar-thumb {
  background: #30363d;
  border-radius: 5px;
  border: 2px solid #0d1117;
  transition: background 0.2s;
}

.terminal-content::-webkit-scrollbar-thumb:hover {
  background: #484f58;
}

.terminal-content::-webkit-scrollbar-thumb:active {
  background: #5a6169;
}

/* Firefox 滚动条样式 */
.terminal-content {
  scrollbar-width: thin;
  scrollbar-color: #30363d #0d1117;
}

/* 动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 选择文本样式 - Spaceship风格 */
::selection {
  background: #264f78;
  color: #c9d1d9;
}

/* 响应式 */
@media (max-width: 768px) {
  .terminal-window {
    width: 95% !important;
    height: 90% !important;
  }
  
  .terminal-content {
    padding: 1rem;
    font-size: 0.875rem;
  }
  
  .spaceship-prompt-user,
  .spaceship-prompt-host,
  .spaceship-prompt-dir {
    font-size: 0.875rem;
    padding: 1px 6px;
  }
}
</style>

