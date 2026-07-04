import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJsonRepairPrompt, parseAskAnswer, parseJsonResult } from './ai.js';

test('parseJsonResult accepts fenced json only after stripping fences', () => {
  const parsed = parseJsonResult('```json\n{"ok":true}\n```');
  assert.deepEqual(parsed, { ok: true });
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
