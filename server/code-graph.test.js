import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCodeGraph, findShortestPath } from './code-graph.js';
import { extractSymbols } from './symbol-indexer.js';

async function createFixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codemap-ai-graph-'));
  const scanFiles = [];
  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, 'utf8');
    const language = relPath.endsWith('.ts') || relPath.endsWith('.tsx') ? 'typescript' : 'javascript';
    scanFiles.push({
      path: relPath.replaceAll('\\', '/'),
      type: 'file',
      text: true,
      size: Buffer.byteLength(content),
      language,
      role: '代码文件',
      priority: 'P1',
      symbols: extractSymbols({ path: relPath.replaceAll('\\', '/'), language, content })
    });
  }
  return { root, scan: { files: scanFiles } };
}

test('buildCodeGraph extracts file, symbol, import and call edges', async () => {
  const fixture = await createFixture({
    'src/index.ts': "import { runOrder } from './order';\nexport function start() {\n  runOrder();\n}\n",
    'src/order.ts': "export function runOrder() {\n  persistOrder();\n}\nexport function persistOrder() {\n  return true;\n}\n"
  });

  const graph = await buildCodeGraph(fixture);

  assert.ok(graph.nodes.some((node) => node.id === 'file:src/index.ts'));
  assert.ok(graph.nodes.some((node) => node.name === 'start' && node.type === 'function'));
  assert.ok(graph.edges.some((edge) => edge.source === 'file:src/index.ts' && edge.target === 'file:src/order.ts' && edge.type === 'imports' && edge.confidence === 'fact'));
  assert.ok(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes(':runOrder') && edge.confidence === 'guess'));
  assert.ok(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':runOrder') && edge.target.includes(':persistOrder') && edge.confidence === 'fact'));
});

test('buildCodeGraph preserves type and constant symbol node kinds', async () => {
  const fixture = await createFixture({
    'src/model.ts': "export type UserId = string;\nexport const ORDER_KIND = 'online';\n"
  });

  const graph = await buildCodeGraph(fixture);

  assert.ok(graph.nodes.some((node) => node.name === 'UserId' && node.type === 'type'));
  assert.ok(graph.nodes.some((node) => node.name === 'ORDER_KIND' && node.type === 'constant'));
});

test('findShortestPath returns an undirected connection path', () => {
  const graph = {
    edges: [
      { source: 'a', target: 'b', type: 'imports' },
      { source: 'b', target: 'c', type: 'calls' }
    ]
  };

  const pathItems = findShortestPath(graph, 'c', 'a');

  assert.equal(pathItems.length, 2);
  assert.equal(pathItems[0].from, 'c');
  assert.equal(pathItems[1].to, 'a');
});
