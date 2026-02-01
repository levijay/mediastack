import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { tmdbService, TMDBService } from '../services/tmdb';
import { episodeFetcherService } from '../services/episodeFetcher';
import { TVSeriesModel } from '../models/TVSeries';
import { MovieModel, MovieFile } from '../models/Movie';
import { mediaInfoService } from '../services/mediaInfo';
import logger from '../config/logger';
import fs from 'fs';
import path from 'path';

interface ScannedFile {
  path: string;
  filename: string;
  size: number;
  tmdbMatch?: {
    id: number;
    title: string;
    year: number;
    poster_path: string;
  };
}

export class LibraryScannerController {
  private static VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.wmv', '.mov', '.ts', '.m2ts'];

  /**
   * Internal method to scan a series folder for video files and match to episodes
   * Can be called from both the API endpoint and from addSeries
   */
  static async scanSeriesFiles(seriesId: string, refreshMetadata: boolean = false): Promise<{ matched: number; total: number }> {
    const series = TVSeriesModel.findById(seriesId);
    if (!series || !series.folder_path) {
      return { matched: 0, total: 0 };
    }

    logger.info(`Auto-scanning episode files for: ${series.title}`);

    // Refresh metadata from TMDB if requested and tmdb_id exists
    if (refreshMetadata && series.tmdb_id) {
      try {
        const tmdbData = await tmdbService.getTVDetails(series.tmdb_id);
        if (tmdbData) {
          let status = tmdbData.status;
          if (status === 'Returning Series') status = 'Continuing';
          
          TVSeriesModel.updateMetadata(seriesId, {
            title: tmdbData.name,
            status: status,
            overview: tmdbData.overview,
            vote_average: tmdbData.vote_average,
            vote_count: tmdbData.vote_count,
            poster_path: tmdbData.poster_path,
            backdrop_path: tmdbData.backdrop_path,
            network: tmdbData.networks?.[0]?.name,
          });
          logger.info(`Refreshed metadata for: ${series.title}`);
          
          // Refresh seasons and episodes from TMDB
          await episodeFetcherService.fetchAndPopulateEpisodes(seriesId);
          logger.info(`Refreshed episodes from TMDB for: ${series.title}`);
        }
      } catch (error) {
        logger.warn(`Failed to refresh metadata for ${series.title}:`, error);
      }
    }

    // Check if folder exists
    if (!fs.existsSync(series.folder_path)) {
      return { matched: 0, total: 0 };
    }

    // Find all video files in the series folder
    const videoFiles = LibraryScannerController.findAllVideoFiles(series.folder_path);
    
    let matchedCount = 0;

    // Parse each file and try to match to an episode
    for (const file of videoFiles) {
      const episodeInfo = LibraryScannerController.parseEpisodeFilename(file.filename);
      
      if (episodeInfo.season !== undefined && episodeInfo.episode !== undefined) {
        // Find the episode in database
        const episodes = TVSeriesModel.findEpisodesBySeason(seriesId, episodeInfo.season);
        const dbEpisode = episodes.find(e => e.episode_number === episodeInfo.episode);
        
        if (dbEpisode) {
          // Get detailed media info using ffprobe
          const mediaInfo = await mediaInfoService.getMediaInfo(file.path);
          
          // Parse release group from filename
          const releaseGroupMatch = file.filename.match(/-([A-Za-z0-9]+)(?:\.[^.]+)?$/);
          const releaseGroup = releaseGroupMatch ? releaseGroupMatch[1] : undefined;

          // Update episode with file info from mediaInfo
          TVSeriesModel.updateEpisodeFile(
            dbEpisode.id, 
            file.path, 
            file.size, 
            mediaInfo.qualityFull || mediaInfo.resolution || '',
            mediaInfo.videoCodec,
            mediaInfo.audioCodec,
            releaseGroup
          );
          matchedCount++;
        }
      }
    }

    logger.info(`Matched ${matchedCount} episode files for: ${series.title}`);
    return { matched: matchedCount, total: videoFiles.length };
  }

