import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface Exclusion {
  id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  year?: number;
  reason?: string;
  created_at: string;
}

export class ExclusionModel {
  static getAll(mediaType?: string): Exclusion[] {
    let query = 'SELECT * FROM exclusions';
    const params: any[] = [];
    
    if (mediaType) {
      query += ' WHERE media_type = ?';
      params.push(mediaType);
    }
    
    query += ' ORDER BY created_at DESC';
    
    return db.prepare(query).all(...params) as Exclusion[];
  }

  static getByTmdbId(tmdbId: number, mediaType: string): Exclusion | undefined {
    return db.prepare(
      'SELECT * FROM exclusions WHERE tmdb_id = ? AND media_type = ?'
    ).get(tmdbId, mediaType) as Exclusion | undefined;
  }

  static isExcluded(tmdbId: number, mediaType: string): boolean {
    const result = db.prepare(
      'SELECT id FROM exclusions WHERE tmdb_id = ? AND media_type = ?'
    ).get(tmdbId, mediaType);
    return !!result;
  }

  static add(data: {
    tmdb_id: number;
    media_type: 'movie' | 'tv';
    title: string;
    year?: number;
    reason?: string;
  }): Exclusion {
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO exclusions (id, tmdb_id, media_type, title, year, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.tmdb_id, data.media_type, data.title, data.year || null, data.reason || null);
    
    return this.getByTmdbId(data.tmdb_id, data.media_type)!;
  }

  static remove(id: string): boolean {
    const result = db.prepare('DELETE FROM exclusions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  static removeByTmdbId(tmdbId: number, mediaType: string): boolean {
    const result = db.prepare(
      'DELETE FROM exclusions WHERE tmdb_id = ? AND media_type = ?'
    ).run(tmdbId, mediaType);
    return result.changes > 0;
  }

  static clear(mediaType?: string): number {
    if (mediaType) {
      const result = db.prepare('DELETE FROM exclusions WHERE media_type = ?').run(mediaType);
      return result.changes;
    }
    const result = db.prepare('DELETE FROM exclusions').run();
    return result.changes;
  }

  static count(mediaType?: string): number {
    if (mediaType) {
      const result = db.prepare('SELECT COUNT(*) as count FROM exclusions WHERE media_type = ?').get(mediaType) as { count: number };
      return result.count;
    }
    const result = db.prepare('SELECT COUNT(*) as count FROM exclusions').get() as { count: number };
    return result.count;
  }
}
