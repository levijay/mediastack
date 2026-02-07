import axios, { AxiosInstance } from 'axios';
import logger from '../config/logger';
import { DownloadClientModel, DownloadClient } from '../models/DownloadClient';

interface AddDownloadResult {
  success: boolean;
  message: string;
  downloadId?: string;
  clientId?: string;
}

interface TestResult {
  success: boolean;
  message: string;
  version?: string;
}

// qBittorrent session cookies per client
const qbSessions: Map<string, string> = new Map();

export class DownloadClientService {
  /**
   * Get all enabled download clients
   */
  getEnabledClients(): DownloadClient[] {
    return DownloadClientModel.findEnabled();
  }

  /**
   * Get the primary download client (first enabled by priority)
   */
  getPrimaryClient(type?: 'qbittorrent' | 'sabnzbd'): DownloadClient | undefined {
    const clients = this.getEnabledClients();
    if (type) {
      return clients.find(c => c.type === type);
    }
    return clients[0];
  }

  /**
   * Test connection to a download client
   */
  async testClient(client: DownloadClient): Promise<TestResult> {
    if (client.type === 'qbittorrent') {
      return this.testQBittorrent(client);
    } else if (client.type === 'sabnzbd') {
      return this.testSABnzbd(client);
    }
    return { success: false, message: 'Unknown client type' };
  }

