import { lazy, Suspense, useRef, useState, type CSSProperties } from 'react';
import type { OnMount } from '@monaco-editor/react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { AppShell, type PageId } from '@/components/AppShell';
import { useWorkbenchData } from '@/hooks/useWorkbenchData';
import { Button } from '@/components/ui/button';
import type { CodeReference, CoreFlow, FlowStep, ProjectModule, RiskItem, SymbolInfo, VerificationStatus } from '@/types';

const AskPanel = lazy(() => import('@/components/AskPanel').then((module) => ({ default: module.AskPanel })));
const CodeWorkspace = lazy(() => import('@/components/CodeWorkspace').then((module) => ({ default: module.CodeWorkspace })));
const CodeGraphPage = lazy(() => import('@/pages/CodeGraphPage').then((module) => ({ default: module.CodeGraphPage })));
const CoursePage = lazy(() => import('@/pages/CoursePage').then((module) => ({ default: module.CoursePage })));
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
  const [askPanelOpen, setAskPanelOpen] = useState(true);
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
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const name of names) zip.file(name, data?.docs?.[name] || '');
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob('codemap-ai-onboarding-docs.zip', blob);
  }

  async function exportOnboardingCourse() {
    const response = await fetch('/api/onboarding-course');
    const data = await response.json().catch(() => null) as { names?: string[]; docs?: Record<string, string>; error?: string } | null;
    if (!response.ok || data?.error) {
      throw new Error(data?.error || `导出学习课程失败：${response.status}`);
    }
    const names = data?.names || Object.keys(data?.docs || {});
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const name of names) zip.file(name, data?.docs?.[name] || '');
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob('codemap-ai-course.zip', blob);
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

  function changeVerification(kind: 'module' | 'flow' | 'risk' | 'entity', id: string, status: VerificationStatus) {
    void workbench.updateVerification(kind, id, status);
  }

  const isPartialReport = Boolean(workbench.report?.analysisQuality?.partial);
  const hasAiAnalysis = Boolean(workbench.report && workbench.report.generatedBy !== 'heuristic');
  const verificationLoading = isPartialReport || workbench.loading === 'analyze' ? 'analyze' : workbench.loading;
  const codeLayoutStyle = { '--ask-panel-width': askPanelOpen ? '380px' : '0px' } as CSSProperties;

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
    report={workbench.report}
    codeGraph={workbench.codeGraph}
    config={workbench.config}
    notice={workbench.notice}
    loading={workbench.loading}
    hasAiAnalysis={hasAiAnalysis}
    onNavigate={setActivePage}
    onAnalyze={workbench.analyze}
    onCancelAnalyze={workbench.cancelAnalyze}
    analysisProgress={workbench.analysisProgress}
    onClearNotice={workbench.clearNotice}
    onExportReport={exportContextPack}
    onExportDocs={() => { void exportOnboardingDocs(); }}
    onOpenSettings={() => setSettingsOpen(true)}
  >
    <Suspense fallback={<div className="rounded-lg border bg-white p-6 text-sm text-slate-500">页面加载中...</div>}>
      {activePage === 'overview' && <OverviewPage payload={workbench.payload} report={workbench.report} codeGraph={workbench.codeGraph} onNavigate={setActivePage} />}
      {activePage === 'modules' && <ModuleMapPage payload={workbench.payload} report={workbench.report} onOpenModule={openModule} />}
      {activePage === 'module-detail' && <ModuleDetailPage report={workbench.report} activeModuleId={activeModuleId} loading={verificationLoading} onBack={() => setActivePage('modules')} onOpenFile={openCodeReference} onUpdateVerification={changeVerification} />}
      {activePage === 'flows' && <FlowPage report={workbench.report} activeFlow={workbench.activeFlow} onSelectFlow={workbench.setActiveFlow} onOpenStep={openFlowStep} onOpenFlowDetail={openFlowDetail} onNavigate={setActivePage} />}
      {activePage === 'flow-detail' && <FlowDetailPage report={workbench.report} activeFlow={workbench.activeFlow} loading={verificationLoading} onBack={() => setActivePage('flows')} onOpenStep={openFlowStep} onUpdateVerification={changeVerification} />}
      {activePage === 'data' && <DataModelPage payload={workbench.payload} report={workbench.report} loading={verificationLoading} onUpdateVerification={changeVerification} />}
      {activePage === 'risks' && <RiskPage report={workbench.report} activeRisk={workbench.activeRisk} loading={verificationLoading} onSelectRisk={workbench.setActiveRisk} onOpenRiskCode={openRiskCode} onUpdateVerification={changeVerification} />}
      {activePage === 'graph' && <CodeGraphPage graph={workbench.codeGraph} report={workbench.report} config={workbench.config} currentFile={workbench.currentFile} currentSymbol={workbench.currentSymbol} activeFlow={workbench.activeFlow} activeRisk={workbench.activeRisk} loading={workbench.loading} onLoadGraph={workbench.loadCodeGraph} onOpenFile={openGraphFile} />}
      {activePage === 'course' && <CoursePage report={workbench.report} onExportCourse={() => { void exportOnboardingCourse(); }} />}
      {activePage === 'history' && <HistoryPage report={workbench.report} askThreads={workbench.askThreads} />}
      {activePage === 'code' && <div className="flex min-h-[720px] flex-col gap-3 xl:h-[calc(100vh-260px)]">
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="outline" onClick={() => setAskPanelOpen((open) => !open)}>
            {askPanelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}{askPanelOpen ? '收起追问' : '展开追问'}
          </Button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 transition-[grid-template-columns] duration-200 xl:grid-cols-[minmax(0,1fr)_var(--ask-panel-width)]" style={codeLayoutStyle}>
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
        <div className={askPanelOpen ? 'min-h-[420px] min-w-0 overflow-hidden xl:min-h-0' : 'hidden min-w-0 overflow-hidden xl:block'}>
          {askPanelOpen && <AskPanel
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
        />}
        </div>
        </div>
      </div>}
      {settingsOpen && <SettingsPage open={settingsOpen} config={workbench.config} loading={workbench.loading} onOpenChange={setSettingsOpen} onConfigChange={workbench.setConfig} onSaveConfig={workbench.saveConfig} />}
    </Suspense>
  </AppShell>;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
