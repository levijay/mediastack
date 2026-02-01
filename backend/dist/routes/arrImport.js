"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ArrImportController_1 = require("../controllers/ArrImportController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All routes require admin authentication
router.use(auth_1.authenticateToken);
router.use((0, auth_1.requireRole)(['admin']));
// Radarr endpoints
router.post('/radarr/test', ArrImportController_1.ArrImportController.testRadarr);
router.post('/radarr/movies', ArrImportController_1.ArrImportController.getRadarrMovies);
router.post('/radarr/profiles', ArrImportController_1.ArrImportController.getRadarrProfiles);
// Sonarr endpoints
router.post('/sonarr/test', ArrImportController_1.ArrImportController.testSonarr);
router.post('/sonarr/series', ArrImportController_1.ArrImportController.getSonarrSeries);
router.post('/sonarr/profiles', ArrImportController_1.ArrImportController.getSonarrProfiles);
exports.default = router;
//# sourceMappingURL=arrImport.js.map