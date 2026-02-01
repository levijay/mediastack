export declare class EpisodeFetcherService {
    /**
     * Fetch and populate all episodes for a TV series
     * Uses TVDB if configured and series has tvdb_id, otherwise falls back to TMDB
     */
    fetchAndPopulateEpisodes(seriesId: string): Promise<number>;
    /**
     * Fetch episodes from TVDB
     */
    private fetchFromTVDB;
    /**
     * Fetch episodes from TMDB (fallback)
     */
    private fetchFromTMDB;
    /**
     * Scan folder for episode files and match them to episodes in database
     */
    private scanEpisodeFiles;
    /**
     * Find all video files recursively
     */
    private findAllVideoFiles;
    /**
     * Parse episode filename to extract season/episode info
     */
    private parseEpisodeFilename;
    /**
     * Extract quality info from filename
     */
    private extractQuality;
    /**
     * Update episodes for a series (fetch new episodes for existing seasons)
     */
    updateEpisodes(seriesId: string): Promise<number>;
}
export declare const episodeFetcherService: EpisodeFetcherService;
//# sourceMappingURL=episodeFetcher.d.ts.map