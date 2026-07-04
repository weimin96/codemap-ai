import path from 'node:path';
import { readTextFileSafe, toPosix } from './fs-utils.js';

const GRAPH_LANGUAGES = new Set(['javascript', 'typescript']);
const GRAPH_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const CONTROL_CALLS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'throw', 'new', 'class', 'typeof', 'await']);
const MAX_GRAPH_FILE_BYTES = 260_000;
const MAX_WARNINGS = 200;

export async function buildCodeGraph({ root, scan }) {
  const files = (scan.files || []).filter((file) => file.type === 'file');
  const graphFiles = files.filter((file) => file.text && GRAPH_LANGUAGES.has(file.language));
  const filePathSet = new Set(files.map((file) => file.path));
  const nodes = [];
  const edges = [];
  const warnings = [];
  const seenNodes = new Set();
  const seenEdges = new Set();
  const symbolById = new Map();
  const symbolsByName = new Map();

  for (const file of files) addDirectoryChain(file.path, nodes, edges, seenNodes, seenEdges);

  for (const file of files) {
    addNode(nodes, seenNodes, fileNode(file.path));
    const directory = parentDirectory(file.path);
    if (directory) addEdge(edges, seenEdges, directoryId(directory), fileId(file.path), 'contains');
    for (const symbol of file.symbols || []) {
      const node = symbolNode(symbol);
      addNode(nodes, seenNodes, node);
      addEdge(edges, seenEdges, fileId(file.path), node.id, 'defines');
      symbolById.set(node.id, node);
      const list = symbolsByName.get(symbol.name) || [];
      list.push(node);
      symbolsByName.set(symbol.name, list);
    }
  }

  for (const file of graphFiles) {
    if (file.size > MAX_GRAPH_FILE_BYTES) {
      pushWarning(warnings, { path: file.path, kind: 'skipped_file', message: '文件超过代码图谱解析大小限制' });
      continue;
    }
    const read = await readGraphFile(root, file.path);
    const imports = extractImports(read.content);
    for (const item of imports) {
      const targetPath = resolveImportPath(file.path, item.specifier, filePathSet);
      if (!targetPath) {
        pushWarning(warnings, { path: file.path, kind: 'unresolved_import', message: `无法解析导入：${item.specifier}` });
        continue;
      }
      addEdge(edges, seenEdges, fileId(file.path), fileId(targetPath), 'imports', item.line);
    }

    const fileSymbols = file.symbols || [];
    for (const symbol of fileSymbols) {
      const source = symbolById.get(symbol.id);
      if (!source) continue;
      const body = sliceLines(read.content, symbol.startLine, symbol.endLine);
      for (const call of extractCalls(body, symbol.startLine)) {
        const target = resolveCallTarget(call.name, file.path, symbol.id, symbolById, symbolsByName);
        if (!target) {
          pushWarning(warnings, { path: file.path, kind: 'unresolved_call', message: `无法解析调用：${call.name}` });
          continue;
        }
        addEdge(edges, seenEdges, source.id, target.id, 'calls', call.line);
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    languageScope: ['javascript', 'typescript'],
    totals: {
      nodes: nodes.length,
      edges: edges.length,
      files: graphFiles.length,
      warnings: warnings.length
    },
    nodes,
    edges,
    warnings
  };
}

export function findShortestPath(graph, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return [];
  const adjacency = new Map();
  for (const edge of graph.edges || []) {
    addAdjacent(adjacency, edge.source, { nodeId: edge.target, edge });
    addAdjacent(adjacency, edge.target, { nodeId: edge.source, edge });
  }
  const queue = [sourceId];
  const visited = new Set([sourceId]);
  const previous = new Map();
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current) || []) {
      if (visited.has(next.nodeId)) continue;
      visited.add(next.nodeId);
      previous.set(next.nodeId, { nodeId: current, edge: next.edge });
      if (next.nodeId === targetId) return rebuildPath(previous, sourceId, targetId);
      queue.push(next.nodeId);
    }
  }
  return [];
}

export function pickGraphFocus(graph) {
  const callable = (graph.nodes || []).filter((node) => node.type === 'function' || node.type === 'method');
  const firstCallable = callable[0];
  if (firstCallable) return firstCallable.id;
  return graph.nodes?.[0]?.id || '';
}

function addDirectoryChain(filePath, nodes, edges, seenNodes, seenEdges) {
  const parts = filePath.split('/').slice(0, -1);
  let current = '';
  for (const part of parts) {
    const parent = current;
    current = current ? `${current}/${part}` : part;
    addNode(nodes, seenNodes, directoryNode(current));
    if (parent) addEdge(edges, seenEdges, directoryId(parent), directoryId(current), 'contains');
  }
}

