import { Router } from 'express';
import { ImageCacheController } from '../controllers/ImageCacheController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Image cache endpoint - no auth required for images
router.get('/cache/:size/*', ImageCacheController.getCachedImage);

// Admin endpoints - require auth
router.get('/cache/stats', authenticateToken, ImageCacheController.getCacheStats);
router.delete('/cache', authenticateToken, ImageCacheController.clearCache);

export default router;
