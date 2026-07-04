import test from 'node:test';
import assert from 'node:assert/strict';
import { modelConfigCandidates } from './ai.js';

test('modelConfigCandidates keeps single provider config unchanged', () => {
  const candidates = modelConfigCandidates({ provider: 'openrouter', apiKey: 'key' });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].provider, 'openrouter');
});

test('modelConfigCandidates expands auto provider priority', () => {
  const candidates = modelConfigCandidates({ provider: 'auto', apiKey: 'key', providerPriority: 'ollama,openrouter,openai' });
  assert.deepEqual(candidates.map((item) => item.provider), ['ollama', 'openrouter', 'openai']);
  assert.equal(candidates[0].apiKey, '');
  assert.equal(candidates[1].baseURL, 'https://openrouter.ai/api/v1');
  assert.equal(candidates[2].model, 'gpt-4.1-mini');
});
