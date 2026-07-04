import crypto from 'node:crypto';

export function parsePort(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) throw new Error('Invalid --port value.');
  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid --port value.');
  return port;
}

export function isLoopbackHost(host) {
  const value = String(host || '').trim().toLowerCase();
  return value === 'localhost'
    || value === '127.0.0.1'
    || value === '::1'
    || value === '[::1]'
    || value === '0:0:0:0:0:0:0:1';
}

export function requireNetworkFlag(host, allowNetwork) {
  if (isLoopbackHost(host)) return;
  if (allowNetwork) return;
  throw new Error('Non-loopback --host requires --allow-network.');
}

export function createAccessToken() {
  return crypto.randomBytes(24).toString('base64url');
}
