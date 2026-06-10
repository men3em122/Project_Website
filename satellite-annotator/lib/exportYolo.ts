'use client';

/**
 * YOLO Segmentation dataset export
 * ================================
 * Produces a ZIP compatible with YOLOv8/YOLO11 segmentation training:
 *
 *   dataset/
 *    ├── images/
 *    │    └── <image_name>.jpg     original uploaded image (no overlays)
 *    ├── labels/
 *    │    └── <image_name>.txt     one line per object:
 *    │                             class_id x1 y1 x2 y2 x3 y3 ...
 *    ├── classes.txt               one class name per line (line index = id)
 *    └── data.yaml                 ready-to-use YOLOv8 dataset config
 *
 * MASK → POLYGON CONVERSION
 * -------------------------
 * The SAM2 binary masks are converted to polygon contours **in the AI
 * service** at click time (cv2.findContours → approxPolyDP → flat
 * [x1, y1, x2, y2, ...] list in image pixel coordinates). Those polygons are
 * what gets stored on every annotation, so the export only has to validate
 * and normalize them — no raster mask handling is needed here.
 */

import { Annotation } from '@/types';

// ─── Tunables ─────────────────────────────────────────────────────────────────

/** Polygons with fewer vertices than this cannot form an area — skipped. */
const MIN_POLYGON_POINTS = 3;

/**
 * Polygons whose pixel area is below this are degenerate masks (a few stray
 * pixels from SAM) and would only add label noise to training — skipped.
 */
const MIN_POLYGON_AREA_PX = 20;

/** Decimal places for normalized coordinates (YOLO convention). */
const COORD_PRECISION = 6;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YoloExportItem {
  /** Display name of the image; used (sanitized) as the file base name */
  name: string;
  /** Cloudinary URL of the ORIGINAL image (no annotation overlays) */
  imageUrl: string;
  /** Pixel size the annotation coordinates refer to (0 = resolve from image) */
  width: number;
  height: number;
  annotations: Pick<Annotation, 'label' | 'points'>[];
}

export interface YoloExportResult {
  /** label → class id mapping used in the export */
  classMap: Record<string, number>;
  imagesExported: number;
  objectsExported: number;
  objectsSkipped: number;
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/**
 * CONTOUR EXTRACTION / VALIDATION
 * Polygon area via the shoelace formula on a flat [x1,y1,x2,y2,...] list.
 * Used to drop masks that are too small or have invalid (self-degenerate)
 * contours — a zero/near-zero area means the points are collinear or
 * collapsed onto each other.
 */
function polygonAreaPx(points: number[]): number {
  let area = 0;
  const n = points.length / 2;
  for (let i = 0; i < n; i++) {
    const x1 = points[i * 2];
    const y1 = points[i * 2 + 1];
    const x2 = points[((i + 1) % n) * 2];
    const y2 = points[((i + 1) % n) * 2 + 1];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

/**
 * COORDINATE NORMALIZATION
 * YOLO segmentation expects every vertex normalized to [0, 1]:
 *     x_norm = x_px / image_width
 *     y_norm = y_px / image_height
 * Values are clamped because SAM contours can touch / slightly exceed the
 * image border after polygon approximation.
 * Returns null when the polygon fails validation (too few points/too small).
 */
function toYoloLine(
  classId: number,
  points: number[],
  width: number,
  height: number
): string | null {
  if (points.length < MIN_POLYGON_POINTS * 2) return null;
  if (polygonAreaPx(points) < MIN_POLYGON_AREA_PX) return null;

  const coords: string[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const xNorm = Math.min(1, Math.max(0, points[i] / width));
    const yNorm = Math.min(1, Math.max(0, points[i + 1] / height));
    coords.push(xNorm.toFixed(COORD_PRECISION), yNorm.toFixed(COORD_PRECISION));
  }
  return `${classId} ${coords.join(' ')}`;
}

// ─── Image helpers ────────────────────────────────────────────────────────────

/** Strip the extension and any filesystem-unsafe characters from a name. */
function sanitizeBaseName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_\-]+/g, '_');
  return base || 'image';
}

/**
 * Fetch the original image as a JPEG blob.
 * For Cloudinary URLs we inject the `f_jpg` transformation so Cloudinary
 * delivers JPEG bytes directly (no client-side re-encode, full quality
 * control stays server-side). Any other source falls back to a canvas
 * re-encode so the file extension in the dataset is always truthful.
 */
