import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildPartialReport, mergeStageReport, selectFlowCandidates, selectModuleCandidates, selectRiskFiles } from './analysis-job.js';

const scan = {
  keyFiles: [
    { path: 'src/index.ts', role: 'entry', priority: 'P0', language: 'typescript', size: 120, symbols: [{ name: 'main', kind: 'function', startLine: 1 }] },
    { path: 'src/auth/service.ts', role: 'service', priority: 'P1', language: 'typescript', size: 240, symbols: [] },
    { path: 'src/db/schema.ts', role: 'model', priority: 'P1', language: 'typescript', size: 180, symbols: [] }
  ],
  files: [
    { path: 'src/index.ts', role: 'entry', priority: 'P0', language: 'typescript', text: true, size: 120, symbols: [] },
    { path: 'src/auth/service.ts', role: 'service', priority: 'P1', language: 'typescript', text: true, size: 240, symbols: [] },
    { path: 'src/readme.md', role: 'docs', priority: 'P3', language: 'markdown', text: true, size: 10, symbols: [] }
  ],
  repoMap: {
    modules: [
      { name: 'auth', priority: 'P0', topFiles: ['src/auth/service.ts'], roles: ['service'], fileCount: 2, symbolCount: 3 }
    ],
    entrypoints: [
      { path: 'src/index.ts', role: 'entry', priority: 'P0', language: 'typescript', symbols: [{ name: 'main', kind: 'function', startLine: 1 }] }
    ]
  }
};

test('selectModuleCandidates prefers repo map modules', () => {
  const candidates = selectModuleCandidates(scan);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, 'auth');
  assert.deepEqual(candidates[0].topFiles, ['src/auth/service.ts']);
});

test('selectFlowCandidates includes graph neighbors for entrypoints', () => {
  const graph = {
    nodes: [
      { id: 'file:src/index.ts', type: 'file', name: 'src/index.ts', path: 'src/index.ts' },
      { id: 'file:src/auth/service.ts', type: 'file', name: 'service.ts', path: 'src/auth/service.ts' }
    ],
    edges: [{ source: 'file:src/index.ts', target: 'file:src/auth/service.ts', type: 'imports', confidence: 'fact' }]
  };

  const candidates = selectFlowCandidates(scan, graph);

  assert.equal(candidates[0].path, 'src/index.ts');
  assert.equal(candidates[0].neighbors[0].path, 'src/auth/service.ts');
});

test('selectRiskFiles prioritizes security and data related files', () => {
  const files = selectRiskFiles(scan);

  assert.deepEqual(files, ['src/auth/service.ts']);
});

test('buildPartialReport marks normalized report as partial for current stage', async () => {
  const contextPack = {
    generatedAt: new Date().toISOString(),
    mode: 'overview',
    target: {},
    budget: { maxChars: 1000, usedChars: 100, estimatedTokens: 34 },
    files: [{ path: 'src/index.ts', role: 'entry', priority: 'P0', language: 'typescript', score: 10, charCount: 100, truncated: false }],
    chunks: [],
    skippedFiles: []
  };

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codemap-ai-evidence-'));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src/index.ts'), 'function main() {\n  return true;\n}\n', 'utf8');

  const report = await buildPartialReport({
    root,
    stage: 'overview',
    state: { overview: { projectOverview: { name: 'demo' } } },
    contextPack,
    scan
  });

  assert.equal(report.generatedBy, 'ai-staged-partial');
  assert.equal(report.analysisQuality.partial, true);
  assert.equal(report.analysisQuality.stage, 'overview');
  assert.equal(report.projectOverview.name, 'demo');
});

test('mergeStageReport combines staged outputs into a report shape', () => {
  const report = mergeStageReport({
    overview: { projectOverview: { name: 'demo' }, entrypoints: [{ path: 'src/index.ts' }], readingPlan: [{ timebox: '30m' }] },
    modules: [{ name: 'auth' }],
    flows: [{ name: 'login' }],
    riskResult: { risks: [{ title: 'token risk' }], readingPlan: [{ timebox: '60m' }], dataModel: { entities: [] } }
  });

  assert.equal(report.generatedBy, 'ai-staged');
  assert.equal(report.projectOverview.name, 'demo');
  assert.equal(report.modules.length, 1);
  assert.equal(report.flows.length, 1);
  assert.equal(report.risks.length, 1);
  assert.equal(report.readingPlan.length, 2);
});
