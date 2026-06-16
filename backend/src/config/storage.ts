import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { AppError } from '../middleware/AppError';

const NON_DISPLAYABLE_MIMETYPES = ['image/tiff', 'image/tif', 'image/bmp'];
const MAX_DIMENSION = 4096;
const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 240;

export function uploadsDir(): string {
  const dir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function serverBase(): string {
  const port = process.env.PORT ?? '5000';
  return process.env.SERVER_URL ?? `http://localhost:${port}`;
}

async function normalizeBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; ext: string }> {
  const needsConvert = NON_DISPLAYABLE_MIMETYPES.includes(mimeType.toLowerCase());

  if (!needsConvert) {
    const meta = await sharp(buffer).metadata();
    if ((meta.width ?? 0) <= MAX_DIMENSION && (meta.height ?? 0) <= MAX_DIMENSION) {
      const ext =
        mimeType === 'image/png'  ? 'png'  :
        mimeType === 'image/webp' ? 'webp' :
        mimeType === 'image/gif'  ? 'gif'  : 'jpg';
      return { buffer, ext };
    }
  }

  try {
    const out = await sharp(buffer)
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { buffer: out, ext: 'jpg' };
  } catch {
    throw new AppError(
      'Could not process this image file. It may be corrupted or use an unsupported encoding.',
      400
    );
  }
}

export async function saveImageLocally(
  buffer: Buffer,
  mimeType: string
): Promise<{ url: string; thumbnail: string; localPath: string; width: number; height: number }> {
  const { buffer: normalized, ext } = await normalizeBuffer(buffer, mimeType);
  const dir = uploadsDir();
  const id = randomUUID();
  const filename = `${id}.${ext}`;
  const thumbFilename = `thumb_${id}.${ext}`;
  const filePath = path.join(dir, filename);
  const thumbPath = path.join(dir, thumbFilename);

  fs.writeFileSync(filePath, normalized);

  const meta = await sharp(normalized).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  await sharp(normalized)
    .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toFile(thumbPath);

  const base = serverBase();
  return {
    url: `${base}/uploads/${filename}`,
    thumbnail: `${base}/uploads/${thumbFilename}`,
    localPath: filePath,
    width,
    height,
  };
}

/**
 * Derive the local thumbnail URL from an original image URL.
 * e.g. http://localhost:5000/uploads/abc.jpg → http://localhost:5000/uploads/thumb_abc.jpg
 */
export function deriveThumbnailUrl(imageUrl: string): string {
  const parts = imageUrl.split('/uploads/');
  if (parts.length < 2) return imageUrl;
  return `${parts[0]}/uploads/thumb_${parts[1]}`;
}

/**
 * Derive the local filesystem path from an image URL.
 * e.g. http://localhost:5000/uploads/abc.jpg → /backend/uploads/abc.jpg
 */
export function urlToLocalPath(imageUrl: string): string {
  const filename = imageUrl.split('/uploads/').pop();
  if (!filename) return '';
  return path.join(uploadsDir(), filename);
}

export function deleteLocalImage(localPath: string | undefined | null): void {
  if (!localPath) return;
  try {
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    const dir = path.dirname(localPath);
    const base = path.basename(localPath);
    const thumbPath = path.join(dir, `thumb_${base}`);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  } catch (err) {
    console.warn('Could not delete local image:', localPath, err);
  }
}
