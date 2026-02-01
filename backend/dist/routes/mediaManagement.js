"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const MediaManagementController_1 = require("../controllers/MediaManagementController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Quality Definitions
router.get('/quality/definitions', auth_1.authenticateToken, MediaManagementController_1.MediaManagementController.getQualityDefinitions);
// Quality Profiles
router.get('/quality/profiles', auth_1.authenticateToken, MediaManagementController_1.MediaManagementController.getQualityProfiles);
router.get('/quality/profiles/:id', auth_1.authenticateToken, MediaManagementController_1.MediaManagementController.getQualityProfile);
router.post('/quality/profiles', auth_1.authenticateToken, MediaManagementController_1.MediaManagementController.createQualityProfile);
router.put('/quality/profiles/:id', auth_1.authenticateToken, MediaManagementController_1.MediaManagementController.updateQualityProfile);
router.delete('/quality/profiles/:id', auth_1.authenticateToken, MediaManagementController_1.MediaManagementController.deleteQualityProfile);
// Naming Configuration
router.get('/naming', auth_1.authenticateToken, MediaManagementController_1.MediaManagementController.getNamingConfig);
router.put('/naming', auth_1.authenticateToken, MediaManagementController_1.MediaManagementController.updateNamingConfig);
router.get('/naming/tokens', auth_1.authenticateToken, MediaManagementController_1.MediaManagementController.getNamingTokens);
router.post('/naming/preview', auth_1.authenticateToken, MediaManagementController_1.MediaManagementController.previewNaming);
// File Management Settings
router.get('/file-management', auth_1.authenticateToken, MediaManagementController_1.MediaManagementController.getFileManagementSettings);
router.put('/file-management', auth_1.authenticateToken, MediaManagementController_1.MediaManagementController.updateFileManagementSettings);
exports.default = router;
//# sourceMappingURL=mediaManagement.js.map