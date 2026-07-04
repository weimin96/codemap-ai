import { SectionTitle } from '@/components/PageBlocks';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AskThreadEntry, Report } from '@/types';

export function HistoryPage({ report, askThreads }: { report: Report | null; askThreads: AskThreadEntry[] }) {
  const groupedThreads = groupByScope(askThreads);
  return <div className="space-y-4">
    <div className="grid grid-cols-[1fr_420px] gap-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="阅读路线" description="按照 30 / 60 / 120 分钟路径接管项目。" />
          <div className="space-y-3">
            {report?.readingPlan?.map((plan, index) => <div key={`${plan.timebox}-${index}`} className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">{index + 1}</div><div className="font-semibold text-slate-950">{plan.timebox} · {plan.goal}</div></div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{plan.output}</div>
              <div className="mt-3 flex flex-wrap gap-2">{plan.files?.slice(0, 6).map((file) => <span key={file} className="rounded-full border bg-slate-50 px-3 py-1 font-mono text-xs text-slate-600">{file}</span>)}</div>
            </div>)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="待验证问题" />
          <div className="space-y-2">
            {(report?.unknowns?.length ? report.unknowns : ['核心链路是否覆盖全部入口？', '外部服务失败时是否有降级逻辑？', '数据写入是否具备幂等保护？']).map((item, index) => <div key={item} className="flex items-start gap-3 rounded-lg border p-3 text-sm"><span className="text-blue-700">{index + 1}</span><span className="leading-6 text-slate-700">{item}</span></div>)}
          </div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardContent className="p-5">
        <SectionTitle title="追问历史" description="按项目、链路、风险、文件、符号或选区自动归档。当前版本保存在浏览器 localStorage。" />
        <div className="space-y-4">
          {!groupedThreads.length && <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-500">暂无追问历史。完成一次追问后会按上下文范围归档。</div>}
          {groupedThreads.map((group) => <div key={group.scopeKey} className="rounded-xl border bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{group.scopeLabel}</div>
                <div className="mt-1 font-mono text-xs text-slate-500">{group.scopeKey}</div>
              </div>
              <Badge variant="outline">{scopeTypeLabel(group.scopeType)} · {group.items.length}</Badge>
            </div>
            <div className="space-y-2">
              {group.items.slice(0, 5).map((entry) => <div key={entry.id} className="rounded-lg border bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-slate-950">{entry.question}</div>
                  <div className="shrink-0 text-xs text-slate-400">{formatDate(entry.createdAt)}</div>
                </div>
                <div className="mt-2 line-clamp-2 text-slate-600">{entry.answer.conclusion || entry.answer.markdown}</div>
              </div>)}
            </div>
          </div>)}
        </div>
      </CardContent>
    </Card>
  </div>;
}

function groupByScope(entries: AskThreadEntry[]) {
  const map = new Map<string, { scopeKey: string; scopeType: AskThreadEntry['scopeType']; scopeLabel: string; items: AskThreadEntry[] }>();
  for (const entry of entries) {
    const group = map.get(entry.scopeKey) || { scopeKey: entry.scopeKey, scopeType: entry.scopeType, scopeLabel: entry.scopeLabel, items: [] };
    group.items.push(entry);
    map.set(entry.scopeKey, group);
  }
  return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
}

function scopeTypeLabel(type: AskThreadEntry['scopeType']) {
  return ({ project: '项目', module: '模块', flow: '链路', risk: '风险', file: '文件', symbol: '符号', selection: '选区' })[type];
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
