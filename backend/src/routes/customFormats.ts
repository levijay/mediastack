import { Router } from 'express';
import { CustomFormatsController } from '../controllers/CustomFormatsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Custom formats CRUD
router.get('/', authenticateToken, CustomFormatsController.getAll);
router.get('/:id', authenticateToken, CustomFormatsController.getById);
router.post('/', authenticateToken, CustomFormatsController.create);
router.put('/:id', authenticateToken, CustomFormatsController.update);
router.delete('/:id', authenticateToken, CustomFormatsController.delete);

// Import from Trash Guides
router.post('/import', authenticateToken, CustomFormatsController.import);
router.post('/import/bulk', authenticateToken, CustomFormatsController.bulkImport);

// Test release against formats
router.post('/test', authenticateToken, CustomFormatsController.testRelease);

// Batch score releases
router.post('/score', authenticateToken, CustomFormatsController.scoreReleases);

// Profile scores
router.get('/profile/:profileId/scores', authenticateToken, CustomFormatsController.getProfileScores);
router.put('/profile/:profileId/scores', authenticateToken, CustomFormatsController.setProfileScores);
router.put('/profile/:profileId/format/:formatId/score', authenticateToken, CustomFormatsController.setProfileScore);
router.delete('/profile/:profileId/format/:formatId/score', authenticateToken, CustomFormatsController.removeProfileScore);

export default router;
