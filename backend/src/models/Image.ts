import { randomUUID } from 'crypto';
import { db } from '../config/db';

interface Annotation {
  id: string;
  points: number[];
  label: string;
  color: string;
  confidence?: number;
  detectionMethod: 'auto' | 'manual';
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface IImage {
  id: string;
  categoryId: string;
  userId: string;
  name: string;
  originalUrl: string;
  thumbnail: string;
  localPath?: string;
  width: number;
  height: number;
  annotations: Annotation[];
  createdAt: string;
}

interface ImageRow {
  id: string;
  category_id: string;
  user_id: string;
  name: string;
  original_url: string;
  thumbnail: string;
  local_path: string | null;
  width: number;
  height: number;
  annotations: string;
  created_at: string;
}

function toImage(row: ImageRow): IImage {
  return {
    id: row.id,
    categoryId: row.category_id,
    userId: row.user_id,
    name: row.name,
    originalUrl: row.original_url,
    thumbnail: row.thumbnail,
    localPath: row.local_path ?? undefined,
    width: row.width,
    height: row.height,
    annotations: JSON.parse(row.annotations) as Annotation[],
    createdAt: row.created_at,
  };
}

export const ImageModel = {
  findByCategory(categoryId: string): IImage[] {
    const rows = db
      .prepare('SELECT * FROM images WHERE category_id = ? ORDER BY created_at DESC')
      .all(categoryId) as unknown as ImageRow[];
    return rows.map(toImage);
  },

  findByUser(userId: string): IImage[] {
    const rows = db
      .prepare('SELECT * FROM images WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown as ImageRow[];
    return rows.map(toImage);
  },

  findByIdAndUser(id: string, userId: string): IImage | null {
    const row = db
      .prepare('SELECT * FROM images WHERE id = ? AND user_id = ?')
      .get(id, userId) as ImageRow | undefined;
    return row ? toImage(row) : null;
  },

  findByCategoryForStats(categoryId: string): Pick<IImage, 'thumbnail' | 'annotations'>[] {
    const rows = db
      .prepare('SELECT thumbnail, annotations FROM images WHERE category_id = ?')
      .all(categoryId) as unknown as Pick<ImageRow, 'thumbnail' | 'annotations'>[];
    return rows.map((r) => ({
      thumbnail: r.thumbnail,
      annotations: JSON.parse(r.annotations) as Annotation[],
    }));
  },

  create(data: {
    categoryId: string;
    userId: string;
    name: string;
    originalUrl: string;
    thumbnail: string;
    localPath?: string;
    width: number;
    height: number;
    annotations: unknown[];
  }): IImage {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO images
         (id, category_id, user_id, name, original_url, thumbnail, local_path, width, height, annotations, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.categoryId,
        data.userId,
        data.name.trim(),
        data.originalUrl,
        data.thumbnail,
        data.localPath ?? null,
        data.width,
        data.height,
        JSON.stringify(data.annotations),
        now
      );
    return {
      id,
      categoryId: data.categoryId,
      userId: data.userId,
      name: data.name.trim(),
      originalUrl: data.originalUrl,
      thumbnail: data.thumbnail,
      localPath: data.localPath,
      width: data.width,
      height: data.height,
      annotations: data.annotations as Annotation[],
      createdAt: now,
    };
  },

  delete(id: string, userId: string): IImage | null {
    const row = db
      .prepare('SELECT * FROM images WHERE id = ? AND user_id = ?')
      .get(id, userId) as ImageRow | undefined;
    if (!row) return null;
    db.prepare('DELETE FROM images WHERE id = ?').run(id);
    return toImage(row);
  },

  deleteByCategory(categoryId: string): void {
    db.prepare('DELETE FROM images WHERE category_id = ?').run(categoryId);
  },

  computeStats(userId: string): { accuracy: number; autoAnnotationCount: number } {
    const rows = db
      .prepare('SELECT annotations FROM images WHERE user_id = ?')
      .all(userId) as unknown as Pick<ImageRow, 'annotations'>[];

    let totalConfidence = 0;
    let autoAnnotationCount = 0;

    for (const row of rows) {
      const annotations = JSON.parse(row.annotations) as Annotation[];
      for (const ann of annotations) {
        if (ann.detectionMethod === 'auto' && ann.confidence != null) {
          totalConfidence += ann.confidence;
          autoAnnotationCount++;
        }
      }
    }

    const accuracy =
      autoAnnotationCount > 0
        ? Math.round((totalConfidence / autoAnnotationCount) * 100) / 100
        : 0;

    return { accuracy, autoAnnotationCount };
  },
};
