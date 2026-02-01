"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.arrService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../config/logger"));
class ArrService {
    /**
     * Test connection to a Radarr instance
     */
    async testRadarr(url, apiKey) {
        try {
            const baseUrl = this.normalizeUrl(url);
            const response = await axios_1.default.get(`${baseUrl}/api/v3/system/status`, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 10000
            });
            return {
                success: true,
                version: response.data.version
            };
        }
        catch (error) {
            logger_1.default.error('[ArrService] Radarr test failed:', error.message);
            return {
                success: false,
                error: error.response?.status === 401 ? 'Invalid API key' : error.message
            };
        }
    }
    /**
     * Test connection to a Sonarr instance
     */
    async testSonarr(url, apiKey) {
        try {
            const baseUrl = this.normalizeUrl(url);
            const response = await axios_1.default.get(`${baseUrl}/api/v3/system/status`, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 10000
            });
            return {
                success: true,
                version: response.data.version
            };
        }
        catch (error) {
            logger_1.default.error('[ArrService] Sonarr test failed:', error.message);
            return {
                success: false,
                error: error.response?.status === 401 ? 'Invalid API key' : error.message
            };
        }
    }
    /**
     * Get all movies from Radarr
     */
    async getRadarrMovies(url, apiKey) {
        try {
            const baseUrl = this.normalizeUrl(url);
            const response = await axios_1.default.get(`${baseUrl}/api/v3/movie`, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 30000
            });
            return response.data.map((movie) => ({
                id: movie.id,
                title: movie.title,
                year: movie.year,
                tmdbId: movie.tmdbId,
                imdbId: movie.imdbId,
                overview: movie.overview,
                path: movie.path,
                hasFile: movie.hasFile,
                monitored: movie.monitored,
                qualityProfileId: movie.qualityProfileId,
                images: movie.images
            }));
        }
        catch (error) {
            logger_1.default.error('[ArrService] Failed to get Radarr movies:', error.message);
            throw new Error(`Failed to get movies from Radarr: ${error.message}`);
        }
    }
    /**
     * Get all series from Sonarr
     */
    async getSonarrSeries(url, apiKey) {
        try {
            const baseUrl = this.normalizeUrl(url);
            const response = await axios_1.default.get(`${baseUrl}/api/v3/series`, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 30000
            });
            return response.data.map((series) => ({
                id: series.id,
                title: series.title,
                year: series.year,
                tvdbId: series.tvdbId,
                imdbId: series.imdbId,
                overview: series.overview,
                path: series.path,
                monitored: series.monitored,
                qualityProfileId: series.qualityProfileId,
                images: series.images,
                statistics: series.statistics
            }));
        }
        catch (error) {
            logger_1.default.error('[ArrService] Failed to get Sonarr series:', error.message);
            throw new Error(`Failed to get series from Sonarr: ${error.message}`);
        }
    }
    /**
     * Get quality profiles from Radarr
     */
    async getRadarrProfiles(url, apiKey) {
        try {
            const baseUrl = this.normalizeUrl(url);
            const response = await axios_1.default.get(`${baseUrl}/api/v3/qualityprofile`, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 10000
            });
            return response.data.map((profile) => ({
                id: profile.id,
                name: profile.name
            }));
        }
        catch (error) {
            logger_1.default.error('[ArrService] Failed to get Radarr profiles:', error.message);
            throw new Error(`Failed to get quality profiles: ${error.message}`);
        }
    }
    /**
     * Get quality profiles from Sonarr
     */
    async getSonarrProfiles(url, apiKey) {
        try {
            const baseUrl = this.normalizeUrl(url);
            const response = await axios_1.default.get(`${baseUrl}/api/v3/qualityprofile`, {
                headers: { 'X-Api-Key': apiKey },
                timeout: 10000
            });
            return response.data.map((profile) => ({
                id: profile.id,
                name: profile.name
            }));
        }
        catch (error) {
            logger_1.default.error('[ArrService] Failed to get Sonarr profiles:', error.message);
            throw new Error(`Failed to get quality profiles: ${error.message}`);
        }
    }
    /**
     * Get poster URL from Arr images array
     */
    getPosterUrl(images) {
        if (!images)
            return null;
        const poster = images.find(img => img.coverType === 'poster');
        return poster?.remoteUrl || null;
    }
    /**
     * Normalize URL to ensure consistent format
     */
    normalizeUrl(url) {
        // Remove trailing slash
        let normalized = url.replace(/\/+$/, '');
        // Ensure http/https prefix
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = `http://${normalized}`;
        }
        return normalized;
    }
}
exports.arrService = new ArrService();
//# sourceMappingURL=arrService.js.map