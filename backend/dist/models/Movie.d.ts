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
export interface Movie {
    id: string;
    tmdb_id: number;
    imdb_id: string | null;
    title: string;
    year: number | null;
    status: string | null;
    overview: string | null;
    runtime: number | null;
    vote_average: number | null;
    vote_count: number | null;
    poster_path: string | null;
    backdrop_path: string | null;
    folder_path: string;
    quality_profile_id: string | null;
    monitored: boolean;
    has_file: boolean;
    file_path: string | null;
    file_size: number | null;
    quality: string | null;
    minimum_availability?: string;
    theatrical_release_date?: string | null;
    digital_release_date?: string | null;
    physical_release_date?: string | null;
    tmdb_status?: string | null;
    cast_data?: CastMember[] | null;
    crew_data?: CrewMember[] | null;
    genres?: Genre[] | null;
    collection_id?: number | null;
    collection_name?: string | null;
    certification?: string | null;
    created_at: string;
    updated_at: string;
}
export interface MovieFile {
    id: string;
    movie_id: string;
    file_path: string;
    relative_path: string | null;
    file_size: number;
    quality: string | null;
    resolution: string | null;
    video_codec: string | null;
    video_dynamic_range: string | null;
    audio_codec: string | null;
    audio_channels: string | null;
    audio_languages: string | null;
    audio_track_count: number;
    subtitle_languages: string | null;
    runtime: number | null;
    scene_name: string | null;
    release_group: string | null;
    created_at: string;
    updated_at: string;
}
export declare class MovieModel {
    static create(data: {
        tmdb_id: number;
        title: string;
        year?: number;
        overview?: string;
        runtime?: number;
        vote_average?: number;
        vote_count?: number;
        poster_path?: string;
        backdrop_path?: string;
        folder_path: string;
        quality_profile_id?: string;
        monitored?: boolean;
        has_file?: boolean;
        file_size?: number;
        quality?: string;
        minimum_availability?: string;
        theatrical_release_date?: string;
        digital_release_date?: string;
        physical_release_date?: string;
        tmdb_status?: string;
        cast_data?: CastMember[];
        crew_data?: CrewMember[];
        genres?: Genre[];
        collection_id?: number;
        collection_name?: string;
    }): Movie;
    private static parseMovie;
    static findById(id: string): Movie | undefined;
    static findByTmdbId(tmdbId: number): Movie | undefined;
    static findAll(limit?: number, offset?: number): Movie[];
    static findRecentlyAdded(limit?: number): Movie[];
    static count(): {
        total: number;
        monitored: number;
        missing: number;
        available: number;
    };
    static getAllFolderPaths(): string[];
    static findMonitored(): Movie[];
    static findMissing(): Movie[];
    /**
     * Find missing movies that are actually available for download based on minimum_availability
     * - announced: Any movie that has been announced
     * - inCinemas: Movie has theatrical release date in the past
     * - released: Movie has digital or physical release date in the past, OR theatrical 90+ days ago
     */
    static findMissingAndAvailable(): Movie[];
    /**
     * Check if a specific movie is available based on its minimum_availability setting
     */
    static isMovieAvailable(movie: Movie): boolean;
    static findWithFiles(): Movie[];
    static updateMonitored(id: string, monitored: boolean): Movie | undefined;
    static updateFile(id: string, filePath: string, fileSize: number, quality: string): Movie | undefined;
    static updateHasFile(id: string, hasFile: boolean): Movie | undefined;
    static delete(id: string): boolean;
    static addMovieFile(data: {
        movie_id: string;
        file_path: string;
        relative_path?: string;
        file_size: number;
        quality?: string;
        resolution?: string;
        video_codec?: string;
        video_dynamic_range?: string;
        audio_codec?: string;
        audio_channels?: string;
        audio_languages?: string;
        audio_track_count?: number;
        subtitle_languages?: string;
        runtime?: number;
        scene_name?: string;
        release_group?: string;
        is_proper?: boolean;
        is_repack?: boolean;
    }): MovieFile;
    static findMovieFileById(id: string): MovieFile | undefined;
    static findMovieFiles(movieId: string): MovieFile[];
    static deleteMovieFile(id: string): boolean;
    static deleteMovieFilesByMovieId(movieId: string): number;
    static updateMovieFilePath(fileId: string, newPath: string): MovieFile | undefined;
    static updateMovieFile(fileId: string, data: {
        quality?: string;
        video_codec?: string;
        audio_codec?: string;
        video_dynamic_range?: string;
        audio_channels?: string;
        audio_languages?: string;
        subtitle_languages?: string;
        release_group?: string;
    }): MovieFile | undefined;
    static updateQualityProfile(id: string, qualityProfileId: string | null): Movie | undefined;
    static updateFolderPath(id: string, folderPath: string): Movie | undefined;
    static updateMinimumAvailability(id: string, minimumAvailability: string): Movie | undefined;
    static updateTags(id: string, tags: string[]): Movie | undefined;
    static updateMetadata(id: string, data: {
        title?: string;
        overview?: string;
        runtime?: number;
        vote_average?: number;
        vote_count?: number;
        poster_path?: string;
        backdrop_path?: string;
        tmdb_status?: string;
        theatrical_release_date?: string;
        digital_release_date?: string;
        physical_release_date?: string;
        collection_id?: number | null;
        collection_name?: string | null;
    }): Movie | undefined;
    static fixMatch(id: string, data: {
        tmdb_id: number;
        title: string;
        year?: number;
        overview?: string;
        poster_path?: string;
        backdrop_path?: string;
        runtime?: number;
        vote_average?: number;
        vote_count?: number;
        status?: string;
        imdb_id?: string;
        tmdb_status?: string;
        theatrical_release_date?: string;
        digital_release_date?: string;
        physical_release_date?: string;
    }): Movie | undefined;
    /**
     * Update cast, crew, genres, collection, and certification data for a movie
     */
    static updateMediaMetadata(id: string, data: {
        cast_data?: CastMember[];
        crew_data?: CrewMember[];
        genres?: Genre[];
        collection_id?: number;
        collection_name?: string;
        certification?: string;
    }): Movie | undefined;
    /**
     * Find related movies - prioritizes collection items, then supplements with actor matches
     * Only shows truly related content, not weak genre-only matches
     */
    static findRelated(id: string, limit?: number): {
        movie: Movie;
        score: number;
        reasons: string[];
    }[];
}
//# sourceMappingURL=Movie.d.ts.map