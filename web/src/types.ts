export type Confidence = 'fact' | 'guess' | 'unknown';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export type SymbolKind = 'function' | 'class' | 'method' | 'interface' | 'type' | 'constant';

export interface SymbolInfo {
  id: string;
  name: string;
  kind: SymbolKind;
  path: string;
  startLine: number;
  endLine: number;
  signature?: string;
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

export interface RepoMap {
  generatedAt: string;
  totals: { files: number; textFiles: number; symbols: number };
  entrypoints: RepoMapFile[];
  importantFiles: RepoMapFile[];
  modules: Array<{ name: string; fileCount: number; symbolCount: number; priority: Priority; topFiles: string[]; roles: string[] }>;
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
  entrypoints: Array<{ name: string; path: string; kind: string; confidence: Confidence; evidence?: string }>;
  modules: Array<{ name: string; paths: string[]; responsibility: string; priority: Priority; confidence: Confidence; evidence?: string }>;
  flows: Array<{
    name: string;
    trigger: string;
    priority: Priority;
    confidence: Confidence;
    steps: Array<{ order: number; path: string; symbol?: string; startLine?: number; endLine?: number; description: string; confidence?: Confidence }>;
    dataReads?: string[];
    dataWrites?: string[];
    externalCalls?: string[];
    breakpoints?: string[];
    notes?: string[];
  }>;
  risks: Array<{ title: string; level: 'high' | 'medium' | 'low'; path?: string; startLine?: number; endLine?: number; reason: string; verify: string }>;
  readingPlan: Array<{ timebox: string; goal: string; files: string[]; output: string }>;
  unknowns: string[];
  mermaid?: string;
  contextFiles?: ContextFile[];
}
