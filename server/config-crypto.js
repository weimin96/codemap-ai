import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const KEY_FILE = 'key.bin';
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;

export async function encryptSecret(configDir, value) {
  if (!value) return null;
  const key = await loadOrCreateKey(configDir);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return {
    v: 1,
    alg: ALGORITHM,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  };
}

export async function decryptSecret(configDir, payload) {
  if (!payload) return '';
  if (payload.v !== 1 || payload.alg !== ALGORITHM || !payload.iv || !payload.tag || !payload.data) {
    throw new Error('Unsupported encrypted secret format.');
  }
  const key = await loadOrCreateKey(configDir);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

async function loadOrCreateKey(configDir) {
  await fs.mkdir(configDir, { recursive: true });
  const keyPath = path.join(configDir, KEY_FILE);
  try {
    const key = await fs.readFile(keyPath);
    if (key.length === KEY_BYTES) return key;
    throw new Error('Invalid local encryption key.');
  } catch (error) {
    if (error?.code && error.code !== 'ENOENT') throw error;
    const key = crypto.randomBytes(KEY_BYTES);
    await fs.writeFile(keyPath, key, { mode: 0o600 });
    return key;
  }
}
