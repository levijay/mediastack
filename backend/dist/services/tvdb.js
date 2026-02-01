"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tvdbService = exports.TVDBService = void 0;
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
const TVDB_BASE_URL = 'https://api4.thetvdb.com/v4';
class TVDBService {
    constructor() {
        this.token = '';
        this.tokenExpiry = 0;
    }
    getApiKey() {
        try {
            const stmt = database_1.default.prepare('SELECT value FROM system_settings WHERE key = ?');
            const result = stmt.get('tvdb_api_key');
            if (result?.value) {
                return result.value;
            }
        }
        catch (error) {
            // Database might not be initialized yet
        }
        return process.env.TVDB_API_KEY || '';
    }
    async authenticate() {
        // Check if we have a valid token
        if (this.token && Date.now() < this.tokenExpiry) {
            return this.token;
        }
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('TVDB API key not configured. Please set API key in Settings.');
        }
        try {
            const response = await axios_1.default.post(`${TVDB_BASE_URL}/login`, {
                apikey: apiKey
            });
            if (response.data?.data?.token) {
                this.token = response.data.data.token;
                // Token is valid for 30 days, but we'll refresh after 29 days
                this.tokenExpiry = Date.now() + (29 * 24 * 60 * 60 * 1000);
                return this.token;
            }
            throw new Error('Failed to get TVDB token');
        }
        catch (error) {
            logger_1.default.error('TVDB authentication failed:', error.message);
            throw new Error('Failed to authenticate with TVDB. Check your API key.');
        }
    }
    async makeRequest(endpoint, params = {}) {
        const token = await this.authenticate();
        try {
            const response = await axios_1.default.get(`${TVDB_BASE_URL}${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                params
            });
            return response.data?.data;
        }
        catch (error) {
            // If 401, token might be expired - clear and retry once
            if (error.response?.status === 401) {
                this.token = '';
                this.tokenExpiry = 0;
                const newToken = await this.authenticate();
                const retryResponse = await axios_1.default.get(`${TVDB_BASE_URL}${endpoint}`, {
                    headers: {
                        'Authorization': `Bearer ${newToken}`,
                        'Accept': 'application/json'
                    },
                    params
                });
                return retryResponse.data?.data;
            }
            throw error;
        }
    }
    /**
     * Search for TV series by name
     */
    async searchSeries(query) {
        try {
            const data = await this.makeRequest('/search', { query, type: 'series' });
            return data || [];
        }
        catch (error) {
            logger_1.default.error('TVDB search failed:', error);
            return [];
        }
    }
    /**
     * Get English translation for a series
     */
    async getSeriesTranslation(tvdbId, language = 'eng') {
        try {
            const data = await this.makeRequest(`/series/${tvdbId}/translations/${language}`);
            return data;
        }
        catch (error) {
            logger_1.default.debug(`TVDB translation for ${tvdbId} in ${language} not found`);
            return null;
        }
    }
    /**
     * Get series details by TVDB ID with English translation
     */
    async getSeriesDetails(tvdbId) {
        try {
            const data = await this.makeRequest(`/series/${tvdbId}/extended`, { meta: 'episodes' });
            if (data) {
                // Try to get English translation if original language is not English
                if (data.originalLanguage !== 'eng') {
                    try {
                        const translation = await this.getSeriesTranslation(tvdbId, 'eng');
                        if (translation?.name) {
                            logger_1.default.info(`[TVDB] Using English translation for ${data.name} -> ${translation.name}`);
                            data.nameEnglish = translation.name;
                            data.overviewEnglish = translation.overview;
                        }
                    }
                    catch (e) {
                        logger_1.default.debug(`[TVDB] No English translation for ${tvdbId}`);
                    }
                }
            }
            return data;
        }
        catch (error) {
            logger_1.default.error(`TVDB get series ${tvdbId} failed:`, error);
            return null;
        }
    }
    /**
     * Get series episodes (all seasons)
     */
    async getSeriesEpisodes(tvdbId, seasonType = 'default') {
        try {
            const data = await this.makeRequest(`/series/${tvdbId}/episodes/${seasonType}`);
            return data?.episodes || [];
        }
        catch (error) {
            logger_1.default.error(`TVDB get episodes for ${tvdbId} failed:`, error);
            return [];
        }
    }
    /**
     * Get season details
     */
    async getSeasonDetails(tvdbId, seasonNumber) {
        try {
            // Get all episodes and filter by season
            const allEpisodes = await this.getSeriesEpisodes(tvdbId);
            const seasonEpisodes = allEpisodes.filter(ep => ep.seasonNumber === seasonNumber);
            return { episodes: seasonEpisodes };
        }
        catch (error) {
            logger_1.default.error(`TVDB get season ${seasonNumber} for ${tvdbId} failed:`, error);
            return { episodes: [] };
        }
    }
    /**
     * Get episode details
     */
    async getEpisodeDetails(episodeId) {
        try {
            const data = await this.makeRequest(`/episodes/${episodeId}/extended`);
            return data;
        }
        catch (error) {
            logger_1.default.error(`TVDB get episode ${episodeId} failed:`, error);
            return null;
        }
    }
    /**
     * Check if TVDB API is configured and working
     */
    async isConfigured() {
        try {
            await this.authenticate();
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Test the API key by searching for a known show
     */
    async testApiKey(apiKey) {
        // Temporarily use provided API key if given
        const originalToken = this.token;
        const originalExpiry = this.tokenExpiry;
        try {
            if (apiKey) {
                // Force re-authentication with new key
                this.token = '';
                this.tokenExpiry = 0;
                // Temporarily override getApiKey
                const response = await axios_1.default.post(`${TVDB_BASE_URL}/login`, {
                    apikey: apiKey
                });
                if (!response.data?.data?.token) {
                    return { success: false, message: 'Invalid API key - authentication failed' };
                }
                this.token = response.data.data.token;
                this.tokenExpiry = Date.now() + (29 * 24 * 60 * 60 * 1000);
            }
            else {
                await this.authenticate();
            }
            // Search for "Stranger Things" as a test
            const results = await this.makeRequest('/search', { query: 'Stranger Things', type: 'series' });
            if (results && results.length > 0) {
                const show = results[0];
                return {
                    success: true,
                    message: `Connected! Found: ${show.name} (${show.year || 'N/A'})`,
                    data: { name: show.name, year: show.year, id: show.tvdb_id || show.id }
                };
            }
            return { success: false, message: 'API connected but no results found' };
        }
        catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Connection failed'
            };
        }
        finally {
            // Restore original token if we were testing a different key
            if (apiKey) {
                this.token = originalToken;
                this.tokenExpiry = originalExpiry;
            }
        }
    }
}
exports.TVDBService = TVDBService;
exports.tvdbService = new TVDBService();
//# sourceMappingURL=tvdb.js.map