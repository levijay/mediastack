export interface BlacklistedRelease {
    id: string;
    movie_id: string | null;
    series_id: string | null;
    season_number: number | null;
    episode_number: number | null;
    release_title: string;
    indexer: string | null;
    reason: string | null;
    created_at: string;
}
export declare class ReleaseBlacklistModel {
    /**
     * Add a release to the blacklist
     */
    static add(data: {
        movie_id?: string;
        series_id?: string;
        season_number?: number;
        episode_number?: number;
        release_title: string;
        indexer?: string;
        reason?: string;
    }): BlacklistedRelease;
    /**
     * Check if a release title is blacklisted for a movie
     */
    static isBlacklistedForMovie(movieId: string, releaseTitle: string): boolean;
    /**
     * Check if a release title is blacklisted for an episode
     */
    static isBlacklistedForEpisode(seriesId: string, seasonNumber: number, episodeNumber: number, releaseTitle: string): boolean;
    /**
     * Get all blacklisted releases for a movie
     */
    static getForMovie(movieId: string): BlacklistedRelease[];
    /**
     * Get all blacklisted releases for a series
     */
    static getForSeries(seriesId: string): BlacklistedRelease[];
    /**
     * Get all blacklisted releases
     */
    static findAll(): BlacklistedRelease[];
    /**
     * Find by ID
     */
    static findById(id: string): BlacklistedRelease | null;
    /**
     * Remove a release from the blacklist
     */
    static remove(id: string): boolean;
    /**
     * Clear all blacklisted releases for a movie
     */
    static clearForMovie(movieId: string): number;
    /**
     * Clear all blacklisted releases for a series
     */
    static clearForSeries(seriesId: string): number;
    /**
     * Normalize release title for comparison
     */
    private static normalizeTitle;
    /**
     * Get count of blacklisted releases
     */
    static count(): number;
}
//# sourceMappingURL=ReleaseBlacklist.d.ts.map