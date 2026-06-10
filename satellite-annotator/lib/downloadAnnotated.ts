'use client';

import { AnnotatedImage } from '@/types';
import { hexToRgba } from '@/lib/utils';

/**
 * Draws an AnnotatedImage (image + polygon overlays + labels) onto an
 * off-screen HTMLCanvasElement and returns the canvas.
 */
export async function renderAnnotatedCanvas(annotatedImage: AnnotatedImage): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not get canvas context'));

      // Draw base image
      ctx.drawImage(img, 0, 0);

      // Draw each annotation polygon
      for (const ann of annotatedImage.annotations) {
        const pts = ann.points;
        if (pts.length < 4) continue;

        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) {
          ctx.lineTo(pts[i], pts[i + 1]);
        }
        ctx.closePath();

        // Fill
        ctx.fillStyle = hexToRgba(ann.color, 0.25);
        ctx.fill();

        // Stroke
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = Math.max(2, img.naturalWidth / 600);
        ctx.stroke();

        // Label background + text
        const xs = pts.filter((_, i) => i % 2 === 0);
        const ys = pts.filter((_, i) => i % 2 === 1);
        const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
        const cy = ys.reduce((a, b) => a + b, 0) / ys.length;

        const fontSize = Math.max(12, img.naturalWidth / 80);
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        const textWidth = ctx.measureText(ann.label).width;
        const padding = fontSize * 0.4;
        const boxH = fontSize + padding * 2;
        const boxW = textWidth + padding * 2;

        // Badge bg
        ctx.fillStyle = ann.color;
        ctx.beginPath();
        ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 4);
        ctx.fill();

        // Badge text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ann.label, cx, cy);
      }

      resolve(canvas);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = annotatedImage.originalUrl;
  });
}

/**
 * Download a single annotated image as PNG.
 */
export async function downloadAnnotatedImage(annotatedImage: AnnotatedImage) {
  const canvas = await renderAnnotatedCanvas(annotatedImage);
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png')
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${annotatedImage.name.replace(/\.[^.]+$/, '')}_annotated.png`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download all annotated images in a category as a ZIP file.
 */
export async function downloadCategoryAsZip(
  categoryName: string,
  images: AnnotatedImage[],
  onProgress?: (done: number, total: number) => void
) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folder = zip.folder(categoryName) ?? zip;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      const canvas = await renderAnnotatedCanvas(img);
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png')
      );
      const arrayBuffer = await blob.arrayBuffer();
      const safeName = img.name.replace(/\.[^.]+$/, '') + '_annotated.png';
      folder.file(safeName, arrayBuffer);
    } catch {
      // skip failed images
    }
    onProgress?.(i + 1, images.length);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${categoryName}_annotated.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
