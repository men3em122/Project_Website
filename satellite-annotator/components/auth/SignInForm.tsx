'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, Satellite } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useSignIn } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/errors';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

export function SignInForm() {
  const router = useRouter();
  const signIn = useSignIn();
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setAuthError('');
    try {
      await signIn.mutateAsync({ email: data.email, password: data.password });
      router.replace('/dashboard');
    } catch (err: unknown) {
      const message = getApiErrorMessage(err);
      if (message) setAuthError(message);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-[rgba(88,166,255,0.1)] border border-[rgba(88,166,255,0.3)] flex items-center justify-center mb-4 glow-blue">
          <Satellite size={28} className="text-[#58a6ff]" />
        </div>
        <h1 className="text-2xl font-bold text-[#e6edf3]">Welcome back</h1>
        <p className="text-[#8b949e] text-sm mt-1">Sign in to your OrbitAnnotate account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          leftIcon={<Mail size={16} />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete="current-password"
          leftIcon={<Lock size={16} />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[#8b949e] hover:text-[#e6edf3] transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
          error={errors.password?.message}
          {...register('password')}
        />

        {authError && (
          <div className="p-3 rounded-lg bg-[rgba(248,81,73,0.1)] border border-[rgba(248,81,73,0.3)] text-sm text-[#f85149]">
            {authError}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full mt-2"
          loading={isSubmitting || signIn.isPending}
        >
          {isSubmitting || signIn.isPending ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <p className="text-center text-sm text-[#8b949e] mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" className="text-[#58a6ff] hover:text-[#79c0ff] font-medium transition-colors">
          Sign Up
        </Link>
      </p>
    </div>
  );
}