function addNode(nodes, seen, node) {
  if (seen.has(node.id)) return;
  seen.add(node.id);
  nodes.push(node);
}

function addEdge(edges, seen, source, target, type, line) {
  if (!source || !target || source === target) return;
  const key = `${source}|${target}|${type}|${line || ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  edges.push({ source, target, type, line });
}

function fileNode(filePath) {
  return { id: fileId(filePath), type: 'file', name: path.posix.basename(filePath), path: filePath };
}

function directoryNode(directoryPath) {
  return { id: directoryId(directoryPath), type: 'directory', name: path.posix.basename(directoryPath), path: directoryPath };
}

function symbolNode(symbol) {
  return {
    id: symbol.id,
    type: symbol.kind === 'type' || symbol.kind === 'constant' ? 'function' : symbol.kind,
    name: symbol.name,
    path: symbol.path,
    startLine: symbol.startLine,
    endLine: symbol.endLine
  };
}

function fileId(filePath) {
  return `file:${filePath}`;
}

function directoryId(directoryPath) {
  return `dir:${directoryPath}`;
}

function parentDirectory(filePath) {
  const directory = path.posix.dirname(filePath);
  return directory === '.' ? '' : directory;
}

async function readGraphFile(root, relPath) {
  try {
    return await readTextFileSafe(root, relPath, MAX_GRAPH_FILE_BYTES);
  } catch (error) {
    throw new Error(`Failed to read graph file ${relPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function extractImports(content) {
  const imports = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = stripLineComment(lines[index]);
    const importMatch = line.match(/\bimport\s+(?:type\s+)?(?:[^'\"]+?\s+from\s+)?['\"]([^'\"]+)['\"]/);
    const exportMatch = line.match(/\bexport\s+[^'\"]*\s+from\s+['\"]([^'\"]+)['\"]/);
    const requireMatch = line.match(/\brequire\(\s*['\"]([^'\"]+)['\"]\s*\)/);
    const dynamicMatch = line.match(/\bimport\(\s*['\"]([^'\"]+)['\"]\s*\)/);
    const specifier = importMatch?.[1] || exportMatch?.[1] || requireMatch?.[1] || dynamicMatch?.[1];
    if (specifier) imports.push({ specifier, line: index + 1 });
  }
  return imports;
}

function resolveImportPath(fromPath, specifier, filePathSet) {
  if (!specifier.startsWith('.')) return '';
  const baseDir = path.posix.dirname(fromPath);
  const joined = toPosix(path.posix.normalize(path.posix.join(baseDir, specifier)));
  const candidates = [joined, ...GRAPH_EXTENSIONS.map((ext) => `${joined}${ext}`), ...GRAPH_EXTENSIONS.map((ext) => `${joined}/index${ext}`)];
  return candidates.find((candidate) => filePathSet.has(candidate)) || '';
}

function extractCalls(content, offsetLine) {
  const calls = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = stripStrings(stripLineComment(lines[index]));
    const regex = /(?<![\w$\.])([A-Za-z_$][\w$]*)\s*\(/g;
    let match;
    while ((match = regex.exec(line))) {
      const name = match[1];
      if (!CONTROL_CALLS.has(name)) calls.push({ name, line: offsetLine + index });
    }
  }
  return calls;
}

function resolveCallTarget(name, fromPath, sourceId, symbolById, symbolsByName) {
  const candidates = symbolsByName.get(name) || [];
  const local = candidates.find((node) => node.path === fromPath && node.id !== sourceId);
  if (local) return local;
  const nonSelf = candidates.filter((node) => node.id !== sourceId);
  return nonSelf.length === 1 ? nonSelf[0] : null;
}

function sliceLines(content, startLine, endLine) {
  const lines = content.split(/\r?\n/);
  return lines.slice(Math.max(0, startLine - 1), Math.max(startLine, endLine)).join('\n');
}

function stripLineComment(line) {
  const index = line.indexOf('//');
  return index === -1 ? line : line.slice(0, index);
}

function stripStrings(line) {
  return line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '');
}

function pushWarning(warnings, warning) {
  if (warnings.length >= MAX_WARNINGS) return;
  warnings.push(warning);
}

function addAdjacent(adjacency, source, target) {
  const list = adjacency.get(source) || [];
  list.push(target);
  adjacency.set(source, list);
}

function rebuildPath(previous, sourceId, targetId) {
  const pathItems = [];
  let current = targetId;
  while (current !== sourceId) {
    const item = previous.get(current);
    if (!item) return [];
    pathItems.unshift({ from: item.nodeId, to: current, edge: item.edge });
    current = item.nodeId;
  }
  return pathItems;
}
