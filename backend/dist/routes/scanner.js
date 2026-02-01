"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const LibraryScannerController_1 = require("../controllers/LibraryScannerController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All scanner endpoints require authentication
router.use(auth_1.authenticateToken);
router.post('/scan', LibraryScannerController_1.LibraryScannerController.scanDirectory);
router.get('/library-paths', LibraryScannerController_1.LibraryScannerController.getLibraryPaths);
router.get('/suggestions', LibraryScannerController_1.LibraryScannerController.getSuggestions);
router.post('/movies/:movieId/scan', LibraryScannerController_1.LibraryScannerController.scanMovie);
router.post('/series/:seriesId/episodes', LibraryScannerController_1.LibraryScannerController.scanSeriesEpisodes);
router.post('/series/:seriesId/manual-import', LibraryScannerController_1.LibraryScannerController.manualImportSeries);
exports.default = router;
//# sourceMappingURL=scanner.js.map