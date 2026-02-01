"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const NotificationController_1 = require("../controllers/NotificationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
// Notifications CRUD (admin only)
router.get('/', (0, auth_1.requireRole)(['admin']), NotificationController_1.NotificationController.getAll);
router.get('/:id', (0, auth_1.requireRole)(['admin']), NotificationController_1.NotificationController.getById);
router.post('/', (0, auth_1.requireRole)(['admin']), NotificationController_1.NotificationController.create);
router.put('/:id', (0, auth_1.requireRole)(['admin']), NotificationController_1.NotificationController.update);
router.delete('/:id', (0, auth_1.requireRole)(['admin']), NotificationController_1.NotificationController.delete);
router.post('/test', (0, auth_1.requireRole)(['admin']), NotificationController_1.NotificationController.test);
router.post('/pushbullet/devices', (0, auth_1.requireRole)(['admin']), NotificationController_1.NotificationController.getPushbulletDevices);
exports.default = router;
//# sourceMappingURL=notifications.js.map