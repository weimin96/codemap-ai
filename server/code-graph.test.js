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
  assert.ok(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes(':runOrder') && edge.confidence === 'fact'));
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

test('buildCodeGraph resolves aliased named imports to fact call edges', async () => {
  const fixture = await createFixture({
    'src/index.ts': "import { runOrder as run } from './order';\nexport function start() {\n  run();\n}\n",
    'src/order.ts': "export function runOrder() {\n  return true;\n}\n",
    'src/other.ts': "export function runOrder() {\n  return false;\n}\n"
  });

  const graph = await buildCodeGraph(fixture);

  assert.ok(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('src/order.ts') && edge.target.includes(':runOrder') && edge.confidence === 'fact'));
  assert.equal(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('src/other.ts')), false);
});

test('buildCodeGraph resolves named re-exports through barrel files', async () => {
  const fixture = await createFixture({
    'src/index.ts': "import { runOrder } from './barrel';\nexport function start() {\n  runOrder();\n}\n",
    'src/barrel.ts': "export { runOrder } from './order';\n",
    'src/order.ts': "export function runOrder() {\n  return true;\n}\n",
    'src/other.ts': "export function runOrder() {\n  return false;\n}\n"
  });

  const graph = await buildCodeGraph(fixture);

  assert.ok(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('src/order.ts') && edge.target.includes(':runOrder') && edge.confidence === 'fact'));
  assert.equal(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('src/other.ts')), false);
});

test('buildCodeGraph resolves default imports to default export call edges', async () => {
  const fixture = await createFixture({
    'src/index.ts': "import run from './task';\nexport function start() {\n  run();\n}\n",
    'src/task.ts': "export default () => true;\n",
    'src/other.ts': "export function run() {\n  return false;\n}\n"
  });

  const graph = await buildCodeGraph(fixture);

  assert.ok(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('src/task.ts') && edge.target.includes(':default') && edge.confidence === 'fact'));
  assert.equal(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('src/other.ts')), false);
});

test('buildCodeGraph resolves namespace imports to fact call edges', async () => {
  const fixture = await createFixture({
    'src/index.ts': "import * as order from './order';\nexport function start() {\n  order.runOrder();\n}\n",
    'src/order.ts': "export function runOrder() {\n  return true;\n}\n",
    'src/other.ts': "export function runOrder() {\n  return false;\n}\n"
  });

  const graph = await buildCodeGraph(fixture);

  assert.ok(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('src/order.ts') && edge.target.includes(':runOrder') && edge.confidence === 'fact'));
  assert.equal(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('src/other.ts')), false);
});

test('buildCodeGraph resolves monorepo workspace package imports', async () => {
  const fixture = await createFixture({
    'package.json': JSON.stringify({ workspaces: ['packages/*'] }),
    'packages/orders/package.json': JSON.stringify({ name: '@demo/orders', main: 'dist/index.js' }),
    'packages/orders/src/index.ts': "export function createOrder() {\n  return true;\n}\n",
    'apps/web/src/app.ts': "import { createOrder } from '@demo/orders';\nexport function start() {\n  createOrder();\n}\n"
  });

  const graph = await buildCodeGraph(fixture);

  assert.ok(graph.edges.some((edge) => edge.source === 'file:apps/web/src/app.ts' && edge.target === 'file:packages/orders/src/index.ts' && edge.type === 'imports'));
  assert.ok(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('packages/orders/src/index.ts') && edge.confidence === 'fact'));
});

test('buildCodeGraph resolves workspace package exports', async () => {
  const fixture = await createFixture({
    'package.json': JSON.stringify({ workspaces: ['packages/*'] }),
    'packages/orders/package.json': JSON.stringify({
      name: '@demo/orders',
      exports: { './api': { import: './src/api.ts' } }
    }),
    'packages/orders/src/api.ts': "export function createOrder() {\n  return true;\n}\n",
    'apps/web/src/app.ts': "import { createOrder } from '@demo/orders/api';\nexport function start() {\n  createOrder();\n}\n"
  });

  const graph = await buildCodeGraph(fixture);

  assert.ok(graph.edges.some((edge) => edge.source === 'file:apps/web/src/app.ts' && edge.target === 'file:packages/orders/src/api.ts' && edge.type === 'imports'));
  assert.ok(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('packages/orders/src/api.ts') && edge.confidence === 'fact'));
});

test('buildCodeGraph uses TypeChecker for typed property calls', async () => {
  const fixture = await createFixture({
    'src/index.ts': "import { OrderService } from './service';\nexport function start() {\n  const service = new OrderService();\n  service.save();\n}\n",
    'src/service.ts': "export class OrderService {\n  save() {\n    return true;\n  }\n}\n",
    'src/other.ts': "export class OtherService {\n  save() {\n    return false;\n  }\n}\n"
  });

  const graph = await buildCodeGraph(fixture);

  assert.ok(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('src/service.ts') && edge.target.includes(':save') && edge.confidence === 'typecheck'));
  assert.equal(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('src/other.ts')), false);
});

test('buildCodeGraph resolves package imports aliases', async () => {
  const fixture = await createFixture({
    'package.json': JSON.stringify({ imports: { '#services/*': './src/services/*' } }),
    'src/index.ts': "import { runOrder } from '#services/order';\nexport function start() {\n  runOrder();\n}\n",
    'src/services/order.ts': "export function runOrder() {\n  return true;\n}\n"
  });

  const graph = await buildCodeGraph(fixture);

  assert.ok(graph.edges.some((edge) => edge.source === 'file:src/index.ts' && edge.target === 'file:src/services/order.ts' && edge.type === 'imports'));
  assert.ok(graph.edges.some((edge) => edge.type === 'calls' && edge.source.includes(':start') && edge.target.includes('src/services/order.ts') && edge.confidence === 'fact'));
});

test('buildCodeGraph resolves tsconfig path aliases', async () => {
  const fixture = await createFixture({
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
    'src/index.ts': "import { runOrder } from '@/services/order';\nexport function start() {\n  runOrder();\n}\n",
    'src/services/order.ts': "export function runOrder() {\n  return true;\n}\n"
  });

  const graph = await buildCodeGraph(fixture);

  assert.ok(graph.edges.some((edge) => edge.source === 'file:src/index.ts' && edge.target === 'file:src/services/order.ts' && edge.type === 'imports'));
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
