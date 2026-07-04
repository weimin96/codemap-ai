# 项目 P2 优化计划

## 目标
继续借鉴 CodeAtlas-Graph 的细节，把 Inspector、Warnings、图谱画布范围和 Explain 使用方式做产品化收口。

## 假设
- 每完成一个阶段提交一次。
- 不做 Explain All，避免费用和伪确定性。
- 保持现有图谱限制，但让用户明确选择画布范围和排序依据。
- ObjectInspector 先抽象 UI 容器与 tabs，逐步替换现有详情页，不一次性重写全部业务内容。

## 阶段
| 阶段 | 状态 | 内容 | 验证 |
|---|---|---|---|
| 29 | complete | 抽象 ObjectInspector 通用组件，并在图谱页复用 | typecheck、build、lint |
| 30 | complete | 首页分析质量展示图谱 warning 分类和跳过大文件 | typecheck、build、lint |
| 31 | complete | 图谱画布增加显示范围和排序依据选择器 | typecheck、build、e2e |
| 32 | complete | Explain 收口为 selected/neighbors/flow impact/risk path，明确不做 Explain All | typecheck、build、lint |
| 33 | complete | README 同步与全量验证 | lint、test、e2e、build、dry-run |

## 风险
- ObjectInspector 完全替换所有详情页会变成大重构，本轮先做通用组件和图谱页落地。
- 首页 warnings 需要合并 report.analysisQuality 与 codeGraph warnings，可能存在重复或缺失。
- 画布排序只能基于本地可得信号，不代表真实业务重要性。

## 本次发布任务

### 目标
将 npm 包名改为 `@codemapai/codemap-ai`，配置 GitHub Actions 自动发布，并完成一次 npm 发布。

### 假设
- 当前仓库就是要发布的 npm 包源码。
- 发布流程优先复用项目已有 `pack:local`、typecheck 或 dry-run 脚本。
- 用户已删除旧 npm token，并在 npm 侧授权 GitHub；发布改为 npm Trusted Publishing，不再依赖 `NPM_TOKEN`。

### 影响范围
- `package.json` 及可能存在的 lockfile 包元数据。
- `.github/workflows` 发布 workflow。
- GitHub Actions OIDC 发布配置。

### 实施步骤
| 阶段 | 状态 | 内容 | 验证 |
|---|---|---|---|
| 34 | complete | 检查 npm 元数据、现有脚本、workflow 与发布状态 | package/workflow 文件审查 |
| 35 | complete | 修改包名与发布配置，新增或调整 GitHub Actions | npm pack dry-run、typecheck |
| 36 | complete | 配置 npm 认证与 GitHub secret | npm whoami、gh secret set |
| 37 | blocked | 发布到 npm 并确认结果 | GitHub Actions publish、npm view |
| 38 | complete | 迁移 GitHub Actions 到 npm Trusted Publishing | workflow 审查、Actions 发布 |

### 验证方式
- 自动化：执行项目已有最小验证命令，如 `npm run typecheck`、`npm run pack:local` 或 `npm pack --dry-run`。
- 发布验证：执行 GitHub Actions release workflow，并用 `npm view @codemapai/codemap-ai` 确认结果。

### 风险点
- npm Trusted Publisher 需要在 npm 包侧精确匹配 GitHub user/org、repo 和 workflow 文件名。
- 包名已存在或 scope 需要组织权限。
- GitHub 仓库未配置远端或当前身份无权限写入 secret。
- 发布是不可逆外部动作，发布前必须核对 `files`、包名、版本和 dry-run 输出。

## 错误记录
| 错误 | 处理 |
|---|---|
| 阶段 33 首次验证命令 timeout 超过工具最大值 | 拆成两组命令执行 |
| 阶段 36 首次 `gh secret set` 使用了当前 gh 版本不支持的 `--body-file` | 改为通过标准输入写入 secret |
| 阶段 37 `npm publish` 返回 E403 | npm 要求 2FA OTP，或使用启用了 bypass 2FA 的 granular/automation token；当前 token 只能通过 `npm whoami`，不能完成发布 |
| 阶段 38 需要区分 npm GitHub 账号关联与包级 Trusted Publisher | 按 npm Trusted Publishing 要求配置 workflow，发布结果以 GitHub Actions OIDC 运行为准 |
| 阶段 38 首次 `gh secret delete` 使用了当前 gh 版本不支持的 `--yes` / `--repo` | 改为在当前仓库上下文删除 Actions secret |
| 阶段 38 首次 GitHub Actions 发布在依赖安装阶段失败 | Corepack 选择 pnpm 11.9.0，因 `esbuild` build script 未批准导致 `ERR_PNPM_IGNORED_BUILDS`；改为固定 pnpm 10.24.0 |
| 阶段 37 第二次 GitHub Actions 发布在 `npm publish` 阶段返回 E404 | workflow 已生成 provenance，说明 OIDC 可用；npm 包级 Trusted Publisher 或 scope/package 发布权限仍未匹配 |
