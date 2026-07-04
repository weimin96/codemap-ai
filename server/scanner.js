import fs from 'node:fs/promises';
import path from 'node:path';
import { IGNORE_DIRS, isProbablyText, toPosix, readTextFileSafe } from './fs-utils.js';
import { canExtractSymbols, extractSymbols } from './symbol-indexer.js';
import { loadIgnoreRules } from './ignore-rules.js';
import { buildRepoMap } from './repo-map.js';

const ENTRY_PATTERNS = [
  /(^|\/)main\.(ts|js|go|py|rs|java|kt|cs)$/i,
  /(^|\/)index\.(ts|tsx|js|jsx|mjs|cjs)$/i,
  /(^|\/)server\.(ts|js|mjs|cjs|py|go)$/i,
  /(^|\/)app\.(ts|tsx|js|jsx|py)$/i,
  /(^|\/)routes?\//i,
  /(^|\/)controllers?\//i,
  /(^|\/)handlers?\//i,
  /(^|\/)api\//i,
  /(^|\/)pages\//i,
  /(^|\/)app\//i,
  /(^|\/)jobs?\//i,
  /(^|\/)workers?\//i,
  /(^|\/)consumers?\//i
];

const CONFIG_NAMES = new Set([
  'package.json', 'pnpm-workspace.yaml', 'turbo.json', 'vite.config.ts', 'vite.config.js',
  'next.config.js', 'next.config.mjs', 'nuxt.config.ts', 'docker-compose.yml', 'docker-compose.yaml',
  'Dockerfile', 'tsconfig.json', 'go.mod', 'Cargo.toml', 'pyproject.toml', 'requirements.txt',
  'pom.xml', 'build.gradle', 'settings.gradle', 'schema.prisma', '.env.example'
]);

const PRIORITY_DIR_KEYWORDS = [
  'src', 'app', 'server', 'api', 'routes', 'controllers', 'handlers', 'services', 'service',
  'domain', 'usecases', 'usecase', 'repositories', 'repository', 'models', 'model', 'schema',
  'db', 'database', 'prisma', 'migrations', 'jobs', 'workers', 'queue', 'auth', 'middlewares'
];

function fileRole(relPath) {
  const p = relPath.toLowerCase();
  const base = path.basename(p);
  if (base === 'readme.md') return 'README / 项目说明';
  if (CONFIG_NAMES.has(path.basename(relPath))) return '配置 / 依赖 / 启动线索';
  if (/routes?|api|controllers?|handlers?/.test(p)) return '入口 / 路由 / 控制器';
  if (/services?|usecases?|domain/.test(p)) return '业务逻辑 / UseCase';
  if (/repositories?|dao|models?|schema|prisma|migrations|database|db/.test(p)) return '数据模型 / 持久化';
  if (/jobs?|workers?|queue|consumers?/.test(p)) return '任务 / 队列 / 消费者';
  if (/auth|middleware|guard/.test(p)) return '鉴权 / 中间件';
  if (/test|spec|__tests__/.test(p)) return '测试';
  return '代码文件';
}

function filePriority(relPath) {
  const p = relPath.toLowerCase();
  const base = path.basename(p);
  if (base === 'readme.md' || CONFIG_NAMES.has(base)) return 'P0';
  if (ENTRY_PATTERNS.some((r) => r.test(p))) return 'P0';
  if (/services?|usecases?|domain|auth|middleware/.test(p)) return 'P1';
  if (/models?|schema|prisma|migrations|repositories?|dao/.test(p)) return 'P1';
  if (/test|spec/.test(p)) return 'P2';
  return 'P3';
}

async function walk(root, dir = '', depth = 0, maxDepth = 8, result = [], shouldIgnore = () => false) {
  if (depth > maxDepth) return result;
  const absolute = path.join(root, dir);
  const entries = await readDirectoryEntries(absolute, dir || '.');
  entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const rel = path.join(dir, entry.name);
    const posix = toPosix(rel);
    if (shouldIgnore(posix, entry.isDirectory())) continue;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      result.push({ path: posix, type: 'dir', depth, role: guessDirRole(posix), priority: guessDirPriority(posix) });
      await walk(root, rel, depth + 1, maxDepth, result, shouldIgnore);
    } else if (entry.isFile()) {
      const absoluteFile = path.join(root, rel);
      const stat = await fs.stat(absoluteFile);
      const language = languageFromPath(posix);
      const text = isProbablyText(absoluteFile);
      const symbols = text && canExtractSymbols(language)
        ? await extractFileSymbols(root, posix, language, stat.size)
        : [];
      result.push({
        path: posix,
        type: 'file',
        depth,
        size: stat.size,
        language,
        text,
        role: fileRole(posix),
        priority: filePriority(posix),
        symbols
      });
    }
  }
  return result;
}

async function extractFileSymbols(root, relPath, language, size) {
  if (size > 220_000) return [];
  const file = await readScannerFile(root, relPath, 220_000);
  if (file.truncated) throw new Error(`Symbol extraction input unexpectedly truncated: ${relPath}`);
  return extractSymbols({ path: relPath, language, content: file.content });
}

