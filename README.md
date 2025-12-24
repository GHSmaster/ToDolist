# 📅 桌面待办日历 (Todo Calendar Desktop)

一个简洁高效的 Windows 桌面待办事项管理应用，集成了日历视图、桌面挂件模式以及丰富的时间管理功能。

## ✨ 主要功能

*   **📅 日历视图**：直观的月度日历，支持点击日期查看和管理当天的待办事项，日历上会通过小红点标记有任务的日期。
*   **⏱️ 时间段筛选**：支持选择单一日期或时间段（起始日期-结束日期），方便管理跨度多天的任务。
*   **📌 桌面挂件模式**：一键切换至“桌面挂件”模式，窗口变小、半透明并置顶，像便利贴一样固定在桌面上，随时查看任务。
*   **✅ 任务管理**：
    *   创建、编辑、删除任务。
    *   设置优先级（高、中、低）。
    *   添加自定义标签。
    *   设置截止时间和重复规则（每天、每周、每月、每年）。
*   **🔍 筛选与搜索**：支持按完成状态、优先级、标签进行组合筛选。
*   **💾 数据管理**：数据本地存储，安全隐私；支持导出数据备份和导入恢复。
*   **🔔 提醒通知**：基于系统原生通知的任务提醒。

## 🛠️ 技术栈

本项目采用轻量级的 Electron 架构开发，追求启动速度与资源占用的平衡。

*   **核心框架**: [Electron](https://www.electronjs.org/) (Chromium + Node.js)
*   **前端技术**:
    *   HTML5 & CSS3 (使用了 CSS Variables 实现主题配置，Flexbox/Grid 布局)
    *   Vanilla JavaScript (原生 JS，无大型前端框架依赖，保持代码轻量)
*   **打包工具**: [electron-builder](https://www.electron.build/) (用于构建 Windows 可执行文件)
*   **图标库**: FontAwesome (用于 UI 图标)

## 🚀 部署与安装

### 方式一：直接使用（推荐）
本项目提供便携版（Portable），无需安装即可运行：
1. 下载最新发布的 `.exe` 文件（通常在 dist 目录）。
2. 双击直接运行。

### 方式二：源码运行
如果你是开发者，可以克隆仓库并在本地运行：

1. **环境准备**：确保已安装 [Node.js](https://nodejs.org/) (建议 LTS 版本) 和 git。
2. **克隆仓库**：
   ```bash
   git clone <repository-url>
   cd ToDoList
   ```
3. **安装依赖**：
   ```bash
   npm install
   ```
4. **启动开发环境**：
   ```bash
   npm start
   ```
   *注意：如果遇到 PowerShell 执行策略问题，可以使用 `.\node_modules\.bin\electron .` 启动。*

## 📦 打包指南

如果需要生成可执行文件（.exe）：

```bash
# 生成免安装便携版 (Portable) 和 安装包
npm run dist
```
构建完成后，文件将生成在 `dist` 目录下。

## 📂 项目结构

```
ToDoList/
├── src/
│   ├── main.js        # Electron 主进程 (窗口创建、系统事件、IPC通信)
│   ├── renderer.js    # 渲染进程 (UI 逻辑、DOM 操作、状态管理)
│   ├── index.html     # 主界面 HTML 结构
│   └── styles.css     # 应用样式表
├── assets/            # 图标与静态资源
├── dist/              # 打包输出目录
├── package.json       # 项目配置与依赖
└── README.md          # 项目说明文档
```

## 📝 开发说明

*   **数据存储**：应用使用 `localStorage` 存储用户偏好设置，待办事项数据通过 Electron 的 `fs` 模块存储在用户的应用数据目录 (`AppData`) 下的 JSON 文件中，确保数据持久化。
*   **窗口通信**：主进程 (`main.js`) 与渲染进程 (`renderer.js`) 通过 `ipcMain` 和 `ipcRenderer` 进行通信（例如窗口最小化、切换挂件模式等）。

---
**License**: MIT
