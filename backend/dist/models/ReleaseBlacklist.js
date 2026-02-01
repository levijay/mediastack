"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReleaseBlacklistModel = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
class ReleaseBlacklistModel {
    /**
     * Add a release to the blacklist
     */
    static add(data) {
        const id = (0, uuid_1.v4)();
        const stmt = database_1.default.prepare(`
      INSERT INTO release_blacklist (id, movie_id, series_id, season_number, episode_number, release_title, indexer, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.movie_id || null, data.series_id || null, data.season_number || null, data.episode_number || null, data.release_title, data.indexer || null, data.reason || null);
        logger_1.default.info(`[Blacklist] Added release: "${data.release_title}" - Reason: ${data.reason || 'download failed'}`);
        return this.findById(id);
    }
    /**
     * Check if a release title is blacklisted for a movie
     */
    static isBlacklistedForMovie(movieId, releaseTitle) {
        const normalizedTitle = this.normalizeTitle(releaseTitle);
        const stmt = database_1.default.prepare(`
      SELECT id FROM release_blacklist 
      WHERE movie_id = ? AND LOWER(release_title) = LOWER(?)
    `);
        const result = stmt.get(movieId, normalizedTitle);
        return !!result;
    }
    /**
     * Check if a release title is blacklisted for an episode
     */
    static isBlacklistedForEpisode(seriesId, seasonNumber, episodeNumber, releaseTitle) {
        const normalizedTitle = this.normalizeTitle(releaseTitle);
        const stmt = database_1.default.prepare(`
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
    static getForMovie(movieId) {
        const stmt = database_1.default.prepare(`
      SELECT * FROM release_blacklist WHERE movie_id = ? ORDER BY created_at DESC
    `);
        return stmt.all(movieId);
    }
    /**
     * Get all blacklisted releases for a series
     */
    static getForSeries(seriesId) {
        const stmt = database_1.default.prepare(`
      SELECT * FROM release_blacklist WHERE series_id = ? ORDER BY created_at DESC
    `);
        return stmt.all(seriesId);
    }
    /**
     * Get all blacklisted releases
     */
    static findAll() {
        const stmt = database_1.default.prepare(`SELECT * FROM release_blacklist ORDER BY created_at DESC`);
        return stmt.all();
    }
    /**
     * Find by ID
     */
    static findById(id) {
        const stmt = database_1.default.prepare(`SELECT * FROM release_blacklist WHERE id = ?`);
        return stmt.get(id);
    }
    /**
     * Remove a release from the blacklist
     */
    static remove(id) {
        const stmt = database_1.default.prepare(`DELETE FROM release_blacklist WHERE id = ?`);
        const result = stmt.run(id);
        return result.changes > 0;
    }
    /**
     * Clear all blacklisted releases for a movie
     */
    static clearForMovie(movieId) {
        const stmt = database_1.default.prepare(`DELETE FROM release_blacklist WHERE movie_id = ?`);
        const result = stmt.run(movieId);
        return result.changes;
    }
    /**
     * Clear all blacklisted releases for a series
     */
    static clearForSeries(seriesId) {
        const stmt = database_1.default.prepare(`DELETE FROM release_blacklist WHERE series_id = ?`);
        const result = stmt.run(seriesId);
        return result.changes;
    }
    /**
     * Normalize release title for comparison
     */
    static normalizeTitle(title) {
        return title.toLowerCase().trim();
    }
    /**
     * Get count of blacklisted releases
     */
    static count() {
        const stmt = database_1.default.prepare(`SELECT COUNT(*) as count FROM release_blacklist`);
        const result = stmt.get();
        return result.count;
    }
}
exports.ReleaseBlacklistModel = ReleaseBlacklistModel;
//# sourceMappingURL=ReleaseBlacklist.js.map