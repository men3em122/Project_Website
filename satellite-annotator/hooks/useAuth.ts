'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, setToken, removeToken } from '@/lib/api';
import { User } from '@/types';

interface AuthResponse {
  token: string;
  user: User;
}

interface MeResponse {
  user: User;
}

// ─── Query key ───────────────────────────────────────────────────────────────
export const authKeys = {
  me: ['currentUser'] as const,
};

// ─── Get current authenticated user ──────────────────────────────────────────
export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: authKeys.me,
    queryFn: async () => {
      try {
        const { data } = await api.get<MeResponse>('/auth/me');
        return data.user;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ─── Sign in ─────────────────────────────────────────────────────────────────
export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const { data } = await api.post<AuthResponse>('/auth/login', credentials);
      setToken(data.token);
      return data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}

// ─── Sign up ─────────────────────────────────────────────────────────────────
export function useSignUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
    }) => {
      const { data } = await api.post<AuthResponse>('/auth/register', payload);
      setToken(data.token);
      return data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
export function useSignOut() {
  const queryClient = useQueryClient();

  return () => {
    removeToken();
    queryClient.setQueryData(authKeys.me, null);
    queryClient.clear();
  };
}

// ─── Update profile ───────────────────────────────────────────────────────────
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { name: string }) => {
      const { data } = await api.put<MeResponse>('/auth/me', updates);
      return data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}

// ─── Change password ──────────────────────────────────────────────────────────
export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      const { data } = await api.put<{ message: string }>('/auth/change-password', payload);
      return data.message;
    },
  });
}
