import path from 'node:path';

const PRIORITY_SCORE = { P0: 100, P1: 70, P2: 35, P3: 10 };
const MAX_REPO_MAP_FILES = 120;
const MAX_SYMBOLS_PER_FILE = 16;

export function buildRepoMap({ root, files, symbols, summary, scannedAt }) {
  const rankedFiles = files
    .filter((file) => file.text)
    .map((file) => ({ ...file, importance: scoreRepoFile(file) }))
    .sort((a, b) => b.importance - a.importance || a.path.localeCompare(b.path));

  return {
    root,
    generatedAt: scannedAt || new Date().toISOString(),
    stack: summary?.stack || [],
    totals: {
      files: files.length,
      textFiles: files.filter((file) => file.text).length,
      symbols: symbols.length
    },
    entrypoints: rankedFiles.filter(isEntrypointFile).slice(0, 24).map(toRepoMapFile),
    importantFiles: rankedFiles.slice(0, MAX_REPO_MAP_FILES).map(toRepoMapFile),
    modules: buildModuleMap(rankedFiles),
    symbolIndex: symbols.slice(0, 400).map((symbol) => ({
      name: symbol.name,
      kind: symbol.kind,
      path: symbol.path,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      signature: symbol.signature
    }))
  };
}

export function scoreRepoFile(file) {
  let score = PRIORITY_SCORE[file.priority] || 0;
  const lower = file.path.toLowerCase();
  const symbolCount = file.symbols?.length || 0;

  score += Math.min(symbolCount * 4, 48);
  if (file.size < 120_000) score += 10;
  if (file.size > 500_000) score -= 80;
  if (isEntrypointFile(file)) score += 45;
  if (/readme|package\.json|go\.mod|cargo\.toml|pyproject|requirements|docker-compose|schema\.prisma/.test(lower)) score += 45;
  if (/routes?|api|controllers?|handlers?/.test(lower)) score += 35;
  if (/services?|usecases?|domain|auth|middleware/.test(lower)) score += 30;
  if (/models?|schema|repositories?|dao|database|db/.test(lower)) score += 25;
  if (/test|spec|stories|mock|fixture/.test(lower)) score -= 20;

  return score;
}

function isEntrypointFile(file) {
  const lower = file.path.toLowerCase();
  const base = path.posix.basename(lower);
  return file.priority === 'P0'
    || /(^|\/)(main|index|server|app|cli|pfo)\.(ts|tsx|js|jsx|mjs|cjs|py|go|java)$/i.test(lower)
    || /routes?|api|controllers?|handlers?|pages|workers?|jobs?|consumers?/.test(lower)
    || ['package.json', 'docker-compose.yml', 'docker-compose.yaml'].includes(base);
}

function toRepoMapFile(file) {
  return {
    path: file.path,
    role: file.role,
    priority: file.priority,
    language: file.language,
    size: file.size,
    importance: file.importance,
    symbols: (file.symbols || []).slice(0, MAX_SYMBOLS_PER_FILE).map((symbol) => ({
      name: symbol.name,
      kind: symbol.kind,
      startLine: symbol.startLine,
      endLine: symbol.endLine,
      signature: symbol.signature
    }))
  };
}

function buildModuleMap(files) {
  const buckets = new Map();
  for (const file of files) {
    const parts = file.path.split('/');
    const key = parts.length > 1 ? parts.slice(0, Math.min(2, parts.length - 1)).join('/') : '.';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(file);
  }

  return [...buckets.entries()]
    .map(([name, moduleFiles]) => ({
      name,
      fileCount: moduleFiles.length,
      symbolCount: moduleFiles.reduce((sum, file) => sum + (file.symbols?.length || 0), 0),
      priority: highestPriority(moduleFiles),
      topFiles: moduleFiles.slice(0, 8).map((file) => file.path),
      roles: [...new Set(moduleFiles.map((file) => file.role))].slice(0, 4)
    }))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.symbolCount - a.symbolCount)
    .slice(0, 40);
}

function highestPriority(files) {
  return files.map((file) => file.priority).sort((a, b) => priorityRank(a) - priorityRank(b))[0] || 'P3';
}

function priorityRank(priority) {
  return ({ P0: 0, P1: 1, P2: 2, P3: 3 })[priority] ?? 9;
}
