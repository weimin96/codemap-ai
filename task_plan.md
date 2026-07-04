# 项目整改计划

## 目标
按用户提供的整改建议，优先落地 P0 级改造：提升 AI 报告结构可信度，并把前端从侧栏式代码阅读器调整为项目理解工作台。

## 假设
- 本轮以建议中的 P0 为主，不一次性实现 Tree-sitter、本地 RAG、历史沉淀等 P2 能力。
- 每个阶段完成后执行最小验证并创建一次 git commit。
- 保持现有 React、Tailwind、shadcn-style 组件与服务端 ESM 风格。

## 影响范围
- 前端：AppShell、Overview、ModuleMap、新增详情页、类型定义。
- 服务端：AI 报告 prompt、报告 normalizer、必要的报告质量字段。
- 文档/流程：本计划、发现记录、进度记录。

## 阶段
| 阶段 | 状态 | 内容 | 验证 |
|---|---|---|---|
| 0 | complete | 建立计划文件并确认现状 | git status |
| 1 | complete | 报告 schema 增加 analysisQuality、dataModel、evidence，并增强 normalizer | npm run typecheck；node --check server |
| 2 | pending | AppShell 顶部导航化，首页增加 Hero 与分析质量 | npm run typecheck |
| 3 | pending | 新增 ModuleDetailPage，模块卡片进入详情而非代码页 | npm run typecheck |
| 4 | pending | AI 分析 prompt 拆成四阶段结构要求，并保留兼容的 /api/analyze 输出 | npm run typecheck |

## 风险点
- 历史报告可能缺少新增字段，normalizer 必须补齐默认结构。
- AI 输出字段变化不能破坏旧前端字段读取。
- 页面新增状态只应在前端内维护，不引入持久化复杂度。

## 错误记录
| 错误 | 处理 |
|---|---|
| planning skill 首次用相对 ~ 路径读取失败 | 改用用户目录绝对路径读取成功 |
| 计划文件被 .gitignore 忽略，普通 git add 失败 | 使用 git add -f 仅强制纳入计划文件 |
