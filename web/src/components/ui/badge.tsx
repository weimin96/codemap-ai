import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors', {
  variants: {
    variant: {
      default: 'border-blue-100 bg-blue-50 text-blue-700',
      secondary: 'border-slate-200 bg-slate-100 text-slate-600',
      outline: 'border-slate-200 bg-white text-slate-600',
      destructive: 'border-red-100 bg-red-50 text-red-600',
      warning: 'border-amber-100 bg-amber-50 text-amber-700',
      success: 'border-emerald-100 bg-emerald-50 text-emerald-700'
    }
  },
  defaultVariants: { variant: 'default' }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
