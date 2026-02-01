import { Router } from 'express';
import { SystemController } from '../controllers/SystemController';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/health', SystemController.health);
router.get('/status', SystemController.status);
router.get('/browse', authenticateToken, SystemController.browseFolders);

// Worker management routes
router.get('/workers', authenticateToken, SystemController.getWorkers);
router.get('/workers/:id', authenticateToken, SystemController.getWorker);
router.post('/workers/:id/start', authenticateToken, SystemController.startWorker);
router.post('/workers/:id/stop', authenticateToken, SystemController.stopWorker);
router.post('/workers/:id/restart', authenticateToken, SystemController.restartWorker);
router.post('/workers/:id/run', authenticateToken, SystemController.runWorkerNow);
router.put('/workers/:id/interval', authenticateToken, SystemController.updateWorkerInterval);

// Backup/Restore routes
router.get('/backup', authenticateToken, SystemController.createBackup);
router.get('/backup/info', authenticateToken, SystemController.getBackupInfo);
router.post('/backup/preview', authenticateToken, SystemController.previewBackup);
router.post('/backup/restore', authenticateToken, SystemController.restoreBackup);

// Scheduled backup routes
router.get('/backup/scheduled', authenticateToken, SystemController.getScheduledBackups);
router.get('/backup/scheduled/:filename', authenticateToken, SystemController.downloadScheduledBackup);
router.delete('/backup/scheduled/:filename', authenticateToken, SystemController.deleteScheduledBackup);

export default router;
