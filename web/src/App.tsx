import { useEffect, useMemo, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Bot, BrainCircuit, CircleAlert, FileCode2, GitBranch, KeyRound, Loader2, Map, Play, RefreshCw, Route, Search, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { MermaidPanel } from '@/components/MermaidPanel';
import type { Report, RepoMap, ScanFile, SymbolInfo } from '@/types';

interface ProjectPayload {
  projectDir: string;
  scan: { files: ScanFile[]; keyFiles: ScanFile[]; totalFiles: number; totalDirs: number; totalSymbols?: number; repoMap?: RepoMap; summary: { stack: string[] } };
  report: Report;
}

interface FilePayload {
  path: string;
  content: string;
  truncated: boolean;
  size: number;
}

const defaultConfig = {
  provider: 'openai-compatible',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-4.1-mini',
  apiKey: ''
};

export default function App() {
  const [payload, setPayload] = useState<ProjectPayload | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [currentFile, setCurrentFile] = useState<FilePayload | null>(null);
  const [selection, setSelection] = useState<{ startLine: number; endLine: number } | null>(null);
  const [currentSymbol, setCurrentSymbol] = useState<SymbolInfo | null>(null);
  const [activeFlow, setActiveFlow] = useState<any>(null);
  const [activeRisk, setActiveRisk] = useState<any>(null);
  const [config, setConfig] = useState(defaultConfig);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState<string>('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ScanFile[]>([]);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    loadProject();
    fetch('/api/config').then((r) => r.json()).then((c) => setConfig({ ...defaultConfig, ...c })).catch(() => undefined);
  }, []);

  async function loadProject() {
    setLoading('project');
    try {
      const data = await fetch('/api/project').then((r) => r.json());
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
      const file = await fetch(`/api/file?path=${encodeURIComponent(path)}`).then((r) => r.json());
      if (file.error) throw new Error(file.error);
      setCurrentFile(file);
      setCurrentSymbol(null);
      if (line) setSelection({ startLine: line, endLine: line });
      else setSelection(null);
    } catch (err) {
      setAnswer(`无法打开文件：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading('');
    }
  }

  async function saveConfig() {
    setLoading('config');
    try {
      const saved = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) }).then((r) => r.json());
      setConfig({ ...config, ...saved });
    } finally { setLoading(''); }
  }

  async function analyze() {
    setLoading('analyze');
    setAnswer('');
    try {
      await saveConfig();
      const data = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) }).then((r) => r.json());
      if (data.error) throw new Error(data.error);
      setReport(data.report);
    } catch (err) {
      setAnswer(`分析失败：${err instanceof Error ? err.message : String(err)}`);
    } finally { setLoading(''); }
  }

  async function rescan() {
    setLoading('rescan');
    try {
      const data = await fetch('/api/rescan', { method: 'POST' }).then((r) => r.json());
      setPayload(data);
      setReport(data.report);
    } finally { setLoading(''); }
  }

  async function runSearch(value = search) {
    setSearch(value);
    if (!value.trim()) { setResults([]); return; }
    const data = await fetch(`/api/search?q=${encodeURIComponent(value)}`).then((r) => r.json());
    setResults(data.results || []);
  }

  async function ask(q?: string) {
    const finalQuestion = (q || question).trim();
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
      const data = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: finalQuestion, context, config }) }).then((r) => r.json());
      if (data.error) throw new Error(data.error);
      setAnswer(data.answer);
    } catch (err) {
      setAnswer(`追问失败：${err instanceof Error ? err.message : String(err)}`);
    } finally { setLoading(''); }
  }

  const files = payload?.scan?.files?.filter((f) => f.text).slice(0, 500) || [];
  const currentScanFile = useMemo(
    () => payload?.scan?.files?.find((file) => file.path === currentFile?.path) || null,
    [payload, currentFile]
  );
  const currentFileSymbols = currentScanFile?.symbols || [];

  const editorMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorSelection((event) => {
      const startLine = event.selection.startLineNumber;
      const endLine = event.selection.endLineNumber;
      setSelection({ startLine: Math.min(startLine, endLine), endLine: Math.max(startLine, endLine) });
    });
  };

  function exportContextPack() {
    window.location.href = '/api/context-pack?format=markdown';
  }

  function exportRepoMap() {
    window.location.href = '/api/repo-map?download=1';
  }

  function openSymbol(symbol: SymbolInfo) {
    setCurrentSymbol(symbol);
    setSelection({ startLine: symbol.startLine, endLine: symbol.endLine });
    editorRef.current?.revealLineInCenter(symbol.startLine);
    editorRef.current?.setPosition({ lineNumber: symbol.startLine, column: 1 });
    editorRef.current?.setSelection({
      startLineNumber: symbol.startLine,
      startColumn: 1,
      endLineNumber: symbol.endLine,
      endColumn: 1
    });
    editorRef.current?.focus();
  }

  const confidenceVariant = (c?: string) => c === 'fact' ? 'success' : c === 'guess' ? 'warning' : 'outline';
  const riskVariant = (l?: string) => l === 'high' ? 'destructive' : l === 'medium' ? 'warning' : 'secondary';

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary text-primary-foreground p-2"><BrainCircuit size={18} /></div>
          <div>
            <div className="font-semibold">Project Fast Onboarding</div>
            <div className="text-xs text-muted-foreground truncate max-w-[720px]">{payload?.projectDir || 'Loading project...'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{payload?.scan?.totalFiles || 0} files</Badge>
          <Badge variant="outline">{payload?.scan?.totalSymbols || 0} symbols</Badge>
          <Badge variant="outline">{payload?.scan?.repoMap?.importantFiles?.length || 0} map</Badge>
          <Button size="sm" variant="outline" onClick={exportRepoMap}>导出 Repo Map</Button>
          <Button size="sm" variant="outline" onClick={rescan} disabled={!!loading}><RefreshCw size={14} />重新扫描</Button>
          <Button size="sm" onClick={analyze} disabled={!!loading}><Sparkles size={14} />开始 AI 分析</Button>
        </div>
      </header>

      <div className="grid flex-1 min-h-0 grid-cols-[360px_minmax(520px,1fr)_420px] gap-0">
        <aside className="border-r overflow-y-auto p-3 space-y-3">
          <Overview report={report} confidenceVariant={confidenceVariant} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><KeyRound size={16} />AI 配置</CardTitle>
              <CardDescription>使用 AI SDK provider 调用模型。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={config.provider} onChange={(e) => setConfig({ ...config, provider: e.target.value })}>
                <option value="openai-compatible">OpenAI Compatible</option>
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama</option>
              </Select>
              <Input value={config.baseURL} onChange={(e) => setConfig({ ...config, baseURL: e.target.value })} placeholder="Base URL" />
              <Input value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} placeholder="Model" />
              <Input value={config.apiKey} onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} placeholder="API Key" type="password" />
              <Button size="sm" variant="secondary" onClick={saveConfig} disabled={!!loading}>保存配置</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Route size={16} />核心链路</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {report?.flows?.map((flow, idx) => (
                <button key={idx} onClick={() => { setActiveFlow(flow); const p = flow.steps?.[0]?.path; if (p) void openFile(p, flow.steps?.[0]?.startLine); }} className="w-full rounded-lg border p-3 text-left hover:bg-accent">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">{flow.name}</div>
                    <Badge variant={confidenceVariant(flow.confidence) as any}>{flow.confidence}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{flow.trigger}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><GitBranch size={16} />Repo Map</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {payload?.scan?.repoMap?.importantFiles?.slice(0, 8).map((file) => (
                <button key={file.path} onClick={() => openFile(file.path)} className="w-full rounded-md border p-2 text-left hover:bg-accent">
                  <div className="truncate font-mono">{file.path}</div>
                  <div className="text-[10px] text-muted-foreground">{file.priority} · score {file.importance} · {file.symbols.length} symbols</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><ShieldAlert size={16} />风险雷达</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {report?.risks?.map((risk, idx) => (
                <button key={idx} onClick={() => { setActiveRisk(risk); if (risk.path) void openFile(risk.path, risk.startLine); }} className="w-full rounded-lg border p-3 text-left hover:bg-accent">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">{risk.title}</div>
                    <Badge variant={riskVariant(risk.level) as any}>{risk.level}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{risk.reason}</div>
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>

        <main className="min-w-0 border-r flex flex-col">
          <div className="grid grid-cols-2 gap-3 p-3 border-b bg-card/30">
            <Card className="min-h-52">
              <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Map size={16} />项目地图</CardTitle></CardHeader>
              <CardContent>{report?.mermaid && <MermaidPanel chart={report.mermaid} />}</CardContent>
            </Card>
            <Card className="min-h-52">
              <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><GitBranch size={16} />模块 / 入口</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm max-h-72 overflow-auto">
                {report?.modules?.slice(0, 10).map((m, idx) => <div key={idx} className="rounded-md border p-2"><div className="flex items-center justify-between"><span>{m.name}</span><Badge variant={m.priority === 'P0' ? 'default' : 'secondary'}>{m.priority}</Badge></div><div className="text-xs text-muted-foreground mt-1">{m.responsibility}</div></div>)}
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-2 border-b px-3 py-2">
            <FileCode2 size={16} />
            <div className="font-mono text-sm truncate flex-1">{currentFile?.path || '未选择文件'}</div>
            {currentSymbol && <Badge variant="secondary">{currentSymbol.kind} · {currentSymbol.name}</Badge>}
            {selection && <Badge variant="outline">L{selection.startLine}-L{selection.endLine}</Badge>}
          </div>

          <div className="grid grid-cols-[260px_1fr] min-h-0 flex-1">
            <div className="border-r overflow-y-auto p-2 space-y-2">
              <div className="flex items-center gap-2">
                <Search size={14} />
                <Input className="h-8" value={search} onChange={(e) => runSearch(e.target.value)} placeholder="搜索文件路径" />
              </div>
              {currentFileSymbols.length > 0 && (
                <div className="rounded-md border p-2 space-y-1">
                  <div className="text-xs font-medium">当前文件符号</div>
                  {currentFileSymbols.map((symbol) => (
                    <button key={symbol.id} onClick={() => openSymbol(symbol)} className="w-full rounded px-2 py-1 text-left text-xs hover:bg-accent">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono">{symbol.name}</span>
                        <Badge variant="outline">{symbol.kind}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">L{symbol.startLine}-L{symbol.endLine}</div>
                    </button>
                  ))}
                </div>
              )}
              {(results.length ? results : files).slice(0, 180).map((f) => (
                <button key={f.path} onClick={() => openFile(f.path)} className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent">
                  <div className="truncate font-mono">{f.path}</div>
                  <div className="text-[10px] text-muted-foreground">{f.priority} · {f.role}{f.symbols?.length ? ` · ${f.symbols.length} symbols` : ''}</div>
                </button>
              ))}
            </div>
            <div className="min-w-0 min-h-0">
              <Editor
                height="100%"
                theme="vs-dark"
                language={languageForMonaco(currentFile?.path)}
                value={currentFile?.content || ''}
                onMount={editorMount}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', scrollBeyondLastLine: false }}
              />
            </div>
          </div>
        </main>

        <aside className="overflow-y-auto p-3 space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><Bot size={16} />上下文追问</CardTitle>
              <CardDescription>追问会自动绑定当前文件、选中行、链路和风险。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ContextSummary currentFile={currentFile} currentSymbol={currentSymbol} activeFlow={activeFlow} activeRisk={activeRisk} selection={selection} />
              <div className="grid grid-cols-2 gap-2">
                {['解释当前文件主流程', '找这段代码的风险', '追踪数据读写', '推荐断点验证', '改这里影响哪里', '下一步看什么'].map((q) => <Button key={q} size="sm" variant="outline" onClick={() => ask(q)}>{q}</Button>)}
              </div>
              <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="围绕当前文件/链路追问，例如：这个状态在哪里被修改？" />
              <Button className="w-full" onClick={() => ask()} disabled={!!loading}>{loading === 'ask' ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}追问</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm"><FileCode2 size={16} />分析上下文</CardTitle>
              <CardDescription>AI 分析会优先使用 Repo Map 和以下上下文文件。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button size="sm" variant="outline" onClick={exportContextPack}>导出 project-context.md</Button>
              <div className="space-y-1 max-h-56 overflow-auto">
                {(report?.contextFiles || []).slice(0, 24).map((file) => (
                  <button key={file.path} onClick={() => openFile(file.path)} className="w-full rounded-md border p-2 text-left text-xs hover:bg-accent">
                    <div className="truncate font-mono">{file.path}</div>
                    <div className="text-[10px] text-muted-foreground">{file.priority} · score {file.score} · {file.charCount} chars{file.truncated ? ' · truncated' : ''}</div>
                  </button>
                ))}
                {!report?.contextFiles?.length && <div className="text-xs text-muted-foreground">开始 AI 分析后显示本次使用的上下文文件。</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><CircleAlert size={16} />AI 回答</CardTitle></CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-lg border bg-slate-950 p-3 text-sm leading-6 min-h-72">{loading && loading !== 'ask' ? `正在处理：${loading}` : answer || '暂无回答。先选择文件或链路，然后提问。'}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">阅读路线</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {report?.readingPlan?.map((p, i) => <div key={i} className="rounded-md border p-2 text-sm"><div className="font-medium">{p.timebox} · {p.goal}</div><div className="text-xs text-muted-foreground mt-1">{p.output}</div>{p.files?.slice(0, 4).map((f) => <button key={f} onClick={() => openFile(f)} className="block truncate text-xs text-sky-300 hover:underline">{f}</button>)}</div>)}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Overview({ report, confidenceVariant }: { report: Report | null; confidenceVariant: (c?: string) => string }) {
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-sm"><Sparkles size={16} />项目概览</CardTitle>
      <CardDescription>{report?.generatedBy === 'ai' ? 'AI 分析结果' : '启发式预览，建议配置 AI 后分析'}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2"><span>类型</span><Badge variant={confidenceVariant(report?.projectOverview?.confidence) as any}>{report?.projectOverview?.confidence || 'unknown'}</Badge></div>
      <div className="font-medium">{report?.projectOverview?.type || '未知'}</div>
      <div className="text-xs text-muted-foreground">{report?.projectOverview?.summary}</div>
      <div className="flex flex-wrap gap-1">{report?.projectOverview?.techStack?.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
    </CardContent>
  </Card>;
}

function ContextSummary({ currentFile, currentSymbol, activeFlow, activeRisk, selection }: any) {
  return <div className="rounded-lg border bg-slate-950 p-3 text-xs text-muted-foreground space-y-1">
    <div>文件：<span className="font-mono text-foreground">{currentFile?.path || '-'}</span></div>
    <div>符号：<span className="text-foreground">{currentSymbol ? `${currentSymbol.kind} ${currentSymbol.name}` : '-'}</span></div>
    <div>选区：<span className="text-foreground">{selection ? `L${selection.startLine}-L${selection.endLine}` : '-'}</span></div>
    <div>链路：<span className="text-foreground">{activeFlow?.name || '-'}</span></div>
    <div>风险：<span className="text-foreground">{activeRisk?.title || '-'}</span></div>
  </div>;
}

function languageForMonaco(file?: string) {
  if (!file) return 'plaintext';
  if (/\.tsx?$/.test(file)) return 'typescript';
  if (/\.jsx?$/.test(file)) return 'javascript';
  if (/\.json$/.test(file)) return 'json';
  if (/\.mdx?$/.test(file)) return 'markdown';
  if (/\.ya?ml$/.test(file)) return 'yaml';
  if (/\.css$/.test(file)) return 'css';
  if (/\.html$/.test(file)) return 'html';
  if (/\.py$/.test(file)) return 'python';
  if (/\.go$/.test(file)) return 'go';
  if (/\.rs$/.test(file)) return 'rust';
  if (/\.java$/.test(file)) return 'java';
  if (/\.sql$/.test(file)) return 'sql';
  return 'plaintext';
}