  /**
   * Internal method to scan a movie folder for video files and refresh metadata
   * Can be called from both the API endpoint and from addMovie
   */
  static async scanMovieFiles(movieId: string, refreshMetadata: boolean = false): Promise<{ found: number }> {
    const movie = MovieModel.findById(movieId);
    if (!movie || !movie.folder_path) {
      return { found: 0 };
    }

    logger.info(`Auto-scanning movie files for: ${movie.title}`);

    // Refresh metadata from TMDB if requested and tmdb_id exists
    if (refreshMetadata && movie.tmdb_id) {
      try {
        const tmdbData = await tmdbService.getMovieDetails(movie.tmdb_id);
        if (tmdbData) {
          // Extract release dates
          const releaseDates = TMDBService.extractReleaseDates(tmdbData);
          
          MovieModel.updateMetadata(movieId, {
            title: tmdbData.title,
            overview: tmdbData.overview,
            runtime: tmdbData.runtime,
            vote_average: tmdbData.vote_average,
            vote_count: tmdbData.vote_count,
            poster_path: tmdbData.poster_path,
            backdrop_path: tmdbData.backdrop_path,
            tmdb_status: tmdbData.status,
            theatrical_release_date: releaseDates.theatricalDate,
            digital_release_date: releaseDates.digitalDate,
            physical_release_date: releaseDates.physicalDate
          });
          logger.info(`Refreshed metadata for: ${movie.title}`);
        }
      } catch (error) {
        logger.warn(`Failed to refresh metadata for ${movie.title}:`, error);
      }
    }

    // Check if folder exists
    if (!fs.existsSync(movie.folder_path)) {
      MovieModel.deleteMovieFilesByMovieId(movieId);
      MovieModel.updateHasFile(movieId, false);
      return { found: 0 };
    }

    // Find all video files in the movie folder
    const videoFiles = LibraryScannerController.findAllVideoFiles(movie.folder_path);
    
    // Clear existing files and add new ones
    MovieModel.deleteMovieFilesByMovieId(movieId);
    
    let addedCount = 0;
    let bestQuality: string | undefined;
    let largestFileSize = 0;
    
    for (const file of videoFiles) {
      // Get detailed media info using ffprobe
      const mediaInfo = await mediaInfoService.getMediaInfo(file.path);
      
      // Parse release group from filename
      const releaseMatch = file.filename.match(/-([A-Za-z0-9]+)(?:\.[^.]+)?$/);
      const releaseGroup = releaseMatch ? releaseMatch[1] : null;
      
      const fileQuality = mediaInfo.qualityFull || mediaInfo.resolution || undefined;

      MovieModel.addMovieFile({
        movie_id: movieId,
        file_path: file.path,
        relative_path: path.relative(movie.folder_path, file.path),
        file_size: file.size,
        quality: fileQuality,
        resolution: mediaInfo.resolution || undefined,
        video_codec: mediaInfo.videoCodec || undefined,
        video_dynamic_range: mediaInfo.videoDynamicRange || undefined,
        audio_codec: mediaInfo.audioCodec || undefined,
        audio_channels: mediaInfo.audioChannels || undefined,
        audio_languages: mediaInfo.audioLanguages || undefined,
        audio_track_count: mediaInfo.audioTrackCount || 1,
        subtitle_languages: mediaInfo.subtitleLanguages || undefined,
        release_group: releaseGroup || undefined
      });
      addedCount++;
      
      // Track quality from largest file (most likely the main movie file)
      if (file.size > largestFileSize) {
        largestFileSize = file.size;
        bestQuality = fileQuality;
      }
    }

    // Update movie has_file status AND quality
    if (addedCount > 0 && bestQuality) {
      // Use updateFile to set has_file, file_path, file_size, and quality together
      const largestFile = videoFiles.reduce((a, b) => a.size > b.size ? a : b);
      MovieModel.updateFile(movieId, largestFile.path, largestFile.size, bestQuality);
    } else {
      MovieModel.updateHasFile(movieId, addedCount > 0);
    }

    logger.info(`Found ${addedCount} video files for: ${movie.title}`);
    return { found: addedCount };
  }

