"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageCacheController = void 0;
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const CACHE_DIR = process.env.IMAGE_CACHE_DIR || '/config/cache/images';
// Ensure cache directory exists
function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}
class ImageCacheController {
    /**
     * Proxy and cache TMDB images
     * Route: /api/images/cache/:size/*
     */
    static async getCachedImage(req, res) {
        try {
            const { size } = req.params;
            // Get the path after /cache/:size/
            const imagePath = '/' + req.params[0];
            if (!imagePath || imagePath === '/') {
                return res.status(400).json({ error: 'Image path required' });
            }
            // Create a hash of the URL for the cache filename
            const hash = crypto.createHash('md5').update(`${size}${imagePath}`).digest('hex');
            const extension = path.extname(imagePath) || '.jpg';
            const cacheFilePath = path.join(CACHE_DIR, `${hash}${extension}`);
            ensureCacheDir();
            // Check if cached file exists and is recent (within 7 days)
            if (fs.existsSync(cacheFilePath)) {
                const stats = fs.statSync(cacheFilePath);
                const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
                if (ageInDays < 7) {
                    // Serve from cache
                    const contentType = extension === '.png' ? 'image/png' : 'image/jpeg';
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
                    res.setHeader('X-Cache', 'HIT');
                    return fs.createReadStream(cacheFilePath).pipe(res);
                }
            }
            // Fetch from TMDB
            const tmdbUrl = `${TMDB_IMAGE_BASE}/${size}${imagePath}`;
            const response = await axios_1.default.get(tmdbUrl, {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            // Save to cache
            fs.writeFileSync(cacheFilePath, response.data);
            // Serve the image
            const contentType = response.headers['content-type'] || 'image/jpeg';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=604800');
            res.setHeader('X-Cache', 'MISS');
            return res.send(response.data);
        }
        catch (error) {
            console.error('Image cache error:', error.message);
            // If image not found or error, return a placeholder or 404
            if (error.response?.status === 404) {
                return res.status(404).json({ error: 'Image not found' });
            }
            return res.status(500).json({ error: 'Failed to fetch image' });
        }
    }
    /**
     * Clear the image cache
     * Route: DELETE /api/images/cache
     */
    static async clearCache(req, res) {
        try {
            if (fs.existsSync(CACHE_DIR)) {
                const files = fs.readdirSync(CACHE_DIR);
                let deleted = 0;
                for (const file of files) {
                    const filePath = path.join(CACHE_DIR, file);
                    if (fs.statSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                        deleted++;
                    }
                }
                return res.json({ message: `Cleared ${deleted} cached images` });
            }
            return res.json({ message: 'Cache directory does not exist' });
        }
        catch (error) {
            console.error('Clear cache error:', error);
            return res.status(500).json({ error: 'Failed to clear cache' });
        }
    }
    /**
     * Get cache statistics
     * Route: GET /api/images/cache/stats
     */
    static async getCacheStats(req, res) {
        try {
            if (!fs.existsSync(CACHE_DIR)) {
                return res.json({ count: 0, size: 0, sizeFormatted: '0 B' });
            }
            const files = fs.readdirSync(CACHE_DIR);
            let totalSize = 0;
            let count = 0;
            for (const file of files) {
                const filePath = path.join(CACHE_DIR, file);
                if (fs.statSync(filePath).isFile()) {
                    totalSize += fs.statSync(filePath).size;
                    count++;
                }
            }
            const formatSize = (bytes) => {
                if (bytes < 1024)
                    return `${bytes} B`;
                if (bytes < 1024 * 1024)
                    return `${(bytes / 1024).toFixed(1)} KB`;
                if (bytes < 1024 * 1024 * 1024)
                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
            };
            return res.json({
                count,
                size: totalSize,
                sizeFormatted: formatSize(totalSize)
            });
        }
        catch (error) {
            console.error('Cache stats error:', error);
            return res.status(500).json({ error: 'Failed to get cache stats' });
        }
    }
}
exports.ImageCacheController = ImageCacheController;
//# sourceMappingURL=ImageCacheController.js.map