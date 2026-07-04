import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccessToken, isLoopbackHost, parsePort, requireNetworkFlag } from './cli-options.js';

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

test('requireNetworkFlag allows loopback hosts without explicit network access', () => {
  assert.equal(isLoopbackHost('127.0.0.1'), true);
  assert.equal(isLoopbackHost('localhost'), true);
  assert.equal(isLoopbackHost('::1'), true);
  assert.doesNotThrow(() => requireNetworkFlag('127.0.0.1', false));
});

test('requireNetworkFlag rejects non-loopback hosts without allow-network', () => {
  assert.equal(isLoopbackHost('0.0.0.0'), false);
  assert.throws(() => requireNetworkFlag('0.0.0.0', false), /Non-loopback --host requires --allow-network\./);
  assert.doesNotThrow(() => requireNetworkFlag('0.0.0.0', true));
});

test('createAccessToken returns a non-empty URL-safe token', () => {
  const token = createAccessToken();
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.ok(token.length >= 32);
});
