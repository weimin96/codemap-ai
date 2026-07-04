# 项目整改计划

## 目标
按用户提供的整改建议，持续推进从“代码阅读工作台”到“项目理解工作台”的整改。

## 假设
- 已完成 P0：报告模型、顶部导航、模块详情、四阶段分析 prompt。
- 继续处理 P1：链路详情、风险详情、Context Pack mode、Ask 结构化返回。
- 每个阶段完成后执行最小验证并创建一次 git commit。
- 保持现有 React、Tailwind、shadcn-style 组件与服务端 ESM 风格。

## 影响范围
- 前端：FlowPage、新增 FlowDetailPage、RiskPage/风险详情、AskPanel 类型适配。
- 服务端：context-pack mode、ask 返回结构。
- 文档/流程：本计划、发现记录、进度记录。

## 阶段
| 阶段 | 状态 | 内容 | 验证 |
|---|---|---|---|
| 0 | complete | 建立计划文件并确认现状 | git status |
| 1 | complete | 报告 schema 增加 analysisQuality、dataModel、evidence，并增强 normalizer | npm run typecheck；node --check server |
| 2 | complete | AppShell 顶部导航化，首页增加 Hero 与分析质量 | npm run typecheck |
| 3 | complete | 新增 ModuleDetailPage，模块卡片进入详情而非代码页 | npm run typecheck |
| 4 | complete | AI 分析 prompt 拆成四阶段结构要求，并保留兼容的 /api/analyze 输出 | npm run typecheck；node --check server/ai.js |
| 5 | complete | 新增 FlowDetailPage，把核心链路升级成业务剧本页 | npm run typecheck |
| 6 | complete | RiskPage 增加风险详情面板 | npm run typecheck |
| 7 | complete | Context Pack 增加 overview/module/flow/risk/question mode | node --check server/context-pack.js；npm run typecheck |
| 8 | complete | Ask 返回结构化答案并兼容现有文本展示 | npm run typecheck；node --check server/ai.js server/server.js |
| 9 | complete | 移除 AI 解析与 Context Pack 读取兜底路径，改为明确失败 | node --check server/ai.js server/context-pack.js；npm run typecheck |
| 10 | complete | 移除追问上下文增强中的静默读取失败 | node --check server/context-enrichment.js；npm run typecheck |
| 11 | complete | 移除扫描器中的静默跳过路径 | node --check server/scanner.js；npm run typecheck |
| 12 | complete | config read errors fail fast | node --check server/config-store.js；npm run typecheck |

## 风险点
- 历史报告可能缺少新增字段，normalizer 必须补齐默认结构。
- AI 输出字段变化不能破坏旧前端字段读取。
- 页面新增状态只应在前端内维护，不引入持久化复杂度。
- Context Pack mode 只做选择策略增强，不改变默认 overview 行为。
- 不再把 AI 非法输出或文件读取失败降级为可继续结果。

## 错误记录
| 错误 | 处理 |
|---|---|
| planning skill 首次用相对 ~ 路径读取失败 | 改用用户目录绝对路径读取成功 |
| 计划文件被 .gitignore 忽略，普通 git add 失败 | 使用 git add -f 仅强制纳入计划文件 |
| ModuleDetailPage 证据数组类型推断为联合类型 | 显式声明 collectEvidence 返回 CodeReference[] |
