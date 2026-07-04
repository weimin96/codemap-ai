import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReport, summarizeContextPack } from './report-normalizer.js';

test('normalizeReport fills analysis quality from scan and context pack', () => {
  const contextPack = {
    generatedAt: '2026-07-04T00:00:00.000Z',
    mode: 'overview',
    target: {},
    budget: { maxChars: 9000, usedChars: 3000 },
    skippedFiles: [{ path: 'large.log', reason: '文件过大' }],
    files: [{ path: 'server/server.js', role: '入口', priority: 'P0', language: 'javascript', score: 100, charCount: 1200 }]
  };
  const scan = { totalFiles: 7, totalSymbols: 11 };

  const report = normalizeReport({ modules: [], flows: [], risks: [] }, contextPack, scan);

  assert.equal(report.analysisQuality.scannedFiles, 7);
  assert.equal(report.analysisQuality.indexedSymbols, 11);
  assert.equal(report.analysisQuality.contextFiles.length, 1);
  assert.equal(report.analysisQuality.skippedFiles.length, 1);
  assert.deepEqual(report.analysisQuality.tokenBudget, { max: 3000, used: 1000 });
});

test('normalizeReport converts string evidence into code references', () => {
  const report = normalizeReport({
    modules: [{ name: '订单模块', paths: ['src/order.ts'], responsibility: '处理订单', evidence: '模块路径命中' }],
    flows: [],
    risks: []
  });

  assert.equal(report.modules[0].id, '订单模块');
  assert.equal(report.modules[0].verificationStatus, 'ai_guess');
  assert.deepEqual(report.modules[0].evidence, [{ path: 'src/order.ts', reason: '模块路径命中', confidence: 'guess' }]);
});

test('normalizeReport preserves explicit verification status', () => {
  const report = normalizeReport({
    modules: [{ name: '支付模块', paths: ['src/pay.ts'], responsibility: '处理支付', verificationStatus: 'verified', verifiedBy: 'owner', verificationNote: '人工确认' }],
    flows: [{ name: '支付链路', steps: [], verificationStatus: 'stale' }],
    risks: [{ title: '回调风险', reason: '缺少幂等', verify: '复查回调', verificationStatus: 'pending' }],
    dataModel: { entities: [{ id: 'order', name: 'Order', description: '订单', verificationStatus: 'rejected' }] }
  });

  assert.equal(report.modules[0].verificationStatus, 'verified');
  assert.equal(report.modules[0].verifiedBy, 'owner');
  assert.equal(report.flows[0].verificationStatus, 'stale');
  assert.equal(report.risks[0].verificationStatus, 'pending');
  assert.equal(report.dataModel.entities[0].verificationStatus, 'rejected');
});

test('summarizeContextPack keeps only public file metadata', () => {
  const summary = summarizeContextPack({
    generatedAt: '2026-07-04T00:00:00.000Z',
    mode: 'risk',
    target: { riskId: 'r1' },
    budget: { maxChars: 100, usedChars: 20 },
    skippedFiles: [],
    files: [{ path: 'a.ts', role: '代码', priority: 'P1', language: 'typescript', score: 1, charCount: 20, content: 'secret' }]
  });

  assert.equal(summary.files[0].content, undefined);
  assert.equal(summary.files[0].path, 'a.ts');
});
