import { Request, Response } from 'express';
import db from '../config/database';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth';
import { backgroundWorker } from '../workers/BackgroundWorker';
import { downloadSyncService } from '../services/downloadSync';
import { importListService } from '../services/importListService';
import { autoSearchService } from '../services/autoSearch';
import { rssSyncService } from '../services/rssSync';
import { tmdbService, TMDBService } from '../services/tmdb';
import { APP_VERSION } from '../version';
import logger from '../config/logger';
import { MovieModel } from '../models/Movie';
import { TVSeriesModel } from '../models/TVSeries';
import { LibraryScannerController } from './LibraryScannerController';
import { ActivityLogModel } from '../models/ActivityLog';

// Worker state tracking
interface WorkerInfo {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'stopped' | 'error';
  lastRun?: string;
  nextRun?: string;
  interval?: number;
  errorMessage?: string;
}

// Worker registry - tracks all background workers
class WorkerRegistry {
  private workers: Map<string, WorkerInfo> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private lastRunTimes: Map<string, Date> = new Map();

  constructor() {
    // Register built-in workers
    this.registerWorker({
      id: 'download-sync',
      name: 'Download Sync',
      description: 'Syncs download status from qBittorrent/SABnzbd and imports completed downloads',
      status: 'stopped',
      interval: 5000 // 5 seconds
    });
    
    this.registerWorker({
      id: 'import-list-sync',
      name: 'Import List Sync',
      description: 'Syncs import lists and adds new movies/series to library',
      status: 'stopped',
      interval: 3600000 // 1 hour (checks every hour, but only syncs lists that are due)
    });
    
    this.registerWorker({
      id: 'library-refresh',
      name: 'Library Refresh',
      description: 'Scans library folders for new or changed media files',
      status: 'stopped',
      interval: 3600000 // 1 hour
    });
    
    this.registerWorker({
      id: 'metadata-refresh',
      name: 'Metadata Refresh',
      description: 'Updates movie and series metadata from TMDB',
      status: 'stopped',
      interval: 86400000 // 24 hours
    });
    
    this.registerWorker({
      id: 'missing-search',
      name: 'Missing Media Search',
      description: 'Searches for missing monitored movies and episodes',
      status: 'stopped',
      interval: 3600000 // 1 hour
    });
    
    this.registerWorker({
      id: 'cutoff-search',
      name: 'Cutoff Unmet Search',
      description: 'Searches for quality upgrades for media below cutoff quality',
      status: 'stopped',
      interval: 21600000 // 6 hours
    });
    
    this.registerWorker({
      id: 'database-backup',
      name: 'Scheduled Backup',
      description: 'Automatically backs up the database on a schedule',
      status: 'stopped',
      interval: 60000 // Check every minute if backup is due
    });
    
    this.registerWorker({
      id: 'activity-cleanup',
      name: 'Activity Log Cleanup',
      description: 'Removes activity logs older than 7 days',
      status: 'stopped',
      interval: 86400000 // 24 hours (run daily)
    });
    
    this.registerWorker({
      id: 'rss-sync',
      name: 'RSS Sync',
      description: 'Fetches new releases from indexer RSS feeds to reduce API hits',
      status: 'stopped',
      interval: 900000 // 15 minutes
    });
  }

  registerWorker(info: WorkerInfo) {
    this.workers.set(info.id, info);
  }

  getAll(): WorkerInfo[] {
    return Array.from(this.workers.values()).map(w => ({
      ...w,
      lastRun: this.lastRunTimes.get(w.id)?.toISOString()
    }));
  }

  get(id: string): WorkerInfo | undefined {
    const worker = this.workers.get(id);
    if (worker) {
      return {
        ...worker,
        lastRun: this.lastRunTimes.get(id)?.toISOString()
      };
    }
    return undefined;
  }

