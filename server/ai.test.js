import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJsonRepairPrompt, parseAnalysisReport, parseAskAnswer, parseJsonResult, resolveAiTimeoutMs } from './ai.js';

test('resolveAiTimeoutMs validates configured request timeout', () => {
  assert.equal(resolveAiTimeoutMs({ timeoutMs: 1000 }), 1000);
  assert.equal(resolveAiTimeoutMs({ timeoutMs: '2500' }), 2500);
  assert.throws(() => resolveAiTimeoutMs({ timeoutMs: 999 }), /Invalid AI timeout/);
  assert.throws(() => resolveAiTimeoutMs({ timeoutMs: 'bad' }), /Invalid AI timeout/);
});

test('parseJsonResult accepts fenced json only after stripping fences', () => {
  const parsed = parseJsonResult('```json\n{"ok":true}\n```');
  assert.deepEqual(parsed, { ok: true });
});

test('parseAnalysisReport downgrades schema-invalid reports with warnings', () => {
  const report = parseAnalysisReport(JSON.stringify({
    generatedBy: 'ai',
    projectOverview: { name: 'codemap-ai' },
    analysisQuality: { parseWarnings: ['existing warning'] }
  }));

  assert.deepEqual(report.modules, []);
  assert.deepEqual(report.flows, []);
  assert.deepEqual(report.risks, []);
  assert.equal(report.analysisQuality.confidence, 'unknown');
  assert.ok(report.analysisQuality.parseWarnings.some((warning) => warning.includes('schema: modules')));
  assert.ok(report.analysisQuality.parseWarnings.includes('existing warning'));
});

test('parseAskAnswer validates structured answer schema', () => {
  const answer = parseAskAnswer(JSON.stringify({
    conclusion: '不确定',
    evidence: [{ path: 'server/ai.js', reason: '当前上下文', confidence: 'fact' }],
    risks: [],
    nextActions: ['补充证据'],
    relatedFiles: [{ path: 'server/ai.js', reason: '当前上下文', confidence: 'fact' }],
    confidence: 'unknown',
    markdown: '不确定'
  }));

  assert.equal(answer.confidence, 'unknown');
});

test('buildJsonRepairPrompt preserves invalid response for one repair attempt', () => {
  const prompt = buildJsonRepairPrompt({ text: '{"ok": true,}', expectedSchema: 'object', error: new Error('Unexpected token') });

  assert.match(prompt, /目标结构：object/);
  assert.match(prompt, /Unexpected token/);
  assert.match(prompt, /\{"ok": true,\}/);
});
