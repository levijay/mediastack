"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.omdbService = void 0;
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
const OMDB_BASE_URL = 'https://www.omdbapi.com';
class OMDBService {
    getApiKey() {
        try {
            const stmt = database_1.default.prepare('SELECT value FROM system_settings WHERE key = ?');
            const result = stmt.get('omdb_api_key');
            return result?.value || null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Get IMDB rating for a given IMDB ID
     * Returns null if OMDB API key is not configured
     */
    async getIMDBRating(imdbId) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            logger_1.default.debug('[OMDB] API key not configured, skipping IMDB rating lookup');
            return null;
        }
        try {
            const response = await axios_1.default.get(OMDB_BASE_URL, {
                params: {
                    apikey: apiKey,
                    i: imdbId,
                    type: 'movie'
                },
                timeout: 5000
            });
            if (response.data.Response === 'False') {
                logger_1.default.warn(`[OMDB] Error fetching rating for ${imdbId}: ${response.data.Error}`);
                return null;
            }
            const rating = response.data.imdbRating && response.data.imdbRating !== 'N/A'
                ? parseFloat(response.data.imdbRating)
                : null;
            const metascore = response.data.Metascore && response.data.Metascore !== 'N/A'
                ? parseInt(response.data.Metascore)
                : null;
            return {
                rating,
                votes: response.data.imdbVotes || null,
                metascore
            };
        }
        catch (error) {
            logger_1.default.error(`[OMDB] Failed to fetch rating for ${imdbId}:`, error.message);
            return null;
        }
    }
    /**
     * Check if OMDB API is configured and working
     */
    async testConnection() {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            return { success: false, message: 'OMDB API key not configured' };
        }
        try {
            // Test with a known IMDB ID (The Shawshank Redemption)
            const response = await axios_1.default.get(OMDB_BASE_URL, {
                params: {
                    apikey: apiKey,
                    i: 'tt0111161'
                },
                timeout: 5000
            });
            if (response.data.Response === 'True') {
                return { success: true, message: 'Connection successful' };
            }
            else {
                return { success: false, message: response.data.Error || 'Unknown error' };
            }
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    }
}
exports.omdbService = new OMDBService();
//# sourceMappingURL=omdb.js.map