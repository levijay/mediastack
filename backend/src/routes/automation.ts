import { Router } from 'express';
import { AutomationController } from '../controllers/AutomationController';
import { ImportListController } from '../controllers/ImportListController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Indexers (admin only for management)
router.get('/indexers', requireRole(['admin']), AutomationController.getIndexers);
router.get('/indexers/status', AutomationController.getIndexerStatus);
router.post('/indexers', requireRole(['admin']), AutomationController.addIndexer);
router.put('/indexers/:id', requireRole(['admin']), AutomationController.updateIndexer);
router.delete('/indexers/:id', requireRole(['admin']), AutomationController.deleteIndexer);
router.post('/indexers/test', requireRole(['admin']), AutomationController.testIndexer);
router.get('/indexers/:id/rss-preview', requireRole(['admin']), AutomationController.previewRss);

// Download clients (admin only for management)
router.get('/download-clients', requireRole(['admin']), AutomationController.getDownloadClients);
router.get('/download-clients/enabled', AutomationController.getEnabledDownloadClients);
router.post('/download-clients', requireRole(['admin']), AutomationController.addDownloadClient);
router.post('/download-clients/test', requireRole(['admin']), AutomationController.testDownloadClient);
router.put('/download-clients/:id', requireRole(['admin']), AutomationController.updateDownloadClient);
router.delete('/download-clients/:id', requireRole(['admin']), AutomationController.deleteDownloadClient);

// Import Lists (admin only)
router.get('/import-lists', requireRole(['admin']), ImportListController.getAll);
router.get('/import-lists/types', requireRole(['admin']), ImportListController.getListTypes);
router.get('/import-lists/:id', requireRole(['admin']), ImportListController.getById);
router.post('/import-lists', requireRole(['admin']), ImportListController.create);
router.put('/import-lists/:id', requireRole(['admin']), ImportListController.update);
router.delete('/import-lists/:id', requireRole(['admin']), ImportListController.delete);
router.post('/import-lists/:id/sync', requireRole(['admin']), ImportListController.syncList);
router.get('/import-lists/:id/preview', requireRole(['admin']), ImportListController.previewList);
router.post('/import-lists/sync-all', requireRole(['admin']), ImportListController.syncAll);

// Legacy download client testing (admin only)
router.post('/download-client/test', requireRole(['admin']), AutomationController.testQBittorrent);
router.post('/download-client/test/qbittorrent', requireRole(['admin']), AutomationController.testQBittorrentWithParams);
router.post('/download-client/test/sabnzbd', requireRole(['admin']), AutomationController.testSabnzbd);

// Search releases
router.get('/search', AutomationController.searchReleases);

// Downloads
router.post('/downloads', AutomationController.startDownload);
router.get('/downloads', AutomationController.getDownloads);
router.post('/downloads/sync', AutomationController.syncDownloads);
router.delete('/downloads/clear', AutomationController.clearDownloads);
router.delete('/downloads/:id', AutomationController.cancelDownload);

// Release Blacklist
router.get('/blacklist', AutomationController.getBlacklist);
router.delete('/blacklist/:id', requireRole(['admin']), AutomationController.removeFromBlacklist);
router.delete('/blacklist/movie/:movieId', requireRole(['admin']), AutomationController.clearMovieBlacklist);
router.delete('/blacklist/series/:seriesId', requireRole(['admin']), AutomationController.clearSeriesBlacklist);

export default router;
