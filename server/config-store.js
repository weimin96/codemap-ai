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
  const parsed = await readStoredConfigFile();
  const stored = await decodeStoredConfig(parsed);
  if (parsed.apiKey && !parsed.apiKeyEncrypted) await writeConfig(stored);
  return { ...envConfig(), ...stored };
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
  const parsed = await readStoredConfigFile();
  return { ...envConfig(), ...(await decodeStoredConfig(parsed)) };
}

async function readStoredConfigFile() {
  try {
    return JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to read config file ${CONFIG_FILE}: ${error instanceof Error ? error.message : String(error)}`);
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
  const provider = process.env.PFO_AI_PROVIDER || 'openai-compatible';
  return {
    provider,
    baseURL: process.env.PFO_AI_BASE_URL || process.env.OPENAI_BASE_URL || defaultBaseURL(provider),
    model: process.env.PFO_AI_MODEL || process.env.OPENAI_MODEL || defaultModel(provider),
    apiKey: process.env.PFO_AI_API_KEY || process.env.OPENAI_API_KEY || ''
  };
}

function defaultBaseURL(provider) {
  if (provider === 'ollama') return 'http://127.0.0.1:11434/api';
  if (provider === 'deepseek') return 'https://api.deepseek.com';
  if (provider === 'kimi') return 'https://api.moonshot.cn/v1';
  if (provider === 'zhipu') return 'https://open.bigmodel.cn/api/paas/v4';
  if (provider === 'siliconflow') return 'https://api.siliconflow.cn/v1';
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  if (provider === 'auto') return '';
  if (provider === 'custom') return '';
  return 'https://api.openai.com/v1';
}

function defaultModel(provider) {
  if (provider === 'ollama') return 'qwen2.5-coder:7b';
  if (provider === 'deepseek') return 'deepseek-v4-flash';
  if (provider === 'kimi') return 'kimi-k2.7-code';
  if (provider === 'zhipu') return 'glm-5.1';
  if (provider === 'siliconflow') return 'Qwen/Qwen3-Coder-480B-A35B-Instruct';
  if (provider === 'openrouter') return 'anthropic/claude-sonnet-4.5';
  if (provider === 'auto') return '';
  if (provider === 'custom') return '';
  return 'gpt-4.1-mini';
}