async function fetchAsJpeg(url: string): Promise<Blob> {
  const jpgUrl = url.includes('/image/upload/')
    ? url.replace('/image/upload/', '/image/upload/f_jpg/')
    : url;

  const resp = await fetch(jpgUrl, { mode: 'cors' });
  if (!resp.ok) throw new Error(`Failed to fetch image (${resp.status})`);
  const blob = await resp.blob();
  if (blob.type === 'image/jpeg') return blob;

  // Non-Cloudinary or non-JPEG response: re-encode through a canvas
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('JPEG encoding failed'))),
      'image/jpeg',
      0.95
    )
  );
}

/** Resolve true pixel dimensions when the stored width/height are missing. */
async function resolveImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image for size resolution'));
    img.src = url;
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build the YOLO segmentation dataset and download it as a ZIP.
 *
 * ZIP GENERATION
 * --------------
 * Uses JSZip (lazy-imported to keep it out of the main bundle). Every image
 * is fetched from Cloudinary, written to dataset/images/, and its label file
 * to dataset/labels/ with the SAME base name — the pairing convention YOLOv8
 * relies on. classes.txt and data.yaml are generated from the union of all
 * labels found, with stable (alphabetical) class ids so repeated exports of
 * the same data always produce identical ids.
 */
export async function exportYoloDataset(
  datasetName: string,
  items: YoloExportItem[],
  onProgress?: (done: number, total: number) => void
): Promise<YoloExportResult> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const root = zip.folder('dataset')!;
  const imagesDir = root.folder('images')!;
  const labelsDir = root.folder('labels')!;

  // CLASS MAP — collect every distinct label across all images, sorted
  // alphabetically so class ids are deterministic across exports.
  const labels = Array.from(
    new Set(items.flatMap((it) => it.annotations.map((a) => a.label.trim())).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const classMap: Record<string, number> = Object.fromEntries(labels.map((l, i) => [l, i]));

  const usedNames = new Set<string>();
  let imagesExported = 0;
  let objectsExported = 0;
  let objectsSkipped = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      // Unique base name shared by the image and its label file
      let base = sanitizeBaseName(item.name);
      let suffix = 1;
      while (usedNames.has(base)) base = `${sanitizeBaseName(item.name)}-${suffix++}`;
      usedNames.add(base);

      // 1. Original image (no overlays) → dataset/images/<base>.jpg
      const imageBlob = await fetchAsJpeg(item.imageUrl);
      imagesDir.file(`${base}.jpg`, await imageBlob.arrayBuffer());

      // 2. Labels → dataset/labels/<base>.txt (one line per valid object)
      let { width, height } = item;
      if (!width || !height) ({ width, height } = await resolveImageSize(item.imageUrl));

      const lines: string[] = [];
      for (const ann of item.annotations) {
        const classId = classMap[ann.label.trim()];
        if (classId === undefined) continue;
        const line = toYoloLine(classId, ann.points, width, height);
        if (line) {
          lines.push(line);
          objectsExported++;
        } else {
          objectsSkipped++; // mask too small / degenerate contour
        }
      }
      labelsDir.file(`${base}.txt`, lines.join('\n') + (lines.length ? '\n' : ''));
      imagesExported++;
    } catch {
      // Skip images that fail to download — keep the rest of the dataset valid
    }
    onProgress?.(i + 1, items.length);
  }

  // 3. classes.txt — one class per line; the line index IS the class id
  //    (standard labelImg/YOLO convention, i.e. line 0 = class 0)
  root.file('classes.txt', labels.join('\n') + (labels.length ? '\n' : ''));

  // 4. data.yaml — drop-in config for `yolo segment train data=data.yaml`
  const yamlNames = labels.map((l, i) => `  ${i}: ${l}`).join('\n');
  root.file(
    'data.yaml',
    `# YOLOv8 segmentation dataset generated by OrbitAnnotate\n` +
      `path: .\ntrain: images\nval: images\n\nnames:\n${yamlNames}\n`
  );

  // 5. Generate the ZIP in-memory and trigger a browser download
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeBaseName(datasetName)}_yolo_dataset.zip`;
  a.click();
  URL.revokeObjectURL(url);

  return { classMap, imagesExported, objectsExported, objectsSkipped };
}
