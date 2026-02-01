import { Router } from 'express';
import { LibraryScannerController } from '../controllers/LibraryScannerController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All scanner endpoints require authentication
router.use(authenticateToken);

router.post('/scan', LibraryScannerController.scanDirectory);
router.get('/library-paths', LibraryScannerController.getLibraryPaths);
router.get('/suggestions', LibraryScannerController.getSuggestions);
router.post('/movies/:movieId/scan', LibraryScannerController.scanMovie);
router.post('/series/:seriesId/episodes', LibraryScannerController.scanSeriesEpisodes);
router.post('/series/:seriesId/manual-import', LibraryScannerController.manualImportSeries);

export default router;
