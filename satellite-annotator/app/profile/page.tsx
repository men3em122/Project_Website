'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getApiErrorMessage } from '@/lib/errors';
import {
  User,
  Mail,
  Shield,
  Save,
  Tag,
  Layers,
  FolderOpen,
  Calendar,
  Check,
  LogOut,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useCurrentUser, useSignOut, useUpdateProfile, useChangePassword } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import { formatDate } from '@/lib/utils';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}

function ProfileContent() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const signOut = useSignOut();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const { data: categories = [] } = useCategories();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const totalImages = categories.reduce((acc, c) => acc + c.imageCount, 0);
  const totalAnnotations = categories.reduce((acc, c) => acc + c.annotationCount, 0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name ?? '' },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async (data: ProfileForm) => {
    setSaveError('');
    try {
      await updateProfile.mutateAsync({ name: data.name });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      const message = getApiErrorMessage(err);
      if (message) setSaveError(message);
    }
  };

  const onPasswordSubmit = async (data: PasswordForm) => {
    setPasswordError('');
    try {
      await changePassword.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      resetPasswordForm();
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err: unknown) {
      const message = getApiErrorMessage(err);
      if (message) setPasswordError(message);
    }
  };

  const handleSignOut = () => {
    signOut();
    router.push('/');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto mt-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#58a6ff] to-[#bc8cff] flex items-center justify-center text-2xl font-bold text-white shadow-lg">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#e6edf3] capitalize">{user.name}</h1>
            <p className="text-sm text-[#8b949e]">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — stats */}
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-5 border border-[#21262d]">
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-4 flex items-center gap-2">
                <Layers size={15} className="text-[#58a6ff]" />
                Activity Stats
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Categories', value: categories.length, icon: <FolderOpen size={14} className="text-[#58a6ff]" /> },
                  { label: 'Images', value: totalImages, icon: <Layers size={14} className="text-[#bc8cff]" /> },
                  { label: 'Total Annotations', value: totalAnnotations, icon: <Tag size={14} className="text-[#3fb950]" /> },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-[#8b949e]">
                      {s.icon}
                      {s.label}
                    </div>
                    <span className="text-sm font-semibold text-[#e6edf3]">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-[#21262d]">
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-4 flex items-center gap-2">
                <Calendar size={15} className="text-[#bc8cff]" />
                Account Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#8b949e]">Member since</span>
                  <span className="text-[#e6edf3]">{formatDate(user.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8b949e]">Account type</span>
                  <Badge variant="blue">Free</Badge>
                </div>
              </div>
            </div>

            <Button
              variant="danger"
              size="sm"
              className="w-full"
              icon={<LogOut size={14} />}
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          </div>

          {/* Right column — edit form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-2xl p-6 border border-[#21262d]">
              <h3 className="text-base font-semibold text-[#e6edf3] mb-5 flex items-center gap-2">
                <User size={16} className="text-[#58a6ff]" />
                Edit Profile
              </h3>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Full Name"
                  placeholder="Your name"
                  leftIcon={<User size={15} />}
                  error={errors.name?.message}
                  {...register('name')}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={user.email}
                  leftIcon={<Mail size={15} />}
                  hint="Email cannot be changed"
                  disabled
                  readOnly
                />

                {saveError && (
                  <div className="flex items-center gap-2 text-sm text-[#f85149] p-3 rounded-lg bg-[rgba(248,81,73,0.08)] border border-[rgba(248,81,73,0.2)]">
                    {saveError}
                  </div>
                )}

                {saved && (
                  <div className="flex items-center gap-2 text-sm text-[#3fb950] p-3 rounded-lg bg-[rgba(63,185,80,0.08)] border border-[rgba(63,185,80,0.2)]">
                    <Check size={15} />
                    Profile updated successfully!
                  </div>
                )}

                <Button
                  type="submit"
                  loading={isSubmitting || updateProfile.isPending}
                  icon={saved ? <Check size={15} /> : <Save size={15} />}
                  className="w-full"
                >
                  {isSubmitting || updateProfile.isPending ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                </Button>
              </form>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-[#21262d]">
              <h3 className="text-base font-semibold text-[#e6edf3] mb-5 flex items-center gap-2">
                <Shield size={16} className="text-[#58a6ff]" />
                Change Password
              </h3>
              <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-4">
                <Input
                  label="Current Password"
                  type={showPasswords ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  leftIcon={<Lock size={15} />}
                  error={passwordErrors.currentPassword?.message}
                  {...registerPassword('currentPassword')}
                />
                <Input
                  label="New Password"
                  type={showPasswords ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  leftIcon={<Lock size={15} />}
                  hint="Minimum 6 characters"
                  error={passwordErrors.newPassword?.message}
                  {...registerPassword('newPassword')}
                />
                <Input
                  label="Confirm New Password"
                  type={showPasswords ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  leftIcon={<Lock size={15} />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="text-[#8b949e] hover:text-[#e6edf3] transition-colors"
                    >
                      {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                  error={passwordErrors.confirmPassword?.message}
                  {...registerPassword('confirmPassword')}
                />

                {passwordError && (
                  <div className="flex items-center gap-2 text-sm text-[#f85149] p-3 rounded-lg bg-[rgba(248,81,73,0.08)] border border-[rgba(248,81,73,0.2)]">
                    {passwordError}
                  </div>
                )}

                {passwordSaved && (
                  <div className="flex items-center gap-2 text-sm text-[#3fb950] p-3 rounded-lg bg-[rgba(63,185,80,0.08)] border border-[rgba(63,185,80,0.2)]">
                    <Check size={15} />
                    Password changed successfully!
                  </div>
                )}

                <Button
                  type="submit"
                  loading={isPasswordSubmitting || changePassword.isPending}
                  icon={passwordSaved ? <Check size={15} /> : <Shield size={15} />}
                  className="w-full"
                >
                  {isPasswordSubmitting || changePassword.isPending
                    ? 'Updating...'
                    : passwordSaved
                      ? 'Updated!'
                      : 'Change Password'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
