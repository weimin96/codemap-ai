# 项目 P2 优化进度

## 2026-07-04
- 用户提出 P2 优化：通用 Inspector、首页 warnings、画布显示范围/排序、避免 Explain All。
- 已将任务拆为阶段 29-33，并确认每阶段单独提交。
- 阶段 29 完成：新增 ObjectInspector 通用组件，支持 module/flow/risk/node/symbol/entity 对象类型与 overview/explain/why-connected/warnings/code tabs；代码图谱页已迁移到该组件。
- 阶段 29 验证通过：tsc --noEmit、vite build、npm run lint。
- 阶段 30 完成：首页“分析质量”新增未解析 import、未解析 call、parse error、跳过大文件四项指标，合并 report.analysisQuality 与已加载 Code Graph warnings。
- 阶段 30 验证通过：tsc --noEmit、vite build、npm run lint。
- 阶段 31 完成：图谱画布新增显示范围选择器（当前过滤结果、当前模块、当前链路、当前文件、全项目 Top 140）和排序依据（重要性、风险相关、入口相关、调用度、最近搜索），并在画布说明中解释节点/边数量限制。
- 阶段 31 验证通过：tsc --noEmit、vite build、Playwright e2e。
- 阶段 32 完成：Explain tab 新增 Explain selected、Explain neighbors、Explain current flow impact、Explain risk path 四种解释范围，并明确不提供 Explain All；后端 explain prompt 会接收 mode。
- 阶段 32 验证通过：node --check server/server.js、tsc --noEmit、vite build、npm run lint。
