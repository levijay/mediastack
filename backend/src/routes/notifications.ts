import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Notifications CRUD (admin only)
router.get('/', requireRole(['admin']), NotificationController.getAll);
router.get('/:id', requireRole(['admin']), NotificationController.getById);
router.post('/', requireRole(['admin']), NotificationController.create);
router.put('/:id', requireRole(['admin']), NotificationController.update);
router.delete('/:id', requireRole(['admin']), NotificationController.delete);
router.post('/test', requireRole(['admin']), NotificationController.test);
router.post('/pushbullet/devices', requireRole(['admin']), NotificationController.getPushbulletDevices);

export default router;
