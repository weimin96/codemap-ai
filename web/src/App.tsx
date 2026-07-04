import { lazy, Suspense, useRef, useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import { AppShell, type PageId } from '@/components/AppShell';
import { useWorkbenchData } from '@/hooks/useWorkbenchData';
import type { CodeReference, CoreFlow, FlowStep, ProjectModule, RiskItem, SymbolInfo } from '@/types';

const AskPanel = lazy(() => import('@/components/AskPanel').then((module) => ({ default: module.AskPanel })));
const CodeWorkspace = lazy(() => import('@/components/CodeWorkspace').then((module) => ({ default: module.CodeWorkspace })));
const CodeGraphPage = lazy(() => import('@/pages/CodeGraphPage').then((module) => ({ default: module.CodeGraphPage })));
const DataModelPage = lazy(() => import('@/pages/DataModelPage').then((module) => ({ default: module.DataModelPage })));
const FlowDetailPage = lazy(() => import('@/pages/FlowDetailPage').then((module) => ({ default: module.FlowDetailPage })));
const FlowPage = lazy(() => import('@/pages/FlowPage').then((module) => ({ default: module.FlowPage })));
const HistoryPage = lazy(() => import('@/pages/HistoryPage').then((module) => ({ default: module.HistoryPage })));
const ModuleDetailPage = lazy(() => import('@/pages/ModuleDetailPage').then((module) => ({ default: module.ModuleDetailPage })));
const ModuleMapPage = lazy(() => import('@/pages/ModuleMapPage').then((module) => ({ default: module.ModuleMapPage })));
const OverviewPage = lazy(() => import('@/pages/OverviewPage').then((module) => ({ default: module.OverviewPage })));
const RiskPage = lazy(() => import('@/pages/RiskPage').then((module) => ({ default: module.RiskPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [activeModuleId, setActiveModuleId] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const workbench = useWorkbenchData();

  const editorMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorSelection((event) => {
      const startLine = event.selection.startLineNumber;
      const endLine = event.selection.endLineNumber;
      workbench.setSelection({ startLine: Math.min(startLine, endLine), endLine: Math.max(startLine, endLine) });
    });
  };

  function exportContextPack() {
    window.location.href = '/api/context-pack?format=markdown';
  }

  async function exportOnboardingDocs() {
    const response = await fetch('/api/onboarding-docs');
    const data = await response.json().catch(() => null) as { names?: string[]; docs?: Record<string, string>; error?: string } | null;
    if (!response.ok || data?.error) {
      throw new Error(data?.error || `导出接管文档失败：${response.status}`);
    }
    const names = data?.names || Object.keys(data?.docs || {});
    const markdown = names.map((name) => `# ${name}\n\n${data?.docs?.[name] || ''}`).join('\n\n---\n\n');
    downloadText('codeatlas-onboarding-docs.md', markdown || '# CodeAtlas Onboarding Docs\n\n暂无文档。');
  }

  function openFlowStep(step: FlowStep) {
    if (!step.path) return;
    setActivePage('code');
    void workbench.openFile(step.path, step.startLine);
  }

  function openFlowDetail(flow: CoreFlow) {
    workbench.setActiveFlow(flow);
    setActivePage('flow-detail');
  }

  function openModule(module: ProjectModule) {
    setActiveModuleId(module.id || module.name);
    setActivePage('module-detail');
  }

  function openCodeReference(reference: CodeReference) {
    if (!reference.path) return;
    setActivePage('code');
    void workbench.openFile(reference.path, reference.startLine);
  }

  function openRiskCode(risk: RiskItem) {
    workbench.setActiveRisk(risk);
    const reference = risk.evidence?.[0];
    const path = reference?.path || risk.path;
    if (!path) return;
    setActivePage('code');
    void workbench.openFile(path, reference?.startLine || risk.startLine);
  }

  function openGraphFile(path: string, line?: number) {
    setActivePage('code');
    void workbench.openFile(path, line);
  }

  function openSymbol(symbol: SymbolInfo) {
    workbench.setCurrentSymbol(symbol);
    workbench.setSelection({ startLine: symbol.startLine, endLine: symbol.endLine });
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

  return <AppShell
    activePage={activePage}
    payload={workbench.payload}
    loading={workbench.loading}
    hasAiAnalysis={workbench.report?.generatedBy === 'ai'}
    onNavigate={setActivePage}
    onAnalyze={workbench.analyze}
    onExportReport={exportContextPack}
    onExportDocs={() => { void exportOnboardingDocs(); }}
    onOpenSettings={() => setSettingsOpen(true)}
  >
    <Suspense fallback={<div className="rounded-lg border bg-white p-6 text-sm text-slate-500">页面加载中...</div>}>
      {activePage === 'overview' && <OverviewPage payload={workbench.payload} report={workbench.report} onNavigate={setActivePage} />}
      {activePage === 'modules' && <ModuleMapPage payload={workbench.payload} report={workbench.report} onOpenModule={openModule} />}
      {activePage === 'module-detail' && <ModuleDetailPage report={workbench.report} activeModuleId={activeModuleId} onBack={() => setActivePage('modules')} onOpenFile={openCodeReference} />}
      {activePage === 'flows' && <FlowPage report={workbench.report} activeFlow={workbench.activeFlow} onSelectFlow={workbench.setActiveFlow} onOpenStep={openFlowStep} onOpenFlowDetail={openFlowDetail} onNavigate={setActivePage} />}
      {activePage === 'flow-detail' && <FlowDetailPage report={workbench.report} activeFlow={workbench.activeFlow} onBack={() => setActivePage('flows')} onOpenStep={openFlowStep} />}
      {activePage === 'data' && <DataModelPage payload={workbench.payload} report={workbench.report} />}
      {activePage === 'risks' && <RiskPage report={workbench.report} activeRisk={workbench.activeRisk} onSelectRisk={workbench.setActiveRisk} onOpenRiskCode={openRiskCode} />}
      {activePage === 'graph' && <CodeGraphPage graph={workbench.codeGraph} loading={workbench.loading} onLoadGraph={workbench.loadCodeGraph} onOpenFile={openGraphFile} />}
      {activePage === 'history' && <HistoryPage report={workbench.report} askThreads={workbench.askThreads} />}
      {activePage === 'code' && <div className="grid h-[calc(100vh-104px)] grid-cols-[minmax(680px,1fr)_380px] gap-4">
        <CodeWorkspace
          report={workbench.report}
          activeFlow={workbench.activeFlow}
          currentFile={workbench.currentFile}
          currentSymbol={workbench.currentSymbol}
          selection={workbench.selection}
          search={workbench.search}
          results={workbench.results}
          files={workbench.files}
          currentFileSymbols={workbench.currentFileSymbols}
          onSearch={workbench.runSearch}
          onOpenFile={workbench.openFile}
          onOpenStep={openFlowStep}
          onOpenSymbol={openSymbol}
          onEditorMount={editorMount}
        />
        <AskPanel
          report={workbench.report}
          currentFile={workbench.currentFile}
          currentSymbol={workbench.currentSymbol}
          activeFlow={workbench.activeFlow}
          activeRisk={workbench.activeRisk}
          selection={workbench.selection}
          question={workbench.question}
          answer={workbench.answer}
          loading={workbench.loading}
          onQuestionChange={workbench.setQuestion}
          onAsk={workbench.ask}
          onExportContextPack={exportContextPack}
          onOpenFile={workbench.openFile}
        />
      </div>}
      {settingsOpen && <SettingsPage open={settingsOpen} config={workbench.config} loading={workbench.loading} onOpenChange={setSettingsOpen} onConfigChange={workbench.setConfig} onSaveConfig={workbench.saveConfig} />}
    </Suspense>
  </AppShell>;
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
