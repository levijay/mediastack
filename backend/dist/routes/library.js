"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const LibraryController_1 = require("../controllers/LibraryController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
// Recently Added (combined movies + series)
router.get('/recently-added', LibraryController_1.LibraryController.getRecentlyAdded);
// Movies
router.get('/movies', LibraryController_1.LibraryController.getMovies);
router.get('/movies/:id', LibraryController_1.LibraryController.getMovieById);
router.post('/movies', LibraryController_1.LibraryController.addMovie);
router.put('/movies/:id', LibraryController_1.LibraryController.updateMovie);
router.delete('/movies/:id', LibraryController_1.LibraryController.deleteMovie);
router.put('/movies/bulk/update', LibraryController_1.LibraryController.bulkUpdateMovies);
router.delete('/movies/bulk/delete', LibraryController_1.LibraryController.bulkDeleteMovies);
// Movie Files
router.get('/movies/:id/files', LibraryController_1.LibraryController.getMovieFiles);
router.post('/movies/:id/files', LibraryController_1.LibraryController.addMovieFile);
router.delete('/movies/:id/files/:fileId', LibraryController_1.LibraryController.deleteMovieFile);
// Movie Activity Log
router.get('/movies/:id/activity', LibraryController_1.LibraryController.getMovieActivityLog);
// Movie Preview Rename
router.get('/movies/:id/rename', LibraryController_1.LibraryController.previewMovieRename);
router.post('/movies/:id/rename', LibraryController_1.LibraryController.executeMovieRename);
// Movie Fix Match
router.post('/movies/:id/fix-match', LibraryController_1.LibraryController.fixMovieMatch);
// Movie Related (custom related media based on cast, crew, collection, genres)
router.get('/movies/:id/related', LibraryController_1.LibraryController.getRelatedMovies);
router.post('/movies/:id/refresh-metadata', LibraryController_1.LibraryController.refreshMovieMetadata);
// Movie Auto Search
router.post('/movies/:id/search', LibraryController_1.LibraryController.searchMovie);
router.post('/movies/bulk/search', LibraryController_1.LibraryController.bulkSearchMovies);
// Movie Folder Rename
router.get('/movies/:id/folder-rename', LibraryController_1.LibraryController.previewMovieFolderRename);
router.post('/movies/:id/folder-rename', LibraryController_1.LibraryController.executeMovieFolderRename);
router.get('/movies/folder-rename/preview', LibraryController_1.LibraryController.previewAllMovieFolderRenames);
router.post('/movies/folder-rename/execute', LibraryController_1.LibraryController.executeAllMovieFolderRenames);
// TV Series
router.get('/series', LibraryController_1.LibraryController.getSeries);
router.get('/series/:id', LibraryController_1.LibraryController.getSeriesById);
router.post('/series', LibraryController_1.LibraryController.addSeries);
router.put('/series/:id', LibraryController_1.LibraryController.updateSeries);
router.delete('/series/:id', LibraryController_1.LibraryController.deleteSeries);
router.put('/series/bulk/update', LibraryController_1.LibraryController.bulkUpdateSeries);
router.delete('/series/bulk/delete', LibraryController_1.LibraryController.bulkDeleteSeries);
// Series Preview Rename
router.get('/series/:id/rename', LibraryController_1.LibraryController.previewSeriesRename);
router.post('/series/:id/rename', LibraryController_1.LibraryController.executeSeriesRename);
// Series Auto Search
router.post('/series/:id/search', LibraryController_1.LibraryController.searchSeries);
router.post('/series/bulk/search', LibraryController_1.LibraryController.bulkSearchSeries);
// Series Related (custom related media based on cast, crew, genres)
router.get('/series/:id/related', LibraryController_1.LibraryController.getRelatedSeries);
router.post('/series/:id/refresh-metadata', LibraryController_1.LibraryController.refreshSeriesMetadata);
// Seasons & Episodes
router.get('/series/:id/seasons', LibraryController_1.LibraryController.getSeasons);
router.get('/series/:id/episodes', LibraryController_1.LibraryController.getEpisodes);
router.put('/series/:id/seasons/:seasonNumber', LibraryController_1.LibraryController.updateSeason);
router.put('/episodes/:id', LibraryController_1.LibraryController.updateEpisode);
router.delete('/episodes/:id/file', LibraryController_1.LibraryController.deleteEpisodeFile);
router.delete('/series/:id/seasons/:seasonNumber/files', LibraryController_1.LibraryController.deleteSeasonFiles);
// Series Activity Log
router.get('/series/:id/activity', LibraryController_1.LibraryController.getSeriesActivityLog);
// Global Activity (recent)
router.get('/activity', LibraryController_1.LibraryController.getRecentActivity);
// SSE endpoint for real-time activity notifications
router.get('/activity/stream', LibraryController_1.LibraryController.streamActivity);
// Stats
router.get('/stats', LibraryController_1.LibraryController.getStats);
// File Browser for Manual Import
router.get('/browse', LibraryController_1.LibraryController.browseFiles);
// Manual Import
router.post('/movies/:id/manual-import', LibraryController_1.LibraryController.manualImportMovie);
router.post('/series/:id/manual-import', LibraryController_1.LibraryController.manualImportEpisode);
exports.default = router;
//# sourceMappingURL=library.js.map