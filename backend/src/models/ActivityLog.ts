import db from '../config/database';

export interface ActivityLog {
  id: number;
  entity_type: 'movie' | 'series' | 'episode';
  entity_id: string;
  event_type: string;
  message: string;
  details?: string;
  created_at: string;
}

export interface ActivityLogInput {
  entity_type: 'movie' | 'series' | 'episode';
  entity_id: string;
  event_type: string;
  message: string;
  details?: string;
}

// Event types for display
export const EVENT_TYPES = {
  GRABBED: 'grabbed',
  DOWNLOADED: 'downloaded', 
  IMPORTED: 'imported',
  RENAMED: 'renamed',
  DELETED: 'deleted',
  ADDED: 'added',
  SCAN_COMPLETED: 'scan_completed',
  METADATA_REFRESHED: 'metadata_refreshed',
  UNMONITORED: 'unmonitored',
} as const;

// User-friendly event labels
export const EVENT_LABELS: Record<string, string> = {
  grabbed: 'Release Grabbed',
  downloaded: 'Download Completed',
  imported: 'Download Imported',
  renamed: 'File Renamed',
  deleted: 'File Deleted',
  added: 'Added to Library',
  unmonitored: 'Auto-Unmonitored',
  scan_completed: 'Library Scan',
  metadata_refreshed: 'Metadata Refreshed',
};

export class ActivityLogModel {
  static initialize(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Add index for faster lookups by entity
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id)
    `);
    
    // Add index for timestamp ordering
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC)
    `);
  }

  static create(input: ActivityLogInput): ActivityLog {
    const stmt = db.prepare(`
      INSERT INTO activity_logs (entity_type, entity_id, event_type, message, details)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      input.entity_type,
      input.entity_id,
      input.event_type,
      input.message,
      input.details || null
    );

    return this.findById(result.lastInsertRowid as number)!;
  }

  static findById(id: number): ActivityLog | undefined {
    const stmt = db.prepare('SELECT * FROM activity_logs WHERE id = ?');
    return stmt.get(id) as ActivityLog | undefined;
  }

  static findByEntity(entityType: string, entityId: string, limit: number = 50): ActivityLog[] {
    const stmt = db.prepare(`
      SELECT * FROM activity_logs 
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(entityType, entityId, limit) as ActivityLog[];
  }

  static findRecent(limit: number = 100): ActivityLog[] {
    const stmt = db.prepare(`
      SELECT * FROM activity_logs 
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as ActivityLog[];
  }

  static findByEventType(eventType: string, limit: number = 50): ActivityLog[] {
    const stmt = db.prepare(`
      SELECT * FROM activity_logs 
      WHERE event_type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(eventType, limit) as ActivityLog[];
  }

  static deleteOlderThan(days: number): number {
    const stmt = db.prepare(`
      DELETE FROM activity_logs 
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `);
    const result = stmt.run(days);
    return result.changes;
  }

  static deleteByEntity(entityType: string, entityId: string): number {
    const stmt = db.prepare(`
      DELETE FROM activity_logs 
      WHERE entity_type = ? AND entity_id = ?
    `);
    const result = stmt.run(entityType, entityId);
    return result.changes;
  }

  // Helper to log movie events
  static logMovieEvent(movieId: string, eventType: string, message: string, details?: string): ActivityLog {
    return this.create({
      entity_type: 'movie',
      entity_id: movieId,
      event_type: eventType,
      message,
      details
    });
  }

  // Helper to log series events
  static logSeriesEvent(seriesId: string, eventType: string, message: string, details?: string): ActivityLog {
    return this.create({
      entity_type: 'series',
      entity_id: seriesId,
      event_type: eventType,
      message,
      details
    });
  }

  // Helper to log episode events
  static logEpisodeEvent(episodeId: string, eventType: string, message: string, details?: string): ActivityLog {
    return this.create({
      entity_type: 'episode',
      entity_id: episodeId,
      event_type: eventType,
      message,
      details
    });
  }
}
