"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ImageCacheController_1 = require("../controllers/ImageCacheController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Image cache endpoint - no auth required for images
router.get('/cache/:size/*', ImageCacheController_1.ImageCacheController.getCachedImage);
// Admin endpoints - require auth
router.get('/cache/stats', auth_1.authenticateToken, ImageCacheController_1.ImageCacheController.getCacheStats);
router.delete('/cache', auth_1.authenticateToken, ImageCacheController_1.ImageCacheController.clearCache);
exports.default = router;
//# sourceMappingURL=images.js.map