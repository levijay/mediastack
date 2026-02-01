"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadClientModel = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
class DownloadClientModel {
    static create(data) {
        const id = (0, uuid_1.v4)();
        const stmt = database_1.default.prepare(`
      INSERT INTO download_clients (
        id, name, type, enabled, host, port, use_ssl, url_base,
        username, password, api_key, category, category_movies, category_tv, priority,
        remove_completed, remove_failed, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.name, data.type, data.enabled !== false ? 1 : 0, data.host, data.port, data.use_ssl ? 1 : 0, data.url_base || null, data.username || null, data.password || null, data.api_key || null, data.category || null, data.category_movies || null, data.category_tv || null, data.priority || 1, data.remove_completed !== false ? 1 : 0, data.remove_failed !== false ? 1 : 0, data.tags || null);
        return this.findById(id);
    }
    static findById(id) {
        const stmt = database_1.default.prepare('SELECT * FROM download_clients WHERE id = ?');
        const client = stmt.get(id);
        if (!client)
            return undefined;
        return {
            ...client,
            enabled: client.enabled === 1,
            use_ssl: client.use_ssl === 1,
            remove_completed: client.remove_completed === 1,
            remove_failed: client.remove_failed === 1
        };
    }
    static findAll() {
        const stmt = database_1.default.prepare('SELECT * FROM download_clients ORDER BY priority, name');
        return stmt.all().map(client => ({
            ...client,
            enabled: client.enabled === 1,
            use_ssl: client.use_ssl === 1,
            remove_completed: client.remove_completed === 1,
            remove_failed: client.remove_failed === 1
        }));
    }
    static findByType(type) {
        const stmt = database_1.default.prepare('SELECT * FROM download_clients WHERE type = ? ORDER BY priority, name');
        return stmt.all(type).map(client => ({
            ...client,
            enabled: client.enabled === 1,
            use_ssl: client.use_ssl === 1,
            remove_completed: client.remove_completed === 1,
            remove_failed: client.remove_failed === 1
        }));
    }
    static findEnabled() {
        const stmt = database_1.default.prepare('SELECT * FROM download_clients WHERE enabled = 1 ORDER BY priority, name');
        return stmt.all().map(client => ({
            ...client,
            enabled: true,
            use_ssl: client.use_ssl === 1,
            remove_completed: client.remove_completed === 1,
            remove_failed: client.remove_failed === 1
        }));
    }
    static update(id, data) {
        const existing = this.findById(id);
        if (!existing)
            return undefined;
        const updates = [];
        const values = [];
        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.type !== undefined) {
            updates.push('type = ?');
            values.push(data.type);
        }
        if (data.enabled !== undefined) {
            updates.push('enabled = ?');
            values.push(data.enabled ? 1 : 0);
        }
        if (data.host !== undefined) {
            updates.push('host = ?');
            values.push(data.host);
        }
        if (data.port !== undefined) {
            updates.push('port = ?');
            values.push(data.port);
        }
        if (data.use_ssl !== undefined) {
            updates.push('use_ssl = ?');
            values.push(data.use_ssl ? 1 : 0);
        }
        if (data.url_base !== undefined) {
            updates.push('url_base = ?');
            values.push(data.url_base);
        }
        if (data.username !== undefined) {
            updates.push('username = ?');
            values.push(data.username);
        }
        if (data.password !== undefined) {
            updates.push('password = ?');
            values.push(data.password);
        }
        if (data.api_key !== undefined) {
            updates.push('api_key = ?');
            values.push(data.api_key);
        }
        if (data.category !== undefined) {
            updates.push('category = ?');
            values.push(data.category);
        }
        if (data.category_movies !== undefined) {
            updates.push('category_movies = ?');
            values.push(data.category_movies);
        }
        if (data.category_tv !== undefined) {
            updates.push('category_tv = ?');
            values.push(data.category_tv);
        }
        if (data.priority !== undefined) {
            updates.push('priority = ?');
            values.push(data.priority);
        }
        if (data.remove_completed !== undefined) {
            updates.push('remove_completed = ?');
            values.push(data.remove_completed ? 1 : 0);
        }
        if (data.remove_failed !== undefined) {
            updates.push('remove_failed = ?');
            values.push(data.remove_failed ? 1 : 0);
        }
        if (data.tags !== undefined) {
            updates.push('tags = ?');
            values.push(data.tags);
        }
        if (updates.length === 0)
            return existing;
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        const stmt = database_1.default.prepare(`
      UPDATE download_clients 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
        stmt.run(...values);
        return this.findById(id);
    }
    static delete(id) {
        const stmt = database_1.default.prepare('DELETE FROM download_clients WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    // Get the URL for a client
    static getClientUrl(client) {
        const protocol = client.use_ssl ? 'https' : 'http';
        const base = client.url_base ? `/${client.url_base.replace(/^\//, '')}` : '';
        return `${protocol}://${client.host}:${client.port}${base}`;
    }
}
exports.DownloadClientModel = DownloadClientModel;
//# sourceMappingURL=DownloadClient.js.map