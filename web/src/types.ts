export type Confidence = 'fact' | 'guess' | 'unknown';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type VerificationStatus = 'ai_guess' | 'verified' | 'rejected' | 'pending' | 'stale';
export type NoticeType = 'error' | 'warning' | 'success' | 'info';

export interface Notice {
  type: NoticeType;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export interface VerificationFields {
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNote?: string;
}

export type SymbolKind = 'function' | 'class' | 'method' | 'interface' | 'type' | 'constant';
export type FlowKind = 'api' | 'page' | 'cli' | 'worker' | 'consumer' | 'job' | 'unknown' | string;

export interface CodeGraphNode {
  id: string;
  type: string;
  name: string;
  path?: string;
  startLine?: number;
  endLine?: number;
}

export interface CodeGraphEdge {
  source: string;
  target: string;
  type: string;
  line?: number;
  confidence?: Confidence;
}

export interface CodeGraphWarning {
  path: string;
  kind: string;
  message: string;
}

export interface CodeGraph {
  generatedAt: string;
  languageScope: string[];
  totals: { nodes: number; edges: number; files: number; warnings: number };
  nodes: CodeGraphNode[];
  edges: CodeGraphEdge[];
  warnings: CodeGraphWarning[];
}

export interface SymbolInfo {
  id: string;
  name: string;
  kind: SymbolKind;
  path: string;
  startLine: number;
  endLine: number;
  signature?: string;
}

export interface FilePayload {
  path: string;
  content: string;
  truncated: boolean;
  size: number;
}

export interface ScanFile {
  path: string;
  type: 'file';
  role: string;
  priority: Priority;
  language: string;
  text: boolean;
  size: number;
  symbols?: SymbolInfo[];
}

export interface RepoMapFile {
  path: string;
  role: string;
  priority: Priority;
  language: string;
  size: number;
  importance: number;
  symbols: Array<Pick<SymbolInfo, 'name' | 'kind' | 'startLine' | 'endLine' | 'signature'>>;
}

export interface ContextFile {
  path: string;
  role: string;
  priority: Priority;
  language: string;
  score: number;
  charCount: number;
  truncated?: boolean;
}

export interface AiConfig {
  provider: string;
  baseURL: string;
  model: string;
  apiKey: string;
  timeoutMs?: number | string;
  fallbackPolicy?: 'local-only' | 'confirm-cloud-fallback' | 'cloud-ok' | string;
}

export interface RepoMap {
  generatedAt: string;
  totals: { files: number; textFiles: number; symbols: number };
  entrypoints: RepoMapFile[];
  importantFiles: RepoMapFile[];
  modules: Array<{ name: string; fileCount: number; symbolCount: number; priority: Priority; topFiles: string[]; roles: string[] }>;
}

export interface CodeReference {
  path: string;
  symbol?: string;
  startLine?: number;
  endLine?: number;
  reason: string;
  confidence?: Confidence;
}

export interface AnalysisQuality {
  scannedFiles: number;
  indexedSymbols: number;
  contextFiles: ContextFile[];
  skippedFiles: Array<{ path: string; reason: string }>;
  parseWarnings: Array<{ path: string; reason: string }>;
  confidence: Confidence;
  partial?: boolean;
  stage?: string;
  tokenBudget?: {
    max: number;
    used: number;
  };
}

export interface BusinessCapability {
  name: string;
  description: string;
  importance: 'core' | 'important' | 'supporting';
  evidence: CodeReference[];
}

export interface ModuleEntrypoint {
  name: string;
  path: string;
  method?: string;
  route?: string;
  kind: string;
  evidence: CodeReference[];
}

export interface ModuleDependency {
  moduleId: string;
  reason: string;
  evidence: CodeReference[];
}

export interface ProjectModule extends VerificationFields {
  id?: string;
  name: string;
  paths: string[];
  summary?: string;
  responsibility: string;
  responsibilities?: string[];
  businessCapabilities?: BusinessCapability[];
  entrypoints?: ModuleEntrypoint[];
  dependencies?: ModuleDependency[];
  dataEntities?: string[];
  coreFlows?: string[];
  keyFiles?: CodeReference[];
  risks?: string[];
  priority: Priority;
  confidence: Confidence;
  evidence?: string | CodeReference[];
}

export interface FlowStep {
  order: number;
  path: string;
  symbol?: string;
  startLine?: number;
  endLine?: number;
  description: string;
  confidence?: Confidence;
}

export interface CoreFlow extends VerificationFields {
  id?: string;
  kind?: FlowKind;
  name: string;
  trigger: string;
  priority: Priority;
  confidence: Confidence;
  steps: FlowStep[];
  dataReads?: string[];
  dataWrites?: string[];
  externalCalls?: string[];
  breakpoints?: string[];
  unknowns?: string[];
  notes?: string[];
  mermaid?: string;
  sequenceDiagram?: string;
  evidence?: CodeReference[];
}

export interface DataEntity extends VerificationFields {
  id: string;
  name: string;
  description: string;
  moduleId?: string;
  keyFields?: string[];
  evidence: CodeReference[];
}

export interface DataRelation {
  from: string;
  to: string;
  type: string;
  reason: string;
  evidence: CodeReference[];
}

export interface StateMachine {
  entity: string;
  field: string;
  states: string[];
  transitions: Array<{ from: string; to: string; trigger: string; evidence: CodeReference[] }>;
}

export interface DataModel {
  entities: DataEntity[];
  relations: DataRelation[];
  stateMachines: StateMachine[];
  keyFields: Array<{ entity: string; field: string; reason: string; evidence: CodeReference[] }>;
  risks: Array<{ title: string; reason: string; evidence: CodeReference[] }>;
}

export interface RiskItem extends VerificationFields {
  id?: string;
  title: string;
  level: 'high' | 'medium' | 'low';
  category?: 'permission' | 'state' | 'idempotency' | 'transaction' | 'concurrency' | 'cache' | 'external' | 'test' | 'data' | 'ai-change' | string;
  moduleId?: string;
  flowId?: string;
  path?: string;
  startLine?: number;
  endLine?: number;
  reason: string;
  impact?: string;
  verify: string;
  verifySteps?: string[];
  suggestedTests?: string[];
  confidence?: Confidence;
  evidence?: CodeReference[];
}

export interface ScenarioQuiz {
  type: 'scenario' | string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface CourseSnippet {
  path: string;
  startLine: number;
  endLine: number;
  purpose: string;
  code: string;
  confidence?: Confidence;
}

export interface CodeTranslationBlock {
  path: string;
  startLine: number;
  endLine: number;
  code: string;
  plainEnglish: string[];
  roleInFlow: string;
}

export interface ModuleBrief {
  id: string;
  title: string;
  openingHook: string;
  whyCare: string;
  actors: string[];
  snippets: CourseSnippet[];
  quizIdeas: ScenarioQuiz[];
  riskLinks?: string[];
  flowLinks?: string[];
}

export interface CourseModule {
  id: string;
  title: string;
  briefId: string;
  userAction: string;
  whyCare: string;
  coreFiles: string[];
  flows: string[];
  risks: string[];
  codeTranslations: CodeTranslationBlock[];
  quiz: ScenarioQuiz[];
}

export interface CourseMaterials {
  version: string;
  generatedAt: string;
  projectName: string;
  courseModules: CourseModule[];
  moduleBriefs: ModuleBrief[];
  evidenceSummary: {
    files: number;
    symbols: number;
    graphNodes: number;
    graphEdges: number;
  };
}

export interface EvidenceIndex {
  files: CodeReference[];
}

export interface AskThreadEntry {
  id: string;
  projectId: string;
  scopeKey: string;
  scopeType: 'project' | 'module' | 'flow' | 'risk' | 'file' | 'symbol' | 'selection';
  scopeLabel: string;
  question: string;
  answer: AskAnswer;
  createdAt: string;
}

export interface AskAnswer {
  conclusion: string;
  evidence: CodeReference[];
  risks: string[];
  nextActions: string[];
  relatedFiles: CodeReference[];
  confidence: Confidence;
  markdown: string;
}

export interface ProjectPayload {
  projectDir: string;
  scan: {
    files: ScanFile[];
    keyFiles: ScanFile[];
    totalFiles: number;
    totalDirs: number;
    totalSymbols?: number;
    repoMap?: RepoMap;
    summary: { stack: string[] };
  };
  report: Report | null;
}

export interface Report {
  generatedBy: 'ai' | 'heuristic' | string;
  projectOverview: {
    name?: string;
    type?: string;
    techStack?: string[];
    startup?: string;
    confidence?: Confidence;
    summary?: string;
  };
  analysisQuality?: AnalysisQuality;
  architecture?: {
    summary?: string;
    mermaid?: string;
    evidence?: CodeReference[];
  };
  entrypoints: Array<{ name: string; path: string; kind: string; confidence: Confidence; evidence?: string | CodeReference[] }>;
  modules: ProjectModule[];
  flows: CoreFlow[];
  dataModel?: DataModel;
  risks: RiskItem[];
  readingPlan: Array<{ timebox: string; goal: string; files: string[]; output: string }>;
  unknowns: string[];
  evidenceIndex?: EvidenceIndex;
  mermaid?: string;
  contextFiles?: ContextFile[];
}
