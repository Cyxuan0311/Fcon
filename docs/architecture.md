# 架构设计

## 整体架构

采用"分层设计+模块化"架构，分为核心层、渲染层、交互层、数据层：

```
┌─────────────────────────────────────────┐
│ 交互层（用户操作、事件监听、教学引导）   │
├─────────────────────────────────────────┤
│ 渲染层（Three.js 3D渲染、ECharts图表渲染）│
├─────────────────────────────────────────┤
│ 核心层（文件系统逻辑、算法模拟、状态管理）│
├─────────────────────────────────────────┤
│ 数据层（性能数据采集、存储、数据处理）   │
└─────────────────────────────────────────┘
```

## 模块拆分

### 核心层（Core Layer）

#### FileSystemCore.js
文件系统核心逻辑，实现：
- 文件创建/删除
- 磁盘块分配/释放
- 碎片整理算法
- 文件系统类型支持（FAT32/Ext4/NTFS）

#### AlgorithmModule.js
算法模块，实现：
- 连续分配算法
- 链接分配算法
- 索引分配算法
- 磁盘调度算法（FCFS/SSTF/SCAN）

### 渲染层（Renderer Layer）

#### ThreeDRenderer.js
Three.js渲染器，负责：
- 3D场景初始化（场景、相机、渲染器）
- 磁盘块3D模型创建
- 目录树3D模型创建
- 动画控制（GSAP集成）
- 交互处理（射线投射、点击检测）

#### ChartRenderer.js
ECharts渲染器，负责：
- 图表实例初始化
- 柱状图/折线图/饼图渲染
- 数据更新和动画
- 响应式调整

### 交互层（Interaction Layer）

#### EventHandler.js
事件处理，负责：
- 鼠标事件监听（点击、拖拽）
- 键盘事件监听（快捷键）
- 事件分发和处理

#### OperationPanel.js
操作面板逻辑，负责：
- 输入验证
- 操作执行
- 错误处理

### 数据层（Data Layer）

#### DataCollector.js
数据采集，负责：
- 操作耗时记录
- IO次数统计
- 吞吐量计算

#### DataProcessor.js
数据处理，负责：
- 数据清洗
- 统计分析
- 数据格式化

#### DataPersistence.js
数据持久化，负责：
- LocalStorage存储
- 数据导入/导出
- 配置保存

### 状态管理（State Management）

#### fileSystem.js (Pinia Store)
文件系统状态管理：
- 磁盘参数（总块数、块大小）
- 文件列表
- 当前目录
- 选中项

#### performance.js (Pinia Store)
性能数据状态管理：
- 实时指标
- 历史数据
- 统计数据

## 数据流

```
用户操作
  ↓
交互层（EventHandler）
  ↓
核心层（FileSystemCore）
  ↓
状态更新（Pinia Store）
  ↓
渲染层（ThreeDRenderer/ChartRenderer）
  ↓
UI更新
```

## 组件结构

```
App.vue
├── OperationPanel.vue (操作面板)
│   ├── 文件系统配置
│   ├── 文件操作
│   └── 文件目录
├── ThreeDVisualization.vue (3D可视化)
│   └── ThreeDRenderer.js
├── DataPanel.vue (数据面板)
│   └── ChartRenderer.js
├── GuideModule.vue (教学引导)
└── TerminalWindow.vue (终端窗口)
```

## 技术选型

### 前端框架
- **Vue 3**: Composition API，更好的逻辑复用
- **Pinia**: 轻量级状态管理，TypeScript友好

### 可视化
- **Three.js**: 3D场景渲染
- **ECharts**: 数据图表
- **GSAP**: 动画控制

### UI框架
- **Ant Design Vue**: 企业级UI组件
- **Tailwind CSS**: 原子化CSS

### 构建工具
- **Vite**: 快速构建和热更新

## 设计模式

### 观察者模式
使用Vue的响应式系统和Pinia实现状态观察。

### 策略模式
不同的分配算法通过策略模式实现，便于扩展。

### 工厂模式
文件系统类型的创建使用工厂模式。

### 单例模式
渲染器实例使用单例模式，确保唯一性。

