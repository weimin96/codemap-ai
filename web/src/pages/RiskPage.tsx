import type { ReactNode } from 'react';
import { Code2, FileCheck2, ListChecks, SlidersHorizontal, Target, TriangleAlert } from 'lucide-react';
import { EmptyState, RiskBadge, SectionTitle } from '@/components/PageBlocks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Report, RiskItem } from '@/types';

export function RiskPage({
  report,
  activeRisk,
  onSelectRisk,
  onOpenRiskCode
}: {
  report: Report | null;
  activeRisk: RiskItem | null;
  onSelectRisk: (risk: RiskItem) => void;
  onOpenRiskCode: (risk: RiskItem) => void;
}) {
  const risks = report?.risks || [];
  const high = risks.filter((risk) => risk.level === 'high').length;
  const medium = risks.filter((risk) => risk.level === 'medium').length;
  const low = risks.filter((risk) => risk.level === 'low').length;
  const selected = activeRisk || risks[0] || null;
  const categories = buildCategorySummary(risks);

  return <div className="space-y-4">
    <Card>
      <CardContent className="p-5">
        <SectionTitle title="风险维度分布" description="按权限、状态流转、幂等、事务、并发、缓存、外部依赖等维度归纳。" />
        <div className="grid grid-cols-[1fr_1.2fr] gap-4">
          <div className="flex min-h-48 flex-col justify-center rounded-xl border bg-slate-50 p-6">
            <div className="text-sm font-semibold text-slate-950">风险总览</div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <RiskMetric label="高风险" value={high} tone="red" />
              <RiskMetric label="中风险" value={medium} tone="amber" />
              <RiskMetric label="低风险" value={low} tone="green" />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {categories.map((category) => <div key={category.name} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>{category.name}</span>
              <span><span className="text-red-600">高 {category.high}</span> / <span className="text-amber-600">中 {category.medium}</span> / <span className="text-emerald-600">低 {category.low}</span></span>
            </div>)}
            {!categories.length && <EmptyState text="暂无风险分类。" />}
          </div>
        </div>
      </CardContent>
    </Card>

    <div className="flex items-center justify-between gap-4">
      <div className="flex gap-2">
        <Button size="sm">全部 {risks.length}</Button>
        <Button size="sm" variant="outline">高风险 {high}</Button>
        <Button size="sm" variant="outline">中风险 {medium}</Button>
        <Button size="sm" variant="outline">低风险 {low}</Button>
      </div>
      <div className="flex w-[520px] items-center gap-2"><Input placeholder="搜索风险名称、模块、链路" /><Button variant="outline" size="sm"><SlidersHorizontal size={14} />筛选</Button></div>
    </div>

    <div className="grid grid-cols-[minmax(0,1fr)_420px] gap-4">
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-[1.3fr_80px_120px_1fr_120px] border-b bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
            <div>风险</div><div>等级</div><div>分类</div><div>代码位置</div><div>验证方式</div>
          </div>
          {risks.map((risk, index) => {
            const active = selected === risk || selected?.id === risk.id;
            return <button key={risk.id || `${risk.title}-${index}`} type="button" onClick={() => onSelectRisk(risk)} className={cn('grid w-full grid-cols-[1.3fr_80px_120px_1fr_120px] items-center border-b px-4 py-4 text-left text-sm hover:bg-blue-50/40', active && 'bg-blue-50/60')}>
              <div><div className="font-semibold text-slate-950">{risk.title}</div><div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{risk.reason}</div></div>
              <RiskBadge level={risk.level} />
              <div className="text-slate-600">{categoryLabel(risk.category)}</div>
              <div className="truncate font-mono text-xs text-blue-700">{risk.path || risk.evidence?.[0]?.path || '多处'}{risk.startLine ? `:${risk.startLine}` : ''}</div>
              <div className="line-clamp-2 text-xs text-slate-600">{risk.verify}</div>
            </button>;
          })}
          {!risks.length && <div className="p-5"><EmptyState text="暂无风险信息。" /></div>}
        </CardContent>
      </Card>

      <RiskDetailPanel risk={selected} onOpenRiskCode={onOpenRiskCode} />
    </div>
  </div>;
}