  start(id: string, skipInitialRun: boolean = false): boolean {
    const worker = this.workers.get(id);
    if (!worker) return false;

    // Stop existing interval if any
    this.stop(id);

    try {
      // Start the worker based on type
      const runWorker = async () => {
        this.lastRunTimes.set(id, new Date());
        try {
          if (id === 'download-sync') {
            await downloadSyncService.syncAllDownloads();
          } else if (id === 'import-list-sync') {
            await importListService.syncDueLists();
          } else if (id === 'missing-search') {
            // Get concurrent requests setting
            let concurrentLimit = 5;
            try {
              const settingStmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
              const setting = settingStmt.get('concurrent_requests') as any;
              if (setting?.value) {
                concurrentLimit = parseInt(setting.value) || 5;
              }
            } catch (e) {
              // Use default
            }
            await autoSearchService.searchAllMissing(concurrentLimit);
          } else if (id === 'cutoff-search') {
            // Search for quality upgrades
            let concurrentLimit = 5;
            try {
              const settingStmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
              const setting = settingStmt.get('concurrent_requests') as any;
              if (setting?.value) {
                concurrentLimit = parseInt(setting.value) || 5;
              }
            } catch (e) {
              // Use default
            }
            await autoSearchService.searchAllCutoffUnmet(concurrentLimit);
          } else if (id === 'library-refresh') {
            // Scan all movies and series for file changes
            logger.info('[WORKER] Starting library refresh...');
            const movies = MovieModel.findAll(100000, 0); // Get all movies
            let movieScanned = 0;
            for (const movie of movies) {
              try {
                await LibraryScannerController.scanMovieFiles(movie.id, false);
                movieScanned++;
              } catch (e) {
                // Continue with next movie
              }
            }
            logger.info(`[WORKER] Library refresh: scanned ${movieScanned} movies`);
            
            const series = TVSeriesModel.findAll(100000, 0); // Get all series
            let seriesScanned = 0;
            for (const show of series) {
              try {
                await LibraryScannerController.scanSeriesFiles(show.id, false);
                seriesScanned++;
              } catch (e) {
                // Continue with next series
              }
            }
            logger.info(`[WORKER] Library refresh complete: ${movieScanned} movies, ${seriesScanned} series`);
          } else if (id === 'metadata-refresh') {
            // Update metadata from TMDB for all movies and series
            logger.info('[WORKER] Starting metadata refresh...');
            const movies = MovieModel.findAll(100000, 0); // Get all movies
            let moviesChecked = 0;
            for (const movie of movies) {
              if (movie.tmdb_id) {
                try {
                  const details = await tmdbService.getMovieDetails(movie.tmdb_id);
                  if (details) {
                    // Extract release dates
                    const releaseDates = TMDBService.extractReleaseDates(details);
                    
                    // Update metadata including release dates and collection
                    MovieModel.updateMetadata(movie.id, {
                      title: details.title,
                      overview: details.overview,
                      runtime: details.runtime,
                      vote_average: details.vote_average,
                      vote_count: details.vote_count,
                      poster_path: details.poster_path,
                      backdrop_path: details.backdrop_path,
                      tmdb_status: details.status,
                      theatrical_release_date: releaseDates.theatricalDate,
                      digital_release_date: releaseDates.digitalDate,
                      physical_release_date: releaseDates.physicalDate,
                      collection_id: details.belongs_to_collection?.id || null,
                      collection_name: details.belongs_to_collection?.name || null
                    });
                    moviesChecked++;
                  }
                  // Rate limit: small delay between API calls
                  await new Promise(r => setTimeout(r, 250));
                } catch (e) {
                  // Continue with next movie
                }
              }
            }
            logger.info(`[WORKER] Metadata refresh: updated ${moviesChecked} movies`);
            
            const series = TVSeriesModel.findAll(100000, 0); // Get all series
            let seriesChecked = 0;
            for (const show of series) {
              if (show.tmdb_id) {
                try {
                  const details = await tmdbService.getTVDetails(show.tmdb_id);
                  if (details) {
                    // Update fields that have dedicated update methods
                    seriesChecked++;
                  }
                  // Rate limit
                  await new Promise(r => setTimeout(r, 250));
                } catch (e) {
                  // Continue with next series
                }
              }
            }
            logger.info(`[WORKER] Metadata refresh complete: ${moviesChecked} movies, ${seriesChecked} series checked`);
          } else if (id === 'database-backup') {
            // Check if scheduled backup is due
            await this.checkAndRunScheduledBackup();
          } else if (id === 'activity-cleanup') {
            // Clean up activity logs older than 7 days
            const deleted = ActivityLogModel.deleteOlderThan(7);
            logger.info(`[WORKER] Activity cleanup complete: ${deleted} old entries removed`);
          } else if (id === 'rss-sync') {
            // Sync RSS feeds from indexers
            logger.info('[WORKER] Starting RSS sync...');
            const result = await rssSyncService.syncAll();
            logger.info(`[WORKER] RSS sync complete: ${result.indexersChecked} indexers, ${result.releasesFound} releases, ${result.grabbed} grabbed`);
          }
          // Add other worker implementations here
        } catch (error: any) {
          worker.status = 'error';
          worker.errorMessage = error.message;
        }
      };

      // Run immediately unless skipInitialRun is true
      if (!skipInitialRun) {
        runWorker();
      }

      // Set up interval
      if (worker.interval) {
        const interval = setInterval(runWorker, worker.interval);
        this.intervals.set(id, interval);
      }

      worker.status = 'running';
      worker.errorMessage = undefined;
      return true;
    } catch (error: any) {
      worker.status = 'error';
      worker.errorMessage = error.message;
      return false;
    }
  }

