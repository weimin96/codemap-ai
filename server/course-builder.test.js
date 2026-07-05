import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildCourseExport, buildCourseMaterials } from './course-builder.js';

const report = {
  projectOverview: { name: 'Demo', summary: 'Demo app' },
  entrypoints: [{ name: 'main', path: 'src/index.ts', kind: 'cli', confidence: 'fact', evidence: [{ path: 'src/index.ts', startLine: 1, endLine: 2 }] }],
  modules: [{
    id: 'core',
    name: 'Core',
    paths: ['src/index.ts'],
    responsibility: 'Run core flow',
    keyFiles: [{ path: 'src/index.ts', startLine: 1, endLine: 3, reason: 'entry' }],
    priority: 'P0',
    confidence: 'fact'
  }],
  flows: [{
    id: 'run-flow',
    name: 'Run Flow',
    trigger: 'user runs command',
    priority: 'P0',
    confidence: 'fact',
    steps: [{ order: 1, path: 'src/index.ts', symbol: 'run', startLine: 1, endLine: 3, description: 'run entry' }]
  }],
  dataModel: { entities: [], relations: [], keyFields: [], risks: [] },
  risks: [{ id: 'risk-one', title: 'Missing test', level: 'medium', reason: 'No guard', verify: 'Run test', evidence: [{ path: 'src/index.ts', startLine: 2, endLine: 3 }] }],
  readingPlan: [{ timebox: '30m', goal: 'Read entry', files: ['src/index.ts'], output: 'notes' }],
  unknowns: []
};

test('buildCourseMaterials creates evidence-bound course modules and briefs', async () => {
  const root = await fixtureRoot();
  const course = await buildCourseMaterials({ root, report, scan: { totalFiles: 1, totalSymbols: 1 }, codeGraph: { nodes: [{}], edges: [{}] } });

  assert.equal(course.projectName, 'Demo');
  assert.ok(course.courseModules.length >= 4);
  assert.ok(course.moduleBriefs.some((brief) => brief.id === 'core-flow'));
  assert.equal(course.moduleBriefs[0].snippets[0].path, 'src/index.ts');
  assert.match(course.moduleBriefs[0].snippets[0].code, /export function run/);
  assert.ok(course.courseModules[0].quiz[0].options.length >= 4);
});

test('buildCourseExport returns fixed assets and module html files', async () => {
  const root = await fixtureRoot();
  const exported = await buildCourseExport({ root, report, scan: { totalFiles: 1 } });

  assert.ok(exported.names.includes('index.html'));
  assert.ok(exported.names.includes('styles.css'));
  assert.ok(exported.names.includes('main.js'));
  assert.ok(exported.names.some((name) => name.startsWith('modules/')));
  assert.match(exported.docs['index.html'], /codemap-ai Course Mode/);
});

async function fixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codemap-course-'));
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src/index.ts'), 'export function run() {\n  return true;\n}\n', 'utf8');
  return root;
}
