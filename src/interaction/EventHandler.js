/**
 * 事件处理器
 * 监听鼠标/键盘事件（点击、拖拽、选择），绑定操作与核心逻辑
 */
export class EventHandler {
  constructor() {
    this.listeners = new Map()
    this.selectedObject = null
  }
  
  /**
   * 初始化事件监听
   */
  init() {
    // 监听键盘事件
    document.addEventListener('keydown', (e) => this.handleKeyDown(e))
  }
  
  /**
   * 处理键盘按下事件
   */
  handleKeyDown(event) {
    // Ctrl+N: 创建文件
    if (event.ctrlKey && event.key === 'n') {
      event.preventDefault()
      this.emit('create-file')
    }
    
    // Delete: 删除文件
    if (event.key === 'Delete') {
      event.preventDefault()
      this.emit('delete-file')
    }
    
    // Ctrl+R: 碎片整理
    if (event.ctrlKey && event.key === 'r') {
      event.preventDefault()
      this.emit('defragment')
    }
  }
  
  /**
   * 注册事件监听器
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }
  
  /**
   * 移除事件监听器
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }
  
  /**
   * 触发事件
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data))
    }
  }
  
  /**
   * 设置选中的对象
   */
  setSelectedObject(object) {
    this.selectedObject = object
    this.emit('selection-changed', object)
  }
  
  /**
   * 获取选中的对象
   */
  getSelectedObject() {
    return this.selectedObject
  }
}

