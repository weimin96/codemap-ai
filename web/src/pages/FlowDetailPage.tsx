import type { ReactNode } from 'react';
import { ArrowLeft, Code2, Database, ExternalLink, GitBranch, Route, ShieldCheck, TriangleAlert } from 'lucide-react';
import { MermaidPanel } from '@/components/MermaidPanel';
import { EmptyState, PriorityBadge, SectionTitle } from '@/components/PageBlocks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VerificationControl } from '@/components/VerificationControl';
import type { CoreFlow, FlowStep, Report, VerificationStatus } from '@/types';

export function FlowDetailPage({
  report,
  activeFlow,
  loading,
  onBack,
  onOpenStep,
  onUpdateVerification
}: {
  report: Report | null;
  activeFlow: CoreFlow | null;
  loading: string;
  onBack: () => void;
  onOpenStep: (step: FlowStep) => void;
  onUpdateVerification: (kind: 'flow', id: string, status: VerificationStatus) => void;
}) {
  const flow = activeFlow || report?.flows?.[0] || null;
  if (!flow) return <EmptyState text="暂无链路信息。" />;

  const relatedRisks = (report?.risks || []).filter((risk) => risk.flowId === flow.id || flow.steps.some((step) => risk.path && step.path.includes(risk.path)));

  return <div className="space-y-4">
    <Card className="border-blue-100 bg-white">
      <CardContent className="p-5">
        <Button variant="ghost" size="sm" className="mb-4 px-0 text-slate-600" onClick={onBack}><ArrowLeft size={16} />返回核心链路</Button>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <PriorityBadge priority={flow.priority} />
              <Badge variant="outline">{flow.kind || 'unknown'}</Badge>
              <Badge variant="secondary">{flow.confidence === 'fact' ? '确定事实' : flow.confidence === 'guess' ? '合理推测' : '待验证'}</Badge>
            </div>
            <h1 className="text-2xl font-bold text-slate-950">{flow.name}</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">触发：{flow.trigger || '未识别触发条件'}</p>
          </div>
          <div className="w-[440px] space-y-4">
            <VerificationControl status={flow.verificationStatus} disabled={loading === 'verification'} onChange={(status) => onUpdateVerification('flow', flow.id || flow.name, status)} />
            <div className="grid grid-cols-4 gap-3 text-center">
              <Metric label="步骤" value={flow.steps.length} />
            <Metric label="读取" value={flow.dataReads?.length || 0} />
            <Metric label="写入" value={flow.dataWrites?.length || 0} />
              <Metric label="风险" value={relatedRisks.length} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <div className="grid grid-cols-[1.2fr_1fr] gap-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="链路图" description="从触发点到核心处理步骤的可视化路径。" />
          {flow.mermaid ? <MermaidPanel chart={flow.mermaid} /> : <EmptyState text="暂无链路图。" />}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="调用时序" description="用于理解参与方和调用顺序。" />
          {flow.sequenceDiagram ? <MermaidPanel chart={flow.sequenceDiagram} /> : <EmptyState text="暂无时序图。" />}
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardContent className="p-5">
        <SectionTitle title="代码剧本" description="按执行顺序列出入口、处理、数据读写和返回节点。" />
        <div className="space-y-3">
          {flow.steps.map((step) => <button key={`${step.order}-${step.path}-${step.symbol || ''}`} type="button" onClick={() => onOpenStep(step)} className="flex w-full gap-3 rounded-xl border bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">{step.order}</div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-950">{step.description || '未命名步骤'}</div>
              <div className="mt-1 truncate font-mono text-xs text-blue-700">{step.path}{step.startLine ? `:${step.startLine}` : ''}{step.symbol ? ` · ${step.symbol}` : ''}</div>
            </div>
            <ExternalLink size={15} className="text-blue-600" />
          </button>)}
          {!flow.steps.length && <EmptyState text="暂无执行步骤。" />}
        </div>
      </CardContent>
    </Card>

    <div className="grid grid-cols-3 gap-4">
      <FactCard icon={<Database size={17} />} title="数据读取" items={flow.dataReads} empty="暂无明确读取证据" />
      <FactCard icon={<Database size={17} />} title="数据写入" items={flow.dataWrites} empty="暂无明确写入证据" />
      <FactCard icon={<ShieldCheck size={17} />} title="状态变化" items={flow.notes} empty="暂无明确状态变化" />
      <FactCard icon={<ExternalLink size={17} />} title="外部调用" items={flow.externalCalls} empty="暂无外部调用" />
      <FactCard icon={<Route size={17} />} title="异常路径" items={flow.unknowns} empty="暂无异常路径证据" />
      <FactCard icon={<Code2 size={17} />} title="推荐断点" items={flow.breakpoints} empty="暂无推荐断点" />
    </div>

    <div className="grid grid-cols-[1fr_1fr] gap-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="相关风险" description="该链路可能涉及的风险与验证点。" />
          <div className="space-y-3">
            {relatedRisks.map((risk) => <div key={risk.id || risk.title} className="rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <TriangleAlert size={17} className="mt-0.5 text-amber-600" />
                <div>
                  <div className="font-semibold text-slate-950">{risk.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{risk.reason}</p>
                </div>
              </div>
            </div>)}
            {!relatedRisks.length && <EmptyState text="暂无关联风险。" />}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="代码证据" description="链路判断依赖的文件证据。" />
          <div className="space-y-3">
            {(flow.evidence || []).map((reference) => <button key={`${reference.path}-${reference.symbol || ''}`} type="button" onClick={() => onOpenStep({ order: 1, path: reference.path, symbol: reference.symbol, startLine: reference.startLine, endLine: reference.endLine, description: reference.reason })} className="flex w-full items-start gap-3 rounded-xl border p-3 text-left hover:border-blue-200 hover:bg-blue-50/30">
              <GitBranch size={16} className="mt-0.5 text-blue-700" />
              <div className="min-w-0">
                <div className="truncate font-mono text-xs font-semibold text-slate-950">{reference.path}</div>
                <div className="mt-1 text-sm text-slate-600">{reference.reason}</div>
              </div>
            </button>)}
            {!flow.evidence?.length && <EmptyState text="暂无代码证据。" />}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border bg-slate-50 p-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-2 text-lg font-bold text-slate-950">{value}</div>
  </div>;
}

function FactCard({ icon, title, items, empty }: { icon: ReactNode; title: string; items?: string[]; empty: string }) {
  return <Card>
    <CardContent className="p-5">
      <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950">{icon}{title}</div>
      <ul className="space-y-2 text-sm leading-6 text-slate-600">
        {(items?.length ? items : [empty]).slice(0, 6).map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </CardContent>
  </Card>;
}
