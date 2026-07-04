import { useEffect, useMemo, useState } from 'react';
import type { AiConfig, AskAnswer, AskThreadEntry, CodeGraph, CoreFlow, FilePayload, ProjectPayload, Report, ScanFile, SymbolInfo, VerificationStatus } from '@/types';

const ASK_THREADS_STORAGE_KEY = 'codeatlas.askThreads.v1';

const defaultConfig: AiConfig = {
  provider: 'openai-compatible',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4.1-mini',
  apiKey: ''
};

export function useWorkbenchData() {
  const [payload, setPayload] = useState<ProjectPayload | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [currentFile, setCurrentFile] = useState<FilePayload | null>(null);
  const [selection, setSelection] = useState<{ startLine: number; endLine: number } | null>(null);
  const [currentSymbol, setCurrentSymbol] = useState<SymbolInfo | null>(null);
  const [activeFlow, setActiveFlow] = useState<CoreFlow | null>(null);
  const [activeRisk, setActiveRisk] = useState<Report['risks'][number] | null>(null);
  const [config, setConfig] = useState(defaultConfig);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskAnswer | string>('');
  const [loading, setLoading] = useState<string>('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ScanFile[]>([]);
  const [codeGraph, setCodeGraph] = useState<CodeGraph | null>(null);
  const [askThreads, setAskThreads] = useState<AskThreadEntry[]>(() => readAskThreads());

  useEffect(() => {
    void initialize();
  }, []);

  async function initialize() {
    setLoading('project');
    try {
      const [projectData, nextConfig] = await Promise.all([
        requestJson<ProjectPayload>('/api/project'),
        requestJson<AiConfig>('/api/config')
      ]);
      setPayload(projectData);
      setReport(projectData.report);
      setConfig({ ...defaultConfig, ...nextConfig });
      const firstPath = projectData.scan?.keyFiles?.[0]?.path;
      if (firstPath) await openFile(firstPath);
    } catch (error) {
      setAnswer(`初始化失败：${formatError(error)}`);
    } finally {
      setLoading('');
    }
  }

  async function openFile(path: string, line?: number) {
    if (!path || path.includes('待')) throw new Error(`无效文件路径：${path}`);
    setLoading('file');
    try {
      const file = await requestJson<FilePayload>(`/api/file?path=${encodeURIComponent(path)}`);
      setCurrentFile(file);
      setCurrentSymbol(null);
      setSelection(line ? { startLine: line, endLine: line } : null);
    } catch (error) {
      setAnswer(`无法打开文件：${formatError(error)}`);
    } finally {
      setLoading('');
    }
  }

  async function saveConfig() {
    setLoading('config');
    try {
      const saved = await persistConfig();
      setConfig({ ...config, ...saved });
    } catch (error) {
      setAnswer(`保存配置失败：${formatError(error)}`);
    } finally {
      setLoading('');
    }
  }

  async function analyze() {
    setLoading('analyze');
    setAnswer('');
    setReport(null);
    setActiveFlow(null);
    setActiveRisk(null);
    setPayload((current) => current ? { ...current, report: null } : current);
    try {
      const saved = await persistConfig();
      setConfig({ ...config, ...saved });
      const data = await requestJson<{ report: Report }>('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      setReport(data.report);
    } catch (error) {
      setAnswer(`分析失败：${formatError(error)}`);
    } finally {
      setLoading('');
    }
  }

  async function persistConfig() {
    return await requestJson<AiConfig>('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }

  async function rescan() {
    setLoading('rescan');
    try {
      const data = await requestJson<ProjectPayload>('/api/rescan', { method: 'POST' });
      setPayload(data);
      setReport(data.report);
    } catch (error) {
      setAnswer(`重新扫描失败：${formatError(error)}`);
    } finally {
      setLoading('');
    }
  }

  async function runSearch(value = search) {
    setSearch(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const data = await requestJson<{ results: ScanFile[] }>(`/api/search?q=${encodeURIComponent(value)}`);
    setResults(data.results);
  }

  async function updateVerification(kind: 'module' | 'flow' | 'risk' | 'entity', id: string, verificationStatus: VerificationStatus) {
    setLoading('verification');
    try {
      const data = await requestJson<{ report: Report }>('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, verificationStatus })
      });
      setReport(data.report);
      setPayload((current) => current ? { ...current, report: data.report } : current);
      const refreshedFlow = activeFlow ? data.report.flows.find((flow) => (flow.id || flow.name) === (activeFlow.id || activeFlow.name)) : null;
      const refreshedRisk = activeRisk ? data.report.risks.find((risk) => (risk.id || risk.title) === (activeRisk.id || activeRisk.title)) : null;
      if (refreshedFlow) setActiveFlow(refreshedFlow);
      if (refreshedRisk) setActiveRisk(refreshedRisk);
    } catch (error) {
      setAnswer(`确认状态更新失败：${formatError(error)}`);
    } finally {
      setLoading('');
    }
  }

  async function loadCodeGraph() {
    setLoading('code-graph');
    try {
      const data = await requestJson<{ graph: CodeGraph }>('/api/code-graph');
      setCodeGraph(data.graph);
    } catch (error) {
      setAnswer(`代码图谱加载失败：${formatError(error)}`);
    } finally {
      setLoading('');
    }
  }

  async function ask(nextQuestion?: string) {
    const finalQuestion = (nextQuestion || question).trim();
    if (!finalQuestion) return;
    setLoading('ask');
    setQuestion(finalQuestion);
    setAnswer('');
    try {
      const context = {
        projectOverview: report?.projectOverview,
        currentFile: currentFile ? { path: currentFile.path, truncated: currentFile.truncated } : null,
        selection,
        currentSymbol,
        activeFlow,
        activeRisk
      };
      const data = await requestJson<{ answer: AskAnswer }>('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: finalQuestion, context, config })
      });
      setAnswer(data.answer);
      const entry = buildAskThreadEntry({
        question: finalQuestion,
        answer: data.answer,
        projectId: payload?.projectDir || report?.projectOverview?.name || 'unknown-project',
        currentFile,
        selection,
        currentSymbol,
        activeFlow,
        activeRisk
      });
      setAskThreads((current) => persistAskThreads([entry, ...current].slice(0, 200)));
    } catch (error) {
      setAnswer(`追问失败：${formatError(error)}`);
    } finally {
      setLoading('');
    }
  }

  const files = payload?.scan?.files?.filter((file) => file.text).slice(0, 500) || [];
  const currentScanFile = useMemo(
    () => payload?.scan?.files?.find((file) => file.path === currentFile?.path) || null,
    [payload, currentFile]
  );
  const currentFileSymbols = currentScanFile?.symbols || [];

  return {
    payload,
    report,
    currentFile,
    selection,
    setSelection,
    currentSymbol,
    setCurrentSymbol,
    activeFlow,
    setActiveFlow,
    activeRisk,
    setActiveRisk,
    config,
    setConfig,
    question,
    setQuestion,
    answer,
    loading,
    search,
    results,
    codeGraph,
    askThreads,
    files,
    currentFileSymbols,
    openFile,
    saveConfig,
    analyze,
    rescan,
    runSearch,
    updateVerification,
    loadCodeGraph,
    ask
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error || `请求失败：${response.status} ${response.statusText}`);
  }
  return data as T;
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function buildAskThreadEntry({
  question,
  answer,
  projectId,
  currentFile,
  selection,
  currentSymbol,
  activeFlow,
  activeRisk
}: {
  question: string;
  answer: AskAnswer;
  projectId: string;
  currentFile: FilePayload | null;
  selection: { startLine: number; endLine: number } | null;
  currentSymbol: SymbolInfo | null;
  activeFlow: CoreFlow | null;
  activeRisk: Report['risks'][number] | null;
}): AskThreadEntry {
  const scope = askScope({ currentFile, selection, currentSymbol, activeFlow, activeRisk });
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    scopeKey: `${projectId}:${scope.type}:${scope.key}`,
    scopeType: scope.type,
    scopeLabel: scope.label,
    question,
    answer,
    createdAt: new Date().toISOString()
  };
}

function askScope({
  currentFile,
  selection,
  currentSymbol,
  activeFlow,
  activeRisk
}: {
  currentFile: FilePayload | null;
  selection: { startLine: number; endLine: number } | null;
  currentSymbol: SymbolInfo | null;
  activeFlow: CoreFlow | null;
  activeRisk: Report['risks'][number] | null;
}): { type: AskThreadEntry['scopeType']; key: string; label: string } {
  if (activeRisk) return { type: 'risk', key: activeRisk.id || activeRisk.title, label: `风险：${activeRisk.title}` };
  if (activeFlow) return { type: 'flow', key: activeFlow.id || activeFlow.name, label: `链路：${activeFlow.name}` };
  if (currentSymbol) return { type: 'symbol', key: currentSymbol.id, label: `符号：${currentSymbol.name}` };
  if (currentFile && selection) return { type: 'selection', key: `${currentFile.path}:${selection.startLine}-${selection.endLine}`, label: `选区：${currentFile.path}:${selection.startLine}-${selection.endLine}` };
  if (currentFile) return { type: 'file', key: currentFile.path, label: `文件：${currentFile.path}` };
  return { type: 'project', key: 'project', label: '项目全局' };
}

function readAskThreads(): AskThreadEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ASK_THREADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistAskThreads(entries: AskThreadEntry[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ASK_THREADS_STORAGE_KEY, JSON.stringify(entries));
  }
  return entries;
}
