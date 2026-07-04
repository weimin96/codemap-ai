# Project Fast Onboarding

本地项目快速接管工作台。通过 npm 安装后，用命令指定一个本地项目目录，在浏览器里查看项目总览、模块地图、模块详情、核心链路、链路详情、数据模型、风险雷达、代码证据，并基于当前文件、选中代码、符号、链路或风险追问 AI。

## 当前版本

当前代码版本：`0.5.1`。

已完成能力覆盖 v0.1-v0.5，并继续补充项目理解工作台能力：顶部导航、报告质量信息、证据索引、模块详情、链路剧本、风险详情、Context Pack mode、结构化追问答案和明确失败策略。

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
- Schema validation: Zod

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

打开页面右上角的 AI 设置，填写 Provider、Base URL、Model 和 API Key。

配置优先级：CLI 参数 / 项目配置 > `pfo.config.json` > 环境变量 > Web UI 保存配置。

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

## 工作台页面

- 项目总览：项目定位、技术栈、启动方式、模块数、链路数、风险数和分析质量。
- 模块地图：按业务模块组织项目结构，进入模块详情查看职责、能力、入口、依赖、数据实体、相关链路、风险和代码证据。
- 核心链路：查看链路图和步骤，进入链路详情查看时序图、代码剧本、数据读写、外部调用、异常路径、推荐断点、风险和证据。
- 数据模型：查看实体、关系、状态机、关键字段和数据风险。
- 风险雷达：查看风险分布，选择风险后查看影响范围、验证步骤、建议测试和代码证据。
- 代码浏览器：打开证据文件、定位符号和行号，结合右侧追问面板分析代码。
- 追问历史 / 阅读路线：查看报告生成的阅读计划。

## 当前能力

- 扫描本地项目目录，并识别关键文件、入口候选、模块候选。
- 基于正则提取 JavaScript / TypeScript / Python / Go / Java 的函数、类、接口、方法和常量。
- 构建 Repo Map，并按优先级、路径角色、符号数量和文件大小排序。
- 构建 Context Pack，按字符预算选择 AI 分析上下文，并支持导出 `project-context.md`。
- Context Pack 支持 `overview`、`module`、`flow`、`risk`、`question` mode，并按目标模块、链路、风险、路径和符号加权选择上下文。
- AI 生成项目概览、分析质量、入口、模块、模块能力、核心链路、数据模型、风险、阅读路线、证据索引和 Mermaid 图。
- AI 分析 prompt 按项目总览、模块分析、链路分析、风险与待验证问题四阶段组织。
- 启发式生成 2-5 条核心链路候选，包括 CLI、API、页面和后台任务等常见入口。
- 链路步骤可绑定文件、符号和行号，并支持点击打开代码位置。
- 模块详情和链路详情会把判断连接到代码证据。
- 风险详情包含风险说明、影响范围、验证步骤、建议测试和相关文件。
- 追问会绑定当前文件、选中行、当前符号、当前链路和当前风险。
- 追问返回结构化答案：结论、证据、风险、下一步验证动作、相关文件和可信度。
- 支持导出 `repo-map.json` 和 `project-context.md`。
- 支持 OpenAI-compatible、OpenAI 和 Ollama。

## 明确失败策略

系统不把关键错误降级成可继续结果：

- AI 分析和追问必须返回合法 JSON；追问结果还必须通过结构校验。
- AI 返回非 JSON 或字段结构不符合要求时，请求会失败并显示错误。
- Context Pack、追问上下文和扫描器读取文件失败时会明确报错。
- `.gitignore` / `pfo.ignore` 只在文件不存在时忽略；其他 IO 错误会中止扫描。
- 配置文件不存在时使用环境变量；配置文件存在但读取失败、JSON 不合法或解密失败时会明确报错。
- 前端 API 请求统一校验 HTTP 状态和响应中的 `error` 字段，配置加载失败不会被静默忽略。

## 设计取向

这个工具不是普通 AI coding assistant，而是“项目接管工作台”：

1. 先生成第一版地图。
2. 再进入模块或链路详情，查看职责、剧本和证据。
3. 然后围绕当前文件、函数、链路或风险追问。
4. 最后由人基于代码、断点、日志和测试验证。

## 安全说明

API Key 优先可通过环境变量提供。通过页面保存时，配置写入本机用户目录 `~/.project-fast-onboarding/config.json`。

本地保存的 API Key 会使用 Node.js `crypto` 进行 AES-256-GCM 加密，密钥保存在同一配置目录下的本地密钥文件中。该方案用于避免配置文件直接出现明文 API Key；如果攻击者已经获得同一系统用户的文件读取权限，仍可能同时读取密文和密钥文件。

## 当前限制

- 符号索引当前使用正则实现，不是 Tree-sitter AST 级索引。
- 核心链路当前是候选链路，不是精确调用图。
- Context Pack 使用字符预算近似 token 预算。
- Context Pack mode 是启发式加权，不是调用图或本地 RAG。
- 暂未持久化链路追问线程和人工确认结论。
- 暂未支持多人协作或远程仓库托管。

下一版建议：补充测试体系、引入真实调用关系分析、实现本地 RAG、沉淀人工确认结论。
