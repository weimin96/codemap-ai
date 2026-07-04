import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { readTextFileSafe, toPosix } from './fs-utils.js';

const GRAPH_LANGUAGES = new Set(['javascript', 'typescript']);
const GRAPH_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const IMPORT_EXTENSIONS = [...GRAPH_EXTENSIONS, '.json', '.css', '.scss', '.sass', '.less', '.vue', '.svelte'];
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
  const importResolver = await buildImportResolver(root, filePathSet);
  const importBindingsByFile = new Map();

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
    const sourceFile = parseSourceFile(file.path, read.content, warnings);
    if (!sourceFile) continue;
    const imports = extractImports(sourceFile);
    const importBindings = new Map();
    const namespaceImports = new Map();
    for (const item of imports) {
      const targetPath = importResolver(file.path, item.specifier);
      if (!targetPath) {
        pushWarning(warnings, { path: file.path, kind: 'unresolved_import', message: `无法解析导入：${item.specifier}` });
        continue;
      }
      addEdge(edges, seenEdges, fileId(file.path), fileId(targetPath), 'imports', item.line);
      for (const binding of item.bindings || []) {
        importBindings.set(binding.localName, { targetPath, importedName: binding.importedName });
      }
      for (const namespace of item.namespaces || []) namespaceImports.set(namespace.localName, targetPath);
    }

    importBindingsByFile.set(file.path, { named: importBindings, namespaces: namespaceImports });

    const fileSymbols = file.symbols || [];
    for (const symbol of fileSymbols) {
      const source = symbolById.get(symbol.id);
      if (!source) continue;
      for (const call of extractCalls(sourceFile, symbol.startLine, symbol.endLine)) {
        const target = resolveCallTarget(call, file.path, symbol.id, symbolById, symbolsByName, importBindingsByFile.get(file.path));
        if (!target) {
          pushWarning(warnings, { path: file.path, kind: 'unresolved_call', message: `无法解析调用：${call.name}` });
          continue;
        }
        addEdge(edges, seenEdges, source.id, target.node.id, 'calls', call.line, target.confidence);
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

function addEdge(edges, seen, source, target, type, line, confidence = 'fact') {
  if (!source || !target || source === target) return;
  const key = `${source}|${target}|${type}|${line || ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  edges.push({ source, target, type, line, confidence });
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
    type: symbol.kind,
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

function parseSourceFile(filePath, content, warnings) {
  const kind = scriptKindForPath(filePath);
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, kind);
  for (const diagnostic of sourceFile.parseDiagnostics || []) {
    pushWarning(warnings, {
      path: filePath,
      kind: 'parse_error',
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')
    });
  }
  return sourceFile;
}

function scriptKindForPath(filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (filePath.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function extractImports(sourceFile) {
  const imports = [];
  walk(sourceFile, (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push({ specifier: node.moduleSpecifier.text, line: nodeLine(sourceFile, node), bindings: extractImportBindings(node), namespaces: extractNamespaceImports(node) });
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push({ specifier: node.moduleSpecifier.text, line: nodeLine(sourceFile, node), bindings: [] });
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const [first] = node.arguments;
        if (first && ts.isStringLiteral(first)) imports.push({ specifier: first.text, line: nodeLine(sourceFile, node) });
      }
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const [first] = node.arguments;
        if (first && ts.isStringLiteral(first)) imports.push({ specifier: first.text, line: nodeLine(sourceFile, node) });
      }
    }
  });
  return imports;
}

function extractImportBindings(node) {
  const clause = node.importClause;
  if (!clause) return [];
  const bindings = [];
  if (clause.name) bindings.push({ localName: clause.name.text, importedName: 'default' });
  const namedBindings = clause.namedBindings;
  if (namedBindings && ts.isNamedImports(namedBindings)) {
    for (const element of namedBindings.elements) {
      bindings.push({
        localName: element.name.text,
        importedName: element.propertyName ? element.propertyName.text : element.name.text
      });
    }
  }
  return bindings;
}

function extractNamespaceImports(node) {
  const namedBindings = node.importClause?.namedBindings;
  if (!namedBindings || !ts.isNamespaceImport(namedBindings)) return [];
  return [{ localName: namedBindings.name.text }];
}

async function buildImportResolver(root, filePathSet) {
  const tsconfig = await readTsconfig(root);
  const workspacePackages = await readWorkspacePackages(root);
  return (fromPath, specifier) => resolveImportPath(fromPath, specifier, filePathSet, tsconfig, workspacePackages);
}

async function readTsconfig(root) {
  try {
    const file = await readTextFileSafe(root, 'tsconfig.json', 80_000);
    const parsed = JSON.parse(file.content);
    const compilerOptions = parsed?.compilerOptions || {};
    return {
      baseUrl: normalizeCompilerPath(compilerOptions.baseUrl || ''),
      paths: compilerOptions.paths && typeof compilerOptions.paths === 'object' ? compilerOptions.paths : {}
    };
  } catch (_error) {
    return { baseUrl: '', paths: {} };
  }
}

function resolveImportPath(fromPath, specifier, filePathSet, tsconfig, workspacePackages = new Map()) {
  if (specifier.startsWith('.')) return resolveFromBase(path.posix.dirname(fromPath), specifier, filePathSet);
  for (const candidate of resolveTsconfigPaths(specifier, tsconfig)) {
    const resolved = resolveFromBase('', candidate, filePathSet);
    if (resolved) return resolved;
  }
  const workspaceResolved = resolveWorkspacePackageImport(specifier, workspacePackages, filePathSet);
  if (workspaceResolved) return workspaceResolved;
  if (tsconfig.baseUrl) return resolveFromBase(tsconfig.baseUrl, specifier, filePathSet);
  return '';
}

async function readWorkspacePackages(root) {
  const packages = new Map();
  try {
    const file = await readTextFileSafe(root, 'package.json', 120_000);
    const rootPackage = JSON.parse(file.content);
    const workspacePatterns = Array.isArray(rootPackage.workspaces)
      ? rootPackage.workspaces
      : Array.isArray(rootPackage.workspaces?.packages) ? rootPackage.workspaces.packages : [];
    for (const pattern of workspacePatterns) {
      if (!String(pattern).endsWith('/*')) continue;
      const workspaceDir = String(pattern).slice(0, -2).replace(/\\/g, '/');
      for (const entry of await safeReadDir(root, workspaceDir)) {
        const packageDir = `${workspaceDir}/${entry}`;
        const packageJson = await readPackageJson(root, `${packageDir}/package.json`);
        if (!packageJson?.name) continue;
        packages.set(packageJson.name, {
          dir: packageDir,
          entry: packageJson.module || packageJson.main || packageJson.types || 'index.ts',
          exports: packageJson.exports
        });
      }
    }
  } catch (_error) {
    return packages;
  }
  return packages;
}

async function safeReadDir(root, relPath) {
  try {
    const entries = await fs.readdir(path.join(root, relPath), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (_error) {
    return [];
  }
}

async function readPackageJson(root, relPath) {
  try {
    const file = await readTextFileSafe(root, relPath, 80_000);
    return JSON.parse(file.content);
  } catch (_error) {
    return null;
  }
}

function resolveWorkspacePackageImport(specifier, workspacePackages, filePathSet) {
  const exact = workspacePackages.get(specifier);
  if (exact) return resolveWorkspacePackageEntry(exact, '.', filePathSet);
  for (const [name, pkg] of workspacePackages) {
    if (!specifier.startsWith(`${name}/`)) continue;
    const subpath = specifier.slice(name.length + 1);
    return resolveWorkspacePackageEntry(pkg, `./${subpath}`, filePathSet) || resolveFromBase(pkg.dir, subpath, filePathSet);
  }
  return '';
}

function resolveWorkspacePackageEntry(pkg, exportKey, filePathSet) {
  const exported = resolvePackageExport(pkg.exports, exportKey);
  if (exported) return resolveFromBase(pkg.dir, stripBuildEntry(exported), filePathSet);
  if (exportKey === '.') return resolveFromBase(pkg.dir, stripBuildEntry(pkg.entry), filePathSet) || resolveFromBase(pkg.dir, 'src/index', filePathSet) || resolveFromBase(pkg.dir, 'index', filePathSet);
  return '';
}

function resolvePackageExport(exportsField, exportKey) {
  if (!exportsField) return '';
  if (typeof exportsField === 'string') return exportKey === '.' ? exportsField : '';
  if (typeof exportsField !== 'object') return '';
  const target = exportsField[exportKey];
  if (typeof target === 'string') return target;
  if (target && typeof target === 'object') {
    return target.import || target.default || target.require || target.types || '';
  }
  return '';
}

function stripBuildEntry(entry) {
  return String(entry || '').replace(/^\.\//, '').replace(/^dist\//, 'src/').replace(/\.[cm]?js$/, '');
}

function resolveTsconfigPaths(specifier, tsconfig) {
  const resolved = [];
  for (const [pattern, targets] of Object.entries(tsconfig.paths || {})) {
    const targetList = Array.isArray(targets) ? targets : [];
    const match = matchPathPattern(pattern, specifier);
    if (match === null) continue;
    for (const target of targetList) {
      const replaced = String(target).replace('*', match);
      resolved.push(toPosix(path.posix.normalize(path.posix.join(tsconfig.baseUrl || '', replaced))));
    }
  }
  return resolved;
}

function matchPathPattern(pattern, specifier) {
  if (!pattern.includes('*')) return pattern === specifier ? '' : null;
  const [prefix, suffix] = pattern.split('*');
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) return null;
  return specifier.slice(prefix.length, specifier.length - suffix.length);
}

function resolveFromBase(baseDir, specifier, filePathSet) {
  const joined = toPosix(path.posix.normalize(path.posix.join(baseDir, specifier)));
  const candidates = [joined, ...IMPORT_EXTENSIONS.map((ext) => `${joined}${ext}`), ...IMPORT_EXTENSIONS.map((ext) => `${joined}/index${ext}`)];
  return candidates.find((candidate) => filePathSet.has(candidate)) || '';
}

function normalizeCompilerPath(value) {
  return toPosix(path.posix.normalize(String(value || '').replace(/\\/g, '/'))).replace(/^\.\//, '');
}

function extractCalls(sourceFile, startLine, endLine) {
  const calls = [];
  walk(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return;
    const line = nodeLine(sourceFile, node);
    if (line < startLine || line > endLine) return;
    const call = callName(node.expression);
    if (call) calls.push({ ...call, line });
  });
  return calls;
}

function callName(expression) {
  if (ts.isIdentifier(expression)) return { name: expression.text };
  if (ts.isPropertyAccessExpression(expression)) {
    return {
      name: expression.name.text,
      receiver: ts.isIdentifier(expression.expression) ? expression.expression.text : ''
    };
  }
  return null;
}

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function nodeLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function resolveCallTarget(call, fromPath, sourceId, symbolById, symbolsByName, importBindings = {}) {
  const name = call.name;
  if (call.receiver && importBindings.namespaces?.has(call.receiver)) {
    const targetPath = importBindings.namespaces.get(call.receiver);
    const namespaceCandidates = (symbolsByName.get(name) || [])
      .filter((node) => node.path === targetPath && node.id !== sourceId);
    if (namespaceCandidates.length === 1) return { node: namespaceCandidates[0], confidence: 'fact' };
  }
  const imported = importBindings.named?.get(name);
  if (imported) {
    const importedCandidates = (symbolsByName.get(imported.importedName) || [])
      .filter((node) => node.path === imported.targetPath && node.id !== sourceId);
    if (importedCandidates.length === 1) return { node: importedCandidates[0], confidence: 'fact' };
  }
  const candidates = symbolsByName.get(name) || [];
  const local = candidates.find((node) => node.path === fromPath && node.id !== sourceId);
  if (local) return { node: local, confidence: 'fact' };
  const nonSelf = candidates.filter((node) => node.id !== sourceId);
  return nonSelf.length === 1 ? { node: nonSelf[0], confidence: 'guess' } : null;
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
