import { readTextFileSafe } from './fs-utils.js';
import { isSensitivePath, redactAiContext, redactSensitiveText } from './redaction.js';

export async function enrichContext(root, context, codeGraph = null) {
  const next = { ...context };
  const pathCandidates = [context.currentFile?.path, context.filePath, context.path].filter(Boolean);
  if (pathCandidates.length) {
    const rel = pathCandidates[0];
    const file = await readContextFile(root, rel, 'current file');
    const redactionWarnings = [];
    const safeContent = redactContextContent(rel, file.content, redactionWarnings);
    next.currentFile = { ...(context.currentFile || {}), path: rel, content: safeContent, truncated: file.truncated || isSensitivePath(rel) };
    const lines = safeContent.split(/\r?\n/);
    if (redactionWarnings.length) next.redactionWarnings = [...(Array.isArray(next.redactionWarnings) ? next.redactionWarnings : []), ...redactionWarnings];
    if (context.selection?.startLine && context.selection?.endLine) {
      const start = Math.max(1, Number(context.selection.startLine));
      const end = Math.max(start, Number(context.selection.endLine));
      next.selectedCode = redactSensitiveText(lines.slice(start - 1, end).join('\n'), next.redactionWarnings || [], 'selectedCode');
    }
    if (context.currentSymbol?.startLine && context.currentSymbol?.endLine) {
      const start = Math.max(1, Number(context.currentSymbol.startLine));
      const end = Math.max(start, Number(context.currentSymbol.endLine));
      next.currentSymbol = context.currentSymbol;
      next.symbolCode = redactSensitiveText(lines.slice(start - 1, end).join('\n'), next.redactionWarnings || [], 'symbolCode');
    }
  }

  if (codeGraph) next.graphNeighbors = graphNeighborsForContext(codeGraph, context);

  if (Array.isArray(context.activeFlow?.steps)) {
    next.flowStepSnippets = await readFlowStepSnippets(root, context.activeFlow.steps);
  }
  return redactAiContext(next);
}

function graphNeighborsForContext(graph, context) {
  const path = context.currentFile?.path || context.filePath || context.path || '';
  const symbolId = context.currentSymbol?.id || '';
  const nodes = graph.nodes || [];
  const seedIds = new Set(nodes.filter((node) => node.id === symbolId || (path && node.path === path)).map((node) => node.id));
  const neighbors = [];
  for (const edge of graph.edges || []) {
    if (!seedIds.has(edge.source) && !seedIds.has(edge.target)) continue;
    const relatedId = seedIds.has(edge.source) ? edge.target : edge.source;
    const related = nodes.find((node) => node.id === relatedId);
    if (related) neighbors.push({ edgeType: edge.type, direction: seedIds.has(edge.source) ? 'out' : 'in', node: related });
  }
  return neighbors.slice(0, 30);
}

async function readFlowStepSnippets(root, steps) {
  const snippets = [];
  for (const step of steps.slice(0, 8)) {
    if (!step.path) continue;
    const file = await readContextFile(root, step.path, `flow step ${step.order}`);
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
      code: redactContextContent(step.path, lines.slice(paddedStart - 1, paddedEnd).join('\n'), [])
    });
  }
  return snippets;
}

async function readContextFile(root, path, label) {
  try {
    return await readTextFileSafe(root, path, 80_000);
  } catch (error) {
    throw new Error(`Failed to enrich ${label} from ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function redactContextContent(path, content, warnings) {
  if (isSensitivePath(path)) {
    warnings.push(`${path}: sensitive_path`);
    return '[REDACTED:sensitive_path]';
  }
  return redactSensitiveText(content, warnings, path);
}
