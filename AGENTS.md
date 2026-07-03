# AGENTS.md

## Commands

```bash
npm run dev          # Start the app on port 3000, pointing at current dir
npm run typecheck    # Type-check frontend only: tsc -p web/tsconfig.json --noEmit
npm run pack:local   # Build .tgz for local install testing
```

No build step; the CLI runs server JS files directly (ESM, `.js` extension). The frontend is served via Vite dev server in middleware mode at runtime.

## Architecture

```
bin/pfo.js          → CLI entry (Commander), calls server/startServer
server/server.js    → Express app, all API routes, Vite middleware
server/scanner.js   → File walker: classifies roles, priorities, extracts symbols, builds repo map
server/symbol-indexer.js → Regex-based symbol extraction (JS/TS, Python, Go, Java); no Tree-sitter dependency
server/ai.js        → AI SDK wrapper: OpenAI, OpenAI-compatible, Ollama; analysis + Q&A prompts
server/heuristic.js → Offline heuristic report builder (no AI needed)
server/repo-map.js  → Ranks files by importance, groups into modules, builds compact RepoMap
server/context-pack.js → Selects files within char budget, builds Markdown context pack for AI
server/ignore-rules.js → .gitignore / pfo.ignore parser (basic glob, negation, directory-only)
server/config-store.js  → Reads/writes ~/.project-fast-onboarding/config.json, merges with env vars
server/fs-utils.js  → Safe file I/O, path sanitization, text/binary detection
web/                → Vite + React + TypeScript SPA (Monaco, Mermaid, Tailwind, shadcn-style)
```

## Data flow

1. `bin/pfo.js` parses args → `startServer({ projectDir, port, host })`
2. `server.js` creates Express app, mounts Vite middleware, defines routes
3. First `/api/project` call triggers `scanProject(root)` — walks directory tree, classifies files, extracts symbols, builds `repoMap`
4. Scan result cached in memory; `/api/rescan` clears and rebuilds
5. `/api/analyze` builds a `contextPack` (selected files within char budget), sends to AI with the project map, returns structured JSON report
6. Frontend renders three-column layout: project map (left), code viewer (center), Q&A assistant (right)
7. `/api/ask` enriches context with current file content, selection, symbol, flow, and risk before sending to AI

## Key patterns

- All server code is pure ESM `.js` files with no TypeScript compilation
- Scan results and report are in-memory (no persistence yet — that's v0.8)
- AI response is parsed as JSON through `parseJsonResult()` which strips markdown fences and tries regex fallback
- Symbol indexing uses regex, not Tree-sitter; covers JS/TS, Python, Go, Java
- File roles and priorities are determined by path heuristics (ENTRY_PATTERNS, CONFIG_NAMES, PRIORITY_DIR_KEYWORDS)
- Config resolution order: CLI args > pfo.config.json > env vars > Web UI setting
- The AI provider model is created on every call — no pooling or caching

## 务必遵守的规范

- 需要进行合理的组件拆分，避免单个文件过大；
- ui库使用shadcn/ui，前端要先封装公共的ui组件，要优先使用封装好的公共组件；
- 不要进行兜底处理，要从根源解决问题；
- 不要把思考过程或者要求写在界面上，前端界面不要无谓的解释