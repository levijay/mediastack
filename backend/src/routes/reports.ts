import { Router } from 'express';
import { ReportsController } from '../controllers/ReportsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All reports endpoints require authentication
router.use(authenticateToken);

// Get filter options (distinct values for combo boxes)
router.get('/filters', ReportsController.getFilterOptions);

// Search movies with filters
router.get('/movies', ReportsController.searchMovies);

// Search episodes with filters
router.get('/episodes', ReportsController.searchEpisodes);

// Get summary statistics
router.get('/stats', ReportsController.getStats);

export default router;
