"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
const tmdb_1 = require("../services/tmdb");
const tvdb_1 = require("../services/tvdb");
const omdb_1 = require("../services/omdb");
const Exclusion_1 = require("../models/Exclusion");
class SettingsController {
    static async getSettings(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const stmt = database_1.default.prepare('SELECT * FROM system_settings ORDER BY key');
            const settings = stmt.all();
            const settingsObj = {};
            for (const setting of settings) {
                try {
                    settingsObj[setting.key] = JSON.parse(setting.value);
                }
                catch {
                    settingsObj[setting.key] = setting.value;
                }
            }
            return res.json(settingsObj);
        }
        catch (error) {
            logger_1.default.error('Get settings error:', error);
            return res.status(500).json({ error: 'Failed to get settings' });
        }
    }
    static async updateSetting(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { key, value } = req.body;
            if (!key) {
                return res.status(400).json({ error: 'Key required' });
            }
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            const stmt = database_1.default.prepare(`
        INSERT INTO system_settings (key, value) 
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET 
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `);
            stmt.run(key, valueStr);
            logger_1.default.info(`Setting updated: ${key} by ${req.user.username}`);
            return res.json({ key, value });
        }
        catch (error) {
            logger_1.default.error('Update setting error:', error);
            return res.status(500).json({ error: 'Failed to update setting' });
        }
    }
    static async testTmdbKey(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            // Allow testing a key that hasn't been saved yet
            const { apiKey } = req.body;
            let keyToTest = apiKey;
            if (!keyToTest) {
                // Get saved API key from settings
                const stmt = database_1.default.prepare('SELECT value FROM system_settings WHERE key = ?');
                const setting = stmt.get('tmdb_api_key');
                keyToTest = setting?.value;
            }
            if (!keyToTest) {
                return res.status(400).json({ valid: false, message: 'No API key to test' });
            }
            // Use the TMDB service test method
            const result = await tmdb_1.tmdbService.testApiKey(keyToTest);
            return res.json({
                valid: result.success,
                message: result.message,
                data: result.data
            });
        }
        catch (error) {
            logger_1.default.error('Test TMDB key error:', error);
            return res.status(500).json({ valid: false, message: 'Failed to test API key' });
        }
    }
    static async testTvdbKey(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            // Allow testing a key that hasn't been saved yet
            const { apiKey } = req.body;
            let keyToTest = apiKey;
            if (!keyToTest) {
                // Get saved API key from settings
                const stmt = database_1.default.prepare('SELECT value FROM system_settings WHERE key = ?');
                const setting = stmt.get('tvdb_api_key');
                keyToTest = setting?.value;
            }
            if (!keyToTest) {
                return res.status(400).json({ valid: false, message: 'No API key to test' });
            }
            // Use the TVDB service test method
            const result = await tvdb_1.tvdbService.testApiKey(keyToTest);
            return res.json({
                valid: result.success,
                message: result.message,
                data: result.data
            });
        }
        catch (error) {
            logger_1.default.error('Test TVDB key error:', error);
            return res.status(500).json({ valid: false, message: 'Failed to test API key' });
        }
    }
    static async testOmdbKey(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            // Allow testing a key that hasn't been saved yet
            const { apiKey } = req.body;
            let keyToTest = apiKey;
            if (!keyToTest) {
                // Get saved API key from settings
                const stmt = database_1.default.prepare('SELECT value FROM system_settings WHERE key = ?');
                const setting = stmt.get('omdb_api_key');
                keyToTest = setting?.value;
            }
            if (!keyToTest) {
                return res.status(400).json({ valid: false, message: 'No API key to test' });
            }
            // Temporarily set the key in the database for testing
            const updateStmt = database_1.default.prepare(`
        INSERT INTO system_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
            updateStmt.run('omdb_api_key', keyToTest);
            // Use the OMDB service test method
            const result = await omdb_1.omdbService.testConnection();
            // If test failed, remove the key
            if (!result.success) {
                const deleteStmt = database_1.default.prepare('DELETE FROM system_settings WHERE key = ?');
                deleteStmt.run('omdb_api_key');
            }
            return res.json({
                valid: result.success,
                message: result.message
            });
        }
        catch (error) {
            logger_1.default.error('Test OMDB key error:', error);
            return res.status(500).json({ valid: false, message: 'Failed to test API key' });
        }
    }
    static async getStats(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const totalUsers = database_1.default.prepare('SELECT COUNT(*) as count FROM users').get();
            const totalMovies = database_1.default.prepare('SELECT COUNT(*) as count FROM movies').get();
            const totalSeries = database_1.default.prepare('SELECT COUNT(*) as count FROM tv_series').get();
            return res.json({
                users: totalUsers.count,
                movies: totalMovies.count,
                series: totalSeries.count
            });
        }
        catch (error) {
            logger_1.default.error('Get stats error:', error);
            return res.status(500).json({ error: 'Failed to get stats' });
        }
    }
    static async getQualityProfiles(req, res) {
        try {
            const stmt = database_1.default.prepare('SELECT * FROM quality_profiles ORDER BY name');
            const profiles = stmt.all();
            return res.json(profiles);
        }
        catch (error) {
            logger_1.default.error('Get quality profiles error:', error);
            return res.status(500).json({ error: 'Failed to get quality profiles' });
        }
    }
    static async previewMovieFolderName(req, res) {
        try {
            const { title, year, tmdbId, imdbId } = req.body;
            if (!title) {
                return res.status(400).json({ error: 'Title is required' });
            }
            const { fileNamingService } = require('../services/fileNaming');
            const folderName = fileNamingService.generateMovieFolderName({
                title,
                year: year ? parseInt(year) : undefined,
                tmdbId: tmdbId ? parseInt(tmdbId) : undefined,
                imdbId
            });
            return res.json({ folderName });
        }
        catch (error) {
            logger_1.default.error('Preview movie folder name error:', error);
            return res.status(500).json({ error: 'Failed to generate folder name' });
        }
    }
    static async previewSeriesFolderName(req, res) {
        try {
            const { title, year, tvdbId, tmdbId } = req.body;
            if (!title) {
                return res.status(400).json({ error: 'Title is required' });
            }
            const { fileNamingService } = require('../services/fileNaming');
            const folderName = fileNamingService.generateSeriesFolderName({
                title,
                year: year ? parseInt(year) : undefined,
                tvdbId: tvdbId ? parseInt(tvdbId) : undefined,
                tmdbId: tmdbId ? parseInt(tmdbId) : undefined
            });
            return res.json({ folderName });
        }
        catch (error) {
            logger_1.default.error('Preview series folder name error:', error);
            return res.status(500).json({ error: 'Failed to generate folder name' });
        }
    }
    // User UI Settings (available to all authenticated users)
    static async getUserUISettings(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const stmt = database_1.default.prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?');
            const setting = stmt.get(req.user.userId, 'ui_settings');
            if (setting) {
                try {
                    return res.json({ ui_settings: JSON.parse(setting.value) });
                }
                catch {
                    return res.json({ ui_settings: setting.value });
                }
            }
            return res.json({ ui_settings: null });
        }
        catch (error) {
            logger_1.default.error('Get user UI settings error:', error);
            return res.status(500).json({ error: 'Failed to get UI settings' });
        }
    }
    static async updateUserUISettings(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const { value } = req.body;
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            const stmt = database_1.default.prepare(`
        INSERT INTO user_settings (user_id, key, value) 
        VALUES (?, 'ui_settings', ?)
        ON CONFLICT(user_id, key) DO UPDATE SET 
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `);
            stmt.run(req.user.userId, valueStr);
            logger_1.default.info(`UI settings updated for user: ${req.user.username}`);
            return res.json({ success: true });
        }
        catch (error) {
            logger_1.default.error('Update user UI settings error:', error);
            return res.status(500).json({ error: 'Failed to update UI settings' });
        }
    }
    // Exclusion list methods
    static async getExclusions(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { mediaType } = req.query;
            const exclusions = Exclusion_1.ExclusionModel.getAll(mediaType);
            return res.json({
                items: exclusions,
                total: exclusions.length,
                movieCount: Exclusion_1.ExclusionModel.count('movie'),
                tvCount: Exclusion_1.ExclusionModel.count('tv')
            });
        }
        catch (error) {
            logger_1.default.error('Get exclusions error:', error);
            return res.status(500).json({ error: 'Failed to get exclusions' });
        }
    }
    static async addExclusion(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { tmdb_id, media_type, title, year, reason } = req.body;
            if (!tmdb_id || !media_type || !title) {
                return res.status(400).json({ error: 'tmdb_id, media_type, and title are required' });
            }
            // Check if already excluded
            if (Exclusion_1.ExclusionModel.isExcluded(tmdb_id, media_type)) {
                return res.status(409).json({ error: 'Item is already in exclusion list' });
            }
            const exclusion = Exclusion_1.ExclusionModel.add({
                tmdb_id,
                media_type,
                title,
                year,
                reason
            });
            logger_1.default.info(`Added exclusion: ${title} (${media_type}) by ${req.user.username}`);
            return res.json(exclusion);
        }
        catch (error) {
            logger_1.default.error('Add exclusion error:', error);
            return res.status(500).json({ error: 'Failed to add exclusion' });
        }
    }
    static async removeExclusion(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { id } = req.params;
            const removed = Exclusion_1.ExclusionModel.remove(id);
            if (!removed) {
                return res.status(404).json({ error: 'Exclusion not found' });
            }
            logger_1.default.info(`Removed exclusion: ${id} by ${req.user.username}`);
            return res.json({ success: true });
        }
        catch (error) {
            logger_1.default.error('Remove exclusion error:', error);
            return res.status(500).json({ error: 'Failed to remove exclusion' });
        }
    }
    static async clearExclusions(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { mediaType } = req.query;
            const count = Exclusion_1.ExclusionModel.clear(mediaType);
            logger_1.default.info(`Cleared ${count} exclusions${mediaType ? ` (${mediaType})` : ''} by ${req.user.username}`);
            return res.json({ success: true, count });
        }
        catch (error) {
            logger_1.default.error('Clear exclusions error:', error);
            return res.status(500).json({ error: 'Failed to clear exclusions' });
        }
    }
}
exports.SettingsController = SettingsController;
//# sourceMappingURL=SettingsController.js.map