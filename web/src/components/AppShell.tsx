import type { ReactNode } from 'react';
import { Bot, Boxes, BrainCircuit, CheckCircle2, Code2, Database, FileClock, FileText, GitFork, GraduationCap, Home, KeyRound, Map, RefreshCw, Route, Settings, ShieldAlert, Sparkles, TriangleAlert, X } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StepProgress, type ProgressStep } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { AiConfig, CodeGraph, Notice, ProjectPayload, Report } from '@/types';
import type { AnalysisProgress } from '@/hooks/useWorkbenchData';

export type PageId = 'overview' | 'modules' | 'module-detail' | 'flows' | 'flow-detail' | 'data' | 'risks' | 'graph' | 'course' | 'code' | 'history';

const navItems: Array<{ id: PageId; label: string; icon: typeof Home }> = [
  { id: 'overview', label: '项目总览', icon: Home },
  { id: 'modules', label: '模块地图', icon: Map },
  { id: 'flows', label: '核心链路', icon: Route },
  { id: 'data', label: '数据模型', icon: Database },
  { id: 'risks', label: '风险雷达', icon: ShieldAlert },
  { id: 'graph', label: '代码图谱', icon: GitFork },
  { id: 'course', label: '学习课程', icon: GraduationCap },
  { id: 'code', label: '代码浏览器', icon: Code2 },
  { id: 'history', label: '追问历史', icon: FileClock }
];

const analyzeSteps: ProgressStep[] = [
  { label: '扫描项目结构', description: '读取文件树、入口文件和符号索引', value: 10, icon: <Boxes size={15} /> },
  { label: '构建代码图谱', description: '解析导入、调用和图谱邻居', value: 25, icon: <GitFork size={15} /> },
  { label: 'AI 分析项目总览', description: '先生成总览、入口和阅读路线', value: 35, icon: <BrainCircuit size={15} /> },
  { label: 'AI 分析模块', description: '按候选模块分批生成结构化结果', value: 55, icon: <Map size={15} /> },
  { label: 'AI 分析链路', description: '按入口和图谱邻居提取核心链路', value: 74, icon: <Route size={15} /> },
  { label: 'AI 分析风险', description: '基于已有阶段提取风险和数据模型', value: 88, icon: <ShieldAlert size={15} /> },
  { label: '合并阶段结果', description: '规范化结构并写入本地分析结果', value: 94, icon: <Sparkles size={15} /> }
];

export function AppShell({
  activePage,
  payload,
  report,
  codeGraph,
  config,
  notice,
  loading,
  hasAiAnalysis,
  children,
  onNavigate,
  onAnalyze,
  onCancelAnalyze,
  analysisProgress,
  onClearNotice,
  onExportReport,
  onExportDocs,
  onOpenSettings
}: {
  activePage: PageId;
  payload: ProjectPayload | null;
  report: Report | null;
  codeGraph: CodeGraph | null;
  config: AiConfig;
  notice: Notice | null;
  loading: string;
  hasAiAnalysis: boolean;
  children: ReactNode;
  onNavigate: (page: PageId) => void;
  onAnalyze: () => void;
  onCancelAnalyze: () => void;
  analysisProgress: AnalysisProgress | null;
  onClearNotice: () => void;
  onExportReport: () => void;
  onExportDocs: () => void;
  onOpenSettings: () => void;
}) {
  return <div className="flex h-screen flex-col bg-background text-foreground">
    {notice && <NoticeToast notice={notice} onClose={onClearNotice} />}
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 md:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <BrandMark />
        <div className="min-w-0 border-l pl-4">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-sm font-bold text-slate-950">{projectName(payload)}</h1>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{payload?.report?.projectOverview?.type || '待识别'}</span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-4 text-xs text-slate-500">
            <span className="max-w-[420px] truncate">{payload?.projectDir || '项目加载中'}</span>
            <span className="hidden xl:inline">最近分析：{payload?.scan?.repoMap?.generatedAt ? formatDate(payload.scan.repoMap.generatedAt) : '-'}</span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {loading === 'analyze'
          ? <Button size="sm" variant="outline" onClick={onCancelAnalyze}><RefreshCw size={15} />取消分析</Button>
          : <Button size="sm" variant="outline" onClick={onAnalyze} disabled={!!loading}>{hasAiAnalysis ? <RefreshCw size={15} /> : <Sparkles size={15} />}{hasAiAnalysis ? '重新分析' : '开始分析'}</Button>}
        <Button size="sm" variant="outline" onClick={onExportReport}><Bot size={15} />导出上下文</Button>
        <Button size="sm" variant="outline" onClick={onExportDocs}><FileText size={15} />接管文档</Button>
        <Button size="icon" variant="outline" onClick={onOpenSettings} aria-label="AI 设置" title="AI 设置"><Settings size={16} /></Button>
      </div>
    </header>

    <nav className="flex min-h-14 items-center gap-2 overflow-x-auto border-b bg-white px-4 py-2 md:px-6">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.id === activePage || (activePage === 'module-detail' && item.id === 'modules') || (activePage === 'flow-detail' && item.id === 'flows');
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

    <StepProgress steps={analyzeSteps} active={loading === 'analyze'} current={analysisProgress || undefined} />
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
      <div className="mb-4">
        {hasAiAnalysis ? <AnalyzeResultSummaryCard report={report} codeGraph={codeGraph} onNavigate={onNavigate} /> : <PreAnalyzeCard payload={payload} config={config} loading={loading} onAnalyze={onAnalyze} onOpenSettings={onOpenSettings} />}
      </div>
      {children}
    </main>
  </div>;
}

