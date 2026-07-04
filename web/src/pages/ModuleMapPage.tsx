import { Box, Boxes, FileCode2, Search, ShieldAlert } from 'lucide-react';
import { EmptyState, PriorityBadge, SectionTitle, StatCard } from '@/components/PageBlocks';
import { Button } from '@/components/ui/button';
import { VerificationBadge } from '@/components/VerificationControl';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ProjectModule, ProjectPayload, Report } from '@/types';

export function ModuleMapPage({ payload, report, onOpenModule }: { payload: ProjectPayload | null; report: Report | null; onOpenModule: (module: ProjectModule) => void }) {
  const modules = report?.modules || [];
  const externalCount = report?.flows?.filter((flow) => flow.externalCalls?.length).length || 0;
  return <div className="space-y-4">
    <div className="grid grid-cols-[1.4fr_1fr] gap-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="模块依赖关系图" description="基于 Repo Map 和报告模块生成的模块关系概览。" />
          <div className="flex min-h-72 items-center justify-center rounded-xl border bg-slate-50 p-6">
            <div className="grid grid-cols-3 gap-8 text-center">
              {modules.slice(0, 6).map((module, index) => <button key={module.id || module.name} type="button" onClick={() => onOpenModule(module)} className="relative rounded-xl border bg-white px-6 py-4 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/40">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Box size={19} /></div>
                <div className="font-semibold">{module.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{(module.summary || module.responsibility).slice(0, 18)}</div>
                {index > 0 && <div className="absolute -left-8 top-1/2 h-px w-8 bg-slate-300" />}
              </button>)}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        <StatCard icon={<Boxes size={22} />} label="模块总数" value={modules.length} tone="blue" />
        <StatCard icon={<FileCode2 size={22} />} label="关键文件" value={payload?.scan?.repoMap?.importantFiles?.length || 0} tone="green" />
        <StatCard icon={<ShieldAlert size={22} />} label="外部依赖链路" value={externalCount} tone="purple" />
      </div>
    </div>

    <div className="flex items-center justify-between gap-4">
      <div className="flex gap-2">
        <Button variant="default" size="sm">全部（{modules.length}）</Button>
        <Button variant="outline" size="sm">P0（{modules.filter((module) => module.priority === 'P0').length}）</Button>
        <Button variant="outline" size="sm">P1（{modules.filter((module) => module.priority === 'P1').length}）</Button>
      </div>
      <div className="flex w-[420px] items-center gap-2"><Search size={16} className="text-muted-foreground" /><Input placeholder="搜索模块名称或职责" /></div>
    </div>

    <div className="grid grid-cols-3 gap-4">
      {modules.map((module) => <Card key={module.id || module.name} className="transition-colors hover:border-blue-200 hover:bg-blue-50/20">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Box size={20} /></div>
              <div>
                <div className="font-semibold text-slate-950">{module.name}</div>
                <div className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{module.summary || module.responsibility}</div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <PriorityBadge priority={module.priority} />
              <VerificationBadge status={module.verificationStatus} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center text-xs text-muted-foreground">
            <div><div className="font-semibold text-slate-900">{module.entrypoints?.length || module.paths?.length || 0}</div>入口</div>
            <div><div className="font-semibold text-slate-900">{module.keyFiles?.length || module.paths?.slice(0, 4).length || 0}</div>关键文件</div>
            <div><div className="font-semibold text-slate-900">{report?.risks?.filter((risk) => risk.moduleId === module.id || module.paths?.some((path) => risk.path?.includes(path))).length || 0}</div>风险</div>
          </div>
          <Button className="mt-4 w-full" variant="outline" size="sm" onClick={() => onOpenModule(module)}>进入模块详情</Button>
        </CardContent>
      </Card>)}
      {!modules.length && <div className="col-span-3"><EmptyState text="暂无模块信息。" /></div>}
    </div>
  </div>;
}
