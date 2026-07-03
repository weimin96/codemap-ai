# Project Fast Onboarding

本地项目快速接管工作台。通过 npm 安装后，用命令指定一个本地项目目录，浏览器里查看项目地图、核心链路、代码预览、风险雷达，并基于当前文件、选中代码、符号或链路追问 AI。

## 当前版本

当前代码版本：`0.5.1`。

已完成能力覆盖 v0.1-v0.5：CLI 本地启动、React 工作台、符号索引、Repo Map、Context Pack、核心链路候选和 Mermaid 可视化。

## 技术栈

- CLI / Server: Node.js + Express
- Frontend: Vite + React + TypeScript
- UI: Tailwind CSS + shadcn/ui 风格组件
- Icons: lucide-react
- Diagram: Mermaid
- Code Preview: Monaco Editor via `@monaco-editor/react`
- AI: Vercel AI SDK (`ai`)
  - OpenAI: `@ai-sdk/openai`
  - OpenAI-compatible: `@ai-sdk/openai-compatible`
  - Ollama: `ollama-ai-provider-v2`

## 安装

```bash
npm install -g ./project-fast-onboarding-0.5.1.tgz
```

或者发布到 npm 后：

```bash
npm install -g project-fast-onboarding
```

## 使用

```bash
pfo /path/to/your/project
```

指定端口：

```bash
pfo /path/to/your/project --port 8088
```

不自动打开浏览器：

```bash
pfo /path/to/your/project --no-open
```

默认地址：

```text
http://127.0.0.1:7890
```

## AI 配置

打开页面左侧的 AI 配置区，填写 Provider、Base URL、Model 和 API Key。

### OpenAI-compatible

```text
Provider: OpenAI Compatible
Base URL: https://api.openai.com/v1
Model: gpt-4.1-mini 或其他模型
API Key: sk-...
```

也支持环境变量：

```bash
OPENAI_API_KEY=xxx OPENAI_MODEL=gpt-4.1-mini pfo /path/to/project
```

### Ollama

```bash
ollama serve
ollama pull qwen2.5-coder:7b
```

页面填写：

```text
Provider: Ollama
Base URL: http://127.0.0.1:11434/api
Model: qwen2.5-coder:7b
API Key: 留空
```

## 当前能力

- 扫描本地项目目录，并识别关键文件、入口候选、模块候选。
- 基于正则提取 JavaScript / TypeScript / Python / Go / Java 的函数、类、接口、方法和常量。
- 构建 Repo Map，并按优先级、路径角色、符号数量和文件大小排序。
- 构建 Context Pack，按字符预算选择 AI 分析上下文，并支持导出 `project-context.md`。
- AI 生成项目概览、入口、模块、核心链路、风险、阅读路线和 Mermaid 图。
- 启发式生成 2-5 条核心链路候选，包括 CLI、API、页面和后台任务等常见入口。
- 链路步骤可绑定文件、符号和行号，并支持点击打开代码位置。
- 三栏 UI：左侧项目地图，中间 Monaco 代码预览和 Mermaid 图，右侧上下文追问。
- 追问会绑定当前文件、选中行、当前符号、当前链路和当前风险。
- 支持导出 `repo-map.json` 和 `project-context.md`。
- 支持 OpenAI-compatible、OpenAI 和 Ollama。

## 设计取向

这个工具不是普通 AI coding assistant，而是“项目接管工作台”：

1. 先生成第一版地图。
2. 再点击链路查看代码。
3. 然后围绕当前文件、函数、链路或风险追问。
4. 最后由人基于代码、断点和日志验证。

## 安全说明

API Key 优先可通过环境变量提供。通过页面保存时，配置写入本机用户目录 `~/.project-fast-onboarding/config.json`。

本地保存的 API Key 会使用 Node.js `crypto` 进行 AES-256-GCM 加密，密钥保存在同一配置目录下的本地密钥文件中。该方案用于避免配置文件直接出现明文 API Key；如果攻击者已经获得同一系统用户的文件读取权限，仍可能同时读取密文和密钥文件。

## 当前限制

- 符号索引当前使用正则实现，不是 Tree-sitter AST 级索引。
- 核心链路当前是候选链路，不是精确调用图。
- Context Pack 使用字符预算近似 token 预算。
- 暂未持久化历史分析报告、链路追问线程和人工确认结论。
- 暂未支持多人协作或远程仓库托管。

下一版建议：补充测试体系、增强证据结构、引入真实调用关系分析、实现本地 RAG 和报告持久化。
