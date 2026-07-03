import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-blue-700',
        secondary: 'border border-border bg-card text-foreground shadow-sm hover:bg-slate-50',
        ghost: 'text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
        outline: 'border border-border bg-card text-foreground shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-red-600'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
