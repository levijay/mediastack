import axios from 'axios';
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

// qBittorrent session cookies per client (clientId -> SID cookie value)
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
    // For SABnzbd: if no category is set, pass empty string so SABnzbd uses its default
    // For qBittorrent: we can use a default category name
    let category: string;
    if (mediaType === 'movie') {
      category = client.category_movies || client.category || '';
    } else {
      category = client.category_tv || client.category || '';
    }
    
    // For qBittorrent, provide a default category if none specified
    if (client.type === 'qbittorrent' && !category) {
      category = mediaType === 'movie' ? 'movies' : 'tv';
    }

    logger.info(`[DownloadClient] Using ${client.type} client "${client.name}" for ${protocol || 'unknown'} download`);
    logger.info(`[DownloadClient] Category: ${category || '(using client default)'}`);

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

  /**
   * Login to qBittorrent and get session cookie
   */
  private async qbLogin(client: DownloadClient): Promise<{ success: boolean; cookie?: string; error?: string }> {
    const baseURL = this.getQBUrl(client);
    
    try {
      logger.debug(`[qBittorrent] ${client.name}: Logging in to ${baseURL}`);
      
      const response = await axios({
        method: 'POST',
        url: `${baseURL}/api/v2/auth/login`,
        data: `username=${encodeURIComponent(client.username || '')}&password=${encodeURIComponent(client.password || '')}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': baseURL + '/'
        },
        timeout: 30000,
        validateStatus: () => true, // Don't throw on any status
        maxRedirects: 0
      });

      logger.debug(`[qBittorrent] ${client.name}: Login response status=${response.status}, data="${response.data}"`);

      // Handle various response scenarios
      if (response.status === 403) {
        return { 
          success: false, 
          error: 'Access denied (403). Check qBittorrent Web UI is enabled and accessible.' 
        };
      }

      if (response.status === 404) {
        return { 
          success: false, 
          error: 'API not found (404). Check the URL and port are correct.' 
        };
      }

      if (response.status >= 500) {
        return { 
          success: false, 
          error: `Server error (${response.status}). qBittorrent may be having issues.` 
        };
      }

      // Check login result
      if (response.data === 'Fails.') {
        return { success: false, error: 'Invalid username or password.' };
      }

      // Extract session cookie
      const setCookie = response.headers['set-cookie'];
      if (setCookie && setCookie.length > 0) {
        // Extract just the SID cookie
        const sidMatch = setCookie[0].match(/SID=([^;]+)/);
        if (sidMatch) {
          const cookie = `SID=${sidMatch[1]}`;
          logger.info(`[qBittorrent] ${client.name}: Login successful`);
          return { success: true, cookie };
        }
      }

      // Some versions return Ok. without cookie on success
      if (response.data === 'Ok.') {
        logger.warn(`[qBittorrent] ${client.name}: Login OK but no SID cookie received`);
        return { success: true, cookie: '' };
      }

      return { success: false, error: 'Unexpected response from qBittorrent' };

    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        return { success: false, error: `Connection refused. Is qBittorrent running at ${baseURL}?` };
      }
      if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        return { success: false, error: `Cannot reach ${baseURL}. Check host and port.` };
      }
      if (error.code === 'ECONNRESET') {
        return { success: false, error: `Connection reset. Check if SSL setting is correct.` };
      }
      return { success: false, error: error.message || 'Connection failed' };
    }
  }

  /**
   * Make an authenticated request to qBittorrent
   */
  private async qbRequest(
    client: DownloadClient, 
    method: 'GET' | 'POST', 
    endpoint: string, 
    data?: string,
    retryOnAuthFail: boolean = true
  ): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
    const baseURL = this.getQBUrl(client);
    
    // Get or create session
    let cookie = qbSessions.get(client.id);
    if (!cookie) {
      const loginResult = await this.qbLogin(client);
      if (!loginResult.success) {
        return { success: false, error: loginResult.error };
      }
      cookie = loginResult.cookie || '';
      if (cookie) {
        qbSessions.set(client.id, cookie);
      }
    }

    try {
      const response = await axios({
        method,
        url: `${baseURL}${endpoint}`,
        data,
        headers: {
          'Content-Type': method === 'POST' ? 'application/x-www-form-urlencoded' : undefined,
          'Cookie': cookie,
          'Referer': baseURL + '/'
        },
        timeout: 30000,
        validateStatus: () => true
      });

      // Handle auth failure - session may have expired
      if (response.status === 403 && retryOnAuthFail) {
        logger.debug(`[qBittorrent] ${client.name}: Got 403, refreshing session...`);
        qbSessions.delete(client.id);
        return this.qbRequest(client, method, endpoint, data, false);
      }

      if (response.status === 403) {
        return { success: false, error: 'Access denied (403). Session refresh failed.', status: 403 };
      }

      if (response.status >= 400) {
        return { success: false, error: `Request failed with status ${response.status}`, status: response.status };
      }

      return { success: true, data: response.data, status: response.status };

    } catch (error: any) {
      logger.error(`[qBittorrent] ${client.name}: Request to ${endpoint} failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  private async testQBittorrent(client: DownloadClient): Promise<TestResult> {
    // Clear any cached session for fresh test
    qbSessions.delete(client.id);

    // First, try to login
    const loginResult = await this.qbLogin(client);
    if (!loginResult.success) {
      return { success: false, message: loginResult.error || 'Login failed' };
    }

    // Store the session
    if (loginResult.cookie) {
      qbSessions.set(client.id, loginResult.cookie);
    }

    // Now try to get version
    const versionResult = await this.qbRequest(client, 'GET', '/api/v2/app/version');
    if (!versionResult.success) {
      return { success: false, message: versionResult.error || 'Failed to get version' };
    }

    return {
      success: true,
      message: 'Connection successful',
      version: versionResult.data
    };
  }

  private async addToQBittorrent(
    client: DownloadClient,
    url: string,
    category: string,
    savePath: string
  ): Promise<AddDownloadResult> {
    // Build form data
    const params = new URLSearchParams();
    params.append('urls', url);
    if (category) {
      params.append('category', category);
    }
    if (savePath && savePath.trim()) {
      params.append('savepath', savePath);
    }
    if (client.tags) {
      params.append('tags', client.tags);
    }

    const result = await this.qbRequest(client, 'POST', '/api/v2/torrents/add', params.toString());
    
    if (!result.success) {
      return { success: false, message: result.error || 'Failed to add torrent' };
    }

    if (result.data === 'Ok.') {
      return { success: true, message: 'Torrent added successfully' };
    }

    // qBittorrent returns empty response on success for some versions
    if (result.status === 200) {
      return { success: true, message: 'Torrent added successfully' };
    }

    return { success: false, message: 'Unexpected response when adding torrent' };
  }

  async getQBTorrents(clientId?: string, category?: string): Promise<any[]> {
    let client: DownloadClient | undefined;
    
    if (clientId) {
      client = DownloadClientModel.findById(clientId);
    } else {
      client = this.getPrimaryClient('qbittorrent');
    }

    if (!client) return [];

    const endpoint = category 
      ? `/api/v2/torrents/info?category=${encodeURIComponent(category)}`
      : '/api/v2/torrents/info';
    
    const result = await this.qbRequest(client, 'GET', endpoint);
    
    if (!result.success) {
      logger.error(`[qBittorrent] ${client.name}: Failed to get torrents - ${result.error}`);
      return [];
    }

    return result.data || [];
  }

  // ==================== SABnzbd ====================

  private getSABUrl(client: DownloadClient): string {
    const protocol = client.use_ssl ? 'https' : 'http';
    const base = client.url_base ? `/${client.url_base.replace(/^\//, '')}` : '';
    return `${protocol}://${client.host}:${client.port}${base}`;
  }

  /**
   * Get SABnzbd categories and their folder paths
   */
  async getSABCategories(client: DownloadClient): Promise<{ name: string; dir: string }[]> {
    try {
      const baseURL = this.getSABUrl(client);
      
      // First get the default download dir
      const configResponse = await axios.get(`${baseURL}/api`, {
        params: {
          mode: 'get_config',
          section: 'misc',
          apikey: client.api_key,
          output: 'json'
        },
        timeout: 10000
      });
      
      const defaultDir = configResponse.data?.config?.misc?.complete_dir || '';
      
      // Get categories
      const catsResponse = await axios.get(`${baseURL}/api`, {
        params: {
          mode: 'get_cats',
          apikey: client.api_key,
          output: 'json'
        },
        timeout: 10000
      });
      
      const categories: { name: string; dir: string }[] = [];
      
      // Add default category
      categories.push({ name: '*', dir: defaultDir });
      
      // SABnzbd returns categories as an array of strings OR as category objects
      if (Array.isArray(catsResponse.data?.categories)) {
        for (const cat of catsResponse.data.categories) {
          if (typeof cat === 'string') {
            // Simple string array - need to get full config for dir
            categories.push({ name: cat, dir: defaultDir });
          } else if (cat.name) {
            categories.push({ name: cat.name, dir: cat.dir || defaultDir });
          }
        }
      }
      
      // Also get full category config for folder paths
      const fullConfigResponse = await axios.get(`${baseURL}/api`, {
        params: {
          mode: 'get_config',
          apikey: client.api_key,
          output: 'json'
        },
        timeout: 10000
      });
      
      // Parse category folders from full config
      if (fullConfigResponse.data?.config?.categories) {
        for (const cat of fullConfigResponse.data.config.categories) {
          const existing = categories.find(c => c.name === cat.name);
          if (existing) {
            existing.dir = cat.dir || defaultDir;
          } else {
            categories.push({ name: cat.name, dir: cat.dir || defaultDir });
          }
        }
      }
      
      logger.debug(`[SABnzbd] Categories: ${JSON.stringify(categories)}`);
      return categories;
    } catch (error: any) {
      logger.error(`[SABnzbd] Failed to get categories: ${error.message}`);
      return [];
    }
  }

  private async testSABnzbd(client: DownloadClient): Promise<TestResult> {
    try {
      const baseURL = this.getSABUrl(client);
      
      // Use 'queue' mode which requires authentication
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
        // Get version
        const versionResponse = await axios.get(`${baseURL}/api`, {
          params: {
            mode: 'version',
            output: 'json'
          },
          timeout: 5000
        });
        
        // Also verify we can get categories
        const categories = await this.getSABCategories(client);
        const catNames = categories.map(c => c.name).join(', ');
        
        return {
          success: true,
          message: `Connection successful. Categories: ${catNames}`,
          version: versionResponse.data?.version || 'Unknown'
        };
      }

      if (response.data?.error?.toLowerCase().includes('api')) {
        return { success: false, message: 'API key is incorrect' };
      }

      return { success: false, message: response.data?.error || 'Invalid response from SABnzbd' };
    } catch (error: any) {
      logger.error('[SABnzbd] Test failed:', error.message);
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
      
      // Determine category to use
      // If category is empty/undefined, don't send it - SABnzbd will use its default
      const effectiveCategory = category && category.trim() ? category.trim() : undefined;
      
      logger.info(`[SABnzbd] Adding NZB to ${client.name}`);
      logger.info(`[SABnzbd] URL: ${url.substring(0, 100)}...`);
      logger.info(`[SABnzbd] Category: ${effectiveCategory || '(default)'}`);
      
      // Extract filename from URL
      let filename = 'download.nzb';
      try {
        const urlObj = new URL(url);
        filename = urlObj.searchParams.get('file') || 
                   urlObj.searchParams.get('title') || 
                   urlObj.pathname.split('/').pop() || 
                   'download.nzb';
        if (!filename.endsWith('.nzb')) {
          filename += '.nzb';
        }
        // Clean filename
        filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      } catch (e) {
        // URL parsing failed, use default
      }

      // Method 1: Fetch NZB content and upload directly (most reliable)
      let nzbContent: Buffer | null = null;
      try {
        logger.debug(`[SABnzbd] Fetching NZB from indexer...`);
        
        const nzbResponse = await axios.get(url, {
          timeout: 30000,
          responseType: 'arraybuffer',
          headers: {
            'Accept': 'application/x-nzb, */*'
          }
        });
        
        nzbContent = Buffer.from(nzbResponse.data);
        logger.debug(`[SABnzbd] NZB fetched: ${nzbContent.length} bytes`);
      } catch (fetchError: any) {
        logger.warn(`[SABnzbd] Failed to fetch NZB: ${fetchError.message}`);
      }

      // Try upload if we have NZB content
      if (nzbContent && nzbContent.length > 0) {
        try {
          const FormData = require('form-data');
          const formData = new FormData();
          formData.append('mode', 'addfile');
          formData.append('output', 'json');
          
          // Only add category if we have one - otherwise SABnzbd uses default
          if (effectiveCategory) {
            formData.append('cat', effectiveCategory);
          }
          
          formData.append('nzbfile', nzbContent, {
            filename: filename,
            contentType: 'application/x-nzb'
          });
          
          // API key must be in URL for multipart uploads
          const uploadUrl = `${baseURL}/api?apikey=${client.api_key}`;
          
          const uploadResponse = await axios.post(uploadUrl, formData, {
            headers: formData.getHeaders(),
            timeout: 30000
          });
          
          logger.debug(`[SABnzbd] Upload response: ${JSON.stringify(uploadResponse.data)}`);
          
          if (uploadResponse.data?.status === true || uploadResponse.data?.nzo_ids?.length > 0) {
            const nzoId = uploadResponse.data.nzo_ids?.[0];
            logger.info(`[SABnzbd] NZB uploaded successfully (nzo_id: ${nzoId})`);
            return {
              success: true,
              message: 'NZB added to SABnzbd',
              downloadId: nzoId
            };
          }
          
          logger.warn(`[SABnzbd] Upload response indicates failure: ${JSON.stringify(uploadResponse.data)}`);
        } catch (uploadError: any) {
          logger.warn(`[SABnzbd] Direct upload failed: ${uploadError.message}`);
        }
      }

      // Method 2: Fallback - use addurl (let SABnzbd fetch the URL)
      logger.info(`[SABnzbd] Trying addurl method...`);
      
      const params: Record<string, string> = {
        mode: 'addurl',
        name: url,
        apikey: client.api_key!,
        output: 'json'
      };
      
      // Only add category if specified
      if (effectiveCategory) {
        params.cat = effectiveCategory;
      }
      
      const response = await axios.get(`${baseURL}/api`, {
        params,
        timeout: 30000
      });

      logger.debug(`[SABnzbd] addurl response: ${JSON.stringify(response.data)}`);

      if (response.data?.status === true || response.data?.nzo_ids?.length > 0) {
        const nzoId = response.data.nzo_ids?.[0];
        logger.info(`[SABnzbd] NZB added via URL (nzo_id: ${nzoId})`);
        return {
          success: true,
          message: 'NZB added to SABnzbd',
          downloadId: nzoId
        };
      }

      const errorMsg = response.data?.error || 'SABnzbd did not accept the NZB';
      logger.error(`[SABnzbd] Failed: ${errorMsg}`);
      return { success: false, message: errorMsg };
      
    } catch (error: any) {
      logger.error(`[SABnzbd] Error adding NZB: ${error.message}`);
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

    const formData = new URLSearchParams();
    formData.append('hashes', hash);
    formData.append('deleteFiles', deleteFiles ? 'true' : 'false');

    const result = await this.qbRequest(client, 'POST', '/api/v2/torrents/delete', formData.toString());
    
    if (!result.success) {
      logger.error(`[qBittorrent] ${client.name}: Failed to remove torrent - ${result.error}`);
      return false;
    }

    return true;
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

    const formData = new URLSearchParams();
    formData.append('hashes', hash);

    const result = await this.qbRequest(client, 'POST', '/api/v2/torrents/pause', formData.toString());
    
    if (!result.success) {
      logger.error(`[qBittorrent] ${client.name}: Failed to pause torrent - ${result.error}`);
      return false;
    }

    return true;
  }
}

export const downloadClientService = new DownloadClientService();