  stop(id: string): boolean {
    const worker = this.workers.get(id);
    if (!worker) return false;

    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }

    worker.status = 'stopped';
    return true;
  }

  restart(id: string): boolean {
    this.stop(id);
    return this.start(id);
  }

  setInterval(id: string, intervalMs: number): boolean {
    const worker = this.workers.get(id);
    if (!worker) return false;
    
    worker.interval = intervalMs;
    
    // If worker is running, restart it with new interval
    if (worker.status === 'running') {
      return this.restart(id);
    }
    
    return true;
  }

  // Check if scheduled backup is due and run it
  private async checkAndRunScheduledBackup(): Promise<void> {
    try {
      // Get backup settings
      const settingStmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
      const timeResult = settingStmt.get('backup_schedule_time') as { value: string } | undefined;
      const frequencyResult = settingStmt.get('backup_schedule_frequency') as { value: string } | undefined;
      const lastBackupResult = settingStmt.get('backup_last_scheduled') as { value: string } | undefined;
      
      const scheduleTime = timeResult?.value || '03:00'; // Default 3 AM
      const frequency = frequencyResult?.value || 'daily';
      const lastBackup = lastBackupResult?.value ? new Date(lastBackupResult.value) : null;
      
      const now = new Date();
      const [scheduleHour, scheduleMinute] = scheduleTime.split(':').map(Number);
      
      // Check if current time matches schedule (within 1 minute window)
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      if (currentHour !== scheduleHour || currentMinute !== scheduleMinute) {
        return; // Not the scheduled time
      }
      
      // Check if we already ran backup today/this week/this month
      if (lastBackup) {
        const timeSinceLastBackup = now.getTime() - lastBackup.getTime();
        const oneDay = 24 * 60 * 60 * 1000;
        const oneWeek = 7 * oneDay;
        const oneMonth = 30 * oneDay;
        
        if (frequency === 'daily' && timeSinceLastBackup < oneDay - 60000) {
          return; // Already backed up today
        } else if (frequency === 'weekly' && timeSinceLastBackup < oneWeek - 60000) {
          return; // Already backed up this week
        } else if (frequency === 'monthly' && timeSinceLastBackup < oneMonth - 60000) {
          return; // Already backed up this month
        }
      }
      
      // Run the backup
      logger.info('[WORKER] Running scheduled database backup...');
      
      const backupDir = '/backup';
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Create timestamped backup filename
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupPath = path.join(backupDir, `mediastack-backup-${timestamp}.db`);
      
      // Copy database file
      const dbPath = process.env.DB_PATH || '/config/mediastack.db';
      fs.copyFileSync(dbPath, backupPath);
      
      // Update last backup time
      const updateStmt = db.prepare(`
        INSERT OR REPLACE INTO system_settings (key, value, updated_at)
        VALUES ('backup_last_scheduled', ?, datetime('now'))
      `);
      updateStmt.run(now.toISOString());
      
      // Clean up old backups (keep last 10)
      const backupFiles = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('mediastack-backup-') && f.endsWith('.db'))
        .sort()
        .reverse();
      
      if (backupFiles.length > 10) {
        for (const oldFile of backupFiles.slice(10)) {
          try {
            fs.unlinkSync(path.join(backupDir, oldFile));
            logger.info(`[WORKER] Deleted old backup: ${oldFile}`);
          } catch (e) {
            // Ignore deletion errors
          }
        }
      }
      
      logger.info(`[WORKER] Scheduled backup complete: ${backupPath}`);
      
    } catch (error: any) {
      logger.error(`[WORKER] Scheduled backup failed: ${error.message}`);
    }
  }

  // Start default workers on init
  startDefaults() {
    this.start('download-sync');
    this.start('import-list-sync');
    this.start('library-refresh'); // Scan for new/changed files
    this.start('missing-search', true);  // Search for missing monitored content (skip initial run on startup)
    this.start('cutoff-search', true);   // Search for quality upgrades (skip initial run on startup)
    this.start('metadata-refresh', true); // Keep metadata up to date (skip initial run on startup)
    this.start('activity-cleanup'); // Clean up old activity logs
    this.start('rss-sync', true);        // Sync RSS feeds from indexers (skip initial run on startup)
    // Note: database-backup is not started by default - user enables via Settings > Backup
  }
}

