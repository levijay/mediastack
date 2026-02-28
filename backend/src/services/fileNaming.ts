import { NamingConfigModel, NamingConfig } from '../models/NamingConfig';
import logger from '../config/logger';
import path from 'path';
import fs from 'fs';

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

export class FileNamingService {
  // Always read fresh config from database to ensure changes take effect immediately
  private get config(): NamingConfig {
    try {
      return NamingConfigModel.get();
    } catch (error) {
      // Return defaults if DB not ready
      logger.warn('NamingConfig not available, using defaults');
      return {
        id: 1,
        rename_movies: true,
        rename_episodes: true,
        replace_illegal_characters: true,
        colon_replacement: ' - ',
        standard_movie_format: '{Movie Title} ({Release Year}) [{Quality Full}]',
        movie_folder_format: '{Movie Title} ({Release Year})',
        standard_episode_format: '{Series Title} - S{season:00}E{episode:00} - {Episode Title} [{Quality Full}]',
        daily_episode_format: '{Series Title} - {Air-Date} - {Episode Title} [{Quality Full}]',
        anime_episode_format: '{Series Title} - S{season:00}E{episode:00} - {absolute:000} - {Episode Title} [{Quality Full}]',
        series_folder_format: '{Series Title} ({Series Year})',
        season_folder_format: 'Season {season:00}',
        specials_folder_format: 'Specials',
        multi_episode_style: 'prefixed_range',
        updated_at: new Date().toISOString()
      };
    }
  }

  // No-op for backwards compatibility - config is always read fresh from DB now
  refreshConfig(): void {
    // Config is no longer cached, so nothing to refresh
  }

