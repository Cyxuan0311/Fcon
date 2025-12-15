# 开发指南

## 开发环境设置

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

## 项目结构

```
file_system_view/
├── src/
│   ├── components/          # Vue组件
│   │   ├── layout/         # 布局组件
│   │   ├── guide/          # 教学引导
│   │   └── terminal/       # 终端组件
│   ├── core/               # 核心逻辑
│   │   ├── FileSystemCore.js
│   │   └── AlgorithmModule.js
│   ├── renderer/           # 渲染器
│   │   ├── ThreeDRenderer.js
│   │   └── ChartRenderer.js
│   ├── data/               # 数据处理
│   │   ├── DataCollector.js
│   │   ├── DataProcessor.js
│   │   └── DataPersistence.js
│   ├── stores/             # Pinia状态管理
│   │   ├── fileSystem.js
│   │   └── performance.js
│   ├── utils/              # 工具函数
│   │   ├── colorGenerator.js
│   │   ├── commandParser.js
│   │   └── constants.js
│   ├── interaction/        # 交互逻辑
│   │   ├── EventHandler.js
│   │   └── OperationPanel.js
│   ├── style/              # 样式文件
│   ├── App.vue
│   └── main.js
├── cli/                    # C++命令行工具
├── docs/                   # 文档
├── example/                # 示例文件
└── package.json
```

## 代码规范

### Vue组件

- 使用Composition API
- 组件名使用PascalCase
- Props和Emits需要类型定义
- 使用`<script setup>`语法

### JavaScript

- 使用ES6+语法
- 函数使用驼峰命名
- 常量使用UPPER_SNAKE_CASE
- 类使用PascalCase

### 文件命名

- 组件文件：PascalCase.vue
- 工具文件：camelCase.js
- 常量文件：constants.js

## 开发流程

### 1. 创建功能分支

```bash
git checkout -b feature/your-feature-name
```

### 2. 开发功能

- 遵循代码规范
- 添加必要的注释
- 确保功能正常工作

### 3. 测试

- 手动测试功能
- 检查控制台错误
- 验证不同场景

### 4. 提交代码

```bash
git add .
git commit -m "feat: 添加新功能"
git push origin feature/your-feature-name
```

## 核心模块开发

### 添加新的分配算法

1. 在`FileSystemCore.js`中添加算法实现
2. 在`AlgorithmModule.js`中注册算法
3. 在操作面板中添加选项
4. 更新文档

### 添加新的文件系统类型

1. 在`FileSystemCore.js`中添加类型支持
2. 更新文件系统类型枚举
3. 添加类型特定的逻辑
4. 更新UI选项

### 添加新的图表类型

1. 在`ChartRenderer.js`中添加渲染方法
2. 在数据面板中添加切换选项
3. 更新数据格式要求
4. 测试图表渲染

## 调试技巧

### Vue DevTools

安装Vue DevTools浏览器扩展，可以：
- 查看组件状态
- 检查Pinia store
- 调试组件props和events

### 控制台调试

```javascript
// 在组件中添加
console.log('Debug info:', data)
```

### 性能分析

使用浏览器Performance工具分析：
- 渲染性能
- JavaScript执行时间
- 内存使用

## 构建和部署

### 构建

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

### 部署

构建产物在`dist`目录，可以部署到：
- 静态文件服务器（Nginx、Apache）
- CDN（Cloudflare、阿里云OSS）
- 云平台（Vercel、Netlify）

## 常见问题

### Three.js场景不显示

- 检查canvas元素是否正确挂载
- 确认Three.js版本兼容性
- 检查控制台错误信息

### 状态更新不生效

- 确认使用Pinia的响应式API
- 检查store是否正确导入
- 验证数据格式

### 动画不流畅

- 检查GSAP版本
- 优化3D场景复杂度
- 使用requestAnimationFrame

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License

