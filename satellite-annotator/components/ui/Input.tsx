'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#e6edf3]">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-[#0d1117] border border-[#21262d] rounded-lg text-[#e6edf3] placeholder:text-[#8b949e] text-sm',
              'focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftIcon ? 'pl-10' : 'pl-4',
              rightIcon ? 'pr-10' : 'pr-4',
              'py-2.5',
              error && 'border-[#f85149] focus:border-[#f85149] focus:ring-[#f85149]',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e]">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-[#f85149]">{error}</p>}
        {hint && !error && <p className="text-xs text-[#8b949e]">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';


interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#e6edf3]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full bg-[#0d1117] border border-[#21262d] rounded-lg text-[#e6edf3] placeholder:text-[#8b949e] text-sm',
            'focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'px-4 py-2.5 resize-none',
            error && 'border-[#f85149] focus:border-[#f85149] focus:ring-[#f85149]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#f85149]">{error}</p>}
        {hint && !error && <p className="text-xs text-[#8b949e]">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
