import logger from '../config/logger';
import { DownloadModel, Download } from '../models/Download';
import { DownloadClientModel, DownloadClient } from '../models/DownloadClient';
import { MovieModel } from '../models/Movie';
import { TVSeriesModel } from '../models/TVSeries';
import { ActivityLogModel, EVENT_TYPES } from '../models/ActivityLog';
import { ReleaseBlacklistModel } from '../models/ReleaseBlacklist';
import { downloadClientService } from './downloadClient';
import { fileNamingService } from './fileNaming';
import { mediaInfoService } from './mediaInfo';
import { autoSearchService } from './autoSearch';
import { notificationService } from './notification';
import db from '../config/database';
import fs from 'fs';
import path from 'path';

interface SyncResult {
  synced: number;
  completed: number;
  failed: number;
}

class DownloadSyncService {
  private VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.wmv', '.mov', '.ts', '.m2ts'];

  /**
   * Check if redownload_failed is enabled
   */
  private isRedownloadEnabled(): boolean {
    try {
      const stmt = db.prepare("SELECT value FROM system_settings WHERE key = 'redownload_failed'");
      const result = stmt.get() as { value: string } | undefined;
      return result?.value !== 'false';
    } catch {
      return true; // Default to enabled
    }
  }

  /**
   * Check if auto_import is enabled
   */
  private isAutoImportEnabled(): boolean {
    try {
      const stmt = db.prepare("SELECT value FROM system_settings WHERE key = 'auto_import_enabled'");
      const result = stmt.get() as { value: string } | undefined;
      return result?.value !== 'false';
    } catch {
      return true; // Default to enabled
    }
  }

  /**
   * Handle a failed download - blacklist the release and attempt to find an alternative
   */
  private async handleFailedDownload(
    download: Download,
    reason: string,
    client?: DownloadClient
  ): Promise<void> {
    // Add to blacklist
    ReleaseBlacklistModel.add({
      movie_id: download.movie_id || undefined,
      series_id: download.series_id || undefined,
      season_number: download.season_number || undefined,
      episode_number: download.episode_number || undefined,
      release_title: download.title,
      indexer: download.indexer || undefined,
      reason
    });

    // Check if redownload is enabled
    if (!this.isRedownloadEnabled()) {
      logger.info(`[Redownload] Disabled - not searching for alternative for "${download.title}"`);
      return;
    }

    // Attempt to find and download an alternative release
    logger.info(`[Redownload] Searching for alternative release for "${download.title}"`);
    
    try {
      if (download.media_type === 'movie' && download.movie_id) {
        const result = await autoSearchService.searchAndDownloadMovie(download.movie_id);
        if (result) {
          logger.info(`[Redownload] Found alternative for movie: "${result.title}"`);
          
          // Log activity
          ActivityLogModel.logMovieEvent(
            download.movie_id,
            EVENT_TYPES.GRABBED,
            `Redownload: ${result.title}`,
            JSON.stringify({ 
              original: download.title, 
              replacement: result.title,
              reason 
            })
          );
        } else {
          logger.warn(`[Redownload] No alternative found for movie "${download.title}"`);
        }
      } else if (download.media_type === 'tv' && download.series_id && download.season_number && download.episode_number) {
        const result = await autoSearchService.searchAndDownloadEpisode(
          download.series_id,
          download.season_number,
          download.episode_number
        );
        if (result) {
          logger.info(`[Redownload] Found alternative for episode: "${result.title}"`);
          
          // Log activity
          ActivityLogModel.logSeriesEvent(
            download.series_id,
            EVENT_TYPES.GRABBED,
            `Redownload: ${result.title}`,
            JSON.stringify({ 
              original: download.title, 
              replacement: result.title,
              reason,
              season: download.season_number,
              episode: download.episode_number
            })
          );
        } else {
          logger.warn(`[Redownload] No alternative found for episode "${download.title}"`);
        }
      }
    } catch (error) {
      logger.error(`[Redownload] Failed to search for alternative:`, error);
    }
  }

