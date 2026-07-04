# 项目优化进度

## 2026-07-04
- 读取 planning-with-files，恢复 task_plan/progress/findings。
- 最新用户清单拆分为阶段 23-28。
- 当前已完成上一轮大量基础项：Playwright、ESLint、数据实体确认、codeatlas CLI、TS AST Code Graph、SQLite 镜像、Cytoscape 画布。
- 阶段 23 开始：目标是补 Code Graph 范围切换、边类型过滤、warning 搜索、邻居高亮和业务回链。
- 阶段 23 完成：CodeGraphPage 增加 all/module/flow/file/symbol 范围切换、contains/defines/imports/calls/warnings-only 过滤、按文件/函数/模块/warning 搜索、直接/调用方/被调用方/import/2-hop 高亮，以及模块/链路/风险业务回链。
- 阶段 23 验证通过：tsc --noEmit、vite build、Playwright e2e。
- 阶段 24 完成：新增 /api/explain-node，先读 SQLite explain_cache，未命中才调用 AI，成功后 recordExplainCache；前端 Explain tab 保留 600ms debounce、AbortController 取消和 session cache，AI 失败时展示本地图谱解释兜底。
- 阶段 24 验证通过：node --check server/server.js、node --check server/sqlite-store.js、npm run test、tsc --noEmit、vite build、npm run lint。
- 阶段 25 完成：新增 WhyConnectedPanel，并接入模块详情、链路详情、风险详情和代码浏览器，提供模块文件归属、链路函数归属、风险影响链路、当前函数影响模块/链路等业务证据解释入口。
- 阶段 25 验证通过：tsc --noEmit、vite build、npm run lint。
- 阶段 26 完成：Context Pack 支持 buildGraphContext，将目标符号/文件的 calls/imports 邻居和 warnings 加入评分与 Markdown；analyze/context-pack/ask 路由会构建或复用 Code Graph 并注入上下文。
- 阶段 26 验证通过：node --check server/context-pack.js、node --check server/context-enrichment.js、node --check server/server.js、npm run test、npm run lint。
