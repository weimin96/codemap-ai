import { type ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ProgressStep {
  label: string;
  description: string;
  value: number;
  icon: ReactNode;
}

export function StepProgress({
  steps,
  active,
  className
}: {
  steps: ProgressStep[];
  active: boolean;
  className?: string;
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    }, 1800);
    return () => window.clearInterval(timer);
  }, [active, steps.length]);

  if (!active || !steps.length) return null;

  const current = steps[stepIndex] || steps[0];

  return <div className={cn('border-b bg-white px-6 py-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]', className)}>
    <div className="mb-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-950">{current.label}</div>
        <div className="mt-0.5 truncate text-xs text-slate-500">{current.description}</div>
      </div>
      <div className="text-xs font-semibold tabular-nums text-blue-700">{current.value}%</div>
    </div>
    <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
        style={{ width: `${current.value}%` }}
      />
      <div className="absolute inset-y-0 w-24 animate-[progress-shine_1.7s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/55 to-transparent" />
    </div>
    <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((step, index) => {
        const done = index < stepIndex;
        const activeStep = index === stepIndex;
        return <div key={step.label} className="relative min-w-0">
          {index > 0 && <div className={cn('absolute left-[-1.5rem] right-[calc(100%-0.75rem)] top-5 h-px', index <= stepIndex ? 'bg-blue-200' : 'bg-slate-200')} />}
          <div className={cn(
            'flex min-h-20 items-start gap-3 rounded-lg border px-3 py-2.5 transition-all duration-300',
            activeStep ? 'border-blue-200 bg-blue-50 shadow-sm' : done ? 'border-blue-100 bg-white' : 'border-slate-200 bg-slate-50'
          )}>
            <div className={cn(
              'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
              activeStep ? 'border-blue-600 bg-blue-600 text-white' : done ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-400'
            )}>
              {activeStep && <span className="absolute inset-0 animate-ping rounded-full bg-blue-400/30" />}
              <span className="relative">{step.icon}</span>
            </div>
            <div className="min-w-0">
              <div className={cn('truncate text-xs font-semibold', index <= stepIndex ? 'text-slate-950' : 'text-slate-500')}>{step.label}</div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{step.description}</div>
            </div>
          </div>
        </div>;
      })}
    </div>
  </div>;
}
