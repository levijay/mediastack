"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CustomFormatsController_1 = require("../controllers/CustomFormatsController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Custom formats CRUD
router.get('/', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.getAll);
router.get('/:id', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.getById);
router.post('/', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.create);
router.put('/:id', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.update);
router.delete('/:id', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.delete);
// Import from Trash Guides
router.post('/import', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.import);
router.post('/import/bulk', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.bulkImport);
// Test release against formats
router.post('/test', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.testRelease);
// Batch score releases
router.post('/score', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.scoreReleases);
// Profile scores
router.get('/profile/:profileId/scores', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.getProfileScores);
router.put('/profile/:profileId/scores', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.setProfileScores);
router.put('/profile/:profileId/format/:formatId/score', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.setProfileScore);
router.delete('/profile/:profileId/format/:formatId/score', auth_1.authenticateToken, CustomFormatsController_1.CustomFormatsController.removeProfileScore);
exports.default = router;
//# sourceMappingURL=customFormats.js.map