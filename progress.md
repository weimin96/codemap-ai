# 整改进度

## 2026-07-04
- 读取项目规范、planning-with-files、frontend-design、DESIGN.md。
- 确认仓库结构与关键文件：types、AppShell、Overview、ModuleMap、server ai、report-normalizer、server routes。
- 创建整改计划文件、发现记录和进度记录。
- 阶段 0 完成：建立计划文件并确认现状。
- 阶段 0 首次提交失败：计划文件被 .gitignore 忽略，改用 git add -f 强制纳入。
- 阶段 1 完成：新增报告质量、数据模型、证据相关类型；增强 normalizer；读取旧报告时做规范化。
- 阶段 1 验证通过：npm run typecheck；node --check server/report-normalizer.js server/server.js。
- 阶段 2 完成：AppShell 改为顶部项目栏和入口工具栏；Overview 增加项目 Hero 与分析质量卡片。
- 阶段 2 验证通过：npm run typecheck。
- 阶段 3 完成：新增 ModuleDetailPage；模块地图卡片和按钮进入模块详情；详情页代码证据可跳转代码浏览器。
- 阶段 3 首次 typecheck 失败：证据数组类型推断过窄，已显式声明 CodeReference[]。
- 阶段 3 验证通过：npm run typecheck。
