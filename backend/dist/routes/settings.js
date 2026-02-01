"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const SettingsController_1 = require("../controllers/SettingsController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// User UI settings - available to all authenticated users (no admin required)
// These must be defined BEFORE the admin middleware
router.get('/ui', auth_1.authenticateToken, SettingsController_1.SettingsController.getUserUISettings);
router.put('/ui', auth_1.authenticateToken, SettingsController_1.SettingsController.updateUserUISettings);
// All routes below require admin role
router.get('/', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.getSettings);
router.put('/', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.updateSetting);
router.post('/test-tmdb', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.testTmdbKey);
router.post('/test-tvdb', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.testTvdbKey);
router.post('/test-omdb', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.testOmdbKey);
router.get('/stats', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.getStats);
router.get('/quality-profiles', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.getQualityProfiles);
// Naming format preview endpoints
router.post('/naming/movie-folder', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.previewMovieFolderName);
router.post('/naming/series-folder', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.previewSeriesFolderName);
// Exclusion list endpoints
router.get('/exclusions', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.getExclusions);
router.post('/exclusions', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.addExclusion);
router.delete('/exclusions/:id', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.removeExclusion);
router.delete('/exclusions', auth_1.authenticateToken, (0, auth_1.requireRole)(['admin']), SettingsController_1.SettingsController.clearExclusions);
exports.default = router;
//# sourceMappingURL=settings.js.map