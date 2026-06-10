'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#030712] disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:
      'bg-[#58a6ff] text-[#0d1117] hover:bg-[#79c0ff] active:scale-[0.98] focus:ring-[#58a6ff] shadow-[0_0_16px_rgba(88,166,255,0.25)] hover:shadow-[0_0_24px_rgba(88,166,255,0.4)]',
    secondary:
      'bg-[#21262d] text-[#e6edf3] hover:bg-[#30363d] active:scale-[0.98] focus:ring-[#58a6ff] border border-[#30363d]',
    ghost:
      'bg-transparent text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22] active:scale-[0.98] focus:ring-[#58a6ff]',
    danger:
      'bg-[#f85149] text-white hover:bg-[#ff7b72] active:scale-[0.98] focus:ring-[#f85149] shadow-[0_0_16px_rgba(248,81,73,0.25)]',
    outline:
      'bg-transparent text-[#58a6ff] border border-[#58a6ff] hover:bg-[rgba(88,166,255,0.1)] active:scale-[0.98] focus:ring-[#58a6ff]',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-6 py-3',
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="spinner" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
      {iconRight && !loading && <span className="flex-shrink-0">{iconRight}</span>}
    </button>
  );
}
