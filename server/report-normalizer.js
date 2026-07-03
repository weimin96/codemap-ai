import { buildFlowsMermaid } from './flow-analyzer.js';

export function normalizeReport(report, contextPack = null) {
  const flows = Array.isArray(report.flows) ? report.flows.map(normalizeFlow) : [];
  return {
    generatedBy: report.generatedBy || 'ai',
    projectOverview: report.projectOverview || {},
    entrypoints: Array.isArray(report.entrypoints) ? report.entrypoints : [],
    modules: Array.isArray(report.modules) ? report.modules : [],
    flows,
    risks: Array.isArray(report.risks) ? report.risks : [],
    readingPlan: Array.isArray(report.readingPlan) ? report.readingPlan : [],
    unknowns: Array.isArray(report.unknowns) ? report.unknowns : [],
    mermaid: typeof report.mermaid === 'string' && report.mermaid.trim() ? report.mermaid : buildFlowsMermaid(flows),
    contextFiles: contextPack ? summarizeContextPack(contextPack).files : []
  };
}

export function summarizeContextPack(contextPack) {
  return {
    generatedAt: contextPack.generatedAt,
    budget: contextPack.budget,
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
    kind: flow.kind || 'unknown',
    priority: flow.priority || 'P1',
    confidence: flow.confidence || 'guess',
    steps,
    dataReads: Array.isArray(flow.dataReads) ? flow.dataReads : [],
    dataWrites: Array.isArray(flow.dataWrites) ? flow.dataWrites : [],
    externalCalls: Array.isArray(flow.externalCalls) ? flow.externalCalls : [],
    breakpoints: Array.isArray(flow.breakpoints) ? flow.breakpoints : [],
    notes: Array.isArray(flow.notes) ? flow.notes : [],
    unknowns: Array.isArray(flow.unknowns) ? flow.unknowns : []
  };
}
