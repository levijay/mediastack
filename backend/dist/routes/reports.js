"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ReportsController_1 = require("../controllers/ReportsController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// All reports endpoints require authentication
router.use(auth_1.authenticateToken);
// Get filter options (distinct values for combo boxes)
router.get('/filters', ReportsController_1.ReportsController.getFilterOptions);
// Search movies with filters
router.get('/movies', ReportsController_1.ReportsController.searchMovies);
// Search episodes with filters
router.get('/episodes', ReportsController_1.ReportsController.searchEpisodes);
// Get summary statistics
router.get('/stats', ReportsController_1.ReportsController.getStats);
exports.default = router;
//# sourceMappingURL=reports.js.map