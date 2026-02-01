export interface IMDBRating {
    rating: number | null;
    votes: string | null;
    metascore: number | null;
}
declare class OMDBService {
    private getApiKey;
    /**
     * Get IMDB rating for a given IMDB ID
     * Returns null if OMDB API key is not configured
     */
    getIMDBRating(imdbId: string): Promise<IMDBRating | null>;
    /**
     * Check if OMDB API is configured and working
     */
    testConnection(): Promise<{
        success: boolean;
        message: string;
    }>;
}
export declare const omdbService: OMDBService;
export {};
//# sourceMappingURL=omdb.d.ts.map