import { readTextFileSafe } from './fs-utils.js';
import { scoreRepoFile } from './repo-map.js';

const DEFAULT_MAX_CHARS = 120_000;
const MAX_CHARS_PER_FILE = 28_000;

export async function buildContextPack({ root, scan, maxChars = DEFAULT_MAX_CHARS }) {
  const selected = selectContextFiles(scan, maxChars);
  const chunks = [];
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
        symbols: file.symbols || [],
        content: read.content,
        truncated: read.truncated
      });
    } catch {
      // skip unreadable files
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    budget: { maxChars, usedChars },
    files: chunks.map(({ content, ...file }) => ({ ...file, charCount: content.length })),
    chunks,
    markdown: buildContextMarkdown(scan, chunks, { maxChars, usedChars })
  };
}

export function selectContextFiles(scan, maxChars = DEFAULT_MAX_CHARS) {
  const reserve = 8_000;
  let estimated = 0;
  const candidates = scan.files
    .filter((file) => file.text && file.size < 600_000)
    .map((file) => ({ ...file, contextScore: scoreContextFile(file) }))
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

function scoreContextFile(file) {
  let score = scoreRepoFile(file);
  const lower = file.path.toLowerCase();

  if (/readme|package\.json|tsconfig|vite\.config|next\.config|nuxt\.config/.test(lower)) score += 60;
  if (/routes?|api|controllers?|handlers?|server|app|main|index|cli|bin\//.test(lower)) score += 45;
  if (/services?|usecases?|domain|auth|middleware/.test(lower)) score += 35;
  if (/models?|schema|repositories?|dao|database|db/.test(lower)) score += 30;
  if (/docs?\//.test(lower)) score -= 20;
  if (/test|spec|stories|mock|fixture/.test(lower)) score -= 35;

  return score;
}

function buildContextMarkdown(scan, chunks, budget) {
  const lines = [
    '# Project Context Pack',
    '',
    `Generated At: ${new Date().toISOString()}`,
    `Project Root: ${scan.root}`,
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
