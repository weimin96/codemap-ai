import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exists } from './fs-utils.js';
import { decryptSecret, encryptSecret } from './config-crypto.js';

const CONFIG_DIR = path.join(os.homedir(), '.project-fast-onboarding');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export async function readConfig() {
  if (!(await exists(CONFIG_FILE))) {
    return envConfig();
  }
  try {
    const parsed = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
    const stored = await decodeStoredConfig(parsed);
    if (parsed.apiKey && !parsed.apiKeyEncrypted) await writeConfig(stored);
    return { ...envConfig(), ...stored };
  } catch {
    return envConfig();
  }
}

export async function writeConfig(config) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const current = await readConfigWithoutMigration();
  const next = { ...current, ...config };
  const stored = await encodeStoredConfig(next);
  await fs.writeFile(CONFIG_FILE, JSON.stringify(stored, null, 2), { mode: 0o600 });
  return next;
}

export function redactConfig(config) {
  return {
    ...config,
    apiKey: config.apiKey ? '********' : ''
  };
}

async function readConfigWithoutMigration() {
  if (!(await exists(CONFIG_FILE))) return envConfig();
  try {
    const parsed = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
    return { ...envConfig(), ...(await decodeStoredConfig(parsed)) };
  } catch {
    return envConfig();
  }
}

async function decodeStoredConfig(parsed) {
  const { apiKeyEncrypted, ...rest } = parsed || {};
  const apiKey = apiKeyEncrypted ? await decryptSecret(CONFIG_DIR, apiKeyEncrypted) : rest.apiKey || '';
  delete rest.apiKey;
  return { ...rest, apiKey };
}

async function encodeStoredConfig(config) {
  const { apiKey, ...rest } = config || {};
  const stored = { ...rest };
  if (apiKey) stored.apiKeyEncrypted = await encryptSecret(CONFIG_DIR, apiKey);
  return stored;
}

function envConfig() {
  return {
    provider: process.env.PFO_AI_PROVIDER || 'openai-compatible',
    baseURL: process.env.PFO_AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.PFO_AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    apiKey: process.env.PFO_AI_API_KEY || process.env.OPENAI_API_KEY || ''
  };
}
