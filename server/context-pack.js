import { readTextFileSafe } from './fs-utils.js';
import { countTokens, estimateTokenCount } from './token-counter.js';
import { scoreRepoFile } from './repo-map.js';

const DEFAULT_MAX_CHARS = 60_000;
const MAX_CHARS_PER_FILE = 12_000;
const CONTEXT_MODES = new Set(['overview', 'module', 'flow', 'risk', 'question']);
const SENSITIVE_PATH_PATTERN = /(^|\/)\.env($|[./])|(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519)$|\.(pem|p12|pfx|key)$/i;
const SECRET_PATTERNS = [
  { kind: 'private_key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { kind: 'aws_access_key_id', pattern: /\bA(?:KIA|SIA)[A-Z0-9]{16}\b/ },
  { kind: 'github_token', pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/ },
  { kind: 'slack_token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { kind: 'jwt', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { kind: 'credential_assignment', pattern: /(?:api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{16,}/i }
];

export async function buildContextPack({ root, scan, mode = 'overview', target = {}, maxChars = DEFAULT_MAX_CHARS, codeGraph = null }) {
  const contextMode = normalizeMode(mode);
  const graphContext = buildGraphContext(codeGraph, target, contextMode);
  const selected = selectContextFiles(scan, { mode: contextMode, target, maxChars, graphContext });
  const chunks = [];
  const skippedFiles = [];
  let usedChars = 0;

  for (const file of selected) {
    const remaining = maxChars - usedChars;
    if (remaining <= 0) break;
    const pathFinding = detectSecretRisk({ path: file.path, content: '' });
    if (pathFinding) {
      skippedFiles.push({ path: file.path, reason: pathFinding.reason, kind: pathFinding.kind });
      continue;
    }
    const limit = Math.min(MAX_CHARS_PER_FILE, remaining);
    const read = await readContextFile(root, file.path, limit);
    const contentFinding = detectSecretRisk({ path: file.path, content: read.content });
    if (contentFinding) {
      skippedFiles.push({ path: file.path, reason: contentFinding.reason, kind: contentFinding.kind });
      continue;
    }
    usedChars += read.content.length;
    const tokenCount = await countTokens(read.content);
    chunks.push({
      path: file.path,
      role: file.role,
      priority: file.priority,
      language: file.language,
      score: file.contextScore,
      mode: contextMode,
      symbols: file.symbols || [],
      content: read.content,
      estimatedTokens: tokenCount.tokens,
      tokenCount,
      truncated: read.truncated
    });
  }

  const combinedTokenCount = await countTokens(chunks.map((chunk) => chunk.content).join('\n'));
  const maxTokenCount = await countTokens('x'.repeat(maxChars));

  return {
    generatedAt: new Date().toISOString(),
    mode: contextMode,
    target,
    budget: {
      maxChars,
      usedChars,
      estimatedTokens: combinedTokenCount.tokens,
      maxEstimatedTokens: maxTokenCount.tokens,
      tokenPrecision: combinedTokenCount.precision,
      tokenizer: combinedTokenCount.tokenizer,
      tokenWarnings: [...combinedTokenCount.warnings, ...maxTokenCount.warnings]
    },
    files: chunks.map(({ content, ...file }) => ({ ...file, charCount: content.length })),
    skippedFiles,
    chunks,
    graphContext,
    markdown: buildContextMarkdown(scan, chunks, { maxChars, usedChars }, { mode: contextMode, target, graphContext, skippedFiles })
  };
}

export { estimateTokenCount } from './token-counter.js';

export function detectSecretRisk({ path, content }) {
  if (SENSITIVE_PATH_PATTERN.test(path)) return { kind: 'sensitive_path', reason: 'Sensitive file path.' };
  for (const item of SECRET_PATTERNS) {
    if (item.pattern.test(content || '')) return { kind: item.kind, reason: 'Sensitive content pattern.' };
  }
  return null;
}

async function readContextFile(root, path, limit) {
  try {
    return await readTextFileSafe(root, path, limit);
  } catch (error) {
    throw new Error(`Failed to read context file ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function selectContextFiles(scan, options = DEFAULT_MAX_CHARS) {
  const { mode, target, maxChars, graphContext } = normalizeSelectOptions(options);
  const reserve = 8_000;
  let estimated = 0;
  const candidates = scan.files
    .filter((file) => file.text && file.size < 600_000)
    .map((file) => ({ ...file, contextScore: scoreContextFile(file, mode, target, graphContext) }))
    .sort((a, b) => b.contextScore - a.contextScore || a.path.localeCompare(b.path));

  const selected = [];
  for (const file of candidates) {
    const estimatedSize = Math.min(file.size, MAX_CHARS_PER_FILE);
    if (selected.length && estimated + estimatedSize > maxChars - reserve) continue;
    selected.push(file);
    estimated += estimatedSize;
    if (estimated >= maxChars - reserve) break;
  }
  return selected;
}

function normalizeSelectOptions(options) {
  if (typeof options === 'number') {
    return { mode: 'overview', target: {}, maxChars: options };
  }
  return {
    mode: normalizeMode(options.mode),
    target: options.target || {},
    maxChars: normalizeMaxChars(options.maxChars),
    graphContext: options.graphContext || { pathScores: new Map(), warnings: [], relatedPaths: [] }
  };
}

function normalizeMode(mode) {
  const value = mode ?? 'overview';
  if (!CONTEXT_MODES.has(value)) {
    throw new Error(`Invalid context pack mode: ${value}`);
  }
  return value;
}

function normalizeMaxChars(maxChars) {
  if (maxChars === undefined || maxChars === null) return DEFAULT_MAX_CHARS;
  const value = Number(maxChars);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid context pack maxChars: ${maxChars}`);
  }
  return value;
}

function scoreContextFile(file, mode = 'overview', target = {}, graphContext = { pathScores: new Map() }) {
  let score = scoreRepoFile(file);
  const lower = file.path.toLowerCase();
  const targetTerms = extractTargetTerms(target);

  if (/readme|package\.json|tsconfig|vite\.config|next\.config|nuxt\.config/.test(lower)) score += mode === 'overview' ? 70 : 30;
  if (/routes?|api|controllers?|handlers?|server|app|main|index|cli|bin\//.test(lower)) score += mode === 'overview' || mode === 'flow' ? 45 : 25;
  if (/services?|usecases?|domain|auth|middleware/.test(lower)) score += mode === 'module' || mode === 'flow' || mode === 'risk' ? 45 : 35;
  if (/models?|schema|repositories?|dao|database|db/.test(lower)) score += mode === 'module' || mode === 'flow' ? 40 : 30;
  if (/docs?\//.test(lower)) score -= mode === 'overview' ? 10 : 25;
  if (/test|spec|stories|mock|fixture/.test(lower)) score += mode === 'risk' || mode === 'question' ? 10 : -35;

  if (mode === 'module') score += scoreModuleContext(lower, targetTerms);
  if (mode === 'flow') score += scoreFlowContext(lower, targetTerms);
  if (mode === 'risk') score += scoreRiskContext(lower, targetTerms);
  if (mode === 'question') score += scoreQuestionContext(lower, targetTerms);
  score += graphContext.pathScores?.get(file.path) || 0;

  return score;
}

function scoreModuleContext(lower, targetTerms) {
  let score = 0;
  if (/services?|usecases?|domain|models?|schema|repositories?/.test(lower)) score += 30;
  if (matchesTarget(lower, targetTerms)) score += 80;
  return score;
}

function scoreFlowContext(lower, targetTerms) {
  let score = 0;
  if (/routes?|api|controllers?|handlers?|services?|repositories?|models?/.test(lower)) score += 35;
  if (matchesTarget(lower, targetTerms)) score += 90;
  return score;
}

function scoreRiskContext(lower, targetTerms) {
  let score = 0;
  if (/auth|permission|middleware|config|env|cache|queue|lock|transaction|database|db/.test(lower)) score += 35;
  if (/test|spec/.test(lower)) score += 25;
  if (matchesTarget(lower, targetTerms)) score += 90;
  return score;
}

function scoreQuestionContext(lower, targetTerms) {
  let score = 0;
  if (/readme|docs?\//.test(lower)) score += 10;
  if (matchesTarget(lower, targetTerms)) score += 100;
  return score;
}

export function buildGraphContext(codeGraph, target = {}, mode = 'overview') {
  const pathScores = new Map();
  const graph = codeGraph || { nodes: [], edges: [], warnings: [] };
  const targetTerms = extractTargetTerms(target);
  const targetPaths = extractTargetPaths(target);
  const targetNodeIds = new Set();
  for (const node of graph.nodes || []) {
    const nameHit = targetTerms.some((term) => `${node.name} ${node.path || ''}`.toLowerCase().includes(term));
    const pathHit = node.path && targetPaths.has(node.path);
    if (nameHit || pathHit) targetNodeIds.add(node.id);
  }
  for (const node of graph.nodes || []) {
    if (targetPaths.has(node.path)) addGraphScore(pathScores, node.path, 140);
  }
  for (const edge of graph.edges || []) {
    const sourceHit = targetNodeIds.has(edge.source);
    const targetHit = targetNodeIds.has(edge.target);
    if (!sourceHit && !targetHit) continue;
    const relatedId = sourceHit ? edge.target : edge.source;
    const related = graph.nodes.find((node) => node.id === relatedId);
    if (related?.path) addGraphScore(pathScores, related.path, edge.type === 'calls' ? 120 : 85);
  }
  if (mode === 'risk' || mode === 'question') {
    for (const warning of graph.warnings || []) addGraphScore(pathScores, warning.path, 35);
  }
  const relatedPaths = Array.from(pathScores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([path, score]) => ({ path, score }));
  return { pathScores, relatedPaths, warnings: (graph.warnings || []).slice(0, 40) };
}

function addGraphScore(scores, path, value) {
  if (!path) return;
  scores.set(path, (scores.get(path) || 0) + value);
}

function extractTargetPaths(target) {
  const values = [];
  collectTargetValues(target, values);
  return new Set(values.map((value) => String(value)).filter((value) => /[\\/]|\.[a-z0-9]+$/i.test(value)));
}

function extractTargetTerms(target) {
  const values = [];
  collectTargetValues(target, values);
  return values
    .map((value) => String(value).toLowerCase().trim())
    .filter((value) => value.length >= 2)
    .flatMap((value) => splitTargetTerm(value));
}

function collectTargetValues(value, values) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectTargetValues(item, values));
    return;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach((item) => collectTargetValues(item, values));
    return;
  }
  values.push(value);
}

function splitTargetTerm(value) {
  return Array.from(new Set([value, ...value.split(/[^a-z0-9\u4e00-\u9fa5]+/).filter((part) => part.length >= 2)]));
}

function matchesTarget(lowerPath, targetTerms) {
  return targetTerms.some((term) => lowerPath.includes(term));
}

function buildContextMarkdown(scan, chunks, budget, metadata) {
  const lines = [
    '# Project Context Pack',
    '',
    `Generated At: ${new Date().toISOString()}`,
    `Project Root: ${scan.root}`,
    `Mode: ${metadata.mode}`,
    `Target: ${JSON.stringify(metadata.target || {})}`,
    `Files: ${scan.totalFiles}`,
    `Symbols: ${scan.totalSymbols || 0}`,
    `Budget: ${budget.usedChars}/${budget.maxChars} chars`,
    `Graph Related Files: ${(metadata.graphContext?.relatedPaths || []).length}`,
    `Skipped Files: ${(metadata.skippedFiles || []).length}`,
    '',
    '## Repo Map',
    '',
    '```json',
    JSON.stringify(scan.repoMap || {}, null, 2),
    '```',
    '',
    '## Graph Context',
    '',
    '```json',
    JSON.stringify({ relatedPaths: metadata.graphContext?.relatedPaths || [], warnings: metadata.graphContext?.warnings || [] }, null, 2),
    '```',
    '',
    '## Selected Files',
    ''
  ];

  const skippedFiles = metadata.skippedFiles || [];
  if (skippedFiles.length) {
    lines.push('## Skipped Files', '');
    for (const file of skippedFiles) lines.push(`- ${file.path}: ${file.reason}`);
    lines.push('');
  }

  for (const chunk of chunks) {
    lines.push(
      `### ${chunk.path}`,
      '',
      `Role: ${chunk.role}`,
      `Priority: ${chunk.priority}`,
      `Language: ${chunk.language}`,
      `Mode: ${chunk.mode}`,
      `Symbols: ${(chunk.symbols || []).slice(0, 16).map((symbol) => `${symbol.kind} ${symbol.name} L${symbol.startLine}-${symbol.endLine}`).join(', ') || '-'}`,
      '',
      '```text',
      chunk.content,
      '```',
      ''
    );
  }

  return lines.join('\n');
}
