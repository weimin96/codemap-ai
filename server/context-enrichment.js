import { readTextFileSafe } from './fs-utils.js';

export async function enrichContext(root, context) {
  const next = { ...context };
  const pathCandidates = [context.currentFile?.path, context.filePath, context.path].filter(Boolean);
  if (pathCandidates.length) {
    const rel = pathCandidates[0];
    try {
      const file = await readTextFileSafe(root, rel, 80_000);
      next.currentFile = { ...(context.currentFile || {}), path: rel, content: file.content, truncated: file.truncated };
      const lines = file.content.split(/\r?\n/);
      if (context.selection?.startLine && context.selection?.endLine) {
        const start = Math.max(1, Number(context.selection.startLine));
        const end = Math.max(start, Number(context.selection.endLine));
        next.selectedCode = lines.slice(start - 1, end).join('\n');
      }
      if (context.currentSymbol?.startLine && context.currentSymbol?.endLine) {
        const start = Math.max(1, Number(context.currentSymbol.startLine));
        const end = Math.max(start, Number(context.currentSymbol.endLine));
        next.currentSymbol = context.currentSymbol;
        next.symbolCode = lines.slice(start - 1, end).join('\n');
      }
    } catch {
      // skip unreadable context file
    }
  }

  if (Array.isArray(context.activeFlow?.steps)) {
    next.flowStepSnippets = await readFlowStepSnippets(root, context.activeFlow.steps);
  }
  return next;
}

async function readFlowStepSnippets(root, steps) {
  const snippets = [];
  for (const step of steps.slice(0, 8)) {
    if (!step.path) continue;
    try {
      const file = await readTextFileSafe(root, step.path, 80_000);
      const lines = file.content.split(/\r?\n/);
      const start = Math.max(1, Number(step.startLine) || 1);
      const end = Math.max(start, Number(step.endLine) || start);
      const paddedStart = Math.max(1, start - 4);
      const paddedEnd = Math.min(lines.length, end + 6);
      snippets.push({
        order: step.order,
        path: step.path,
        symbol: step.symbol || '',
        startLine: paddedStart,
        endLine: paddedEnd,
        code: lines.slice(paddedStart - 1, paddedEnd).join('\n')
      });
    } catch {
      snippets.push({ order: step.order, path: step.path, error: '无法读取链路步骤文件' });
    }
  }
  return snippets;
}