  /**
   * Scan a movie's folder for video files and update the database
   */
  static async scanMovie(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { movieId } = req.params;

      const movie = MovieModel.findById(movieId);
      if (!movie) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      if (!movie.folder_path) {
        return res.status(400).json({ error: 'Movie folder not set' });
      }

      // Use internal method with metadata refresh enabled
      const result = await LibraryScannerController.scanMovieFiles(movieId, true);

      // Get the updated movie files for response
      const movieFiles = MovieModel.findMovieFiles(movieId);

      return res.json({
        success: true,
        found: result.found,
        files: movieFiles.map(f => ({ path: f.file_path, size: f.file_size }))
      });
    } catch (error) {
      logger.error('Movie scan error:', error);
      return res.status(500).json({ error: 'Failed to scan movie' });
    }
  }

  /**
   * Get all folder paths currently in the library - for checking if files are already imported
   */
  static async getLibraryPaths(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const type = req.query.type as string;

      if (type === 'movie') {
        const paths = MovieModel.getAllFolderPaths();
        return res.json({ paths });
      } else {
        const paths = TVSeriesModel.getAllFolderPaths();
        return res.json({ paths });
      }
    } catch (error) {
      logger.error('Get library paths error:', error);
      return res.status(500).json({ error: 'Failed to get library paths' });
    }
  }

  /**
   * Scan a directory for media files - returns files quickly without TMDB matching
   * TMDB matching is done on frontend in batches for better UX
   */
  static async scanDirectory(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { path: scanPath, type = 'movie' } = req.body;

      if (!scanPath) {
        return res.status(400).json({ error: 'Path is required' });
      }

      // Check if path exists
      if (!fs.existsSync(scanPath)) {
        return res.status(400).json({ error: 'Path does not exist' });
      }

      logger.info(`Scanning directory: ${scanPath} for ${type}`);

      // Quick file enumeration - no TMDB matching
      const files = await LibraryScannerController.findMediaFiles(scanPath, type === 'tv');
      
      // Return files immediately - frontend will handle TMDB matching
      const results: ScannedFile[] = files.map(file => ({
        path: file.path,
        filename: file.filename,
        size: file.size
      }));

      logger.info(`Scan complete: Found ${results.length} files`);

      return res.json({
        files: results,
        stats: {
          total: results.length,
          matched: 0,
          unmatched: results.length
        }
      });
    } catch (error) {
      logger.error('Library scan error:', error);
      return res.status(500).json({ error: 'Failed to scan library' });
    }
  }

  /**
   * Scan episode files for an imported TV series and match them to episodes
   */
  static async scanSeriesEpisodes(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { seriesId } = req.params;

      const series = TVSeriesModel.findById(seriesId);
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      if (!series.folder_path) {
        return res.status(400).json({ error: 'Series has no folder path set. Edit the series to set a folder path.' });
      }
      
      if (!fs.existsSync(series.folder_path)) {
        return res.status(400).json({ 
          error: `Series folder not found: ${series.folder_path}. Check that the path exists and volume mappings are correct.` 
        });
      }

      // Use internal method with metadata refresh enabled
      const result = await LibraryScannerController.scanSeriesFiles(seriesId, true);

      return res.json({
        success: true,
        matched: result.matched,
        total: result.total
      });
    } catch (error) {
      logger.error('Episode scan error:', error);
      return res.status(500).json({ error: 'Failed to scan episodes' });
    }
  }

  /**
   * Find all video files recursively
   */
  private static findAllVideoFiles(dir: string): { path: string; filename: string; size: number }[] {
    const results: { path: string; filename: string; size: number }[] = [];

    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          results.push(...LibraryScannerController.findAllVideoFiles(fullPath));
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (LibraryScannerController.VIDEO_EXTENSIONS.includes(ext)) {
            const stats = fs.statSync(fullPath);
            if (stats.size > 10 * 1024 * 1024 && !item.name.toLowerCase().includes('sample')) {
              results.push({
                path: fullPath,
                filename: item.name,
                size: stats.size
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Error reading directory ${dir}:`, error);
    }

    return results;
  }

  /**
   * Parse episode filename to extract season and episode numbers
   */
  private static parseEpisodeFilename(filename: string): { season?: number; episode?: number; quality?: string } {
    // Common patterns - order matters, more specific patterns first
    const patterns = [
      /S(\d{1,2})E(\d{1,3})/i,        // S01E01, S01E112, S03E121
      /(\d{1,2})x(\d{1,3})/i,          // 1x01, 3x121
      /Season\s*(\d{1,2})\s*Episode\s*(\d{1,3})/i,  // Season 1 Episode 1
      /\.(\d{1})(\d{2,3})\./,          // .101. or .1121. (season 1, episode 01 or 121)
      /\s(\d{1})(\d{2})\s/,            // space101space
      /-\s*(\d{1})(\d{2})\s*-/,        // - 101 -
    ];

    let season: number | undefined;
    let episode: number | undefined;

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        season = parseInt(match[1]);
        episode = parseInt(match[2]);
        break;
      }
    }

    // Extract quality
    const qualityMatch = filename.match(/2160p|4K|UHD|1080p|720p|480p/i);
    const quality = qualityMatch ? qualityMatch[0].toUpperCase().replace('4K', '2160p').replace('UHD', '2160p') : undefined;

    return { season, episode, quality };
  }

  /**
   * Recursively find media files in a directory
   */
  private static async findMediaFiles(dir: string, isTV: boolean): Promise<{ path: string; filename: string; size: number }[]> {
    const results: { path: string; filename: string; size: number }[] = [];

    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          // For TV shows, treat each top-level subdirectory as a potential show
          if (isTV) {
            // Check if this directory contains video files
            const subFiles = LibraryScannerController.findAllVideoFiles(fullPath);
            if (subFiles.length > 0) {
              // Use the directory name as the show name
              results.push({
                path: fullPath,
                filename: item.name,
                size: subFiles.reduce((acc, f) => acc + f.size, 0)
              });
            }
          } else {
            // For movies, recursively search
            const subFiles = await LibraryScannerController.findMediaFiles(fullPath, isTV);
            results.push(...subFiles);
          }
        } else if (item.isFile() && !isTV) {
          const ext = path.extname(item.name).toLowerCase();
          if (LibraryScannerController.VIDEO_EXTENSIONS.includes(ext)) {
            // Skip sample files and very small files
            const stats = fs.statSync(fullPath);
            if (stats.size > 50 * 1024 * 1024 && !item.name.toLowerCase().includes('sample')) {
              results.push({
                path: fullPath,
                filename: item.name,
                size: stats.size
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Error reading directory ${dir}:`, error);
    }

    return results;
  }

  /**
   * Parse a filename to extract title, year, and quality
   */
  private static parseFilename(filename: string, isTV: boolean): { title: string; year?: number; quality?: string } {
    // Remove extension
    let name = filename.replace(/\.(mkv|mp4|avi|m4v|wmv|mov|ts|m2ts)$/i, '');

    // Extract year
    const yearMatch = name.match(/[(\[.\s](19|20)\d{2}[)\].\s]/);
    const year = yearMatch ? parseInt(yearMatch[0].replace(/[^\d]/g, '')) : undefined;

    // Extract quality
    const qualityMatch = name.match(/2160p|4K|UHD|1080p|720p|480p/i);
    const quality = qualityMatch ? qualityMatch[0].toLowerCase().replace('4k', '2160p').replace('uhd', '2160p') : undefined;

    // Clean title
    let title = name
      // Remove year and everything after
      .replace(/[(\[.\s](19|20)\d{2}[)\].\s].*$/i, '')
      // Remove common release info
      .replace(/BluRay|BRRip|BDRip|DVDRip|WEB-DL|WEBRip|HDTV|PDTV/gi, '')
      // Replace dots and underscores with spaces
      .replace(/\./g, ' ')
      .replace(/_/g, ' ')
      // Remove brackets and their contents
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();

    // For TV, also try to clean up season/episode info
    if (isTV) {
      title = title.replace(/S\d+E\d+/gi, '').replace(/Season\s*\d+/gi, '').trim();
    }

    return { title, year, quality };
  }

  /**
   * Get suggestions for unmatched files
   */
  static async getSuggestions(req: AuthRequest, res: Response) {
    try {
      const { filename, type = 'movie' } = req.query;

      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ error: 'Filename is required' });
      }

      const parsed = LibraryScannerController.parseFilename(filename, type === 'tv');

      let suggestions;
      if (type === 'movie') {
        // Search with year if available for better matching
        const results = await tmdbService.searchMovies(parsed.title, 1, parsed.year);
        let movieResults = results.results || [];
        
        // If we have a year and title, prioritize exact matches
        if (parsed.year && movieResults.length > 0) {
          // Sort results: exact title+year first, then year match, then rest
          const normalizedTitle = parsed.title.toLowerCase().trim();
          movieResults.sort((a: any, b: any) => {
            const aTitle = (a.title || '').toLowerCase().trim();
            const bTitle = (b.title || '').toLowerCase().trim();
            const aYear = a.release_date ? parseInt(a.release_date.split('-')[0]) : 0;
            const bYear = b.release_date ? parseInt(b.release_date.split('-')[0]) : 0;
            
            // Exact title + year match comes first
            const aExact = aTitle === normalizedTitle && aYear === parsed.year;
            const bExact = bTitle === normalizedTitle && bYear === parsed.year;
            if (aExact && !bExact) return -1;
            if (bExact && !aExact) return 1;
            
            // Then title match with year within ±1 year
            const aCloseYear = Math.abs(aYear - (parsed.year || 0)) <= 1;
            const bCloseYear = Math.abs(bYear - (parsed.year || 0)) <= 1;
            const aTitleMatch = aTitle === normalizedTitle && aCloseYear;
            const bTitleMatch = bTitle === normalizedTitle && bCloseYear;
            if (aTitleMatch && !bTitleMatch) return -1;
            if (bTitleMatch && !aTitleMatch) return 1;
            
            // Then year match
            const aYearMatch = aYear === parsed.year;
            const bYearMatch = bYear === parsed.year;
            if (aYearMatch && !bYearMatch) return -1;
            if (bYearMatch && !aYearMatch) return 1;
            
            return 0;
          });
        }
        
        suggestions = movieResults.slice(0, 10);
      } else {
        const results = await tmdbService.searchTV(parsed.title);
        suggestions = results.results?.slice(0, 10) || [];
      }

      return res.json({ suggestions });
    } catch (error) {
      logger.error('Get suggestions error:', error);
      return res.status(500).json({ error: 'Failed to get suggestions' });
    }
  }

  /**
   * Manual import for a series - scans the series folder for video files
   * and imports any that match episodes but haven't been imported yet
   */
  static async manualImportSeries(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { seriesId } = req.params;
      const series = TVSeriesModel.findById(seriesId);
      
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      if (!series.folder_path) {
        return res.status(400).json({ error: 'Series has no folder path configured' });
      }

      if (!fs.existsSync(series.folder_path)) {
        return res.status(400).json({ error: `Folder not accessible: ${series.folder_path}` });
      }

      logger.info(`[ManualImport] Starting manual import for: ${series.title}`);
      logger.info(`[ManualImport] Scanning folder: ${series.folder_path}`);

      // Find all video files in the series folder
      const videoFiles = LibraryScannerController.findAllVideoFiles(series.folder_path);
      logger.info(`[ManualImport] Found ${videoFiles.length} video files`);

      const results: {
        imported: { season: number; episode: number; filename: string; quality: string }[];
        skipped: { season: number; episode: number; filename: string; reason: string }[];
        unmatched: { filename: string; reason: string }[];
      } = {
        imported: [],
        skipped: [],
        unmatched: []
      };

      // Get all episodes for this series
      const allEpisodes = TVSeriesModel.findEpisodesBySeriesId(seriesId);
      logger.info(`[ManualImport] Found ${allEpisodes.length} episodes in database`);
      
      // Count episodes without files
      const episodesWithoutFiles = allEpisodes.filter(e => !e.has_file).length;
      logger.info(`[ManualImport] Episodes without files: ${episodesWithoutFiles}`);

      // Parse each file and try to match to an episode
      for (const file of videoFiles) {
        const episodeInfo = LibraryScannerController.parseEpisodeFilename(file.filename);
        
        if (episodeInfo.season === undefined || episodeInfo.episode === undefined) {
          results.unmatched.push({
            filename: file.filename,
            reason: 'Could not parse season/episode from filename'
          });
          // Log first few unmatched for debugging
          if (results.unmatched.length <= 5) {
            logger.warn(`[ManualImport] Could not parse: ${file.filename}`);
          }
          continue;
        }

        // Find the episode in database
        const dbEpisode = allEpisodes.find(
          e => e.season_number === episodeInfo.season && e.episode_number === episodeInfo.episode
        );
        
        if (!dbEpisode) {
          results.unmatched.push({
            filename: file.filename,
            reason: `Episode S${String(episodeInfo.season).padStart(2, '0')}E${String(episodeInfo.episode).padStart(2, '0')} not found in database`
          });
          // Log first few not found for debugging
          if (results.unmatched.filter(u => u.reason.includes('not found')).length <= 5) {
            logger.warn(`[ManualImport] Episode not in DB: S${episodeInfo.season}E${episodeInfo.episode} - ${file.filename}`);
          }
          continue;
        }

        // Check if episode already has a file
        if (dbEpisode.has_file && dbEpisode.file_path) {
          // Check if the existing file still exists
          if (fs.existsSync(dbEpisode.file_path)) {
            results.skipped.push({
              season: episodeInfo.season,
              episode: episodeInfo.episode,
              filename: file.filename,
              reason: 'Episode already has a file'
            });
            continue;
          } else {
            logger.info(`[ManualImport] Existing file missing, will reimport: S${episodeInfo.season}E${episodeInfo.episode}`);
          }
        }

        // Get detailed media info using ffprobe
        const mediaInfo = await mediaInfoService.getMediaInfo(file.path);
        
        // Parse release group from filename
        const releaseGroupMatch = file.filename.match(/-([A-Za-z0-9]+)(?:\.[^.]+)?$/);
        const releaseGroup = releaseGroupMatch ? releaseGroupMatch[1] : undefined;

        // Update episode with file info
        TVSeriesModel.updateEpisodeFile(
          dbEpisode.id, 
          file.path, 
          file.size, 
          mediaInfo.qualityFull || mediaInfo.resolution || '',
          mediaInfo.videoCodec,
          mediaInfo.audioCodec,
          releaseGroup
        );

        results.imported.push({
          season: episodeInfo.season,
          episode: episodeInfo.episode,
          filename: file.filename,
          quality: mediaInfo.qualityFull || mediaInfo.resolution || 'Unknown'
        });

        logger.info(`[ManualImport] Imported S${String(episodeInfo.season).padStart(2, '0')}E${String(episodeInfo.episode).padStart(2, '0')}: ${file.filename}`);
      }

      logger.info(`[ManualImport] Complete - Imported: ${results.imported.length}, Skipped: ${results.skipped.length}, Unmatched: ${results.unmatched.length}`);

      return res.json({
        success: true,
        series: series.title,
        folder: series.folder_path,
        totalFiles: videoFiles.length,
        results
      });
    } catch (error: any) {
      logger.error('[ManualImport] Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to import files' });
    }
  }
}
