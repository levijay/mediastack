"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qbittorrentService = exports.QBittorrentService = void 0;
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
class QBittorrentService {
    constructor() {
        this.client = null;
        this.cookie = null;
        this.configUrl = null;
    }
    getConfig() {
        try {
            const urlStmt = database_1.default.prepare('SELECT value FROM system_settings WHERE key = ?');
            const userStmt = database_1.default.prepare('SELECT value FROM system_settings WHERE key = ?');
            const passStmt = database_1.default.prepare('SELECT value FROM system_settings WHERE key = ?');
            const urlResult = urlStmt.get('qbittorrent_url');
            const userResult = userStmt.get('qbittorrent_username');
            const passResult = passStmt.get('qbittorrent_password');
            if (!urlResult?.value || !userResult?.value || !passResult?.value) {
                return null;
            }
            return {
                url: urlResult.value,
                username: userResult.value,
                password: passResult.value
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get qBittorrent config:', error);
            return null;
        }
    }
    isConfigured() {
        return this.getConfig() !== null;
    }
    getHeaders() {
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        if (this.cookie) {
            headers['Cookie'] = this.cookie;
        }
        // Add Referer and Origin headers to prevent 403 CSRF errors
        if (this.configUrl) {
            headers['Referer'] = this.configUrl;
            headers['Origin'] = this.configUrl;
        }
        return headers;
    }
    async getClient() {
        const config = this.getConfig();
        if (!config)
            return null;
        // Reset client if URL changed
        if (this.configUrl !== config.url) {
            this.client = null;
            this.cookie = null;
            this.configUrl = config.url;
        }
        if (!this.client) {
            this.client = axios_1.default.create({
                baseURL: config.url,
                timeout: 30000,
                // Set default headers for all requests
                headers: {
                    'Referer': config.url,
                    'Origin': config.url
                }
            });
        }
        // Login if no cookie
        if (!this.cookie) {
            try {
                const response = await this.client.post('/api/v2/auth/login', `username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}`, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': config.url,
                        'Origin': config.url
                    }
                });
                // Check if login was successful
                if (response.data === 'Fails.') {
                    logger_1.default.error('qBittorrent login failed: Invalid credentials');
                    return null;
                }
                const setCookie = response.headers['set-cookie'];
                if (setCookie && setCookie.length > 0) {
                    this.cookie = setCookie[0].split(';')[0];
                    logger_1.default.info('qBittorrent login successful');
                }
            }
            catch (error) {
                logger_1.default.error('qBittorrent login failed:', error.message);
                this.cookie = null;
                return null;
            }
        }
        return this.client;
    }
    async testConnection() {
        try {
            // Reset session to force fresh login
            this.cookie = null;
            const client = await this.getClient();
            if (!client) {
                return { success: false, message: 'qBittorrent not configured or login failed' };
            }
            const response = await client.get('/api/v2/app/version', {
                headers: this.getHeaders()
            });
            return {
                success: true,
                message: 'Connection successful',
                version: response.data
            };
        }
        catch (error) {
            logger_1.default.error('qBittorrent connection test failed:', error.message);
            this.cookie = null; // Reset cookie
            if (error.response?.status === 403) {
                return {
                    success: false,
                    message: 'Access denied (403). Check qBittorrent Web UI settings: disable "Enable Host header validation" or add your host to the whitelist.'
                };
            }
            return {
                success: false,
                message: error.message || 'Connection failed'
            };
        }
    }
    async addTorrent(url, category, savePath) {
        try {
            const client = await this.getClient();
            if (!client) {
                return { success: false, message: 'qBittorrent not configured' };
            }
            const formData = new URLSearchParams();
            formData.append('urls', url);
            formData.append('category', category);
            formData.append('savepath', savePath);
            const response = await client.post('/api/v2/torrents/add', formData, {
                headers: this.getHeaders()
            });
            if (response.data === 'Ok.') {
                return { success: true, message: 'Torrent added successfully' };
            }
            return { success: false, message: 'Failed to add torrent' };
        }
        catch (error) {
            logger_1.default.error('Failed to add torrent:', error.message);
            if (error.response?.status === 403) {
                this.cookie = null; // Reset and retry on next request
                return { success: false, message: 'Session expired or access denied. Please try again.' };
            }
            return { success: false, message: error.message || 'Failed to add torrent' };
        }
    }
    async getTorrents(category) {
        try {
            const client = await this.getClient();
            if (!client)
                return [];
            const params = {};
            if (category) {
                params.category = category;
            }
            const response = await client.get('/api/v2/torrents/info', {
                params,
                headers: this.getHeaders()
            });
            return response.data;
        }
        catch (error) {
            logger_1.default.error('Failed to get torrents:', error.message);
            if (error.response?.status === 403) {
                this.cookie = null; // Reset session
            }
            return [];
        }
    }
    async deleteTorrent(hash, deleteFiles = false) {
        try {
            const client = await this.getClient();
            if (!client)
                return false;
            const formData = new URLSearchParams();
            formData.append('hashes', hash);
            formData.append('deleteFiles', deleteFiles.toString());
            await client.post('/api/v2/torrents/delete', formData, {
                headers: this.getHeaders()
            });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to delete torrent:', error.message);
            if (error.response?.status === 403) {
                this.cookie = null;
            }
            return false;
        }
    }
    async pauseTorrent(hash) {
        try {
            const client = await this.getClient();
            if (!client)
                return false;
            const formData = new URLSearchParams();
            formData.append('hashes', hash);
            await client.post('/api/v2/torrents/pause', formData, {
                headers: this.getHeaders()
            });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to pause torrent:', error.message);
            if (error.response?.status === 403) {
                this.cookie = null;
            }
            return false;
        }
    }
    async resumeTorrent(hash) {
        try {
            const client = await this.getClient();
            if (!client)
                return false;
            const formData = new URLSearchParams();
            formData.append('hashes', hash);
            await client.post('/api/v2/torrents/resume', formData, {
                headers: this.getHeaders()
            });
            return true;
        }
        catch (error) {
            logger_1.default.error('Failed to resume torrent:', error.message);
            if (error.response?.status === 403) {
                this.cookie = null;
            }
            return false;
        }
    }
}
exports.QBittorrentService = QBittorrentService;
exports.qbittorrentService = new QBittorrentService();
//# sourceMappingURL=qbittorrent.js.map