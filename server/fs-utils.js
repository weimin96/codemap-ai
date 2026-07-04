import fs from 'node:fs/promises';
import path from 'node:path';

export const IGNORE_DIRS = new Set([
  '.git', '.svn', '.hg', 'node_modules', '.next', '.nuxt', '.turbo', '.cache',
  'dist', 'build', 'coverage', '.venv', 'venv', '__pycache__', 'target', 'out',
  '.idea', '.vscode', '.DS_Store', 'vendor'
]);

export const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.md', '.mdx', '.yml', '.yaml',
  '.toml', '.env', '.example', '.css', '.scss', '.html', '.vue', '.svelte', '.py', '.go',
  '.rs', '.java', '.kt', '.kts', '.cs', '.php', '.rb', '.sql', '.graphql', '.proto', '.xml',
  '.gradle', '.properties', '.sh', '.Dockerfile', '.dockerignore', '.gitignore', '.prisma'
]);

export function toPosix(p) {
  return p.split(path.sep).join('/');
}

export function ensureInside(root, candidate) {
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path is outside project root.');
  }
  return resolved;
}

export async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw new Error(`Failed to access path ${p}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function isProbablyText(filePath) {
  const base = path.basename(filePath);
  if (base === 'Dockerfile' || base.startsWith('.env')) return true;
  const ext = path.extname(filePath);
  return TEXT_EXTENSIONS.has(ext);
}

export async function readTextFileSafe(root, relPath, maxBytes = 180_000) {
  const absolute = ensureInside(root, relPath);
  const stat = await fs.stat(absolute);
  if (!stat.isFile()) throw new Error('Not a file.');
  if (!isProbablyText(absolute)) throw new Error('File type is not supported for preview.');
  const handle = await fs.open(absolute, 'r');
  try {
    const bytesToRead = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    await handle.read(buffer, 0, bytesToRead, 0);
    const truncated = stat.size > maxBytes;
    return {
      path: toPosix(relPath),
      content: buffer.toString('utf8'),
      size: stat.size,
      truncated
    };
  } finally {
    await handle.close();
  }
}
