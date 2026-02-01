import axios from 'axios';
import db from '../config/database';
import logger from '../config/logger';

interface SABnzbdConfig {
  url: string;
  apiKey: string;
}

interface AddNzbResult {
  success: boolean;
  nzoId?: string;
  message?: string;
}

interface QueueItem {
  nzo_id: string;
  filename: string;
  status: string;
  percentage: string;
  mb: string;
  mbleft: string;
  timeleft: string;
  cat: string;
}

interface HistoryItem {
  nzo_id: string;
  name: string;
  status: string;
  storage: string;
  bytes: number;
  completed: number;
  category: string;
}

class SABnzbdService {
  private getConfig(): SABnzbdConfig | null {
    const urlRow = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('sabnzbd_url') as { value: string } | undefined;
    const apiKeyRow = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('sabnzbd_api_key') as { value: string } | undefined;

    if (!urlRow?.value || !apiKeyRow?.value) {
      return null;
    }

    return {
      url: urlRow.value.replace(/\/$/, ''),
      apiKey: apiKeyRow.value
    };
  }

  isConfigured(): boolean {
    return this.getConfig() !== null;
  }

  async testConnection(): Promise<{ success: boolean; message: string; version?: string }> {
    const config = this.getConfig();
    if (!config) {
      return { success: false, message: 'SABnzbd not configured' };
    }

    try {
      const response = await axios.get(`${config.url}/api`, {
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
    } catch (error: any) {
      logger.error('SABnzbd connection test failed:', error.message);
      return { success: false, message: error.message };
    }
  }

  async addNzb(downloadUrl: string, category: 'movie' | 'tv', name?: string): Promise<AddNzbResult> {
    const config = this.getConfig();
    if (!config) {
      return { success: false, message: 'SABnzbd not configured' };
    }

    try {
      // Map category to SABnzbd category
      const sabCategory = category === 'movie' ? 'movies' : 'tv';

      const params: any = {
        mode: 'addurl',
        apikey: config.apiKey,
        output: 'json',
        name: downloadUrl,
        cat: sabCategory
      };

      if (name) {
        params.nzbname = name;
      }

      logger.info(`[SABnzbd] Adding NZB: ${name || downloadUrl.substring(0, 50)}...`);

      const response = await axios.get(`${config.url}/api`, {
        params,
        timeout: 30000
      });

      if (response.data?.status === true || response.data?.nzo_ids?.length > 0) {
        const nzoId = response.data.nzo_ids?.[0];
        logger.info(`[SABnzbd] NZB added successfully: ${nzoId}`);
        return { success: true, nzoId };
      }

      const errorMsg = response.data?.error || 'Unknown error';
      logger.error(`[SABnzbd] Failed to add NZB: ${errorMsg}`);
      return { success: false, message: errorMsg };
    } catch (error: any) {
      logger.error('[SABnzbd] Add NZB error:', error.message);
      return { success: false, message: error.message };
    }
  }

  async getQueue(): Promise<QueueItem[]> {
    const config = this.getConfig();
    if (!config) return [];

    try {
      const response = await axios.get(`${config.url}/api`, {
        params: {
          mode: 'queue',
          apikey: config.apiKey,
          output: 'json'
        },
        timeout: 10000
      });

      return response.data?.queue?.slots || [];
    } catch (error: any) {
      logger.error('[SABnzbd] Get queue error:', error.message);
      return [];
    }
  }

  async getHistory(limit: number = 50): Promise<HistoryItem[]> {
    const config = this.getConfig();
    if (!config) return [];

    try {
      const response = await axios.get(`${config.url}/api`, {
        params: {
          mode: 'history',
          apikey: config.apiKey,
          output: 'json',
          limit
        },
        timeout: 10000
      });

      return response.data?.history?.slots || [];
    } catch (error: any) {
      logger.error('[SABnzbd] Get history error:', error.message);
      return [];
    }
  }

  async getCategories(): Promise<string[]> {
    const config = this.getConfig();
    if (!config) return [];

    try {
      const response = await axios.get(`${config.url}/api`, {
        params: {
          mode: 'get_cats',
          apikey: config.apiKey,
          output: 'json'
        },
        timeout: 10000
      });

      return response.data?.categories || [];
    } catch (error: any) {
      logger.error('[SABnzbd] Get categories error:', error.message);
      return [];
    }
  }

  async deleteItem(nzoId: string): Promise<boolean> {
    const config = this.getConfig();
    if (!config) return false;

    try {
      const response = await axios.get(`${config.url}/api`, {
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
    } catch (error: any) {
      logger.error('[SABnzbd] Delete item error:', error.message);
      return false;
    }
  }

  async pauseItem(nzoId: string): Promise<boolean> {
    const config = this.getConfig();
    if (!config) return false;

    try {
      const response = await axios.get(`${config.url}/api`, {
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
    } catch (error: any) {
      logger.error('[SABnzbd] Pause item error:', error.message);
      return false;
    }
  }

  async resumeItem(nzoId: string): Promise<boolean> {
    const config = this.getConfig();
    if (!config) return false;

    try {
      const response = await axios.get(`${config.url}/api`, {
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
    } catch (error: any) {
      logger.error('[SABnzbd] Resume item error:', error.message);
      return false;
    }
  }
}

export const sabnzbdService = new SABnzbdService();
