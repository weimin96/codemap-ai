import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, CircleHelp, Sparkles, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Confidence, Priority } from '@/types';

export function PageHero({ icon, title, description, aside }: { icon: ReactNode; title: string; description: string; aside?: ReactNode }) {
  return <Card className="mb-4">
    <CardContent className="flex items-center justify-between gap-8 p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">{icon}</div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </CardContent>
  </Card>;
}

export function StatCard({ icon, label, value, hint, tone = 'blue' }: { icon: ReactNode; label: string; value: string | number; hint?: string; tone?: 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'purple' }) {
  return <Card>
    <CardContent className="flex items-center gap-4 p-4">
      <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', toneClass(tone))}>{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold text-slate-950">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </CardContent>
  </Card>;
}

export function SectionTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-3 flex items-center justify-between gap-4">
    <div>
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
    {action}
  </div>;
}

export function ConfidenceBadge({ confidence }: { confidence?: Confidence }) {
  if (confidence === 'fact') return <Badge variant="success">确定事实</Badge>;
  if (confidence === 'guess') return <Badge variant="warning">合理推测</Badge>;
  return <Badge variant="outline">待验证</Badge>;
}

export function PriorityBadge({ priority }: { priority?: Priority }) {
  if (priority === 'P0') return <Badge>P0</Badge>;
  if (priority === 'P1') return <Badge variant="secondary">P1</Badge>;
  return <Badge variant="outline">{priority || 'P2'}</Badge>;
}

export function RiskBadge({ level }: { level?: 'high' | 'medium' | 'low' }) {
  if (level === 'high') return <Badge variant="destructive">高风险</Badge>;
  if (level === 'medium') return <Badge variant="warning">中风险</Badge>;
  return <Badge variant="success">低风险</Badge>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed bg-slate-50 p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

export function LinkButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return <Button variant="ghost" size="sm" onClick={onClick} className="h-auto px-0 text-blue-700 hover:bg-transparent hover:underline">{children}<ArrowRight size={14} /></Button>;
}

export function ReliabilityLegend() {
  return <div className="flex items-center gap-5 text-sm text-slate-600">
    <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" />确定事实</span>
    <span className="flex items-center gap-2"><Sparkles size={14} className="text-amber-500" />合理推测</span>
    <span className="flex items-center gap-2"><CircleHelp size={14} className="text-slate-400" />待验证</span>
  </div>;
}

export function RiskHint({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><TriangleAlert size={15} className="mr-2 inline" />{children}</div>;
}

function toneClass(tone: 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'purple') {
  const classes = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
    purple: 'bg-violet-50 text-violet-700'
  };
  return classes[tone];
}
