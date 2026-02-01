interface RssRelease {
    id: string;
    indexer_id: string;
    guid: string;
    title: string;
    download_url: string;
    size: number;
    publish_date: string;
    categories: string;
    processed: number;
    grabbed: number;
}
export declare class RssSyncService {
    private indexerService;
    constructor();
    /**
     * Run RSS sync for all enabled indexers
     */
    syncAll(): Promise<{
        indexersChecked: number;
        releasesFound: number;
        grabbed: number;
    }>;
    /**
     * Cache a release in the database, returns true if it's a new release
     */
    private cacheRelease;
    /**
     * Process a release to see if it matches any wanted movies or episodes
     */
    private processRelease;
    /**
     * Check if a release matches a wanted movie and grab it
     * Handles both missing movies AND quality upgrades/repacks/propers
     */
    private matchMovie;
    /**
     * Check if a release matches a wanted TV episode and grab it
     * Handles both missing episodes AND quality upgrades/repacks/propers
     */
    private matchTVEpisode;
    /**
     * Match a season pack release
     */
    private matchSeasonPack;
    /**
     * Actually grab a release - send to download client
     */
    private grabRelease;
    /**
     * Detect quality from release title
     */
    private detectQuality;
    /**
     * Check if a release/file is a PROPER release
     */
    private isProper;
    /**
     * Check if a release/file is a REPACK release
     */
    private isRepack;
    /**
     * Check if a release title matches an expected title
     */
    private titleMatches;
    /**
     * Mark a release as grabbed in the cache
     */
    private markReleaseGrabbed;
    /**
     * Clean up old releases from the cache
     */
    private cleanupOldReleases;
    /**
     * Get recent RSS releases for display
     */
    getRecentReleases(limit?: number): RssRelease[];
    /**
     * Get RSS sync stats
     */
    getStats(): {
        totalCached: number;
        grabbed: number;
        processed: number;
    };
}
export declare const rssSyncService: RssSyncService;
export {};
//# sourceMappingURL=rssSync.d.ts.map