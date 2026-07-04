import { useEffect, useMemo, useState } from 'react';
import type { AiConfig, CoreFlow, FilePayload, ProjectPayload, Report, ScanFile, SymbolInfo } from '@/types';

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
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState<string>('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ScanFile[]>([]);

  useEffect(() => {
    loadProject();
    fetch('/api/config').then((response) => response.json()).then((nextConfig) => setConfig({ ...defaultConfig, ...nextConfig })).catch(() => undefined);
  }, []);

  async function loadProject() {
    setLoading('project');
    try {
      const data = await fetch('/api/project').then((response) => response.json());
      setPayload(data);
      setReport(data.report);
      const firstPath = data.scan?.keyFiles?.[0]?.path;
      if (firstPath) void openFile(firstPath);
    } finally {
      setLoading('');
    }
  }

  async function openFile(path: string, line?: number) {
    if (!path || path.includes('待')) return;
    setLoading('file');
    try {
      const file = await fetch(`/api/file?path=${encodeURIComponent(path)}`).then((response) => response.json());
      if (file.error) throw new Error(file.error);
      setCurrentFile(file);
      setCurrentSymbol(null);
      setSelection(line ? { startLine: line, endLine: line } : null);
    } catch (error) {
      setAnswer(`无法打开文件：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading('');
    }
  }

  async function saveConfig() {
    setLoading('config');
    try {
      const saved = await persistConfig();
      setConfig({ ...config, ...saved });
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
      const data = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      }).then((response) => response.json());
      if (data.error) throw new Error(data.error);
      setReport(data.report);
    } catch (error) {
      setAnswer(`分析失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading('');
    }
  }

  async function persistConfig() {
    return await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }).then((response) => response.json());
  }

  async function rescan() {
    setLoading('rescan');
    try {
      const data = await fetch('/api/rescan', { method: 'POST' }).then((response) => response.json());
      setPayload(data);
      setReport(data.report);
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
    const data = await fetch(`/api/search?q=${encodeURIComponent(value)}`).then((response) => response.json());
    setResults(data.results || []);
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
      const data = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: finalQuestion, context, config })
      }).then((response) => response.json());
      if (data.error) throw new Error(data.error);
      setAnswer(data.answer);
    } catch (error) {
      setAnswer(`追问失败：${error instanceof Error ? error.message : String(error)}`);
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
    files,
    currentFileSymbols,
    openFile,
    saveConfig,
    analyze,
    rescan,
    runSearch,
    ask
  };
}
