import { downloadSyncService } from '../services/downloadSync';
import logger from '../config/logger';

const WORKER_NAME = '[DownloadSync]';

export class BackgroundWorker {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isSyncing: boolean = false;

  start() {
    if (this.isRunning) {
      logger.info(`${WORKER_NAME} Already running`);
      return;
    }

    this.isRunning = true;
    logger.info(`${WORKER_NAME} Starting background worker...`);

    // Sync downloads every 15 seconds
    this.syncInterval = setInterval(() => {
      this.syncDownloads();
    }, 15000);

    // Initial sync after 5 seconds to let services initialize
    setTimeout(() => this.syncDownloads(), 5000);
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    logger.info(`${WORKER_NAME} Stopped`);
  }

  private async syncDownloads() {
    // Prevent overlapping syncs
    if (this.isSyncing) {
      return;
    }
    
    this.isSyncing = true;
    
    try {
      // Use the unified download sync service
      const result = await downloadSyncService.syncAllDownloads();
      
      if (result.synced > 0 || result.completed > 0 || result.failed > 0) {
        logger.debug(`${WORKER_NAME} Sync complete: ${result.synced} synced, ${result.completed} completed, ${result.failed} failed`);
      }
    } catch (error) {
      logger.error(`${WORKER_NAME} Sync error:`, error);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const backgroundWorker = new BackgroundWorker();