function RiskDetailPanel({ risk, onOpenRiskCode }: { risk: RiskItem | null; onOpenRiskCode: (risk: RiskItem) => void }) {
  return <Card>
    <CardContent className="p-5">
      <SectionTitle title="风险详情" description="解释影响范围、验证步骤和代码证据。" />
      {risk ? <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-950">{risk.title}</div>
            <div className="mt-2 flex flex-wrap gap-2"><RiskBadge level={risk.level} />{risk.category && <Badge variant="outline">{categoryLabel(risk.category)}</Badge>}{risk.confidence && <Badge variant="secondary">{risk.confidence}</Badge>}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => onOpenRiskCode(risk)}><Code2 size={14} />查看代码</Button>
        </div>

        <DetailBlock icon={<TriangleAlert size={16} />} title="为什么危险" content={risk.reason} />
        <DetailBlock icon={<Target size={16} />} title="影响范围" content={risk.impact || '暂无明确影响范围。'} />
        <ListBlock icon={<ListChecks size={16} />} title="验证步骤" items={risk.verifySteps?.length ? risk.verifySteps : [risk.verify || '暂无验证步骤。']} />
        <ListBlock icon={<FileCheck2 size={16} />} title="建议测试" items={risk.suggestedTests?.length ? risk.suggestedTests : ['暂无建议测试。']} />

        <div>
          <div className="mb-2 text-sm font-semibold text-slate-950">代码证据</div>
          <div className="space-y-2">
            {(risk.evidence?.length ? risk.evidence : risk.path ? [{ path: risk.path, startLine: risk.startLine, endLine: risk.endLine, reason: risk.reason, confidence: risk.confidence }] : []).map((reference) => <button key={`${reference.path}-${reference.startLine || ''}`} type="button" onClick={() => onOpenRiskCode(risk)} className="w-full rounded-lg border bg-slate-50 p-3 text-left hover:border-blue-200 hover:bg-blue-50/30">
              <div className="truncate font-mono text-xs font-semibold text-blue-700">{reference.path}{reference.startLine ? `:${reference.startLine}` : ''}</div>
              <div className="mt-1 text-sm leading-5 text-slate-600">{reference.reason}</div>
            </button>)}
            {!risk.evidence?.length && !risk.path && <EmptyState text="暂无代码证据。" />}
          </div>
        </div>
      </div> : <EmptyState text="请选择一个风险查看详情。" />}
    </CardContent>
  </Card>;
}

function DetailBlock({ icon, title, content }: { icon: ReactNode; title: string; content: string }) {
  return <div>
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">{icon}{title}</div>
    <p className="text-sm leading-6 text-slate-600">{content}</p>
  </div>;
}

function ListBlock({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return <div>
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">{icon}{title}</div>
    <ul className="space-y-2 text-sm leading-6 text-slate-600">
      {items.map((item) => <li key={item}>• {item}</li>)}
    </ul>
  </div>;
}

function RiskMetric({ label, value, tone }: { label: string; value: number; tone: 'red' | 'amber' | 'green' }) {
  const toneClass = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-emerald-600';
  return <div className="rounded-xl border bg-white p-4">
    <div className="text-xs text-slate-500">{label}</div>
    <div className={cn('mt-2 text-2xl font-bold', toneClass)}>{value}</div>
  </div>;
}

function buildCategorySummary(risks: RiskItem[]) {
  const names = Array.from(new Set(risks.map((risk) => categoryLabel(risk.category)).filter(Boolean)));
  return names.map((name) => {
    const related = risks.filter((risk) => categoryLabel(risk.category) === name);
    return {
      name,
      high: related.filter((risk) => risk.level === 'high').length,
      medium: related.filter((risk) => risk.level === 'medium').length,
      low: related.filter((risk) => risk.level === 'low').length
    };
  });
}

function categoryLabel(category?: string) {
  const labels: Record<string, string> = {
    permission: '权限',
    state: '状态流转',
    idempotency: '幂等',
    transaction: '事务',
    concurrency: '并发',
    cache: '缓存',
    external: '外部依赖',
    test: '测试覆盖',
    data: '数据',
    'ai-change': 'AI 改动'
  };
  if (!category) return '未分类';
  return labels[category] || category;
}
