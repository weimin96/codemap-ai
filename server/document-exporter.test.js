import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocumentSet } from './document-exporter.js';

const report = {
  projectOverview: { name: 'CodeAtlas', type: 'Node app', techStack: ['React'], startup: 'npm run dev', summary: '项目理解工作台' },
  analysisQuality: { scannedFiles: 3, indexedSymbols: 5, contextFiles: [{ path: 'a.ts' }], skippedFiles: [], parseWarnings: [] },
  architecture: { summary: '本地服务与前端工作台', mermaid: 'flowchart TD\n  A --> B' },
  entrypoints: [{ name: 'CLI', path: 'bin/pfo.js', kind: 'cli', confidence: 'fact' }],
  modules: [{ name: '分析模块', paths: ['server/ai.js'], summary: '分析项目', responsibilities: ['生成报告'], dataEntities: [], evidence: [{ path: 'server/ai.js', reason: '入口证据' }], verificationStatus: 'ai_guess' }],
  flows: [{ name: '分析链路', trigger: '点击分析', priority: 'P0', confidence: 'guess', steps: [{ order: 1, path: 'server/server.js', symbol: 'analyze', description: '调用 AI' }], verificationStatus: 'pending' }],
  dataModel: { entities: [{ name: 'Report', description: '分析报告', verificationStatus: 'verified' }], relations: [], stateMachines: [] },
  risks: [{ level: 'medium', title: 'JSON 格式风险', verify: '运行测试', reason: 'AI 输出可能不合法', verificationStatus: 'pending' }],
  readingPlan: [{ timebox: '30m', goal: '读入口', files: ['bin/pfo.js'], output: '入口笔记' }],
  unknowns: ['是否需要 SQLite']
};

test('buildDocumentSet returns the onboarding markdown document set', () => {
  const set = buildDocumentSet({ report, scan: { totalFiles: 3, totalSymbols: 5 } });

  assert.deepEqual(set.names, ['PROJECT_MAP.md', 'MODULES.md', 'CORE_FLOWS.md', 'DATA_MODEL.md', 'RISK_REGISTER.md', 'READING_PLAN.md', 'QUESTIONS.md']);
  assert.match(set.docs['PROJECT_MAP.md'], /CodeAtlas/);
  assert.match(set.docs['MODULES.md'], /分析模块/);
  assert.match(set.docs['CORE_FLOWS.md'], /分析链路/);
  assert.match(set.docs['QUESTIONS.md'], /是否需要 SQLite/);
});

test('buildDocumentSet fails when no report is available', () => {
  assert.throws(() => buildDocumentSet({ report: null, scan: {} }), /No report available/);
});
