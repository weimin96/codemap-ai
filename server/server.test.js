import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './server.js';

async function createProject(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codemap-ai-server-'));
  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, 'utf8');
  }
  return root;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.listener.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function getProject(server, token = '') {
  const suffix = token ? `?token=${token}` : '';
  const response = await fetch(`http://127.0.0.1:${server.port}/api/project${suffix}`);
  assert.equal(response.status, 200);
  return await response.json();
}

test('startServer keeps project cache inside each server instance', async () => {
  const firstRoot = await createProject({ 'first.md': 'first project' });
  const secondRoot = await createProject({ 'second.md': 'second project' });
  const firstServer = await startServer({ projectDir: firstRoot, port: 0, host: '127.0.0.1', serveWeb: false });
  const secondServer = await startServer({ projectDir: secondRoot, port: 0, host: '127.0.0.1', serveWeb: false });

  try {
    const first = await getProject(firstServer);
    const second = await getProject(secondServer);
    const firstPaths = first.scan.files.map((file) => file.path);
    const secondPaths = second.scan.files.map((file) => file.path);

    assert.deepEqual(firstPaths, ['first.md']);
    assert.deepEqual(secondPaths, ['second.md']);
    assert.equal(first.projectDir, firstRoot);
    assert.equal(second.projectDir, secondRoot);
  } finally {
    await closeServer(firstServer);
    await closeServer(secondServer);
  }
});

test('startServer protects API routes when an access token is configured', async () => {
  const root = await createProject({ 'README.md': 'network protected project' });
  const server = await startServer({ projectDir: root, port: 0, host: '127.0.0.1', serveWeb: false, accessToken: 'secret-token' });

  try {
    const health = await fetch(`http://127.0.0.1:${server.port}/api/health`);
    assert.equal(health.status, 200);

    const blocked = await fetch(`http://127.0.0.1:${server.port}/api/project`);
    assert.equal(blocked.status, 401);

    const wrong = await fetch(`http://127.0.0.1:${server.port}/api/project?token=wrong-token`);
    assert.equal(wrong.status, 401);

    const project = await getProject(server, 'secret-token');
    assert.deepEqual(project.scan.files.map((file) => file.path), ['README.md']);
  } finally {
    await closeServer(server);
  }
});
