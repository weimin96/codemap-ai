import { buildFlowsMermaid } from './flow-analyzer.js';

export function normalizeReport(report, contextPack = null, scan = null) {
  const contextSummary = contextPack ? summarizeContextPack(contextPack) : null;
  const modules = Array.isArray(report.modules) ? report.modules.map((module, index) => normalizeModule(module, index)) : [];
  const flows = Array.isArray(report.flows) ? report.flows.map(normalizeFlow) : [];
  const risks = Array.isArray(report.risks) ? report.risks.map((risk, index) => normalizeRisk(risk, index)) : [];
  const contextFiles = contextSummary?.files || [];
  return {
    generatedBy: report.generatedBy || 'ai',
    projectOverview: report.projectOverview || {},
    analysisQuality: normalizeAnalysisQuality(report.analysisQuality, contextSummary, scan),
    architecture: normalizeArchitecture(report.architecture),
    entrypoints: Array.isArray(report.entrypoints) ? report.entrypoints : [],
    modules,
    flows,
    dataModel: normalizeDataModel(report.dataModel),
    risks,
    readingPlan: Array.isArray(report.readingPlan) ? report.readingPlan : [],
    unknowns: Array.isArray(report.unknowns) ? report.unknowns : [],
    evidenceIndex: normalizeEvidenceIndex(report.evidenceIndex, modules, flows, risks),
    mermaid: typeof report.mermaid === 'string' && report.mermaid.trim() ? report.mermaid : buildFlowsMermaid(flows),
    contextFiles
  };
}

export function summarizeContextPack(contextPack) {
  return {
    generatedAt: contextPack.generatedAt,
    mode: contextPack.mode,
    target: contextPack.target,
    budget: contextPack.budget,
    skippedFiles: Array.isArray(contextPack.skippedFiles) ? contextPack.skippedFiles : [],
    files: contextPack.files.map((file) => ({
      path: file.path,
      role: file.role,
      priority: file.priority,
      language: file.language,
      score: file.score,
      charCount: file.charCount,
      truncated: file.truncated
    }))
  };
}

function normalizeModule(module, index) {
  const id = normalizeId(module.id || module.name || `module-${index + 1}`);
  const paths = asStringArray(module.paths);
  const evidence = normalizeEvidence(module.evidence, paths);
  return {
    ...module,
    id,
    name: module.name || `模块 ${index + 1}`,
    paths,
    summary: module.summary || module.responsibility || '',
    responsibility: Array.isArray(module.responsibility) ? module.responsibility.join('；') : module.responsibility || '',
    responsibilities: asStringArray(module.responsibilities || module.responsibility),
    businessCapabilities: Array.isArray(module.businessCapabilities) ? module.businessCapabilities.map(normalizeCapability) : [],
    entrypoints: Array.isArray(module.entrypoints) ? module.entrypoints.map(normalizeModuleEntrypoint) : [],
    dependencies: Array.isArray(module.dependencies) ? module.dependencies.map(normalizeModuleDependency) : [],
    dataEntities: asStringArray(module.dataEntities),
    coreFlows: asStringArray(module.coreFlows),
    keyFiles: normalizeEvidence(module.keyFiles, paths),
    risks: asStringArray(module.risks),
    priority: module.priority || 'P1',
    confidence: module.confidence || 'guess',
    evidence,
    ...normalizeVerification(module)
  };
}

function normalizeCapability(capability) {
  return {
    name: capability.name || '未命名能力',
    description: capability.description || '',
    importance: capability.importance || 'important',
    evidence: normalizeEvidence(capability.evidence)
  };
}

function normalizeModuleEntrypoint(entrypoint) {
  return {
    name: entrypoint.name || entrypoint.path || '未命名入口',
    path: entrypoint.path || '',
    method: entrypoint.method || '',
    route: entrypoint.route || '',
    kind: entrypoint.kind || 'unknown',
    evidence: normalizeEvidence(entrypoint.evidence, entrypoint.path ? [entrypoint.path] : [])
  };
}

