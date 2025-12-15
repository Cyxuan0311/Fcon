# 安装指南

## 系统要求

- Node.js >= 16.0.0
- npm >= 7.0.0 或 yarn >= 1.22.0

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd file_system_view
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

项目将在 `http://localhost:5173` 启动。

## 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

## 预览生产版本

```bash
npm run preview
```

## 依赖说明

### 核心依赖

- **Vue 3.4+**: 前端框架
- **Pinia 2.1+**: 状态管理
- **Three.js 0.161+**: 3D可视化引擎
- **ECharts 5.5+**: 数据图表库
- **Ant Design Vue 4.2+**: UI组件库
- **GSAP 3.12+**: 动画库

### 开发依赖

- **Vite 5.2+**: 构建工具
- **Tailwind CSS 3.4+**: CSS框架
- **@vitejs/plugin-vue**: Vue插件

## 常见问题

### 端口被占用

如果默认端口5173被占用，Vite会自动尝试下一个可用端口。你也可以在 `vite.config.js` 中指定端口：

```javascript
export default {
  server: {
    port: 3000
  }
}
```

### 依赖安装失败

如果遇到依赖安装问题，可以尝试：

```bash
# 清除缓存
npm cache clean --force

# 删除node_modules和package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 浏览器兼容性

- Chrome/Edge >= 90
- Firefox >= 88
- Safari >= 14

不支持IE浏览器。

