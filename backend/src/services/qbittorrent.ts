import axios, { AxiosInstance } from 'axios';
import db from '../config/database';
import logger from '../config/logger';

interface QBittorrentConfig {
  url: string;
  username: string;
  password: string;
}

interface TorrentInfo {
  hash: string;
  name: string;
  size: number;
  progress: number;
  dlspeed: number;
  upspeed: number;
  eta: number;
  state: string;
  category: string;
  save_path: string;
}

export class QBittorrentService {
  private client: AxiosInstance | null = null;
  private cookie: string | null = null;
  private configUrl: string | null = null;

  private getConfig(): QBittorrentConfig | null {
    try {
      const urlStmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
      const userStmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
      const passStmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
      
      const urlResult = urlStmt.get('qbittorrent_url') as { value: string } | undefined;
      const userResult = userStmt.get('qbittorrent_username') as { value: string } | undefined;
      const passResult = passStmt.get('qbittorrent_password') as { value: string } | undefined;
      
      if (!urlResult?.value || !userResult?.value || !passResult?.value) {
        return null;
      }
      
      return {
        url: urlResult.value,
        username: userResult.value,
        password: passResult.value
      };
    } catch (error) {
      logger.error('Failed to get qBittorrent config:', error);
      return null;
    }
  }

  isConfigured(): boolean {
    return this.getConfig() !== null;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
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

  private async getClient(): Promise<AxiosInstance | null> {
    const config = this.getConfig();
    if (!config) return null;

    // Reset client if URL changed
    if (this.configUrl !== config.url) {
      this.client = null;
      this.cookie = null;
      this.configUrl = config.url;
    }

    if (!this.client) {
      this.client = axios.create({
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
        const response = await this.client.post('/api/v2/auth/login', 
          `username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}`,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Referer': config.url,
              'Origin': config.url
            }
          }
        );

        // Check if login was successful
        if (response.data === 'Fails.') {
          logger.error('qBittorrent login failed: Invalid credentials');
          return null;
        }

        const setCookie = response.headers['set-cookie'];
        if (setCookie && setCookie.length > 0) {
          this.cookie = setCookie[0].split(';')[0];
          logger.info('qBittorrent login successful');
        }
      } catch (error: any) {
        logger.error('qBittorrent login failed:', error.message);
        this.cookie = null;
        return null;
      }
    }

    return this.client;
  }

  async testConnection(): Promise<{ success: boolean; message: string; version?: string }> {
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
    } catch (error: any) {
      logger.error('qBittorrent connection test failed:', error.message);
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

  async addTorrent(url: string, category: string, savePath: string): Promise<{ success: boolean; message: string }> {
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
    } catch (error: any) {
      logger.error('Failed to add torrent:', error.message);
      if (error.response?.status === 403) {
        this.cookie = null; // Reset and retry on next request
        return { success: false, message: 'Session expired or access denied. Please try again.' };
      }
      return { success: false, message: error.message || 'Failed to add torrent' };
    }
  }

  async getTorrents(category?: string): Promise<TorrentInfo[]> {
    try {
      const client = await this.getClient();
      if (!client) return [];

      const params: any = {};
      if (category) {
        params.category = category;
      }

      const response = await client.get('/api/v2/torrents/info', {
        params,
        headers: this.getHeaders()
      });

      return response.data as TorrentInfo[];
    } catch (error: any) {
      logger.error('Failed to get torrents:', error.message);
      if (error.response?.status === 403) {
        this.cookie = null; // Reset session
      }
      return [];
    }
  }

  async deleteTorrent(hash: string, deleteFiles: boolean = false): Promise<boolean> {
    try {
      const client = await this.getClient();
      if (!client) return false;

      const formData = new URLSearchParams();
      formData.append('hashes', hash);
      formData.append('deleteFiles', deleteFiles.toString());

      await client.post('/api/v2/torrents/delete', formData, {
        headers: this.getHeaders()
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to delete torrent:', error.message);
      if (error.response?.status === 403) {
        this.cookie = null;
      }
      return false;
    }
  }

  async pauseTorrent(hash: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      if (!client) return false;

      const formData = new URLSearchParams();
      formData.append('hashes', hash);

      await client.post('/api/v2/torrents/pause', formData, {
        headers: this.getHeaders()
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to pause torrent:', error.message);
      if (error.response?.status === 403) {
        this.cookie = null;
      }
      return false;
    }
  }

  async resumeTorrent(hash: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      if (!client) return false;

      const formData = new URLSearchParams();
      formData.append('hashes', hash);

      await client.post('/api/v2/torrents/resume', formData, {
        headers: this.getHeaders()
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to resume torrent:', error.message);
      if (error.response?.status === 403) {
        this.cookie = null;
      }
      return false;
    }
  }
}

export const qbittorrentService = new QBittorrentService();
