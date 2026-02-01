interface SearchResult {
    title: string;
    downloadUrl: string;
    size: number;
    seeders: number;
    indexer: string;
    quality: string;
    score: number;
    customFormatScore: number;
    protocol?: 'torrent' | 'usenet';
}
export declare class AutoSearchService {
    /**
     * Automatically search and download best release for a movie
     * Will also search for upgrades if the movie already has a file
     */
    searchAndDownloadMovie(movieId: string, forceUpgradeSearch?: boolean): Promise<SearchResult | null>;
    /**
     * Automatically search and download best release for an episode
     * Will also search for upgrades if the episode already has a file
     */
    searchAndDownloadEpisode(seriesId: string, seasonNumber: number, episodeNumber: number, forceUpgradeSearch?: boolean): Promise<SearchResult | null>;
    /**
     * Automatically search and download all missing episodes for a series
     * Also searches for quality upgrades if enabled in the profile
     */
    searchAndDownloadSeries(seriesId: string, includeUpgrades?: boolean): Promise<{
        searched: number;
        found: number;
    }>;
    /**
     * Score releases based on quality profile preferences, custom formats, and title match
     * Filters out blacklisted releases
     */
    private scoreReleases;
    /**
     * Calculate base score for a release (quality profile based)
     */
    private calculateScore;
    /**
     * Detect quality from release title (returns full quality string like WEB-1080p or CAM)
     */
    private detectQuality;
    /**
     * Get quality rank for comparison
     */
    private getQualityRank;
    /**
     * Get expected size for quality
     */
    private getExpectedSize;
    /**
     * Validate that a release title matches the expected title
     */
    private validateTitleMatch;
    /**
     * Normalize a title for comparison
     */
    private normalizeTitle;
    /**
     * Extract the title portion from a release name
     */
    private extractTitleFromRelease;
    /**
     * Extract the year from a release name
     */
    private extractYearFromRelease;
    /**
     * Search for all missing monitored movies in the library
     * Only searches movies that meet their minimum_availability criteria
     */
    searchAllMissingMovies(concurrentLimit?: number): Promise<{
        total: number;
        searched: number;
        found: number;
        skipped: number;
    }>;
    /**
     * Search for all missing monitored episodes across all series
     */
    searchAllMissingSeries(concurrentLimit?: number): Promise<{
        total: number;
        searched: number;
        found: number;
    }>;
    /**
     * Search for all missing media (movies and episodes)
     * Used by the background worker
     */
    searchAllMissing(concurrentLimit?: number): Promise<{
        movies: {
            total: number;
            searched: number;
            found: number;
        };
        episodes: {
            total: number;
            searched: number;
            found: number;
        };
    }>;
    /**
     * Search for quality upgrades for movies below cutoff
     */
    searchCutoffUnmetMovies(concurrentLimit?: number): Promise<{
        total: number;
        searched: number;
        found: number;
    }>;
    /**
     * Search for quality upgrades for episodes below cutoff
     */
    searchCutoffUnmetSeries(concurrentLimit?: number): Promise<{
        total: number;
        searched: number;
        found: number;
    }>;
    /**
     * Search for all cutoff unmet media (movies and episodes)
     * Used by the background worker
     */
    searchAllCutoffUnmet(concurrentLimit?: number): Promise<{
        movies: {
            total: number;
            searched: number;
            found: number;
        };
        episodes: {
            total: number;
            searched: number;
            found: number;
        };
    }>;
}
export declare const autoSearchService: AutoSearchService;
export {};
//# sourceMappingURL=autoSearch.d.ts.map