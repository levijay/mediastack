export interface CastMember {
    id: number;
    name: string;
    character?: string;
    profile_path?: string;
}
export interface CrewMember {
    id: number;
    name: string;
    job: string;
    department?: string;
}
export interface Genre {
    id: number;
    name: string;
}
export interface TVSeries {
    id: string;
    tvdb_id: number | null;
    tmdb_id: number | null;
    imdb_id: string | null;
    title: string;
    status: string | null;
    overview: string | null;
    network: string | null;
    year: number | null;
    vote_average: number | null;
    vote_count: number | null;
    poster_path: string | null;
    backdrop_path: string | null;
    folder_path: string;
    quality_profile_id: string | null;
    language_profile_id: string | null;
    monitored: boolean;
    season_folder: boolean;
    series_type: string | null;
    use_season_folder: boolean | null;
    monitor_new_seasons: string | null;
    tags: string | null;
    cast_data?: CastMember[] | null;
    crew_data?: CrewMember[] | null;
    genres?: Genre[] | null;
    certification?: string | null;
    created_at: string;
    updated_at: string;
}
export interface Season {
    id: string;
    series_id: string;
    season_number: number;
    monitored: boolean;
    created_at: string;
    updated_at: string;
}
export interface Episode {
    id: string;
    series_id: string;
    season_number: number;
    episode_number: number;
    title: string;
    overview: string | null;
    air_date: string | null;
    has_file: boolean;
    file_path: string | null;
    file_size: number | null;
    quality: string | null;
    video_codec: string | null;
    audio_codec: string | null;
    release_group: string | null;
    monitored: boolean;
    is_proper?: boolean;
    is_repack?: boolean;
    created_at: string;
    updated_at: string;
}
export declare class TVSeriesModel {
    static create(data: {
        tvdb_id?: number;
        tmdb_id?: number;
        imdb_id?: string;
        title: string;
        status?: string;
        overview?: string;
        network?: string;
        year?: number;
        vote_average?: number;
        vote_count?: number;
        poster_path?: string;
        backdrop_path?: string;
        folder_path: string;
        quality_profile_id?: string;
        language_profile_id?: string;
        monitored?: boolean;
        season_folder?: boolean;
        cast_data?: CastMember[];
        crew_data?: CrewMember[];
        genres?: Genre[];
    }): TVSeries;
    private static parseSeries;
    static findById(id: string): TVSeries | undefined;
    static findByTmdbId(tmdbId: number): TVSeries | undefined;
    static findByTvdbId(tvdbId: number): TVSeries | undefined;
    static findAll(limit?: number, offset?: number): TVSeries[];
    static findRecentlyAdded(limit?: number): TVSeries[];
    static count(): {
        total: number;
        monitored: number;
    };
    static getAllFolderPaths(): string[];
    static findMonitored(): TVSeries[];
    static updateMonitored(id: string, monitored: boolean): TVSeries | undefined;
    static delete(id: string): boolean;
    static deleteSeasonsBySeriesId(seriesId: string): number;
    static deleteEpisodesBySeriesId(seriesId: string): number;
    static createSeason(seriesId: string, seasonNumber: number, monitored?: boolean): Season;
    static findSeasonById(id: string): Season | undefined;
    static findSeasonsBySeriesId(seriesId: string): Season[];
    static updateSeasonMonitored(id: string, monitored: boolean): Season | undefined;
    static createEpisode(data: {
        series_id: string;
        season_number: number;
        episode_number: number;
        title: string;
        overview?: string;
        air_date?: string;
        runtime?: number | null;
        vote_average?: number | null;
        vote_count?: number | null;
        monitored?: boolean;
    }): Episode;
    static findEpisodeById(id: string): Episode | undefined;
    static findEpisodesBySeriesId(seriesId: string): Episode[];
    static findEpisodesBySeason(seriesId: string, seasonNumber: number): Episode[];
    static findMissingEpisodes(seriesId?: string): Episode[];
    static updateEpisodeFile(id: string, filePath: string, fileSize: number, quality: string, videoCodec?: string, audioCodec?: string, releaseGroup?: string): Episode | undefined;
    static clearEpisodeFile(id: string): Episode | undefined;
    static clearSeasonFiles(seriesId: string, seasonNumber: number): number;
    static updateEpisodeMonitored(id: string, monitored: boolean): Episode | undefined;
    static updateQualityProfile(id: string, qualityProfileId: string | null): TVSeries | undefined;
    static updateFolderPath(id: string, folderPath: string): TVSeries | undefined;
    static updateSeriesType(id: string, seriesType: string): TVSeries | undefined;
    static updateUseSeasonFolder(id: string, useSeasonFolder: boolean): TVSeries | undefined;
    static updateMonitorNewSeasons(id: string, monitorNewSeasons: string): TVSeries | undefined;
    static updateTags(id: string, tags: string[]): TVSeries | undefined;
    static updateMetadata(id: string, data: {
        title?: string;
        status?: string;
        overview?: string;
        network?: string;
        vote_average?: number;
        vote_count?: number;
        poster_path?: string;
        backdrop_path?: string;
    }): TVSeries | undefined;
    /**
     * Update cast, crew, genres, and certification data for a series
     */
    static updateMediaMetadata(id: string, data: {
        cast_data?: CastMember[];
        crew_data?: CrewMember[];
        genres?: Genre[];
        certification?: string;
    }): TVSeries | undefined;
    /**
     * Find related series - prioritizes franchise/spinoffs, then supplements with actor matches
     * Only shows truly related content, not weak genre-only matches
     */
    static findRelated(id: string, limit?: number): {
        series: TVSeries;
        score: number;
        reasons: string[];
    }[];
}
//# sourceMappingURL=TVSeries.d.ts.map