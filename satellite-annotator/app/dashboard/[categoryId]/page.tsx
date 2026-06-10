'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Tag,
  Trash2,
  ArchiveIcon,
  Loader2,
  FileDown,
} from 'lucide-react';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCategories } from '@/hooks/useCategories';
import { useCategoryImages, useDeleteImage } from '@/hooks/useImages';
import { downloadCategoryAsZip } from '@/lib/downloadAnnotated';
import { exportYoloDataset } from '@/lib/exportYolo';
import { formatDate } from '@/lib/utils';
import { AnnotatedImage } from '@/types';

export default function CategoryPage() {
  return (
    <AuthGuard>
      <CategoryContent />
    </AuthGuard>
  );
}

function CategoryContent() {
  const params = useParams();
  const router = useRouter();
  const categoryId = params.categoryId as string;

  const { data: categories = [] } = useCategories();
  const { data: images = [], isLoading: imagesLoading } = useCategoryImages(categoryId);
  const deleteImage = useDeleteImage(categoryId);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [yoloProgress, setYoloProgress] = useState<{ done: number; total: number } | null>(null);

  const category = categories.find((c) => c.id === categoryId);

  if (!imagesLoading && !category) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center px-4">
        <div className="text-center">
          <FolderOpen size={48} className="text-[#21262d] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#e6edf3] mb-2">Category not found</h2>
          <p className="text-[#8b949e] mb-6">This category may have been deleted.</p>
          <Button onClick={() => router.push('/dashboard')} icon={<ChevronLeft size={16} />}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const totalAnnotations = images.reduce((acc, img) => acc + img.annotations.length, 0);

  const handleDownloadAll = async () => {
    if (images.length === 0) return;
    setZipProgress({ done: 0, total: images.length });
    await downloadCategoryAsZip(category!.name, images, (done, total) => {
      setZipProgress({ done, total });
    });
    setZipProgress(null);
  };

  // Export every image in this category as one YOLOv8 segmentation dataset
  // (dataset/images + dataset/labels + classes.txt + data.yaml in a ZIP)
  const handleExportYolo = async () => {
    if (images.length === 0 || !category) return;
    setYoloProgress({ done: 0, total: images.length });
    try {
      await exportYoloDataset(
        category.name,
        images.map((img) => ({
          name: img.name,
          imageUrl: img.originalUrl,
          width: img.width,
          height: img.height,
          annotations: img.annotations.map((a) => ({ label: a.label, points: a.points })),
        })),
        (done, total) => setYoloProgress({ done, total })
      );
    } catch {
      alert('YOLO export failed. Please try again.');
    } finally {
      setYoloProgress(null);
    }
  };

  const handleDeleteImage = (img: AnnotatedImage) => {
    if (confirm(`Remove "${img.name}" from this category?`)) {
      deleteImage.mutate(img.id);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#8b949e] mb-6 mt-4">
          <Link href="/dashboard" className="hover:text-[#e6edf3] transition-colors flex items-center gap-1">
            <ChevronLeft size={14} />
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-[#e6edf3] font-medium">{category?.name ?? '...'}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: `${category?.color ?? '#58a6ff'}18`,
                border: `1.5px solid ${category?.color ?? '#58a6ff'}40`,
              }}
            >
              <FolderOpen size={22} style={{ color: category?.color ?? '#58a6ff' }} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#e6edf3]">{category?.name ?? '...'}</h1>
              {category?.description && (
                <p className="text-[#8b949e] text-sm mt-0.5">{category.description}</p>
              )}
            </div>
          </div>

          {images.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="secondary"
                icon={yoloProgress ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
                onClick={handleExportYolo}
                disabled={!!yoloProgress || !!zipProgress}
              >
                {yoloProgress
                  ? `Exporting ${yoloProgress.done}/${yoloProgress.total}...`
                  : 'Export YOLO Dataset'}
              </Button>
              <Button
                variant="secondary"
                icon={zipProgress ? <Loader2 size={15} className="animate-spin" /> : <ArchiveIcon size={15} />}
                onClick={handleDownloadAll}
                disabled={!!zipProgress || !!yoloProgress}
              >
                {zipProgress ? `Zipping ${zipProgress.done}/${zipProgress.total}...` : 'Download All'}
              </Button>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 mb-8">
          {[
            { label: `${images.length} image${images.length !== 1 ? 's' : ''}`, icon: <ImageIcon size={13} />, variant: 'blue' as const },
            { label: `${totalAnnotations} annotation${totalAnnotations !== 1 ? 's' : ''}`, icon: <Tag size={13} />, variant: 'purple' as const },
            { label: category ? `Created ${formatDate(category.createdAt)}` : '', icon: null, variant: 'muted' as const },
          ].filter(s => s.label).map((s) => (
            <Badge key={s.label} variant={s.variant} className="gap-1.5 px-3 py-1 text-xs">
              {s.icon}
              {s.label}
            </Badge>
          ))}
        </div>

        {/* ZIP progress bar */}
        {zipProgress && (
          <div className="mb-6 p-4 glass-card rounded-2xl border border-[rgba(88,166,255,0.2)]">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[#e6edf3] font-medium">Generating annotated images…</span>
              <span className="text-[#58a6ff]">{zipProgress.done} / {zipProgress.total}</span>
            </div>
            <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#58a6ff] rounded-full transition-all duration-300"
                style={{ width: `${(zipProgress.done / zipProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Image grid */}
        {imagesLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-3xl bg-[rgba(88,166,255,0.06)] border border-[rgba(88,166,255,0.12)] flex items-center justify-center mb-4">
              <ImageIcon size={36} className="text-[#21262d]" />
            </div>
            <h3 className="text-lg font-semibold text-[#e6edf3] mb-2">No images yet</h3>
            <p className="text-sm text-[#8b949e] max-w-xs mb-6">
              Annotate a satellite image and save it to this category.
            </p>
            <Button onClick={() => router.push('/annotate')} icon={<ImageIcon size={15} />}>
              Start Annotating
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {images.map((img) => (
              <div
                key={img.id}
                className="group glass-card rounded-2xl overflow-hidden border border-[#21262d] hover:border-[rgba(88,166,255,0.35)] transition-all cursor-pointer"
              >
                <Link href={`/dashboard/${categoryId}/${img.id}`}>
                  <div className="relative h-44 bg-[#0d1117] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.thumbnail || img.originalUrl}
                      alt={img.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-xs text-[#e6edf3] font-medium">
                        <Tag size={10} />
                        {img.annotations.length}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <span className="text-xs text-white font-semibold flex items-center gap-1.5">
                        <ImageIcon size={12} />
                        View annotated image
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#e6edf3] truncate">{img.name}</p>
                      <p className="text-xs text-[#8b949e] mt-0.5">{formatDate(img.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/dashboard/${categoryId}/${img.id}`}>
                        <button className="p-1.5 rounded-lg text-[#58a6ff] hover:bg-[rgba(88,166,255,0.1)] transition-colors">
                          <Download size={14} />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDeleteImage(img)}
                        className="p-1.5 rounded-lg text-[#f85149] hover:bg-[rgba(248,81,73,0.1)] transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {img.annotations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {img.annotations.slice(0, 3).map((ann) => (
                        <span
                          key={ann.id}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            background: `${ann.color}18`,
                            color: ann.color,
                            border: `1px solid ${ann.color}35`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ann.color }} />
                          {ann.label}
                        </span>
                      ))}
                      {img.annotations.length > 3 && (
                        <span className="text-[10px] text-[#8b949e] px-1.5 py-0.5">
                          +{img.annotations.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
