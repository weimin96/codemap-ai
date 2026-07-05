import { analyzeFlowsWithAI, analyzeModulesWithAI, analyzeOverviewWithAI, analyzeRisksWithAI } from './ai.js';
import { buildCodeGraph } from './code-graph.js';
import { buildContextPack } from './context-pack.js';
import { normalizeReport, summarizeContextPack } from './report-normalizer.js';
import { verifyReportEvidence } from './evidence-verifier.js';
import { scanProject } from './scanner.js';
import { deleteProjectReport, writeProjectReport } from './report-store.js';
import { recordCodeGraph, recordReport, recordScanRun } from './sqlite-store.js';

const OVERVIEW_MAX_CHARS = 36_000;
const STAGE_MAX_CHARS = 42_000;
const MODULE_BATCH_SIZE = 3;
const FLOW_BATCH_SIZE = 3;
const MODULE_LIMIT = 8;
const FLOW_LIMIT = 6;

export async function runAnalysisJob({ projectDir, cache, config, signal, onProgress = () => {}, onPartial = () => {} }) {
  const stagePacks = [];
  const stageState = { overview: {}, modules: [], flows: [], riskResult: {} };
  const assertActive = () => {
    if (signal?.aborted) throw new Error('Analysis was cancelled.');
  };
  const emit = (phase, label, value) => onProgress({ phase, label, value });

  emit('scan', '扫描项目结构', 10);
  if (!cache.scan) {
    cache.scan = await scanProject(projectDir);
    await recordScanRun(projectDir, cache.scan);
  }
  assertActive();

  emit('graph', '构建代码图谱', 25);
  if (!cache.codeGraph) {
    cache.codeGraph = await buildCodeGraph({ root: projectDir, scan: cache.scan });
    await recordCodeGraph(projectDir, cache.codeGraph);
  }
  assertActive();

  cache.report = null;
  await deleteProjectReport(projectDir);

  emit('overview', 'AI 分析项目总览', 35);
  const overviewPack = await buildContextPack({ root: projectDir, scan: cache.scan, mode: 'overview', maxChars: OVERVIEW_MAX_CHARS, codeGraph: cache.codeGraph });
  stagePacks.push(overviewPack);
  const overview = await analyzeOverviewWithAI({ scan: cache.scan, contextPack: overviewPack, config, signal });
  stageState.overview = overview;
  await emitPartial(projectDir, 'overview', stageState, stagePacks, cache.scan, onPartial);
  assertActive();

  const moduleCandidates = selectModuleCandidates(cache.scan);
  const modules = [];
  for (let index = 0; index < moduleCandidates.length; index += MODULE_BATCH_SIZE) {
    const batch = moduleCandidates.slice(index, index + MODULE_BATCH_SIZE);
    const batchNo = Math.floor(index / MODULE_BATCH_SIZE) + 1;
    const batchTotal = Math.ceil(moduleCandidates.length / MODULE_BATCH_SIZE) || 1;
    emit('modules', `AI 分析模块 ${batchNo}/${batchTotal}`, 45 + Math.min(15, batchNo * 5));
    const modulePack = await buildContextPack({ root: projectDir, scan: cache.scan, mode: 'module', target: { modules: batch }, maxChars: STAGE_MAX_CHARS, codeGraph: cache.codeGraph });
    stagePacks.push(modulePack);
    const result = await analyzeModulesWithAI({ scan: cache.scan, contextPack: modulePack, candidates: batch, config, signal });
    modules.push(...result.modules);
    stageState.modules = modules;
    await emitPartial(projectDir, 'modules', stageState, stagePacks, cache.scan, onPartial);
    assertActive();
  }

  const flowCandidates = selectFlowCandidates(cache.scan, cache.codeGraph);
  const flows = [];
  for (let index = 0; index < flowCandidates.length; index += FLOW_BATCH_SIZE) {
    const batch = flowCandidates.slice(index, index + FLOW_BATCH_SIZE);
    const batchNo = Math.floor(index / FLOW_BATCH_SIZE) + 1;
    const batchTotal = Math.ceil(flowCandidates.length / FLOW_BATCH_SIZE) || 1;
    emit('flows', `AI 分析链路 ${batchNo}/${batchTotal}`, 62 + Math.min(12, batchNo * 6));
    const flowPack = await buildContextPack({ root: projectDir, scan: cache.scan, mode: 'flow', target: { flows: batch }, maxChars: STAGE_MAX_CHARS, codeGraph: cache.codeGraph });
    stagePacks.push(flowPack);
    const result = await analyzeFlowsWithAI({ scan: cache.scan, contextPack: flowPack, candidates: batch, modules, config, signal });
    flows.push(...result.flows);
    stageState.flows = flows;
    await emitPartial(projectDir, 'flows', stageState, stagePacks, cache.scan, onPartial);
    assertActive();
  }

  emit('risks', 'AI 分析风险与数据模型', 82);
  const riskPack = await buildContextPack({ root: projectDir, scan: cache.scan, mode: 'risk', target: { files: selectRiskFiles(cache.scan), modules, flows }, maxChars: STAGE_MAX_CHARS, codeGraph: cache.codeGraph });
  stagePacks.push(riskPack);
  const riskResult = await analyzeRisksWithAI({ scan: cache.scan, contextPack: riskPack, overview, modules, flows, config, signal });
  stageState.riskResult = riskResult;
  await emitPartial(projectDir, 'risks', stageState, stagePacks, cache.scan, onPartial);
  assertActive();

  emit('merge', '合并阶段结果', 94);
  const mergedContextPack = mergeContextPacks(stagePacks);
  cache.contextPack = mergedContextPack;
  const mergedReport = mergeStageReport({ overview, modules, flows, riskResult });
  cache.report = await verifyReportEvidence({ root: projectDir, scan: cache.scan, report: normalizeReport(mergedReport, mergedContextPack, cache.scan) });
  await writeProjectReport(projectDir, cache.report);
  await recordReport(projectDir, cache.report);
  emit('done', '完成', 100);
  return { report: cache.report, contextPack: summarizeContextPack(mergedContextPack) };
}

