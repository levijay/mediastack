"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLogModel = exports.EVENT_LABELS = exports.EVENT_TYPES = void 0;
const database_1 = __importDefault(require("../config/database"));
// Event types for display
exports.EVENT_TYPES = {
    GRABBED: 'grabbed',
    DOWNLOADED: 'downloaded',
    IMPORTED: 'imported',
    RENAMED: 'renamed',
    DELETED: 'deleted',
    ADDED: 'added',
    SCAN_COMPLETED: 'scan_completed',
    METADATA_REFRESHED: 'metadata_refreshed',
    UNMONITORED: 'unmonitored',
};
// User-friendly event labels
exports.EVENT_LABELS = {
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
class ActivityLogModel {
    static initialize() {
        database_1.default.exec(`
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
        database_1.default.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id)
    `);
        // Add index for timestamp ordering
        database_1.default.exec(`
      CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC)
    `);
    }
    static create(input) {
        const stmt = database_1.default.prepare(`
      INSERT INTO activity_logs (entity_type, entity_id, event_type, message, details)
      VALUES (?, ?, ?, ?, ?)
    `);
        const result = stmt.run(input.entity_type, input.entity_id, input.event_type, input.message, input.details || null);
        return this.findById(result.lastInsertRowid);
    }
    static findById(id) {
        const stmt = database_1.default.prepare('SELECT * FROM activity_logs WHERE id = ?');
        return stmt.get(id);
    }
    static findByEntity(entityType, entityId, limit = 50) {
        const stmt = database_1.default.prepare(`
      SELECT * FROM activity_logs 
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
        return stmt.all(entityType, entityId, limit);
    }
    static findRecent(limit = 100) {
        const stmt = database_1.default.prepare(`
      SELECT * FROM activity_logs 
      ORDER BY created_at DESC
      LIMIT ?
    `);
        return stmt.all(limit);
    }
    static findByEventType(eventType, limit = 50) {
        const stmt = database_1.default.prepare(`
      SELECT * FROM activity_logs 
      WHERE event_type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
        return stmt.all(eventType, limit);
    }
    static deleteOlderThan(days) {
        const stmt = database_1.default.prepare(`
      DELETE FROM activity_logs 
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `);
        const result = stmt.run(days);
        return result.changes;
    }
    static deleteByEntity(entityType, entityId) {
        const stmt = database_1.default.prepare(`
      DELETE FROM activity_logs 
      WHERE entity_type = ? AND entity_id = ?
    `);
        const result = stmt.run(entityType, entityId);
        return result.changes;
    }
    // Helper to log movie events
    static logMovieEvent(movieId, eventType, message, details) {
        return this.create({
            entity_type: 'movie',
            entity_id: movieId,
            event_type: eventType,
            message,
            details
        });
    }
    // Helper to log series events
    static logSeriesEvent(seriesId, eventType, message, details) {
        return this.create({
            entity_type: 'series',
            entity_id: seriesId,
            event_type: eventType,
            message,
            details
        });
    }
    // Helper to log episode events
    static logEpisodeEvent(episodeId, eventType, message, details) {
        return this.create({
            entity_type: 'episode',
            entity_id: episodeId,
            event_type: eventType,
            message,
            details
        });
    }
}
exports.ActivityLogModel = ActivityLogModel;
//# sourceMappingURL=ActivityLog.js.map