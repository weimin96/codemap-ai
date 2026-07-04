import { ArrowRight, Boxes, Clock3, Cloud, PlayCircle } from 'lucide-react';
import { ActionItem } from '@/components/common/ActionItem';
import { MermaidPanel } from '@/components/MermaidPanel';
import { ConfidenceBadge, EmptyState, LinkButton, PriorityBadge, RiskBadge, SectionTitle, StatCard } from '@/components/PageBlocks';
import { Card, CardContent } from '@/components/ui/card';
import type { PageId } from '@/components/AppShell';
import type { ProjectPayload, Report } from '@/types';

export function OverviewPage({ payload, report, onNavigate }: { payload: ProjectPayload | null; report: Report | null; onNavigate: (page: PageId) => void }) {
  const overview = report?.projectOverview;
  const highRisks = report?.risks?.filter((risk) => risk.level === 'high').length || 0;
  return <div className="space-y-4">
    <div className="grid grid-cols-4 gap-4">
      <StatCard icon={<PlayCircle size={22} />} label="启动方式" value={overview?.startup || '待识别'} hint="项目入口与本地运行方式" tone="blue" />
      <StatCard icon={<Boxes size={22} />} label="核心模块" value={report?.modules?.length || 0} hint="已识别模块数量" tone="green" />
      <StatCard icon={<Cloud size={22} />} label="依赖服务" value={payload?.scan?.summary?.stack?.slice(0, 3).join(' / ') || '待识别'} hint="技术栈与外部依赖线索" tone="purple" />
      <StatCard icon={<Clock3 size={22} />} label="风险 Top" value={highRisks} hint="高风险数量" tone={highRisks ? 'red' : 'slate'} />
    </div>

    <div className="grid grid-cols-[1.35fr_1fr] gap-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="系统架构图" description="系统整体分层与主要依赖关系。" action={<LinkButton onClick={() => onNavigate('flows')}>查看核心链路</LinkButton>} />
          {report?.mermaid ? <MermaidPanel chart={report.mermaid} /> : <EmptyState text="暂无项目图。开始分析后显示。" />}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="核心模块" description="按优先级整理的主要模块。" action={<LinkButton onClick={() => onNavigate('modules')}>查看模块地图</LinkButton>} />
          <div className="grid grid-cols-2 gap-3">
            {report?.modules?.slice(0, 6).map((module) => <ActionItem key={module.name} onClick={() => onNavigate('modules')} className="rounded-xl bg-white p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-slate-950">{module.name}</div>
                <PriorityBadge priority={module.priority} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{module.responsibility}</p>
            </ActionItem>)}
          </div>
          {!report?.modules?.length && <EmptyState text="暂无模块信息。" />}
        </CardContent>
      </Card>
    </div>

    <div className="grid grid-cols-4 gap-4">
      <Card className="col-span-2">
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
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="font-semibold text-slate-950">可信度说明</div>
          <div className="mt-1 text-sm text-muted-foreground">所有 AI 结论都应区分事实、推测和待验证状态。</div>
        </div>
        <div className="flex gap-2"><ConfidenceBadge confidence="fact" /><ConfidenceBadge confidence="guess" /><ConfidenceBadge confidence="unknown" /></div>
      </CardContent>
    </Card>
  </div>;
}
