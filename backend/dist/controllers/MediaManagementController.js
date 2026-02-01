"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaManagementController = void 0;
const QualityProfile_1 = require("../models/QualityProfile");
const NamingConfig_1 = require("../models/NamingConfig");
const fileNaming_1 = require("../services/fileNaming");
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
class MediaManagementController {
    // ========== Quality Profiles ==========
    // Get all quality definitions
    static async getQualityDefinitions(req, res) {
        try {
            const definitions = QualityProfile_1.QualityProfileModel.getAllDefinitions();
            return res.json(definitions);
        }
        catch (error) {
            logger_1.default.error('Get quality definitions error:', error);
            return res.status(500).json({ error: 'Failed to get quality definitions' });
        }
    }
    // Get all quality profiles
    static async getQualityProfiles(req, res) {
        try {
            const profiles = QualityProfile_1.QualityProfileModel.getAll();
            return res.json(profiles);
        }
        catch (error) {
            logger_1.default.error('Get quality profiles error:', error);
            return res.status(500).json({ error: 'Failed to get quality profiles' });
        }
    }
    // Get quality profile by ID
    static async getQualityProfile(req, res) {
        try {
            const { id } = req.params;
            const profile = QualityProfile_1.QualityProfileModel.findById(id);
            if (!profile) {
                return res.status(404).json({ error: 'Quality profile not found' });
            }
            return res.json(profile);
        }
        catch (error) {
            logger_1.default.error('Get quality profile error:', error);
            return res.status(500).json({ error: 'Failed to get quality profile' });
        }
    }
    // Create quality profile
    static async createQualityProfile(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const { name, media_type, cutoff_quality, upgrade_allowed, items } = req.body;
            if (!name || !cutoff_quality || !items) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            // Check if name already exists
            const existing = QualityProfile_1.QualityProfileModel.findByName(name);
            if (existing) {
                return res.status(409).json({ error: 'A profile with this name already exists' });
            }
            const profile = QualityProfile_1.QualityProfileModel.create({
                name,
                media_type: media_type || 'both',
                cutoff_quality,
                upgrade_allowed: upgrade_allowed !== false,
                items
            });
            logger_1.default.info(`Quality profile created: ${name} by ${req.user.username}`);
            return res.status(201).json(profile);
        }
        catch (error) {
            logger_1.default.error('Create quality profile error:', error);
            return res.status(500).json({ error: 'Failed to create quality profile' });
        }
    }
    // Update quality profile
    static async updateQualityProfile(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const { id } = req.params;
            const { name, media_type, cutoff_quality, upgrade_allowed, items } = req.body;
            const profile = QualityProfile_1.QualityProfileModel.update(id, {
                name,
                media_type,
                cutoff_quality,
                upgrade_allowed,
                items
            });
            if (!profile) {
                return res.status(404).json({ error: 'Quality profile not found' });
            }
            logger_1.default.info(`Quality profile updated: ${profile.name} by ${req.user.username}`);
            return res.json(profile);
        }
        catch (error) {
            logger_1.default.error('Update quality profile error:', error);
            return res.status(500).json({ error: 'Failed to update quality profile' });
        }
    }
    // Delete quality profile
    static async deleteQualityProfile(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const { id } = req.params;
            // Set quality_profile_id to null for all movies and series using this profile
            const updateMoviesStmt = database_1.default.prepare('UPDATE movies SET quality_profile_id = NULL WHERE quality_profile_id = ?');
            updateMoviesStmt.run(id);
            const updateSeriesStmt = database_1.default.prepare('UPDATE tv_series SET quality_profile_id = NULL WHERE quality_profile_id = ?');
            updateSeriesStmt.run(id);
            const deleted = QualityProfile_1.QualityProfileModel.delete(id);
            if (!deleted) {
                return res.status(404).json({ error: 'Quality profile not found' });
            }
            logger_1.default.info(`Quality profile deleted by ${req.user.username}, linked movies/series set to no profile`);
            return res.json({ success: true });
        }
        catch (error) {
            logger_1.default.error('Delete quality profile error:', error);
            return res.status(500).json({ error: 'Failed to delete quality profile' });
        }
    }
    // ========== Naming Configuration ==========
    // Get naming configuration
    static async getNamingConfig(req, res) {
        try {
            const config = NamingConfig_1.NamingConfigModel.get();
            return res.json(config);
        }
        catch (error) {
            logger_1.default.error('Get naming config error:', error);
            return res.status(500).json({ error: 'Failed to get naming configuration' });
        }
    }
    // Update naming configuration
    static async updateNamingConfig(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const config = NamingConfig_1.NamingConfigModel.update(req.body);
            // Refresh the file naming service config
            fileNaming_1.fileNamingService.refreshConfig();
            logger_1.default.info(`Naming config updated by ${req.user.username}`);
            return res.json(config);
        }
        catch (error) {
            logger_1.default.error('Update naming config error:', error);
            return res.status(500).json({ error: 'Failed to update naming configuration' });
        }
    }
    // Get naming tokens
    static async getNamingTokens(req, res) {
        try {
            return res.json({
                movie: NamingConfig_1.NamingConfigModel.getMovieTokens(),
                episode: NamingConfig_1.NamingConfigModel.getEpisodeTokens(),
                folder: NamingConfig_1.NamingConfigModel.getFolderTokens()
            });
        }
        catch (error) {
            logger_1.default.error('Get naming tokens error:', error);
            return res.status(500).json({ error: 'Failed to get naming tokens' });
        }
    }
    // Preview naming format
    static async previewNaming(req, res) {
        try {
            const { type, format } = req.body;
            // Temporarily update the service config
            const originalConfig = NamingConfig_1.NamingConfigModel.get();
            let preview = '';
            if (type === 'movie') {
                const sampleMovie = {
                    title: 'The Movie Title',
                    year: 2024,
                    tmdbId: 12345,
                    imdbId: 'tt1234567',
                    quality: 'Bluray-1080p',
                    videoCodec: 'x265',
                    audioCodec: 'DTS',
                    audioChannels: '5.1',
                    dynamicRange: 'HDR',
                    releaseGroup: 'SPARKS',
                    proper: false
                };
                // Apply temporary format
                if (format) {
                    NamingConfig_1.NamingConfigModel.update({ standard_movie_format: format });
                    fileNaming_1.fileNamingService.refreshConfig();
                }
                preview = fileNaming_1.fileNamingService.previewMovieFilename(sampleMovie);
                // Restore original
                if (format) {
                    NamingConfig_1.NamingConfigModel.update({ standard_movie_format: originalConfig.standard_movie_format });
                    fileNaming_1.fileNamingService.refreshConfig();
                }
            }
            else if (type === 'episode') {
                const sampleEpisode = {
                    seriesTitle: "The Series Title's!",
                    seriesYear: 2020,
                    seasonNumber: 1,
                    episodeNumber: 1,
                    episodeTitle: 'Episode Title 1',
                    airDate: '2020-01-15',
                    absoluteNumber: 1,
                    tvdbId: 12345,
                    tmdbId: 67890,
                    quality: 'WEBDL-1080p',
                    videoCodec: 'x264',
                    audioCodec: 'AAC',
                    audioChannels: '2.0',
                    releaseGroup: 'LOL',
                    proper: true
                };
                if (format) {
                    NamingConfig_1.NamingConfigModel.update({ standard_episode_format: format });
                    fileNaming_1.fileNamingService.refreshConfig();
                }
                preview = fileNaming_1.fileNamingService.previewEpisodeFilename(sampleEpisode);
                if (format) {
                    NamingConfig_1.NamingConfigModel.update({ standard_episode_format: originalConfig.standard_episode_format });
                    fileNaming_1.fileNamingService.refreshConfig();
                }
            }
            else if (type === 'movie_folder') {
                const sampleMovie = {
                    title: 'The Movie Title',
                    year: 2024,
                    tmdbId: 12345,
                    imdbId: 'tt1234567'
                };
                if (format) {
                    NamingConfig_1.NamingConfigModel.update({ movie_folder_format: format });
                    fileNaming_1.fileNamingService.refreshConfig();
                }
                preview = fileNaming_1.fileNamingService.previewMovieFolderName(sampleMovie);
                if (format) {
                    NamingConfig_1.NamingConfigModel.update({ movie_folder_format: originalConfig.movie_folder_format });
                    fileNaming_1.fileNamingService.refreshConfig();
                }
            }
            else if (type === 'series_folder') {
                const sampleSeries = {
                    title: "The Series Title's!",
                    year: 2020,
                    tvdbId: 12345,
                    tmdbId: 67890
                };
                if (format) {
                    NamingConfig_1.NamingConfigModel.update({ series_folder_format: format });
                    fileNaming_1.fileNamingService.refreshConfig();
                }
                preview = fileNaming_1.fileNamingService.previewSeriesFolderName(sampleSeries);
                if (format) {
                    NamingConfig_1.NamingConfigModel.update({ series_folder_format: originalConfig.series_folder_format });
                    fileNaming_1.fileNamingService.refreshConfig();
                }
            }
            else if (type === 'season_folder') {
                if (format) {
                    NamingConfig_1.NamingConfigModel.update({ season_folder_format: format });
                    fileNaming_1.fileNamingService.refreshConfig();
                }
                preview = fileNaming_1.fileNamingService.previewSeasonFolderName(1);
                if (format) {
                    NamingConfig_1.NamingConfigModel.update({ season_folder_format: originalConfig.season_folder_format });
                    fileNaming_1.fileNamingService.refreshConfig();
                }
            }
            return res.json({ preview });
        }
        catch (error) {
            logger_1.default.error('Preview naming error:', error);
            return res.status(500).json({ error: 'Failed to preview naming format' });
        }
    }
    // ========== File Management Settings ==========
    static async getFileManagementSettings(req, res) {
        try {
            // Default settings
            const defaults = {
                propers_repacks_preference: 'preferAndUpgrade',
                delete_empty_folders: true,
                unmonitor_deleted_media: true
            };
            // Get from database
            const settings = {};
            const propersResult = database_1.default.prepare("SELECT value FROM system_settings WHERE key = 'propers_repacks_preference'").get();
            settings.propers_repacks_preference = propersResult?.value || defaults.propers_repacks_preference;
            const deleteEmptyResult = database_1.default.prepare("SELECT value FROM system_settings WHERE key = 'delete_empty_folders'").get();
            settings.delete_empty_folders = deleteEmptyResult?.value !== 'false';
            const unmonitorResult = database_1.default.prepare("SELECT value FROM system_settings WHERE key = 'unmonitor_deleted_media'").get();
            settings.unmonitor_deleted_media = unmonitorResult?.value !== 'false';
            return res.json(settings);
        }
        catch (error) {
            logger_1.default.error('Get file management settings error:', error);
            return res.status(500).json({ error: 'Failed to get file management settings' });
        }
    }
    static async updateFileManagementSettings(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const { propers_repacks_preference, delete_empty_folders, unmonitor_deleted_media } = req.body;
            // Validate propers_repacks_preference
            const validPreferences = ['preferAndUpgrade', 'doNotUpgrade', 'doNotPrefer'];
            if (propers_repacks_preference && !validPreferences.includes(propers_repacks_preference)) {
                return res.status(400).json({ error: 'Invalid propers_repacks_preference value' });
            }
            // Update settings
            if (propers_repacks_preference !== undefined) {
                database_1.default.prepare(`
          INSERT INTO system_settings (key, value) VALUES ('propers_repacks_preference', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).run(propers_repacks_preference);
            }
            if (delete_empty_folders !== undefined) {
                database_1.default.prepare(`
          INSERT INTO system_settings (key, value) VALUES ('delete_empty_folders', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).run(delete_empty_folders ? 'true' : 'false');
            }
            if (unmonitor_deleted_media !== undefined) {
                database_1.default.prepare(`
          INSERT INTO system_settings (key, value) VALUES ('unmonitor_deleted_media', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).run(unmonitor_deleted_media ? 'true' : 'false');
            }
            logger_1.default.info(`File management settings updated by ${req.user.username}`);
            // Return updated settings
            return MediaManagementController.getFileManagementSettings(req, res);
        }
        catch (error) {
            logger_1.default.error('Update file management settings error:', error);
            return res.status(500).json({ error: 'Failed to update file management settings' });
        }
    }
}
exports.MediaManagementController = MediaManagementController;
//# sourceMappingURL=MediaManagementController.js.map