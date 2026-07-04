import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraphContext, selectContextFiles } from './context-pack.js';

const scan = {
  files: [
    { path: 'src/order/controller.ts', text: true, size: 100, role: 'api', priority: 'P0', language: 'typescript', symbols: [] },
    { path: 'src/order/service.ts', text: true, size: 100, role: 'service', priority: 'P1', language: 'typescript', symbols: [] },
    { path: 'src/readme.md', text: true, size: 100, role: 'doc', priority: 'P3', language: 'markdown', symbols: [] }
  ]
};

const graph = {
  nodes: [
    { id: 'file:src/order/controller.ts', type: 'file', name: 'controller.ts', path: 'src/order/controller.ts' },
    { id: 'src/order/controller.ts#createOrder', type: 'function', name: 'createOrder', path: 'src/order/controller.ts' },
    { id: 'src/order/service.ts#createOrder', type: 'function', name: 'createOrder', path: 'src/order/service.ts' }
  ],
  edges: [
    { source: 'src/order/controller.ts#createOrder', target: 'src/order/service.ts#createOrder', type: 'calls' }
  ],
  warnings: [{ path: 'src/order/service.ts', kind: 'unresolved_call', message: 'reserve' }]
};

test('buildGraphContext boosts direct graph neighbors for question mode', () => {
  const context = buildGraphContext(graph, { currentSymbol: { id: 'src/order/controller.ts#createOrder', name: 'createOrder' } }, 'question');

  assert.equal(context.relatedPaths[0].path, 'src/order/service.ts');
  assert.ok(context.pathScores.get('src/order/service.ts') > 0);
});

test('selectContextFiles uses graph context scores', () => {
  const graphContext = buildGraphContext(graph, { currentSymbol: { id: 'src/order/controller.ts#createOrder', name: 'createOrder' } }, 'question');
  const selected = selectContextFiles(scan, { mode: 'question', target: { currentSymbol: { name: 'createOrder' } }, maxChars: 2000, graphContext });

  assert.equal(selected[0].path, 'src/order/service.ts');
});
