'use client';

import React from 'react';
import Link from 'next/link';
import { Trash2, Tag, ExternalLink, Image } from 'lucide-react';
import { ApiCategory } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useCategoryImages, useDeleteImage } from '@/hooks/useImages';
import { formatDate } from '@/lib/utils';

interface CategoryDetailModalProps {
  category: ApiCategory | null;
  onClose: () => void;
}

export function CategoryDetailModal({ category, onClose }: CategoryDetailModalProps) {
  const { data: images = [] } = useCategoryImages(category?.id);
  const deleteImage = useDeleteImage(category?.id ?? '');

  if (!category) return null;

  return (
    <Modal
      isOpen={!!category}
      onClose={onClose}
      title={category.name}
      size="lg"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        {category.description && (
          <p className="text-sm text-[#8b949e]">{category.description}</p>
        )}

        <div className="flex items-center gap-3 text-sm text-[#8b949e]">
          <span>{category.imageCount} image{category.imageCount !== 1 ? 's' : ''}</span>
          <span>•</span>
          <span>Created {formatDate(category.createdAt)}</span>
        </div>

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Image size={40} className="text-[#21262d] mb-3" />
            <p className="text-sm text-[#8b949e]">No images in this category yet</p>
            <p className="text-xs text-[#8b949e] mt-1">Annotate an image and save it here</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative rounded-xl overflow-hidden border border-[#21262d] bg-[#0d1117] hover:border-[rgba(88,166,255,0.4)] transition-all"
              >
                <Link href={`/dashboard/${category.id}/${img.id}`} onClick={onClose}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.thumbnail || img.originalUrl}
                    alt={img.name}
                    className="w-full h-28 object-cover cursor-pointer"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <span className="text-xs text-white font-medium flex items-center gap-1">
                      <ExternalLink size={12} /> Open image
                    </span>
                  </div>
                </Link>
                <div className="p-2">
                  <p className="text-xs font-medium text-[#e6edf3] truncate">{img.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Tag size={9} className="text-[#8b949e]" />
                    <p className="text-xs text-[#8b949e]">
                      {img.annotations.length} annotation{img.annotations.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Remove this image?')) {
                      deleteImage.mutate(img.id);
                    }
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/70 rounded-lg p-1 text-[#f85149] hover:bg-[#f85149] hover:text-white transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export type { CategoryDetailModalProps };
export { Badge };
