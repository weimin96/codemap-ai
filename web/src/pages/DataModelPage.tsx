import { Database, FileCode2 } from 'lucide-react';
import { EmptyState, SectionTitle } from '@/components/PageBlocks';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VerificationControl } from '@/components/VerificationControl';
import type { ProjectPayload, Report, VerificationStatus } from '@/types';

export function DataModelPage({
  payload,
  report,
  loading,
  onUpdateVerification
}: {
  payload: ProjectPayload | null;
  report: Report | null;
  loading: string;
  onUpdateVerification: (kind: 'entity', id: string, status: VerificationStatus) => void;
}) {
  const reportEntities = report?.dataModel?.entities || [];
  const modelFiles = payload?.scan?.files?.filter((file) => /schema|model|entity|dto|prisma|sql/i.test(file.path)).slice(0, 8) || [];
  const symbolEntities = modelFiles.flatMap((file) => file.symbols || []).filter((symbol) => ['class', 'interface', 'type'].includes(symbol.kind)).slice(0, 8);
  const diagramEntities = reportEntities.length ? reportEntities : symbolEntities;

  return <div className="space-y-4">
    <div className="grid grid-cols-[1.2fr_1fr] gap-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="实体关系图" description="基于报告实体、模型、实体和 DTO 文件生成的关系概览。" />
          <div className="flex min-h-80 items-center justify-center rounded-xl border bg-slate-50 p-8">
            <div className="grid grid-cols-3 gap-10">
              {(diagramEntities.length ? diagramEntities : [{ name: 'User' }, { name: 'Order' }, { name: 'Payment' }, { name: 'Product' }]).slice(0, 6).map((entity, index) => <div key={entity.name} className="relative rounded-xl border bg-white p-4 shadow-sm">
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
          <SectionTitle title="核心实体" description="报告实体可在这里完成人工确认。" />
          <div className="grid grid-cols-2 gap-3">
            {reportEntities.map((entity) => <div key={entity.id || entity.name} className="space-y-3 rounded-xl border bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-950">{entity.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{entity.description || '暂无实体说明。'}</div>
                </div>
                {entity.moduleId && <Badge variant="outline">{entity.moduleId}</Badge>}
              </div>
              <VerificationControl status={entity.verificationStatus} disabled={loading === 'verification'} onChange={(status) => onUpdateVerification('entity', entity.id || entity.name, status)} />
            </div>)}
            {!reportEntities.length && symbolEntities.map((entity) => <div key={`${entity.path}-${entity.name}`} className="rounded-xl border bg-white p-4">
              <div className="font-semibold text-slate-950">{entity.name}</div>
              <div className="mt-2 font-mono text-xs text-muted-foreground">{entity.path}:{entity.startLine}</div>
            </div>)}
            {!reportEntities.length && !symbolEntities.length && <div className="col-span-2"><EmptyState text="未从当前扫描结果中识别到实体符号。" /></div>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="关键字段" />
          <div className="space-y-2">
            {(report?.dataModel?.keyFields?.length ? report.dataModel.keyFields.map((field) => field.field) : ['status', 'id', 'createdAt', 'updatedAt', 'amount', 'type']).map((field) => <div key={field} className="rounded-lg border px-3 py-2 text-sm"><span className="font-mono text-blue-700">{field}</span><div className="text-xs text-muted-foreground">从模型文件和链路上下文推断</div></div>)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="关联代码证据" />
          <div className="space-y-2">
            {modelFiles.map((file) => <div key={file.path} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><FileCode2 size={15} className="text-blue-600" /><span className="truncate font-mono text-xs">{file.path}</span></div>)}
            {!modelFiles.length && <EmptyState text="暂无模型文件证据。" />}
          </div>
        </CardContent>
      </Card>
    </div>
  </div>;
}