  /**
   * Sync all active downloads from all download clients
   */
  async syncAllDownloads(): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, completed: 0, failed: 0 };
    
    try {
      // Get all downloads that are queued or downloading
      const activeDownloads = [
        ...DownloadModel.findByStatus('queued'),
        ...DownloadModel.findByStatus('downloading'),
        ...DownloadModel.findByStatus('importing')
      ];

      if (activeDownloads.length === 0) {
        return result;
      }

      // Get all enabled download clients
      const allClients = DownloadClientModel.findEnabled();
      const qbClients = allClients.filter(c => c.type === 'qbittorrent');
      const sabClients = allClients.filter(c => c.type === 'sabnzbd');
      
      // Collect torrents from all qBittorrent clients
      const allTorrents: Map<string, { torrent: any; client: DownloadClient }> = new Map();
      
      for (const client of qbClients) {
        try {
          const torrents = await downloadClientService.getQBTorrents(client.id);
          for (const torrent of torrents) {
            allTorrents.set(torrent.hash.toLowerCase(), { torrent, client });
          }
        } catch (error) {
          logger.error(`[DownloadSync] Failed to get torrents from ${client.name}:`, error);
        }
      }

      // Collect NZBs from all SABnzbd clients
      const allNzbs: Map<string, { nzb: any; client: DownloadClient }> = new Map();
      
      for (const client of sabClients) {
        try {
          const queue = await downloadClientService.getSABQueue(client.id);
          if (queue?.slots) {
            for (const slot of queue.slots) {
              allNzbs.set(slot.nzo_id, { nzb: slot, client });
            }
          }
          // Also check history for completed
          const history = await downloadClientService.getSABHistory(client.id);
          if (history?.slots) {
            for (const slot of history.slots) {
              if (!allNzbs.has(slot.nzo_id)) {
                allNzbs.set(slot.nzo_id, { nzb: { ...slot, fromHistory: true }, client });
              }
            }
          }
        } catch (error) {
          logger.error(`[DownloadSync] Failed to get NZBs from ${client.name}:`, error);
        }
      }

      // Sync each download
      for (const download of activeDownloads) {
        try {
          // Check client type to determine which sync to use
          const client = download.download_client_id ? 
            DownloadClientModel.findById(download.download_client_id) : null;
          
          if (client?.type === 'sabnzbd') {
            await this.syncSABDownload(download, allNzbs);
          } else {
            // Check if download has a hash but torrent is gone from client
            if (download.torrent_hash && download.status !== 'importing') {
              const hashLower = download.torrent_hash.toLowerCase();
              if (!allTorrents.has(hashLower)) {
                // Torrent was removed from client - mark as failed/removed
                logger.info(`[DownloadSync] Torrent ${download.torrent_hash} removed from client, marking download as failed`);
                DownloadModel.updateStatus(download.id, 'failed', download.progress);
                
                // Attempt to find alternative release
                await this.handleFailedDownload(download, 'Torrent removed from client');
                
                result.failed++;
                continue;
              }
            }
            
            await this.syncDownload(download, allTorrents);
          }
          result.synced++;
        } catch (error) {
          logger.error(`[DownloadSync] Failed to sync download ${download.id}:`, error);
          result.failed++;
        }
      }

      return result;
    } catch (error) {
      logger.error('[DownloadSync] Error:', error);
      return result;
    }
  }

  /**
   * Sync a SABnzbd download
   */
  private async syncSABDownload(
    download: Download,
    nzbs: Map<string, { nzb: any; client: DownloadClient }>
  ): Promise<void> {
    // If no hash/nzo_id, try to find by title matching
    if (!download.torrent_hash) {
      const match = this.findNzbByTitle(download.title, nzbs);
      if (match) {
        DownloadModel.updateTorrentHash(download.id, match.nzb.nzo_id);
        download.torrent_hash = match.nzb.nzo_id;
      } else {
        return;
      }
    }

    // At this point torrent_hash is definitely set
    if (!download.torrent_hash) return;

    const nzbData = nzbs.get(download.torrent_hash);
    if (!nzbData) {
      // NZB not found - might have been removed or completed
      if (download.status === 'downloading') {
        logger.warn(`[DownloadSync] NZB ${download.torrent_hash} not found, marking as completed`);
        DownloadModel.updateStatus(download.id, 'completed', 100);
      }
      return;
    }

    const { nzb, client } = nzbData;
    
    // Calculate progress from SABnzbd data
    let progress = 0;
    if (nzb.percentage !== undefined) {
      progress = parseInt(nzb.percentage) || 0;
    } else if (nzb.mb && nzb.mbleft) {
      const total = parseFloat(nzb.mb);
      const left = parseFloat(nzb.mbleft);
      progress = total > 0 ? Math.round(((total - left) / total) * 100) : 0;
    }

    // Update status based on SABnzbd state
    if (nzb.status === 'Completed' || nzb.fromHistory) {
      if (download.status !== 'completed' && download.status !== 'importing') {
        logger.info(`[SABnzbd] Download completed: "${download.title}"`);
        // Check if auto-import is enabled
        if (this.isAutoImportEnabled()) {
          // Process the completed download - import files
          await this.handleCompletedSABDownload(download, nzb, client);
        } else {
          // Just mark as completed without importing
          logger.info(`[SABnzbd] Auto-import disabled, marking as completed without import`);
          DownloadModel.updateStatus(download.id, 'completed', 100);
        }
      }
    } else if (nzb.status === 'Downloading' || nzb.status === 'Queued') {
      if (download.status === 'queued' && progress > 0) {
        DownloadModel.updateStatus(download.id, 'downloading', progress);
      } else if (download.status === 'downloading') {
        DownloadModel.updateProgress(download.id, progress);
      }
    } else if (nzb.status === 'Failed') {
      logger.error(`[SABnzbd] Download failed: "${download.title}"`);
      DownloadModel.updateStatus(download.id, 'failed', progress);
      
      // Remove from SABnzbd if remove_failed is enabled
      if (client.remove_failed && download.torrent_hash) {
        try {
          await downloadClientService.removeNzb(client.id, download.torrent_hash, true);
          logger.info(`[SABnzbd] Removed failed NZB from ${client.name}: ${download.title}`);
        } catch (error) {
          logger.warn(`[SABnzbd] Failed to remove from client:`, error);
        }
      }
      
      // Attempt to find alternative release
      await this.handleFailedDownload(download, 'NZB download failed', client);
    }
  }

  /**
   * Handle a completed SABnzbd download - import files and update library
   */
  private async handleCompletedSABDownload(
    download: Download,
    nzb: any,
    client: DownloadClient
  ): Promise<void> {
    // Mark as importing
    DownloadModel.updateStatus(download.id, 'importing', 100);

    // Log activity: Download Completed
    if (download.movie_id) {
      ActivityLogModel.logMovieEvent(
        download.movie_id,
        EVENT_TYPES.DOWNLOADED,
        `${download.title} download completed`,
        JSON.stringify({ client: client.name, source: nzb.name })
      );
      // Send notification
      const movie = MovieModel.findById(download.movie_id);
      notificationService.notify({
        event: 'onImportComplete',
        title: 'Download Completed',
        message: `${download.title} download completed`,
        mediaType: 'movie',
        mediaTitle: movie?.title
      }).catch(err => logger.error('Notification error:', err));
    } else if (download.series_id) {
      ActivityLogModel.logSeriesEvent(
        download.series_id,
        EVENT_TYPES.DOWNLOADED,
        `${download.title} download completed`,
        JSON.stringify({ client: client.name, source: nzb.name })
      );
      // Send notification
      const series = TVSeriesModel.findById(download.series_id);
      notificationService.notify({
        event: 'onImportComplete',
        title: 'Download Completed',
        message: `${download.title} download completed`,
        mediaType: 'series',
        mediaTitle: series?.title
      }).catch(err => logger.error('Notification error:', err));
    }

    try {
      // Get the storage path from SABnzbd history
      let contentPath = nzb.storage || nzb.path;
      
      logger.info(`[SABImport] Processing "${download.title}"`);
      logger.info(`[SABImport] NZB storage path: ${nzb.storage}`);
      logger.info(`[SABImport] NZB path: ${nzb.path}`);
      logger.info(`[SABImport] NZB name: ${nzb.name}`);
      logger.info(`[SABImport] Media type: ${download.media_type}`);
      logger.info(`[SABImport] NZB category: ${nzb.category || nzb.cat || 'none'}`);
      
      if (!contentPath) {
        logger.warn(`[SABImport] No storage path from SABnzbd for "${download.title}"`);
        DownloadModel.updateStatus(download.id, 'failed', 100, 'No storage path returned from SABnzbd');
        return;
      }
      
      // Get the actual category from SABnzbd response
      const actualCategory = nzb.category || nzb.cat || '';
      
      // Build list of category folder names based on media type
      const categoryFolders = download.media_type === 'movie' 
        ? ['movies', 'movie', 'films', 'film', 'Movies']
        : ['tv', 'tvshows', 'series', 'television', 'TV', 'TVShows'];
      
      // Add actual category to the list if it's not empty
      if (actualCategory && !categoryFolders.includes(actualCategory)) {
        categoryFolders.unshift(actualCategory);
      }
      
      // Get client configured category paths
      const clientCategoryPath = download.media_type === 'movie' 
        ? client.category_movies 
        : client.category_tv;
      
      // Try different path variations
      // The key insight: SABnzbd temp folder downloads get moved to category folders when complete
      const pathsToTry = [
        contentPath,
        // Try with /data prefix if it's a relative path  
        contentPath.startsWith('/') ? contentPath : `/data/${contentPath}`,
        
        // Map temp/incomplete paths to category folders
        ...categoryFolders.flatMap(cat => [
          contentPath.replace(/\/temp\//, `/${cat}/`),
          contentPath.replace(/\/incomplete\//, `/${cat}/`),
          contentPath.replace(/\/downloading\//, `/${cat}/`),
        ]),
        
        // Try mapping /config/temp paths to /data paths (common SABnzbd issue)
        contentPath.replace('/config/temp/', '/data/downloads/complete/'),
        contentPath.replace('/config/temp/', '/data/usenet/complete/'),
        
        // Map temp to various complete locations
        ...categoryFolders.flatMap(cat => [
          contentPath.replace('/config/temp/', `/data/usenet/${cat}/`),
          contentPath.replace('/config/temp/', `/data/downloads/${cat}/`),
        ]),
        
        // Try common SABnzbd complete paths (no category)
        `/data/downloads/complete/${nzb.name}`,
        `/data/usenet/complete/${nzb.name}`,
        `/data/downloads/${nzb.name}`,
        `/data/usenet/${nzb.name}`,
        
        // Try paths WITH category folders - most common SABnzbd setup
        ...categoryFolders.flatMap(cat => [
          `/data/usenet/${cat}/${nzb.name}`,
          `/data/downloads/${cat}/${nzb.name}`,
          `/data/downloads/complete/${cat}/${nzb.name}`,
          `/data/usenet/complete/${cat}/${nzb.name}`,
        ]),
        
        // Try client configured category path if set
        ...(clientCategoryPath ? [
          `${clientCategoryPath}/${nzb.name}`,
          `/data/${clientCategoryPath}/${nzb.name}`,
        ] : []),
      ].filter(Boolean);
      
      let foundPath: string | null = null;
      for (const tryPath of pathsToTry) {
        if (tryPath && fs.existsSync(tryPath)) {
          foundPath = tryPath;
          logger.info(`[SABImport] Found accessible path: ${tryPath}`);
          break;
        } else {
          logger.debug(`[SABImport] Path not accessible: ${tryPath}`);
        }
      }
      
      if (!foundPath) {
        logger.warn(`[SABImport] Content path not accessible for "${download.title}". Tried paths: ${pathsToTry.join(', ')}`);
        logger.warn(`[SABImport] Marking as failed - check volume mappings`);
        DownloadModel.updateStatus(download.id, 'failed', 100, `Content path not accessible. SABnzbd path: ${contentPath}. Check Docker volume mappings.`);
        return;
      }
      
      contentPath = foundPath;

      // Find video files
      const videoFiles = this.findVideoFiles(contentPath);
      logger.info(`[SABImport] Found ${videoFiles.length} video file(s) in ${contentPath}`);
      
      if (videoFiles.length === 0) {
        logger.warn(`[SABImport] No video files found for "${download.title}" in ${contentPath}`);
        DownloadModel.updateStatus(download.id, 'failed', 100, `No video files found in: ${contentPath}`);
        return;
      }

      // Log found files
      videoFiles.forEach((f, i) => logger.info(`[SABImport] File ${i + 1}: ${f}`));

      // Process based on media type
      if (download.media_type === 'movie' && download.movie_id) {
        await this.importMovieFile(download, videoFiles[0], { name: nzb.name, content_path: contentPath });
      } else if (download.media_type === 'tv' && download.series_id) {
        await this.importTVFile(download, videoFiles, { name: nzb.name, content_path: contentPath });
      }

      // Mark as completed
      DownloadModel.updateStatus(download.id, 'completed', 100);
      logger.info(`[SABImport] Successfully imported "${download.title}"`);

      // Optionally remove from SABnzbd if configured
      if (client.remove_completed && download.torrent_hash) {
        try {
          await downloadClientService.removeNzb(client.id, download.torrent_hash, true);
          logger.info(`[SABImport] Removed completed NZB from ${client.name}`);
        } catch (error) {
          logger.warn(`[SABImport] Failed to remove NZB from client:`, error);
        }
      }

      // Delete source files if different from destination
      if (client.remove_completed && contentPath) {
        try {
          // Give a short delay to ensure import is complete
          setTimeout(() => {
            if (fs.existsSync(contentPath)) {
              fs.rmSync(contentPath, { recursive: true, force: true });
              logger.info(`[SABImport] Deleted source folder: ${contentPath}`);
            }
          }, 2000);
        } catch (error) {
          logger.warn(`[SABImport] Failed to delete source folder:`, error);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[SABImport] Failed to import "${download.title}":`, error);
      DownloadModel.updateStatus(download.id, 'failed', 100, `Import error: ${errorMsg}`);
      
      // Remove from SABnzbd if remove_failed is enabled
      if (client.remove_failed && download.torrent_hash) {
        try {
          await downloadClientService.removeNzb(client.id, download.torrent_hash, true);
          logger.info(`[SABImport] Removed failed NZB from ${client.name}: ${download.title}`);
        } catch (removeError) {
          logger.warn(`[SABImport] Failed to remove failed NZB from client:`, removeError);
        }
      }
      
      // Attempt to find alternative release
      await this.handleFailedDownload(download, 'Import failed', client);
    }
  }

  /**
   * Find NZB by matching title
   */
  private findNzbByTitle(
    title: string,
    nzbs: Map<string, { nzb: any; client: DownloadClient }>
  ): { nzb: any; client: DownloadClient } | null {
    const titleLower = title.toLowerCase();
    const titleWords = titleLower.split(/[\s.\-_]+/).filter(w => w.length > 2);

    for (const [, data] of nzbs) {
      const nzbName = (data.nzb.filename || data.nzb.name || '').toLowerCase();
      const matchCount = titleWords.filter(w => nzbName.includes(w)).length;
      if (matchCount >= Math.min(3, titleWords.length * 0.6)) {
        return data;
      }
    }
    return null;
  }

  /**
   * Sync a single download with torrent client data
   */
  private async syncDownload(
    download: Download, 
    torrents: Map<string, { torrent: any; client: DownloadClient }>
  ): Promise<void> {
    // If no torrent hash, try to find by title match
    if (!download.torrent_hash) {
      const match = this.findTorrentByTitle(download.title, torrents);
      if (match) {
        DownloadModel.updateTorrentHash(download.id, match.torrent.hash);
        DownloadModel.updateDownloadClient(download.id, match.client.id);
        download.torrent_hash = match.torrent.hash;
        download.download_client_id = match.client.id;
        logger.info(`Matched download "${download.title}" to torrent ${match.torrent.hash}`);
      } else {
        // No matching torrent found yet
        return;
      }
    }

    // At this point torrent_hash is definitely set
    if (!download.torrent_hash) return;
    
    const hashLower = download.torrent_hash.toLowerCase();
    const torrentData = torrents.get(hashLower);

    if (!torrentData) {
      // Torrent not found in any client - might have been removed
      logger.warn(`Torrent ${download.torrent_hash} not found for download "${download.title}"`);
      return;
    }

    const { torrent, client } = torrentData;
    const progress = Math.round(torrent.progress * 100);

    // Update client ID if not set
    if (!download.download_client_id) {
      DownloadModel.updateDownloadClient(download.id, client.id);
    }

    // Check for error states first
    const errorStates = ['error', 'missingFiles', 'unknown'];
    if (errorStates.includes(torrent.state)) {
      logger.error(`Download failed: "${download.title}" (state: ${torrent.state})`);
      DownloadModel.updateStatus(download.id, 'failed', progress);
      
      // Remove from client if remove_failed is enabled
      if (client.remove_failed) {
        try {
          await downloadClientService.removeTorrent(client.id, torrent.hash, true);
          logger.info(`Removed failed torrent from ${client.name}: ${download.title}`);
        } catch (error) {
          logger.warn(`Failed to remove failed torrent from client:`, error);
        }
      }
      
      // Attempt to find alternative release
      await this.handleFailedDownload(download, `Torrent failed (${torrent.state})`, client);
      return;
    }

    // Update progress
    if (download.status === 'queued' && progress > 0) {
      DownloadModel.updateStatus(download.id, 'downloading', progress);
    } else if (download.status === 'downloading') {
      DownloadModel.updateProgress(download.id, progress);
    }

    // Check for completion
    // qBittorrent states: uploading, pausedUP, stalledUP, queuedUP mean completed
    const completedStates = ['uploading', 'pausedUP', 'stalledUP', 'queuedUP', 'forcedUP'];
    if (completedStates.includes(torrent.state) || progress >= 100) {
      logger.info(`Download completed: "${download.title}" (state: ${torrent.state})`);
      // Check if auto-import is enabled
      if (this.isAutoImportEnabled()) {
        await this.handleCompletedDownload(download, torrent, client);
      } else {
        // Just mark as completed without importing
        logger.info(`[qBittorrent] Auto-import disabled, marking as completed without import`);
        DownloadModel.updateStatus(download.id, 'completed', 100);
      }
    }
  }

  /**
   * Find torrent by matching title
   */
  private findTorrentByTitle(
    title: string, 
    torrents: Map<string, { torrent: any; client: DownloadClient }>
  ): { torrent: any; client: DownloadClient } | null {
    const titleLower = title.toLowerCase();
    const titleWords = titleLower.split(/[\s.\-_]+/).filter(w => w.length > 2);

    for (const [, data] of torrents) {
      const torrentName = data.torrent.name.toLowerCase();
      // Check if most title words appear in torrent name
      const matchCount = titleWords.filter(w => torrentName.includes(w)).length;
      if (matchCount >= Math.min(3, titleWords.length * 0.6)) {
        return data;
      }
    }
    return null;
  }

  /**
   * Handle a completed download - import files and update library
   */
  private async handleCompletedDownload(
    download: Download, 
    torrent: any, 
    client: DownloadClient
  ): Promise<void> {
    // Mark as importing
    DownloadModel.updateStatus(download.id, 'importing', 100);

    // Log activity: Download Completed
    if (download.movie_id) {
      ActivityLogModel.logMovieEvent(
        download.movie_id,
        EVENT_TYPES.DOWNLOADED,
        `${download.title} download completed`,
        JSON.stringify({ client: client.name, source: torrent.name })
      );
      // Send notification
      const movie = MovieModel.findById(download.movie_id);
      notificationService.notify({
        event: 'onImportComplete',
        title: 'Download Completed',
        message: `${download.title} download completed`,
        mediaType: 'movie',
        mediaTitle: movie?.title
      }).catch(err => logger.error('Notification error:', err));
    } else if (download.series_id) {
      ActivityLogModel.logSeriesEvent(
        download.series_id,
        EVENT_TYPES.DOWNLOADED,
        `${download.title} download completed`,
        JSON.stringify({ client: client.name, source: torrent.name })
      );
      // Send notification
      const series = TVSeriesModel.findById(download.series_id);
      notificationService.notify({
        event: 'onImportComplete',
        title: 'Download Completed',
        message: `${download.title} download completed`,
        mediaType: 'series',
        mediaTitle: series?.title
      }).catch(err => logger.error('Notification error:', err));
    }

    try {
      // Get the content path from torrent
      let contentPath = torrent.content_path || torrent.save_path;
      
      logger.info(`[Import] Processing "${download.title}"`);
      logger.info(`[Import] Torrent content_path: ${torrent.content_path}`);
      logger.info(`[Import] Torrent save_path: ${torrent.save_path}`);
      logger.info(`[Import] Torrent name: ${torrent.name}`);
      
      // Try different path variations
      const pathsToTry = [
        contentPath,
        // Try with /data prefix if it's a relative path
        contentPath?.startsWith('/') ? contentPath : `/data/${contentPath}`,
        // Try combining save_path with name
        torrent.save_path ? `${torrent.save_path}/${torrent.name}` : null,
        // Try with /data prefix for save_path
        torrent.save_path?.startsWith('/') ? `${torrent.save_path}/${torrent.name}` : `/data/${torrent.save_path}/${torrent.name}`,
      ].filter(Boolean);
      
      let foundPath: string | null = null;
      for (const tryPath of pathsToTry) {
        if (tryPath && fs.existsSync(tryPath)) {
          foundPath = tryPath;
          logger.info(`[Import] Found accessible path: ${tryPath}`);
          break;
        } else {
          logger.debug(`[Import] Path not accessible: ${tryPath}`);
        }
      }
      
      if (!foundPath) {
        logger.warn(`[Import] Content path not accessible for "${download.title}". Tried paths: ${pathsToTry.join(', ')}`);
        logger.warn(`[Import] Marking as failed - check volume mappings`);
        DownloadModel.updateStatus(download.id, 'failed', 100, `Content path not accessible. Torrent path: ${contentPath}. Check Docker volume mappings.`);
        return;
      }
      
      contentPath = foundPath;

      // Find video files
      const videoFiles = this.findVideoFiles(contentPath);
      logger.info(`[Import] Found ${videoFiles.length} video file(s) in ${contentPath}`);
      
      if (videoFiles.length === 0) {
        logger.warn(`[Import] No video files found for "${download.title}" in ${contentPath}`);
        DownloadModel.updateStatus(download.id, 'failed', 100, `No video files found in: ${contentPath}`);
        return;
      }

      // Log found files
      videoFiles.forEach((f, i) => logger.info(`[Import] File ${i + 1}: ${f}`));

      // Process based on media type
      if (download.media_type === 'movie' && download.movie_id) {
        await this.importMovieFile(download, videoFiles[0], torrent);
      } else if (download.media_type === 'tv' && download.series_id) {
        await this.importTVFile(download, videoFiles, torrent);
      }

      // Mark as completed
      DownloadModel.updateStatus(download.id, 'completed', 100);
      logger.info(`[Import] Successfully imported "${download.title}"`);

      // Remove from client and delete source files if configured
      if (client.remove_completed) {
        try {
          // Delete files when removing - hardlinks preserve data, copies are duplicates
          await downloadClientService.removeTorrent(client.id, torrent.hash, true);
          logger.info(`[Import] Removed completed torrent and files from ${client.name}`);
        } catch (error) {
          logger.warn(`[Import] Failed to remove torrent from client:`, error);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[Import] Failed to import "${download.title}":`, error);
      DownloadModel.updateStatus(download.id, 'failed', 100, `Import error: ${errorMsg}`);
      
      // Remove from client if remove_failed is enabled
      if (client.remove_failed && torrent?.hash) {
        try {
          await downloadClientService.removeTorrent(client.id, torrent.hash, true);
          logger.info(`[Import] Removed failed torrent from ${client.name}: ${download.title}`);
        } catch (removeError) {
          logger.warn(`[Import] Failed to remove failed torrent from client:`, removeError);
        }
      }
      
      // Attempt to find alternative release
      await this.handleFailedDownload(download, 'Import failed', client);
    }
  }

  /**
   * Find all video files in a path
   */
  private findVideoFiles(filePath: string): string[] {
    const files: string[] = [];
    
    const stat = fs.statSync(filePath);
    
    if (stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      if (this.VIDEO_EXTENSIONS.includes(ext)) {
        files.push(filePath);
      }
    } else if (stat.isDirectory()) {
      const entries = fs.readdirSync(filePath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(filePath, entry.name);
        if (entry.isDirectory()) {
          files.push(...this.findVideoFiles(fullPath));
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (this.VIDEO_EXTENSIONS.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    }

    // Sort by size descending (main file first)
    return files.sort((a, b) => {
      try {
        return fs.statSync(b).size - fs.statSync(a).size;
      } catch {
        return 0;
      }
    });
  }

  /**
   * Import a movie file - move/copy to destination folder
   */
  private async importMovieFile(download: Download, videoFile: string, torrent: any): Promise<void> {
    const movie = MovieModel.findById(download.movie_id!);
    if (!movie) {
      logger.warn(`Movie not found: ${download.movie_id}`);
      return;
    }

    if (!movie.folder_path) {
      logger.warn(`Movie "${movie.title}" has no folder path set`);
      return;
    }

    logger.info(`[Import] Movie: "${movie.title}"`);
    logger.info(`[Import] Movie folder_path from DB: ${movie.folder_path}`);
    logger.info(`[Import] Source video file: ${videoFile}`);

    const sourceStat = fs.statSync(videoFile);
    const sourceFilename = path.basename(videoFile);
    const ext = path.extname(videoFile);
    
    // Parse quality and codecs from filename - also check the release/torrent name
    // The actual video file might not have quality markers, but the release name should
    const releaseName = torrent?.name || download.title || '';
    const combinedName = `${sourceFilename} ${releaseName}`;
    
    // Use release name first for quality (more reliable), fallback to filename
    let quality = this.parseQuality(releaseName) || this.parseQuality(sourceFilename);
    // If release name gives a better quality (CAM, TELESYNC, etc), prefer it
    const releaseQuality = this.parseQuality(releaseName);
    if (releaseQuality && ['CAM', 'TELESYNC', 'TELECINE', 'DVDSCR', 'WORKPRINT', 'R5'].includes(releaseQuality)) {
      quality = releaseQuality;
    }
    
    const videoCodec = this.parseVideoCodec(combinedName);
    const audioCodec = this.parseAudioCodec(combinedName);
    const releaseGroup = this.parseReleaseGroup(releaseName) || this.parseReleaseGroup(sourceFilename);
    const dynamicRange = this.parseDynamicRange(combinedName);
    const audioChannels = this.parseAudioChannels(combinedName);
    
    // Detect if this is a proper or repack release
    const isProper = /\bPROPER\b/i.test(combinedName);
    const isRepack = /\bREPACK\b|\bREREIP\b/i.test(combinedName);
    
    // Create destination folder if it doesn't exist
    if (!fs.existsSync(movie.folder_path)) {
      fs.mkdirSync(movie.folder_path, { recursive: true });
      logger.info(`Created folder: ${movie.folder_path}`);
    }
    
    // Delete any existing movie files (for upgrades/replacements)
    const existingFiles = MovieModel.findMovieFiles(movie.id);
    for (const existingFile of existingFiles) {
      if (existingFile.file_path && fs.existsSync(existingFile.file_path)) {
        try {
          fs.unlinkSync(existingFile.file_path);
          logger.info(`Deleted existing movie file for upgrade: ${existingFile.file_path}`);
        } catch (err) {
          logger.warn(`Failed to delete existing file ${existingFile.file_path}:`, err);
        }
      }
      // Also delete from database
      MovieModel.deleteMovieFile(existingFile.id);
    }
    
    // Also check if movie.file_path exists (single file tracking)
    if (movie.file_path && fs.existsSync(movie.file_path)) {
      try {
        fs.unlinkSync(movie.file_path);
        logger.info(`Deleted existing movie file for upgrade: ${movie.file_path}`);
      } catch (err) {
        logger.warn(`Failed to delete existing file ${movie.file_path}:`, err);
      }
    }
    
    // Generate renamed filename using fileNamingService
    const generatedName = fileNamingService.generateMovieFilename({
      title: movie.title,
      year: movie.year || undefined,
      tmdbId: movie.tmdb_id || undefined,
      quality,
      videoCodec,
      audioCodec,
      audioChannels,
      dynamicRange,
      releaseGroup
    }, ext);
    
    logger.info(`[Import] Rename info: title="${movie.title}", year=${movie.year}, quality=${quality}, codec=${videoCodec}, group=${releaseGroup}`);
    logger.info(`[Import] Generated filename: "${generatedName || '(none - renaming disabled or failed)'}"`);
    logger.info(`[Import] Original filename: "${sourceFilename}"`);
    
    // Use generated name if available, otherwise keep original
    const destFilename = generatedName || sourceFilename;
    const destPath = path.join(movie.folder_path, destFilename);
    
    logger.info(`[Import] Final destination filename: "${destFilename}"`);
    
    try {
      // Verify we're copying a file, not a directory
      const sourceStat2 = fs.statSync(videoFile);
      if (sourceStat2.isDirectory()) {
        logger.error(`[Import] ERROR: videoFile is a directory, not a file: ${videoFile}`);
        throw new Error(`Cannot import directory: ${videoFile}`);
      }
      
      logger.info(`[Import] Source file: ${videoFile} (${(sourceStat2.size / 1024 / 1024).toFixed(2)} MB)`);
      logger.info(`[Import] Destination: ${destPath}`);
      
      // Check if source is within the movie folder (qBittorrent downloaded directly to library)
      const sourceIsInMovieFolder = videoFile.startsWith(movie.folder_path + path.sep);
      const sourceDir = path.dirname(videoFile);
      
      // Try hardlink first (most efficient), fall back to copy/move
      try {
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        
        if (sourceIsInMovieFolder && sourceDir !== movie.folder_path) {
          // Source is in a release subfolder within movie folder - MOVE the file up
          fs.renameSync(videoFile, destPath);
          logger.info(`Moved movie file up from release folder: ${sourceFilename} -> ${destPath}`);
        } else {
          // Normal case - hardlink or copy from downloads folder
          fs.linkSync(videoFile, destPath);
          logger.info(`Hardlinked movie file: ${sourceFilename} -> ${destPath}`);
        }
      } catch (linkError) {
        // Hardlink failed (probably different filesystem), use copy
        fs.copyFileSync(videoFile, destPath);
        logger.info(`Copied movie file: ${sourceFilename} -> ${destPath}`);
        
        // If we copied from within the movie folder, delete the source
        if (sourceIsInMovieFolder && videoFile !== destPath) {
          try {
            fs.unlinkSync(videoFile);
            logger.info(`Deleted source file after copy: ${videoFile}`);
          } catch (delErr) {
            logger.warn(`Failed to delete source file: ${videoFile}`, delErr);
          }
        }
      }
      
      // Update movie with new file info
      const destStat = fs.statSync(destPath);
      
      // Get detailed media info using ffprobe for accurate quality/codec detection
      const mediaInfo = await mediaInfoService.getMediaInfo(destPath);
      
      // For low-quality sources (CAM, TELESYNC, etc.), always preserve the release-name-based quality
      // Don't let mediaInfo bitrate detection override these
      const lowQualitySources = ['CAM', 'TELESYNC', 'TELECINE', 'DVDSCR', 'WORKPRINT', 'R5'];
      let actualQuality: string;
      if (lowQualitySources.includes(quality)) {
        actualQuality = quality;
      } else {
        actualQuality = mediaInfo.qualityFull || mediaInfo.resolution || quality;
      }
      
      const actualVideoCodec = mediaInfo.videoCodec || videoCodec;
      const actualAudioCodec = mediaInfo.audioCodec || audioCodec;
      
      MovieModel.updateFile(movie.id, destPath, destStat.size, actualQuality);
      
      // Also update movie_files table - clear existing and add new entry
      MovieModel.deleteMovieFilesByMovieId(movie.id);
      MovieModel.addMovieFile({
        movie_id: movie.id,
        file_path: destPath,
        relative_path: path.basename(destPath), // Just the filename since it's directly in folder
        file_size: destStat.size,
        quality: actualQuality,
        resolution: mediaInfo.resolution || undefined,
        video_codec: actualVideoCodec || undefined,
        video_dynamic_range: mediaInfo.videoDynamicRange || undefined,
        audio_codec: actualAudioCodec || undefined,
        audio_channels: mediaInfo.audioChannels || undefined,
        audio_languages: mediaInfo.audioLanguages || undefined,
        audio_track_count: mediaInfo.audioTrackCount || 1,
        subtitle_languages: mediaInfo.subtitleLanguages || undefined,
        release_group: releaseGroup || undefined,
        is_proper: isProper,
        is_repack: isRepack
      });
      logger.info(`[Import] Added to movie_files: ${destPath}`);
      
      // Auto-unmonitor if quality meets cutoff
      if (movie.quality_profile_id && movie.monitored) {
        const { QualityProfileModel } = require('../models/QualityProfile');
        if (QualityProfileModel.meetsCutoff(movie.quality_profile_id, actualQuality)) {
          MovieModel.updateMonitored(movie.id, false);
          logger.info(`Auto-unmonitored "${movie.title}" - quality "${actualQuality}" meets cutoff`);
          
          // Log activity: Auto-unmonitored
          ActivityLogModel.logMovieEvent(
            movie.id,
            EVENT_TYPES.UNMONITORED,
            `${movie.title} auto-unmonitored - quality cutoff met`,
            JSON.stringify({ quality: actualQuality, cutoff_met: true })
          );
          
          // Send notification
          notificationService.notify({
            event: 'onFileUpgrade',
            title: 'Quality Cutoff Met',
            message: `${movie.title} auto-unmonitored - quality cutoff met`,
            mediaType: 'movie',
            mediaTitle: movie.title
          }).catch(err => logger.error('Notification error:', err));
        }
      }
      
      // Log activity: Download Imported
      const sizeGB = (destStat.size / (1024 * 1024 * 1024)).toFixed(2);
      ActivityLogModel.logMovieEvent(
        movie.id,
        EVENT_TYPES.IMPORTED,
        `${download.title} imported`,
        JSON.stringify({
          filename: destFilename,
          quality: actualQuality,
          size: `${sizeGB} GB`,
          videoCodec: actualVideoCodec,
          audioCodec: actualAudioCodec,
          releaseGroup
        })
      );
      
      // Send notification for import
      notificationService.notify({
        event: 'onFileImport',
        title: 'File Imported',
        message: `${download.title} imported`,
        mediaType: 'movie',
        mediaTitle: movie.title
      }).catch(err => logger.error('Notification error:', err));
      
      logger.info(`Imported movie "${movie.title}" with file: ${destFilename}`);
      
      // Clean up: If the source video file was in a release subfolder within the movie folder,
      // delete that subfolder now that we've imported the file directly to the movie folder
      // (sourceDir and sourceIsInMovieFolder already defined above)
      
      // Check if source folder is a subfolder of the movie folder (release folder scenario)
      if (sourceIsInMovieFolder && sourceDir !== movie.folder_path) {
        try {
          // Don't delete if it's the movie folder itself
          if (fs.existsSync(sourceDir) && sourceDir !== movie.folder_path) {
            // Check if folder is now empty (or only has small files like .nfo, .txt)
            const remainingFiles = fs.readdirSync(sourceDir);
            const hasLargeFiles = remainingFiles.some(f => {
              const fPath = path.join(sourceDir, f);
              try {
                const stat = fs.statSync(fPath);
                // Keep folder if it has video files or files > 50MB
                return stat.isFile() && (this.VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()) || stat.size > 50 * 1024 * 1024);
              } catch { return false; }
            });
            
            if (!hasLargeFiles) {
              fs.rmSync(sourceDir, { recursive: true, force: true });
              logger.info(`[Import] Cleaned up release folder: ${sourceDir}`);
            }
          }
        } catch (cleanupErr) {
          logger.warn(`[Import] Failed to cleanup source folder: ${sourceDir}`, cleanupErr);
        }
      }
    } catch (error) {
      logger.error(`Failed to import movie file:`, error);
      throw error;
    }
  }

  /**
   * Import TV episode files - move/copy to destination folder
   */
  private async importTVFile(download: Download, videoFiles: string[], torrent: any): Promise<void> {
    const series = TVSeriesModel.findById(download.series_id!);
    if (!series) {
      logger.warn(`Series not found: ${download.series_id}`);
      return;
    }

    if (!series.folder_path) {
      logger.warn(`Series "${series.title}" has no folder path set`);
      return;
    }

    for (const videoFile of videoFiles) {
      const sourceFilename = path.basename(videoFile);
      const sourceStat = fs.statSync(videoFile);
      
      // Parse episode info from filename
      const episodeInfo = this.parseEpisodeFromFilename(sourceFilename);
      
      if (episodeInfo.season !== undefined && episodeInfo.episode !== undefined) {
        // Find matching episode in database
        const episodes = TVSeriesModel.findEpisodesBySeason(series.id, episodeInfo.season);
        const episode = episodes.find(e => e.episode_number === episodeInfo.episode);
        
        if (episode) {
          const ext = path.extname(videoFile);
          const releaseName = torrent?.name || download.title || '';
          const combinedName = `${sourceFilename} ${releaseName}`;
          
          // Parse quality from release name first (more reliable), then filename
          let quality = this.parseQuality(releaseName) || this.parseQuality(sourceFilename);
          const releaseQuality = this.parseQuality(releaseName);
          if (releaseQuality && ['CAM', 'TELESYNC', 'TELECINE', 'DVDSCR', 'WORKPRINT', 'R5'].includes(releaseQuality)) {
            quality = releaseQuality;
          }
          
          const videoCodec = this.parseVideoCodec(combinedName);
          const audioCodec = this.parseAudioCodec(combinedName);
          const releaseGroup = this.parseReleaseGroup(releaseName) || this.parseReleaseGroup(sourceFilename);
          const dynamicRange = this.parseDynamicRange(combinedName);
          const audioChannels = this.parseAudioChannels(combinedName);
          
          // Detect if this is a proper or repack release
          const isProper = /\bPROPER\b/i.test(combinedName);
          const isRepack = /\bREPACK\b|\bREREIP\b/i.test(combinedName);
          
          // Delete existing episode file if present (for upgrades)
          if (episode.has_file && episode.file_path && fs.existsSync(episode.file_path)) {
            try {
              fs.unlinkSync(episode.file_path);
              logger.info(`Deleted existing episode file for upgrade: ${episode.file_path}`);
            } catch (err) {
              logger.warn(`Failed to delete existing episode file ${episode.file_path}:`, err);
            }
          }
          
          // Create season folder if it doesn't exist
          const seasonFolder = path.join(series.folder_path, `Season ${String(episodeInfo.season).padStart(2, '0')}`);
          if (!fs.existsSync(seasonFolder)) {
            fs.mkdirSync(seasonFolder, { recursive: true });
            logger.info(`Created folder: ${seasonFolder}`);
          }
          
          // Generate renamed filename using fileNamingService
          const generatedName = fileNamingService.generateEpisodeFilename({
            seriesTitle: series.title,
            seriesYear: series.year || undefined,
            seasonNumber: episodeInfo.season,
            episodeNumber: episodeInfo.episode,
            episodeTitle: episode.title || undefined,
            quality,
            videoCodec,
            audioCodec,
            audioChannels,
            dynamicRange,
            releaseGroup,
            proper: isProper
          }, ext);
          
          logger.info(`[Import] Episode rename info: series="${series.title}", S${episodeInfo.season}E${episodeInfo.episode}, quality=${quality}`);
          logger.info(`[Import] Generated filename: "${generatedName || '(none - renaming disabled)'}"`);
          logger.info(`[Import] Original filename: "${sourceFilename}"`);
          
          // Use generated name if available, otherwise keep original
          const destFilename = generatedName || sourceFilename;
          const destPath = path.join(seasonFolder, destFilename);
          
          logger.info(`[Import] Final destination: ${destPath}`);
          
          const sourceDir = path.dirname(videoFile);
          const sourceIsInSeriesFolder = videoFile.startsWith(series.folder_path + path.sep);
          
          try {
            // Try hardlink first, fall back to copy/move
            try {
              if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
              }
              
              if (sourceIsInSeriesFolder && !videoFile.startsWith(seasonFolder)) {
                // Source is in series folder but not in correct season folder - MOVE it
                fs.renameSync(videoFile, destPath);
                logger.info(`Moved episode file to season folder: ${sourceFilename} -> ${destPath}`);
              } else {
                fs.linkSync(videoFile, destPath);
                logger.info(`Hardlinked episode file: ${sourceFilename} -> ${destPath}`);
              }
            } catch (linkError) {
              fs.copyFileSync(videoFile, destPath);
              logger.info(`Copied episode file: ${sourceFilename} -> ${destPath}`);
              
              // If we copied from within the series folder, delete the source
              if (sourceIsInSeriesFolder && videoFile !== destPath) {
                try {
                  fs.unlinkSync(videoFile);
                  logger.info(`Deleted source file after copy: ${videoFile}`);
                } catch (delErr) {
                  logger.warn(`Failed to delete source file: ${videoFile}`, delErr);
                }
              }
            }
            
            // Update episode with new file info using ffprobe for accurate detection
            const destStat = fs.statSync(destPath);
            const mediaInfo = await mediaInfoService.getMediaInfo(destPath);
            const actualQuality = mediaInfo.qualityFull || mediaInfo.resolution || quality;
            const actualVideoCodec = mediaInfo.videoCodec || videoCodec;
            const actualAudioCodec = mediaInfo.audioCodec || audioCodec;
            
            TVSeriesModel.updateEpisodeFile(
              episode.id,
              destPath,
              destStat.size,
              actualQuality,
              actualVideoCodec,
              actualAudioCodec,
              releaseGroup
            );
            
            // Auto-unmonitor episode if quality meets cutoff
            if (series.quality_profile_id && episode.monitored) {
              const { QualityProfileModel } = require('../models/QualityProfile');
              if (QualityProfileModel.meetsCutoff(series.quality_profile_id, actualQuality)) {
                TVSeriesModel.updateEpisodeMonitored(episode.id, false);
                logger.info(`Auto-unmonitored S${episodeInfo.season}E${episodeInfo.episode} - quality "${actualQuality}" meets cutoff`);
                
                // Log activity: Auto-unmonitored
                ActivityLogModel.logSeriesEvent(
                  series.id,
                  EVENT_TYPES.UNMONITORED,
                  `S${episodeInfo.season}E${episodeInfo.episode} auto-unmonitored - quality cutoff met`,
                  JSON.stringify({ quality: actualQuality, episode_id: episode.id, cutoff_met: true })
                );
                
                // Send notification
                notificationService.notify({
                  event: 'onFileUpgrade',
                  title: 'Quality Cutoff Met',
                  message: `${series.title} S${episodeInfo.season}E${episodeInfo.episode} auto-unmonitored - quality cutoff met`,
                  mediaType: 'episode',
                  mediaTitle: series.title
                }).catch(err => logger.error('Notification error:', err));
              }
            }

            // Log activity: Episode Imported
            ActivityLogModel.logSeriesEvent(
              series.id,
              EVENT_TYPES.IMPORTED,
              `${series.title} S${String(episodeInfo.season).padStart(2, '0')}E${String(episodeInfo.episode).padStart(2, '0')} imported`,
              JSON.stringify({
                filename: destFilename,
                quality: actualQuality,
                videoCodec: actualVideoCodec,
                audioCodec: actualAudioCodec
              })
            );
            
            // Send notification for import
            notificationService.notify({
              event: 'onFileImport',
              title: 'Episode Imported',
              message: `${series.title} S${String(episodeInfo.season).padStart(2, '0')}E${String(episodeInfo.episode).padStart(2, '0')} imported`,
              mediaType: 'episode',
              mediaTitle: series.title
            }).catch(err => logger.error('Notification error:', err));

            logger.info(`Imported ${series.title} S${episodeInfo.season}E${episodeInfo.episode} with file: ${destFilename}`);
          } catch (error) {
            logger.error(`Failed to import episode file:`, error);
          }
        } else {
          logger.warn(`No matching episode found for S${episodeInfo.season}E${episodeInfo.episode}`);
        }
      } else {
        logger.warn(`Could not parse episode info from filename: ${sourceFilename}`);
      }
    }
    
    // Clean up: If video files were from a release subfolder within the series folder,
    // clean up empty/small-file-only release folders
    if (videoFiles.length > 0) {
      const processedDirs = new Set<string>();
      for (const videoFile of videoFiles) {
        const sourceDir = path.dirname(videoFile);
        if (processedDirs.has(sourceDir)) continue;
        processedDirs.add(sourceDir);
        
        // Check if source folder is within the series folder (release folder scenario)
        if (sourceDir !== series.folder_path && sourceDir.startsWith(series.folder_path + path.sep)) {
          try {
            if (fs.existsSync(sourceDir)) {
              const remainingFiles = fs.readdirSync(sourceDir);
              const hasLargeFiles = remainingFiles.some(f => {
                const fPath = path.join(sourceDir, f);
                try {
                  const stat = fs.statSync(fPath);
                  return stat.isFile() && (this.VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()) || stat.size > 50 * 1024 * 1024);
                } catch { return false; }
              });
              
              if (!hasLargeFiles) {
                fs.rmSync(sourceDir, { recursive: true, force: true });
                logger.info(`[Import] Cleaned up release folder: ${sourceDir}`);
              }
            }
          } catch (cleanupErr) {
            logger.warn(`[Import] Failed to cleanup source folder: ${sourceDir}`, cleanupErr);
          }
        }
      }
    }
  }

  /**
   * Parse episode info from filename
   */
  private parseEpisodeFromFilename(filename: string): { season?: number; episode?: number } {
    // Try S01E01 or S01E112 format (supports 1-3 digit episode numbers)
    const match = filename.match(/[Ss](\d{1,2})[Ee](\d{1,3})/);
    if (match) {
      return { season: parseInt(match[1]), episode: parseInt(match[2]) };
    }
    
    // Try 1x01 or 1x112 format
    const match2 = filename.match(/(\d{1,2})x(\d{1,3})/);
    if (match2) {
      return { season: parseInt(match2[1]), episode: parseInt(match2[2]) };
    }

    return {};
  }

  /**
   * Parse quality from filename
   */
  private parseQuality(filename: string): string {
    const upper = filename.toUpperCase();
    
    // First check for low quality sources (these are standalone qualities)
    if (upper.match(/\bWORKPRINT\b/)) return 'WORKPRINT';
    if (upper.match(/\bCAM\b|\bCAMRIP\b|\bCAM-RIP\b|\bHDCAM\b/)) return 'CAM';
    if (upper.match(/\bTELESYNC\b|\bHDTS\b|\bPDVD\b/) || upper.match(/\bTS\b(?!C)/)) return 'TELESYNC';
    if (upper.match(/\bTELECINE\b|\bTC\b/)) return 'TELECINE';
    if (upper.match(/\bDVDSCR\b|\bDVD-SCR\b|\bSCREENER\b/)) return 'DVDSCR';
    if (upper.match(/\bR5\b/)) return 'R5';
    
    // Detect resolution (including non-standard resolutions)
    let resolution = 'Unknown';
    if (filename.match(/2160p|4K|UHD/i)) resolution = '2160p';
    else if (filename.match(/1080p/i)) resolution = '1080p';
    else if (filename.match(/720p/i)) resolution = '720p';
    else if (filename.match(/576p/i)) resolution = '576p';
    else if (filename.match(/480p/i)) resolution = '480p';
    else if (filename.match(/\b\d{3,4}p\b/i)) {
      // Handle non-standard resolutions like 800p, 360p etc
      const match = filename.match(/\b(\d{3,4})p\b/i);
      if (match) {
        const height = parseInt(match[1]);
        if (height >= 1000) resolution = '1080p';
        else if (height >= 600) resolution = '720p';
        else resolution = '480p';
      }
    }

    // Detect source type
    let source = '';
    if (filename.match(/\bRemux\b/i)) source = 'Remux';
    else if (filename.match(/\bBluRay\b|\bBDRip\b|\bBD-Rip\b|\bBRRip\b|\bBlu-Ray\b/i)) source = 'Bluray';
    else if (filename.match(/\bWEB-DL\b|\bWEBDL\b|\bWEB\.DL\b/i)) source = 'WEBDL';
    else if (filename.match(/\bWEBRip\b|\bWEB-Rip\b|\bWEB\.Rip\b/i)) source = 'WEBRip';
    else if (filename.match(/\bHDTV\b/i)) source = 'HDTV';
    else if (filename.match(/\bDVDRip\b|\bDVD-Rip\b|\bDVD\b/i)) source = 'DVD';
    else if (filename.match(/\bSDTV\b/i)) source = 'SDTV';
    else if (filename.match(/\bAMZN\b|\bAmazon\b/i)) source = 'AMZN WEBDL';
    else if (filename.match(/\bNF\b|\bNetflix\b/i)) source = 'NF WEBDL';
    else if (filename.match(/\bDSNP\b|\bDisney\+?\b/i)) source = 'DSNP WEBDL';
    else if (filename.match(/\bHMAX\b|\bHBO\s?Max\b/i)) source = 'HMAX WEBDL';
    else if (filename.match(/\bATVP\b|\bAppleTV\+?\b/i)) source = 'ATVP WEBDL';
    else if (filename.match(/\bPCOK\b|\bPeacock\b/i)) source = 'PCOK WEBDL';
    else if (filename.match(/\bWEB\b/i)) source = 'WEB';

    // Combine source and resolution
    if (source && resolution !== 'Unknown') {
      return `${source}-${resolution}`;
    } else if (source) {
      return source;
    }
    return resolution;
  }

  /**
   * Parse video codec from filename
   */
  private parseVideoCodec(filename: string): string | undefined {
    const match = filename.match(/x264|x265|HEVC|H\.264|H\.265|AVC|XVID/i);
    return match ? match[0].toUpperCase() : undefined;
  }

  /**
   * Parse audio codec from filename
   */
  private parseAudioCodec(filename: string): string | undefined {
    const match = filename.match(/DTS|AC3|AAC|FLAC|TrueHD|Atmos|EAC3|DD5\.1|DDP/i);
    return match ? match[0].toUpperCase() : undefined;
  }

  /**
   * Parse release group from filename
   */
  private parseReleaseGroup(filename: string): string | undefined {
    const match = filename.match(/-([A-Za-z0-9]+)(?:\.[^.]+)?$/);
    return match ? match[1] : undefined;
  }

  /**
   * Parse dynamic range (HDR) from filename
   */
  private parseDynamicRange(filename: string): string | undefined {
    if (filename.match(/DoVi|DV|Dolby\.?Vision/i)) return 'Dolby Vision';
    if (filename.match(/HDR10\+|HDR10Plus/i)) return 'HDR10+';
    if (filename.match(/HDR10|HDR/i)) return 'HDR10';
    if (filename.match(/HLG/i)) return 'HLG';
    return undefined;
  }

  /**
   * Parse audio channels from filename
   */
  private parseAudioChannels(filename: string): string | undefined {
    if (filename.match(/7\.1/i)) return '7.1';
    if (filename.match(/5\.1/i)) return '5.1';
    if (filename.match(/2\.0/i)) return '2.0';
    return undefined;
  }

  /**
   * Cancel a download - remove from client and delete from database
   */
  async cancelDownload(downloadId: string, deleteFiles: boolean = false): Promise<boolean> {
    const download = DownloadModel.findById(downloadId);
    if (!download) {
      logger.warn(`[Cancel] Download not found: ${downloadId}`);
      return false;
    }

    logger.info(`[Cancel] Cancelling download: "${download.title}" (id: ${downloadId})`);
    logger.info(`[Cancel] torrent_hash: ${download.torrent_hash}, client_id: ${download.download_client_id}`);

    // If we have a hash/nzo_id and client, remove from client
    if (download.torrent_hash && download.download_client_id) {
      const client = DownloadClientModel.findById(download.download_client_id);
      
      if (client) {
        try {
          if (client.type === 'qbittorrent') {
            const result = await downloadClientService.removeTorrent(
              download.download_client_id,
              download.torrent_hash,
              deleteFiles
            );
            logger.info(`[Cancel] Removed torrent ${download.torrent_hash} from qBittorrent: ${result}`);
          } else if (client.type === 'sabnzbd') {
            const result = await downloadClientService.removeNzb(
              download.download_client_id,
              download.torrent_hash,
              deleteFiles
            );
            logger.info(`[Cancel] Removed NZB ${download.torrent_hash} from SABnzbd: ${result}`);
          }
        } catch (error) {
          logger.error('[Cancel] Failed to remove download from client:', error);
        }
      } else {
        logger.warn(`[Cancel] Client not found: ${download.download_client_id}`);
      }
    } else {
      logger.warn(`[Cancel] Missing hash or client ID - cannot remove from client`);
    }

    // Delete the download record from database
    DownloadModel.delete(downloadId);
    logger.info(`[Cancel] Deleted download record: ${downloadId}`);
    return true;
  }

  /**
   * Get active downloads for a movie
   */
  getActiveDownloadsForMovie(movieId: string): Download | null {
    const downloads = DownloadModel.findByMovieId(movieId);
    return downloads.find(d => 
      d.status === 'queued' || d.status === 'downloading' || d.status === 'importing'
    ) || null;
  }

  /**
   * Get active downloads for an episode
   */
  getActiveDownloadsForEpisode(seriesId: string, seasonNumber: number, episodeNumber: number): Download | null {
    const downloads = DownloadModel.findBySeriesId(seriesId);
    return downloads.find(d => 
      (d.status === 'queued' || d.status === 'downloading' || d.status === 'importing') &&
      d.season_number === seasonNumber &&
      d.episode_number === episodeNumber
    ) || null;
  }
}

export const downloadSyncService = new DownloadSyncService();
