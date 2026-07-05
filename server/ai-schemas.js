import { z } from 'zod';

export const ConfidenceSchema = z.enum(['fact', 'guess', 'unknown']);
export const PrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);
export const RiskLevelSchema = z.enum(['high', 'medium', 'low']);
export const RiskCategorySchema = z.enum([
  'permission',
  'state',
  'idempotency',
  'transaction',
  'concurrency',
  'cache',
  'external',
  'test',
  'data',
  'ai-change'
]);

export const CodeReferenceSchema = z.object({
  path: z.string().min(1),
  symbol: z.string().min(1).optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  reason: z.string().min(1),
  confidence: ConfidenceSchema
});

const ProjectOverviewSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  startup: z.string().optional(),
  confidence: ConfidenceSchema.optional(),
  summary: z.string().optional()
});

const ArchitectureSchema = z.object({
  summary: z.string().optional(),
  mermaid: z.string().optional(),
  evidence: z.array(CodeReferenceSchema).optional()
});

const EntryPointSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  kind: z.string().min(1),
  confidence: ConfidenceSchema,
  evidence: z.array(CodeReferenceSchema).optional()
});

const BusinessCapabilitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  importance: z.enum(['core', 'important', 'supporting']).optional(),
  evidence: z.array(CodeReferenceSchema).optional()
});

const ModuleEntryPointSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  method: z.string().optional(),
  route: z.string().optional(),
  kind: z.string().optional(),
  evidence: z.array(CodeReferenceSchema).optional()
});

const ModuleDependencySchema = z.object({
  moduleId: z.string().min(1),
  reason: z.string().min(1),
  evidence: z.array(CodeReferenceSchema).optional()
});

export const ProjectModuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  paths: z.array(z.string().min(1)),
  summary: z.string().optional(),
  responsibility: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  businessCapabilities: z.array(BusinessCapabilitySchema).optional(),
  entrypoints: z.array(ModuleEntryPointSchema).optional(),
  dependencies: z.array(ModuleDependencySchema).optional(),
  dataEntities: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  coreFlows: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  keyFiles: z.array(CodeReferenceSchema).optional(),
  risks: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  priority: PrioritySchema,
  confidence: ConfidenceSchema,
  evidence: z.array(CodeReferenceSchema).optional()
});

export const FlowStepSchema = z.object({
  order: z.number().int().positive(),
  path: z.string().min(1),
  symbol: z.string().optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  description: z.string().min(1),
  confidence: ConfidenceSchema
});

export const ProjectFlowSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['api', 'page', 'cli', 'worker', 'consumer', 'job', 'unknown']),
  name: z.string().min(1),
  trigger: z.string().optional(),
  priority: PrioritySchema,
  confidence: ConfidenceSchema,
  steps: z.array(FlowStepSchema),
  dataReads: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  dataWrites: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  externalCalls: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  breakpoints: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  unknowns: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  notes: z.array(z.string()).optional(),
  evidence: z.array(CodeReferenceSchema).optional(),
  mermaid: z.string().optional(),
  sequenceDiagram: z.string().optional()
});

const DataEntitySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  moduleId: z.string().optional(),
  keyFields: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  evidence: z.array(CodeReferenceSchema).optional()
});

const DataRelationSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.string().optional(),
  reason: z.string().optional(),
  evidence: z.array(CodeReferenceSchema).optional()
});

const StateTransitionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  trigger: z.string().optional(),
  evidence: z.array(CodeReferenceSchema).optional()
});

const StateMachineSchema = z.object({
  entity: z.string().min(1),
  field: z.string().min(1),
  states: z.array(z.string()),
  transitions: z.array(StateTransitionSchema).optional()
});

const KeyFieldSchema = z.object({
  entity: z.string().min(1),
  field: z.string().min(1),
  reason: z.string().optional(),
  evidence: z.array(CodeReferenceSchema).optional()
});

const DataRiskSchema = z.object({
  title: z.string().min(1),
  reason: z.string().optional(),
  evidence: z.array(CodeReferenceSchema).optional()
});

