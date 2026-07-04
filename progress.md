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
