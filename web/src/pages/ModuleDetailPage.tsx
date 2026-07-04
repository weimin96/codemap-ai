import type { ReactNode } from 'react';
import { ArrowLeft, Boxes, FileCode2, GitBranch, Route, ShieldAlert } from 'lucide-react';
import { EmptyState, PriorityBadge, RiskBadge, SectionTitle } from '@/components/PageBlocks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VerificationControl } from '@/components/VerificationControl';
import type { CodeReference, ProjectModule, Report, VerificationStatus } from '@/types';

export function ModuleDetailPage({
  report,
  activeModuleId,
  loading,
  onBack,
  onOpenFile,
  onUpdateVerification
}: {
  report: Report | null;
  activeModuleId: string;
  loading: string;
  onBack: () => void;
  onOpenFile: (reference: CodeReference) => void;
  onUpdateVerification: (kind: 'module', id: string, status: VerificationStatus) => void;
}) {
  const module = findModule(report?.modules || [], activeModuleId);
  if (!module) return <EmptyState text="未选择模块。" />;

  const evidence = collectEvidence(module);
  const flows = (report?.flows || []).filter((flow) => module.coreFlows?.includes(flow.id || flow.name) || flow.steps.some((step) => module.paths.some((path) => step.path.includes(path))));
  const risks = (report?.risks || []).filter((risk) => risk.moduleId === module.id || module.risks?.includes(risk.id || risk.title) || module.paths.some((path) => risk.path?.includes(path)));

  return <div className="space-y-4">
    <Card className="border-blue-100 bg-white">
      <CardContent className="p-5">
        <Button variant="ghost" size="sm" className="mb-4 px-0 text-slate-600" onClick={onBack}><ArrowLeft size={16} />返回模块地图</Button>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <PriorityBadge priority={module.priority} />
              <Badge variant="outline">{module.confidence === 'fact' ? '确定事实' : module.confidence === 'guess' ? '合理推测' : '待验证'}</Badge>
            </div>
            <h1 className="text-2xl font-bold text-slate-950">{module.name}</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">{module.summary || module.responsibility || '暂无模块职责说明。'}</p>
          </div>
          <div className="w-[420px] space-y-4">
            <VerificationControl status={module.verificationStatus} disabled={loading === 'verification'} onChange={(status) => onUpdateVerification('module', module.id || module.name, status)} />
            <div className="grid grid-cols-2 gap-3">
              <Metric icon={<FileCode2 size={17} />} label="关键文件" value={evidence.length || module.paths.length} />
            <Metric icon={<Route size={17} />} label="相关链路" value={flows.length} />
            <Metric icon={<Boxes size={17} />} label="业务能力" value={module.businessCapabilities?.length || 0} />
              <Metric icon={<ShieldAlert size={17} />} label="风险" value={risks.length} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <div className="grid grid-cols-[1.25fr_1fr] gap-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="业务能力" description="模块对外或对内提供的核心能力。" />
          <div className="space-y-3">
            {module.businessCapabilities?.map((capability) => <div key={capability.name} className="rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-slate-950">{capability.name}</div>
                <Badge variant="secondary">{capability.importance}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{capability.description}</p>
            </div>)}
            {!module.businessCapabilities?.length && <EmptyState text="暂无业务能力拆分。" />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <SectionTitle title="入口与依赖" description="模块入口、关联实体和依赖模块。" />
          <div className="space-y-4">
            <InfoGroup title="入口/API" items={(module.entrypoints || []).map((entry) => entry.route || entry.path || entry.name)} />
            <InfoGroup title="数据实体" items={module.dataEntities || []} />
            <InfoGroup title="依赖模块" items={(module.dependencies || []).map((dependency) => dependency.moduleId)} />
          </div>
        </CardContent>
      </Card>
    </div>

    <div className="grid grid-cols-[1fr_1fr] gap-4">
      <Card>
        <CardContent className="p-5">
          <SectionTitle title="相关链路" description="该模块参与的核心业务剧本。" />
          <div className="space-y-3">
            {flows.map((flow) => <div key={flow.id || flow.name} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{flow.name}</div>
                  <div className="mt-1 text-sm text-slate-600">{flow.trigger}</div>
                </div>
                <PriorityBadge priority={flow.priority} />
              </div>
            </div>)}
            {!flows.length && <EmptyState text="暂无相关链路。" />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <SectionTitle title="风险点" description="与该模块直接关联的风险。" />
          <div className="space-y-3">
            {risks.map((risk) => <div key={risk.id || risk.title} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold text-slate-950">{risk.title}</div>
                <RiskBadge level={risk.level} />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{risk.reason}</p>
            </div>)}
            {!risks.length && <EmptyState text="暂无关联风险。" />}
          </div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardContent className="p-5">
        <SectionTitle title="代码证据" description="用于佐证模块职责、入口和链路判断的文件。" />
        <div className="grid grid-cols-2 gap-3">
          {evidence.map((reference) => <button key={`${reference.path}-${reference.symbol || ''}-${reference.startLine || ''}`} type="button" onClick={() => onOpenFile(reference)} className="rounded-xl border bg-white p-4 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><GitBranch size={17} /></div>
              <div className="min-w-0">
                <div className="truncate font-mono text-xs font-semibold text-slate-950">{reference.path}</div>
                <div className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{reference.reason}</div>
              </div>
            </div>
          </button>)}
        </div>
        {!evidence.length && <EmptyState text="暂无代码证据。" />}
      </CardContent>
    </Card>
  </div>;
}

function findModule(modules: ProjectModule[], activeModuleId: string) {
  return modules.find((module) => module.id === activeModuleId || module.name === activeModuleId) || modules[0];
}

function collectEvidence(module: ProjectModule): CodeReference[] {
  const evidence: CodeReference[] = [
    ...(module.keyFiles || []),
    ...toEvidenceArray(module.evidence),
    ...module.paths.map((path) => ({ path, reason: '模块路径候选', confidence: module.confidence }))
  ];
  const seen = new Set<string>();
  return evidence.filter((reference) => {
    if (!reference.path || seen.has(reference.path)) return false;
    seen.add(reference.path);
    return true;
  });
}

function toEvidenceArray(value: ProjectModule['evidence']) {
  if (Array.isArray(value)) return value;
  return [];
}

function InfoGroup({ title, items }: { title: string; items: string[] }) {
  return <div>
    <div className="mb-2 text-sm font-semibold text-slate-950">{title}</div>
    <div className="flex flex-wrap gap-2">
      {items.slice(0, 8).map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
      {!items.length && <span className="text-sm text-muted-foreground">暂无</span>}
    </div>
  </div>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return <div className="rounded-xl border bg-slate-50 p-3">
    <div className="flex items-center gap-2 text-xs text-slate-500">{icon}{label}</div>
    <div className="mt-2 text-lg font-bold text-slate-950">{value}</div>
  </div>;
}
