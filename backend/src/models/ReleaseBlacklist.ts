import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import logger from '../config/logger';

export interface BlacklistedRelease {
  id: string;
  movie_id: string | null;
  series_id: string | null;
  season_number: number | null;
  episode_number: number | null;
  release_title: string;
  indexer: string | null;
  reason: string | null;
  created_at: string;
}

export class ReleaseBlacklistModel {
  /**
   * Add a release to the blacklist
   */
  static add(data: {
    movie_id?: string;
    series_id?: string;
    season_number?: number;
    episode_number?: number;
    release_title: string;
    indexer?: string;
    reason?: string;
  }): BlacklistedRelease {
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO release_blacklist (id, movie_id, series_id, season_number, episode_number, release_title, indexer, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.movie_id || null,
      data.series_id || null,
      data.season_number || null,
      data.episode_number || null,
      data.release_title,
      data.indexer || null,
      data.reason || null
    );
    
    logger.info(`[Blacklist] Added release: "${data.release_title}" - Reason: ${data.reason || 'download failed'}`);
    
    return this.findById(id)!;
  }

  /**
   * Check if a release title is blacklisted for a movie
   */
  static isBlacklistedForMovie(movieId: string, releaseTitle: string): boolean {
    const normalizedTitle = this.normalizeTitle(releaseTitle);
    
    const stmt = db.prepare(`
      SELECT id FROM release_blacklist 
      WHERE movie_id = ? AND LOWER(release_title) = LOWER(?)
    `);
    
    const result = stmt.get(movieId, normalizedTitle);
    return !!result;
  }

  /**
   * Check if a release title is blacklisted for an episode
   */
  static isBlacklistedForEpisode(
    seriesId: string, 
    seasonNumber: number, 
    episodeNumber: number, 
    releaseTitle: string
  ): boolean {
    const normalizedTitle = this.normalizeTitle(releaseTitle);
    
    const stmt = db.prepare(`
      SELECT id FROM release_blacklist 
      WHERE series_id = ? 
        AND (season_number IS NULL OR season_number = ?)
        AND (episode_number IS NULL OR episode_number = ?)
        AND LOWER(release_title) = LOWER(?)
    `);
    
    const result = stmt.get(seriesId, seasonNumber, episodeNumber, normalizedTitle);
    return !!result;
  }

  /**
   * Get all blacklisted releases for a movie
   */
  static getForMovie(movieId: string): BlacklistedRelease[] {
    const stmt = db.prepare(`
      SELECT * FROM release_blacklist WHERE movie_id = ? ORDER BY created_at DESC
    `);
    return stmt.all(movieId) as BlacklistedRelease[];
  }

  /**
   * Get all blacklisted releases for a series
   */
  static getForSeries(seriesId: string): BlacklistedRelease[] {
    const stmt = db.prepare(`
      SELECT * FROM release_blacklist WHERE series_id = ? ORDER BY created_at DESC
    `);
    return stmt.all(seriesId) as BlacklistedRelease[];
  }

  /**
   * Get all blacklisted releases
   */
  static findAll(): BlacklistedRelease[] {
    const stmt = db.prepare(`SELECT * FROM release_blacklist ORDER BY created_at DESC`);
    return stmt.all() as BlacklistedRelease[];
  }

  /**
   * Find by ID
   */
  static findById(id: string): BlacklistedRelease | null {
    const stmt = db.prepare(`SELECT * FROM release_blacklist WHERE id = ?`);
    return stmt.get(id) as BlacklistedRelease | null;
  }

  /**
   * Remove a release from the blacklist
   */
  static remove(id: string): boolean {
    const stmt = db.prepare(`DELETE FROM release_blacklist WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Clear all blacklisted releases for a movie
   */
  static clearForMovie(movieId: string): number {
    const stmt = db.prepare(`DELETE FROM release_blacklist WHERE movie_id = ?`);
    const result = stmt.run(movieId);
    return result.changes;
  }

  /**
   * Clear all blacklisted releases for a series
   */
  static clearForSeries(seriesId: string): number {
    const stmt = db.prepare(`DELETE FROM release_blacklist WHERE series_id = ?`);
    const result = stmt.run(seriesId);
    return result.changes;
  }

  /**
   * Normalize release title for comparison
   */
  private static normalizeTitle(title: string): string {
    return title.toLowerCase().trim();
  }

  /**
   * Get count of blacklisted releases
   */
  static count(): number {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM release_blacklist`);
    const result = stmt.get() as { count: number };
    return result.count;
  }
}
