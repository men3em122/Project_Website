'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  Layers,
  ChevronLeft,
  ImagePlus,
  FileDown,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { AnnotationPanel } from '@/components/annotation/AnnotationPanel';
import { DetectionPanel } from '@/components/annotation/DetectionPanel';
import { SaveAnnotationModal } from '@/components/annotation/SaveAnnotationModal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAppStore } from '@/lib/store';
import { prepareImage, segmentAtPoint, toDetectionResult } from '@/lib/ai';
import { exportYoloDataset } from '@/lib/exportYolo';
import { uploadImage } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/errors';
import { useAddImage } from '@/hooks/useImages';
import { DetectionResult } from '@/types';
import type { CanvasControls } from '@/components/annotation/AnnotationCanvas';

// Dynamically import canvas to avoid SSR issues with Konva
const AnnotationCanvas = dynamic(
  () => import('@/components/annotation/AnnotationCanvas').then((m) => m.AnnotationCanvas),
  { ssr: false, loading: () => <CanvasLoading /> }
);

// SegFormer classes that don't represent an identifiable object — when the AI
// returns one of these, the user is asked to label the region manually.
const NON_OBJECT_LABELS = ['Background', 'Unlabeled', 'Unknown'];

function CanvasLoading() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <p className="text-sm text-[#8b949e]">Loading canvas...</p>
      </div>
    </div>
  );
}

export default function AnnotatePage() {
  return (
    <AuthGuard>
      <AnnotateContent />
    </AuthGuard>
  );
}

