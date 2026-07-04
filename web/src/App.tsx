import { useRef, useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import { AppShell, type PageId } from '@/components/AppShell';
import { AskPanel } from '@/components/AskPanel';
import { CodeWorkspace } from '@/components/CodeWorkspace';
import { DataModelPage } from '@/pages/DataModelPage';
import { FlowPage } from '@/pages/FlowPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { ModuleMapPage } from '@/pages/ModuleMapPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { RiskPage } from '@/pages/RiskPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { useWorkbenchData } from '@/hooks/useWorkbenchData';
import type { FlowStep, SymbolInfo } from '@/types';

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('overview');
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

  function exportRepoMap() {
    window.location.href = '/api/repo-map?download=1';
  }

  function openFlowStep(step: FlowStep) {
    if (!step.path) return;
    setActivePage('code');
    void workbench.openFile(step.path, step.startLine);
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
    onOpenSettings={() => setSettingsOpen(true)}
  >
    {activePage === 'overview' && <OverviewPage payload={workbench.payload} report={workbench.report} onNavigate={setActivePage} />}
    {activePage === 'modules' && <ModuleMapPage payload={workbench.payload} report={workbench.report} onNavigate={setActivePage} />}
    {activePage === 'flows' && <FlowPage report={workbench.report} activeFlow={workbench.activeFlow} onSelectFlow={workbench.setActiveFlow} onOpenStep={openFlowStep} onNavigate={setActivePage} />}
    {activePage === 'data' && <DataModelPage payload={workbench.payload} report={workbench.report} />}
    {activePage === 'risks' && <RiskPage report={workbench.report} onNavigate={setActivePage} />}
    {activePage === 'history' && <HistoryPage report={workbench.report} />}
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
    <SettingsPage open={settingsOpen} config={workbench.config} loading={workbench.loading} onOpenChange={setSettingsOpen} onConfigChange={workbench.setConfig} onSaveConfig={workbench.saveConfig} />
  </AppShell>;
}