  /**
   * Test connection with raw parameters (for testing before saving)
   */
  async testConnection(params: {
    type: 'qbittorrent' | 'sabnzbd';
    host: string;
    port: number;
    use_ssl?: boolean;
    url_base?: string;
    username?: string;
    password?: string;
    api_key?: string;
  }): Promise<TestResult> {
    const client: DownloadClient = {
      id: 'test',
      name: 'Test',
      type: params.type,
      enabled: true,
      host: params.host,
      port: params.port,
      use_ssl: params.use_ssl || false,
      url_base: params.url_base || null,
      username: params.username || null,
      password: params.password || null,
      api_key: params.api_key || null,
      category: null,
      category_movies: null,
      category_tv: null,
      priority: 1,
      remove_completed: false,
      remove_failed: false,
      tags: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return this.testClient(client);
  }

  /**
   * Add a download (torrent or NZB) to the appropriate client
   */
  async addDownload(
    url: string,
    mediaType: 'movie' | 'tv',
    savePath: string,
    clientId?: string,
    protocol?: 'torrent' | 'usenet'
  ): Promise<AddDownloadResult> {
    let client: DownloadClient | undefined;

    if (clientId) {
      client = DownloadClientModel.findById(clientId);
    } else {
      // Determine client type based on protocol
      let preferredType: 'qbittorrent' | 'sabnzbd' | undefined;
      
      if (protocol === 'torrent') {
        preferredType = 'qbittorrent';
      } else if (protocol === 'usenet') {
        preferredType = 'sabnzbd';
      } else {
        // Fallback: determine client type based on URL
        const isNzb = url.toLowerCase().includes('.nzb') || url.includes('sabnzbd') || url.includes('nzbget');
        preferredType = isNzb ? 'sabnzbd' : 'qbittorrent';
      }
      
      client = this.getPrimaryClient(preferredType) || this.getPrimaryClient();
      
      if (!client) {
        // Try the other type if preferred not found
        const otherType = preferredType === 'qbittorrent' ? 'sabnzbd' : 'qbittorrent';
        client = this.getPrimaryClient(otherType);
      }
    }

    if (!client) {
      return { success: false, message: 'No download client configured' };
    }

    // Verify we're sending to the right client type
    if (protocol === 'torrent' && client.type !== 'qbittorrent') {
      logger.warn(`[DownloadClient] Protocol is torrent but using ${client.type} client - looking for qBittorrent`);
      const qbClient = this.getPrimaryClient('qbittorrent');
      if (qbClient) {
        client = qbClient;
      }
    } else if (protocol === 'usenet' && client.type !== 'sabnzbd') {
      logger.warn(`[DownloadClient] Protocol is usenet but using ${client.type} client - looking for SABnzbd`);
      const sabClient = this.getPrimaryClient('sabnzbd');
      if (sabClient) {
        client = sabClient;
      }
    }

    // Determine the category to use based on media type
    let category: string;
    if (mediaType === 'movie') {
      category = client.category_movies || client.category || 'movies';
    } else {
      category = client.category_tv || client.category || 'tv';
    }

    logger.info(`[DownloadClient] Using ${client.type} client "${client.name}" for ${protocol || 'unknown'} download with category "${category}"`);

    let result: AddDownloadResult;
    if (client.type === 'qbittorrent') {
      result = await this.addToQBittorrent(client, url, category, savePath);
    } else if (client.type === 'sabnzbd') {
      result = await this.addToSABnzbd(client, url, category);
    } else {
      result = { success: false, message: 'Unknown client type' };
    }

    // Include the client ID in the result
    if (result.success) {
      result.clientId = client.id;
    }

    return result;
  }

  // ==================== qBittorrent ====================

  private getQBUrl(client: DownloadClient): string {
    const protocol = client.use_ssl ? 'https' : 'http';
    const base = client.url_base ? `/${client.url_base.replace(/^\//, '')}` : '';
    return `${protocol}://${client.host}:${client.port}${base}`;
  }

  private async getQBClient(client: DownloadClient): Promise<AxiosInstance | null> {
    const baseURL = this.getQBUrl(client);
    
    // Create axios client with Referer and Origin headers for CSRF protection
    const axiosClient = axios.create({ 
      baseURL, 
      timeout: 30000,
      headers: {
        'Referer': baseURL,
        'Origin': baseURL
      }
    });

    // Check if we have a valid session
    let cookie = qbSessions.get(client.id);

    if (!cookie) {
      // Login
      try {
        const response = await axiosClient.post(
          '/api/v2/auth/login',
          `username=${encodeURIComponent(client.username || '')}&password=${encodeURIComponent(client.password || '')}`,
          { 
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'Referer': baseURL,
              'Origin': baseURL
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
          cookie = setCookie[0].split(';')[0];
          qbSessions.set(client.id, cookie);
          logger.info(`qBittorrent login successful for client: ${client.name}`);
        }
      } catch (error: any) {
        if (error.response?.status === 403) {
          logger.error(`[qBittorrent] ${client.name} (${baseURL}): 403 Forbidden during login`);
          logger.error(`[qBittorrent] Fix: In qBittorrent go to Settings > Web UI > Security:`);
          logger.error(`[qBittorrent]   1. DISABLE "Enable Host header validation" (recommended)`);
          logger.error(`[qBittorrent]   OR`);
          logger.error(`[qBittorrent]   2. Add MediaStack's IP address to the whitelist`);
        } else if (error.response?.status === 401) {
          logger.error(`[qBittorrent] ${client.name}: 401 Unauthorized - Invalid username or password`);
        } else if (error.code === 'ECONNREFUSED') {
          logger.error(`[qBittorrent] ${client.name}: Connection refused - Is qBittorrent running at ${baseURL}?`);
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
          logger.error(`[qBittorrent] ${client.name}: Cannot reach ${baseURL} - Check host and port`);
        } else {
          logger.error(`[qBittorrent] ${client.name} login failed:`, error.message);
        }
        return null;
      }
    }

    // Add cookie and CSRF headers to all requests
    axiosClient.defaults.headers.common['Cookie'] = cookie || '';
    axiosClient.defaults.headers.common['Referer'] = baseURL;
    axiosClient.defaults.headers.common['Origin'] = baseURL;
    return axiosClient;
  }

  private async testQBittorrent(client: DownloadClient): Promise<TestResult> {
    try {
      // Clear session to force fresh login
      qbSessions.delete(client.id);
      
      const axiosClient = await this.getQBClient(client);
      if (!axiosClient) {
        return { success: false, message: 'Failed to connect to qBittorrent - check credentials' };
      }

      const response = await axiosClient.get('/api/v2/app/version');
      return {
        success: true,
        message: 'Connection successful',
        version: response.data
      };
    } catch (error: any) {
      logger.error('qBittorrent test failed:', error.message);
      qbSessions.delete(client.id);
      
      if (error.response?.status === 403) {
        return { 
          success: false, 
          message: 'Access denied (403). In qBittorrent Web UI settings: disable "Enable Host header validation" or add your MediaStack host to the whitelist.' 
        };
      }
      
      return { success: false, message: error.message || 'Connection failed' };
    }
  }

  private async addToQBittorrent(
    client: DownloadClient,
    url: string,
    category: string,
    savePath: string
  ): Promise<AddDownloadResult> {
    try {
      const axiosClient = await this.getQBClient(client);
      if (!axiosClient) {
        return { 
          success: false, 
          message: 'Failed to connect to qBittorrent. Check credentials and ensure qBittorrent Web UI is accessible. If you get 403 errors, disable "Host header validation" in qBittorrent Settings > Web UI > Security.' 
        };
      }

      const formData = new URLSearchParams();
      formData.append('urls', url);
      formData.append('category', category);
      
      // Only set savepath if explicitly provided, otherwise use qBittorrent's default
      if (savePath && savePath.trim()) {
        formData.append('savepath', savePath);
      }

      if (client.tags) {
        formData.append('tags', client.tags);
      }

      const response = await axiosClient.post('/api/v2/torrents/add', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.data === 'Ok.') {
        return { success: true, message: 'Torrent added successfully' };
      }

      return { success: false, message: 'Failed to add torrent' };
    } catch (error: any) {
      // Handle 403 specifically
      if (error.response?.status === 403) {
        logger.error(`[qBittorrent] ${client.name}: 403 Forbidden when adding torrent`);
        qbSessions.delete(client.id); // Clear session
        return { 
          success: false, 
          message: 'Access denied (403). In qBittorrent Web UI: Go to Settings > Web UI > Security and disable "Enable Host header validation" OR add MediaStack\'s IP to the whitelist.' 
        };
      }
      
      logger.error(`[qBittorrent] ${client.name}: Failed to add torrent - ${error.message}`);
      return { success: false, message: error.message || 'Failed to add torrent' };
    }
  }

  async getQBTorrents(clientId?: string, category?: string): Promise<any[]> {
    let client: DownloadClient | undefined;
    
    if (clientId) {
      client = DownloadClientModel.findById(clientId);
    } else {
      client = this.getPrimaryClient('qbittorrent');
    }

    if (!client) return [];

    try {
      const axiosClient = await this.getQBClient(client);
      if (!axiosClient) return [];

      const params: any = {};
      if (category) params.category = category;

      const response = await axiosClient.get('/api/v2/torrents/info', { params });
      return response.data || [];
    } catch (error: any) {
      // Session may have expired, clear it so next request re-authenticates
      qbSessions.delete(client.id);
      
      if (error.response?.status === 403) {
        logger.warn(`[qBittorrent] ${client.name}: Session expired or 403 error - will retry on next sync`);
      } else {
        logger.error(`[qBittorrent] ${client.name}: Failed to get torrents - ${error.message}`);
      }
      return [];
    }
  }

  // ==================== SABnzbd ====================

  private getSABUrl(client: DownloadClient): string {
    const protocol = client.use_ssl ? 'https' : 'http';
    const base = client.url_base ? `/${client.url_base.replace(/^\//, '')}` : '';
    return `${protocol}://${client.host}:${client.port}${base}`;
  }

  private async testSABnzbd(client: DownloadClient): Promise<TestResult> {
    try {
      const baseURL = this.getSABUrl(client);
      
      // Use 'queue' mode which requires authentication, not 'version' which doesn't
      const response = await axios.get(`${baseURL}/api`, {
        params: {
          mode: 'queue',
          limit: 1,
          apikey: client.api_key,
          output: 'json'
        },
        timeout: 10000
      });

      // If we get queue data, the API key is valid
      if (response.data?.queue !== undefined) {
        // Also get version for display
        const versionResponse = await axios.get(`${baseURL}/api`, {
          params: {
            mode: 'version',
            output: 'json'
          },
          timeout: 5000
        });
        
        return {
          success: true,
          message: 'Connection successful',
          version: versionResponse.data?.version || 'Unknown'
        };
      }

      // Check for API key error
      if (response.data?.error?.toLowerCase().includes('api')) {
        return { success: false, message: 'API key is incorrect' };
      }

      return { success: false, message: response.data?.error || 'Invalid response from SABnzbd' };
    } catch (error: any) {
      logger.error('SABnzbd test failed:', error.message);
      // Check if it's an API key error in the response
      if (error.response?.data?.error) {
        return { success: false, message: error.response.data.error };
      }
      return { success: false, message: error.message || 'Connection failed' };
    }
  }

  private async addToSABnzbd(
    client: DownloadClient,
    url: string,
    category: string
  ): Promise<AddDownloadResult> {
    try {
      const baseURL = this.getSABUrl(client);
      
      logger.info(`[SABnzbd] Adding NZB from URL: ${url}`);
      logger.info(`[SABnzbd] SABnzbd URL: ${baseURL}`);
      logger.info(`[SABnzbd] API Key (first 8 chars): ${client.api_key?.substring(0, 8)}...`);
      logger.info(`[SABnzbd] Category: ${client.category || category || 'Default'}`);
      
      // Extract filename from URL for better naming
      let filename = 'download.nzb';
      try {
        const urlObj = new URL(url);
        filename = urlObj.searchParams.get('file') || urlObj.searchParams.get('title') || 'download.nzb';
        if (!filename.endsWith('.nzb')) {
          filename += '.nzb';
        }
      } catch (e) {
        // URL parsing failed, use default
      }

      // Method 1: Fetch the NZB content ourselves and upload directly
      // This is more reliable as it avoids SABnzbd having to reach external URLs
      let nzbContent: Buffer | null = null;
      try {
        logger.info(`[SABnzbd] Fetching NZB content from indexer...`);
        
        const nzbResponse = await axios.get(url, {
          timeout: 30000,
          responseType: 'arraybuffer',
          headers: {
            'Accept': 'application/x-nzb, */*'
          }
        });
        
        nzbContent = Buffer.from(nzbResponse.data);
        logger.info(`[SABnzbd] NZB fetched (${nzbContent.length} bytes)`);
      } catch (fetchError: any) {
        logger.warn(`[SABnzbd] Failed to fetch NZB from indexer: ${fetchError.message}`);
      }

      // Try upload if we have NZB content
      if (nzbContent) {
        try {
          logger.info(`[SABnzbd] Uploading NZB to SABnzbd...`);
          
          // Upload via multipart form
          // SABnzbd requires API key in URL query params for multipart uploads
          const FormData = require('form-data');
          const formData = new FormData();
          formData.append('mode', 'addfile');
          formData.append('cat', category);
          formData.append('output', 'json');
          formData.append('nzbfile', nzbContent, {
            filename: filename,
            contentType: 'application/x-nzb'
          });
          
          // API key must be in URL for SABnzbd multipart uploads
          const uploadUrl = `${baseURL}/api?apikey=${client.api_key}`;
          
          const uploadResponse = await axios.post(uploadUrl, formData, {
            headers: formData.getHeaders(),
            timeout: 30000
          });
          
          logger.info(`[SABnzbd] Upload response:`, JSON.stringify(uploadResponse.data));
          
          if (uploadResponse.data?.status === true || uploadResponse.data?.nzo_ids?.length > 0) {
            return {
              success: true,
              message: 'NZB uploaded successfully',
              downloadId: uploadResponse.data.nzo_ids?.[0]
            };
          }
          
          // If direct upload failed, log the error
          logger.warn(`[SABnzbd] Direct upload failed: ${JSON.stringify(uploadResponse.data)}`);
        } catch (uploadError: any) {
          logger.warn(`[SABnzbd] Upload to SABnzbd failed: ${uploadError.message}`);
          if (uploadError.response) {
            logger.warn(`[SABnzbd] Response status: ${uploadError.response.status}`);
            logger.warn(`[SABnzbd] Response data: ${JSON.stringify(uploadError.response.data)}`);
          }
        }
      }

      // Method 2: Fallback - try addurl mode (let SABnzbd fetch the URL)
      logger.info(`[SABnzbd] Trying addurl fallback...`);
      
      try {
        const response = await axios.get(`${baseURL}/api`, {
          params: {
            mode: 'addurl',
            name: url,
            cat: category,
            apikey: client.api_key,
            output: 'json'
          },
          timeout: 30000
        });

        logger.info(`[SABnzbd] addurl response:`, JSON.stringify(response.data));

        if (response.data?.status === true || response.data?.nzo_ids?.length > 0) {
          return {
            success: true,
            message: 'NZB added successfully',
            downloadId: response.data.nzo_ids?.[0]
          };
        }

        return { success: false, message: response.data?.error || 'Failed to add NZB - no error message from SABnzbd' };
      } catch (urlError: any) {
        logger.error(`[SABnzbd] addurl fallback failed: ${urlError.message}`);
        if (urlError.response) {
          logger.error(`[SABnzbd] Response: ${JSON.stringify(urlError.response.data)}`);
        }
        return { success: false, message: urlError.message || 'Failed to add NZB' };
      }
    } catch (error: any) {
      logger.error('[SABnzbd] Unexpected error adding NZB:', error.message);
      return { success: false, message: error.message || 'Failed to add NZB' };
    }
  }

  async getSABQueue(clientId?: string): Promise<any> {
    let client: DownloadClient | undefined;
    
    if (clientId) {
      client = DownloadClientModel.findById(clientId);
    } else {
      client = this.getPrimaryClient('sabnzbd');
    }

    if (!client) return { slots: [] };

    try {
      const baseURL = this.getSABUrl(client);
      const response = await axios.get(`${baseURL}/api`, {
        params: {
          mode: 'queue',
          apikey: client.api_key,
          output: 'json'
        },
        timeout: 10000
      });

      return response.data?.queue || { slots: [] };
    } catch (error: any) {
      if (error.response?.status === 403) {
        logger.warn(`[SABnzbd] ${client.name}: 403 Forbidden - Check API key`);
      } else {
        logger.error(`[SABnzbd] ${client.name}: Failed to get queue - ${error.message}`);
      }
      return { slots: [] };
    }
  }

  async getSABHistory(clientId?: string): Promise<any> {
    let client: DownloadClient | undefined;
    
    if (clientId) {
      client = DownloadClientModel.findById(clientId);
    } else {
      client = this.getPrimaryClient('sabnzbd');
    }

    if (!client) return { slots: [] };

    try {
      const baseURL = this.getSABUrl(client);
      const response = await axios.get(`${baseURL}/api`, {
        params: {
          mode: 'history',
          limit: 50,
          apikey: client.api_key,
          output: 'json'
        },
        timeout: 10000
      });

      return response.data?.history || { slots: [] };
    } catch (error: any) {
      if (error.response?.status === 403) {
        logger.warn(`[SABnzbd] ${client.name}: 403 Forbidden - Check API key`);
      } else {
        logger.error(`[SABnzbd] ${client.name}: Failed to get history - ${error.message}`);
      }
      return { slots: [] };
    }
  }

  /**
   * Remove a torrent from qBittorrent
   */
  async removeTorrent(clientId: string, hash: string, deleteFiles: boolean = false): Promise<boolean> {
    const client = DownloadClientModel.findById(clientId);
    if (!client || client.type !== 'qbittorrent') {
      return false;
    }

    try {
      const axiosClient = await this.getQBClient(client);
      if (!axiosClient) return false;

      const formData = new URLSearchParams();
      formData.append('hashes', hash);
      formData.append('deleteFiles', deleteFiles ? 'true' : 'false');

      await axiosClient.post('/api/v2/torrents/delete', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      return true;
    } catch (error: any) {
      logger.error(`[qBittorrent] ${client.name}: Failed to remove torrent - ${error.message}`);
      return false;
    }
  }

  /**
   * Remove an NZB from SABnzbd
   */
  async removeNzb(clientId: string, nzoId: string, deleteFiles: boolean = false): Promise<boolean> {
    const client = DownloadClientModel.findById(clientId);
    if (!client || client.type !== 'sabnzbd') {
      return false;
    }

    try {
      const baseURL = this.getSABUrl(client);
      
      // First try to delete from queue
      const queueResponse = await axios.get(`${baseURL}/api`, {
        params: {
          mode: 'queue',
          name: 'delete',
          value: nzoId,
          del_files: deleteFiles ? 1 : 0,
          apikey: client.api_key,
          output: 'json'
        },
        timeout: 10000
      });

      if (queueResponse.data?.status === true) {
        logger.info(`[SABnzbd] Removed ${nzoId} from queue`);
        return true;
      }

      // If not in queue, try history
      const historyResponse = await axios.get(`${baseURL}/api`, {
        params: {
          mode: 'history',
          name: 'delete',
          value: nzoId,
          del_files: deleteFiles ? 1 : 0,
          apikey: client.api_key,
          output: 'json'
        },
        timeout: 10000
      });

      if (historyResponse.data?.status === true) {
        logger.info(`[SABnzbd] Removed ${nzoId} from history`);
        return true;
      }

      logger.warn(`[SABnzbd] Failed to remove ${nzoId}`);
      return false;
    } catch (error: any) {
      logger.error(`[SABnzbd] ${client.name}: Failed to remove NZB - ${error.message}`);
      return false;
    }
  }

  /**
   * Pause a torrent in qBittorrent
   */
  async pauseTorrent(clientId: string, hash: string): Promise<boolean> {
    const client = DownloadClientModel.findById(clientId);
    if (!client || client.type !== 'qbittorrent') {
      return false;
    }

    try {
      const axiosClient = await this.getQBClient(client);
      if (!axiosClient) return false;

      const formData = new URLSearchParams();
      formData.append('hashes', hash);

      await axiosClient.post('/api/v2/torrents/pause', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      return true;
    } catch (error: any) {
      logger.error(`[qBittorrent] ${client.name}: Failed to pause torrent - ${error.message}`);
      return false;
    }
  }
}

export const downloadClientService = new DownloadClientService();
