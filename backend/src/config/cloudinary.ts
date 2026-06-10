import { v2 as cloudinary } from 'cloudinary';

// The SDK automatically reads CLOUDINARY_URL from process.env.
// We just enable secure (https) URLs globally.
cloudinary.config({ secure: true });

export { cloudinary };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Upload a file buffer to Cloudinary and return the result.
 */
export async function uploadBuffer(
  buffer: Buffer,
  mimeType: string,
  folder = 'satellite-annotator'
): Promise<{ url: string; publicId: string }> {
  const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'image',
  });

  return { url: result.secure_url, publicId: result.public_id };
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
