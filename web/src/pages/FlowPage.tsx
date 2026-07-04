import type { ReactNode } from 'react';
import { Code2, Database, ExternalLink, Route, ShieldCheck } from 'lucide-react';
import { ActionItem } from '@/components/common/ActionItem';
import { MermaidPanel } from '@/components/MermaidPanel';
import { EmptyState, PriorityBadge, RiskHint, SectionTitle } from '@/components/PageBlocks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PageId } from '@/components/AppShell';
import type { CoreFlow, FlowStep, Report } from '@/types';

export function FlowPage({ report, activeFlow, onSelectFlow, onOpenStep, onNavigate }: {
  report: Report | null;
  activeFlow: CoreFlow | null;
  onSelectFlow: (flow: CoreFlow) => void;
  onOpenStep: (step: FlowStep) => void;
  onNavigate: (page: PageId) => void;
}) {
  const selected = activeFlow || report?.flows?.[0] || null;
  return <div className="space-y-4">
    <Card>
      <CardContent className="p-5">
        <SectionTitle title="链路图（顺序流 / Mermaid）" description="节点点击可进入代码浏览器中的对应步骤。" action={<Button variant="outline" size="sm" onClick={() => onNavigate('code')}><Code2 size={15} />查看对应代码</Button>} />
        {selected?.mermaid ? <MermaidPanel chart={selected.mermaid} /> : <EmptyState text="暂无链路图。" />}
      </CardContent>
    </Card>

    <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr] gap-4">
      <Card className="row-span-2">
        <CardContent className="p-5">
          <SectionTitle title="代码剧本（执行步骤）" />
          <div className="space-y-3">
            {selected?.steps?.map((step) => <ActionItem key={`${step.order}-${step.path}`} onClick={() => onOpenStep(step)} className="flex gap-3 p-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">{step.order}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-950">{step.description}</div>
                <div className="mt-1 truncate text-xs font-mono text-blue-700">{step.path}{step.startLine ? `:${step.startLine}` : ''}</div>
              </div>
              <ExternalLink size={14} className="text-blue-600" />
            </ActionItem>)}
          </div>
        </CardContent>
      </Card>
      <FactCard icon={<Database size={17} />} title="数据读取" items={selected?.dataReads} />
      <FactCard icon={<Database size={17} />} title="数据写入" items={selected?.dataWrites} />
      <FactCard icon={<ShieldCheck size={17} />} title="状态变化" items={selected?.notes} />
      <FactCard icon={<ExternalLink size={17} />} title="外部调用" items={selected?.externalCalls} />
      <FactCard icon={<Route size={17} />} title="异常路径" items={selected?.unknowns} />
      <FactCard icon={<Code2 size={17} />} title="推荐断点" items={selected?.breakpoints} />
    </div>

    <Card>
      <CardContent className="p-5">
        <SectionTitle title="全部核心链路" description="选择链路后查看图表、步骤和代码证据。" />
        <div className="grid grid-cols-3 gap-3">
          {report?.flows?.map((flow) => <ActionItem key={flow.id || flow.name} onClick={() => onSelectFlow(flow)} className="rounded-xl bg-white p-4 text-sm">
            <div className="flex items-start justify-between gap-3"><div className="font-semibold text-slate-950">{flow.name}</div><PriorityBadge priority={flow.priority} /></div>
            <div className="mt-2 line-clamp-2 text-sm text-slate-600">{flow.trigger}</div>
            <div className="mt-3 text-xs text-muted-foreground">{flow.steps.length} 个步骤 · {flow.kind || 'unknown'}</div>
          </ActionItem>)}
        </div>
      </CardContent>
    </Card>

    <RiskHint>链路由 AI 报告生成，仍需要结合断点、日志和测试验证真实运行顺序。</RiskHint>
  </div>;
}

function FactCard({ icon, title, items }: { icon: ReactNode; title: string; items?: string[] }) {
  return <Card>
    <CardContent className="p-5">
      <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950">{icon}{title}</div>
      <ul className="space-y-2 text-sm leading-6 text-slate-600">
        {(items?.length ? items : ['暂无明确证据']).slice(0, 5).map((item) => <li key={item}>• {item}</li>)}
      </ul>
    </CardContent>
  </Card>;
}
