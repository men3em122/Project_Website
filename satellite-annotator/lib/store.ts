'use client';

import { create } from 'zustand';
import { Annotation } from '@/types';
import { ANNOTATION_COLORS } from '@/types';

interface SessionState {
  currentImageUrl: string | null;
  currentImageName: string | null;
  /** Cloudinary public_id of the current image (set on fresh uploads) */
  currentImagePublicId: string | null;
  setCurrentImage: (url: string | null, name: string | null, publicId?: string | null) => void;

  annotations: Annotation[];
  annotationColorIndex: number;
  addAnnotation: (ann: Omit<Annotation, 'id' | 'color'>) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  setAnnotations: (annotations: Annotation[]) => void;
}

export const useAppStore = create<SessionState>()((set, get) => ({
  currentImageUrl: null,
  currentImageName: null,
  currentImagePublicId: null,
  setCurrentImage: (url, name, publicId = null) =>
    set({ currentImageUrl: url, currentImageName: name, currentImagePublicId: publicId }),

  annotations: [],
  annotationColorIndex: 0,

  addAnnotation: (ann) => {
    const idx = get().annotationColorIndex;
    const annotation: Annotation = {
      ...ann,
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      color: ANNOTATION_COLORS[idx % ANNOTATION_COLORS.length],
    };
    set({
      annotations: [...get().annotations, annotation],
      annotationColorIndex: idx + 1,
    });
  },

  updateAnnotation: (id, updates) => {
    set({
      annotations: get().annotations.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    });
  },

  deleteAnnotation: (id) => {
    set({ annotations: get().annotations.filter((a) => a.id !== id) });
  },

  clearAnnotations: () => set({ annotations: [], annotationColorIndex: 0 }),

  setAnnotations: (annotations) =>
    set({ annotations, annotationColorIndex: annotations.length }),
}));
