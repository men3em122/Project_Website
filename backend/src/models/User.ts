import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db } from '../config/db';

export interface IUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface IUserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  created_at: string;
}

export const UserModel = {
  findByEmail(email: string): IUserRow | null {
    return (
      (db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as IUserRow | undefined) ?? null
    );
  },

  findById(id: string): IUserRow | null {
    return (
      (db.prepare('SELECT * FROM users WHERE id = ?').get(id) as IUserRow | undefined) ?? null
    );
  },

  async create(name: string, email: string, password: string): Promise<IUser> {
    const id = randomUUID();
    const hash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    db.prepare('INSERT INTO users (id, name, email, password, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, name.trim(), email.toLowerCase(), hash, now);
    return { id, name: name.trim(), email: email.toLowerCase(), createdAt: now };
  },

  updateName(id: string, name: string): IUser | null {
    const row = this.findById(id);
    if (!row) return null;
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), id);
    return { id, name: name.trim(), email: row.email, createdAt: row.created_at };
  },

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, id);
  },

  comparePassword(hash: string, candidate: string): Promise<boolean> {
    return bcrypt.compare(candidate, hash);
  },

  toPublic(row: IUserRow): IUser {
    return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
  },
};
