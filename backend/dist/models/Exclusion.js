"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExclusionModel = void 0;
const database_1 = __importDefault(require("../config/database"));
const uuid_1 = require("uuid");
class ExclusionModel {
    static getAll(mediaType) {
        let query = 'SELECT * FROM exclusions';
        const params = [];
        if (mediaType) {
            query += ' WHERE media_type = ?';
            params.push(mediaType);
        }
        query += ' ORDER BY created_at DESC';
        return database_1.default.prepare(query).all(...params);
    }
    static getByTmdbId(tmdbId, mediaType) {
        return database_1.default.prepare('SELECT * FROM exclusions WHERE tmdb_id = ? AND media_type = ?').get(tmdbId, mediaType);
    }
    static isExcluded(tmdbId, mediaType) {
        const result = database_1.default.prepare('SELECT id FROM exclusions WHERE tmdb_id = ? AND media_type = ?').get(tmdbId, mediaType);
        return !!result;
    }
    static add(data) {
        const id = (0, uuid_1.v4)();
        database_1.default.prepare(`
      INSERT INTO exclusions (id, tmdb_id, media_type, title, year, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.tmdb_id, data.media_type, data.title, data.year || null, data.reason || null);
        return this.getByTmdbId(data.tmdb_id, data.media_type);
    }
    static remove(id) {
        const result = database_1.default.prepare('DELETE FROM exclusions WHERE id = ?').run(id);
        return result.changes > 0;
    }
    static removeByTmdbId(tmdbId, mediaType) {
        const result = database_1.default.prepare('DELETE FROM exclusions WHERE tmdb_id = ? AND media_type = ?').run(tmdbId, mediaType);
        return result.changes > 0;
    }
    static clear(mediaType) {
        if (mediaType) {
            const result = database_1.default.prepare('DELETE FROM exclusions WHERE media_type = ?').run(mediaType);
            return result.changes;
        }
        const result = database_1.default.prepare('DELETE FROM exclusions').run();
        return result.changes;
    }
    static count(mediaType) {
        if (mediaType) {
            const result = database_1.default.prepare('SELECT COUNT(*) as count FROM exclusions WHERE media_type = ?').get(mediaType);
            return result.count;
        }
        const result = database_1.default.prepare('SELECT COUNT(*) as count FROM exclusions').get();
        return result.count;
    }
}
exports.ExclusionModel = ExclusionModel;
//# sourceMappingURL=Exclusion.js.map