export async function buildPartialReport({ root, stage, state, contextPack, scan }) {
  const report = normalizeReport(mergeStageReport(state), contextPack, scan);
  report.generatedBy = 'ai-staged-partial';
  report.analysisQuality = {
    ...report.analysisQuality,
    stage,
    partial: true,
    confidence: report.analysisQuality?.confidence || 'guess'
  };
  return await verifyReportEvidence({ root, scan, report });
}

export function mergeStageReport({ overview = {}, modules = [], flows = [], riskResult = {} }) {
  return {
    generatedBy: 'ai-staged',
    projectOverview: overview.projectOverview || {},
    architecture: overview.architecture || {},
    entrypoints: overview.entrypoints || [],
    modules: modules.slice(0, MODULE_LIMIT),
    flows: flows.slice(0, FLOW_LIMIT),
    dataModel: riskResult.dataModel || {},
    risks: riskResult.risks || [],
    readingPlan: [...(overview.readingPlan || []), ...(riskResult.readingPlan || [])].slice(0, 8),
    unknowns: [...(overview.unknowns || []), ...(riskResult.unknowns || [])],
    evidenceIndex: riskResult.evidenceIndex || {},
    mermaid: overview.mermaid || overview.architecture?.mermaid || ''
  };
}

async function emitPartial(root, stage, state, packs, scan, onPartial) {
  const contextPack = mergeContextPacks(packs);
  onPartial({ stage, report: await buildPartialReport({ root, stage, state, contextPack, scan }), contextPack: summarizeContextPack(contextPack) });
}

export function selectModuleCandidates(scan) {
  const repoModules = scan.repoMap?.modules || [];
  if (repoModules.length) {
    return repoModules.slice(0, MODULE_LIMIT).map((module) => ({
      name: module.name,
      priority: module.priority,
      topFiles: module.topFiles || [],
      roles: module.roles || [],
      fileCount: module.fileCount,
      symbolCount: module.symbolCount
    }));
  }
  return (scan.keyFiles || []).slice(0, MODULE_LIMIT).map((file) => ({
    name: file.path.split('/').slice(0, -1).join('/') || file.path,
    priority: file.priority,
    topFiles: [file.path],
    roles: [file.role],
    fileCount: 1,
    symbolCount: file.symbols?.length || 0
  }));
}

export function selectFlowCandidates(scan, codeGraph) {
  const entrypoints = scan.repoMap?.entrypoints?.length ? scan.repoMap.entrypoints : scan.keyFiles || [];
  return entrypoints.slice(0, FLOW_LIMIT).map((file) => ({
    name: file.path,
    path: file.path,
    role: file.role,
    priority: file.priority,
    language: file.language,
    symbols: (file.symbols || []).slice(0, 8),
    neighbors: graphNeighborsForPath(codeGraph, file.path).slice(0, 12)
  }));
}

export function selectRiskFiles(scan) {
  const pattern = /auth|permission|login|session|token|password|secret|env|config|db|database|sql|model|schema|cache|queue|worker|payment|webhook|upload|download|fs|http|client|api/i;
  return (scan.files || [])
    .filter((file) => file.text && pattern.test(`${file.path} ${file.role}`))
    .sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority) || b.size - a.size)
    .slice(0, 24)
    .map((file) => file.path);
}

function graphNeighborsForPath(codeGraph, path) {
  if (!codeGraph?.nodes?.length) return [];
  const nodeIds = new Set(codeGraph.nodes.filter((node) => node.path === path).map((node) => node.id));
  if (!nodeIds.size) return [];
  const nodesById = new Map(codeGraph.nodes.map((node) => [node.id, node]));
  const neighbors = [];
  for (const edge of codeGraph.edges || []) {
    const sourceHit = nodeIds.has(edge.source);
    const targetHit = nodeIds.has(edge.target);
    if (!sourceHit && !targetHit) continue;
    const related = nodesById.get(sourceHit ? edge.target : edge.source);
    if (related) neighbors.push({ edge: edge.type, confidence: edge.confidence, path: related.path, name: related.name, type: related.type });
  }
  return neighbors;
}

function mergeContextPacks(packs) {
  const [first] = packs;
  const fileMap = new Map();
  const chunkMap = new Map();
  const skipped = new Map();
  let usedChars = 0;
  let maxChars = 0;
  for (const pack of packs) {
    maxChars += pack?.budget?.maxChars || 0;
    usedChars += pack?.budget?.usedChars || 0;
    for (const file of pack?.files || []) {
      const current = fileMap.get(file.path);
      if (!current || file.score > current.score) fileMap.set(file.path, file);
    }
    for (const chunk of pack?.chunks || []) {
      if (!chunkMap.has(chunk.path)) chunkMap.set(chunk.path, chunk);
    }
    for (const item of pack?.skippedFiles || []) skipped.set(`${item.path}:${item.reason}`, item);
  }
  return {
    generatedAt: new Date().toISOString(),
    mode: 'staged',
    target: { stages: packs.map((pack) => pack?.mode).filter(Boolean) },
    budget: { maxChars, usedChars, estimatedTokens: Math.ceil(usedChars / 3) },
    files: Array.from(fileMap.values()),
    chunks: Array.from(chunkMap.values()),
    skippedFiles: Array.from(skipped.values()),
    markdown: first?.markdown || ''
  };
}

function priorityWeight(priority) {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority] ?? 4;
}
