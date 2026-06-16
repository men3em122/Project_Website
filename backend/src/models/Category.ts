import { randomUUID } from 'crypto';
import { db } from '../config/db';

export interface ICategory {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
}

interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
}

function toCategory(row: CategoryRow): ICategory {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color,
    createdAt: row.created_at,
  };
}

export const CategoryModel = {
  findByUser(userId: string): ICategory[] {
    const rows = db
      .prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown as CategoryRow[];
    return rows.map(toCategory);
  },

  findByIdAndUser(id: string, userId: string): ICategory | null {
    const row = db
      .prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?')
      .get(id, userId) as CategoryRow | undefined;
    return row ? toCategory(row) : null;
  },

  countByUser(userId: string): number {
    const result = db
      .prepare('SELECT COUNT(*) as count FROM categories WHERE user_id = ?')
      .get(userId) as { count: number };
    return result.count;
  },

  create(
    userId: string,
    name: string,
    description: string | undefined,
    color: string
  ): ICategory {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
        'INSERT INTO categories (id, user_id, name, description, color, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, userId, name.trim(), description?.trim() ?? null, color, now);
    return {
      id,
      userId,
      name: name.trim(),
      description: description?.trim() || undefined,
      color,
      createdAt: now,
    };
  },

  update(
    id: string,
    userId: string,
    name?: string,
    description?: string
  ): ICategory | null {
    const existing = this.findByIdAndUser(id, userId);
    if (!existing) return null;
    const newName = name?.trim() ?? existing.name;
    const newDesc =
      description !== undefined
        ? description.trim() || null
        : (existing.description ?? null);
    db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ? AND user_id = ?')
      .run(newName, newDesc, id, userId);
    return { ...existing, name: newName, description: newDesc ?? undefined };
  },

  delete(id: string, userId: string): boolean {
    const result = db
      .prepare('DELETE FROM categories WHERE id = ? AND user_id = ?')
      .run(id, userId);
    return result.changes > 0;
  },
};
