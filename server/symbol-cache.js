import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const CACHE_VERSION = 1;
const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.codemap-ai', 'symbol-cache');

export async function openSymbolCache(root) {
  if (process.env.CODEMAP_AI_DISABLE_SYMBOL_CACHE === '1') return null;
  const cachePath = await symbolCachePath(root);
  const data = await readCacheFile(cachePath);
  const entries = data.version === CACHE_VERSION && data.entries && typeof data.entries === 'object'
    ? data.entries
    : {};
  let dirty = false;

  return {
    path: cachePath,
    get(relPath, stat, language) {
      const entry = entries[relPath];
      if (!entry) return null;
      if (entry.size !== stat.size || entry.mtimeMs !== stat.mtimeMs || entry.language !== language) return null;
      return Array.isArray(entry.symbols) ? entry.symbols : null;
    },
    set(relPath, stat, language, symbols) {
      entries[relPath] = {
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        language,
        symbols
      };
      dirty = true;
    },
    async save() {
      if (!dirty) return false;
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify({ version: CACHE_VERSION, root: path.resolve(root), savedAt: new Date().toISOString(), entries }, null, 2), 'utf8');
      dirty = false;
      return true;
    }
  };
}

async function readCacheFile(cachePath) {
  try {
    return JSON.parse(await fs.readFile(cachePath, 'utf8'));
  } catch (_error) {
    return { version: CACHE_VERSION, entries: {} };
  }
}

async function symbolCachePath(root) {
  let realRoot = path.resolve(root);
  try {
    realRoot = await fs.realpath(root);
  } catch (_error) {
    // Keep the resolved path when realpath is not available yet.
  }
  const hash = crypto.createHash('sha256').update(realRoot).digest('hex');
  return path.join(process.env.CODEMAP_AI_CACHE_DIR || DEFAULT_CACHE_DIR, `${hash}.json`);
}