function normalizeModuleDependency(dependency) {
  return {
    moduleId: normalizeId(dependency.moduleId || dependency.name || ''),
    reason: dependency.reason || '',
    evidence: normalizeEvidence(dependency.evidence)
  };
}

function normalizeFlow(flow) {
  const steps = Array.isArray(flow.steps)
    ? flow.steps.map((step, index) => ({
        order: Number(step.order) || index + 1,
        path: step.path || '',
        symbol: step.symbol || '',
        startLine: step.startLine,
        endLine: step.endLine,
        description: step.description || '',
        confidence: step.confidence || flow.confidence || 'guess'
      }))
    : [];
  return {
    ...flow,
    id: flow.id || normalizeId(flow.name || 'flow'),
    kind: flow.kind || 'unknown',
    priority: flow.priority || 'P1',
    confidence: flow.confidence || 'guess',
    steps,
    dataReads: asStringArray(flow.dataReads),
    dataWrites: asStringArray(flow.dataWrites),
    externalCalls: asStringArray(flow.externalCalls),
    breakpoints: asStringArray(flow.breakpoints),
    notes: asStringArray(flow.notes),
    unknowns: asStringArray(flow.unknowns),
    evidence: normalizeEvidence(flow.evidence, steps.map((step) => step.path).filter(Boolean)),
    ...normalizeVerification(flow)
  };
}

function normalizeRisk(risk, index) {
  const fallbackPath = risk.path ? [risk.path] : [];
  return {
    ...risk,
    id: risk.id || normalizeId(risk.title || `risk-${index + 1}`),
    title: risk.title || `风险 ${index + 1}`,
    level: risk.level || 'medium',
    reason: risk.reason || '',
    impact: risk.impact || '',
    verify: risk.verify || asStringArray(risk.verifySteps).join('；'),
    verifySteps: asStringArray(risk.verifySteps || risk.verify),
    suggestedTests: asStringArray(risk.suggestedTests),
    confidence: risk.confidence || 'guess',
    evidence: normalizeEvidence(risk.evidence, fallbackPath, risk.reason || risk.title || ''),
    ...normalizeVerification(risk)
  };
}

function normalizeAnalysisQuality(quality, contextSummary, scan) {
  const budget = contextSummary?.budget || {};
  return {
    scannedFiles: Number(quality?.scannedFiles ?? scan?.totalFiles ?? scan?.files?.length ?? 0),
    indexedSymbols: Number(quality?.indexedSymbols ?? scan?.totalSymbols ?? scan?.repoMap?.totals?.symbols ?? 0),
    contextFiles: Array.isArray(quality?.contextFiles) ? quality.contextFiles : contextSummary?.files || [],
    skippedFiles: Array.isArray(quality?.skippedFiles) ? quality.skippedFiles : contextSummary?.skippedFiles || [],
    parseWarnings: Array.isArray(quality?.parseWarnings) ? quality.parseWarnings : [],
    confidence: quality?.confidence || 'guess',
    tokenBudget: quality?.tokenBudget || estimateTokenBudget(budget)
  };
}

function normalizeArchitecture(architecture) {
  if (!architecture || typeof architecture !== 'object') return { summary: '', mermaid: '', evidence: [] };
  return {
    summary: architecture.summary || '',
    mermaid: architecture.mermaid || '',
    evidence: normalizeEvidence(architecture.evidence)
  };
}

function normalizeDataModel(dataModel) {
  return {
    entities: Array.isArray(dataModel?.entities) ? dataModel.entities.map(normalizeDataEntity) : [],
    relations: Array.isArray(dataModel?.relations) ? dataModel.relations.map(normalizeDataRelation) : [],
    stateMachines: Array.isArray(dataModel?.stateMachines) ? dataModel.stateMachines.map(normalizeStateMachine) : [],
    keyFields: Array.isArray(dataModel?.keyFields) ? dataModel.keyFields.map(normalizeKeyField) : [],
    risks: Array.isArray(dataModel?.risks) ? dataModel.risks.map(normalizeDataRisk) : []
  };
}

