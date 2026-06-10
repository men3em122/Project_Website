'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, Satellite, User } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useSignUp } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/errors';

const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export function SignUpForm() {
  const router = useRouter();
  const signUp = useSignUp();
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
      await signUp.mutateAsync({
        name: data.name,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
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
        <h1 className="text-2xl font-bold text-[#e6edf3]">Create an account</h1>
        <p className="text-[#8b949e] text-sm mt-1">Start annotating satellite imagery</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          placeholder="Alex Chen"
          autoComplete="name"
          leftIcon={<User size={16} />}
          error={errors.name?.message}
          {...register('name')}
        />

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
          autoComplete="new-password"
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
          hint="Minimum 6 characters"
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Confirm Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          autoComplete="new-password"
          leftIcon={<Lock size={16} />}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
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
          loading={isSubmitting || signUp.isPending}
        >
          {isSubmitting || signUp.isPending ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>

      <p className="text-center text-sm text-[#8b949e] mt-6">
        Already have an account?{' '}
        <Link href="/auth/signin" className="text-[#58a6ff] hover:text-[#79c0ff] font-medium transition-colors">
          Sign In
        </Link>
      </p>
    </div>
  );
}
