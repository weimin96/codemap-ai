import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { VerificationStatus } from '@/types';

const OPTIONS: Array<{ value: VerificationStatus; label: string }> = [
  { value: 'pending', label: '待验证' },
  { value: 'verified', label: '已确认' },
  { value: 'rejected', label: '已驳回' },
  { value: 'stale', label: '已过期' }
];

export function VerificationControl({ status, disabled, onChange }: { status?: VerificationStatus; disabled?: boolean; onChange: (status: VerificationStatus) => void }) {
  const current = status || 'ai_guess';
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-slate-500">标记状态</span>
      <VerificationBadge status={current} />
    </div>
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => <Button key={option.value} type="button" size="sm" variant={current === option.value ? 'default' : 'outline'} disabled={disabled} onClick={() => onChange(option.value)}>{option.label}</Button>)}
    </div>
  </div>;
}

export function VerificationBadge({ status }: { status?: VerificationStatus }) {
  const current = status || 'ai_guess';
  const variant = current === 'verified' ? 'success' : current === 'rejected' ? 'destructive' : current === 'stale' ? 'secondary' : 'warning';
  return <Badge variant={variant}>{labelForStatus(current)}</Badge>;
}

function labelForStatus(status: VerificationStatus) {
  if (status === 'ai_guess') return '待验证';
  return OPTIONS.find((option) => option.value === status)?.label || status;
}
