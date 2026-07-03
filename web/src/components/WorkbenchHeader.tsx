import { BrainCircuit, RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function WorkbenchHeader({
  projectDir,
  totalFiles,
  totalSymbols,
  mappedFiles,
  loading,
  onExportRepoMap,
  onRescan,
  onAnalyze
}: {
  projectDir?: string;
  totalFiles: number;
  totalSymbols: number;
  mappedFiles: number;
  loading: string;
  onExportRepoMap: () => void;
  onRescan: () => void;
  onAnalyze: () => void;
}) {
  return <header className="flex items-center justify-between border-b px-4 py-3">
    <div className="flex items-center gap-3">
      <div className="rounded-lg bg-primary text-primary-foreground p-2"><BrainCircuit size={18} /></div>
      <div>
        <div className="font-semibold">Project Fast Onboarding</div>
        <div className="text-xs text-muted-foreground truncate max-w-[720px]">{projectDir || 'Loading project...'}</div>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Badge variant="outline">{totalFiles} files</Badge>
      <Badge variant="outline">{totalSymbols} symbols</Badge>
      <Badge variant="outline">{mappedFiles} map</Badge>
      <Button size="sm" variant="outline" onClick={onExportRepoMap}>导出 Repo Map</Button>
      <Button size="sm" variant="outline" onClick={onRescan} disabled={!!loading}><RefreshCw size={14} />重新扫描</Button>
      <Button size="sm" onClick={onAnalyze} disabled={!!loading}><Sparkles size={14} />开始 AI 分析</Button>
    </div>
  </header>;
}
