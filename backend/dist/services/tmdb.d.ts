export declare class TMDBService {
    private getApiKey;
    private checkApiKey;
    private makeRequest;
    searchMovies(query: string, page?: number, year?: number): Promise<any>;
    searchTV(query: string, page?: number): Promise<any>;
    searchMulti(query: string, page?: number): Promise<any>;
    getTrendingMovies(timeWindow?: 'day' | 'week'): Promise<any>;
    getTrendingTV(timeWindow?: 'day' | 'week'): Promise<any>;
    getPopularMovies(page?: number): Promise<any>;
    getPopularTV(page?: number): Promise<any>;
    getTopRatedMovies(page?: number): Promise<any>;
    getTopRatedTV(page?: number): Promise<any>;
    getUpcomingMovies(page?: number): Promise<any>;
    getUpcomingTV(page?: number): Promise<any>;
    getSimilarMovies(movieId: number, page?: number): Promise<any>;
    getSimilarTV(tvId: number, page?: number): Promise<any>;
    getMovieRecommendations(movieId: number, page?: number): Promise<any>;
    getTVRecommendations(tvId: number, page?: number): Promise<any>;
    getMovieGenres(): Promise<any>;
    getTVGenres(): Promise<any>;
    getLanguages(): Promise<any>;
    discoverMovies(page?: number, sortBy?: string, filters?: any): Promise<any>;
    discoverTV(page?: number, sortBy?: string, filters?: any): Promise<any>;
    searchKeywords(query: string): Promise<any>;
    searchCompanies(query: string): Promise<any>;
    getMovieDetails(movieId: number): Promise<any>;
    /**
     * Extract certification (content rating) from TMDB movie response
     * Returns US certification if available, otherwise first non-empty certification
     */
    static extractCertification(movieData: any): string | null;
    /**
     * Extract release dates from TMDB movie response
     * Release types: 1=Premiere, 2=Theatrical (limited), 3=Theatrical, 4=Digital, 5=Physical, 6=TV
     * Returns dates in ISO format for US region, or first available region
     */
    static extractReleaseDates(movieData: any): {
        theatricalDate?: string;
        digitalDate?: string;
        physicalDate?: string;
    };
    getTVDetails(tvId: number): Promise<any>;
    getMovieCredits(movieId: number): Promise<any>;
    getTVCredits(tvId: number): Promise<any>;
    getSeasonDetails(tvId: number, seasonNumber: number): Promise<any>;
    /**
     * Find media by external ID (TVDB, IMDB, etc.)
     */
    findByExternalId(externalId: number | string, source?: 'tvdb_id' | 'imdb_id'): Promise<any>;
    getImageUrl(path: string | null, size?: string): string | null;
    getPosterUrl(path: string | null): string | null;
    getBackdropUrl(path: string | null): string | null;
    /**
     * Test the API key by searching for a known show
     */
    testApiKey(apiKey?: string): Promise<{
        success: boolean;
        message: string;
        data?: any;
    }>;
    getPersonDetails(personId: number): Promise<any>;
}
export declare const tmdbService: TMDBService;
//# sourceMappingURL=tmdb.d.ts.map