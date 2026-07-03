import { Search, ShieldAlert, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { PageHero, RiskBadge, SectionTitle, StatCard } from '@/components/PageBlocks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { PageId } from '@/components/AppShell';
import type { Report } from '@/types';

export function RiskPage({ report, onNavigate }: { report: Report | null; onNavigate: (page: PageId) => void }) {
  const risks = report?.risks || [];
  const high = risks.filter((risk) => risk.level === 'high').length;
  const medium = risks.filter((risk) => risk.level === 'medium').length;
  const low = risks.filter((risk) => risk.level === 'low').length;
  const selected = risks[0];
  return <div className="space-y-4">
    <div className="grid grid-cols-[1fr_1.1fr] gap-4">
      <PageHero icon={<ShieldAlert size={30} />} title="风险雷达" description="从代码静态分析与链路视角识别潜在风险，帮助提前预防线上问题。" aside={<div className="grid grid-cols-4 gap-6 text-center"><Metric label="高风险" value={high} tone="text-red-600" /><Metric label="中风险" value={medium} tone="text-amber-600" /><Metric label="低风险" value={low} tone="text-emerald-600" /><Metric label="待验证" value={report?.unknowns?.length || 0} tone="text-slate-500" /></div>} />
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="风险维度分布" description="按权限、状态流转、幂等、事务、并发、缓存、外部依赖等维度归纳。" />
          <div className="grid grid-cols-[1fr_1.2fr] gap-4">
            <div className="flex min-h-48 items-center justify-center rounded-xl border bg-slate-50 text-sm text-muted-foreground">风险雷达图占位</div>
            <div className="space-y-2 text-sm">
              {['权限', '状态流转', '幂等', '事务', '并发', '缓存', '外部依赖', '测试覆盖'].map((name, index) => <div key={name} className="flex items-center justify-between rounded-md border px-3 py-2"><span>{name}</span><span><span className="text-red-600">高 {index % 3}</span> / <span className="text-amber-600">中 {index % 2}</span> / <span className="text-emerald-600">低 {index % 4}</span></span></div>)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="flex items-center justify-between gap-4">
      <div className="flex gap-2">
        <Button size="sm">全部 {risks.length}</Button>
        <Button size="sm" variant="outline">高风险 {high}</Button>
        <Button size="sm" variant="outline">中风险 {medium}</Button>
        <Button size="sm" variant="outline">低风险 {low}</Button>
      </div>
      <div className="flex w-[520px] items-center gap-2"><Input placeholder="搜索风险名称、模块、链路" /><Button variant="outline" size="sm"><SlidersHorizontal size={14} />筛选</Button></div>
    </div>

    <div className="grid grid-cols-[1fr_360px] gap-4">
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-[1.3fr_80px_120px_1fr_120px] border-b bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
            <div>风险</div><div>等级</div><div>所属模块</div><div>代码位置</div><div>验证方式</div>
          </div>
          {risks.map((risk, index) => <div key={`${risk.title}-${index}`} className="grid grid-cols-[1.3fr_80px_120px_1fr_120px] items-center border-b px-4 py-4 text-sm hover:bg-blue-50/40">
            <div><div className="font-semibold text-slate-950">{risk.title}</div><div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{risk.reason}</div></div>
            <RiskBadge level={risk.level} />
            <div className="text-slate-600">{risk.path?.split('/')[0] || 'unknown'}</div>
            <div className="font-mono text-xs text-blue-700">{risk.path || '多处'}{risk.startLine ? `:${risk.startLine}` : ''}</div>
            <div className="text-xs text-slate-600">{risk.verify}</div>
          </div>)}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="风险详情" />
          {selected ? <div className="space-y-4">
            <div className="flex items-center gap-2"><RiskBadge level={selected.level} /><span className="font-semibold">{selected.title}</span></div>
            <div><div className="mb-1 text-sm font-semibold">风险说明</div><p className="text-sm leading-6 text-slate-600">{selected.reason}</p></div>
            <div><div className="mb-1 text-sm font-semibold">建议验证步骤</div><p className="text-sm leading-6 text-slate-600">{selected.verify}</p></div>
            <div><div className="mb-1 text-sm font-semibold">相关文件</div><div className="rounded-lg border bg-slate-50 p-3 font-mono text-xs text-blue-700">{selected.path || '待定位'}</div></div>
            <Button className="w-full" onClick={() => onNavigate('code')}><TriangleAlert size={15} />查看相关代码</Button>
          </div> : <div className="text-sm text-muted-foreground">暂无风险详情。</div>}
        </CardContent>
      </Card>
    </div>
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div><div className={`text-3xl font-bold ${tone}`}>{value}</div><div className="mt-1 text-xs text-muted-foreground">{label}</div></div>;
}
