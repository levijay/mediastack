"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../utils/auth");
class UserModel {
    static async create(data) {
        const id = (0, uuid_1.v4)();
        const password_hash = await (0, auth_1.hashPassword)(data.password);
        const role = data.role || 'user';
        const stmt = database_1.default.prepare(`
      INSERT INTO users (id, username, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.username, data.email, password_hash, role);
        return this.findById(id);
    }
    static findById(id) {
        const stmt = database_1.default.prepare('SELECT * FROM users WHERE id = ?');
        return stmt.get(id);
    }
    static findByUsername(username) {
        const stmt = database_1.default.prepare('SELECT * FROM users WHERE username = ?');
        return stmt.get(username);
    }
    static findByEmail(email) {
        const stmt = database_1.default.prepare('SELECT * FROM users WHERE email = ?');
        return stmt.get(email);
    }
    static findByApiKey(apiKey) {
        const stmt = database_1.default.prepare('SELECT * FROM users WHERE api_key = ?');
        return stmt.get(apiKey);
    }
    static findAll() {
        const stmt = database_1.default.prepare('SELECT * FROM users ORDER BY created_at DESC');
        return stmt.all();
    }
    static update(id, data) {
        const fields = Object.keys(data)
            .filter(key => key !== 'id')
            .map(key => `${key} = ?`)
            .join(', ');
        const values = Object.keys(data)
            .filter(key => key !== 'id')
            .map(key => data[key]);
        const stmt = database_1.default.prepare(`
      UPDATE users 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(...values, id);
        return this.findById(id);
    }
    static delete(id) {
        const stmt = database_1.default.prepare('DELETE FROM users WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    static count() {
        const stmt = database_1.default.prepare('SELECT COUNT(*) as count FROM users');
        const result = stmt.get();
        return result.count;
    }
}
exports.UserModel = UserModel;
//# sourceMappingURL=User.js.map