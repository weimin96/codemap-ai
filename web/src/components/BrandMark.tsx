import { cn } from '@/lib/utils';

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <div className={cn('flex shrink-0 items-center gap-3', className)} aria-label="CodeAtlas">
    <img src="/brand/codeatlas-logo.svg" alt="" className="h-10 w-10 rounded-xl shadow-sm" />
    {!compact && <img src="/brand/codeatlas-wordmark.svg" alt="CODEATLAS" className="hidden h-9 w-[248px] rounded-lg object-contain sm:block" />}
  </div>;
}