function NoticeToast({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const tone = notice.type === 'error'
    ? 'border-red-100 bg-red-50 text-red-900'
    : notice.type === 'warning'
      ? 'border-amber-100 bg-amber-50 text-amber-900'
      : notice.type === 'success'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-900'
        : 'border-blue-100 bg-blue-50 text-blue-900';
  return <div className={cn('fixed right-4 top-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-xl border p-4 shadow-lg', tone)}>
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{notice.type === 'success' ? <CheckCircle2 size={17} /> : notice.type === 'error' ? <TriangleAlert size={17} /> : <ShieldAlert size={17} />}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{notice.title}</div>
        <div className="mt-1 text-sm leading-5 opacity-90">{notice.message}</div>
        {notice.action && <Button type="button" size="sm" variant="outline" className="mt-3 bg-white/70" onClick={notice.action.onClick}>{notice.action.label}</Button>}
      </div>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClose} aria-label="关闭通知"><X size={15} /></Button>
    </div>
  </div>;
}

function PreAnalyzeCard({ payload, config, loading, onAnalyze, onOpenSettings }: { payload: ProjectPayload | null; config: AiConfig; loading: string; onAnalyze: () => void; onOpenSettings: () => void }) {
  const providerReady = isProviderReady(config);
  return <section className="rounded-xl border bg-white p-4 shadow-sm">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">分析前预检</Badge>
          <Badge variant={providerReady ? 'success' : 'warning'}>{providerReady ? 'AI provider 已配置' : '需要配置 AI provider'}</Badge>
        </div>
        <div className="mt-2 text-sm text-slate-600">开始分析前确认项目、扫描规模和 AI 配置，避免失败后才回到设置。</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!providerReady && <Button type="button" variant="outline" onClick={onOpenSettings}><KeyRound size={15} />配置 AI</Button>}
        <Button type="button" onClick={onAnalyze} disabled={!!loading || !providerReady}><Sparkles size={15} />开始分析</Button>
      </div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <PrecheckMetric label="当前项目路径" value={payload?.projectDir || '项目加载中'} />
      <PrecheckMetric label="扫描文件数" value={payload?.scan?.totalFiles ?? 0} />
      <PrecheckMetric label="AI provider" value={`${config.provider || '未配置'} · ${config.model || '未配置模型'}`} />
      <PrecheckMetric label="敏感文件跳过" value="分析时检查" />
    </div>
  </section>;
}

function AnalyzeResultSummaryCard({ report, codeGraph, onNavigate }: { report: Report | null; codeGraph: CodeGraph | null; onNavigate: (page: PageId) => void }) {
  const quality = report?.analysisQuality;
  const tokenBudget = quality?.tokenBudget;
  const skippedFiles = quality?.skippedFiles?.length || 0;
  const graphWarnings = codeGraph?.warnings?.length || codeGraph?.totals?.warnings || 0;
  const schemaWarnings = report?.dataModel?.risks?.length || 0;
  const partial = Boolean(quality?.partial);
  const stageLabel = partialStageLabel(quality?.stage);
  const targetPage = partial ? partialStagePage(quality?.stage) : 'risks';
  return <section className={cn('rounded-xl border bg-white p-4 shadow-sm', partial && 'border-amber-200 bg-amber-50/35')}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={partial ? 'warning' : 'success'}>{partial ? '生成中' : '分析完成'}</Badge>
          {partial && <Badge variant="secondary">部分报告</Badge>}
          <span className="text-sm font-semibold text-slate-950">{partial ? `当前阶段：${stageLabel}` : '结果摘要'}</span>
        </div>
        <div className="mt-2 text-sm text-slate-600">
          {partial ? '阶段结果会逐步补齐。完整报告生成前，人工验证入口会暂时锁定。' : '本次报告已生成，下一步建议进入风险队列做人工确认。'}
        </div>
      </div>
      <Button type="button" variant={partial ? 'outline' : 'default'} onClick={() => onNavigate(targetPage)}>
        {partial ? <FileText size={15} /> : <ShieldAlert size={15} />}{partial ? '查看已生成内容' : '继续验证风险'}
      </Button>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <PrecheckMetric label="当前状态" value={partial ? stageLabel : '完整报告'} />
      <PrecheckMetric label="上下文文件" value={quality?.contextFiles?.length || report?.contextFiles?.length || 0} />
      <PrecheckMetric label="token 使用量" value={tokenBudget ? `${tokenBudget.used}/${tokenBudget.max}` : '未统计'} />
      <PrecheckMetric label="跳过文件" value={skippedFiles} />
      <PrecheckMetric label="graph warning" value={graphWarnings} />
      <PrecheckMetric label="schema warning" value={schemaWarnings} />
    </div>
  </section>;
}

function partialStageLabel(stage?: string) {
  return {
    overview: '项目总览',
    modules: '模块分析',
    flows: '链路分析',
    risks: '风险分析'
  }[stage || ''] || '生成中';
}

function partialStagePage(stage?: string): PageId {
  if (stage === 'modules') return 'modules';
  if (stage === 'flows') return 'flows';
  if (stage === 'risks') return 'risks';
  return 'overview';
}

function PrecheckMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-0 rounded-lg border bg-slate-50 px-3 py-2">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 truncate text-sm font-semibold text-slate-950" title={String(value)}>{value}</div>
  </div>;
}

function isProviderReady(config: AiConfig) {
  if (config.provider === 'ollama') return Boolean(config.model);
  return Boolean(config.provider && config.model && config.apiKey);
}

function projectName(payload: ProjectPayload | null) {
  return payload?.report?.projectOverview?.name || payload?.projectDir?.split(/[\\/]/).filter(Boolean).pop() || '项目加载中';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
