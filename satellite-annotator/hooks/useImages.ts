'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AnnotatedImage } from '@/types';
import { categoryKeys } from './useCategories';

export interface AccuracyResponse {
  accuracy: number;
  autoAnnotationCount: number;
}

export const statsKeys = {
  accuracy: ['stats', 'accuracy'] as const,
};

export function useAccuracy() {
  return useQuery<AccuracyResponse>({
    queryKey: statsKeys.accuracy,
    queryFn: async () => {
      const { data } = await api.get<AccuracyResponse>('/stats/accuracy');
      return data;
    },
    staleTime: 60 * 1000,
  });
}

interface ImagesResponse {
  images: AnnotatedImage[];
}

interface ImageResponse {
  image: AnnotatedImage;
}

export const imageKeys = {
  byCategory: (categoryId: string) => ['images', categoryId] as const,
  single: (imageId: string) => ['image', imageId] as const,
};

// ─── Images for a category ────────────────────────────────────────────────────
export function useCategoryImages(categoryId: string | undefined) {
  return useQuery<AnnotatedImage[]>({
    queryKey: imageKeys.byCategory(categoryId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<ImagesResponse>(`/categories/${categoryId}/images`);
      return data.images;
    },
    enabled: !!categoryId,
    staleTime: 30 * 1000,
  });
}

// ─── Single image ─────────────────────────────────────────────────────────────
export function useImage(imageId: string | undefined) {
  return useQuery<AnnotatedImage | null>({
    queryKey: imageKeys.single(imageId ?? ''),
    queryFn: async () => {
      const { data } = await api.get<ImageResponse>(`/images/${imageId}`);
      return data.image;
    },
    enabled: !!imageId,
    staleTime: 60 * 1000,
  });
}

// ─── Save annotated image to a category ───────────────────────────────────────
// Sends multipart/form-data:
//   image     – Blob  (for freshly uploaded images from the user's device)
//   imageUrl  – string (for re-annotated images already hosted on Cloudinary)
export function useAddImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      categoryId: string;
      name: string;
      /** Cloudinary URL — images are always uploaded to Cloudinary on selection */
      existingImageUrl: string;
      /** Cloudinary public_id (when known) so the backend can delete the asset later */
      imagePublicId?: string | null;
      width: number;
      height: number;
      annotations: AnnotatedImage['annotations'];
    }) => {
      const { categoryId, name, existingImageUrl, imagePublicId, width, height, annotations } = payload;

      const formData = new FormData();
      formData.append('imageUrl', existingImageUrl);
      if (imagePublicId) {
        formData.append('imagePublicId', imagePublicId);
      }

      formData.append('name', name);
      formData.append('width', String(width));
      formData.append('height', String(height));
      formData.append('annotations', JSON.stringify(annotations));

      const { data } = await api.post<ImageResponse>(
        `/categories/${categoryId}/images`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      return { image: data.image, categoryId };
    },
    onSuccess: ({ categoryId }) => {
      // Invalidate the image list for this category so the category page always
      // fetches the full list from the server on next mount (instead of showing
      // only the newly added image from a stale setQueryData cache)
      queryClient.invalidateQueries({ queryKey: imageKeys.byCategory(categoryId) });
      // Refresh category cards (imageCount, annotationCount, thumbnails)
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}

// ─── Delete an image ──────────────────────────────────────────────────────────
export function useDeleteImage(categoryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (imageId: string) => {
      await api.delete(`/images/${imageId}`);
      return imageId;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<AnnotatedImage[]>(imageKeys.byCategory(categoryId), (old = []) =>
        old.filter((img) => img.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: statsKeys.accuracy });
    },
  });
}
