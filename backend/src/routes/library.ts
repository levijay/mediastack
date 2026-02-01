import { Router } from 'express';
import { LibraryController } from '../controllers/LibraryController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Recently Added (combined movies + series)
router.get('/recently-added', LibraryController.getRecentlyAdded);

// Movies
router.get('/movies', LibraryController.getMovies);
router.get('/movies/:id', LibraryController.getMovieById);
router.post('/movies', LibraryController.addMovie);
router.put('/movies/:id', LibraryController.updateMovie);
router.delete('/movies/:id', LibraryController.deleteMovie);
router.put('/movies/bulk/update', LibraryController.bulkUpdateMovies);
router.delete('/movies/bulk/delete', LibraryController.bulkDeleteMovies);

// Movie Files
router.get('/movies/:id/files', LibraryController.getMovieFiles);
router.post('/movies/:id/files', LibraryController.addMovieFile);
router.delete('/movies/:id/files/:fileId', LibraryController.deleteMovieFile);

// Movie Activity Log
router.get('/movies/:id/activity', LibraryController.getMovieActivityLog);

// Movie Preview Rename
router.get('/movies/:id/rename', LibraryController.previewMovieRename);
router.post('/movies/:id/rename', LibraryController.executeMovieRename);

// Movie Fix Match
router.post('/movies/:id/fix-match', LibraryController.fixMovieMatch);

// Movie Related (custom related media based on cast, crew, collection, genres)
router.get('/movies/:id/related', LibraryController.getRelatedMovies);
router.post('/movies/:id/refresh-metadata', LibraryController.refreshMovieMetadata);

// Movie Auto Search
router.post('/movies/:id/search', LibraryController.searchMovie);
router.post('/movies/bulk/search', LibraryController.bulkSearchMovies);

// Movie Folder Rename
router.get('/movies/:id/folder-rename', LibraryController.previewMovieFolderRename);
router.post('/movies/:id/folder-rename', LibraryController.executeMovieFolderRename);
router.get('/movies/folder-rename/preview', LibraryController.previewAllMovieFolderRenames);
router.post('/movies/folder-rename/execute', LibraryController.executeAllMovieFolderRenames);

// TV Series
router.get('/series', LibraryController.getSeries);
router.get('/series/:id', LibraryController.getSeriesById);
router.post('/series', LibraryController.addSeries);
router.put('/series/:id', LibraryController.updateSeries);
router.delete('/series/:id', LibraryController.deleteSeries);
router.put('/series/bulk/update', LibraryController.bulkUpdateSeries);
router.delete('/series/bulk/delete', LibraryController.bulkDeleteSeries);

// Series Preview Rename
router.get('/series/:id/rename', LibraryController.previewSeriesRename);
router.post('/series/:id/rename', LibraryController.executeSeriesRename);

// Series Auto Search
router.post('/series/:id/search', LibraryController.searchSeries);
router.post('/series/bulk/search', LibraryController.bulkSearchSeries);

// Series Related (custom related media based on cast, crew, genres)
router.get('/series/:id/related', LibraryController.getRelatedSeries);
router.post('/series/:id/refresh-metadata', LibraryController.refreshSeriesMetadata);

// Seasons & Episodes
router.get('/series/:id/seasons', LibraryController.getSeasons);
router.get('/series/:id/episodes', LibraryController.getEpisodes);
router.put('/series/:id/seasons/:seasonNumber', LibraryController.updateSeason);
router.put('/episodes/:id', LibraryController.updateEpisode);
router.delete('/episodes/:id/file', LibraryController.deleteEpisodeFile);
router.delete('/series/:id/seasons/:seasonNumber/files', LibraryController.deleteSeasonFiles);

// Series Activity Log
router.get('/series/:id/activity', LibraryController.getSeriesActivityLog);

// Global Activity (recent)
router.get('/activity', LibraryController.getRecentActivity);

// SSE endpoint for real-time activity notifications
router.get('/activity/stream', LibraryController.streamActivity);

// Stats
router.get('/stats', LibraryController.getStats);

// File Browser for Manual Import
router.get('/browse', LibraryController.browseFiles);

// Manual Import
router.post('/movies/:id/manual-import', LibraryController.manualImportMovie);
router.post('/series/:id/manual-import', LibraryController.manualImportEpisode);

export default router;
