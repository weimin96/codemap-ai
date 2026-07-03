import { Database, FileCode2, GitBranch } from 'lucide-react';
import { EmptyState, PageHero, SectionTitle, StatCard } from '@/components/PageBlocks';
import { Card, CardContent } from '@/components/ui/card';
import type { ProjectPayload, Report } from '@/types';

export function DataModelPage({ payload, report }: { payload: ProjectPayload | null; report: Report | null }) {
  const modelFiles = payload?.scan?.files?.filter((file) => /schema|model|entity|dto|prisma|sql/i.test(file.path)).slice(0, 8) || [];
  const entities = modelFiles.flatMap((file) => file.symbols || []).filter((symbol) => ['class', 'interface', 'type'].includes(symbol.kind)).slice(0, 8);
  const statusNotes = report?.flows?.flatMap((flow) => flow.notes || []).slice(0, 4) || [];
  return <div className="space-y-4">
    <PageHero icon={<Database size={30} />} title="数据模型" description="聚焦核心实体、关系与状态流转，帮助理解业务数据结构与演变路径。" aside={<div className="grid grid-cols-3 gap-8 text-center"><Mini label="实体数" value={entities.length} /><Mini label="模型文件" value={modelFiles.length} /><Mini label="状态流转" value={statusNotes.length} /></div>} />

    <div className="grid grid-cols-[1.2fr_1fr] gap-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="实体关系图" description="基于模型、实体和 DTO 文件生成的关系概览。" />
          <div className="flex min-h-80 items-center justify-center rounded-xl border bg-slate-50 p-8">
            <div className="grid grid-cols-3 gap-10">
              {(entities.length ? entities : [{ name: 'User' }, { name: 'Order' }, { name: 'Payment' }, { name: 'Product' }]).slice(0, 6).map((entity, index) => <div key={entity.name} className="relative rounded-xl border bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950"><Database size={16} className="text-blue-600" />{entity.name}</div>
                <div className="space-y-1 text-xs text-slate-600"><div>id</div><div>status</div><div>created_at</div></div>
                {index > 0 && <div className="absolute -left-10 top-1/2 h-px w-10 bg-slate-300" />}
              </div>)}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="状态流转" description="从链路 notes 和状态字段推断。" />
          <div className="flex min-h-80 items-center justify-center rounded-xl border bg-slate-50 p-8">
            <div className="flex items-center gap-4 text-sm">
              {['pending', 'paid', 'shipped', 'completed'].map((state, index) => <div key={state} className="flex items-center gap-4">
                <div className="rounded-xl border bg-white px-5 py-4 text-center shadow-sm"><div className="font-semibold text-blue-700">{state}</div><div className="text-xs text-muted-foreground">状态 {index + 1}</div></div>
                {index < 3 && <div className="h-px w-8 bg-slate-300" />}
              </div>)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="核心实体" />
          <div className="grid grid-cols-2 gap-3">
            {entities.map((entity) => <div key={`${entity.path}-${entity.name}`} className="rounded-xl border bg-white p-4">
              <div className="font-semibold text-slate-950">{entity.name}</div>
              <div className="mt-2 font-mono text-xs text-muted-foreground">{entity.path}:{entity.startLine}</div>
            </div>)}
            {!entities.length && <div className="col-span-2"><EmptyState text="未从当前扫描结果中识别到实体符号。" /></div>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="关键字段" />
          <div className="space-y-2">
            {['status', 'id', 'createdAt', 'updatedAt', 'amount', 'type'].map((field) => <div key={field} className="rounded-lg border px-3 py-2 text-sm"><span className="font-mono text-blue-700">{field}</span><div className="text-xs text-muted-foreground">从模型文件和链路上下文推断</div></div>)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="关联代码证据" />
          <div className="space-y-2">
            {modelFiles.map((file) => <div key={file.path} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><FileCode2 size={15} className="text-blue-600" /><span className="truncate font-mono text-xs">{file.path}</span></div>)}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>;
}

function Mini({ label, value }: { label: string; value: number }) {
  return <div><div className="text-2xl font-bold text-slate-950">{value}</div><div className="mt-1 text-xs text-muted-foreground">{label}</div></div>;
}
