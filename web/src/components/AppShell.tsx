import type { ReactNode } from 'react';
import { Bot, Boxes, BrainCircuit, Code2, Database, FileClock, FileText, Home, Map, RefreshCw, Route, Settings, ShieldAlert, Sparkles, SquareCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StepProgress, type ProgressStep } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ProjectPayload } from '@/types';

export type PageId = 'overview' | 'modules' | 'module-detail' | 'flows' | 'data' | 'risks' | 'code' | 'history';

const navItems: Array<{ id: PageId; label: string; icon: typeof Home }> = [
  { id: 'overview', label: '项目总览', icon: Home },
  { id: 'modules', label: '模块地图', icon: Map },
  { id: 'flows', label: '核心链路', icon: Route },
  { id: 'data', label: '数据模型', icon: Database },
  { id: 'risks', label: '风险雷达', icon: ShieldAlert },
  { id: 'code', label: '代码浏览器', icon: Code2 },
  { id: 'history', label: '追问历史', icon: FileClock }
];

const analyzeSteps: ProgressStep[] = [
  { label: '扫描项目结构', description: '读取文件树、入口文件和符号索引', value: 20, icon: <Boxes size={15} /> },
  { label: '整理上下文文件', description: '按优先级选择本次分析代码片段', value: 45, icon: <FileText size={15} /> },
  { label: '调用 AI 分析', description: '生成模块、链路、风险和阅读路线', value: 70, icon: <BrainCircuit size={15} /> },
  { label: '生成项目报告', description: '规范化结构并写入本地分析结果', value: 90, icon: <Sparkles size={15} /> }
];

export function AppShell({
  activePage,
  payload,
  loading,
  hasAiAnalysis,
  children,
  onNavigate,
  onAnalyze,
  onExportReport,
  onOpenSettings
}: {
  activePage: PageId;
  payload: ProjectPayload | null;
  loading: string;
  hasAiAnalysis: boolean;
  children: ReactNode;
  onNavigate: (page: PageId) => void;
  onAnalyze: () => void;
  onExportReport: () => void;
  onOpenSettings: () => void;
}) {
  return <div className="flex h-screen flex-col bg-background text-foreground">
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white"><SquareCode size={18} /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-base font-bold text-slate-950">{projectName(payload)}</h1>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{payload?.report?.projectOverview?.type || '待识别'}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-4 text-xs text-slate-500">
            <span className="max-w-[520px] truncate">{payload?.projectDir || '项目加载中'}</span>
            <span className="hidden lg:inline">最近分析：{payload?.scan?.repoMap?.generatedAt ? formatDate(payload.scan.repoMap.generatedAt) : '-'}</span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={onAnalyze} disabled={!!loading}>{hasAiAnalysis ? <RefreshCw size={15} /> : <Sparkles size={15} />}{hasAiAnalysis ? '重新分析' : '开始分析'}</Button>
        <Button size="sm" variant="outline" onClick={onExportReport}><Bot size={15} />导出上下文</Button>
        <Button size="icon" variant="outline" onClick={onOpenSettings} aria-label="AI 设置" title="AI 设置"><Settings size={16} /></Button>
      </div>
    </header>

    <nav className="flex h-14 items-center gap-2 border-b bg-white px-6">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.id === activePage || (activePage === 'module-detail' && item.id === 'modules');
        return <Button
          key={item.id}
          type="button"
          variant="ghost"
          onClick={() => onNavigate(item.id)}
          className={cn('h-9 gap-2 rounded-lg px-3 text-sm shadow-none', active ? 'bg-blue-50 font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}
        >
          <Icon size={16} />
          <span>{item.label}</span>
        </Button>;
      })}
    </nav>

    <StepProgress steps={analyzeSteps} active={loading === 'analyze'} />
    <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      {children}
    </main>
  </div>;
}

function projectName(payload: ProjectPayload | null) {
  return payload?.report?.projectOverview?.name || payload?.projectDir?.split(/[\\/]/).filter(Boolean).pop() || '项目加载中';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
