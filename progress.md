# 整改进度

## 2026-07-04
- 读取项目规范、planning-with-files、frontend-design、DESIGN.md。
- 上一轮阶段 0-14 已完成并提交，最近提交为 `0488b05 refactor: surface frontend api errors and update readme`。
- 本轮按用户新清单追加阶段 15-22：测试/CI、代码图谱、图谱页、Inspector、AI JSON repair、人工确认状态、Markdown 文档集、README。
- 确认 package.json 缺少 test/build/lint/e2e/prepublishOnly。
- 确认 server/scanner.js 与 symbol-indexer.js 已有符号索引，但未构建 imports/calls 图谱。
- 确认前端 AppShell 目前没有代码图谱页入口。
- 阶段 15 完成：新增 build/test/test:e2e/lint/prepublishOnly 脚本、Node 内置测试和 GitHub Actions CI。
- 阶段 15 验证通过：npm run test，npm run typecheck，npm run build。
- 阶段 16 完成：新增 server/code-graph.js，支持 JS/TS 文件、目录、符号、imports、calls、warnings 和 shortest path。
- 阶段 16 验证通过：node --check server/code-graph.js，npm run test。
- 阶段 17 完成：新增 /api/code-graph，前端新增代码图谱导航、图谱加载状态、节点搜索和直接关系视图。
- 阶段 17 验证通过：node --check server/server.js，npm run typecheck。
- 阶段 18 完成：代码图谱页右侧升级为 Inspector，增加概览、为什么有关、告警、代码四个视图，并用最短路径解释节点关系。
- 阶段 18 验证通过：npm run typecheck。
- 阶段 19 完成：AI 分析和追问在 JSON 解析失败时使用 repair prompt 重试一次，仍失败才返回明确错误。
- 阶段 19 验证通过：node --check server/ai.js，npm run test，当前 8 个测试通过。
- 阶段 20 完成：ProjectModule、CoreFlow、RiskItem、DataEntity 增加 verificationStatus、verifiedBy、verifiedAt、verificationNote；normalizer 默认 ai_guess 并保留显式状态。
- 阶段 20 验证通过：npm run typecheck，npm run test，当前 9 个测试通过。
