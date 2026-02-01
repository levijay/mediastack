import { Router } from 'express';
import { SettingsController } from '../controllers/SettingsController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// User UI settings - available to all authenticated users (no admin required)
// These must be defined BEFORE the admin middleware
router.get('/ui', authenticateToken, SettingsController.getUserUISettings);
router.put('/ui', authenticateToken, SettingsController.updateUserUISettings);

// All routes below require admin role
router.get('/', authenticateToken, requireRole(['admin']), SettingsController.getSettings);
router.put('/', authenticateToken, requireRole(['admin']), SettingsController.updateSetting);
router.post('/test-tmdb', authenticateToken, requireRole(['admin']), SettingsController.testTmdbKey);
router.post('/test-tvdb', authenticateToken, requireRole(['admin']), SettingsController.testTvdbKey);
router.post('/test-omdb', authenticateToken, requireRole(['admin']), SettingsController.testOmdbKey);
router.get('/stats', authenticateToken, requireRole(['admin']), SettingsController.getStats);
router.get('/quality-profiles', authenticateToken, requireRole(['admin']), SettingsController.getQualityProfiles);

// Naming format preview endpoints
router.post('/naming/movie-folder', authenticateToken, requireRole(['admin']), SettingsController.previewMovieFolderName);
router.post('/naming/series-folder', authenticateToken, requireRole(['admin']), SettingsController.previewSeriesFolderName);

// Exclusion list endpoints
router.get('/exclusions', authenticateToken, requireRole(['admin']), SettingsController.getExclusions);
router.post('/exclusions', authenticateToken, requireRole(['admin']), SettingsController.addExclusion);
router.delete('/exclusions/:id', authenticateToken, requireRole(['admin']), SettingsController.removeExclusion);
router.delete('/exclusions', authenticateToken, requireRole(['admin']), SettingsController.clearExclusions);

export default router;
