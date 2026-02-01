"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadModel = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
class DownloadModel {
    static create(data) {
        const id = (0, uuid_1.v4)();
        const stmt = database_1.default.prepare(`
      INSERT INTO downloads (
        id, movie_id, series_id, season_number, episode_number, media_type, title, download_url,
        size, seeders, indexer, quality, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.movie_id || null, data.series_id || null, data.season_number || null, data.episode_number || null, data.media_type, data.title, data.download_url, data.size || null, data.seeders || null, data.indexer || null, data.quality || null, 'queued');
        return this.findById(id);
    }
    static findById(id) {
        const stmt = database_1.default.prepare('SELECT * FROM downloads WHERE id = ?');
        return stmt.get(id);
    }
    static findByMovieId(movieId) {
        const stmt = database_1.default.prepare('SELECT * FROM downloads WHERE movie_id = ? ORDER BY created_at DESC');
        return stmt.all(movieId);
    }
    static findBySeriesId(seriesId) {
        const stmt = database_1.default.prepare('SELECT * FROM downloads WHERE series_id = ? ORDER BY created_at DESC');
        return stmt.all(seriesId);
    }
    static findAll(limit = 50, offset = 0) {
        const stmt = database_1.default.prepare(`
      SELECT * FROM downloads 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
        return stmt.all(limit, offset);
    }
    static findByStatus(status) {
        const stmt = database_1.default.prepare(`
      SELECT * FROM downloads 
      WHERE status = ? 
      ORDER BY created_at DESC
    `);
        return stmt.all(status);
    }
    static updateStatus(id, status, progress, errorMessage) {
        const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
        const values = [status];
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
        }
        else if (status === 'failed' || status === 'completed') {
            // Clear error message on success or if not explicitly set for failure
            updates.push('error_message = NULL');
        }
        values.push(id);
        const stmt = database_1.default.prepare(`
      UPDATE downloads 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `);
        stmt.run(...values);
        return this.findById(id);
    }
    static updateTorrentHash(id, hash) {
        const stmt = database_1.default.prepare(`
      UPDATE downloads 
      SET torrent_hash = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(hash, id);
        return this.findById(id);
    }
    static updateProgress(id, progress) {
        const stmt = database_1.default.prepare(`
      UPDATE downloads 
      SET progress = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(progress, id);
        return this.findById(id);
    }
    static updateSavePath(id, savePath) {
        const stmt = database_1.default.prepare(`
      UPDATE downloads 
      SET save_path = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(savePath, id);
        return this.findById(id);
    }
    static updateDownloadClient(id, clientId) {
        const stmt = database_1.default.prepare(`
      UPDATE downloads 
      SET download_client_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(clientId, id);
        return this.findById(id);
    }
    static delete(id) {
        const stmt = database_1.default.prepare('DELETE FROM downloads WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    // Find active downloads for a movie (queued, downloading, importing)
    static findActiveByMovieId(movieId) {
        const stmt = database_1.default.prepare(`
      SELECT * FROM downloads 
      WHERE movie_id = ? 
      AND status IN ('queued', 'downloading', 'importing')
      ORDER BY created_at DESC
      LIMIT 1
    `);
        return stmt.get(movieId);
    }
    // Find active downloads for a series episode
    static findActiveByEpisode(seriesId, seasonNumber, episodeNumber) {
        const stmt = database_1.default.prepare(`
      SELECT * FROM downloads 
      WHERE series_id = ? 
      AND season_number = ?
      AND episode_number = ?
      AND status IN ('queued', 'downloading', 'importing')
      ORDER BY created_at DESC
      LIMIT 1
    `);
        return stmt.get(seriesId, seasonNumber, episodeNumber);
    }
    // Find download by download URL (to prevent duplicate grabs)
    static findByDownloadUrl(downloadUrl) {
        const stmt = database_1.default.prepare(`
      SELECT * FROM downloads 
      WHERE download_url = ? 
      AND status IN ('queued', 'downloading', 'importing')
      ORDER BY created_at DESC
      LIMIT 1
    `);
        return stmt.get(downloadUrl);
    }
}
exports.DownloadModel = DownloadModel;
//# sourceMappingURL=Download.js.map