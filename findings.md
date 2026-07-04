# 整改发现记录

## 基线
- 仓库当前工作区干净。
- package.json 提供 `npm run typecheck` 作为前端类型检查命令。
- AppShell 当前是左侧 sidebar + 顶部 header 布局。
- Report 当前已有 modules、flows、risks、contextFiles，但缺少 analysisQuality、dataModel、evidenceIndex。
- normalizeReport 只做基础数组兜底和 flow 字段兜底。

## 建议来源要点
- P0 建议优先做：顶部导航、ModuleDetailPage、报告 schema 增加 analysisQuality/dataModel/evidence、分阶段 AI 分析。
- 展示层应从“页面上摆结果”升级为“带证据的项目理解导航”。
