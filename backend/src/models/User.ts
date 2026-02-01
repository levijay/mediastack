import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { hashPassword } from '../utils/auth';

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'approver' | 'user';
  is_active: number;
  request_limit_movies: number;
  request_limit_tv: number;
  api_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserDTO {
  username: string;
  email: string;
  password: string;
  role?: 'admin' | 'approver' | 'user';
}

export class UserModel {
  static async create(data: CreateUserDTO): Promise<User> {
    const id = uuidv4();
    const password_hash = await hashPassword(data.password);
    const role = data.role || 'user';

    const stmt = db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, data.username, data.email, password_hash, role);

    return this.findById(id)!;
  }

  static findById(id: string): User | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  }

  static findByUsername(username: string): User | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) as User | undefined;
  }

  static findByEmail(email: string): User | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | undefined;
  }

  static findByApiKey(apiKey: string): User | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE api_key = ?');
    return stmt.get(apiKey) as User | undefined;
  }

  static findAll(): User[] {
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    return stmt.all() as User[];
  }

  static update(id: string, data: Partial<User>): User | undefined {
    const fields = Object.keys(data)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');

    const values = Object.keys(data)
      .filter(key => key !== 'id')
      .map(key => (data as any)[key]);

    const stmt = db.prepare(`
      UPDATE users 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    stmt.run(...values, id);
    return this.findById(id);
  }

  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static count(): number {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const result = stmt.get() as { count: number };
    return result.count;
  }
}
