import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { indexerService } from '../services/indexer';
import { qbittorrentService } from '../services/qbittorrent';
import { downloadClientService } from '../services/downloadClient';
import { downloadSyncService } from '../services/downloadSync';
import { notificationService } from '../services/notification';
import { DownloadModel } from '../models/Download';
import { MovieModel } from '../models/Movie';
import { TVSeriesModel } from '../models/TVSeries';
import { DownloadClientModel } from '../models/DownloadClient';
import { ActivityLogModel, EVENT_TYPES } from '../models/ActivityLog';
import logger from '../config/logger';
import db from '../config/database';

export class AutomationController {
  // Indexer management
  static async getIndexers(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const indexers = await indexerService.getAllIndexers();
      return res.json(indexers);
    } catch (error) {
      logger.error('Get indexers error:', error);
      return res.status(500).json({ error: 'Failed to get indexers' });
    }
  }

  // Get indexer status for regular users (no sensitive data)
  static async getIndexerStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const indexers = await indexerService.getIndexers();
      return res.json({
        configured: indexers.length,
        indexers: indexers.map(i => ({ name: i.name, type: i.type }))
      });
    } catch (error) {
      logger.error('Get indexer status error:', error);
      return res.status(500).json({ error: 'Failed to get indexer status' });
    }
  }

  static async addIndexer(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { name, type, url, apiKey, enabled, enableRss, enableAutomaticSearch, enableInteractiveSearch } = req.body;

      if (!name || !type || !url || !apiKey) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const indexer = await indexerService.addIndexer({
        name,
        type,
        url,
        apiKey,
        enabled: enabled !== false,
        enableRss: enableRss !== false,
        enableAutomaticSearch: enableAutomaticSearch !== false,
        enableInteractiveSearch: enableInteractiveSearch !== false
      });

      logger.info(`Indexer added: ${name} by ${req.user.username}`);
      return res.status(201).json(indexer);
    } catch (error) {
      logger.error('Add indexer error:', error);
      return res.status(500).json({ error: 'Failed to add indexer' });
    }
  }

  static async updateIndexer(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { name, type, url, apiKey, enabled, enableRss, enableAutomaticSearch, enableInteractiveSearch } = req.body;

      const indexer = await indexerService.updateIndexer(id, {
        name,
        type,
        url,
        apiKey,
        enabled,
        enableRss,
        enableAutomaticSearch,
        enableInteractiveSearch
      });

      if (!indexer) {
        return res.status(404).json({ error: 'Indexer not found' });
      }

      logger.info(`Indexer updated: ${id} by ${req.user.username}`);
      return res.json(indexer);
    } catch (error) {
      logger.error('Update indexer error:', error);
      return res.status(500).json({ error: 'Failed to update indexer' });
    }
  }

  static async deleteIndexer(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      
      const deleted = await indexerService.deleteIndexer(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Indexer not found' });
      }

      logger.info(`Indexer deleted: ${id} by ${req.user.username}`);
      return res.json({ message: 'Indexer deleted' });
    } catch (error) {
      logger.error('Delete indexer error:', error);
      return res.status(500).json({ error: 'Failed to delete indexer' });
    }
  }

  static async testIndexer(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { url, apiKey, type } = req.body;

      if (!url || !apiKey || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await indexerService.testIndexer(url, apiKey, type);
      return res.json(result);
    } catch (error) {
      logger.error('Test indexer error:', error);
      return res.status(500).json({ error: 'Failed to test indexer' });
    }
  }

  static async previewRss(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const indexer = await indexerService.getIndexerById(id);
      
      if (!indexer) {
        return res.status(404).json({ error: 'Indexer not found' });
      }

      if (!indexer.enableRss) {
        return res.status(400).json({ error: 'RSS is not enabled for this indexer' });
      }

      const releases = await indexerService.fetchRss(indexer);
      
      // Helper to parse quality info from title
      const parseQualityInfo = (title: string) => {
        const resMatch = title.match(/\b(2160p|1080p|720p|480p|4K|UHD)\b/i);
        const qualityMatch = title.match(/\b(WEB-?DL|WEBDL|WEBRip|BluRay|BDRip|HDRip|HDTV|DVDRip|CAM|TELESYNC|TS|Remux)\b/i);
        const codecMatch = title.match(/\b(x264|x265|H\.?264|H\.?265|HEVC|AVC|XviD|DivX)\b/i);
        return {
          resolution: resMatch ? resMatch[1].toUpperCase() : null,
          quality: qualityMatch ? qualityMatch[1].toUpperCase().replace('WEBDL', 'WEB-DL') : null,
          codec: codecMatch ? codecMatch[1].toUpperCase().replace(/\./g, '') : null
        };
      };

      // Return limited preview with relevant fields
      const preview = releases.slice(0, 25).map(r => {
        const parsed = parseQualityInfo(r.title);
        return {
          title: r.title,
          size: r.size,
          seeders: r.seeders,
          leechers: r.leechers,
          indexer: r.indexer,
          publishDate: r.publishDate,
          quality: parsed.quality || r.quality,
          codec: parsed.codec,
          resolution: parsed.resolution
        };
      });

      return res.json({
        success: true,
        count: releases.length,
        preview
      });
    } catch (error: any) {
      logger.error('Preview RSS error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch RSS' });
    }
  }

  // Download client management
  static async testQBittorrent(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await qbittorrentService.testConnection();
      return res.json(result);
    } catch (error) {
      logger.error('Test qBittorrent error:', error);
      return res.status(500).json({ error: 'Failed to test connection' });
    }
  }

  static async testQBittorrentWithParams(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { url, username, password } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      // Test connection with provided params
      const axios = require('axios');
      try {
        // Try to login with Referer and Origin headers to prevent 403 CSRF errors
        const loginResponse = await axios.post(`${url}/api/v2/auth/login`, 
          `username=${encodeURIComponent(username || '')}&password=${encodeURIComponent(password || '')}`,
          {
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'Referer': url,
              'Origin': url
            },
            timeout: 10000
          }
        );
        
        if (loginResponse.data === 'Fails.') {
          return res.json({ success: false, message: 'Invalid credentials' });
        }
        
        if (loginResponse.data === 'Ok.' || loginResponse.status === 200) {
          return res.json({ success: true, message: 'Connection successful!' });
        } else {
          return res.json({ success: false, message: 'Invalid credentials' });
        }
      } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
          return res.json({ success: false, message: 'Connection refused - is qBittorrent running?' });
        }
        if (error.code === 'ENOTFOUND') {
          return res.json({ success: false, message: 'Host not found' });
        }
        if (error.response?.status === 403) {
          return res.json({ 
            success: false, 
            message: 'Access denied (403). In qBittorrent Web UI settings: disable "Enable Host header validation" or add your MediaStack host to the whitelist.' 
          });
        }
        return res.json({ success: false, message: error.message || 'Connection failed' });
      }
    } catch (error) {
      logger.error('Test qBittorrent error:', error);
      return res.status(500).json({ error: 'Failed to test connection' });
    }
  }

  static async testSabnzbd(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { url, apiKey } = req.body;
      
      if (!url || !apiKey) {
        return res.status(400).json({ error: 'URL and API key are required' });
      }

      // Test SABnzbd connection
      const axios = require('axios');
      try {
        const response = await axios.get(`${url}/api`, {
          params: {
            mode: 'version',
            apikey: apiKey,
            output: 'json'
          },
          timeout: 10000
        });
        
        if (response.data && response.data.version) {
          return res.json({ success: true, message: `Connected! SABnzbd v${response.data.version}` });
        } else if (response.data && response.data.error) {
          return res.json({ success: false, message: response.data.error });
        } else {
          return res.json({ success: false, message: 'Invalid response from SABnzbd' });
        }
      } catch (error: any) {
        if (error.code === 'ECONNREFUSED') {
          return res.json({ success: false, message: 'Connection refused - is SABnzbd running?' });
        }
        if (error.code === 'ENOTFOUND') {
          return res.json({ success: false, message: 'Host not found' });
        }
        return res.json({ success: false, message: error.message || 'Connection failed' });
      }
    } catch (error) {
      logger.error('Test SABnzbd error:', error);
      return res.status(500).json({ error: 'Failed to test connection' });
    }
  }

  // Get SABnzbd categories
  static async getSabnzbdCategories(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { url, apiKey } = req.body;
      
      if (!url || !apiKey) {
        return res.status(400).json({ error: 'URL and API key are required' });
      }

      const axios = require('axios');
      
      // Get default download directory
      const configResponse = await axios.get(`${url}/api`, {
        params: {
          mode: 'get_config',
          section: 'misc',
          apikey: apiKey,
          output: 'json'
        },
        timeout: 10000
      });
      
      const defaultDir = configResponse.data?.config?.misc?.complete_dir || '';
      
      // Get full config with categories
      const fullConfigResponse = await axios.get(`${url}/api`, {
        params: {
          mode: 'get_config',
          apikey: apiKey,
          output: 'json'
        },
        timeout: 10000
      });
      
      const categories: { name: string; dir: string }[] = [];
      
      // Add default category
      categories.push({ name: 'Default (*)', dir: defaultDir || '(SABnzbd default)' });
      
      // Parse categories from config
      if (fullConfigResponse.data?.config?.categories) {
        for (const cat of fullConfigResponse.data.config.categories) {
          if (cat.name && cat.name !== '*') {
            categories.push({ 
              name: cat.name, 
              dir: cat.dir || defaultDir || '(inherits default)' 
            });
          }
        }
      }
      
      return res.json({ success: true, categories });
    } catch (error: any) {
      logger.error('Get SABnzbd categories error:', error);
      return res.json({ success: false, message: error.message || 'Failed to get categories', categories: [] });
    }
  }

  // Search for releases
  static async searchReleases(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { title, year, type, season, episode } = req.query;

      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title required' });
      }

      // This is an interactive/manual search from the UI
      let results;
      if (type === 'tv') {
        const seasonNum = season ? parseInt(season as string) : undefined;
        const episodeNum = episode ? parseInt(episode as string) : undefined;
        results = await indexerService.searchTV(title, seasonNum, episodeNum, 'interactive');
      } else {
        const yearNum = year ? parseInt(year as string) : undefined;
        results = await indexerService.searchMovie(title, yearNum, 'interactive');
      }

      return res.json(results);
    } catch (error) {
      logger.error('Search releases error:', error);
      return res.status(500).json({ error: 'Failed to search releases' });
    }
  }

  // Start download
  static async startDownload(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { movieId, seriesId, seasonNumber, episodeNumber, downloadUrl, title, size, seeders, indexer, protocol, quality, downloadClientId } = req.body;

      if (!downloadUrl || !title) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check for duplicate download by URL
      const existingByUrl = DownloadModel.findByDownloadUrl(downloadUrl);
      if (existingByUrl) {
        logger.warn(`[Download] Duplicate download detected by URL: "${title}"`);
        return res.status(409).json({ 
          error: 'This release is already being downloaded',
          existingDownload: existingByUrl
        });
      }

      // Determine media type and validate library item
      let mediaType: 'movie' | 'tv' = 'movie';
      let movie;
      let series;

      if (movieId) {
        movie = MovieModel.findById(movieId);
        if (!movie) {
          return res.status(404).json({ error: 'Movie not found in library' });
        }
        mediaType = 'movie';

        // Check for existing active download for this movie
        const existingDownload = DownloadModel.findActiveByMovieId(movieId);
        if (existingDownload) {
          logger.warn(`[Download] Active download already exists for movie: ${movie.title}`);
          return res.status(409).json({ 
            error: 'An active download already exists for this movie',
            existingDownload
          });
        }
      } else if (seriesId) {
        series = TVSeriesModel.findById(seriesId);
        if (!series) {
          return res.status(404).json({ error: 'Series not found in library' });
        }
        mediaType = 'tv';

        // Check for existing active download for this episode
        if (seasonNumber !== undefined && episodeNumber !== undefined) {
          const existingDownload = DownloadModel.findActiveByEpisode(seriesId, seasonNumber, episodeNumber);
          if (existingDownload) {
            logger.warn(`[Download] Active download already exists for episode S${seasonNumber}E${episodeNumber}`);
            return res.status(409).json({ 
              error: 'An active download already exists for this episode',
              existingDownload
            });
          }
        }
      }

      // Create download record
      const download = DownloadModel.create({
        movie_id: movieId,
        series_id: seriesId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        media_type: mediaType,
        title,
        download_url: downloadUrl,
        size,
        seeders,
        indexer,
        quality
      });

      // Determine save path - empty string lets qBittorrent use its default
      const savePath = '';

      // Add to download client using unified service
      // Use protocol to pick the right client (torrent=qbittorrent, usenet=sabnzbd)
      logger.info(`[Download] Starting download: "${title}" via ${protocol || 'unknown'} protocol`);
      const addResult = await downloadClientService.addDownload(
        downloadUrl, 
        mediaType, 
        savePath,
        downloadClientId,
        protocol
      );

      if (!addResult.success) {
        DownloadModel.updateStatus(download.id, 'failed');
        return res.status(500).json({ error: addResult.message });
      }

      // Store the client used
      if (addResult.clientId) {
        DownloadModel.updateDownloadClient(download.id, addResult.clientId);
      }

      // Store the download ID (torrent hash or NZB nzo_id)
      if (addResult.downloadId) {
        DownloadModel.updateTorrentHash(download.id, addResult.downloadId);
        logger.info(`[Download] Stored download ID: ${addResult.downloadId}`);
      }

      // For torrents, wait and try to find the hash if not returned
      if (protocol === 'torrent' && !addResult.downloadId) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          const usedClientId = addResult.clientId || downloadClientId;
          const torrents = await downloadClientService.getQBTorrents(usedClientId, mediaType);
          // Match by title
          const torrent = torrents.find((t: any) => 
            t.name.toLowerCase().includes(title.toLowerCase().substring(0, 20))
          );
          
          if (torrent) {
            DownloadModel.updateTorrentHash(download.id, torrent.hash);
            logger.info(`[Download] Found torrent hash: ${torrent.hash}`);
          }
        } catch (error) {
          logger.warn('Could not find torrent hash:', error);
        }
      }

      // Update download status
      DownloadModel.updateStatus(download.id, 'downloading');
      DownloadModel.updateSavePath(download.id, savePath);

      // Log activity: Release Grabbed
      if (movieId && movie) {
        ActivityLogModel.logMovieEvent(
          movieId,
          EVENT_TYPES.GRABBED,
          `${title} grabbed from ${indexer}`,
          JSON.stringify({
            indexer,
            quality,
            size: size ? `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Unknown',
            seeders,
            protocol: protocol || 'torrent'
          })
        );
        // Send notification
        notificationService.notify({
          event: 'onGrab',
          title: 'Release Grabbed',
          message: `${title} grabbed from ${indexer}`,
          mediaType: 'movie',
          mediaTitle: movie.title
        }).catch(err => logger.error('Notification error:', err));
      } else if (seriesId && series) {
        ActivityLogModel.logSeriesEvent(
          seriesId,
          EVENT_TYPES.GRABBED,
          `${title} grabbed from ${indexer}`,
          JSON.stringify({
            indexer,
            quality,
            size: size ? `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Unknown',
            seeders,
            protocol: protocol || 'torrent',
            season: seasonNumber,
            episode: episodeNumber
          })
        );
        // Send notification
        notificationService.notify({
          event: 'onGrab',
          title: 'Release Grabbed',
          message: `${title} grabbed from ${indexer}`,
          mediaType: 'series',
          mediaTitle: series.title
        }).catch(err => logger.error('Notification error:', err));
      }

      logger.info(`Download started: ${title} by ${req.user.username}`);

      return res.status(201).json(download);
    } catch (error) {
      logger.error('Start download error:', error);
      return res.status(500).json({ error: 'Failed to start download' });
    }
  }

  // Get downloads
  static async getDownloads(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { status, limit = 50, offset = 0 } = req.query;

      // Query downloads with poster info and file status from movies/tv_series
      let query = `
        SELECT 
          d.*,
          COALESCE(m.poster_path, s.poster_path) as poster_path,
          CASE 
            WHEN d.media_type = 'movie' AND m.id IS NOT NULL THEN m.has_file
            WHEN d.media_type = 'tv' AND e.id IS NOT NULL THEN e.has_file
            ELSE NULL
          END as media_has_file
        FROM downloads d
        LEFT JOIN movies m ON d.movie_id = m.id
        LEFT JOIN tv_series s ON d.series_id = s.id
        LEFT JOIN episodes e ON d.series_id = e.series_id 
          AND d.season_number = e.season_number 
          AND d.episode_number = e.episode_number
      `;
      
      const params: any[] = [];
      
      if (status && typeof status === 'string') {
        query += ' WHERE d.status = ?';
        params.push(status);
      }
      
      query += ' ORDER BY d.created_at DESC';
      
      if (!status) {
        query += ' LIMIT ? OFFSET ?';
        params.push(Number(limit), Number(offset));
      }

      const downloads = db.prepare(query).all(...params);

      // Fetch all download clients to map names
      const clients = DownloadClientModel.findAll();
      const clientMap = new Map(clients.map(c => [c.id, c.name]));

      // Add client name and import warning to each download
      const downloadsWithClientName = downloads.map((d: any) => {
        // Check if completed but file not found in library, or if failed with error
        const importWarning = (d.status === 'completed' && d.media_has_file === 0) || 
                              (d.status === 'failed' && d.error_message);
        
        return {
          ...d,
          download_client_name: d.download_client_id ? clientMap.get(d.download_client_id) || 'Unknown' : null,
          import_warning: importWarning
        };
      });

      return res.json(downloadsWithClientName);
    } catch (error) {
      logger.error('Get downloads error:', error);
      return res.status(500).json({ error: 'Failed to get downloads' });
    }
  }

  // Update download progress (called by background task or frontend polling)
  static async syncDownloads(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const result = await downloadSyncService.syncAllDownloads();
      return res.json({ 
        message: 'Downloads synced',
        synced: result.synced,
        completed: result.completed,
        failed: result.failed
      });
    } catch (error) {
      logger.error('Sync downloads error:', error);
      return res.status(500).json({ error: 'Failed to sync downloads' });
    }
  }

  // Cancel a download
  static async cancelDownload(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { deleteFiles } = req.body;

      const success = await downloadSyncService.cancelDownload(id, deleteFiles === true);
      
      if (success) {
        return res.json({ message: 'Download cancelled' });
      } else {
        return res.status(404).json({ error: 'Download not found' });
      }
    } catch (error) {
      logger.error('Cancel download error:', error);
      return res.status(500).json({ error: 'Failed to cancel download' });
    }
  }

  // Clear completed or failed downloads
  static async clearDownloads(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { status } = req.query;
      const validStatuses = ['completed', 'failed', 'queued', 'all'];
      
      if (!validStatuses.includes(status as string)) {
        return res.status(400).json({ error: 'Status must be "completed", "failed", "queued", or "all"' });
      }

      let downloads;
      if (status === 'all') {
        // Clear all downloads except currently downloading/importing
        const completedDownloads = DownloadModel.findByStatus('completed');
        const failedDownloads = DownloadModel.findByStatus('failed');
        const queuedDownloads = DownloadModel.findByStatus('queued');
        downloads = [...completedDownloads, ...failedDownloads, ...queuedDownloads];
      } else {
        downloads = DownloadModel.findByStatus(status as string);
      }
      
      let cleared = 0;

      for (const download of downloads) {
        DownloadModel.delete(download.id);
        cleared++;
      }

      const statusLabel = status === 'all' ? '' : `${status} `;
      logger.info(`Cleared ${cleared} ${statusLabel}downloads by ${req.user.username}`);
      return res.json({ message: `Cleared ${cleared} ${statusLabel}downloads`, cleared });
    } catch (error) {
      logger.error('Clear downloads error:', error);
      return res.status(500).json({ error: 'Failed to clear downloads' });
    }
  }

  // Download Clients CRUD
  static async getDownloadClients(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { DownloadClientModel } = require('../models/DownloadClient');
      const clients = DownloadClientModel.findAll();
      
      // Don't send passwords/api_keys in full
      const safeClients = clients.map((c: any) => ({
        ...c,
        password: c.password ? '••••••••' : null,
        api_key: c.api_key ? '••••••••' : null
      }));
      
      return res.json(safeClients);
    } catch (error) {
      logger.error('Get download clients error:', error);
      return res.status(500).json({ error: 'Failed to get download clients' });
    }
  }

  static async addDownloadClient(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { name, type, enabled, host, port, use_ssl, url_base, username, password, api_key, category, category_movies, category_tv, priority, remove_completed, remove_failed, tags } = req.body;

      if (!name || !type || !host || !port) {
        return res.status(400).json({ error: 'Missing required fields: name, type, host, port' });
      }

      if (!['qbittorrent', 'sabnzbd'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be qbittorrent or sabnzbd' });
      }

      const { DownloadClientModel } = require('../models/DownloadClient');
      const client = DownloadClientModel.create({
        name, type, enabled, host, port: parseInt(port), use_ssl, url_base,
        username, password, api_key, category, category_movies, category_tv, priority, remove_completed, remove_failed, tags
      });

      logger.info(`Download client added: ${name} (${type}) by ${req.user.username}`);
      return res.status(201).json(client);
    } catch (error) {
      logger.error('Add download client error:', error);
      return res.status(500).json({ error: 'Failed to add download client' });
    }
  }

  static async updateDownloadClient(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const updates = req.body;

      // Don't update password/api_key if they're the masked value
      if (updates.password === '••••••••') delete updates.password;
      if (updates.api_key === '••••••••') delete updates.api_key;

      const { DownloadClientModel } = require('../models/DownloadClient');
      const client = DownloadClientModel.update(id, updates);

      if (!client) {
        return res.status(404).json({ error: 'Download client not found' });
      }

      logger.info(`Download client updated: ${client.name} by ${req.user.username}`);
      return res.json(client);
    } catch (error) {
      logger.error('Update download client error:', error);
      return res.status(500).json({ error: 'Failed to update download client' });
    }
  }

  static async deleteDownloadClient(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { DownloadClientModel } = require('../models/DownloadClient');
      const deleted = DownloadClientModel.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Download client not found' });
      }

      logger.info(`Download client deleted: ${id} by ${req.user.username}`);
      return res.json({ message: 'Download client deleted' });
    } catch (error) {
      logger.error('Delete download client error:', error);
      return res.status(500).json({ error: 'Failed to delete download client' });
    }
  }

  static async testDownloadClient(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { type, host, port, use_ssl, url_base, username, password, api_key } = req.body;
      
      if (!type || !host || !port) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await downloadClientService.testConnection({
        type,
        host,
        port,
        use_ssl,
        url_base,
        username,
        password,
        api_key
      });

      return res.json(result);
    } catch (error: any) {
      logger.error('Test download client error:', error);
      return res.json({ success: false, message: error.message || 'Test failed' });
    }
  }

  // Get enabled download clients (for regular users to see available clients)
  static async getEnabledDownloadClients(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const clients = downloadClientService.getEnabledClients();
      
      // Only return safe info (no credentials)
      const safeClients = clients.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        priority: c.priority
      }));
      
      return res.json(safeClients);
    } catch (error) {
      logger.error('Get enabled download clients error:', error);
      return res.status(500).json({ error: 'Failed to get download clients' });
    }
  }

  // Get all blacklisted releases
  static async getBlacklist(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { ReleaseBlacklistModel } = require('../models/ReleaseBlacklist');
      const blacklist = ReleaseBlacklistModel.findAll();
      
      // Enrich with media info
      const enriched = blacklist.map((item: any) => {
        let mediaTitle = 'Unknown';
        let mediaType = 'unknown';
        
        if (item.movie_id) {
          const movie = MovieModel.findById(item.movie_id);
          mediaTitle = movie?.title || 'Unknown Movie';
          mediaType = 'movie';
        } else if (item.series_id) {
          const series = TVSeriesModel.findById(item.series_id);
          mediaTitle = series?.title || 'Unknown Series';
          if (item.season_number && item.episode_number) {
            mediaTitle += ` S${String(item.season_number).padStart(2, '0')}E${String(item.episode_number).padStart(2, '0')}`;
          }
          mediaType = 'tv';
        }
        
        return {
          ...item,
          media_title: mediaTitle,
          media_type: mediaType
        };
      });
      
      return res.json(enriched);
    } catch (error) {
      logger.error('Get blacklist error:', error);
      return res.status(500).json({ error: 'Failed to get blacklist' });
    }
  }

  // Remove a release from blacklist
  static async removeFromBlacklist(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      
      const { ReleaseBlacklistModel } = require('../models/ReleaseBlacklist');
      const success = ReleaseBlacklistModel.remove(id);
      
      if (success) {
        return res.json({ success: true, message: 'Release removed from blacklist' });
      } else {
        return res.status(404).json({ error: 'Blacklist entry not found' });
      }
    } catch (error) {
      logger.error('Remove from blacklist error:', error);
      return res.status(500).json({ error: 'Failed to remove from blacklist' });
    }
  }

  // Clear blacklist for a specific movie
  static async clearMovieBlacklist(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { movieId } = req.params;
      
      const { ReleaseBlacklistModel } = require('../models/ReleaseBlacklist');
      const count = ReleaseBlacklistModel.clearForMovie(movieId);
      
      return res.json({ success: true, message: `Cleared ${count} blacklisted releases` });
    } catch (error) {
      logger.error('Clear movie blacklist error:', error);
      return res.status(500).json({ error: 'Failed to clear blacklist' });
    }
  }

  // Clear blacklist for a specific series
  static async clearSeriesBlacklist(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { seriesId } = req.params;
      
      const { ReleaseBlacklistModel } = require('../models/ReleaseBlacklist');
      const count = ReleaseBlacklistModel.clearForSeries(seriesId);
      
      return res.json({ success: true, message: `Cleared ${count} blacklisted releases` });
    } catch (error) {
      logger.error('Clear series blacklist error:', error);
      return res.status(500).json({ error: 'Failed to clear blacklist' });
    }
  }
}
