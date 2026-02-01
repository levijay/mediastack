"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArrImportController = void 0;
const arrService_1 = require("../services/arrService");
const logger_1 = __importDefault(require("../config/logger"));
class ArrImportController {
    /**
     * Test Radarr connection
     */
    static async testRadarr(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { url, apiKey } = req.body;
            if (!url || !apiKey) {
                return res.status(400).json({ error: 'URL and API key are required' });
            }
            const result = await arrService_1.arrService.testRadarr(url, apiKey);
            if (result.success) {
                return res.json({ success: true, version: result.version });
            }
            else {
                return res.status(400).json({ success: false, error: result.error });
            }
        }
        catch (error) {
            logger_1.default.error('Radarr test error:', error);
            return res.status(500).json({ error: 'Failed to test Radarr connection' });
        }
    }
    /**
     * Test Sonarr connection
     */
    static async testSonarr(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { url, apiKey } = req.body;
            if (!url || !apiKey) {
                return res.status(400).json({ error: 'URL and API key are required' });
            }
            const result = await arrService_1.arrService.testSonarr(url, apiKey);
            if (result.success) {
                return res.json({ success: true, version: result.version });
            }
            else {
                return res.status(400).json({ success: false, error: result.error });
            }
        }
        catch (error) {
            logger_1.default.error('Sonarr test error:', error);
            return res.status(500).json({ error: 'Failed to test Sonarr connection' });
        }
    }
    /**
     * Get movies from Radarr
     */
    static async getRadarrMovies(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { url, apiKey } = req.body;
            if (!url || !apiKey) {
                return res.status(400).json({ error: 'URL and API key are required' });
            }
            const movies = await arrService_1.arrService.getRadarrMovies(url, apiKey);
            // Transform to consistent format with poster URLs
            const transformedMovies = movies.map(movie => ({
                id: movie.id,
                title: movie.title,
                year: movie.year,
                tmdbId: movie.tmdbId,
                imdbId: movie.imdbId,
                overview: movie.overview,
                path: movie.path,
                hasFile: movie.hasFile,
                monitored: movie.monitored,
                posterUrl: arrService_1.arrService.getPosterUrl(movie.images)
            }));
            return res.json({ movies: transformedMovies, total: transformedMovies.length });
        }
        catch (error) {
            logger_1.default.error('Get Radarr movies error:', error);
            return res.status(500).json({ error: error.message || 'Failed to get movies from Radarr' });
        }
    }
    /**
     * Get series from Sonarr
     */
    static async getSonarrSeries(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { url, apiKey } = req.body;
            if (!url || !apiKey) {
                return res.status(400).json({ error: 'URL and API key are required' });
            }
            const series = await arrService_1.arrService.getSonarrSeries(url, apiKey);
            // Transform to consistent format with poster URLs
            const transformedSeries = series.map(s => ({
                id: s.id,
                title: s.title,
                year: s.year,
                tvdbId: s.tvdbId,
                imdbId: s.imdbId,
                overview: s.overview,
                path: s.path,
                monitored: s.monitored,
                posterUrl: arrService_1.arrService.getPosterUrl(s.images),
                seasonCount: s.statistics?.seasonCount,
                episodeCount: s.statistics?.episodeCount,
                episodeFileCount: s.statistics?.episodeFileCount,
                sizeOnDisk: s.statistics?.sizeOnDisk
            }));
            return res.json({ series: transformedSeries, total: transformedSeries.length });
        }
        catch (error) {
            logger_1.default.error('Get Sonarr series error:', error);
            return res.status(500).json({ error: error.message || 'Failed to get series from Sonarr' });
        }
    }
    /**
     * Get quality profiles from Radarr
     */
    static async getRadarrProfiles(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { url, apiKey } = req.body;
            if (!url || !apiKey) {
                return res.status(400).json({ error: 'URL and API key are required' });
            }
            const profiles = await arrService_1.arrService.getRadarrProfiles(url, apiKey);
            return res.json({ profiles });
        }
        catch (error) {
            logger_1.default.error('Get Radarr profiles error:', error);
            return res.status(500).json({ error: error.message || 'Failed to get quality profiles' });
        }
    }
    /**
     * Get quality profiles from Sonarr
     */
    static async getSonarrProfiles(req, res) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required' });
            }
            const { url, apiKey } = req.body;
            if (!url || !apiKey) {
                return res.status(400).json({ error: 'URL and API key are required' });
            }
            const profiles = await arrService_1.arrService.getSonarrProfiles(url, apiKey);
            return res.json({ profiles });
        }
        catch (error) {
            logger_1.default.error('Get Sonarr profiles error:', error);
            return res.status(500).json({ error: error.message || 'Failed to get quality profiles' });
        }
    }
}
exports.ArrImportController = ArrImportController;
//# sourceMappingURL=ArrImportController.js.map