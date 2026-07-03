import { FileClock } from 'lucide-react';
import { PageHero, SectionTitle } from '@/components/PageBlocks';
import { Card, CardContent } from '@/components/ui/card';
import type { Report } from '@/types';

export function HistoryPage({ report }: { report: Report | null }) {
  return <div className="space-y-4">
    <PageHero icon={<FileClock size={30} />} title="追问历史" description="沉淀围绕项目、模块、链路、风险和代码证据的上下文追问记录。当前版本展示阅读路线和待验证问题，历史持久化将在后续版本增强。" />
    <div className="grid grid-cols-[1fr_380px] gap-4">
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
  </div>;
}
