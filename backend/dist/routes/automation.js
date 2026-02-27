"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AutomationController_1 = require("../controllers/AutomationController");
const ImportListController_1 = require("../controllers/ImportListController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
// Indexers (admin only for management)
router.get('/indexers', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.getIndexers);
router.get('/indexers/status', AutomationController_1.AutomationController.getIndexerStatus);
router.post('/indexers', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.addIndexer);
router.put('/indexers/:id', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.updateIndexer);
router.delete('/indexers/:id', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.deleteIndexer);
router.post('/indexers/test', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.testIndexer);
router.get('/indexers/:id/rss-preview', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.previewRss);
// Download clients (admin only for management)
router.get('/download-clients', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.getDownloadClients);
router.get('/download-clients/enabled', AutomationController_1.AutomationController.getEnabledDownloadClients);
router.post('/download-clients', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.addDownloadClient);
router.post('/download-clients/test', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.testDownloadClient);
router.put('/download-clients/:id', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.updateDownloadClient);
router.delete('/download-clients/:id', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.deleteDownloadClient);
// Import Lists (admin only)
router.get('/import-lists', (0, auth_1.requireRole)(['admin']), ImportListController_1.ImportListController.getAll);
router.get('/import-lists/types', (0, auth_1.requireRole)(['admin']), ImportListController_1.ImportListController.getListTypes);
router.get('/import-lists/:id', (0, auth_1.requireRole)(['admin']), ImportListController_1.ImportListController.getById);
router.post('/import-lists', (0, auth_1.requireRole)(['admin']), ImportListController_1.ImportListController.create);
router.put('/import-lists/:id', (0, auth_1.requireRole)(['admin']), ImportListController_1.ImportListController.update);
router.delete('/import-lists/:id', (0, auth_1.requireRole)(['admin']), ImportListController_1.ImportListController.delete);
router.post('/import-lists/:id/sync', (0, auth_1.requireRole)(['admin']), ImportListController_1.ImportListController.syncList);
router.get('/import-lists/:id/preview', (0, auth_1.requireRole)(['admin']), ImportListController_1.ImportListController.previewList);
router.post('/import-lists/sync-all', (0, auth_1.requireRole)(['admin']), ImportListController_1.ImportListController.syncAll);
// Legacy download client testing (admin only)
router.post('/download-client/test', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.testQBittorrent);
router.post('/download-client/test/qbittorrent', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.testQBittorrentWithParams);
router.post('/download-client/test/sabnzbd', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.testSabnzbd);
router.post('/download-client/sabnzbd/categories', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.getSabnzbdCategories);
// Search releases
router.get('/search', AutomationController_1.AutomationController.searchReleases);
// Downloads
router.post('/downloads', AutomationController_1.AutomationController.startDownload);
router.get('/downloads', AutomationController_1.AutomationController.getDownloads);
router.post('/downloads/sync', AutomationController_1.AutomationController.syncDownloads);
router.delete('/downloads/clear', AutomationController_1.AutomationController.clearDownloads);
router.delete('/downloads/:id', AutomationController_1.AutomationController.cancelDownload);
// Release Blacklist
router.get('/blacklist', AutomationController_1.AutomationController.getBlacklist);
router.delete('/blacklist/:id', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.removeFromBlacklist);
router.delete('/blacklist/movie/:movieId', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.clearMovieBlacklist);
router.delete('/blacklist/series/:seriesId', (0, auth_1.requireRole)(['admin']), AutomationController_1.AutomationController.clearSeriesBlacklist);
exports.default = router;
//# sourceMappingURL=automation.js.map