  // Clean a string for use in filenames
  private cleanTitle(title: string): string {
    let clean = title;
    
    // First, replace colons with configured replacement (before removing illegal chars)
    clean = clean.replace(/:/g, this.config.colon_replacement);
    
    if (this.config.replace_illegal_characters) {
      // Replace remaining illegal characters with empty string (colon already handled above)
      // Illegal characters: < > " / \ | ? *
      clean = clean.replace(/[<>"/\\|?*]/g, '');
    }
    
    // Remove leading/trailing whitespace and dots
    clean = clean.trim().replace(/^\.+|\.+$/g, '');
    
    return clean;
  }

  // Public method to sanitize a folder path (preserves directory structure)
  sanitizeFolderPath(folderPath: string): string {
    // Split path into parts, clean each part, rejoin
    const parts = folderPath.split('/');
    const cleanParts = parts.map((part, index) => {
      // Keep empty parts (leading slash) and don't modify known root paths
      if (part === '' || part === 'data' || part === 'mnt' || part === 'media') {
        return part;
      }
      return this.cleanTitle(part);
    });
    return cleanParts.join('/');
  }

  // Move "The", "A", "An" to end of title
  private titleWithArticleAtEnd(title: string): string {
    const articles = ['The ', 'A ', 'An '];
    for (const article of articles) {
      if (title.startsWith(article)) {
        return `${title.substring(article.length)}, ${article.trim()}`;
      }
    }
    return title;
  }

  // Format a number with padding
  private padNumber(num: number, digits: number): string {
    return num.toString().padStart(digits, '0');
  }

  // Build media info string
  private buildMediaInfoSimple(info: { videoCodec?: string; audioCodec?: string; audioChannels?: string }): string {
    const parts: string[] = [];
    if (info.videoCodec) parts.push(info.videoCodec);
    if (info.audioCodec) parts.push(info.audioCodec);
    if (info.audioChannels) parts.push(info.audioChannels);
    return parts.join(' ');
  }

  // Build full media info string
  private buildMediaInfoFull(info: MovieNamingInfo | EpisodeNamingInfo): string {
    const parts: string[] = [];
    if (info.dynamicRange) parts.push(info.dynamicRange);
    if (info.videoCodec) parts.push(info.videoCodec);
    if (info.audioCodec) parts.push(info.audioCodec);
    if (info.audioChannels) parts.push(info.audioChannels);
    return parts.join(' ');
  }

  // Generate movie filename
  generateMovieFilename(info: MovieNamingInfo, extension: string): string {
    const config = this.config;
    logger.debug(`[FileNaming] rename_movies setting: ${config.rename_movies}`);
    logger.debug(`[FileNaming] standard_movie_format: ${config.standard_movie_format}`);
    
    if (!config.rename_movies) {
      logger.info(`[FileNaming] Renaming disabled, returning empty string`);
      return ''; // Return empty to indicate no rename
    }

    let filename = config.standard_movie_format;
    const cleanedTitle = this.cleanTitle(info.title);

    // Movie title tokens
    filename = filename.replace(/{Movie Title}/g, cleanedTitle);
    filename = filename.replace(/{Movie CleanTitle}/g, info.cleanTitle || cleanedTitle.replace(/[^\w\s]/g, ''));
    filename = filename.replace(/{Movie TitleThe}/g, this.titleWithArticleAtEnd(cleanedTitle));
    filename = filename.replace(/{Movie OriginalTitle}/g, info.originalTitle || cleanedTitle);
    filename = filename.replace(/{Movie TitleFirstCharacter}/g, cleanedTitle.charAt(0).toUpperCase());
    filename = filename.replace(/{Movie Collection}/g, info.collection || '');
    filename = filename.replace(/{Movie CleanCollectionThe}/g, info.collection ? this.titleWithArticleAtEnd(info.collection) : '');
    filename = filename.replace(/{Movie Certification}/g, info.certification || '');
    filename = filename.replace(/{Release Year}/g, info.year?.toString() || '');
    
    // Quality tokens
    const qualityFull = [info.quality, info.proper ? 'Proper' : ''].filter(Boolean).join(' ');
    filename = filename.replace(/{Quality Full}/g, qualityFull);
    filename = filename.replace(/{Quality Title}/g, info.quality || '');
    
    // Media info tokens
    filename = filename.replace(/{MediaInfo Simple}/g, this.buildMediaInfoSimple(info));
    filename = filename.replace(/{MediaInfo Full}/g, this.buildMediaInfoFull(info));
    filename = filename.replace(/{MediaInfo VideoCodec}/g, info.videoCodec || '');
    filename = filename.replace(/{MediaInfo VideoBitDepth}/g, info.videoBitDepth?.toString() || '');
    filename = filename.replace(/{MediaInfo VideoDynamicRange}/g, info.dynamicRange || '');
    filename = filename.replace(/{MediaInfo VideoDynamicRangeType}/g, info.dynamicRangeType || info.dynamicRange || '');
    filename = filename.replace(/{MediaInfo AudioCodec}/g, info.audioCodec || '');
    filename = filename.replace(/{MediaInfo AudioChannels}/g, info.audioChannels || '');
    filename = filename.replace(/{MediaInfo AudioLanguages}/g, info.audioLanguages ? `[${info.audioLanguages}]` : '');
    filename = filename.replace(/{MediaInfo SubtitleLanguages}/g, info.subtitleLanguages ? `[${info.subtitleLanguages}]` : '');
    
    // Release info
    filename = filename.replace(/{Release Group}/g, info.releaseGroup || '');
    filename = filename.replace(/{-Release Group}/g, info.releaseGroup ? `-${info.releaseGroup}` : '');
    filename = filename.replace(/{Edition Tags}/g, info.edition || '');
    filename = filename.replace(/{Edition Tags }/g, info.edition ? `${info.edition} ` : '');
    filename = filename.replace(/{Custom Formats}/g, info.customFormats || '');
    filename = filename.replace(/{\[Custom Formats\]}/g, info.customFormats ? `[${info.customFormats}]` : '');
    
    // ID tokens
    filename = filename.replace(/{TmdbId}/g, info.tmdbId?.toString() || '');
    filename = filename.replace(/{ImdbId}/g, info.imdbId || '');
    filename = filename.replace(/{tmdb-id}/g, info.tmdbId?.toString() || '');
    filename = filename.replace(/{imdb-id}/g, info.imdbId || '');

    // Clean up empty brackets and extra spaces
    filename = this.cleanupFilename(filename);

    return filename + extension;
  }

  // Generate movie folder name
  generateMovieFolderName(info: MovieNamingInfo): string {
    let folderName = this.config.movie_folder_format;
    const cleanedTitle = this.cleanTitle(info.title);

    folderName = folderName.replace(/{Movie Title}/g, cleanedTitle);
    folderName = folderName.replace(/{Movie CleanTitle}/g, info.cleanTitle || cleanedTitle.replace(/[^\w\s]/g, ''));
    folderName = folderName.replace(/{Movie TitleThe}/g, this.titleWithArticleAtEnd(cleanedTitle));
    folderName = folderName.replace(/{Movie TitleFirstCharacter}/g, cleanedTitle.charAt(0).toUpperCase());
    folderName = folderName.replace(/{Release Year}/g, info.year?.toString() || '');
    folderName = folderName.replace(/{TmdbId}/g, info.tmdbId?.toString() || '');
    folderName = folderName.replace(/{ImdbId}/g, info.imdbId || '');
    folderName = folderName.replace(/{tmdb-id}/g, info.tmdbId?.toString() || '');
    folderName = folderName.replace(/{imdb-id}/g, info.imdbId || '');

    return this.cleanupFilename(folderName);
  }

  // Generate episode filename
  generateEpisodeFilename(info: EpisodeNamingInfo, extension: string): string {
    const config = this.config;
    logger.debug(`[FileNaming] rename_episodes setting: ${config.rename_episodes}`);
    logger.debug(`[FileNaming] standard_episode_format: ${config.standard_episode_format}`);
    
    if (!config.rename_episodes) {
      logger.info(`[FileNaming] Episode renaming disabled, returning empty string`);
      return ''; // Return empty to indicate no rename
    }

    // Choose format based on episode type
    let filename: string;
    if (info.isDaily && info.airDate) {
      filename = config.daily_episode_format;
    } else if (info.isAnime && info.absoluteNumber) {
      filename = config.anime_episode_format;
    } else {
      filename = config.standard_episode_format;
    }

    const cleanedSeriesTitle = this.cleanTitle(info.seriesTitle);
    const cleanedEpisodeTitle = this.cleanTitle(info.episodeTitle || '');

    // Series title tokens
    filename = filename.replace(/{Series Title}/g, cleanedSeriesTitle);
    filename = filename.replace(/{Series CleanTitle}/g, info.seriesCleanTitle || cleanedSeriesTitle.replace(/[^\w\s]/g, ''));
    filename = filename.replace(/{Series TitleYear}/g, 
      info.seriesYear ? `${cleanedSeriesTitle} (${info.seriesYear})` : cleanedSeriesTitle);
    filename = filename.replace(/{Series CleanTitleYear}/g, 
      info.seriesYear ? `${cleanedSeriesTitle} ${info.seriesYear}` : cleanedSeriesTitle);
    filename = filename.replace(/{Series TitleWithoutYear}/g, cleanedSeriesTitle);
    filename = filename.replace(/{Series CleanTitleWithoutYear}/g, cleanedSeriesTitle);
    filename = filename.replace(/{Series TitleThe}/g, this.titleWithArticleAtEnd(cleanedSeriesTitle));
    filename = filename.replace(/{Series CleanTitleThe}/g, this.titleWithArticleAtEnd(cleanedSeriesTitle));
    filename = filename.replace(/{Series TitleTheYear}/g, 
      info.seriesYear ? `${this.titleWithArticleAtEnd(cleanedSeriesTitle)} (${info.seriesYear})` : this.titleWithArticleAtEnd(cleanedSeriesTitle));
    filename = filename.replace(/{Series CleanTitleTheYear}/g, 
      info.seriesYear ? `${this.titleWithArticleAtEnd(cleanedSeriesTitle)} ${info.seriesYear}` : this.titleWithArticleAtEnd(cleanedSeriesTitle));
    filename = filename.replace(/{Series TitleTheWithoutYear}/g, this.titleWithArticleAtEnd(cleanedSeriesTitle));
    filename = filename.replace(/{Series CleanTitleTheWithoutYear}/g, this.titleWithArticleAtEnd(cleanedSeriesTitle));
    filename = filename.replace(/{Series TitleFirstCharacter}/g, cleanedSeriesTitle.charAt(0).toUpperCase());
    filename = filename.replace(/{Series Year}/g, info.seriesYear?.toString() || '');

    // Episode number tokens
    filename = filename.replace(/{season:0}/g, info.seasonNumber.toString());
    filename = filename.replace(/{season:00}/g, this.padNumber(info.seasonNumber, 2));
    filename = filename.replace(/{episode:0}/g, info.episodeNumber.toString());
    filename = filename.replace(/{episode:00}/g, this.padNumber(info.episodeNumber, 2));

    // Episode title tokens
    filename = filename.replace(/{Episode Title}/g, cleanedEpisodeTitle);
    filename = filename.replace(/{Episode CleanTitle}/g, info.episodeCleanTitle || cleanedEpisodeTitle.replace(/[^\w\s]/g, ''));

    // Daily/Anime specific
    filename = filename.replace(/{Air-Date}/g, info.airDate || '');
    filename = filename.replace(/{Air Date}/g, info.airDate?.replace(/-/g, ' ') || '');
    filename = filename.replace(/{absolute:0}/g, info.absoluteNumber?.toString() || '');
    filename = filename.replace(/{absolute:00}/g, info.absoluteNumber ? this.padNumber(info.absoluteNumber, 2) : '');
    filename = filename.replace(/{absolute:000}/g, info.absoluteNumber ? this.padNumber(info.absoluteNumber, 3) : '');

    // Quality tokens
    const qualityFull = [info.quality, info.proper ? 'Proper' : ''].filter(Boolean).join(' ');
    filename = filename.replace(/{Quality Full}/g, qualityFull);
    filename = filename.replace(/{Quality Title}/g, info.quality || '');

    // Media info tokens
    filename = filename.replace(/{MediaInfo Simple}/g, this.buildMediaInfoSimple(info));
    filename = filename.replace(/{MediaInfo Full}/g, this.buildMediaInfoFull(info));
    filename = filename.replace(/{MediaInfo VideoCodec}/g, info.videoCodec || '');
    filename = filename.replace(/{MediaInfo VideoBitDepth}/g, info.videoBitDepth?.toString() || '');
    filename = filename.replace(/{MediaInfo VideoDynamicRange}/g, info.dynamicRange || '');
    filename = filename.replace(/{MediaInfo VideoDynamicRangeType}/g, info.dynamicRangeType || info.dynamicRange || '');
    filename = filename.replace(/{MediaInfo AudioCodec}/g, info.audioCodec || '');
    filename = filename.replace(/{MediaInfo AudioChannels}/g, info.audioChannels || '');
    filename = filename.replace(/{MediaInfo AudioLanguages}/g, info.audioLanguages ? `[${info.audioLanguages}]` : '');
    filename = filename.replace(/{MediaInfo SubtitleLanguages}/g, info.subtitleLanguages ? `[${info.subtitleLanguages}]` : '');

    // Release info
    filename = filename.replace(/{Release Group}/g, info.releaseGroup || '');
    filename = filename.replace(/{-Release Group}/g, info.releaseGroup ? `-${info.releaseGroup}` : '');

    // ID tokens
    filename = filename.replace(/{TvdbId}/g, info.tvdbId?.toString() || '');
    filename = filename.replace(/{TmdbId}/g, info.tmdbId?.toString() || '');
    filename = filename.replace(/{ImdbId}/g, info.imdbId || '');
    filename = filename.replace(/{TvMazeId}/g, info.tvMazeId?.toString() || '');
    filename = filename.replace(/{tvdb-id}/g, info.tvdbId?.toString() || '');
    filename = filename.replace(/{tmdb-id}/g, info.tmdbId?.toString() || '');

    // Clean up
    filename = this.cleanupFilename(filename);

    return filename + extension;
  }

  // Generate series folder name
  generateSeriesFolderName(info: SeriesFolderInfo): string {
    let folderName = this.config.series_folder_format;
    const cleanedTitle = this.cleanTitle(info.title);

    folderName = folderName.replace(/{Series Title}/g, cleanedTitle);
    folderName = folderName.replace(/{Series CleanTitle}/g, info.cleanTitle || cleanedTitle.replace(/[^\w\s]/g, ''));
    folderName = folderName.replace(/{Series TitleYear}/g, 
      info.year ? `${cleanedTitle} (${info.year})` : cleanedTitle);
    folderName = folderName.replace(/{Series CleanTitleYear}/g, 
      info.year ? `${cleanedTitle} ${info.year}` : cleanedTitle);
    folderName = folderName.replace(/{Series TitleThe}/g, this.titleWithArticleAtEnd(cleanedTitle));
    folderName = folderName.replace(/{Series TitleFirstCharacter}/g, cleanedTitle.charAt(0).toUpperCase());
    folderName = folderName.replace(/{Series Year}/g, info.year?.toString() || '');
    folderName = folderName.replace(/{TvdbId}/g, info.tvdbId?.toString() || '');
    folderName = folderName.replace(/{TmdbId}/g, info.tmdbId?.toString() || '');
    folderName = folderName.replace(/{ImdbId}/g, info.imdbId || '');
    folderName = folderName.replace(/{tvdb-id}/g, info.tvdbId?.toString() || '');
    folderName = folderName.replace(/{tmdb-id}/g, info.tmdbId?.toString() || '');

    return this.cleanupFilename(folderName);
  }

  // Generate season folder name
  generateSeasonFolderName(seasonNumber: number): string {
    if (seasonNumber === 0) {
      return this.config.specials_folder_format;
    }

    let folderName = this.config.season_folder_format;
    folderName = folderName.replace(/{season:0}/g, seasonNumber.toString());
    folderName = folderName.replace(/{season:00}/g, this.padNumber(seasonNumber, 2));

    return this.cleanupFilename(folderName);
  }

  // Clean up filename - remove empty brackets, extra spaces, etc.
  private cleanupFilename(filename: string): string {
    // Remove empty brackets
    filename = filename.replace(/\[\s*\]/g, '');
    filename = filename.replace(/\(\s*\)/g, '');
    filename = filename.replace(/\{\s*\}/g, '');
    
    // Remove multiple spaces
    filename = filename.replace(/\s+/g, ' ');
    
    // Remove spaces before periods and underscores (but NOT hyphens - those are intentional separators)
    filename = filename.replace(/\s+([._])/g, '$1');
    
    // Clean up multiple hyphens or spaces around hyphens (but keep single space-hyphen-space pattern)
    filename = filename.replace(/\s+-\s+-/g, ' -'); // " - -" -> " -"
    filename = filename.replace(/-\s*-/g, '-'); // "- -" or "--" -> "-"
    
    // Remove leading/trailing spaces and dashes
    filename = filename.trim().replace(/^[\s\-]+|[\s\-]+$/g, '');
    
    return filename;
  }

  // Rename a movie file
  async renameMovieFile(
    currentPath: string,
    info: MovieNamingInfo,
    rootPath: string
  ): Promise<{ newPath: string; renamed: boolean }> {
    try {
      const extension = path.extname(currentPath);
      const newFilename = this.generateMovieFilename(info, extension);
      
      if (!newFilename) {
        return { newPath: currentPath, renamed: false };
      }

      const folderName = this.generateMovieFolderName(info);
      const newDir = path.join(rootPath, folderName);
      const newPath = path.join(newDir, newFilename);

      if (currentPath === newPath) {
        return { newPath: currentPath, renamed: false };
      }

      // Create directory if it doesn't exist
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }

      // Move the file
      fs.renameSync(currentPath, newPath);
      logger.info(`Renamed movie file: ${currentPath} -> ${newPath}`);

      return { newPath, renamed: true };
    } catch (error) {
      logger.error('Failed to rename movie file:', error);
      throw error;
    }
  }

  // Rename an episode file
  async renameEpisodeFile(
    currentPath: string,
    info: EpisodeNamingInfo,
    seriesPath: string
  ): Promise<{ newPath: string; renamed: boolean }> {
    try {
      const extension = path.extname(currentPath);
      const newFilename = this.generateEpisodeFilename(info, extension);
      
      if (!newFilename) {
        return { newPath: currentPath, renamed: false };
      }

      const seasonFolder = this.generateSeasonFolderName(info.seasonNumber);
      const newDir = path.join(seriesPath, seasonFolder);
      const newPath = path.join(newDir, newFilename);

      if (currentPath === newPath) {
        return { newPath: currentPath, renamed: false };
      }

      // Create directory if it doesn't exist
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }

      // Move the file
      fs.renameSync(currentPath, newPath);
      logger.info(`Renamed episode file: ${currentPath} -> ${newPath}`);

      return { newPath, renamed: true };
    } catch (error) {
      logger.error('Failed to rename episode file:', error);
      throw error;
    }
  }

  // Preview what a filename would look like
  previewMovieFilename(info: MovieNamingInfo): string {
    return this.generateMovieFilename(info, '.mkv');
  }

  previewEpisodeFilename(info: EpisodeNamingInfo): string {
    return this.generateEpisodeFilename(info, '.mkv');
  }

  previewMovieFolderName(info: MovieNamingInfo): string {
    return this.generateMovieFolderName(info);
  }

  previewSeriesFolderName(info: SeriesFolderInfo): string {
    return this.generateSeriesFolderName(info);
  }

  previewSeasonFolderName(seasonNumber: number): string {
    return this.generateSeasonFolderName(seasonNumber);
  }
}

export const fileNamingService = new FileNamingService();
