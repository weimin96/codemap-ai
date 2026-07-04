import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readTextFileSafe } from './fs-utils.js';

async function createProjectRoot() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'codemap-ai-fs-'));
}

test('readTextFileSafe rejects symlink targets outside project root', async (t) => {
  const root = await createProjectRoot();
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'codemap-ai-outside-'));
  const secretPath = path.join(outside, 'secret.md');
  const linkPath = path.join(root, 'secret.md');
  await fs.writeFile(secretPath, 'token=hidden', 'utf8');
  try {
    await fs.symlink(secretPath, linkPath);
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') {
      t.skip('current platform does not allow creating file symlinks');
      return;
    }
    throw error;
  }

  await assert.rejects(
    () => readTextFileSafe(root, 'secret.md'),
    /Path is outside project root\./
  );
});

test('readTextFileSafe reads regular text files inside project root', async () => {
  const root = await createProjectRoot();
  await fs.writeFile(path.join(root, 'README.md'), '# codemap-ai', 'utf8');

  const file = await readTextFileSafe(root, 'README.md');

  assert.equal(file.path, 'README.md');
  assert.equal(file.content, '# codemap-ai');
  assert.equal(file.truncated, false);
});
