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
- 阶段 33 完成：README 同步 ObjectInspector、首页 warning 指标、画布显示范围/排序，以及 Explain selected/neighbors/flow impact/risk path。
- 阶段 33 验证通过：npm run lint、npm run test、npm run test:e2e、tsc --noEmit、vite build、npm run release:dry-run。当前 19 个单元测试通过，1 个 e2e 通过。
- 用户请求将 npm 包名改为 `@codemapai/codemap-ai`，配置 GitHub Actions，并发布到 npm。
- 已追加阶段 34-37，计划先审查发布元数据与现有脚本，再做最小改动、配置认证并发布。
- 阶段 34 完成：确认根包名、发布脚本、README 旧包名引用、现有 CI/release workflow 和 GitHub CLI 登录状态。
- 阶段 35 进行中：已将根包名改为 `@codemapai/codemap-ai`，README 安装命令同步到新包名，release workflow 改为显式 `npm publish --access public --provenance`。
- 阶段 35 验证通过：npm run typecheck、npm run test、npm run build、npm run release:dry-run 均成功；dry-run 显示包名和 tarball 名称正确。
- 阶段 36 进行中：本地 npm 临时认证验证通过，`npm whoami` 返回 `codemapai`；首次 GitHub secret 写入参数不兼容，改用 stdin 方式。
- 阶段 36 完成：`gh secret list --repo weimin96/CodeAtlas` 显示 `NPM_TOKEN` 已更新。
- 阶段 37 阻塞：`npm publish` 已触发并通过 prepublishOnly 的 typecheck、test、build，但最终 npm registry 返回 E403，要求 2FA OTP 或 bypass 2FA token，包未发布成功。
- 用户说明旧 npm token 已删除，并在 npm 侧授权 GitHub；发布策略改为 Trusted Publishing。
- 阶段 38 进行中：release workflow 的发布 Node 版本从 20 提升到 24，并移除 `NODE_AUTH_TOKEN` 注入，保留 `id-token: write` 和 `npm publish --access public --provenance`。
- 阶段 38 验证中：`npm run release:dry-run` 通过；release workflow 已确认不再引用 `secrets.NPM_TOKEN`。
- 已删除旧 GitHub Actions `NPM_TOKEN` secret；`gh secret list` 当前无仓库 secret。
