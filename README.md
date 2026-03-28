<div align="center">
  <a href="https://github.com/teniu-projects/teniulink-node-client">
    <img src="https://github.com/CherryHQ/cherry-studio/blob/main/build/icon.png?raw=true" width="120" height="120" alt="Teniulink Node" />
  </a>
  <h1>Teniulink Node</h1>
  <p><strong>跨平台 AI 助手桌面客户端</strong></p>
  <p>
    <a href="https://github.com/teniu-projects/teniulink-node-client/releases">下载</a> ·
    <a href="#-核心特性">特性</a> ·
    <a href="#-快速开始">快速开始</a> ·
    <a href="#-开发">开发</a>
  </p>
</div>

---

## 📖 简介

Teniulink Node 是一款跨平台 AI 助手桌面客户端，支持 Windows、macOS 和 Linux。基于 Electron 构建，提供开箱即用的 AI 对话体验。

**本项目 Fork 自 [Cherry Studio](https://github.com/CherryHQ/cherry-studio)，感谢原作者的开源贡献。**

## 🌟 核心特性

### 多 LLM 提供商支持
- ☁️ **云端服务**：OpenAI、Anthropic、Google Gemini、Azure 等
- 💻 **本地模型**：Ollama、LM Studio、HuggingFace 推理服务
- 🔗 **API 兼容**：支持 OpenAI API 规范的任意服务

### Teniu云 集成
- 🌐 **云端连接**：一键连接 Teniu云 分布式服务
- 🔐 **安全访问**：基于 Octelium 框架的安全隧道
- 📡 **服务共享**：本地智能网关可导入云端

### 本地智能网关
- 🚀 **API 代理**：本地 LLM API 聚合服务
- 📊 **系统监控**：CPU、GPU、内存、磁盘配置展示
- ⚙️ **一键启动**：无需复杂配置

### AI 对话功能
- 💬 **多模型对话**：同时与多个 AI 模型交流
- 📚 **智能助手**：300+ 预置 AI 助手
- 🎨 **主题定制**：亮色/暗色主题，透明窗口
- 📝 **Markdown 渲染**：完整支持代码高亮、Mermaid 图表

## 🚀 快速开始

### 下载安装

从 [Releases](https://github.com/teniu-projects/teniulink-node-client/releases) 页面下载对应平台的安装包。

### 配置 LLM 服务

1. 打开 **设置 → 模型服务**
2. 添加 API 密钥或配置本地模型服务
3. 开始对话

### 连接 Teniu云（可选）

1. 打开 **设置 → Teniu云**
2. 输入访问密钥
3. 点击连接即可使用云端服务

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Electron 40, Node.js ≥24 |
| 前端 | React 19, Redux Toolkit, Ant Design 5 |
| 样式 | styled-components, TailwindCSS v4 |
| 富文本 | TipTap 3.2 (Yjs 协作) |
| AI SDK | Vercel AI SDK v5 |
| 数据库 | Dexie (IndexedDB), Drizzle ORM (SQLite) |
| 构建 | electron-vite 5, rolldown-vite 7 |

## 💻 开发

### 环境要求

- Node.js ≥22
- pnpm 10.27.0+

### 开发命令

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 代码检查
pnpm lint

# 运行测试
pnpm test

# 构建
pnpm build
```

### 项目结构

```
src/
├── main/          # Electron 主进程 (Node.js)
├── renderer/      # React 渲染进程
└── preload/       # IPC 桥接层

packages/
├── aiCore/        # AI SDK 抽象层
├── shared/        # 跨进程类型定义
└── mcp-trace/     # OpenTelemetry 追踪
```

## 📄 许可证

本项目基于 [AGPL-3.0](LICENSE) 许可证开源。

## 🙏 致谢

本项目 Fork 自 [Cherry Studio](https://github.com/CherryHQ/cherry-studio)，感谢 Cherry Studio 团队的开源贡献。

感谢所有为 AI 开源社区做出贡献的开发者。

---

<div align="center">
  <p>Made with ❤️ by Teniulink Team</p>
</div>
