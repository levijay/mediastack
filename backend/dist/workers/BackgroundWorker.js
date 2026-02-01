"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backgroundWorker = exports.BackgroundWorker = void 0;
const downloadSync_1 = require("../services/downloadSync");
const logger_1 = __importDefault(require("../config/logger"));
const WORKER_NAME = '[DownloadSync]';
class BackgroundWorker {
    constructor() {
        this.syncInterval = null;
        this.isRunning = false;
        this.isSyncing = false;
    }
    start() {
        if (this.isRunning) {
            logger_1.default.info(`${WORKER_NAME} Already running`);
            return;
        }
        this.isRunning = true;
        logger_1.default.info(`${WORKER_NAME} Starting background worker...`);
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
        logger_1.default.info(`${WORKER_NAME} Stopped`);
    }
    async syncDownloads() {
        // Prevent overlapping syncs
        if (this.isSyncing) {
            return;
        }
        this.isSyncing = true;
        try {
            // Use the unified download sync service
            const result = await downloadSync_1.downloadSyncService.syncAllDownloads();
            if (result.synced > 0 || result.completed > 0 || result.failed > 0) {
                logger_1.default.debug(`${WORKER_NAME} Sync complete: ${result.synced} synced, ${result.completed} completed, ${result.failed} failed`);
            }
        }
        catch (error) {
            logger_1.default.error(`${WORKER_NAME} Sync error:`, error);
        }
        finally {
            this.isSyncing = false;
        }
    }
}
exports.BackgroundWorker = BackgroundWorker;
exports.backgroundWorker = new BackgroundWorker();
//# sourceMappingURL=BackgroundWorker.js.map