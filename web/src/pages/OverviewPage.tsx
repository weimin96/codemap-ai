import type { ReactNode } from 'react';
import { ArrowRight, Boxes, Clock3, Cloud, FileCode2, Gauge, GitFork, ListChecks, PlayCircle, Route, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ActionItem } from '@/components/common/ActionItem';
import { MermaidPanel } from '@/components/MermaidPanel';
import { ConfidenceBadge, EmptyState, LinkButton, PriorityBadge, RiskBadge, SectionTitle, StatCard } from '@/components/PageBlocks';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { PageId } from '@/components/AppShell';
import type { CodeGraph, ProjectPayload, Report } from '@/types';

export function OverviewPage({ payload, report, codeGraph, onNavigate }: { payload: ProjectPayload | null; report: Report | null; codeGraph: CodeGraph | null; onNavigate: (page: PageId) => void }) {
  const overview = report?.projectOverview;
  const quality = report?.analysisQuality;
  const highRisks = report?.risks?.filter((risk) => risk.level === 'high').length || 0;
  const warningSummary = buildWarningSummary(report, codeGraph);
  const nextSteps = buildNextSteps(report, highRisks);
  return <div className="space-y-4">
    <Card className="overflow-hidden border-blue-100 bg-gradient-to-br from-white to-blue-50/60">
      <CardContent className="grid gap-6 p-4 md:p-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{overview?.type || '待识别项目类型'}</Badge>
            <ConfidenceBadge confidence={overview?.confidence} />
            {(overview?.techStack || payload?.scan?.summary?.stack || []).slice(0, 5).map((stack) => <Badge key={stack} variant="outline">{stack}</Badge>)}
          </div>
          <h1 className="truncate text-3xl font-bold tracking-tight text-slate-950">{overview?.name || projectName(payload)}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{overview?.summary || '开始分析后，这里会显示项目的一句话定位、主要能力和接管重点。'}</p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
            <div className="rounded-xl border bg-white px-4 py-3"><span className="text-slate-500">启动方式：</span><span className="font-semibold text-slate-950">{overview?.startup || '待识别'}</span></div>
            <div className="rounded-xl border bg-white px-4 py-3"><span className="text-slate-500">模块：</span><span className="font-semibold text-slate-950">{report?.modules?.length || 0}</span></div>
            <div className="rounded-xl border bg-white px-4 py-3"><span className="text-slate-500">链路：</span><span className="font-semibold text-slate-950">{report?.flows?.length || 0}</span></div>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <SectionTitle title="分析质量" description="本次报告使用的扫描与上下文覆盖情况。" />
          <div className="grid grid-cols-2 gap-3">
            <QualityMetric icon={<FileCode2 size={17} />} label="已扫描文件" value={quality?.scannedFiles || payload?.scan?.totalFiles || 0} />
            <QualityMetric icon={<Boxes size={17} />} label="已索引符号" value={quality?.indexedSymbols || payload?.scan?.totalSymbols || 0} />
            <QualityMetric icon={<Gauge size={17} />} label="上下文文件" value={quality?.contextFiles?.length || report?.contextFiles?.length || 0} />
            <QualityMetric icon={<ShieldCheck size={17} />} label="结论可信度" value={qualityLabel(quality?.confidence || overview?.confidence)} />
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            Token 预算：{quality?.tokenBudget ? `${quality.tokenBudget.used}/${quality.tokenBudget.max}` : '待统计'}；解析告警：{quality?.parseWarnings?.length || 0}；跳过文件：{quality?.skippedFiles?.length || 0}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <WarningMetric label="未解析 import" value={warningSummary.unresolvedImport} />
            <WarningMetric label="未解析 call" value={warningSummary.unresolvedCall} />
            <WarningMetric label="parse error" value={warningSummary.parseError} />
            <WarningMetric label="跳过大文件" value={warningSummary.largeSkipped} />
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent className="p-5">
        <SectionTitle title="下一步建议" description="按接管顺序继续，不需要先读完整报告。" />
        <div className="grid gap-3 md:grid-cols-3">
          {nextSteps.map((step) => <ActionItem key={step.title} onClick={() => onNavigate(step.page)} className="rounded-xl bg-white p-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">{step.icon}</div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-950">{step.title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{step.description}</div>
              </div>
              <ArrowRight size={16} className="ml-auto mt-1 shrink-0 text-blue-600" />
            </div>
          </ActionItem>)}
        </div>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <EvidenceShortcut icon={<Boxes size={15} />} label="模块证据" value={report?.modules?.length || 0} onClick={() => onNavigate('modules')} />
          <EvidenceShortcut icon={<Route size={15} />} label="链路证据" value={report?.flows?.length || 0} onClick={() => onNavigate('flows')} />
          <EvidenceShortcut icon={<ShieldAlert size={15} />} label="风险证据" value={report?.risks?.length || 0} onClick={() => onNavigate('risks')} />
          <EvidenceShortcut icon={<GitFork size={15} />} label="代码图谱" value={codeGraph?.totals?.warnings || 0} suffix="告警" onClick={() => onNavigate('graph')} />
        </div>
      </CardContent>
    </Card>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={<PlayCircle size={22} />} label="启动方式" value={overview?.startup || '待识别'} hint="项目入口与本地运行方式" tone="blue" />
      <StatCard icon={<Boxes size={22} />} label="核心模块" value={report?.modules?.length || 0} hint="已识别模块数量" tone="green" />
      <StatCard icon={<Cloud size={22} />} label="依赖服务" value={payload?.scan?.summary?.stack?.slice(0, 3).join(' / ') || '待识别'} hint="技术栈与外部依赖线索" tone="purple" />
      <StatCard icon={<Clock3 size={22} />} label="风险 Top" value={highRisks} hint="高风险数量" tone={highRisks ? 'red' : 'slate'} />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="系统架构图" description="系统整体分层与主要依赖关系。" action={<LinkButton onClick={() => onNavigate('flows')}>查看核心链路</LinkButton>} />
          {report?.mermaid ? <MermaidPanel chart={report.mermaid} /> : <EmptyState text="暂无项目图。开始分析后显示。" />}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="核心模块" description="按优先级整理的主要模块。" action={<LinkButton onClick={() => onNavigate('modules')}>查看模块地图</LinkButton>} />
          <div className="grid gap-3 md:grid-cols-2">
            {report?.modules?.slice(0, 6).map((module) => <ActionItem key={module.name} onClick={() => onNavigate('modules')} className="rounded-xl bg-white p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-slate-950">{module.name}</div>
                <PriorityBadge priority={module.priority} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{module.summary || module.responsibility}</p>
            </ActionItem>)}
          </div>
          {!report?.modules?.length && <EmptyState text="暂无模块信息。" />}
        </CardContent>
      </Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-4">
      <Card className="xl:col-span-2">
        <CardContent className="p-5">
          <SectionTitle title="核心链路" action={<LinkButton onClick={() => onNavigate('flows')}>查看更多链路</LinkButton>} />
          <div className="space-y-2">
            {report?.flows?.slice(0, 4).map((flow) => <ActionItem key={flow.id || flow.name} onClick={() => onNavigate('flows')} className="flex items-center justify-between p-3">
              <div>
                <div className="font-semibold text-slate-900">{flow.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{flow.trigger}</div>
              </div>
              <ArrowRight size={16} className="text-blue-600" />
            </ActionItem>)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="风险 Top 5" action={<LinkButton onClick={() => onNavigate('risks')}>查看风险雷达</LinkButton>} />
          <div className="space-y-2">
            {report?.risks?.slice(0, 5).map((risk, index) => <div key={`${risk.title}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
              <span className="truncate">{risk.title}</span>
              <RiskBadge level={risk.level} />
            </div>)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="30 / 60 / 120 分钟阅读路线" action={<LinkButton onClick={() => onNavigate('history')}>查看路线</LinkButton>} />
          <div className="space-y-3">
            {report?.readingPlan?.slice(0, 3).map((plan) => <div key={plan.timebox} className="border-l-2 border-blue-200 pl-3">
              <div className="text-sm font-semibold text-blue-700">{plan.timebox}</div>
              <div className="text-sm text-slate-700">{plan.goal}</div>
            </div>)}
          </div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold text-slate-950">可信度说明</div>
          <div className="mt-1 text-sm text-muted-foreground">所有 AI 结论都应区分事实、推测和待验证状态。</div>
        </div>
        <div className="flex gap-2"><ConfidenceBadge confidence="fact" /><ConfidenceBadge confidence="guess" /><ConfidenceBadge confidence="unknown" /></div>
      </CardContent>
    </Card>
  </div>;
}

function EvidenceShortcut({ icon, label, value, suffix, onClick }: { icon: ReactNode; label: string; value: number; suffix?: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40">
    <span className="flex items-center gap-2 text-slate-600">{icon}{label}</span>
    <span className="font-semibold text-slate-950">{value}{suffix ? ` ${suffix}` : ''}</span>
  </button>;
}

function buildNextSteps(report: Report | null, highRisks: number): Array<{ title: string; description: string; page: PageId; icon: ReactNode }> {
  const firstPlan = report?.readingPlan?.[0];
  const firstFlow = report?.flows?.[0];
  return [
    {
      title: firstPlan ? `先看 ${firstPlan.timebox} 阅读路线` : '先看 30 分钟阅读路线',
      description: firstPlan?.goal || '用最短路径理解项目入口、核心模块和第一批关键文件。',
      page: 'history',
      icon: <ListChecks size={17} />
    },
    {
      title: highRisks ? `验证 ${Math.min(highRisks, 3)} 个高风险` : '确认当前风险队列',
      description: highRisks ? '优先查看高风险证据、验证步骤和建议测试。' : '查看 AI 标出的风险是否需要确认、驳回或标记过期。',
      page: 'risks',
      icon: <ShieldAlert size={17} />
    },
    {
      title: firstFlow ? `打开核心链路：${firstFlow.name}` : '打开第一条核心链路',
      description: firstFlow?.trigger || '从触发点、执行步骤和代码证据开始验证真实运行顺序。',
      page: 'flows',
      icon: <Route size={17} />
    }
  ];
}

function WarningMetric({ label, value }: { label: string; value: number }) {
  return <div className={`rounded-lg border px-3 py-2 ${value ? 'border-amber-100 bg-amber-50 text-amber-900' : 'bg-white text-slate-600'}`}>
    <div className="text-[11px] text-slate-500">{label}</div>
    <div className="mt-1 font-semibold">{value}</div>
  </div>;
}

function buildWarningSummary(report: Report | null, codeGraph: CodeGraph | null) {
  const graphWarnings = codeGraph?.warnings || [];
  const parseWarnings = report?.analysisQuality?.parseWarnings || [];
  const skippedFiles = report?.analysisQuality?.skippedFiles || [];
  return {
    unresolvedImport: graphWarnings.filter((warning) => warning.kind === 'unresolved_import').length,
    unresolvedCall: graphWarnings.filter((warning) => warning.kind === 'unresolved_call').length,
    parseError: graphWarnings.filter((warning) => warning.kind === 'parse_error' || warning.kind === 'syntax_error').length + parseWarnings.length,
    largeSkipped: skippedFiles.filter((file) => /large|size|大文件|过大/i.test(file.reason)).length
  };
}

function QualityMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return <div className="rounded-xl border bg-white p-3">
    <div className="flex items-center gap-2 text-xs text-slate-500">{icon}{label}</div>
    <div className="mt-2 text-lg font-bold text-slate-950">{value}</div>
  </div>;
}

function qualityLabel(confidence?: string) {
  if (confidence === 'fact') return '高';
  if (confidence === 'guess') return '中';
  return '待验证';
}

function projectName(payload: ProjectPayload | null) {
  return payload?.projectDir?.split(/[\\/]/).filter(Boolean).pop() || '项目加载中';
}