function guessDirRole(relPath) {
  const p = relPath.toLowerCase();
  if (/routes?|api|controllers?|handlers?/.test(p)) return '入口层';
  if (/services?|usecases?|domain/.test(p)) return '业务层';
  if (/repositories?|dao|models?|schema|prisma|migrations|database|db/.test(p)) return '数据层';
  if (/jobs?|workers?|queue|consumers?/.test(p)) return '异步任务';
  if (/components?|views?|pages?/.test(p)) return '界面层';
  if (/tests?|spec/.test(p)) return '测试';
  return '目录';
}

function guessDirPriority(relPath) {
  const p = relPath.toLowerCase();
  if (PRIORITY_DIR_KEYWORDS.some((k) => p.includes(k))) return 'P1';
  return 'P3';
}

export function languageFromPath(file) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file);
  if (base === 'Dockerfile') return 'dockerfile';
  return ({
    '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
    '.json': 'json', '.md': 'markdown', '.mdx': 'markdown', '.css': 'css', '.scss': 'scss',
    '.html': 'html', '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java', '.kt': 'kotlin',
    '.cs': 'csharp', '.php': 'php', '.rb': 'ruby', '.sql': 'sql', '.yaml': 'yaml', '.yml': 'yaml',
    '.xml': 'xml', '.sh': 'shell', '.prisma': 'prisma', '.vue': 'vue', '.svelte': 'svelte'
  })[ext] || 'plaintext';
}

export async function scanProject(root) {
  const shouldIgnore = await loadIgnoreRules(root);
  const items = await walk(root, '', 0, 8, [], shouldIgnore);
  const files = items.filter((item) => item.type === 'file');
  const dirs = items.filter((item) => item.type === 'dir');
  const symbols = files.flatMap((file) => file.symbols || []);
  const keyFiles = pickKeyFiles(files);
  const summary = inferSummary(files);
  const scannedAt = new Date().toISOString();
  const repoMap = buildRepoMap({ root, files, symbols, summary, scannedAt });
  return {
    root,
    scannedAt,
    totalFiles: files.length,
    totalDirs: dirs.length,
    totalSymbols: symbols.length,
    tree: compactTree(items, 320),
    files,
    symbols,
    repoMap,
    keyFiles,
    summary
  };
}

export function pickKeyFiles(files, limit = 80) {
  return [...files]
    .filter((f) => f.text)
    .map((f) => ({ ...f, score: scoreFile(f) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function scoreFile(file) {
  let score = 0;
  if (file.priority === 'P0') score += 100;
  if (file.priority === 'P1') score += 60;
  if (file.priority === 'P2') score += 25;
  if (file.size < 120_000) score += 10;
  if (file.size > 500_000) score -= 80;
  const p = file.path.toLowerCase();
  if (/readme|package\.json|go\.mod|cargo\.toml|pyproject|docker-compose|schema\.prisma/.test(p)) score += 60;
  if (/routes?|api|controllers?|handlers?|main|server|app|index/.test(p)) score += 40;
  if (/services?|usecases?|domain|auth|middleware|jobs?|workers?/.test(p)) score += 35;
  if (Array.isArray(file.symbols)) score += Math.min(file.symbols.length * 3, 30);
  if (/test|spec|stories|mock/.test(p)) score -= 10;
  return score;
}

function compactTree(items, limit) {
  return items.slice(0, limit).map((item) => ({
    path: item.path,
    type: item.type,
    role: item.role,
    priority: item.priority,
    language: item.language,
    symbolCount: item.symbols?.length || 0
  }));
}

function inferSummary(files) {
  const names = new Set(files.map((f) => path.basename(f.path)));
  const all = files.map((f) => f.path.toLowerCase()).join('\n');
  const stack = [];
  if (names.has('package.json')) stack.push('Node.js / JavaScript / TypeScript');
  if (names.has('vite.config.ts') || names.has('vite.config.js')) stack.push('Vite');
  if (names.has('next.config.js') || names.has('next.config.mjs')) stack.push('Next.js');
  if (names.has('go.mod')) stack.push('Go');
  if (names.has('Cargo.toml')) stack.push('Rust');
  if (names.has('pyproject.toml') || names.has('requirements.txt')) stack.push('Python');
  if (names.has('pom.xml') || names.has('build.gradle')) stack.push('Java/JVM');
  if (all.includes('schema.prisma')) stack.push('Prisma');
  if (all.includes('docker-compose')) stack.push('Docker Compose');
  return {
    stack,
    likelyEntrypoints: files.filter((f) => f.priority === 'P0').slice(0, 20).map((f) => f.path)
  };
}

export async function readContextBundle(root, keyFiles, maxFiles = 28) {
  const selected = keyFiles.slice(0, maxFiles);
  const chunks = [];
  for (const file of selected) {
    const read = await readScannerFile(root, file.path, 28_000);
    chunks.push({
      path: file.path,
      role: file.role,
      priority: file.priority,
      language: file.language,
      symbols: file.symbols || [],
      content: read.content
    });
  }
  return chunks;
}

async function readDirectoryEntries(absolute, relPath) {
  try {
    return await fs.readdir(absolute, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Failed to read directory ${relPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readScannerFile(root, relPath, limit) {
  try {
    return await readTextFileSafe(root, relPath, limit);
  } catch (error) {
    throw new Error(`Failed to read scanner file ${relPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
