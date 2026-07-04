# 项目优化计划

## 目标
按用户最新清单，把 Code Graph 从“能看”收口到“能用”，并补齐 Explain cache、业务页 Why Connected、Graph-aware Context Pack 和 zip 文档集。

## 假设
- 每完成一个阶段提交一次。
- 继续保持 Node/Express/Vite/React 结构，不做包名破坏性迁移。
- Graph 精度继续限定 JS/TS；已用 TypeScript AST 做提取，但目标解析仍非类型系统级。
- SQLite 作为可选镜像层，Node 不支持时不阻断主流程。

## 阶段
| 阶段 | 状态 | 内容 | 验证 |
|---|---|---|---|
| 23 | complete | Code Graph 可用性收口：范围、过滤、搜索、邻居高亮、业务回链 | typecheck、build、e2e |
| 24 | complete | Explain cache 真正读写复用：后端缓存 API、AI miss、SQLite write、前端 debounce/cancel | test、typecheck、build、lint |
| 25 | complete | Why Connected 业务入口：模块/链路/风险/代码浏览器解释入口 | typecheck、build、lint |
| 26 | complete | Graph-aware Context Pack：flow/risk/question 引入 graph 邻居和路径 | test、node --check、lint |
| 27 | pending | 多文件 zip 文档集：新增 CODE_GRAPH_SUMMARY、ANALYSIS_QUALITY，前端 zip 下载 | test、typecheck、build |
| 28 | pending | README 同步与全量验证 | lint、test、e2e、build、dry-run |

## 风险
- Cytoscape 大图性能需要限制节点/边数量。
- AI Explain 会引入费用和延迟，必须缓存和取消请求。
- zip 若不引入依赖，会使用浏览器 Blob + JSZip；需要新增依赖。
- Graph-aware Context Pack 只能增强上下文选择，不能保证完整调用图准确。

## 错误记录
| 错误 | 处理 |
|---|---|
| 阶段 23 类型检查发现 module.evidence 可能是 string | 增加 evidenceRefs 统一解析数组证据 |
