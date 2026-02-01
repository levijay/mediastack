import { Router } from 'express';
import { ArrImportController } from '../controllers/ArrImportController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireRole(['admin']));

// Radarr endpoints
router.post('/radarr/test', ArrImportController.testRadarr);
router.post('/radarr/movies', ArrImportController.getRadarrMovies);
router.post('/radarr/profiles', ArrImportController.getRadarrProfiles);

// Sonarr endpoints
router.post('/sonarr/test', ArrImportController.testSonarr);
router.post('/sonarr/series', ArrImportController.getSonarrSeries);
router.post('/sonarr/profiles', ArrImportController.getSonarrProfiles);

export default router;
