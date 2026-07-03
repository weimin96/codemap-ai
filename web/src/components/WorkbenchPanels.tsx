import { Sparkles } from 'lucide-react';
import { ActionItem } from '@/components/common/ActionItem';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CoreFlow, FlowStep, Report, SymbolInfo } from '@/types';

export function Overview({ report, confidenceVariant }: { report: Report | null; confidenceVariant: (c?: string) => string }) {
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-sm"><Sparkles size={16} />项目概览</CardTitle>
      <CardDescription>{report?.generatedBy === 'ai' ? 'AI 分析结果' : '启发式预览，建议配置 AI 后分析'}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2"><span>类型</span><Badge variant={confidenceVariant(report?.projectOverview?.confidence) as any}>{report?.projectOverview?.confidence || 'unknown'}</Badge></div>
      <div className="font-medium">{report?.projectOverview?.type || '未知'}</div>
      <div className="text-xs text-muted-foreground">{report?.projectOverview?.summary}</div>
      <div className="flex flex-wrap gap-1">{report?.projectOverview?.techStack?.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
    </CardContent>
  </Card>;
}

export function FlowDetail({ flow, onOpenStep }: { flow: CoreFlow; onOpenStep: (step: FlowStep) => void }) {
  return <div className="space-y-3">
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">{flow.name}</div>
        <Badge variant="outline">{flow.kind || 'unknown'}</Badge>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{flow.trigger}</div>
    </div>
    <div className="space-y-1">
      {flow.steps?.map((step) => (
        <ActionItem key={`${step.order}-${step.path}-${step.symbol || ''}`} onClick={() => onOpenStep(step)}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{step.order}. {step.description}</span>
            <Badge variant="secondary">{step.confidence || flow.confidence}</Badge>
          </div>
          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{step.path}{step.symbol ? ` · ${step.symbol}` : ''}</div>
          {step.startLine && <div className="text-[10px] text-muted-foreground">L{step.startLine}{step.endLine ? `-L${step.endLine}` : ''}</div>}
        </ActionItem>
      ))}
    </div>
    <FlowFacts title="数据读取" items={flow.dataReads} />
    <FlowFacts title="数据写入" items={flow.dataWrites} />
    <FlowFacts title="外部调用" items={flow.externalCalls} />
    <FlowFacts title="推荐断点" items={flow.breakpoints} />
    <FlowFacts title="不确定点" items={flow.unknowns?.length ? flow.unknowns : flow.notes} />
  </div>;
}

export function ContextSummary({ currentFile, currentSymbol, activeFlow, activeRisk, selection }: {
  currentFile: { path: string } | null;
  currentSymbol: SymbolInfo | null;
  activeFlow: CoreFlow | null;
  activeRisk: { title?: string } | null;
  selection: { startLine: number; endLine: number } | null;
}) {
  return <div className="rounded-lg border bg-slate-50 p-3 text-xs text-muted-foreground space-y-1">
    <div>文件：<span className="font-mono text-slate-900">{currentFile?.path || '-'}</span></div>
    <div>符号：<span className="text-slate-900">{currentSymbol ? `${currentSymbol.kind} ${currentSymbol.name}` : '-'}</span></div>
    <div>选区：<span className="text-slate-900">{selection ? `L${selection.startLine}-L${selection.endLine}` : '-'}</span></div>
    <div>链路：<span className="text-slate-900">{activeFlow?.name || '-'}</span></div>
    <div>风险：<span className="text-slate-900">{activeRisk?.title || '-'}</span></div>
  </div>;
}

function FlowFacts({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return <div className="rounded-md border p-2">
    <div className="mb-1 text-xs font-medium">{title}</div>
    <div className="space-y-1">
      {items.slice(0, 6).map((item) => <div key={item} className="font-mono text-[10px] text-muted-foreground break-all">{item}</div>)}
    </div>
  </div>;
}
