"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sabnzbdService = void 0;
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
class SABnzbdService {
    getConfig() {
        const urlRow = database_1.default.prepare('SELECT value FROM system_settings WHERE key = ?').get('sabnzbd_url');
        const apiKeyRow = database_1.default.prepare('SELECT value FROM system_settings WHERE key = ?').get('sabnzbd_api_key');
        if (!urlRow?.value || !apiKeyRow?.value) {
            return null;
        }
        return {
            url: urlRow.value.replace(/\/$/, ''),
            apiKey: apiKeyRow.value
        };
    }
    isConfigured() {
        return this.getConfig() !== null;
    }
    async testConnection() {
        const config = this.getConfig();
        if (!config) {
            return { success: false, message: 'SABnzbd not configured' };
        }
        try {
            const response = await axios_1.default.get(`${config.url}/api`, {
                params: {
                    mode: 'version',
                    apikey: config.apiKey,
                    output: 'json'
                },
                timeout: 10000
            });
            if (response.data?.version) {
                return { success: true, message: 'Connected', version: response.data.version };
            }
            return { success: false, message: 'Invalid response from SABnzbd' };
        }
        catch (error) {
            logger_1.default.error('SABnzbd connection test failed:', error.message);
            return { success: false, message: error.message };
        }
    }
    async addNzb(downloadUrl, category, name) {
        const config = this.getConfig();
        if (!config) {
            return { success: false, message: 'SABnzbd not configured' };
        }
        try {
            // Map category to SABnzbd category
            const sabCategory = category === 'movie' ? 'movies' : 'tv';
            const params = {
                mode: 'addurl',
                apikey: config.apiKey,
                output: 'json',
                name: downloadUrl,
                cat: sabCategory
            };
            if (name) {
                params.nzbname = name;
            }
            logger_1.default.info(`[SABnzbd] Adding NZB: ${name || downloadUrl.substring(0, 50)}...`);
            const response = await axios_1.default.get(`${config.url}/api`, {
                params,
                timeout: 30000
            });
            if (response.data?.status === true || response.data?.nzo_ids?.length > 0) {
                const nzoId = response.data.nzo_ids?.[0];
                logger_1.default.info(`[SABnzbd] NZB added successfully: ${nzoId}`);
                return { success: true, nzoId };
            }
            const errorMsg = response.data?.error || 'Unknown error';
            logger_1.default.error(`[SABnzbd] Failed to add NZB: ${errorMsg}`);
            return { success: false, message: errorMsg };
        }
        catch (error) {
            logger_1.default.error('[SABnzbd] Add NZB error:', error.message);
            return { success: false, message: error.message };
        }
    }
    async getQueue() {
        const config = this.getConfig();
        if (!config)
            return [];
        try {
            const response = await axios_1.default.get(`${config.url}/api`, {
                params: {
                    mode: 'queue',
                    apikey: config.apiKey,
                    output: 'json'
                },
                timeout: 10000
            });
            return response.data?.queue?.slots || [];
        }
        catch (error) {
            logger_1.default.error('[SABnzbd] Get queue error:', error.message);
            return [];
        }
    }
    async getHistory(limit = 50) {
        const config = this.getConfig();
        if (!config)
            return [];
        try {
            const response = await axios_1.default.get(`${config.url}/api`, {
                params: {
                    mode: 'history',
                    apikey: config.apiKey,
                    output: 'json',
                    limit
                },
                timeout: 10000
            });
            return response.data?.history?.slots || [];
        }
        catch (error) {
            logger_1.default.error('[SABnzbd] Get history error:', error.message);
            return [];
        }
    }
    async getCategories() {
        const config = this.getConfig();
        if (!config)
            return [];
        try {
            const response = await axios_1.default.get(`${config.url}/api`, {
                params: {
                    mode: 'get_cats',
                    apikey: config.apiKey,
                    output: 'json'
                },
                timeout: 10000
            });
            return response.data?.categories || [];
        }
        catch (error) {
            logger_1.default.error('[SABnzbd] Get categories error:', error.message);
            return [];
        }
    }
    async deleteItem(nzoId) {
        const config = this.getConfig();
        if (!config)
            return false;
        try {
            const response = await axios_1.default.get(`${config.url}/api`, {
                params: {
                    mode: 'queue',
                    name: 'delete',
                    value: nzoId,
                    apikey: config.apiKey,
                    output: 'json'
                },
                timeout: 10000
            });
            return response.data?.status === true;
        }
        catch (error) {
            logger_1.default.error('[SABnzbd] Delete item error:', error.message);
            return false;
        }
    }
    async pauseItem(nzoId) {
        const config = this.getConfig();
        if (!config)
            return false;
        try {
            const response = await axios_1.default.get(`${config.url}/api`, {
                params: {
                    mode: 'queue',
                    name: 'pause',
                    value: nzoId,
                    apikey: config.apiKey,
                    output: 'json'
                },
                timeout: 10000
            });
            return response.data?.status === true;
        }
        catch (error) {
            logger_1.default.error('[SABnzbd] Pause item error:', error.message);
            return false;
        }
    }
    async resumeItem(nzoId) {
        const config = this.getConfig();
        if (!config)
            return false;
        try {
            const response = await axios_1.default.get(`${config.url}/api`, {
                params: {
                    mode: 'queue',
                    name: 'resume',
                    value: nzoId,
                    apikey: config.apiKey,
                    output: 'json'
                },
                timeout: 10000
            });
            return response.data?.status === true;
        }
        catch (error) {
            logger_1.default.error('[SABnzbd] Resume item error:', error.message);
            return false;
        }
    }
}
exports.sabnzbdService = new SABnzbdService();
//# sourceMappingURL=sabnzbd.js.map