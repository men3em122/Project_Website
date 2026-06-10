import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'purple' | 'green' | 'yellow' | 'red' | 'muted';
  className?: string;
}

export function Badge({ children, variant = 'blue', className }: BadgeProps) {
  const variants = {
    blue: 'bg-[rgba(88,166,255,0.15)] text-[#58a6ff] border-[rgba(88,166,255,0.3)]',
    purple: 'bg-[rgba(188,140,255,0.15)] text-[#bc8cff] border-[rgba(188,140,255,0.3)]',
    green: 'bg-[rgba(63,185,80,0.15)] text-[#3fb950] border-[rgba(63,185,80,0.3)]',
    yellow: 'bg-[rgba(210,153,34,0.15)] text-[#d29922] border-[rgba(210,153,34,0.3)]',
    red: 'bg-[rgba(248,81,73,0.15)] text-[#f85149] border-[rgba(248,81,73,0.3)]',
    muted: 'bg-[rgba(139,148,158,0.15)] text-[#8b949e] border-[rgba(139,148,158,0.3)]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
