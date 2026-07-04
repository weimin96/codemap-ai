# 项目整改计划

## 目标
按用户提供的新清单，把现有“项目理解工作台”继续推进到具备可验证代码图谱、基础测试发布链路、图谱探索和接管闭环雏形的版本。

## 假设
- 工作区当前干净，上一轮阶段 0-14 已提交完成。
- 每个可独立验证的阶段完成后创建一次 git commit。
- 先做 TS/JS 图谱，不引入 Tree-sitter 或大型新依赖。
- 前端继续沿用现有 React、Tailwind、shadcn-style 组件和 web/DESIGN.md 风格。
- 发布链路先补本地脚本与 CI 配置，不执行真实 npm publish。

## 影响范围
- package.json、CI 工作流、基础测试文件。
- 服务端：code-graph、document export、AI JSON repair、verification 状态 normalizer。
- 前端：代码图谱页、Inspector/Why Connected 展示、导出入口。
- 文档：README、计划、发现、进度。

## 阶段
| 阶段 | 状态 | 内容 | 验证 |
|---|---|---|---|
| 0-14 | complete | 已完成上一轮报告、导航、详情页、Context Pack、失败策略与 README 更新 | 见 progress.md |
| 15 | complete | 补测试/构建/发布脚本与 GitHub Actions | npm run typecheck；npm run test；npm run build |
| 16 | complete | 新增 JS/TS Code Graph Layer：nodes/edges/warnings/shortest path | npm run test；node --check server/code-graph.js |
| 17 | complete | 接入 /api/code-graph 与前端代码图谱页 | npm run typecheck；node --check server/server.js |
| 18 | complete | 图谱 Inspector：Overview/Why Connected/Warnings/Code | npm run typecheck |
| 19 | complete | AI JSON repair 一次重试 | npm run test；node --check server/ai.js |
| 20 | complete | 人工确认状态类型与 normalizer 默认值 | npm run typecheck；npm run test |
| 21 | pending | 导出正式 Markdown 文档集 | node --check server/document-exporter.js server/server.js |
| 22 | pending | README 同步测试、CI、图谱、导出和限制 | npm run typecheck |

## 验证策略
- 优先运行新增单元测试覆盖服务端纯函数。
- 前端改动运行 `npm run typecheck`。
- 服务端 ESM 文件运行 `node --check`。
- CI 配置只做静态审查，不触发远端流水线。

## 风险点
- 正则图谱只能作为近似静态图，无法覆盖动态调用、别名和复杂类型推断。
- 不引入图谱可视化大依赖时，前端图谱先用轻量 SVG/HTML 关系视图替代 Cytoscape。
- 人工确认状态先进入数据模型与展示默认值，不做 SQLite 持久化。
- npm 发布只补 prepublishOnly 和 metadata，不做真实发布。

## 错误记录
| 错误 | 处理 |
|---|---|
| planning skill 首次用相对 ~ 路径读取失败 | 改用用户目录绝对路径读取成功 |
| session-catchup 命令第一次 timeout 参数误用毫秒 | 后续使用秒级 timeout |
| PowerShell `2>$null` 在嵌套命令中解析失败 | 改为不重定向的 rg 命令 |
