'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ApiCategory } from '@/types';

interface CategoriesResponse {
  categories: ApiCategory[];
}

interface CategoryResponse {
  category: ApiCategory;
}

export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
};

// ─── List all categories ──────────────────────────────────────────────────────
export function useCategories() {
  return useQuery<ApiCategory[]>({
    queryKey: categoryKeys.list(),
    queryFn: async () => {
      const { data } = await api.get<CategoriesResponse>('/categories');
      return data.categories;
    },
    staleTime: 30 * 1000,
  });
}

// ─── Create category ──────────────────────────────────────────────────────────
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const { data } = await api.post<CategoryResponse>('/categories', payload);
      return data.category;
    },
    onSuccess: (newCat) => {
      queryClient.setQueryData<ApiCategory[]>(categoryKeys.list(), (old = []) => [newCat, ...old]);
    },
  });
}

// ─── Update category ──────────────────────────────────────────────────────────
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string }) => {
      const { data } = await api.put<CategoryResponse>(`/categories/${id}`, updates);
      return data.category;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<ApiCategory[]>(categoryKeys.list(), (old = []) =>
        old.map((c) => (c.id === updated.id ? updated : c))
      );
    },
  });
}

// ─── Delete category ──────────────────────────────────────────────────────────
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<ApiCategory[]>(categoryKeys.list(), (old = []) =>
        old.filter((c) => c.id !== deletedId)
      );
    },
  });
}
