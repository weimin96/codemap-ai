import test from 'node:test';
import assert from 'node:assert/strict';
import { countTokens, estimateTokenCount } from './token-counter.js';

test('estimateTokenCount keeps the existing deterministic fallback', () => {
  assert.equal(estimateTokenCount('abcdef'), 2);
  assert.equal(estimateTokenCount(''), 0);
});

test('countTokens returns explicit precision metadata', async () => {
  const result = await countTokens('hello world', { provider: 'anthropic', model: 'claude' });

  assert.equal(result.precision, 'estimated');
  assert.equal(result.tokenizer, 'char-estimate');
  assert.equal(result.tokens, estimateTokenCount('hello world'));
  assert.ok(result.warnings.some((warning) => warning.includes('Exact tokenizer is unavailable')));
});
