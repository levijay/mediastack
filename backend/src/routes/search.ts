import { Router } from 'express';
import { SearchController } from '../controllers/SearchController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All search endpoints require authentication
router.use(authenticateToken);

router.get('/all', SearchController.searchAll);
router.get('/movies', SearchController.searchMovies);
router.get('/tv', SearchController.searchTV);
router.get('/trending', SearchController.getTrending);
router.get('/popular', SearchController.getPopular);
router.get('/top-rated', SearchController.getTopRated);
router.get('/upcoming', SearchController.getUpcoming);
router.get('/discover', SearchController.discover);
router.get('/genres', SearchController.getGenres);
router.get('/languages', SearchController.getLanguages);
router.get('/keywords', SearchController.searchKeywords);
router.get('/companies', SearchController.searchCompanies);
router.get('/movie/:id', SearchController.getMovieDetails);
router.get('/movie/:id/credits', SearchController.getMovieCredits);
router.get('/movie/:id/similar', SearchController.getSimilarMovies);
router.get('/tv/:id', SearchController.getTVDetails);
router.get('/tv/:id/credits', SearchController.getTVCredits);
router.get('/tv/:id/season/:seasonNumber', SearchController.getSeasonDetails);
router.get('/tv/:id/similar', SearchController.getSimilarTV);
router.get('/tvdb/:id', SearchController.getTVDBLookup);
router.get('/person/:id', SearchController.getPersonDetails);

// Release search (indexers)
router.get('/releases/movie', SearchController.searchMovieReleases);
router.get('/releases/tv', SearchController.searchTVReleases);

export default router;
