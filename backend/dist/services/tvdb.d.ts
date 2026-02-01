interface TVDBEpisode {
    id: number;
    seriesId: number;
    name: string;
    aired: string;
    runtime: number;
    overview: string;
    image: string;
    seasonNumber: number;
    number: number;
}
interface TVDBTranslation {
    name: string;
    overview: string;
    language: string;
    aliases?: string[];
}
interface TVDBSeries {
    id: number;
    name: string;
    slug: string;
    image: string;
    firstAired: string;
    lastAired: string;
    nextAired: string;
    score: number;
    status: {
        id: number;
        name: string;
    };
    originalCountry: string;
    originalLanguage: string;
    defaultSeasonType: number;
    isOrderRandomized: boolean;
    lastUpdated: string;
    averageRuntime: number;
    episodes: TVDBEpisode[];
    overview: string;
    year: string;
    nameTranslations?: string[];
    overviewTranslations?: string[];
}
export declare class TVDBService {
    private token;
    private tokenExpiry;
    private getApiKey;
    private authenticate;
    private makeRequest;
    /**
     * Search for TV series by name
     */
    searchSeries(query: string): Promise<any[]>;
    /**
     * Get English translation for a series
     */
    getSeriesTranslation(tvdbId: number, language?: string): Promise<TVDBTranslation | null>;
    /**
     * Get series details by TVDB ID with English translation
     */
    getSeriesDetails(tvdbId: number): Promise<TVDBSeries | null>;
    /**
     * Get series episodes (all seasons)
     */
    getSeriesEpisodes(tvdbId: number, seasonType?: string): Promise<TVDBEpisode[]>;
    /**
     * Get season details
     */
    getSeasonDetails(tvdbId: number, seasonNumber: number): Promise<{
        episodes: TVDBEpisode[];
    }>;
    /**
     * Get episode details
     */
    getEpisodeDetails(episodeId: number): Promise<TVDBEpisode | null>;
    /**
     * Check if TVDB API is configured and working
     */
    isConfigured(): Promise<boolean>;
    /**
     * Test the API key by searching for a known show
     */
    testApiKey(apiKey?: string): Promise<{
        success: boolean;
        message: string;
        data?: any;
    }>;
}
export declare const tvdbService: TVDBService;
export {};
//# sourceMappingURL=tvdb.d.ts.map