import { readTextFileSafe } from './fs-utils.js';
import { scoreRepoFile } from './repo-map.js';

const DEFAULT_MAX_CHARS = 120_000;
const MAX_CHARS_PER_FILE = 28_000;
const CONTEXT_MODES = new Set(['overview', 'module', 'flow', 'risk', 'question']);

export async function buildContextPack({ root, scan, mode = 'overview', target = {}, maxChars = DEFAULT_MAX_CHARS }) {
  const contextMode = normalizeMode(mode);
  const selected = selectContextFiles(scan, { mode: contextMode, target, maxChars });
  const chunks = [];
  const skippedFiles = [];
  let usedChars = 0;

  for (const file of selected) {
    const remaining = maxChars - usedChars;
    if (remaining <= 0) break;
    const limit = Math.min(MAX_CHARS_PER_FILE, remaining);
    try {
      const read = await readTextFileSafe(root, file.path, limit);
      usedChars += read.content.length;
      chunks.push({
        path: file.path,
        role: file.role,
        priority: file.priority,
        language: file.language,
        score: file.contextScore,
        mode: contextMode,
        symbols: file.symbols || [],
        content: read.content,
        truncated: read.truncated
      });
    } catch (error) {
      skippedFiles.push({ path: file.path, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: contextMode,
    target,
    budget: { maxChars, usedChars },
    skippedFiles,
    files: chunks.map(({ content, ...file }) => ({ ...file, charCount: content.length })),
    chunks,
    markdown: buildContextMarkdown(scan, chunks, { maxChars, usedChars }, { mode: contextMode, target, skippedFiles })
  };
}

export function selectContextFiles(scan, options = DEFAULT_MAX_CHARS) {
  const { mode, target, maxChars } = normalizeSelectOptions(options);
  const reserve = 8_000;
  let estimated = 0;
  const candidates = scan.files
    .filter((file) => file.text && file.size < 600_000)
    .map((file) => ({ ...file, contextScore: scoreContextFile(file, mode, target) }))
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
    maxChars: Number(options.maxChars) || DEFAULT_MAX_CHARS
  };
}

function normalizeMode(mode) {
  return CONTEXT_MODES.has(mode) ? mode : 'overview';
}

function scoreContextFile(file, mode = 'overview', target = {}) {
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
    '',
    '## Repo Map',
    '',
    '```json',
    JSON.stringify(scan.repoMap || {}, null, 2),
    '```',
    '',
    '## Selected Files',
    ''
  ];

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

  if (metadata.skippedFiles.length) {
    lines.push('## Skipped Files', '');
    for (const file of metadata.skippedFiles) {
      lines.push(`- ${file.path}: ${file.reason}`);
    }
  }

  return lines.join('\n');
}
