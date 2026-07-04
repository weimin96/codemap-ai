import fs from 'node:fs/promises';
import path from 'node:path';
import { toPosix } from './fs-utils.js';

const IGNORE_FILES = ['.gitignore', 'pfo.ignore'];

export async function loadIgnoreRules(root) {
  const rules = [];
  for (const file of IGNORE_FILES) {
    const content = await readIgnoreFile(root, file);
    if (!content) continue;
    rules.push(...parseIgnoreRules(content));
  }
  return (relPath, isDirectory = false) => {
    const normalized = toPosix(relPath).replace(/^\.\//, '');
    let ignored = false;
    for (const rule of rules) {
      if (matchesRule(rule, normalized, isDirectory)) ignored = !rule.negated;
    }
    return ignored;
  };
}

async function readIgnoreFile(root, file) {
  const filePath = path.join(root, file);
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw new Error(`Failed to read ignore file ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseIgnoreRules(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const negated = line.startsWith('!');
      let pattern = negated ? line.slice(1) : line;
      const anchored = pattern.startsWith('/');
      pattern = pattern.replace(/^\/+/, '');
      const directoryOnly = pattern.endsWith('/');
      pattern = pattern.replace(/\/+$/, '');
      return { pattern, negated, anchored, directoryOnly, hasSlash: pattern.includes('/'), hasGlob: /[*?[]/.test(pattern) };
    })
    .filter((rule) => rule.pattern);
}

function matchesRule(rule, relPath, isDirectory) {
  if (rule.directoryOnly && !isDirectory && !relPath.startsWith(`${rule.pattern}/`) && !relPath.includes(`/${rule.pattern}/`)) {
    return false;
  }

  if (rule.hasGlob) return matchesGlob(rule, relPath);
  if (rule.hasSlash || rule.anchored) return relPath === rule.pattern || relPath.startsWith(`${rule.pattern}/`);

  const parts = relPath.split('/');
  if (parts.includes(rule.pattern)) return true;
  return isDirectory && relPath.endsWith(`/${rule.pattern}`);
}

function matchesGlob(rule, relPath) {
  const target = rule.hasSlash || rule.anchored ? relPath : path.posix.basename(relPath);
  const source = rule.hasSlash || rule.anchored ? rule.pattern : path.posix.basename(rule.pattern);
  const regex = new RegExp(`^${globToRegex(source)}(?:/.*)?$`);
  return regex.test(target);
}

function globToRegex(pattern) {
  let output = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === '*' && next === '*') {
      output += '.*';
      index += 1;
    } else if (char === '*') {
      output += '[^/]*';
    } else if (char === '?') {
      output += '[^/]';
    } else {
      output += escapeRegex(char);
    }
  }
  return output;
}

function escapeRegex(char) {
  return char.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
}
