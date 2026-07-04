import type { ReactNode } from 'react';
import { Bot, Boxes, BrainCircuit, Code2, Database, FileClock, FileText, Home, Map, RefreshCw, Route, Settings, Share2, ShieldAlert, Sparkles, SquareCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StepProgress, type ProgressStep } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ProjectPayload } from '@/types';

export type PageId = 'overview' | 'modules' | 'flows' | 'data' | 'risks' | 'code' | 'history';

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
  return <div className="grid h-screen grid-cols-[220px_1fr] bg-background text-foreground">
    <aside className="flex min-h-0 flex-col border-r bg-white">
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white"><SquareCode size={17} /></div>
        <div className="text-sm font-bold">项目快速接管工作台</div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.id === activePage;
          return <Button
            key={item.id}
            type="button"
            variant="ghost"
            onClick={() => onNavigate(item.id)}
            className={cn('h-11 w-full justify-start gap-3 rounded-lg px-3 text-sm shadow-none', active ? 'bg-blue-50 font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </Button>;
        })}
      </nav>
      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">U</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">用户</div>
            <div className="text-xs text-muted-foreground">团队成员</div>
          </div>
        </div>
      </div>
    </aside>

    <div className="flex min-h-0 flex-col">
      <header className="flex h-16 items-center justify-between border-b bg-white px-6">
        <div className="flex min-w-0 items-center gap-5 text-sm text-slate-600">
          <span>项目名称：<strong className="font-semibold text-slate-900">{projectName(payload)}</strong></span>
          <span className="hidden max-w-[420px] truncate lg:inline">项目路径：{payload?.projectDir || '-'}</span>
          <span className="hidden xl:inline">最近分析时间：{payload?.scan?.repoMap?.generatedAt ? formatDate(payload.scan.repoMap.generatedAt) : '-'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onAnalyze} disabled={!!loading}>{hasAiAnalysis ? <RefreshCw size={15} /> : <Sparkles size={15} />}{hasAiAnalysis ? '重新分析' : '开始分析'}</Button>
          <Button size="sm" variant="outline" onClick={onExportReport}><Bot size={15} />导出报告</Button>
          <Button size="sm"><Share2 size={15} />分享项目</Button>
          <Button size="icon" variant="outline" onClick={onOpenSettings} aria-label="AI 设置" title="AI 设置"><Settings size={16} /></Button>
        </div>
      </header>
      <StepProgress steps={analyzeSteps} active={loading === 'analyze'} />
      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {children}
      </main>
    </div>
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
