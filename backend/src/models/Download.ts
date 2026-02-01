import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';

export interface Download {
  id: string;
  movie_id: string | null;
  series_id: string | null;
  season_number: number | null;
  episode_number: number | null;
  media_type: 'movie' | 'tv';
  title: string;
  torrent_hash: string | null;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'importing';
  progress: number;
  download_url: string | null;
  save_path: string | null;
  size: number | null;
  seeders: number | null;
  indexer: string | null;
  quality: string | null;
  download_client_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export class DownloadModel {
  static create(data: {
    movie_id?: string;
    series_id?: string;
    season_number?: number;
    episode_number?: number;
    media_type: 'movie' | 'tv';
    title: string;
    download_url: string;
    size?: number;
    seeders?: number;
    indexer?: string;
    quality?: string;
  }): Download {
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO downloads (
        id, movie_id, series_id, season_number, episode_number, media_type, title, download_url,
        size, seeders, indexer, quality, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.movie_id || null,
      data.series_id || null,
      data.season_number || null,
      data.episode_number || null,
      data.media_type,
      data.title,
      data.download_url,
      data.size || null,
      data.seeders || null,
      data.indexer || null,
      data.quality || null,
      'queued'
    );

    return this.findById(id)!;
  }

  static findById(id: string): Download | undefined {
    const stmt = db.prepare('SELECT * FROM downloads WHERE id = ?');
    return stmt.get(id) as Download | undefined;
  }

  static findByMovieId(movieId: string): Download[] {
    const stmt = db.prepare('SELECT * FROM downloads WHERE movie_id = ? ORDER BY created_at DESC');
    return stmt.all(movieId) as Download[];
  }

  static findBySeriesId(seriesId: string): Download[] {
    const stmt = db.prepare('SELECT * FROM downloads WHERE series_id = ? ORDER BY created_at DESC');
    return stmt.all(seriesId) as Download[];
  }

  static findAll(limit: number = 50, offset: number = 0): Download[] {
    const stmt = db.prepare(`
      SELECT * FROM downloads 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as Download[];
  }

  static findByStatus(status: string): Download[] {
    const stmt = db.prepare(`
      SELECT * FROM downloads 
      WHERE status = ? 
      ORDER BY created_at DESC
    `);
    return stmt.all(status) as Download[];
  }

  static updateStatus(id: string, status: string, progress?: number, errorMessage?: string): Download | undefined {
    const updates: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [status];

    if (progress !== undefined) {
      updates.push('progress = ?');
      values.push(progress);
    }

    if (status === 'completed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    if (errorMessage !== undefined) {
      updates.push('error_message = ?');
      values.push(errorMessage);
    } else if (status === 'failed' || status === 'completed') {
      // Clear error message on success or if not explicitly set for failure
      updates.push('error_message = NULL');
    }

    values.push(id);

    const stmt = db.prepare(`
      UPDATE downloads 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  static updateTorrentHash(id: string, hash: string): Download | undefined {
    const stmt = db.prepare(`
      UPDATE downloads 
      SET torrent_hash = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    stmt.run(hash, id);
    return this.findById(id);
  }

  static updateProgress(id: string, progress: number): Download | undefined {
    const stmt = db.prepare(`
      UPDATE downloads 
      SET progress = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    stmt.run(progress, id);
    return this.findById(id);
  }

  static updateSavePath(id: string, savePath: string): Download | undefined {
    const stmt = db.prepare(`
      UPDATE downloads 
      SET save_path = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    stmt.run(savePath, id);
    return this.findById(id);
  }

  static updateDownloadClient(id: string, clientId: string): Download | undefined {
    const stmt = db.prepare(`
      UPDATE downloads 
      SET download_client_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    stmt.run(clientId, id);
    return this.findById(id);
  }

  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM downloads WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Find active downloads for a movie (queued, downloading, importing)
  static findActiveByMovieId(movieId: string): Download | undefined {
    const stmt = db.prepare(`
      SELECT * FROM downloads 
      WHERE movie_id = ? 
      AND status IN ('queued', 'downloading', 'importing')
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return stmt.get(movieId) as Download | undefined;
  }

  // Find active downloads for a series episode
  static findActiveByEpisode(seriesId: string, seasonNumber: number, episodeNumber: number): Download | undefined {
    const stmt = db.prepare(`
      SELECT * FROM downloads 
      WHERE series_id = ? 
      AND season_number = ?
      AND episode_number = ?
      AND status IN ('queued', 'downloading', 'importing')
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return stmt.get(seriesId, seasonNumber, episodeNumber) as Download | undefined;
  }

  // Find download by download URL (to prevent duplicate grabs)
  static findByDownloadUrl(downloadUrl: string): Download | undefined {
    const stmt = db.prepare(`
      SELECT * FROM downloads 
      WHERE download_url = ? 
      AND status IN ('queued', 'downloading', 'importing')
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return stmt.get(downloadUrl) as Download | undefined;
  }
}
