/**
 * 颜色生成器
 * 为文件分配不同的颜色，确保颜色区分度高
 */

// 预定义的颜色调色板（高对比度、易于区分）
const COLOR_PALETTE = [
  0x48bb78, // 绿色
  0x4299e1, // 蓝色
  0xf56565, // 红色
  0xed8936, // 橙色
  0x9f7aea, // 紫色
  0x38b2ac, // 青色
  0xecc94b, // 黄色
  0xf687b3, // 粉色
  0x4fd1c7, // 青绿色
  0xfc8181, // 浅红色
  0x63b3ed, // 浅蓝色
  0x68d391, // 浅绿色
  0xf6ad55, // 浅橙色
  0xc084fc, // 浅紫色
  0x81e6d9, // 浅青色
  0xfbbf24, // 浅黄色
  0xfda4af, // 浅粉色
  0x60a5fa, // 天蓝色
  0x34d399, // 翠绿色
]

// 文件ID到颜色的映射
const fileColorMap = new Map()

/**
 * 获取文件的颜色
 * @param {string} fileId - 文件ID
 * @returns {number} 颜色值（十六进制）
 */
export function getFileColor(fileId) {
  if (!fileColorMap.has(fileId)) {
    // 使用文件ID的哈希值来选择颜色
    const hash = hashString(fileId)
    const colorIndex = hash % COLOR_PALETTE.length
    fileColorMap.set(fileId, COLOR_PALETTE[colorIndex])
  }
  return fileColorMap.get(fileId)
}

/**
 * 清除文件颜色映射
 */
export function clearFileColors() {
  fileColorMap.clear()
}

/**
 * 移除文件的颜色映射
 */
export function removeFileColor(fileId) {
  fileColorMap.delete(fileId)
}

/**
 * 字符串哈希函数
 */
function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转换为32位整数
  }
  return Math.abs(hash)
}

/**
 * 将颜色值转换为RGB对象
 */
export function colorToRgb(color) {
  return {
    r: (color >> 16) & 0xff,
    g: (color >> 8) & 0xff,
    b: color & 0xff
  }
}

/**
 * 将颜色值转换为CSS颜色字符串
 */
export function colorToCss(color) {
  const rgb = colorToRgb(color)
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

