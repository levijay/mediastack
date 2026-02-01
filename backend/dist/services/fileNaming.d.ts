export interface MovieNamingInfo {
    title: string;
    cleanTitle?: string;
    originalTitle?: string;
    year?: number;
    tmdbId?: number;
    imdbId?: string;
    quality?: string;
    videoCodec?: string;
    audioCodec?: string;
    audioChannels?: string;
    audioLanguages?: string;
    subtitleLanguages?: string;
    videoBitDepth?: number;
    dynamicRange?: string;
    dynamicRangeType?: string;
    releaseGroup?: string;
    edition?: string;
    customFormats?: string;
    certification?: string;
    collection?: string;
    proper?: boolean;
}
export interface EpisodeNamingInfo {
    seriesTitle: string;
    seriesCleanTitle?: string;
    seriesYear?: number;
    seasonNumber: number;
    episodeNumber: number;
    episodeTitle?: string;
    episodeCleanTitle?: string;
    airDate?: string;
    absoluteNumber?: number;
    tvdbId?: number;
    tmdbId?: number;
    imdbId?: string;
    tvMazeId?: number;
    quality?: string;
    videoCodec?: string;
    audioCodec?: string;
    audioChannels?: string;
    audioLanguages?: string;
    subtitleLanguages?: string;
    videoBitDepth?: number;
    dynamicRange?: string;
    dynamicRangeType?: string;
    releaseGroup?: string;
    proper?: boolean;
    isDaily?: boolean;
    isAnime?: boolean;
}
export interface SeriesFolderInfo {
    title: string;
    cleanTitle?: string;
    year?: number;
    tvdbId?: number;
    tmdbId?: number;
    imdbId?: string;
}
export declare class FileNamingService {
    private _config;
    private get config();
    refreshConfig(): void;
    private cleanTitle;
    sanitizeFolderPath(folderPath: string): string;
    private titleWithArticleAtEnd;
    private padNumber;
    private buildMediaInfoSimple;
    private buildMediaInfoFull;
    generateMovieFilename(info: MovieNamingInfo, extension: string): string;
    generateMovieFolderName(info: MovieNamingInfo): string;
    generateEpisodeFilename(info: EpisodeNamingInfo, extension: string): string;
    generateSeriesFolderName(info: SeriesFolderInfo): string;
    generateSeasonFolderName(seasonNumber: number): string;
    private cleanupFilename;
    renameMovieFile(currentPath: string, info: MovieNamingInfo, rootPath: string): Promise<{
        newPath: string;
        renamed: boolean;
    }>;
    renameEpisodeFile(currentPath: string, info: EpisodeNamingInfo, seriesPath: string): Promise<{
        newPath: string;
        renamed: boolean;
    }>;
    previewMovieFilename(info: MovieNamingInfo): string;
    previewEpisodeFilename(info: EpisodeNamingInfo): string;
    previewMovieFolderName(info: MovieNamingInfo): string;
    previewSeriesFolderName(info: SeriesFolderInfo): string;
    previewSeasonFolderName(seasonNumber: number): string;
}
export declare const fileNamingService: FileNamingService;
//# sourceMappingURL=fileNaming.d.ts.map