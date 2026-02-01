"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const SearchController_1 = require("../controllers/SearchController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All search endpoints require authentication
router.use(auth_1.authenticateToken);
router.get('/all', SearchController_1.SearchController.searchAll);
router.get('/movies', SearchController_1.SearchController.searchMovies);
router.get('/tv', SearchController_1.SearchController.searchTV);
router.get('/trending', SearchController_1.SearchController.getTrending);
router.get('/popular', SearchController_1.SearchController.getPopular);
router.get('/top-rated', SearchController_1.SearchController.getTopRated);
router.get('/upcoming', SearchController_1.SearchController.getUpcoming);
router.get('/discover', SearchController_1.SearchController.discover);
router.get('/genres', SearchController_1.SearchController.getGenres);
router.get('/languages', SearchController_1.SearchController.getLanguages);
router.get('/keywords', SearchController_1.SearchController.searchKeywords);
router.get('/companies', SearchController_1.SearchController.searchCompanies);
router.get('/movie/:id', SearchController_1.SearchController.getMovieDetails);
router.get('/movie/:id/credits', SearchController_1.SearchController.getMovieCredits);
router.get('/movie/:id/similar', SearchController_1.SearchController.getSimilarMovies);
router.get('/tv/:id', SearchController_1.SearchController.getTVDetails);
router.get('/tv/:id/credits', SearchController_1.SearchController.getTVCredits);
router.get('/tv/:id/season/:seasonNumber', SearchController_1.SearchController.getSeasonDetails);
router.get('/tv/:id/similar', SearchController_1.SearchController.getSimilarTV);
router.get('/tvdb/:id', SearchController_1.SearchController.getTVDBLookup);
router.get('/person/:id', SearchController_1.SearchController.getPersonDetails);
// Release search (indexers)
router.get('/releases/movie', SearchController_1.SearchController.searchMovieReleases);
router.get('/releases/tv', SearchController_1.SearchController.searchTVReleases);
exports.default = router;
//# sourceMappingURL=search.js.map