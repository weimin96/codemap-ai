import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifyReportEvidence } from './evidence-verifier.js';

async function createProject() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codemap-ai-evidence-'));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src/index.ts'), 'export function main() {\n  return true;\n}\n', 'utf8');
  return root;
}

test('verifyReportEvidence records unsupported claims and downgrades invalid evidence', async () => {
  const root = await createProject();
  const scan = {
    files: [
      { type: 'file', path: 'src/index.ts', symbols: [{ name: 'main', signature: 'function main', startLine: 1, endLine: 3 }] }
    ]
  };
  const report = {
    analysisQuality: {},
    modules: [
      { id: 'entry', name: '入口', paths: ['src/index.ts'], confidence: 'fact', evidence: [{ path: 'src/index.ts', symbol: 'missing', reason: '引用不存在的符号', confidence: 'fact' }] }
    ],
    flows: [],
    risks: [
      { id: 'risk-1', title: '越界风险', confidence: 'fact', evidence: [{ path: 'src/index.ts', startLine: 99, endLine: 120, reason: '越界行号', confidence: 'fact' }] }
    ]
  };

  const verified = await verifyReportEvidence({ root, scan, report });

  assert.equal(verified.modules[0].confidence, 'unknown');
  assert.equal(verified.modules[0].evidence[0].confidence, 'unknown');
  assert.equal(verified.risks[0].confidence, 'unknown');
  assert.equal(verified.analysisQuality.unsupportedClaims.length, 2);
  assert.deepEqual(verified.analysisQuality.unsupportedClaims.map((item) => item.reason), ['invalid_evidence', 'invalid_evidence']);
});

test('verifyReportEvidence preserves claims with valid path, line and symbol evidence', async () => {
  const root = await createProject();
  const scan = {
    files: [
      { type: 'file', path: 'src/index.ts', symbols: [{ name: 'main', signature: 'function main', startLine: 1, endLine: 3 }] }
    ]
  };
  const report = {
    analysisQuality: {},
    modules: [
      { id: 'entry', name: '入口', paths: ['src/index.ts'], confidence: 'fact', evidence: [{ path: 'src/index.ts', symbol: 'main', startLine: 1, endLine: 3, reason: '入口函数', confidence: 'fact' }] }
    ],
    flows: [],
    risks: []
  };

  const verified = await verifyReportEvidence({ root, scan, report });

  assert.equal(verified.modules[0].confidence, 'fact');
  assert.deepEqual(verified.analysisQuality.unsupportedClaims, []);
});
