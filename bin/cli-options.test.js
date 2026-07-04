import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePort } from './cli-options.js';

test('parsePort accepts valid TCP port numbers', () => {
  assert.equal(parsePort('1'), 1);
  assert.equal(parsePort('3000'), 3000);
  assert.equal(parsePort('65535'), 65535);
});

test('parsePort rejects partial and out-of-range values', () => {
  assert.throws(() => parsePort('3000abc'), /Invalid --port value\./);
  assert.throws(() => parsePort('0'), /Invalid --port value\./);
  assert.throws(() => parsePort('99999'), /Invalid --port value\./);
  assert.throws(() => parsePort(''), /Invalid --port value\./);
});
