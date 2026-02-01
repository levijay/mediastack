"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const SystemController_1 = require("../controllers/SystemController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/health', SystemController_1.SystemController.health);
router.get('/status', SystemController_1.SystemController.status);
router.get('/browse', auth_1.authenticateToken, SystemController_1.SystemController.browseFolders);
// Worker management routes
router.get('/workers', auth_1.authenticateToken, SystemController_1.SystemController.getWorkers);
router.get('/workers/:id', auth_1.authenticateToken, SystemController_1.SystemController.getWorker);
router.post('/workers/:id/start', auth_1.authenticateToken, SystemController_1.SystemController.startWorker);
router.post('/workers/:id/stop', auth_1.authenticateToken, SystemController_1.SystemController.stopWorker);
router.post('/workers/:id/restart', auth_1.authenticateToken, SystemController_1.SystemController.restartWorker);
router.post('/workers/:id/run', auth_1.authenticateToken, SystemController_1.SystemController.runWorkerNow);
router.put('/workers/:id/interval', auth_1.authenticateToken, SystemController_1.SystemController.updateWorkerInterval);
// Backup/Restore routes
router.get('/backup', auth_1.authenticateToken, SystemController_1.SystemController.createBackup);
router.get('/backup/info', auth_1.authenticateToken, SystemController_1.SystemController.getBackupInfo);
router.post('/backup/preview', auth_1.authenticateToken, SystemController_1.SystemController.previewBackup);
router.post('/backup/restore', auth_1.authenticateToken, SystemController_1.SystemController.restoreBackup);
// Scheduled backup routes
router.get('/backup/scheduled', auth_1.authenticateToken, SystemController_1.SystemController.getScheduledBackups);
router.get('/backup/scheduled/:filename', auth_1.authenticateToken, SystemController_1.SystemController.downloadScheduledBackup);
router.delete('/backup/scheduled/:filename', auth_1.authenticateToken, SystemController_1.SystemController.deleteScheduledBackup);
exports.default = router;
//# sourceMappingURL=system.js.map