# 项目优化发现

## Code Graph 当前状态
- 已有 TS AST 提取 imports/calls，并有 Cytoscape 画布。
- 现有图谱页仍以全项目节点列表为主，缺范围切换、边过滤、warning-only、邻居高亮和业务回链。
- 现有 Explain tab 是前端本地解释 + session cache，不会查 SQLite，也不会调用 AI。
- SQLite 已建 explain_cache 表，但尚未被 Explain tab 使用。

## 实现约束
- 先做前端可用性收口，避免重写图谱引擎。
- 范围切换通过现有 report 模块、链路、风险和当前文件信息做子图过滤。
- Graph-aware Context Pack 后续通过服务端引入图谱摘要和邻居文件，不承诺类型级精确调用图。

## npm 发布任务发现
- 根 `package.json` 原包名为 `project-fast-onboarding`，版本为 `0.5.1`，已有 `publishConfig.access=public` 和 `publishConfig.provenance=true`。
- `.github/workflows/release.yml` 已存在，支持 `workflow_dispatch` tag 或 GitHub Release published 触发，使用 `secrets.NPM_TOKEN` 和 `npm publish --provenance`。
- README 中仍有旧包名说明与旧包安装命令，需要随包名迁移同步。
- 仓库使用 `pnpm-lock.yaml`，GitHub Actions 通过 corepack + `pnpm install --frozen-lockfile` 安装依赖。
- `npm view @codemapai/codemap-ai` 返回 404，发布前 registry 上没有公开可见同名包。
- `npm pack --dry-run` 确认包名为 `@codemapai/codemap-ai`，版本 `0.5.1`，tarball 为 `codemapai-codemap-ai-0.5.1.tgz`，共 76 个文件。
- 本地 npm token 验证身份为 `codemapai`。
- GitHub Actions secret `NPM_TOKEN` 已写入 `weimin96/CodeAtlas`。
- 实际 `npm publish --access public --provenance=false` 在上传阶段返回 E403：需要 2FA OTP，或需要启用了 bypass 2FA 的 granular/automation token。
- npm Trusted Publishing 要求包级 Trusted Publisher 精确匹配 GitHub user/org、repository 和 workflow filename，并要求 workflow 拥有 `id-token: write`。
- npm Trusted Publishing 要求 npm CLI 11.5.1+ 和 Node 22.14+；release workflow 原先使用 Node 20，应提升发布 job 的 Node 版本。
- 使用 Trusted Publishing 后不应再向 `npm publish` 注入 `NODE_AUTH_TOKEN`，避免继续走已删除或过期 token。
- 旧 GitHub Actions secret `NPM_TOKEN` 已删除，`gh secret list` 当前无仓库 secret。
- GitHub Actions 首次 OIDC 发布运行在 `pnpm install` 阶段失败：Corepack 选择 pnpm 11.9.0，pnpm 因 `esbuild@0.28.1` build script 未批准返回 `ERR_PNPM_IGNORED_BUILDS`。
- 需要在 `package.json` 和 CI/release workflow 中固定 pnpm 版本，避免 runner 工具链漂移。
- 第二次 GitHub Actions 发布运行通过了 install、typecheck、test、build 和 pack dry-run；`npm publish` 成功生成 provenance statement，但最终 PUT `@codemapai/codemap-ai` 返回 E404。
- npm 官方文档说明 Trusted Publisher 需要在包设置中配置 GitHub user/org、repository、workflow filename 和 allowed actions；当前错误符合包级 Trusted Publisher 或 scope/package 权限未匹配。
- 用户将仓库改为 `weimin96/codemap-ai`，本次手动发布目标版本为 `0.1.0`。
- 新 token 的 `npm whoami` 返回 `codemapai`，但手动 `npm publish --access public --provenance=false` 返回 E403：仍需要 2FA OTP 或启用 bypass 2FA 的发布 token。
- 用户确认 npm 发布配置已调整，本次发布目标版本改为 `0.2.0`，同时整理 README 并补充徽标。