export const DataModelSchema = z.object({
  entities: z.array(DataEntitySchema).optional(),
  relations: z.array(DataRelationSchema).optional(),
  stateMachines: z.array(StateMachineSchema).optional(),
  keyFields: z.array(KeyFieldSchema).optional(),
  risks: z.array(DataRiskSchema).optional()
});

export const ProjectRiskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  level: RiskLevelSchema,
  category: RiskCategorySchema,
  moduleId: z.string().optional(),
  flowId: z.string().optional(),
  path: z.string().optional(),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  reason: z.string().min(1),
  impact: z.string().optional(),
  verify: z.string().optional(),
  verifySteps: z.array(z.string()).optional(),
  suggestedTests: z.array(z.string()).optional(),
  confidence: ConfidenceSchema,
  evidence: z.array(CodeReferenceSchema).optional()
});

const ReadingPlanItemSchema = z.object({
  timebox: z.string().optional(),
  goal: z.string().min(1),
  files: z.array(z.string()).optional(),
  output: z.string().optional()
});

const TokenBudgetSchema = z.object({
  max: z.number().optional(),
  used: z.number().optional()
});

const AnalysisQualitySchema = z.object({
  scannedFiles: z.number().optional(),
  indexedSymbols: z.number().optional(),
  contextFiles: z.array(z.string()).optional(),
  skippedFiles: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  parseWarnings: z.array(z.string()).optional(),
  unsupportedClaims: z.array(z.record(z.any())).optional(),
  confidence: ConfidenceSchema.optional(),
  tokenBudget: TokenBudgetSchema.optional(),
  partial: z.boolean().optional(),
  stage: z.string().optional(),
  aiCalls: z.array(z.record(z.any())).optional()
});

const EvidenceIndexSchema = z.object({
  files: z.array(CodeReferenceSchema).optional()
});

export const AnalysisReportSchema = z.object({
  generatedBy: z.string().optional(),
  projectOverview: ProjectOverviewSchema,
  analysisQuality: AnalysisQualitySchema.optional(),
  architecture: ArchitectureSchema.optional(),
  entrypoints: z.array(EntryPointSchema).optional(),
  modules: z.array(ProjectModuleSchema),
  flows: z.array(ProjectFlowSchema),
  dataModel: DataModelSchema.optional(),
  risks: z.array(ProjectRiskSchema),
  readingPlan: z.array(ReadingPlanItemSchema).optional(),
  unknowns: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  evidenceIndex: EvidenceIndexSchema.optional(),
  mermaid: z.string().optional()
});

export const AskAnswerSchema = z.object({
  conclusion: z.string().min(1),
  evidence: z.array(CodeReferenceSchema),
  risks: z.array(z.string()),
  nextActions: z.array(z.string()),
  relatedFiles: z.array(CodeReferenceSchema),
  confidence: ConfidenceSchema,
  markdown: z.string()
});

export const OverviewStageSchema = z.object({
  projectOverview: ProjectOverviewSchema.optional(),
  architecture: ArchitectureSchema.optional(),
  entrypoints: z.array(EntryPointSchema).optional(),
  readingPlan: z.array(ReadingPlanItemSchema).optional(),
  unknowns: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  mermaid: z.string().optional(),
  parseWarnings: z.array(z.string()).optional()
});

export const ModulesStageSchema = z.object({
  modules: z.array(ProjectModuleSchema).optional(),
  parseWarnings: z.array(z.string()).optional()
});

export const FlowsStageSchema = z.object({
  flows: z.array(ProjectFlowSchema).optional(),
  parseWarnings: z.array(z.string()).optional()
});

export const RisksStageSchema = z.object({
  risks: z.array(ProjectRiskSchema).optional(),
  dataModel: DataModelSchema.optional(),
  unknowns: z.array(z.union([z.string(), z.record(z.any())])).optional(),
  readingPlan: z.array(ReadingPlanItemSchema).optional(),
  evidenceIndex: EvidenceIndexSchema.optional(),
  parseWarnings: z.array(z.string()).optional()
});
