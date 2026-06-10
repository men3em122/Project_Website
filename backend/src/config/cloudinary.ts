import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { AppError } from '../middleware/AppError';

// The SDK automatically reads CLOUDINARY_URL from process.env.
// We just enable secure (https) URLs globally.
cloudinary.config({ secure: true });

export { cloudinary };

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Formats browsers cannot render natively — converted to JPEG before upload
// so the stored Cloudinary asset is displayable everywhere (annotation canvas,
// thumbnails, re-annotation) and the AI service uses the exact same URL.
const NON_DISPLAYABLE_MIMETYPES = ['image/tiff', 'image/tif', 'image/bmp'];

// Cloudinary free plan rejects files larger than 10 MB, so anything bigger
// must be recompressed before upload.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Cap the longest side — plenty for on-screen annotation, and the AI models
// downsample to ~1024px anyway.
const MAX_DIMENSION = 4096;

/**
 * Convert TIFF/BMP to JPEG and shrink anything over Cloudinary's 10 MB limit.
 * Returns the original buffer untouched when no conversion is needed.
 */
async function normalizeImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const needsConversion =
    NON_DISPLAYABLE_MIMETYPES.includes(mimeType.toLowerCase()) ||
    buffer.length > MAX_UPLOAD_BYTES;

  if (!needsConversion) return { buffer, mimeType };

  try {
    let quality = 85;
    let out = await sharp(buffer)
      .rotate() // respect EXIF orientation
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();

    // Lower quality stepwise until it fits under the Cloudinary limit
    while (out.length > MAX_UPLOAD_BYTES && quality > 40) {
      quality -= 15;
      out = await sharp(buffer)
        .rotate()
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer();
    }

    return { buffer: out, mimeType: 'image/jpeg' };
  } catch {
    throw new AppError(
      'Could not process this image file. It may be corrupted or use an unsupported encoding.',
      400
    );
  }
}

/**
 * Upload a file buffer to Cloudinary and return the result.
 */
export async function uploadBuffer(
  buffer: Buffer,
  mimeType: string,
  folder = 'satellite-annotator'
): Promise<{ url: string; publicId: string; width: number; height: number }> {
  const normalized = await normalizeImage(buffer, mimeType);
  const dataUri = `data:${normalized.mimeType};base64,${normalized.buffer.toString('base64')}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'image',
    timeout: 120000,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
}

/**
 * Derive a Cloudinary thumbnail URL from an existing upload URL.
 * Inserts the c_fill,w_320,h_240 transformation into the URL path.
 *
 * e.g.
 *   https://res.cloudinary.com/cloud/image/upload/v123/folder/img.jpg
 * → https://res.cloudinary.com/cloud/image/upload/c_fill,w_320,h_240/v123/folder/img.jpg
 */
export function thumbnailUrl(originalUrl: string): string {
  return originalUrl.replace('/image/upload/', '/image/upload/c_fill,w_320,h_240/');
}

/**
 * Delete a Cloudinary asset by its public_id (best-effort, non-throwing).
 */
export async function deleteAsset(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId).catch((err) => {
    console.warn('Cloudinary delete failed for', publicId, err);
  });
}
