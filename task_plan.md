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
| 33 | pending | README 同步与全量验证 | lint、test、e2e、build、dry-run |

## 风险
- ObjectInspector 完全替换所有详情页会变成大重构，本轮先做通用组件和图谱页落地。
- 首页 warnings 需要合并 report.analysisQuality 与 codeGraph warnings，可能存在重复或缺失。
- 画布排序只能基于本地可得信号，不代表真实业务重要性。

## 错误记录
| 错误 | 处理 |
|---|---|
| 暂无 | 暂无 |
