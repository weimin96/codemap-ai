import Editor, { OnMount } from '@monaco-editor/react';
import { FileCode2, GitBranch, Map, Search } from 'lucide-react';
import { ActionItem } from '@/components/common/ActionItem';
import { MermaidPanel } from '@/components/MermaidPanel';
import { FlowDetail } from '@/components/WorkbenchPanels';
import { WhyConnectedPanel } from '@/components/WhyConnectedPanel';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { languageForMonaco } from '@/lib/language';
import type { CoreFlow, FilePayload, FlowStep, Report, ScanFile, SymbolInfo } from '@/types';

export function CodeWorkspace({
  report,
  activeFlow,
  currentFile,
  currentSymbol,
  selection,
  search,
  results,
  files,
  currentFileSymbols,
  onSearch,
  onOpenFile,
  onOpenStep,
  onOpenSymbol,
  onEditorMount
}: {
  report: Report | null;
  activeFlow: CoreFlow | null;
  currentFile: FilePayload | null;
  currentSymbol: SymbolInfo | null;
  selection: { startLine: number; endLine: number } | null;
  search: string;
  results: ScanFile[];
  files: ScanFile[];
  currentFileSymbols: SymbolInfo[];
  onSearch: (value: string) => void;
  onOpenFile: (path: string) => void;
  onOpenStep: (step: FlowStep) => void;
  onOpenSymbol: (symbol: SymbolInfo) => void;
  onEditorMount: OnMount;
}) {
  return <main className="min-h-0 min-w-0 border-r flex flex-col">
    <TopMap report={report} activeFlow={activeFlow} onOpenStep={onOpenStep} />
    <FileHeader currentFile={currentFile} currentSymbol={currentSymbol} selection={selection} />
    <CodeImpactPanel report={report} currentFile={currentFile} currentSymbol={currentSymbol} />
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr]">
      <FileNavigator
        search={search}
        results={results}
        files={files}
        currentFileSymbols={currentFileSymbols}
        onSearch={onSearch}
        onOpenFile={onOpenFile}
        onOpenSymbol={onOpenSymbol}
      />
      <div className="min-w-0 min-h-0">
        <Editor
          height="100%"
          theme="vs-dark"
          language={languageForMonaco(currentFile?.path)}
          value={currentFile?.content || ''}
          onMount={onEditorMount}
          options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', scrollBeyondLastLine: false }}
        />
      </div>
    </div>
  </main>;
}

function TopMap({ report, activeFlow, onOpenStep }: { report: Report | null; activeFlow: CoreFlow | null; onOpenStep: (step: FlowStep) => void }) {
  return <div className="grid gap-3 border-b bg-card/30 p-3 xl:grid-cols-2">
    <Card className="min-h-52">
      <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Map size={16} />{activeFlow ? '链路图' : '项目地图'}</CardTitle></CardHeader>
      <CardContent>{(activeFlow?.mermaid || report?.mermaid) && <MermaidPanel chart={activeFlow?.mermaid || report?.mermaid} />}</CardContent>
    </Card>
    <Card className="min-h-52">
      <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><GitBranch size={16} />{activeFlow ? '链路步骤' : '模块 / 入口'}</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm max-h-72 overflow-auto">
        {activeFlow ? (
          <FlowDetail flow={activeFlow} onOpenStep={onOpenStep} />
        ) : (
          report?.modules?.slice(0, 10).map((module, idx) => <div key={idx} className="rounded-md border p-2"><div className="flex items-center justify-between"><span>{module.name}</span><Badge variant={module.priority === 'P0' ? 'default' : 'secondary'}>{module.priority}</Badge></div><div className="text-xs text-muted-foreground mt-1">{module.responsibility}</div></div>)
        )}
      </CardContent>
    </Card>
  </div>;
}

function CodeImpactPanel({ report, currentFile, currentSymbol }: { report: Report | null; currentFile: FilePayload | null; currentSymbol: SymbolInfo | null }) {
  if (!currentFile) return null;
  const modules = (report?.modules || []).filter((module) => module.paths?.some((path) => currentFile.path.startsWith(path) || path === currentFile.path));
  const flows = (report?.flows || []).filter((flow) => flow.steps?.some((step) => step.path === currentFile.path || step.symbol === currentSymbol?.name));
  const evidence = [{ path: currentFile.path, symbol: currentSymbol?.name, startLine: currentSymbol?.startLine, endLine: currentSymbol?.endLine, reason: '当前代码对象用于推导模块和链路影响范围' }];
  return <div className="border-b bg-blue-50/30 p-3">
    <WhyConnectedPanel
      title="这个函数会影响哪些模块 / 链路？"
      description={`当前对象关联 ${modules.length} 个模块、${flows.length} 条链路。依据文件路径、当前符号和链路步骤反向定位影响范围。`}
      source={currentSymbol ? `${currentSymbol.kind} · ${currentSymbol.name}` : currentFile.path}
      target={[...modules.map((item) => item.name), ...flows.map((item) => item.name)].slice(0, 4).join('、') || '暂无业务回链'}
      evidence={evidence}
    />
  </div>;
}

function FileHeader({ currentFile, currentSymbol, selection }: {
  currentFile: FilePayload | null;
  currentSymbol: SymbolInfo | null;
  selection: { startLine: number; endLine: number } | null;
}) {
  return <div className="flex items-center gap-2 border-b px-3 py-2">
    <FileCode2 size={16} />
    <div className="font-mono text-sm truncate flex-1">{currentFile?.path || '未选择文件'}</div>
    {currentSymbol && <Badge variant="secondary">{currentSymbol.kind} · {currentSymbol.name}</Badge>}
    {selection && <Badge variant="outline">L{selection.startLine}-L{selection.endLine}</Badge>}
  </div>;
}

function FileNavigator({ search, results, files, currentFileSymbols, onSearch, onOpenFile, onOpenSymbol }: {
  search: string;
  results: ScanFile[];
  files: ScanFile[];
  currentFileSymbols: SymbolInfo[];
  onSearch: (value: string) => void;
  onOpenFile: (path: string) => void;
  onOpenSymbol: (symbol: SymbolInfo) => void;
}) {
  return <div className="max-h-64 space-y-2 overflow-y-auto border-b p-2 lg:max-h-none lg:border-b-0 lg:border-r">
    <div className="flex items-center gap-2">
      <Search size={14} />
      <Input className="h-8" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="搜索文件路径" />
    </div>
    {currentFileSymbols.length > 0 && (
      <div className="rounded-md border p-2 space-y-1">
        <div className="text-xs font-medium">当前文件符号</div>
        {currentFileSymbols.map((symbol) => (
          <ActionItem key={symbol.id} className="border-0 px-2 py-1" onClick={() => onOpenSymbol(symbol)}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono">{symbol.name}</span>
              <Badge variant="outline">{symbol.kind}</Badge>
            </div>
            <div className="text-[10px] text-muted-foreground">L{symbol.startLine}-L{symbol.endLine}</div>
          </ActionItem>
        ))}
      </div>
    )}
    {(results.length ? results : files).slice(0, 180).map((file) => (
      <ActionItem key={file.path} className="border-0 px-2 py-1.5" onClick={() => onOpenFile(file.path)}>
        <div className="truncate font-mono">{file.path}</div>
        <div className="text-[10px] text-muted-foreground">{file.priority} · {file.role}{file.symbols?.length ? ` · ${file.symbols.length} symbols` : ''}</div>
      </ActionItem>
    ))}
  </div>;
}
