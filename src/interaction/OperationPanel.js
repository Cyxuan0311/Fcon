/**
 * 操作面板逻辑
 * 封装操作按钮、参数输入框等交互组件，处理用户输入校验
 */
export class OperationPanel {
  constructor() {
    this.validators = new Map()
    this.initValidators()
  }
  
  /**
   * 初始化验证器
   */
  initValidators() {
    this.validators.set('fileName', (value) => {
      if (!value || value.trim() === '') {
        return { valid: false, message: '文件名不能为空' }
      }
      if (value.length > 255) {
        return { valid: false, message: '文件名过长（最大255字符）' }
      }
      if (/[<>:"/\\|?*]/.test(value)) {
        return { valid: false, message: '文件名包含非法字符' }
      }
      return { valid: true }
    })
    
    this.validators.set('fileSize', (value, disk) => {
      if (!value || value <= 0) {
        return { valid: false, message: '文件大小必须大于0' }
      }
      const maxSize = disk.totalBlocks * disk.blockSize / 1024 // KB
      if (value > maxSize) {
        return { valid: false, message: `文件大小超过磁盘容量（最大${maxSize}KB）` }
      }
      return { valid: true }
    })
    
    this.validators.set('totalBlocks', (value) => {
      if (!value || value < 100) {
        return { valid: false, message: '总块数至少为100' }
      }
      if (value > 10000) {
        return { valid: false, message: '总块数不能超过10000' }
      }
      return { valid: true }
    })
  }
  
  /**
   * 验证输入
   */
  validate(field, value, context = {}) {
    const validator = this.validators.get(field)
    if (validator) {
      return validator(value, context)
    }
    return { valid: true }
  }
  
  /**
   * 验证所有字段
   */
  validateAll(fields, context = {}) {
    const errors = []
    for (const [field, value] of Object.entries(fields)) {
      const result = this.validate(field, value, context)
      if (!result.valid) {
        errors.push({ field, message: result.message })
      }
    }
    return {
      valid: errors.length === 0,
      errors
    }
  }
}