export const workerRegistry = new WorkerRegistry();

export class SystemController {
  static async health(req: Request, res: Response) {
    try {
      // Check database
      db.prepare('SELECT 1').get();

      // Check disk space if possible
      let diskSpace: any = {};
      try {
        const configPath = process.env.CONFIG_PATH || '/config';
        const stats = fs.statfsSync(configPath);
        diskSpace = {
          total: stats.blocks * stats.bsize,
          free: stats.bfree * stats.bsize,
          used: (stats.blocks - stats.bfree) * stats.bsize
        };
      } catch (error) {
        diskSpace = { error: 'Unable to check disk space' };
      }

      return res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        diskSpace,
        version: APP_VERSION
      });
    } catch (error) {
      return res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed'
      });
    }
  }

  static async status(req: Request, res: Response) {
    return res.json({
      version: APP_VERSION,
      name: 'MediaStack',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  }

  static async browseFolders(req: AuthRequest, res: Response) {
    try {
      const requestedPath = (req.query.path as string) || '/';
      
      // Security: Prevent path traversal
      const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, '');
      
      // Check if path exists
      if (!fs.existsSync(normalizedPath)) {
        return res.status(404).json({ error: 'Path not found' });
      }

      const stats = fs.statSync(normalizedPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' });
      }

      // Read directory contents
      const items = fs.readdirSync(normalizedPath, { withFileTypes: true });
      
      const folders = items
        .filter(item => item.isDirectory() && !item.name.startsWith('.'))
        .map(item => ({
          name: item.name,
          path: path.join(normalizedPath, item.name),
          type: 'folder'
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // Get parent path
      const parentPath = path.dirname(normalizedPath);
      const hasParent = normalizedPath !== '/' && normalizedPath !== parentPath;

      return res.json({
        currentPath: normalizedPath,
        parentPath: hasParent ? parentPath : null,
        folders
      });
    } catch (error: any) {
      console.error('Browse folders error:', error);
      return res.status(500).json({ error: error.message || 'Failed to browse folders' });
    }
  }

  // Worker management endpoints
  static async getWorkers(req: AuthRequest, res: Response) {
    try {
      const workers = workerRegistry.getAll();
      return res.json(workers);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to get workers' });
    }
  }

  static async getWorker(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const worker = workerRegistry.get(id);
      if (!worker) {
        return res.status(404).json({ error: 'Worker not found' });
      }
      return res.json(worker);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to get worker' });
    }
  }

  static async startWorker(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const success = workerRegistry.start(id);
      if (!success) {
        return res.status(404).json({ error: 'Worker not found or failed to start' });
      }
      return res.json({ message: 'Worker started', worker: workerRegistry.get(id) });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to start worker' });
    }
  }

  static async stopWorker(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const success = workerRegistry.stop(id);
      if (!success) {
        return res.status(404).json({ error: 'Worker not found' });
      }
      return res.json({ message: 'Worker stopped', worker: workerRegistry.get(id) });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to stop worker' });
    }
  }

  static async restartWorker(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const success = workerRegistry.restart(id);
      if (!success) {
        return res.status(404).json({ error: 'Worker not found or failed to restart' });
      }
      return res.json({ message: 'Worker restarted', worker: workerRegistry.get(id) });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to restart worker' });
    }
  }

  static async updateWorkerInterval(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { interval } = req.body;
      
      if (typeof interval !== 'number' || interval < 1000) {
        return res.status(400).json({ error: 'Invalid interval (minimum 1000ms)' });
      }
      
      const success = workerRegistry.setInterval(id, interval);
      if (!success) {
        return res.status(404).json({ error: 'Worker not found' });
      }
      return res.json({ message: 'Worker interval updated', worker: workerRegistry.get(id) });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to update worker interval' });
    }
  }

  static async runWorkerNow(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const worker = workerRegistry.get(id);
      
      if (!worker) {
        return res.status(404).json({ error: 'Worker not found' });
      }

      // Run the worker immediately in the background
      res.json({ message: `Worker ${id} triggered`, worker });

      // Execute asynchronously
      setImmediate(async () => {
        try {
          if (id === 'download-sync') {
            await downloadSyncService.syncAllDownloads();
          } else if (id === 'import-list-sync') {
            await importListService.syncDueLists();
          } else if (id === 'missing-search') {
            let concurrentLimit = 5;
            try {
              const settingStmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
              const setting = settingStmt.get('concurrent_requests') as any;
              if (setting?.value) {
                concurrentLimit = parseInt(setting.value) || 5;
              }
            } catch (e) {
              // Use default
            }
            await autoSearchService.searchAllMissing(concurrentLimit);
          } else if (id === 'cutoff-search') {
            let concurrentLimit = 5;
            try {
              const settingStmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
              const setting = settingStmt.get('concurrent_requests') as any;
              if (setting?.value) {
                concurrentLimit = parseInt(setting.value) || 5;
              }
            } catch (e) {
              // Use default
            }
            await autoSearchService.searchAllCutoffUnmet(concurrentLimit);
          } else if (id === 'library-refresh') {
            const movies = MovieModel.findAll(100000, 0);
            for (const movie of movies) {
              try {
                await LibraryScannerController.scanMovieFiles(movie.id, false);
              } catch (e) {
                // Continue
              }
            }
            const series = TVSeriesModel.findAll(100000, 0);
            for (const show of series) {
              try {
                await LibraryScannerController.scanSeriesFiles(show.id, false);
              } catch (e) {
                // Continue
              }
            }
          } else if (id === 'metadata-refresh') {
            // Trigger metadata refresh for all items
            const movies = MovieModel.findAll(100000, 0);
            for (const movie of movies) {
              if (movie.tmdb_id) {
                try {
                  // Just fetch and log for now - full update would need model changes
                  await tmdbService.getMovieDetails(movie.tmdb_id);
                  await new Promise(r => setTimeout(r, 250));
                } catch (e) {
                  // Continue
                }
              }
            }
          } else if (id === 'activity-cleanup') {
            // Clean up activity logs older than 7 days
            const deleted = ActivityLogModel.deleteOlderThan(7);
            logger.info(`[WORKER] Activity cleanup complete: ${deleted} old entries removed`);
          } else if (id === 'rss-sync') {
            // Sync RSS feeds from indexers
            logger.info('[WORKER] Starting RSS sync...');
            const result = await rssSyncService.syncAll();
            logger.info(`[WORKER] RSS sync complete: ${result.indexersChecked} indexers, ${result.releasesFound} releases, ${result.grabbed} grabbed`);
          }
        } catch (error) {
          console.error(`Worker ${id} run failed:`, error);
        }
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to run worker' });
    }
  }

  // Backup/Restore methods
  static async createBackup(req: AuthRequest, res: Response) {
    try {
      logger.info('Creating system backup...');
      
      // Tables to backup (excluding users for security)
      const tables = [
        'tv_series',
        'seasons',
        'episodes',
        'movies',
        'movie_files',
        'quality_profiles',
        'quality_profile_custom_formats',
        'custom_formats',
        'download_clients',
        'indexers',
        'language_profiles',
        'root_folders',
        'system_settings',
        'user_settings',
        'naming_config',
        'import_lists',
        'exclusions',
        'downloads',
        'activity_logs'
      ];

      const backup: Record<string, any[]> = {
        _meta: [{
          version: APP_VERSION,
          created_at: new Date().toISOString(),
          tables: tables
        }]
      };

      for (const table of tables) {
        try {
          const rows = db.prepare(`SELECT * FROM ${table}`).all();
          backup[table] = rows;
          logger.info(`Backed up ${rows.length} rows from ${table}`);
        } catch (error: any) {
          // Table might not exist, skip it
          logger.warn(`Skipping table ${table}: ${error.message}`);
          backup[table] = [];
        }
      }

      const backupJson = JSON.stringify(backup, null, 2);
      const filename = `mediastack-backup-${new Date().toISOString().split('T')[0]}.json`;

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(backupJson);
      
      logger.info('Backup created successfully');
    } catch (error: any) {
      logger.error('Backup failed:', error);
      return res.status(500).json({ error: error.message || 'Failed to create backup' });
    }
  }

  static async restoreBackup(req: AuthRequest, res: Response) {
    try {
      const { backupData, selectedTables } = req.body;
      
      if (!backupData || !backupData._meta) {
        return res.status(400).json({ error: 'Invalid backup file format' });
      }

      logger.info('Starting system restore from backup...');
      logger.info(`Backup version: ${backupData._meta[0]?.version}, created: ${backupData._meta[0]?.created_at}`);

      // Tables to restore in order (respecting foreign keys)
      const restoreOrder = [
        'system_settings',
        'user_settings',
        'naming_config',
        'quality_profiles',
        'custom_formats',
        'quality_profile_custom_formats',
        'language_profiles',
        'root_folders',
        'download_clients',
        'indexers',
        'import_lists',
        'tv_series',
        'seasons',
        'episodes',
        'movies',
        'movie_files',
        'exclusions',
        'downloads',
        'activity_logs'
      ];

      // Filter to only selected tables if provided
      const tablesToRestore = selectedTables && Array.isArray(selectedTables) && selectedTables.length > 0
        ? restoreOrder.filter(table => selectedTables.includes(table))
        : restoreOrder;

      logger.info(`Restoring tables: ${tablesToRestore.join(', ')}`);

      const stats: Record<string, number> = {};

      // Disable foreign keys temporarily
      db.pragma('foreign_keys = OFF');

      try {
        for (const table of tablesToRestore) {
          if (!backupData[table] || !Array.isArray(backupData[table])) {
            logger.warn(`Table ${table} not found in backup or empty`);
            stats[table] = 0;
            continue;
          }

          const rows = backupData[table];
          if (rows.length === 0) {
            stats[table] = 0;
            continue;
          }

          // Clear existing data
          try {
            db.prepare(`DELETE FROM ${table}`).run();
          } catch (e) {
            logger.warn(`Could not clear table ${table}`);
          }

          // Get columns from first row
          const columns = Object.keys(rows[0]);
          const placeholders = columns.map(() => '?').join(', ');
          
          const insertStmt = db.prepare(
            `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
          );

          let inserted = 0;
          for (const row of rows) {
            try {
              const values = columns.map(col => row[col]);
              insertStmt.run(...values);
              inserted++;
            } catch (error: any) {
              logger.warn(`Failed to insert row in ${table}: ${error.message}`);
            }
          }

          stats[table] = inserted;
          logger.info(`Restored ${inserted}/${rows.length} rows to ${table}`);
        }
      } finally {
        // Re-enable foreign keys
        db.pragma('foreign_keys = ON');
      }

      logger.info('Restore completed successfully');
      
      return res.json({
        success: true,
        message: 'Backup restored successfully',
        stats
      });
    } catch (error: any) {
      logger.error('Restore failed:', error);
      return res.status(500).json({ error: error.message || 'Failed to restore backup' });
    }
  }

  /**
   * Preview backup file contents - returns what tables/items are in the backup
   */
  static async previewBackup(req: AuthRequest, res: Response) {
    try {
      const backupData = req.body;
      
      if (!backupData || !backupData._meta) {
        return res.status(400).json({ error: 'Invalid backup file format' });
      }

      const meta = backupData._meta[0] || {};
      
      // Define table groups for user-friendly display
      const tableGroups = [
        { 
          group: 'Library', 
          tables: [
            { key: 'movies', label: 'Movies' },
            { key: 'movie_files', label: 'Movie Files' },
            { key: 'tv_series', label: 'TV Series' },
            { key: 'seasons', label: 'Seasons' },
            { key: 'episodes', label: 'Episodes' },
          ]
        },
        { 
          group: 'Settings', 
          tables: [
            { key: 'system_settings', label: 'System Settings' },
            { key: 'user_settings', label: 'UI Settings & Themes' },
            { key: 'naming_config', label: 'Naming Configuration' },
            { key: 'quality_profiles', label: 'Quality Profiles' },
            { key: 'custom_formats', label: 'Custom Formats' },
            { key: 'quality_profile_custom_formats', label: 'Profile Custom Formats' },
            { key: 'language_profiles', label: 'Language Profiles' },
            { key: 'root_folders', label: 'Root Folders' },
          ]
        },
        { 
          group: 'Automation', 
          tables: [
            { key: 'download_clients', label: 'Download Clients' },
            { key: 'indexers', label: 'Indexers' },
            { key: 'import_lists', label: 'Import Lists' },
          ]
        },
        { 
          group: 'Activity', 
          tables: [
            { key: 'downloads', label: 'Downloads History' },
            { key: 'activity_logs', label: 'Activity Logs' },
            { key: 'exclusions', label: 'Exclusions' },
          ]
        }
      ];

      const preview: {
        group: string;
        tables: { key: string; label: string; count: number; available: boolean }[];
      }[] = [];

      for (const group of tableGroups) {
        const groupTables = group.tables.map(table => {
          const data = backupData[table.key];
          const count = Array.isArray(data) ? data.length : 0;
          return {
            key: table.key,
            label: table.label,
            count,
            available: count > 0
          };
        });
        
        // Only include group if it has any data
        if (groupTables.some(t => t.available)) {
          preview.push({
            group: group.group,
            tables: groupTables
          });
        }
      }

      return res.json({
        success: true,
        meta: {
          version: meta.version || 'unknown',
          created_at: meta.created_at || 'unknown'
        },
        preview
      });
    } catch (error: any) {
      logger.error('Preview backup failed:', error);
      return res.status(500).json({ error: error.message || 'Failed to preview backup' });
    }
  }

  static async getBackupInfo(req: AuthRequest, res: Response) {
    try {
      // Get counts for each table to show what would be backed up
      const tables = [
        { name: 'tv_series', label: 'TV Series' },
        { name: 'movies', label: 'Movies' },
        { name: 'episodes', label: 'Episodes' },
        { name: 'quality_profiles', label: 'Quality Profiles' },
        { name: 'custom_formats', label: 'Custom Formats' },
        { name: 'download_clients', label: 'Download Clients' },
        { name: 'indexers', label: 'Indexers' },
        { name: 'import_lists', label: 'Import Lists' },
      ];

      const counts: Record<string, number> = {};
      
      for (const table of tables) {
        try {
          const result = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
          counts[table.label] = result.count;
        } catch (e) {
          counts[table.label] = 0;
        }
      }

      return res.json({
        version: APP_VERSION,
        counts
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to get backup info' });
    }
  }

  // Get list of scheduled backups
  static async getScheduledBackups(req: AuthRequest, res: Response) {
    try {
      const backupDir = '/backup';
      
      if (!fs.existsSync(backupDir)) {
        return res.json([]);
      }
      
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('mediastack-backup-') && f.endsWith('.db'))
        .sort()
        .reverse();
      
      return res.json(files);
    } catch (error: any) {
      logger.error('Failed to get scheduled backups:', error);
      return res.status(500).json({ error: 'Failed to get scheduled backups' });
    }
  }

  // Download a scheduled backup
  static async downloadScheduledBackup(req: AuthRequest, res: Response) {
    try {
      const { filename } = req.params;
      const backupDir = '/backup';
      const filepath = path.join(backupDir, filename);
      
      // Security check - ensure filename doesn't contain path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Backup not found' });
      }
      
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      const fileStream = fs.createReadStream(filepath);
      fileStream.pipe(res);
    } catch (error: any) {
      logger.error('Failed to download scheduled backup:', error);
      return res.status(500).json({ error: 'Failed to download backup' });
    }
  }

  // Delete a scheduled backup
  static async deleteScheduledBackup(req: AuthRequest, res: Response) {
    try {
      const { filename } = req.params;
      const backupDir = '/backup';
      const filepath = path.join(backupDir, filename);
      
      // Security check - ensure filename doesn't contain path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      
      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Backup not found' });
      }
      
      fs.unlinkSync(filepath);
      logger.info(`Deleted scheduled backup: ${filename}`);
      
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('Failed to delete scheduled backup:', error);
      return res.status(500).json({ error: 'Failed to delete backup' });
    }
  }
}