function normalizeDataEntity(entity) {
  return {
    id: normalizeId(entity.id || entity.name || 'entity'),
    name: entity.name || '未命名实体',
    description: entity.description || '',
    moduleId: entity.moduleId ? normalizeId(entity.moduleId) : '',
    keyFields: asStringArray(entity.keyFields),
    evidence: normalizeEvidence(entity.evidence),
    ...normalizeVerification(entity)
  };
}

function normalizeDataRelation(relation) {
  return {
    from: relation.from || '',
    to: relation.to || '',
    type: relation.type || 'related',
    reason: relation.reason || '',
    evidence: normalizeEvidence(relation.evidence)
  };
}

function normalizeStateMachine(machine) {
  return {
    entity: machine.entity || '',
    field: machine.field || '',
    states: asStringArray(machine.states),
    transitions: Array.isArray(machine.transitions) ? machine.transitions.map((transition) => ({
      from: transition.from || '',
      to: transition.to || '',
      trigger: transition.trigger || '',
      evidence: normalizeEvidence(transition.evidence)
    })) : []
  };
}

function normalizeKeyField(field) {
  return {
    entity: field.entity || '',
    field: field.field || '',
    reason: field.reason || '',
    evidence: normalizeEvidence(field.evidence)
  };
}

function normalizeDataRisk(risk) {
  return {
    title: risk.title || '未命名数据风险',
    reason: risk.reason || '',
    evidence: normalizeEvidence(risk.evidence)
  };
}

function normalizeEvidenceIndex(evidenceIndex, modules, flows, risks) {
  if (Array.isArray(evidenceIndex?.files)) return { files: normalizeEvidence(evidenceIndex.files) };
  const files = [
    ...modules.flatMap((module) => normalizeEvidence(module.evidence)),
    ...flows.flatMap((flow) => normalizeEvidence(flow.evidence)),
    ...risks.flatMap((risk) => normalizeEvidence(risk.evidence))
  ];
  const seen = new Set();
  return {
    files: files.filter((file) => {
      const key = `${file.path}:${file.symbol || ''}:${file.startLine || ''}:${file.endLine || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  };
}

function normalizeEvidence(value, fallbackPaths = [], fallbackReason = '') {
  if (Array.isArray(value)) {
    return value.map((item) => toCodeReference(item)).filter((item) => item.path);
  }
  if (typeof value === 'string' && value.trim()) {
    return fallbackPaths.map((path) => ({ path, reason: value.trim(), confidence: 'guess' }));
  }
  return fallbackPaths.map((path) => ({ path, reason: fallbackReason || '报告字段引用该文件', confidence: 'guess' }));
}

function toCodeReference(item) {
  if (typeof item === 'string') return { path: item, reason: '报告字段引用该文件', confidence: 'guess' };
  return {
    path: item.path || '',
    symbol: item.symbol || '',
    startLine: item.startLine,
    endLine: item.endLine,
    reason: item.reason || '报告字段引用该文件',
    confidence: item.confidence || 'guess'
  };
}

function normalizeVerification(value) {
  return {
    verificationStatus: normalizeVerificationStatus(value?.verificationStatus),
    verifiedBy: value?.verifiedBy || '',
    verifiedAt: value?.verifiedAt || '',
    verificationNote: value?.verificationNote || value?.note || ''
  };
}

function normalizeVerificationStatus(value) {
  const allowed = new Set(['ai_guess', 'verified', 'rejected', 'pending', 'stale']);
  return allowed.has(value) ? value : 'ai_guess';
}

function asStringArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function estimateTokenBudget(budget) {
  if (!budget || (!budget.maxChars && !budget.usedChars)) return { max: 0, used: 0 };
  return {
    max: Math.ceil((budget.maxChars || 0) / 3),
    used: Math.ceil((budget.usedChars || 0) / 3)
  };
}
