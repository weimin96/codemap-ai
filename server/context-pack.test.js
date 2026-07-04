import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContextPack, buildGraphContext, detectSecretRisk, estimateTokenCount, selectContextFiles } from './context-pack.js';

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

async function createProject(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codemap-ai-context-'));
  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, 'utf8');
  }
  return root;
}

test('estimateTokenCount returns a stable character-based estimate', () => {
  assert.equal(estimateTokenCount('abcdef'), 2);
  assert.equal(estimateTokenCount(''), 0);
});

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

test('detectSecretRisk flags sensitive paths and credential-like content', () => {
  assert.equal(detectSecretRisk({ path: '.env', content: '' }).kind, 'sensitive_path');
  assert.equal(detectSecretRisk({ path: 'src/config.ts', content: 'accessKey = "AKIAABCDEFGHIJKLMNOP"' }).kind, 'aws_access_key_id');
  assert.equal(detectSecretRisk({ path: 'src/config.ts', content: 'token = "ghp_' + 'a'.repeat(36) + '"' }).kind, 'github_token');
  assert.equal(detectSecretRisk({ path: 'src/config.ts', content: 'token = "xoxb-' + '1'.repeat(10) + '-' + '2'.repeat(20) + '"' }).kind, 'slack_token');
  assert.equal(detectSecretRisk({ path: 'src/config.ts', content: 'serviceToken = ' + 'x'.repeat(32) }).kind, 'credential_assignment');
  assert.equal(detectSecretRisk({ path: 'src/config.ts', content: 'export const name = "demo";' }), null);
});

test('buildContextPack excludes sensitive files from AI chunks', async () => {
  const root = await createProject({
    'src/app.ts': 'export function start() { return true; }\n',
    '.env': 'SERVICE_TOKEN=' + 'x'.repeat(32) + '\n',
    'src/config.ts': 'serviceToken = ' + 'x'.repeat(32) + '\n'
  });
  const projectScan = {
    root,
    totalFiles: 3,
    totalSymbols: 0,
    repoMap: {},
    files: [
      { path: 'src/app.ts', text: true, size: 40, role: 'entry', priority: 'P0', language: 'typescript', symbols: [] },
      { path: '.env', text: true, size: 50, role: 'config', priority: 'P0', language: 'text', symbols: [] },
      { path: 'src/config.ts', text: true, size: 60, role: 'config', priority: 'P0', language: 'typescript', symbols: [] }
    ]
  };

  const pack = await buildContextPack({ root, scan: projectScan, maxChars: 20000 });

  assert.deepEqual(pack.chunks.map((chunk) => chunk.path), ['src/app.ts']);
  assert.deepEqual(pack.skippedFiles.map((file) => file.path).sort(), ['.env', 'src/config.ts']);
  assert.ok(pack.files[0].estimatedTokens > 0);
  assert.ok(pack.budget.estimatedTokens > 0);
  assert.match(pack.markdown, /Skipped Files: 2/);
  assert.match(pack.markdown, /## Skipped Files/);
});

test('buildContextPack keeps default analysis context bounded', async () => {
  const largeSource = 'export const marker = true;\n' + 'const value = 1;\n'.repeat(1600);
  const root = await createProject({
    'src/orders/controller.ts': largeSource,
    'src/orders/service.ts': largeSource,
    'src/orders/repository.ts': largeSource,
    'src/billing/service.ts': largeSource,
    'src/auth/middleware.ts': largeSource
  });
  const filePaths = [
    'src/orders/controller.ts',
    'src/orders/service.ts',
    'src/orders/repository.ts',
    'src/billing/service.ts',
    'src/auth/middleware.ts'
  ];
  const files = filePaths.map((filePath) => ({
    path: filePath,
    text: true,
    size: largeSource.length,
    role: 'service',
    priority: 'P1',
    language: 'typescript',
    symbols: []
  }));
  const projectScan = {
    root,
    totalFiles: files.length,
    totalSymbols: 0,
    repoMap: {},
    files
  };

  const pack = await buildContextPack({ root, scan: projectScan });

  assert.equal(pack.budget.maxChars, 60000);
  assert.ok(pack.budget.usedChars <= 60000);
  assert.ok(pack.chunks.every((chunk) => chunk.content.length <= 12000));
});
