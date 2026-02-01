export interface ArrMovie {
    id: number;
    title: string;
    year: number;
    tmdbId: number;
    imdbId?: string;
    overview?: string;
    path?: string;
    hasFile: boolean;
    monitored: boolean;
    qualityProfileId?: number;
    images?: {
        coverType: string;
        remoteUrl: string;
    }[];
}
export interface ArrSeries {
    id: number;
    title: string;
    year: number;
    tvdbId: number;
    imdbId?: string;
    overview?: string;
    path?: string;
    monitored: boolean;
    qualityProfileId?: number;
    images?: {
        coverType: string;
        remoteUrl: string;
    }[];
    statistics?: {
        seasonCount: number;
        episodeCount: number;
        episodeFileCount: number;
        sizeOnDisk: number;
    };
}
export interface ArrQualityProfile {
    id: number;
    name: string;
}
declare class ArrService {
    /**
     * Test connection to a Radarr instance
     */
    testRadarr(url: string, apiKey: string): Promise<{
        success: boolean;
        version?: string;
        error?: string;
    }>;
    /**
     * Test connection to a Sonarr instance
     */
    testSonarr(url: string, apiKey: string): Promise<{
        success: boolean;
        version?: string;
        error?: string;
    }>;
    /**
     * Get all movies from Radarr
     */
    getRadarrMovies(url: string, apiKey: string): Promise<ArrMovie[]>;
    /**
     * Get all series from Sonarr
     */
    getSonarrSeries(url: string, apiKey: string): Promise<ArrSeries[]>;
    /**
     * Get quality profiles from Radarr
     */
    getRadarrProfiles(url: string, apiKey: string): Promise<ArrQualityProfile[]>;
    /**
     * Get quality profiles from Sonarr
     */
    getSonarrProfiles(url: string, apiKey: string): Promise<ArrQualityProfile[]>;
    /**
     * Get poster URL from Arr images array
     */
    getPosterUrl(images: {
        coverType: string;
        remoteUrl: string;
    }[] | undefined): string | null;
    /**
     * Normalize URL to ensure consistent format
     */
    private normalizeUrl;
}
export declare const arrService: ArrService;
export {};
//# sourceMappingURL=arrService.d.ts.map