function AnnotateContent() {
  const router = useRouter();
  const {
    currentImageUrl,
    currentImageName,
    currentImagePublicId,
    setCurrentImage,
    annotations,
    addAnnotation,
    deleteAnnotation,
    clearAnnotations,
  } = useAppStore();
  const addImage = useAddImage();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDetectionPanel, setShowDetectionPanel] = useState(false);
  const [detectionLoading, setDetectionLoading] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [detectionFailed, setDetectionFailed] = useState(false);
  const [pendingSegmentation, setPendingSegmentation] = useState<number[] | null>(null);
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number } | null>(null);
  const [pendingImageSize, setPendingImageSize] = useState<{ width: number; height: number } | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasControlsRef = useRef<CanvasControls | null>(null);

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

  // Resolve true image dimensions whenever the URL changes (file upload OR re-annotate).
  // This ensures segmentation / detection always receives accurate width & height.
  useEffect(() => {
    if (!currentImageUrl) {
      setImageDimensions({ width: 0, height: 0 });
      return;
    }
    const img = new Image();
    img.onload = () =>
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = currentImageUrl;
  }, [currentImageUrl]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsUploading(true);
    setUploadError('');

    try {
      // 1. Upload to Cloudinary via the backend — the frontend only keeps the URL
      const uploaded = await uploadImage(file);
      setCurrentImage(uploaded.url, file.name, uploaded.publicId);
      clearAnnotations();
      setSelectedAnnotationId(null);
      setIsUploading(false);

      // 2. Warm up the AI service with the Cloudinary URL: it downloads the
      //    image, embeds it in SAM2 and caches YOLO/SegFormer outputs so the
      //    first click is fast. Annotation + detection only happen on click.
      setIsAutoDetecting(true);
      const prepared = await prepareImage(uploaded.url);
      setImageDimensions({ width: prepared.width, height: prepared.height });
    } catch (err: unknown) {
      const message = getApiErrorMessage(err);
      setUploadError(message || 'Upload or AI analysis failed. Please try again.');
    } finally {
      setIsUploading(false);
      setIsAutoDetecting(false);
    }
  }, [setCurrentImage, clearAnnotations]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleCanvasClick = useCallback(async (x: number, y: number) => {
    if (isProcessing || !currentImageUrl) return;
    setIsProcessing(true);
    setShowDetectionPanel(true);
    setDetectionLoading(true);
    setDetectionResult(null);
    setDetectionFailed(false);
    setPendingClick({ x, y });

    try {
      // One round trip to the AI service: SAM2 segments at the clicked point,
      // YOLO/SegFormer classify the region (same pipeline as the notebook).
      const seg = await segmentAtPoint(currentImageUrl, x, y);

      setPendingSegmentation(seg.points);
      setPendingImageSize({ width: imageDimensions.width || 800, height: imageDimensions.height || 600 });

      // "Background"-type classes mean the AI couldn't identify a real object,
      // so ask the user to label the segmented region manually instead.
      if (NON_OBJECT_LABELS.includes(seg.label)) {
        setDetectionFailed(true);
      } else {
        setDetectionResult(toDetectionResult(seg));
        setDetectionFailed(false);
      }
    } catch {
      setDetectionFailed(true);
    } finally {
      setDetectionLoading(false);
      setIsProcessing(false);
    }
  }, [isProcessing, currentImageUrl, imageDimensions]);

  const handleConfirmAnnotation = useCallback((label: string, confidence?: number) => {
    if (!pendingSegmentation) return;

    addAnnotation({
      points: pendingSegmentation,
      label,
      confidence,
      detectionMethod: confidence !== undefined ? 'auto' : 'manual',
      boundingBox: undefined,
    });

    setPendingSegmentation(null);
    setPendingClick(null);
    setShowDetectionPanel(false);
    setDetectionResult(null);
  }, [pendingSegmentation, addAnnotation]);

  const handleCancelDetection = useCallback(() => {
    setPendingSegmentation(null);
    setPendingClick(null);
    setShowDetectionPanel(false);
    setDetectionResult(null);
    setDetectionFailed(false);
    setIsProcessing(false);
  }, []);

  // Export the current image + annotations as a YOLOv8 segmentation dataset
  // ZIP (dataset/images, dataset/labels, classes.txt, data.yaml).
  const handleExportYolo = useCallback(async () => {
    if (!currentImageUrl || !currentImageName || annotations.length === 0) return;
    setIsExporting(true);
    try {
      await exportYoloDataset(currentImageName, [
        {
          name: currentImageName,
          imageUrl: currentImageUrl,
          width: imageDimensions.width,
          height: imageDimensions.height,
          annotations: annotations.map((a) => ({ label: a.label, points: a.points })),
        },
      ]);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [currentImageUrl, currentImageName, annotations, imageDimensions]);

  const handleSaveToCategory = useCallback(async (categoryId: string) => {
    if (!currentImageUrl || !currentImageName) return;
    setIsSaving(true);
    setSaveError('');
    try {
      // The image already lives on Cloudinary (uploaded on selection),
      // so saving only sends the URL + annotations — never the file again.
      await addImage.mutateAsync({
        categoryId,
        name: currentImageName,
        existingImageUrl: currentImageUrl,
        imagePublicId: currentImagePublicId,
        width: imageDimensions.width,
        height: imageDimensions.height,
        annotations: [...annotations],
      });

      setShowSaveModal(false);
      clearAnnotations();
      setCurrentImage(null, null);
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = getApiErrorMessage(err);
      if (message) setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }, [currentImageUrl, currentImageName, currentImagePublicId, annotations, imageDimensions, addImage, clearAnnotations, setCurrentImage, router]);

  return (
    <div className="h-screen pt-16 flex flex-col overflow-hidden">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#21262d] bg-[rgba(13,17,23,0.95)] backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          <div className="w-px h-5 bg-[#21262d]" />
          {currentImageName && (
            <span className="text-sm text-[#e6edf3] font-medium truncate max-w-[200px]">
              {currentImageName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="blue">
            <Layers size={11} className="mr-1" />
            {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
          </Badge>

          {annotations.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 size={14} />}
                onClick={() => {
                  if (confirm('Clear all annotations?')) clearAnnotations();
                }}
              >
                <span className="hidden sm:inline">Clear</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<FileDown size={14} />}
                onClick={handleExportYolo}
                disabled={isExporting}
              >
                <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
              </Button>
              <Button
                size="sm"
                icon={<Save size={14} />}
                onClick={() => setShowSaveModal(true)}
              >
                <span className="hidden sm:inline">Save</span>
              </Button>
            </>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={<Upload size={14} />}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="hidden sm:inline">Upload</span>
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div
          className="flex-1 relative bg-[#0a0e17] overflow-hidden"
          ref={canvasContainerRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {currentImageUrl ? (
            <>
              <AnnotationCanvas
                imageUrl={currentImageUrl}
                annotations={annotations}
                selectedId={selectedAnnotationId}
                isProcessing={isProcessing}
                onCanvasClick={handleCanvasClick}
                onSelectAnnotation={setSelectedAnnotationId}
                containerWidth={canvasSize.width}
                containerHeight={canvasSize.height}
                controlsRef={canvasControlsRef}
              />

              {/* Auto-detection banner */}
              {isAutoDetecting && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="glass-card rounded-xl px-4 py-2.5 border border-[rgba(88,166,255,0.3)] flex items-center gap-2.5">
                    <div className="spinner" style={{ width: 14, height: 14 }} />
                    <p className="text-xs text-[#e6edf3]">
                      Preparing AI model (SAM2 + YOLO)... click any object when ready
                    </p>
                  </div>
                </div>
              )}

              {/* Canvas hints */}
              {annotations.length === 0 && !isProcessing && !isAutoDetecting && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="glass-card rounded-xl px-4 py-2.5 border border-[rgba(88,166,255,0.2)] text-center">
                    <p className="text-xs text-[#8b949e]">
                      Click on any object to segment and annotate • Scroll to zoom • Drag to pan
                    </p>
                  </div>
                </div>
              )}

              {/* Zoom controls (up to 800%) */}
              <div className="absolute top-3 right-3 flex flex-col gap-1">
                <button
                  title="Zoom in"
                  onClick={() => canvasControlsRef.current?.zoomIn()}
                  className="w-8 h-8 glass-card rounded-lg flex items-center justify-center text-[#8b949e] hover:text-[#e6edf3] border border-[#21262d] transition-colors"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  title="Zoom out"
                  onClick={() => canvasControlsRef.current?.zoomOut()}
                  className="w-8 h-8 glass-card rounded-lg flex items-center justify-center text-[#8b949e] hover:text-[#e6edf3] border border-[#21262d] transition-colors"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  title="Reset view"
                  onClick={() => canvasControlsRef.current?.resetView()}
                  className="w-8 h-8 glass-card rounded-lg flex items-center justify-center text-[#8b949e] hover:text-[#e6edf3] border border-[#21262d] transition-colors"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            </>
          ) : (
            /* Upload drop zone */
            <div className="flex items-center justify-center h-full">
              {isUploading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="spinner" style={{ width: 36, height: 36 }} />
                  <p className="text-sm font-medium text-[#e6edf3]">Uploading image...</p>
                </div>
              ) : (
                <div
                  className="upload-zone rounded-3xl p-16 flex flex-col items-center text-center cursor-pointer max-w-md mx-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-20 h-20 rounded-3xl bg-[rgba(88,166,255,0.08)] border border-[rgba(88,166,255,0.2)] flex items-center justify-center mb-6">
                    <ImagePlus size={36} className="text-[#58a6ff]" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#e6edf3] mb-2">
                    Upload Satellite Image
                  </h3>
                  <p className="text-sm text-[#8b949e] mb-6 leading-relaxed">
                    Drag & drop or click to upload a satellite image.
                    It is hosted on Cloudinary, then SAM2 + YOLO + SegFormer
                    annotate and detect objects automatically.
                  </p>
                  <Button icon={<Upload size={16} />}>Choose Image</Button>
                  <p className="text-xs text-[#8b949e] mt-4">
                    Maximum file size: 50MB
                  </p>
                  {uploadError && (
                    <p className="text-xs text-[#f85149] mt-3">{uploadError}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-72 flex-shrink-0 border-l border-[#21262d] bg-[rgba(13,17,23,0.95)] backdrop-blur-sm flex flex-col overflow-hidden">
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-[#21262d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-[#58a6ff]" />
              <span className="text-sm font-semibold text-[#e6edf3]">Annotations</span>
            </div>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-[#8b949e] hover:text-[#e6edf3] transition-colors p-1 rounded-lg hover:bg-[#21262d]"
            >
              <Info size={14} />
            </button>
          </div>

          {/* Help hint */}
          {showHelp && (
            <div className="px-4 py-3 bg-[rgba(88,166,255,0.05)] border-b border-[rgba(88,166,255,0.1)]">
              <ul className="text-xs text-[#8b949e] space-y-1.5 list-disc list-inside">
                <li>Click image to segment an object</li>
                <li>SAM2 generates a polygon mask</li>
                <li>YOLO + Segformer detect the label</li>
                <li>Confirm or enter label manually</li>
                <li>Scroll to zoom, drag to pan</li>
                <li>Click annotation to select/deselect</li>
              </ul>
            </div>
          )}

          {/* Annotation list */}
          <div className="flex-1 overflow-y-auto p-3">
            <AnnotationPanel
              annotations={annotations}
              selectedId={selectedAnnotationId}
              onSelect={setSelectedAnnotationId}
              onDelete={deleteAnnotation}
            />
          </div>

          {/* Sidebar footer */}
          {currentImageUrl && annotations.length > 0 && (
            <div className="p-3 border-t border-[#21262d]">
              <Button
                size="sm"
                className="w-full"
                icon={<Save size={14} />}
                onClick={() => setShowSaveModal(true)}
              >
                Save to Category
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = '';
        }}
      />

      {/* Detection panel */}
      <DetectionPanel
        isVisible={showDetectionPanel}
        isLoading={detectionLoading}
        detectionResult={detectionResult}
        detectionFailed={detectionFailed}
        onConfirm={handleConfirmAnnotation}
        onCancel={handleCancelDetection}
      />

      {/* Save modal */}
      <SaveAnnotationModal
        isOpen={showSaveModal}
        onClose={() => { setShowSaveModal(false); setSaveError(''); }}
        onSave={handleSaveToCategory}
        imageName={currentImageName || 'Untitled'}
        isSaving={isSaving}
        saveError={saveError}
      />
    </div>
  );
}
