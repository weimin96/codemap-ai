import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { VerificationStatus } from '@/types';

const OPTIONS: Array<{ value: VerificationStatus; label: string }> = [
  { value: 'ai_guess', label: 'AI 推测' },
  { value: 'pending', label: '待确认' },
  { value: 'verified', label: '已验证' },
  { value: 'rejected', label: '验证失败' },
  { value: 'stale', label: '已过期' }
];

export function VerificationControl({ status, disabled, onChange }: { status?: VerificationStatus; disabled?: boolean; onChange: (status: VerificationStatus) => void }) {
  const current = status || 'ai_guess';
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-slate-500">人工确认</span>
      <Badge variant={current === 'verified' ? 'default' : current === 'rejected' ? 'destructive' : 'outline'}>{labelForStatus(current)}</Badge>
    </div>
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => <Button key={option.value} type="button" size="sm" variant={current === option.value ? 'default' : 'outline'} disabled={disabled} onClick={() => onChange(option.value)}>{option.label}</Button>)}
    </div>
  </div>;
}

function labelForStatus(status: VerificationStatus) {
  return OPTIONS.find((option) => option.value === status)?.label || status;
}
