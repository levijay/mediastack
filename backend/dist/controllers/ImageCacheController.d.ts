import { Request, Response } from 'express';
export declare class ImageCacheController {
    /**
     * Proxy and cache TMDB images
     * Route: /api/images/cache/:size/*
     */
    static getCachedImage(req: Request, res: Response): Promise<any>;
    /**
     * Clear the image cache
     * Route: DELETE /api/images/cache
     */
    static clearCache(req: Request, res: Response): Promise<any>;
    /**
     * Get cache statistics
     * Route: GET /api/images/cache/stats
     */
    static getCacheStats(req: Request, res: Response): Promise<any>;
}
//# sourceMappingURL=ImageCacheController.d.ts.map