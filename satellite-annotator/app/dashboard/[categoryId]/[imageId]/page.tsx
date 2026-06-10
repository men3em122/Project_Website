'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ChevronLeft,
  Download,
  FolderOpen,
  Tag,
  Cpu,
  Pencil,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCategoryImages } from '@/hooks/useImages';
import { useCategories } from '@/hooks/useCategories';
import { downloadAnnotatedImage } from '@/lib/downloadAnnotated';
import { formatDate, formatConfidence } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Annotation } from '@/types';

const ReadOnlyCanvas = dynamic(
  () => import('@/components/annotation/ReadOnlyCanvas').then((m) => m.ReadOnlyCanvas),
  { ssr: false, loading: () => <CanvasLoading /> }
);

function CanvasLoading() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <p className="text-sm text-[#8b949e]">Loading image...</p>
      </div>
    </div>
  );
}

export default function ImageDetailPage() {
  return (
    <AuthGuard>
      <ImageDetailContent />
    </AuthGuard>
  );
}

function ImageDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { setCurrentImage, setAnnotations } = useAppStore();

  const categoryId = params.categoryId as string;
  const imageId = params.imageId as string;

  const { data: categories = [] } = useCategories();
  const { data: images = [], isLoading } = useCategoryImages(categoryId);

  const category = categories.find((c) => c.id === categoryId);
  const image = images.find((img) => img.id === imageId);

  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateSize = () => {
      if (canvasContainerRef.current) {
        setCanvasSize({
          width: canvasContainerRef.current.offsetWidth,
          height: canvasContainerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (canvasContainerRef.current) ro.observe(canvasContainerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleDownload = useCallback(async () => {
    if (!image) return;
    setDownloading(true);
    try {
      await downloadAnnotatedImage(image);
    } finally {
      setDownloading(false);
    }
  }, [image]);

  const imageIndex = images.findIndex((img) => img.id === imageId);
  const prevImage = imageIndex > 0 ? images[imageIndex - 1] : null;
  const nextImage = imageIndex < images.length - 1 ? images[imageIndex + 1] : null;

  if (!isLoading && !image) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center px-4">
        <div className="text-center">
          <Layers size={48} className="text-[#21262d] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#e6edf3] mb-2">Image not found</h2>
          <p className="text-[#8b949e] mb-6">This image may have been removed.</p>
          <Button onClick={() => router.push(`/dashboard/${categoryId}`)} icon={<ChevronLeft size={16} />}>
            Back to Category
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !image) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const autoCount = image.annotations.filter((a) => a.detectionMethod === 'auto').length;
  const manualCount = image.annotations.filter((a) => a.detectionMethod === 'manual').length;

  return (
    <div className="h-screen pt-16 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#21262d] bg-[rgba(13,17,23,0.95)] backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-[#8b949e] min-w-0">
            <Link href="/dashboard" className="hover:text-[#e6edf3] transition-colors hidden sm:inline">
              Dashboard
            </Link>
            <span className="hidden sm:inline">/</span>
            <Link
              href={`/dashboard/${categoryId}`}
              className="hover:text-[#e6edf3] transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={14} className="sm:hidden" />
              <FolderOpen size={13} className="hidden sm:inline" />
              <span className="truncate max-w-[100px] sm:max-w-[150px]">{category?.name ?? '...'}</span>
            </Link>
            <span>/</span>
            <span className="text-[#e6edf3] font-medium truncate max-w-[120px]">{image.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {prevImage && (
            <Link href={`/dashboard/${categoryId}/${prevImage.id}`}>
              <button className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22] transition-colors">
                <ChevronLeft size={18} />
              </button>
            </Link>
          )}
          <span className="text-xs text-[#8b949e] tabular-nums">
            {imageIndex + 1} / {images.length}
          </span>
          {nextImage && (
            <Link href={`/dashboard/${categoryId}/${nextImage.id}`}>
              <button className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22] transition-colors">
                <ChevronRight size={18} />
              </button>
            </Link>
          )}

          <div className="w-px h-5 bg-[#21262d] mx-1" />

          <Button
            variant="secondary"
            size="sm"
            icon={<Pencil size={14} />}
            onClick={() => {
              setCurrentImage(image.originalUrl, image.name);
              setAnnotations([...image.annotations]);
              router.push('/annotate');
            }}
          >
            <span className="hidden sm:inline">Re-annotate</span>
          </Button>

          <Button
            size="sm"
            icon={<Download size={14} />}
            loading={downloading}
            onClick={handleDownload}
          >
            <span className="hidden sm:inline">Download PNG</span>
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={canvasContainerRef} className="flex-1 bg-[#0a0e17] overflow-hidden relative">
          <ReadOnlyCanvas
            imageUrl={image.originalUrl}
            annotations={image.annotations}
            selectedId={selectedAnnotationId}
            onSelectAnnotation={setSelectedAnnotationId}
            containerWidth={canvasSize.width}
            containerHeight={canvasSize.height}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="glass-card rounded-xl px-4 py-2 border border-[rgba(88,166,255,0.15)]">
              <p className="text-xs text-[#8b949e]">
                Scroll to zoom · Drag to pan · Click annotation to inspect
              </p>
            </div>
          </div>
        </div>

        <div className="w-72 flex-shrink-0 border-l border-[#21262d] bg-[rgba(13,17,23,0.95)] backdrop-blur-sm flex flex-col overflow-hidden">
          <div className="px-4 py-4 border-b border-[#21262d] space-y-2">
            <h2 className="font-semibold text-[#e6edf3] text-sm truncate">{image.name}</h2>
            <p className="text-xs text-[#8b949e]">{formatDate(image.createdAt)}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {image.width > 0 && (
                <Badge variant="muted">{image.width} × {image.height}px</Badge>
              )}
              <Badge variant="blue">
                <Tag size={10} className="mr-1" />
                {image.annotations.length} annotations
              </Badge>
            </div>
            <div className="flex gap-2 pt-1">
              {autoCount > 0 && (
                <Badge variant="green"><Cpu size={10} className="mr-1" />{autoCount} auto</Badge>
              )}
              {manualCount > 0 && (
                <Badge variant="yellow"><Pencil size={10} className="mr-1" />{manualCount} manual</Badge>
              )}
            </div>
          </div>

          <div className="px-3 py-3 flex-1 overflow-y-auto">
            <p className="text-xs font-semibold text-[#8b949e] uppercase tracking-wide mb-3">
              Annotations
            </p>
            {image.annotations.length === 0 ? (
              <div className="text-center py-8">
                <Tag size={28} className="text-[#21262d] mx-auto mb-2" />
                <p className="text-xs text-[#8b949e]">No annotations</p>
              </div>
            ) : (
              <div className="space-y-2">
                {image.annotations.map((ann, idx) => (
                  <AnnotationRow
                    key={ann.id}
                    annotation={ann}
                    index={idx + 1}
                    isSelected={selectedAnnotationId === ann.id}
                    onClick={() =>
                      setSelectedAnnotationId(selectedAnnotationId === ann.id ? null : ann.id)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-[#21262d]">
            <Button size="sm" className="w-full" icon={<Download size={14} />} loading={downloading} onClick={handleDownload}>
              {downloading ? 'Rendering...' : 'Download Annotated PNG'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnnotationRow({
  annotation, index, isSelected, onClick,
}: {
  annotation: Annotation;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        isSelected
          ? 'border-[rgba(88,166,255,0.4)] bg-[rgba(88,166,255,0.06)]'
          : 'border-[#21262d] bg-[#0d1117] hover:border-[#30363d]'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: annotation.color, boxShadow: `0 0 6px ${annotation.color}70` }}
        />
        <span className="text-sm font-semibold text-[#e6edf3] flex-1 truncate">{annotation.label}</span>
        <span className="text-xs text-[#8b949e]">#{index}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge variant={annotation.detectionMethod === 'auto' ? 'green' : 'yellow'}>
          {annotation.detectionMethod === 'auto' ? (
            <><Cpu size={9} className="mr-1" />Auto</>
          ) : (
            <><Pencil size={9} className="mr-1" />Manual</>
          )}
        </Badge>
        {annotation.confidence && (
          <Badge variant="blue">{formatConfidence(annotation.confidence)}</Badge>
        )}
      </div>
    </button>
  );
}
