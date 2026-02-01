import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MovieModel } from '../models/Movie';
import { TVSeriesModel } from '../models/TVSeries';
import { DownloadModel } from '../models/Download';
import { ActivityLogModel, EVENT_LABELS, EVENT_TYPES } from '../models/ActivityLog';
import { ExclusionModel } from '../models/Exclusion';
import { autoSearchService } from '../services/autoSearch';
import { episodeFetcherService } from '../services/episodeFetcher';
import { notificationService } from '../services/notification';
import { LibraryScannerController } from './LibraryScannerController';
import { fileNamingService } from '../services/fileNaming';
import { mediaInfoService } from '../services/mediaInfo';
import { tmdbService, TMDBService } from '../services/tmdb';
import logger from '../config/logger';
import path from 'path';
import fs from 'fs';

export class LibraryController {
  // Movies
  static async getMovies(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { monitored, missing, limit, offset = 0 } = req.query;
      
      // If no limit specified, return all movies
      const limitNum = limit ? Number(limit) : 100000;
      const offsetNum = Number(offset);

      let movies;
      let total;
      
      if (missing === 'true') {
        movies = MovieModel.findMissing();
        total = movies.length;
      } else if (monitored === 'true') {
        movies = MovieModel.findMonitored();
        total = movies.length;
      } else {
        movies = MovieModel.findAll(limitNum, offsetNum);
        total = MovieModel.count().total;
      }

      // Get all active downloads to add status to movies
      const activeDownloads = [
        ...DownloadModel.findByStatus('queued'),
        ...DownloadModel.findByStatus('downloading'),
        ...DownloadModel.findByStatus('importing')
      ];

      // Create a map for quick lookup
      const downloadMap = new Map<string, { status: string; progress: number }>();
      for (const dl of activeDownloads) {
        if (dl.movie_id) {
          downloadMap.set(dl.movie_id, { status: dl.status, progress: dl.progress });
        }
      }

      // Add download status to movies
      const moviesWithStatus = movies.map(movie => {
        const download = downloadMap.get(movie.id);
        return {
          ...movie,
          download_status: download?.status || null,
          download_progress: download?.progress || null
        };
      });

      return res.json({
        items: moviesWithStatus,
        total,
        limit: limitNum,
        offset: offsetNum
      });
    } catch (error) {
      logger.error('Get movies error:', error);
      return res.status(500).json({ error: 'Failed to get movies' });
    }
  }

  static async getRecentlyAdded(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { limit = 12 } = req.query;
      const limitNum = Math.min(Number(limit), 50);

      // Get recently added movies and series
      const recentMovies = MovieModel.findRecentlyAdded(limitNum);
      const recentSeries = TVSeriesModel.findRecentlyAdded(limitNum);

      // Combine and sort by created_at
      const combined = [
        ...recentMovies.map(m => ({
          id: m.id,
          title: m.title,
          year: m.year,
          poster_path: m.poster_path,
          type: 'movie' as const,
          added_at: m.created_at
        })),
        ...recentSeries.map(s => ({
          id: s.id,
          title: s.title,
          year: s.year,
          poster_path: s.poster_path,
          type: 'series' as const,
          added_at: s.created_at
        }))
      ];

      // Sort by added_at descending and take the limit
      combined.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
      
      return res.json(combined.slice(0, limitNum));
    } catch (error) {
      logger.error('Get recently added error:', error);
      return res.status(500).json({ error: 'Failed to get recently added items' });
    }
  }

  static async getMovieById(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const movie = MovieModel.findById(id);

      if (!movie) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      // Check for active downloads
      const downloads = DownloadModel.findByMovieId(id);
      const activeDownload = downloads.find(d => 
        d.status === 'queued' || d.status === 'downloading' || d.status === 'importing'
      );

      return res.json({
        ...movie,
        download_status: activeDownload?.status || null,
        download_progress: activeDownload?.progress || null
      });
    } catch (error) {
      logger.error('Get movie error:', error);
      return res.status(500).json({ error: 'Failed to get movie' });
    }
  }

  static async addMovie(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { tmdb_id, title, year, overview, runtime, poster_path, backdrop_path, folder_path, quality_profile_id, monitored, has_file, file_size, quality, auto_search, minimum_availability } = req.body;

      if (!tmdb_id || !title || !folder_path) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Sanitize folder path for illegal characters
      const sanitizedFolderPath = fileNamingService.sanitizeFolderPath(folder_path);

      // Check if already exists
      const existing = MovieModel.findByTmdbId(tmdb_id);
      if (existing) {
        return res.status(409).json({ error: 'Movie already in library', movie: existing });
      }

      // Add movie immediately with provided data (no blocking API call)
      const movie = MovieModel.create({
        tmdb_id,
        title,
        year,
        overview,
        runtime,
        poster_path,
        backdrop_path,
        folder_path: sanitizedFolderPath,
        quality_profile_id,
        monitored,
        has_file,
        file_size,
        quality,
        minimum_availability: minimum_availability || 'released'
      });

      // Log activity: Added to Library
      ActivityLogModel.logMovieEvent(
        movie.id,
        EVENT_TYPES.ADDED,
        `${title} (${year || 'N/A'}) added to library`,
        JSON.stringify({
          source: 'Discover',
          tmdb_id,
          monitored,
          quality_profile_id
        })
      );
      
      // Send notification
      notificationService.notify({
        event: 'onMovieAdd',
        title: 'Movie Added',
        message: `${title} (${year || 'N/A'}) added to library`,
        mediaType: 'movie',
        mediaTitle: title
      }).catch(err => logger.error('Notification error:', err));

      logger.info(`Movie added to library: ${title} by ${req.user.username}`);

      // Return response immediately - background tasks start after
      res.status(201).json(movie);

      // Background: Fetch full details from TMDB and update
      setImmediate(async () => {
        try {
          const tmdbData = await tmdbService.getMovieDetails(tmdb_id);
          if (tmdbData) {
            // Extract release dates
            const releaseDates = TMDBService.extractReleaseDates(tmdbData);
            
            MovieModel.updateMetadata(movie.id, {
              vote_average: tmdbData.vote_average,
              vote_count: tmdbData.vote_count,
              overview: tmdbData.overview || overview,
              runtime: tmdbData.runtime || runtime,
              poster_path: tmdbData.poster_path || poster_path,
              backdrop_path: tmdbData.backdrop_path || backdrop_path,
              tmdb_status: tmdbData.status,
              theatrical_release_date: releaseDates.theatricalDate,
              digital_release_date: releaseDates.digitalDate,
              physical_release_date: releaseDates.physicalDate
            });

            // Store cast, crew, genres, and collection for related media feature
            const castData = tmdbData.credits?.cast?.slice(0, 15).map((c: any) => ({
              id: c.id,
              name: c.name,
              character: c.character,
              profile_path: c.profile_path
            })) || [];

            const crewData = tmdbData.credits?.crew?.filter((c: any) => 
              ['Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer'].includes(c.job)
            ).slice(0, 10).map((c: any) => ({
              id: c.id,
              name: c.name,
              job: c.job,
              department: c.department
            })) || [];

            const genres = tmdbData.genres?.map((g: any) => ({
              id: g.id,
              name: g.name
            })) || [];

            // Extract certification (US preferred, fallback to first available)
            let certification: string | undefined;
            if (tmdbData.release_dates?.results) {
              const usRelease = tmdbData.release_dates.results.find((r: any) => r.iso_3166_1 === 'US');
              const auRelease = tmdbData.release_dates.results.find((r: any) => r.iso_3166_1 === 'AU');
              const releaseData = usRelease || auRelease || tmdbData.release_dates.results[0];
              if (releaseData?.release_dates) {
                const certifiedRelease = releaseData.release_dates.find((rd: any) => rd.certification);
                certification = certifiedRelease?.certification;
              }
            }

            MovieModel.updateMediaMetadata(movie.id, {
              cast_data: castData,
              crew_data: crewData,
              genres: genres,
              collection_id: tmdbData.belongs_to_collection?.id || undefined,
              collection_name: tmdbData.belongs_to_collection?.name || undefined,
              certification: certification
            });

            logger.info(`Updated movie details and media metadata from TMDB: ${title}`);
          }
        } catch (error) {
          logger.warn(`Failed to fetch TMDB details for movie ${tmdb_id}:`, error);
        }

        // Scan for movie files
        try {
          const result = await LibraryScannerController.scanMovieFiles(movie.id);
          logger.info(`Auto-scan found ${result.found} files for: ${title}`);
          
          // Auto-search if explicitly requested - searches for missing OR upgrades
          // The autoSearchService handles both cases:
          // - No file: searches for the movie
          // - Has file: searches for quality upgrades (if profile allows)
          if (auto_search && monitored) {
            if (result.found === 0) {
              logger.info(`Searching for missing movie: ${title}`);
            } else {
              logger.info(`Searching for potential quality upgrade: ${title}`);
            }
            const searchResult = await autoSearchService.searchAndDownloadMovie(movie.id);
            if (searchResult) {
              logger.info(`Auto-search succeeded for: ${title}`);
            } else if (result.found === 0) {
              logger.warn(`Auto-search found no releases for: ${title}`);
            } else {
              logger.info(`No quality upgrade available or needed for: ${title}`);
            }
          }
        } catch (err) {
          logger.error(`Background tasks failed for ${title}:`, err);
        }
      });
    } catch (error) {
      logger.error('Add movie error:', error);
      return res.status(500).json({ error: 'Failed to add movie' });
    }
  }

  static async updateMovie(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { monitored, quality_profile_id, folder_path, minimum_availability, tags } = req.body;

      const movie = MovieModel.findById(id);
      if (!movie) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      // Update monitored
      if (monitored !== undefined) {
        MovieModel.updateMonitored(id, monitored);
      }

      // Update quality profile
      if (quality_profile_id !== undefined) {
        MovieModel.updateQualityProfile(id, quality_profile_id);
      }

      // Update folder path
      if (folder_path !== undefined) {
        const sanitizedPath = fileNamingService.sanitizeFolderPath(folder_path);
        MovieModel.updateFolderPath(id, sanitizedPath);
      }

      // Update minimum availability
      if (minimum_availability !== undefined) {
        MovieModel.updateMinimumAvailability(id, minimum_availability);
      }

      // Update tags
      if (tags !== undefined) {
        MovieModel.updateTags(id, tags);
      }

      // Return updated movie
      const updatedMovie = MovieModel.findById(id);
      return res.json(updatedMovie);
    } catch (error) {
      logger.error('Update movie error:', error);
      return res.status(500).json({ error: 'Failed to update movie' });
    }
  }

  static async deleteMovie(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { deleteFiles, addExclusion } = req.query;
      
      const movie = MovieModel.findById(id);
      if (!movie) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      // Add to exclusion list if requested
      if (addExclusion === 'true' && movie.tmdb_id) {
        try {
          ExclusionModel.add({
            tmdb_id: movie.tmdb_id,
            media_type: 'movie',
            title: movie.title,
            year: movie.year || undefined,
            reason: 'Deleted from library'
          });
          logger.info(`Added movie to exclusion list: ${movie.title}`);
        } catch (err) {
          // Ignore if already excluded
          logger.debug('Movie already in exclusion list or error:', err);
        }
      }

      // Delete files if requested
      if (deleteFiles === 'true') {
        const fs = require('fs');
        const path = require('path');
        
        logger.info(`[DeleteMovie] Deleting files for: ${movie.title}`);
        logger.info(`[DeleteMovie] movie.file_path: ${movie.file_path}`);
        logger.info(`[DeleteMovie] movie.folder_path: ${movie.folder_path}`);
        
        // First, try to delete the main movie file
        if (movie.file_path) {
          try {
            if (fs.existsSync(movie.file_path)) {
              fs.unlinkSync(movie.file_path);
              logger.info(`[DeleteMovie] Deleted movie file: ${movie.file_path}`);
            } else {
              logger.warn(`[DeleteMovie] Movie file not found: ${movie.file_path}`);
            }
          } catch (err) {
            logger.error(`[DeleteMovie] Failed to delete file ${movie.file_path}:`, err);
          }
        }
        
        // Also delete from movie_files table
        const movieFiles = MovieModel.findMovieFiles(id);
        logger.info(`[DeleteMovie] Found ${movieFiles.length} files in movie_files table`);
        for (const file of movieFiles) {
          if (file.file_path) {
            try {
              if (fs.existsSync(file.file_path)) {
                fs.unlinkSync(file.file_path);
                logger.info(`[DeleteMovie] Deleted movie file: ${file.file_path}`);
              } else {
                logger.warn(`[DeleteMovie] Movie file not found: ${file.file_path}`);
              }
            } catch (err) {
              logger.error(`[DeleteMovie] Failed to delete file ${file.file_path}:`, err);
            }
          }
        }
        
        // Then try to delete the folder
        if (movie.folder_path) {
          try {
            if (fs.existsSync(movie.folder_path)) {
              const stats = fs.statSync(movie.folder_path);
              if (stats.isFile()) {
                fs.unlinkSync(movie.folder_path);
                logger.info(`[DeleteMovie] Deleted file at: ${movie.folder_path}`);
              } else {
                fs.rmSync(movie.folder_path, { recursive: true, force: true });
                logger.info(`[DeleteMovie] Deleted folder at: ${movie.folder_path}`);
              }
            } else {
              logger.warn(`[DeleteMovie] Folder not found: ${movie.folder_path}`);
            }
            
            // Check if we should delete empty parent folder
            const deleteEmptyFolders = LibraryController.getSettingSync('delete_empty_folders') !== 'false';
            if (deleteEmptyFolders) {
              const parentDir = path.dirname(movie.folder_path);
              LibraryController.deleteEmptyFolder(parentDir);
            }
          } catch (err) {
            logger.error(`[DeleteMovie] Failed to delete folder ${movie.folder_path}:`, err);
          }
        }
      }
      
      // Delete any associated downloads
      const downloads = DownloadModel.findByMovieId(id);
      for (const download of downloads) {
        DownloadModel.delete(download.id);
      }
      
      const deleted = MovieModel.delete(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      // Log activity: Movie deleted
      ActivityLogModel.logMovieEvent(
        id,
        EVENT_TYPES.DELETED,
        `${movie.title} deleted from library`,
        JSON.stringify({ 
          deletedFiles: deleteFiles === 'true',
          addedExclusion: addExclusion === 'true',
          user: req.user.username
        })
      );
      
      // Send notification
      notificationService.notify({
        event: 'onMovieDelete',
        title: 'Movie Deleted',
        message: `${movie.title} deleted from library`,
        mediaType: 'movie',
        mediaTitle: movie.title
      }).catch(err => logger.error('Notification error:', err));

      logger.info(`Movie deleted from library: ${movie.title} by ${req.user.username}${deleteFiles === 'true' ? ' (with files)' : ''}${addExclusion === 'true' ? ' (added to exclusions)' : ''}`);
      return res.json({ message: 'Movie deleted' });
    } catch (error) {
      logger.error('Delete movie error:', error);
      return res.status(500).json({ error: 'Failed to delete movie' });
    }
  }

  // Movie Files
  static async getMovieFiles(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const files = MovieModel.findMovieFiles(id);
      return res.json(files);
    } catch (error) {
      logger.error('Get movie files error:', error);
      return res.status(500).json({ error: 'Failed to get movie files' });
    }
  }

  static async addMovieFile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { file_path, file_size, quality, resolution, video_codec, audio_codec, runtime, scene_name, release_group } = req.body;

      if (!file_path) {
        return res.status(400).json({ error: 'File path is required' });
      }

      const movie = MovieModel.findById(id);
      if (!movie) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      const file = MovieModel.addMovieFile({
        movie_id: id,
        file_path,
        file_size: file_size || 0,
        quality,
        resolution,
        video_codec,
        audio_codec,
        runtime,
        scene_name,
        release_group
      });

      logger.info(`Movie file added: ${file_path} for ${movie.title}`);
      return res.status(201).json(file);
    } catch (error) {
      logger.error('Add movie file error:', error);
      return res.status(500).json({ error: 'Failed to add movie file' });
    }
  }

  static async deleteMovieFile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id, fileId } = req.params;
      logger.info(`[DeleteMovieFile] Request: movieId=${id}, fileId=${fileId}`);
      
      // Get the file info first so we can delete from disk
      const file = MovieModel.findMovieFileById(fileId);
      if (!file) {
        logger.warn(`[DeleteMovieFile] File not found in database: ${fileId}`);
        return res.status(404).json({ error: 'Movie file not found' });
      }
      
      logger.info(`[DeleteMovieFile] Found file: ${file.file_path}`);
      
      // Delete the actual file from disk
      if (file.file_path) {
        try {
          if (fs.existsSync(file.file_path)) {
            fs.unlinkSync(file.file_path);
            logger.info(`[DeleteMovieFile] Deleted from disk: ${file.file_path}`);
            
            // Also try to clean up empty parent folder if it's a release subfolder
            const movie = MovieModel.findById(id);
            if (movie && movie.folder_path) {
              const parentDir = path.dirname(file.file_path);
              if (parentDir !== movie.folder_path && parentDir.startsWith(movie.folder_path + path.sep)) {
                try {
                  const remaining = fs.readdirSync(parentDir);
                  if (remaining.length === 0) {
                    fs.rmdirSync(parentDir);
                    logger.info(`[DeleteMovieFile] Cleaned up empty folder: ${parentDir}`);
                  }
                } catch (cleanupErr) {
                  // Ignore cleanup errors
                }
              }
            }
          } else {
            logger.warn(`[DeleteMovieFile] File not found on disk: ${file.file_path}`);
          }
        } catch (err) {
          logger.error('[DeleteMovieFile] Failed to delete from disk:', err);
        }
      }
      
      // Delete from database
      const deleted = MovieModel.deleteMovieFile(fileId);
      if (!deleted) {
        logger.error(`[DeleteMovieFile] Failed to delete from database: ${fileId}`);
        return res.status(404).json({ error: 'Failed to delete movie file record' });
      }

      // Log activity: Movie file deleted
      const movie = MovieModel.findById(id);
      if (movie) {
        ActivityLogModel.logMovieEvent(
          id,
          EVENT_TYPES.DELETED,
          `File deleted: ${path.basename(file.file_path || 'unknown')}`,
          JSON.stringify({ 
            filename: path.basename(file.file_path || ''),
            quality: file.quality,
            size: file.file_size
          })
        );
      }

      logger.info(`[DeleteMovieFile] Successfully deleted: ${fileId}`);
      return res.json({ message: 'Movie file deleted', path: file.file_path });
    } catch (error) {
      logger.error('[DeleteMovieFile] Error:', error);
      return res.status(500).json({ error: 'Failed to delete movie file' });
    }
  }

  // TV Series
  static async getSeries(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { monitored, limit, offset = 0 } = req.query;
      
      // If no limit specified, return all series
      const limitNum = limit ? Number(limit) : 100000;
      const offsetNum = Number(offset);

      let series;
      let total;
      
      if (monitored === 'true') {
        series = TVSeriesModel.findMonitored();
        total = series.length;
      } else {
        series = TVSeriesModel.findAll(limitNum, offsetNum);
        total = TVSeriesModel.count().total;
      }

      return res.json({
        items: series,
        total,
        limit: limitNum,
        offset: offsetNum
      });
    } catch (error) {
      logger.error('Get series error:', error);
      return res.status(500).json({ error: 'Failed to get series' });
    }
  }

  static async getSeriesById(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const series = TVSeriesModel.findById(id);

      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      return res.json(series);
    } catch (error) {
      logger.error('Get series error:', error);
      return res.status(500).json({ error: 'Failed to get series' });
    }
  }

  static async addSeries(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { tvdb_id, tmdb_id, title, year, overview, network, poster_path, backdrop_path, folder_path, quality_profile_id, language_profile_id, monitored, season_monitoring, auto_search } = req.body;

      if (!title || !folder_path) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Sanitize folder path for illegal characters
      const sanitizedFolderPath = fileNamingService.sanitizeFolderPath(folder_path);

      // Check if already exists
      if (tmdb_id) {
        const existing = TVSeriesModel.findByTmdbId(tmdb_id);
        if (existing) {
          return res.status(409).json({ error: 'Series already in library', series: existing });
        }
      }

      // Add series immediately with provided data (no blocking API call)
      const series = TVSeriesModel.create({
        tvdb_id,
        tmdb_id,
        title,
        year,
        overview,
        network,
        poster_path,
        backdrop_path,
        folder_path: sanitizedFolderPath,
        quality_profile_id,
        language_profile_id,
        monitored
      });
      
      // Set monitor_new_seasons based on season_monitoring preference
      // all = monitor everything, future = only future seasons, current = only current, none = nothing
      if (season_monitoring) {
        TVSeriesModel.updateMonitorNewSeasons(series.id, season_monitoring);
      }

      // Log activity: Added to Library
      ActivityLogModel.logSeriesEvent(
        series.id,
        EVENT_TYPES.ADDED,
        `${title} (${year || 'N/A'}) added to library`,
        JSON.stringify({
          source: 'Discover',
          tmdb_id,
          tvdb_id,
          monitored,
          season_monitoring,
          quality_profile_id
        })
      );
      
      // Send notification
      notificationService.notify({
        event: 'onSeriesAdd',
        title: 'Series Added',
        message: `${title} (${year || 'N/A'}) added to library`,
        mediaType: 'series',
        mediaTitle: title
      }).catch(err => logger.error('Notification error:', err));

      logger.info(`Series added to library: ${title} by ${req.user.username}`);

      // Return response immediately - background tasks start after
      res.status(201).json(series);

      // Background: Fetch full details from TMDB and update, then fetch episodes
      setImmediate(async () => {
        try {
          // Fetch and update full TMDB details
          if (tmdb_id) {
            try {
              const tmdbData = await tmdbService.getTVDetails(tmdb_id);
              if (tmdbData) {
                TVSeriesModel.updateMetadata(series.id, {
                  vote_average: tmdbData.vote_average,
                  vote_count: tmdbData.vote_count,
                  status: tmdbData.status === 'Returning Series' ? 'Continuing' : tmdbData.status,
                  overview: tmdbData.overview || overview,
                  network: tmdbData.networks?.[0]?.name || network,
                  poster_path: tmdbData.poster_path || poster_path,
                  backdrop_path: tmdbData.backdrop_path || backdrop_path
                });

                // Store cast, crew, and genres for related media feature
                const castData = tmdbData.credits?.cast?.slice(0, 15).map((c: any) => ({
                  id: c.id,
                  name: c.name,
                  character: c.character,
                  profile_path: c.profile_path
                })) || tmdbData.aggregate_credits?.cast?.slice(0, 15).map((c: any) => ({
                  id: c.id,
                  name: c.name,
                  character: c.roles?.[0]?.character,
                  profile_path: c.profile_path
                })) || [];

                const crewData = tmdbData.credits?.crew?.filter((c: any) => 
                  ['Creator', 'Executive Producer', 'Showrunner', 'Writer'].includes(c.job)
                ).slice(0, 10).map((c: any) => ({
                  id: c.id,
                  name: c.name,
                  job: c.job,
                  department: c.department
                })) || tmdbData.created_by?.map((c: any) => ({
                  id: c.id,
                  name: c.name,
                  job: 'Creator',
                  department: 'Writing'
                })) || [];

                const genres = tmdbData.genres?.map((g: any) => ({
                  id: g.id,
                  name: g.name
                })) || [];

                // Extract certification (US preferred, fallback to AU or first available)
                let certification: string | undefined;
                if (tmdbData.content_ratings?.results) {
                  const usRating = tmdbData.content_ratings.results.find((r: any) => r.iso_3166_1 === 'US');
                  const auRating = tmdbData.content_ratings.results.find((r: any) => r.iso_3166_1 === 'AU');
                  certification = usRating?.rating || auRating?.rating || tmdbData.content_ratings.results[0]?.rating;
                }

                TVSeriesModel.updateMediaMetadata(series.id, {
                  cast_data: castData,
                  crew_data: crewData,
                  genres: genres,
                  certification: certification
                });

                logger.info(`Updated series details and media metadata from TMDB: ${title}`);
              }
            } catch (error) {
              logger.warn(`Failed to fetch TMDB details for series ${tmdb_id}:`, error);
            }

            // Fetch episodes and scan for files
            try {
              await episodeFetcherService.fetchAndPopulateEpisodes(series.id);
              logger.info(`Episodes fetched for: ${title}`);
              
              const scanResult = await LibraryScannerController.scanSeriesFiles(series.id, false);
              if (scanResult.matched > 0) {
                logger.info(`Found ${scanResult.matched} existing episode files for: ${title}`);
              }
              
              // Auto-search for missing episodes and quality upgrades if explicitly requested
              // Searches for:
              // - Missing episodes (no file): always search
              // - Episodes with files: search for quality upgrades (if profile allows)
              if (auto_search && monitored) {
                const searchResult = await autoSearchService.searchAndDownloadSeries(series.id);
                if (searchResult.found > 0) {
                  logger.info(`Auto-search found ${searchResult.found} releases for: ${title}`);
                } else if (searchResult.searched > 0) {
                  logger.info(`Auto-search found no releases/upgrades for ${searchResult.searched} episodes of: ${title}`);
                }
              }
            } catch (err) {
              logger.error('Failed to fetch episodes:', err);
            }
          }
        } catch (err) {
          logger.error(`Background tasks failed for ${title}:`, err);
        }
      });
    } catch (error) {
      logger.error('Add series error:', error);
      return res.status(500).json({ error: 'Failed to add series' });
    }
  }

  static async updateSeries(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { 
        monitored, 
        cascadeMonitor, 
        quality_profile_id, 
        folder_path, 
        series_type, 
        use_season_folder, 
        monitor_new_seasons,
        tags 
      } = req.body;

      const series = TVSeriesModel.findById(id);
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      // Update monitored
      if (monitored !== undefined) {
        TVSeriesModel.updateMonitored(id, monitored);

        // Cascade monitor status to all seasons and episodes
        if (cascadeMonitor !== false) {
          const seasons = TVSeriesModel.findSeasonsBySeriesId(id);
          for (const season of seasons) {
            TVSeriesModel.updateSeasonMonitored(season.id, monitored);
            const episodes = TVSeriesModel.findEpisodesBySeason(id, season.season_number);
            for (const episode of episodes) {
              TVSeriesModel.updateEpisodeMonitored(episode.id, monitored);
            }
          }
        }
      }

      // Update quality profile
      if (quality_profile_id !== undefined) {
        TVSeriesModel.updateQualityProfile(id, quality_profile_id);
      }

      // Update folder path
      if (folder_path !== undefined) {
        const sanitizedPath = fileNamingService.sanitizeFolderPath(folder_path);
        TVSeriesModel.updateFolderPath(id, sanitizedPath);
      }

      // Update series type
      if (series_type !== undefined) {
        TVSeriesModel.updateSeriesType(id, series_type);
      }

      // Update use season folder
      if (use_season_folder !== undefined) {
        TVSeriesModel.updateUseSeasonFolder(id, use_season_folder);
      }

      // Update monitor new seasons
      if (monitor_new_seasons !== undefined) {
        TVSeriesModel.updateMonitorNewSeasons(id, monitor_new_seasons);
      }

      // Update tags
      if (tags !== undefined) {
        TVSeriesModel.updateTags(id, tags);
      }

      // Return updated series
      const updatedSeries = TVSeriesModel.findById(id);
      return res.json(updatedSeries);
    } catch (error) {
      logger.error('Update series error:', error);
      return res.status(500).json({ error: 'Failed to update series' });
    }
  }

  static async deleteSeries(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { deleteFiles, addExclusion } = req.query;
      
      const series = TVSeriesModel.findById(id);
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      // Add to exclusion list if requested
      if (addExclusion === 'true' && series.tmdb_id) {
        try {
          ExclusionModel.add({
            tmdb_id: series.tmdb_id,
            media_type: 'tv',
            title: series.title,
            year: series.year || undefined,
            reason: 'Deleted from library'
          });
          logger.info(`Added series to exclusion list: ${series.title}`);
        } catch (err) {
          // Ignore if already excluded
          logger.debug('Series already in exclusion list or error:', err);
        }
      }

      // Delete files if requested
      if (deleteFiles === 'true') {
        const fs = require('fs');
        const path = require('path');
        
        // First, try to delete individual episode files
        const seasons = TVSeriesModel.findSeasonsBySeriesId(id);
        for (const season of seasons) {
          const episodes = TVSeriesModel.findEpisodesBySeason(id, season.season_number);
          for (const episode of episodes) {
            if (episode.file_path) {
              try {
                if (fs.existsSync(episode.file_path)) {
                  fs.unlinkSync(episode.file_path);
                  logger.info(`Deleted episode file: ${episode.file_path}`);
                }
              } catch (err) {
                logger.error(`Failed to delete episode file ${episode.file_path}:`, err);
              }
            }
          }
        }
        
        // Then try to delete the series folder
        if (series.folder_path) {
          try {
            if (fs.existsSync(series.folder_path)) {
              fs.rmSync(series.folder_path, { recursive: true, force: true });
              logger.info(`Deleted folder at: ${series.folder_path}`);
            }
            
            // Check if we should delete empty parent folder
            const deleteEmptyFolders = LibraryController.getSettingSync('delete_empty_folders') !== 'false';
            if (deleteEmptyFolders) {
              const parentDir = path.dirname(series.folder_path);
              LibraryController.deleteEmptyFolder(parentDir);
            }
          } catch (err) {
            logger.error(`Failed to delete folder ${series.folder_path}:`, err);
          }
        }
      }
      
      // Delete any associated downloads
      const downloads = DownloadModel.findBySeriesId(id);
      for (const download of downloads) {
        DownloadModel.delete(download.id);
      }
      
      // Delete seasons and episodes (cascade should handle this but being explicit)
      TVSeriesModel.deleteSeasonsBySeriesId(id);
      TVSeriesModel.deleteEpisodesBySeriesId(id);
      
      const deleted = TVSeriesModel.delete(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Series not found' });
      }

      // Log activity: Series deleted
      ActivityLogModel.logSeriesEvent(
        id,
        EVENT_TYPES.DELETED,
        `${series.title} deleted from library`,
        JSON.stringify({ 
          deletedFiles: deleteFiles === 'true',
          addedExclusion: addExclusion === 'true',
          user: req.user.username
        })
      );
      
      // Send notification
      notificationService.notify({
        event: 'onSeriesDelete',
        title: 'Series Deleted',
        message: `${series.title} deleted from library`,
        mediaType: 'series',
        mediaTitle: series.title
      }).catch(err => logger.error('Notification error:', err));

      logger.info(`Series deleted from library: ${series.title} by ${req.user.username}${deleteFiles === 'true' ? ' (with files)' : ''}${addExclusion === 'true' ? ' (added to exclusions)' : ''}`);
      return res.json({ message: 'Series deleted' });
    } catch (error) {
      logger.error('Delete series error:', error);
      return res.status(500).json({ error: 'Failed to delete series' });
    }
  }

  static async getSeasons(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const seasons = TVSeriesModel.findSeasonsBySeriesId(id);

      return res.json(seasons);
    } catch (error) {
      logger.error('Get seasons error:', error);
      return res.status(500).json({ error: 'Failed to get seasons' });
    }
  }

  static async getEpisodes(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { season } = req.query;

      let episodes;
      if (season) {
        episodes = TVSeriesModel.findEpisodesBySeason(id, Number(season));
      } else {
        episodes = TVSeriesModel.findEpisodesBySeriesId(id);
      }

      // Get all active downloads for this series
      const activeDownloads = DownloadModel.findBySeriesId(id).filter(d => 
        d.status === 'queued' || d.status === 'downloading' || d.status === 'importing'
      );

      // Create a map for quick lookup by season/episode
      const downloadMap = new Map<string, { status: string; progress: number }>();
      for (const dl of activeDownloads) {
        if (dl.season_number !== null && dl.episode_number !== null) {
          downloadMap.set(`${dl.season_number}-${dl.episode_number}`, { status: dl.status, progress: dl.progress });
        }
      }

      // Add download status to episodes
      const episodesWithStatus = episodes.map((ep: any) => {
        const download = downloadMap.get(`${ep.season_number}-${ep.episode_number}`);
        return {
          ...ep,
          download_status: download?.status || null,
          download_progress: download?.progress || null
        };
      });

      return res.json(episodesWithStatus);
    } catch (error) {
      logger.error('Get episodes error:', error);
      return res.status(500).json({ error: 'Failed to get episodes' });
    }
  }

  static async updateSeason(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id, seasonNumber } = req.params;
      const { monitored } = req.body;

      // Find season
      const seasons = TVSeriesModel.findSeasonsBySeriesId(id);
      const season = seasons.find(s => s.season_number === Number(seasonNumber));

      if (!season) {
        return res.status(404).json({ error: 'Season not found' });
      }

      const updated = TVSeriesModel.updateSeasonMonitored(season.id, monitored);

      // Cascade to all episodes in this season
      const episodes = TVSeriesModel.findEpisodesBySeason(id, Number(seasonNumber));
      for (const episode of episodes) {
        TVSeriesModel.updateEpisodeMonitored(episode.id, monitored);
      }

      // If unmonitoring, check if all seasons are now unmonitored
      // If so, auto-unmonitor the series
      if (!monitored) {
        const allSeasons = TVSeriesModel.findSeasonsBySeriesId(id);
        const anyMonitored = allSeasons.some(s => s.monitored);
        if (!anyMonitored) {
          TVSeriesModel.updateMonitored(id, false);
          logger.info(`Auto-unmonitored series ${id} - all seasons are unmonitored`);
        }
      }

      return res.json(updated);
    } catch (error) {
      logger.error('Update season error:', error);
      return res.status(500).json({ error: 'Failed to update season' });
    }
  }

  static async updateEpisode(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { monitored } = req.body;

      const episode = TVSeriesModel.updateEpisodeMonitored(id, monitored);
      if (!episode) {
        return res.status(404).json({ error: 'Episode not found' });
      }

      return res.json(episode);
    } catch (error) {
      logger.error('Update episode error:', error);
      return res.status(500).json({ error: 'Failed to update episode' });
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const movieStats = MovieModel.count();
      const seriesStats = TVSeriesModel.count();

      return res.json({
        movies: {
          total: movieStats.total,
          monitored: movieStats.monitored,
          missing: movieStats.missing,
          available: movieStats.available
        },
        series: {
          total: seriesStats.total,
          monitored: seriesStats.monitored
        }
      });
    } catch (error) {
      logger.error('Get library stats error:', error);
      return res.status(500).json({ error: 'Failed to get stats' });
    }
  }

  static async deleteEpisodeFile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      logger.info(`[DeleteEpisodeFile] Request: episodeId=${id}`);
      
      const episode = TVSeriesModel.findEpisodeById(id);
      
      if (!episode) {
        logger.warn(`[DeleteEpisodeFile] Episode not found: ${id}`);
        return res.status(404).json({ error: 'Episode not found' });
      }

      logger.info(`[DeleteEpisodeFile] Found episode: S${episode.season_number}E${episode.episode_number}, file: ${episode.file_path}`);

      // Delete the actual file from disk
      if (episode.file_path) {
        try {
          if (fs.existsSync(episode.file_path)) {
            fs.unlinkSync(episode.file_path);
            logger.info(`[DeleteEpisodeFile] Deleted from disk: ${episode.file_path}`);
            
            // Clean up empty parent folders (release folders within series/season folder)
            const series = TVSeriesModel.findById(episode.series_id);
            if (series && series.folder_path) {
              const parentDir = path.dirname(episode.file_path);
              // Don't delete season folders, only release subfolders
              if (parentDir.includes(series.folder_path) && !parentDir.match(/Season \d+$/)) {
                try {
                  const remaining = fs.readdirSync(parentDir);
                  if (remaining.length === 0) {
                    fs.rmdirSync(parentDir);
                    logger.info(`[DeleteEpisodeFile] Cleaned up empty folder: ${parentDir}`);
                  }
                } catch (cleanupErr) {
                  // Ignore cleanup errors
                }
              }
            }
          } else {
            logger.warn(`[DeleteEpisodeFile] File not found on disk: ${episode.file_path}`);
          }
        } catch (err) {
          logger.error('[DeleteEpisodeFile] Failed to delete from disk:', err);
        }
      }

      TVSeriesModel.clearEpisodeFile(id);
      
      // Log activity: Episode file deleted
      ActivityLogModel.logSeriesEvent(
        episode.series_id,
        EVENT_TYPES.DELETED,
        `S${episode.season_number}E${episode.episode_number} file deleted`,
        JSON.stringify({ 
          filename: path.basename(episode.file_path || ''),
          quality: episode.quality,
          size: episode.file_size
        })
      );
      
      logger.info(`[DeleteEpisodeFile] Successfully deleted: ${id}`);
      
      return res.json({ message: 'Episode file deleted', path: episode.file_path });
    } catch (error) {
      logger.error('[DeleteEpisodeFile] Error:', error);
      return res.status(500).json({ error: 'Failed to delete episode file' });
    }
  }

  static async deleteSeasonFiles(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id, seasonNumber } = req.params;
      const series = TVSeriesModel.findById(id);
      
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      // Get all episodes with files in this season
      const episodes = TVSeriesModel.findEpisodesBySeason(id, Number(seasonNumber));
      const episodesWithFiles = episodes.filter(e => e.has_file && e.file_path);
      
      // Delete actual files from disk
      const fs = require('fs');
      for (const episode of episodesWithFiles) {
        try {
          if (episode.file_path && fs.existsSync(episode.file_path)) {
            fs.unlinkSync(episode.file_path);
            logger.info(`Deleted episode file: ${episode.file_path}`);
          }
        } catch (err) {
          logger.error(`Failed to delete episode file: ${episode.file_path}`, err);
        }
      }

      // Clear all episode file records for this season
      const cleared = TVSeriesModel.clearSeasonFiles(id, Number(seasonNumber));
      logger.info(`Cleared ${cleared} episode file records for season ${seasonNumber} of series ${id}`);
      
      return res.json({ message: `Deleted ${episodesWithFiles.length} files from season ${seasonNumber}`, deleted: episodesWithFiles.length });
    } catch (error) {
      logger.error('Delete season files error:', error);
      return res.status(500).json({ error: 'Failed to delete season files' });
    }
  }

  // Preview movie rename - shows what files would be renamed to
  static async previewMovieRename(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const movie = MovieModel.findById(id);
      if (!movie) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      const { NamingConfigModel } = require('../models/NamingConfig');
      const path = require('path');
      const fs = require('fs');
      
      const config = NamingConfigModel.get();
      const previews: any[] = [];

      // Get movie files using MovieModel.findMovieFiles
      const files = MovieModel.findMovieFiles(id);

      for (const file of files) {
        if (!file.file_path) continue;
        
        // Check if file exists
        if (!fs.existsSync(file.file_path)) {
          logger.warn(`[PreviewRename] File not found: ${file.file_path}`);
          continue;
        }

        const currentPath = file.file_path;
        const ext = path.extname(currentPath);
        const currentFilename = path.basename(currentPath);

        // Scan media info to get latest quality/codec info
        logger.info(`[PreviewRename] Scanning media info for: ${currentFilename}`);
        const mediaInfo = await mediaInfoService.getMediaInfo(currentPath);
        
        // Update file record with fresh media info
        MovieModel.updateMovieFile(file.id, {
          quality: mediaInfo.qualityFull || mediaInfo.resolution,
          video_codec: mediaInfo.videoCodec,
          audio_codec: mediaInfo.audioCodec,
          video_dynamic_range: mediaInfo.videoDynamicRange,
          audio_channels: mediaInfo.audioChannels,
          audio_languages: mediaInfo.audioLanguages,
          subtitle_languages: mediaInfo.subtitleLanguages
        });

        // Generate new filename with fresh media info
        const newFilename = fileNamingService.generateMovieFilename({
          title: movie.title,
          year: movie.year || undefined,
          tmdbId: movie.tmdb_id || undefined,
          imdbId: movie.imdb_id || undefined,
          quality: mediaInfo.qualityFull || mediaInfo.resolution,
          videoCodec: mediaInfo.videoCodec,
          audioCodec: mediaInfo.audioCodec,
          audioChannels: mediaInfo.audioChannels,
          audioLanguages: mediaInfo.audioLanguages,
          subtitleLanguages: mediaInfo.subtitleLanguages,
          dynamicRange: mediaInfo.videoDynamicRange,
          releaseGroup: file.release_group || undefined
        }, ext);

        if (newFilename && currentFilename !== newFilename) {
          // Always put the new file directly in the movie folder (not in subfolders)
          const newPath = path.join(movie.folder_path, newFilename);
          
          // Mark for rename if either the filename changed OR the file is in a subfolder
          const isInSubfolder = path.dirname(currentPath) !== movie.folder_path;
          
          previews.push({
            id: file.id,
            currentPath,
            currentFilename,
            newPath,
            newFilename,
            selected: true,
            willMove: isInSubfolder, // Indicate if file will be moved from subfolder
            mediaInfo: {
              quality: mediaInfo.qualityFull || mediaInfo.resolution,
              videoCodec: mediaInfo.videoCodec,
              audioCodec: mediaInfo.audioCodec,
              dynamicRange: mediaInfo.videoDynamicRange
            }
          });
        } else if (currentFilename === newFilename) {
          // Even if filename is the same, check if file needs to be moved from a subfolder
          const isInSubfolder = path.dirname(currentPath) !== movie.folder_path;
          if (isInSubfolder) {
            const newPath = path.join(movie.folder_path, currentFilename);
            previews.push({
              id: file.id,
              currentPath,
              currentFilename,
              newPath,
              newFilename: currentFilename,
              selected: true,
              willMove: true,
              mediaInfo: {
                quality: mediaInfo.qualityFull || mediaInfo.resolution,
                videoCodec: mediaInfo.videoCodec,
                audioCodec: mediaInfo.audioCodec,
                dynamicRange: mediaInfo.videoDynamicRange
              }
            });
          }
        }
      }

      return res.json({
        movie: { id: movie.id, title: movie.title, year: movie.year, folderPath: movie.folder_path },
        namingPattern: config.standard_movie_format,
        previews
      });
    } catch (error) {
      logger.error('Preview movie rename error:', error);
      return res.status(500).json({ error: 'Failed to generate rename preview' });
    }
  }

  // Execute movie rename
  static async executeMovieRename(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { files } = req.body; // Array of { id, newPath }
      const fs = require('fs');
      const path = require('path');

      const movie = MovieModel.findById(id);
      let renamed = 0;
      const oldDirs = new Set<string>();

      for (const fileUpdate of files) {
        const file = MovieModel.findMovieFileById(fileUpdate.id);
        if (!file || !file.file_path) continue;

        try {
          if (fs.existsSync(file.file_path)) {
            // Track old directory for cleanup
            const oldDir = path.dirname(file.file_path);
            if (movie && oldDir !== movie.folder_path) {
              oldDirs.add(oldDir);
            }
            
            // Create directory if needed
            const dir = path.dirname(fileUpdate.newPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            const oldFilename = path.basename(file.file_path);
            const newFilename = path.basename(fileUpdate.newPath);

            fs.renameSync(file.file_path, fileUpdate.newPath);
            // Update file path in database
            MovieModel.updateMovieFilePath(file.id, fileUpdate.newPath);
            renamed++;
            logger.info(`Renamed: ${oldFilename} -> ${newFilename}`);
          }
        } catch (err) {
          logger.error(`Failed to rename file: ${file.file_path}`, err);
        }
      }

      // Clean up empty subfolders within movie folder
      if (movie && movie.folder_path) {
        for (const oldDir of oldDirs) {
          try {
            if (fs.existsSync(oldDir) && oldDir.startsWith(movie.folder_path + path.sep)) {
              const remainingFiles = fs.readdirSync(oldDir);
              // Only delete if empty or only has small non-video files
              const hasImportantFiles = remainingFiles.some((f: string) => {
                const fPath = path.join(oldDir, f);
                try {
                  const stat = fs.statSync(fPath);
                  const isVideo = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'].includes(path.extname(f).toLowerCase());
                  return stat.isDirectory() || isVideo || stat.size > 10 * 1024 * 1024; // > 10MB
                } catch { return false; }
              });
              
              if (!hasImportantFiles) {
                fs.rmSync(oldDir, { recursive: true, force: true });
                logger.info(`[Rename] Cleaned up empty folder: ${oldDir}`);
              }
            }
          } catch (cleanupErr) {
            logger.warn(`[Rename] Failed to cleanup folder: ${oldDir}`, cleanupErr);
          }
        }
      }

      return res.json({ message: `Renamed ${renamed} files`, count: renamed });
    } catch (error) {
      logger.error('Execute movie rename error:', error);
      return res.status(500).json({ error: 'Failed to rename files' });
    }
  }

  // Fix movie match - update TMDB ID and refresh metadata
  static async fixMovieMatch(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { tmdb_id } = req.body;

      logger.info(`Fix match request: movie=${id}, new_tmdb_id=${tmdb_id}`);

      if (!tmdb_id) {
        return res.status(400).json({ error: 'New TMDB ID is required' });
      }

      const movie = MovieModel.findById(id);
      if (!movie) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      logger.info(`Found movie: ${movie.title} (current tmdb_id=${movie.tmdb_id})`);

      // Fetch new movie details from TMDB
      let newMovieDetails;
      try {
        newMovieDetails = await tmdbService.getMovieDetails(tmdb_id);
      } catch (tmdbError: any) {
        logger.error(`TMDB API error: ${tmdbError.message}`);
        return res.status(500).json({ error: `TMDB API error: ${tmdbError.message}` });
      }

      if (!newMovieDetails) {
        return res.status(404).json({ error: 'Movie not found on TMDB' });
      }

      logger.info(`TMDB returned: ${newMovieDetails.title}`);

      // Extract release dates
      const releaseDates = TMDBService.extractReleaseDates(newMovieDetails);

      // Update the movie with new metadata
      const releaseYear = newMovieDetails.release_date 
        ? new Date(newMovieDetails.release_date).getFullYear() 
        : movie.year;

      MovieModel.fixMatch(id, {
        tmdb_id: tmdb_id,
        title: newMovieDetails.title,
        year: releaseYear || undefined,
        overview: newMovieDetails.overview || movie.overview || undefined,
        poster_path: newMovieDetails.poster_path || movie.poster_path || undefined,
        backdrop_path: newMovieDetails.backdrop_path || movie.backdrop_path || undefined,
        runtime: newMovieDetails.runtime || movie.runtime || undefined,
        vote_average: newMovieDetails.vote_average || movie.vote_average || undefined,
        vote_count: newMovieDetails.vote_count || movie.vote_count || undefined,
        status: newMovieDetails.status || movie.status || undefined,
        imdb_id: newMovieDetails.imdb_id || movie.imdb_id || undefined,
        tmdb_status: newMovieDetails.status,
        theatrical_release_date: releaseDates.theatricalDate,
        digital_release_date: releaseDates.digitalDate,
        physical_release_date: releaseDates.physicalDate,
      });

      logger.info(`Fixed movie match: ${movie.title} (${movie.tmdb_id}) -> ${newMovieDetails.title} (${tmdb_id})`);

      return res.json({ 
        message: 'Movie match updated successfully',
        movie: MovieModel.findById(id)
      });
    } catch (error: any) {
      logger.error('Fix movie match error:', error);
      logger.error('Error stack:', error.stack);
      return res.status(500).json({ error: `Failed to fix movie match: ${error.message}` });
    }
  }

  // Preview series rename - shows what episode files would be renamed to
  static async previewSeriesRename(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const series = TVSeriesModel.findById(id);
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      const { fileNamingService } = require('../services/fileNaming');
      const { NamingConfigModel } = require('../models/NamingConfig');
      const { mediaInfoService } = require('../services/mediaInfo');
      const path = require('path');
      const fs = require('fs');
      
      const config = NamingConfigModel.get();
      const previews: any[] = [];

      // Determine series type for format selection
      const isDaily = series.series_type === 'daily';
      const isAnime = series.series_type === 'anime';

      // Get all episodes with files and calculate absolute numbers for anime
      const seasons = TVSeriesModel.findSeasonsBySeriesId(id);
      let absoluteCounter = 0;
      
      // For anime, pre-calculate absolute episode numbers across all seasons
      const absoluteMap = new Map<string, number>();
      if (isAnime) {
        for (const season of seasons.sort((a: any, b: any) => a.season_number - b.season_number)) {
          if (season.season_number === 0) continue; // Skip specials
          const eps = TVSeriesModel.findEpisodesBySeason(id, season.season_number);
          for (const ep of eps.sort((a: any, b: any) => a.episode_number - b.episode_number)) {
            absoluteCounter++;
            absoluteMap.set(ep.id, absoluteCounter);
          }
        }
      }
      
      for (const season of seasons) {
        const episodes = TVSeriesModel.findEpisodesBySeason(id, season.season_number);
        
        for (const episode of episodes) {
          if (!episode.has_file || !episode.file_path) continue;

          const currentPath = episode.file_path;
          
          // Check if file exists
          if (!fs.existsSync(currentPath)) {
            logger.warn(`[PreviewSeriesRename] File not found: ${currentPath}`);
            continue;
          }

          const ext = path.extname(currentPath);
          const currentFilename = path.basename(currentPath);
          
          // Parse release group from filename
          const releaseGroupMatch = currentFilename.match(/-([A-Za-z0-9]+)(?:\.[^.]+)?$/);
          const releaseGroup = releaseGroupMatch ? releaseGroupMatch[1] : undefined;

          // Scan media info to get latest quality/codec info
          logger.info(`[PreviewSeriesRename] Scanning media info for: ${currentFilename}`);
          const mediaInfo = await mediaInfoService.getMediaInfo(currentPath);
          
          // Update episode record with fresh media info
          TVSeriesModel.updateEpisodeFile(
            episode.id,
            episode.file_path,
            episode.file_size || 0,
            mediaInfo.qualityFull || mediaInfo.resolution || '',
            mediaInfo.videoCodec,
            mediaInfo.audioCodec,
            releaseGroup
          );

          // Generate new filename with fresh media info and proper format flags
          const newFilename = fileNamingService.generateEpisodeFilename({
            seriesTitle: series.title,
            seriesYear: series.year,
            seasonNumber: episode.season_number,
            episodeNumber: episode.episode_number,
            episodeTitle: episode.title,
            airDate: episode.air_date,
            absoluteNumber: absoluteMap.get(episode.id),
            tvdbId: series.tvdb_id,
            tmdbId: series.tmdb_id,
            quality: mediaInfo.qualityFull || mediaInfo.resolution,
            videoCodec: mediaInfo.videoCodec,
            audioCodec: mediaInfo.audioCodec,
            audioChannels: mediaInfo.audioChannels,
            audioLanguages: mediaInfo.audioLanguages,
            subtitleLanguages: mediaInfo.subtitleLanguages,
            dynamicRange: mediaInfo.videoDynamicRange,
            releaseGroup: mediaInfo.releaseGroup,
            isDaily,
            isAnime
          }, ext);

          if (newFilename && currentFilename !== newFilename) {
            // Build new path with proper season folder
            const seasonFolder = fileNamingService.generateSeasonFolderName(episode.season_number);
            const newPath = path.join(series.folder_path, seasonFolder, newFilename);
            
            previews.push({
              id: episode.id,
              seasonNumber: episode.season_number,
              episodeNumber: episode.episode_number,
              currentPath,
              currentFilename,
              newPath,
              newFilename,
              selected: true,
              mediaInfo: {
                quality: mediaInfo.qualityFull || mediaInfo.resolution,
                videoCodec: mediaInfo.videoCodec,
                audioCodec: mediaInfo.audioCodec,
                dynamicRange: mediaInfo.videoDynamicRange
              }
            });
          }
        }
      }

      // Sort by season/episode
      previews.sort((a, b) => {
        if (a.seasonNumber !== b.seasonNumber) return b.seasonNumber - a.seasonNumber;
        return b.episodeNumber - a.episodeNumber;
      });

      return res.json({
        series: { 
          id: series.id, 
          title: series.title, 
          year: series.year, 
          folderPath: series.folder_path,
          tvdbId: series.tvdb_id,
          seriesType: series.series_type
        },
        namingPattern: isDaily ? config.daily_episode_format : 
                       isAnime ? config.anime_episode_format : 
                       config.standard_episode_format,
        previews
      });
    } catch (error) {
      logger.error('Preview series rename error:', error);
      return res.status(500).json({ error: 'Failed to generate rename preview' });
    }
  }

  // Execute series rename
  static async executeSeriesRename(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { files } = req.body; // Array of { id, newPath }
      const fs = require('fs');
      const path = require('path');

      let renamed = 0;

      for (const fileUpdate of files) {
        // Find episode
        const episodes = TVSeriesModel.findEpisodesBySeason(id, 0); // This won't work, need to look up by episode ID
        const episode = TVSeriesModel.findEpisodeById(fileUpdate.id);
        
        if (!episode || !episode.file_path) continue;

        try {
          if (fs.existsSync(episode.file_path)) {
            // Create directory if needed
            const dir = path.dirname(fileUpdate.newPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }

            const oldFilename = path.basename(episode.file_path);
            const newFilename = path.basename(fileUpdate.newPath);

            fs.renameSync(episode.file_path, fileUpdate.newPath);
            TVSeriesModel.updateEpisodeFile(
              episode.id, 
              fileUpdate.newPath, 
              episode.file_size || 0,
              episode.quality || '',
              episode.video_codec || undefined,
              episode.audio_codec || undefined,
              (episode as any).release_group || undefined
            );
            renamed++;
            logger.info(`Renamed: ${oldFilename} -> ${newFilename}`);
          }
        } catch (err) {
          logger.error(`Failed to rename file: ${episode.file_path}`, err);
        }
      }

      return res.json({ message: `Renamed ${renamed} files`, count: renamed });
    } catch (error) {
      logger.error('Execute series rename error:', error);
      return res.status(500).json({ error: 'Failed to rename files' });
    }
  }

  // Bulk update movies
  static async bulkUpdateMovies(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { ids, updates } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No movie IDs provided' });
      }

      let updated = 0;
      for (const id of ids) {
        const movie = MovieModel.findById(id);
        if (!movie) continue;

        if (updates.monitored !== undefined) {
          MovieModel.updateMonitored(id, updates.monitored);
        }
        if (updates.quality_profile_id !== undefined) {
          MovieModel.updateQualityProfile(id, updates.quality_profile_id);
        }
        if (updates.minimum_availability !== undefined) {
          MovieModel.updateMinimumAvailability(id, updates.minimum_availability);
        }
        if (updates.tags !== undefined) {
          MovieModel.updateTags(id, updates.tags);
        }
        updated++;
      }

      logger.info(`Bulk updated ${updated} movies by ${req.user.username}`);
      return res.json({ message: `Updated ${updated} movies`, count: updated });
    } catch (error) {
      logger.error('Bulk update movies error:', error);
      return res.status(500).json({ error: 'Failed to bulk update movies' });
    }
  }

  // Bulk delete movies
  static async bulkDeleteMovies(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { ids, deleteFiles } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No movie IDs provided' });
      }

      const fs = require('fs');
      let deleted = 0;

      for (const id of ids) {
        const movie = MovieModel.findById(id);
        if (!movie) continue;

        // Delete files if requested
        if (deleteFiles && movie.folder_path) {
          try {
            if (fs.existsSync(movie.folder_path)) {
              fs.rmSync(movie.folder_path, { recursive: true, force: true });
            }
          } catch (err) {
            logger.error(`Failed to delete files for movie ${movie.title}:`, err);
          }
        }

        // Delete any downloads
        const downloads = DownloadModel.findByMovieId(id);
        for (const download of downloads) {
          DownloadModel.delete(download.id);
        }

        MovieModel.delete(id);
        deleted++;
      }

      logger.info(`Bulk deleted ${deleted} movies by ${req.user.username}`);
      return res.json({ message: `Deleted ${deleted} movies`, count: deleted });
    } catch (error) {
      logger.error('Bulk delete movies error:', error);
      return res.status(500).json({ error: 'Failed to bulk delete movies' });
    }
  }

  // Bulk update series
  static async bulkUpdateSeries(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { ids, updates } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No series IDs provided' });
      }

      let updated = 0;
      for (const id of ids) {
        const series = TVSeriesModel.findById(id);
        if (!series) continue;

        if (updates.monitored !== undefined) {
          TVSeriesModel.updateMonitored(id, updates.monitored);
          // Optionally cascade to seasons and episodes
          if (updates.cascadeMonitor !== false) {
            const seasons = TVSeriesModel.findSeasonsBySeriesId(id);
            for (const season of seasons) {
              TVSeriesModel.updateSeasonMonitored(season.id, updates.monitored);
              const episodes = TVSeriesModel.findEpisodesBySeason(id, season.season_number);
              for (const episode of episodes) {
                TVSeriesModel.updateEpisodeMonitored(episode.id, updates.monitored);
              }
            }
          }
        }
        if (updates.quality_profile_id !== undefined) {
          TVSeriesModel.updateQualityProfile(id, updates.quality_profile_id);
        }
        if (updates.series_type !== undefined) {
          TVSeriesModel.updateSeriesType(id, updates.series_type);
        }
        if (updates.tags !== undefined) {
          TVSeriesModel.updateTags(id, updates.tags);
        }
        updated++;
      }

      logger.info(`Bulk updated ${updated} series by ${req.user.username}`);
      return res.json({ message: `Updated ${updated} series`, count: updated });
    } catch (error) {
      logger.error('Bulk update series error:', error);
      return res.status(500).json({ error: 'Failed to bulk update series' });
    }
  }

  // Bulk delete series
  static async bulkDeleteSeries(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { ids, deleteFiles } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No series IDs provided' });
      }

      const fs = require('fs');
      let deleted = 0;

      for (const id of ids) {
        const series = TVSeriesModel.findById(id);
        if (!series) continue;

        // Delete files if requested
        if (deleteFiles && series.folder_path) {
          try {
            if (fs.existsSync(series.folder_path)) {
              fs.rmSync(series.folder_path, { recursive: true, force: true });
            }
          } catch (err) {
            logger.error(`Failed to delete files for series ${series.title}:`, err);
          }
        }

        // Delete any downloads
        const downloads = DownloadModel.findBySeriesId(id);
        for (const download of downloads) {
          DownloadModel.delete(download.id);
        }

        // Delete seasons and episodes
        TVSeriesModel.deleteSeasonsBySeriesId(id);
        TVSeriesModel.deleteEpisodesBySeriesId(id);
        TVSeriesModel.delete(id);
        deleted++;
      }

      logger.info(`Bulk deleted ${deleted} series by ${req.user.username}`);
      return res.json({ message: `Deleted ${deleted} series`, count: deleted });
    } catch (error) {
      logger.error('Bulk delete series error:', error);
      return res.status(500).json({ error: 'Failed to bulk delete series' });
    }
  }

  // Activity Log for Movies
  static async getMovieActivityLog(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { limit = 50 } = req.query;

      const movie = MovieModel.findById(id);
      if (!movie) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      const logs = ActivityLogModel.findByEntity('movie', id, Number(limit));
      
      // Format logs with user-friendly labels
      const formattedLogs = logs.map(log => ({
        ...log,
        event_label: EVENT_LABELS[log.event_type] || log.event_type
      }));

      return res.json(formattedLogs);
    } catch (error) {
      logger.error('Get movie activity log error:', error);
      return res.status(500).json({ error: 'Failed to get activity log' });
    }
  }

  // Activity Log for Series
  static async getSeriesActivityLog(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { limit = 50 } = req.query;

      const series = TVSeriesModel.findById(id);
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      const logs = ActivityLogModel.findByEntity('series', id, Number(limit));
      
      // Format logs with user-friendly labels
      const formattedLogs = logs.map(log => ({
        ...log,
        event_label: EVENT_LABELS[log.event_type] || log.event_type
      }));

      return res.json(formattedLogs);
    } catch (error) {
      logger.error('Get series activity log error:', error);
      return res.status(500).json({ error: 'Failed to get activity log' });
    }
  }

  // Global Activity Log (recent activity)
  static async getRecentActivity(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { limit = 100 } = req.query;

      const logs = ActivityLogModel.findRecent(Number(limit));
      
      // Format logs with user-friendly labels
      const formattedLogs = logs.map(log => ({
        ...log,
        event_label: EVENT_LABELS[log.event_type] || log.event_type
      }));

      return res.json(formattedLogs);
    } catch (error) {
      logger.error('Get recent activity error:', error);
      return res.status(500).json({ error: 'Failed to get recent activity' });
    }
  }

  // SSE endpoint for real-time activity streaming
  static async streamActivity(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Send initial connection message
    res.write('event: connected\ndata: {"status":"connected"}\n\n');

    // Track the last activity ID we've sent
    let lastSentId = 0;
    
    // Get the current max ID on connect
    const initialLogs = ActivityLogModel.findRecent(1);
    if (initialLogs.length > 0) {
      lastSentId = initialLogs[0].id;
    }

    // Events that should trigger notifications
    const NOTIFICATION_EVENTS = new Set([
      'grabbed', 'downloaded', 'imported', 'unmonitored', 
      'scan_completed', 'failed', 'deleted'
    ]);

    // Poll for new activity every 2 seconds
    const pollInterval = setInterval(() => {
      try {
        const logs = ActivityLogModel.findRecent(20);
        
        // Find new logs (higher ID than last sent)
        const newLogs = logs.filter(log => 
          log.id > lastSentId && NOTIFICATION_EVENTS.has(log.event_type)
        );
        
        if (newLogs.length > 0) {
          // Update last sent ID
          lastSentId = Math.max(...newLogs.map(l => l.id));
          
          // Send each new activity as an SSE event
          for (const log of newLogs.reverse()) { // Send oldest first
            const data = {
              ...log,
              event_label: EVENT_LABELS[log.event_type] || log.event_type
            };
            res.write(`event: activity\ndata: ${JSON.stringify(data)}\n\n`);
          }
        }
      } catch (error) {
        logger.error('SSE poll error:', error);
      }
    }, 2000);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      res.write('event: heartbeat\ndata: {"time":"' + new Date().toISOString() + '"}\n\n');
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
      logger.debug('SSE client disconnected');
    });
  }

  // Helper: Get setting synchronously
  private static getSettingSync(key: string): string | null {
    try {
      const db = require('../config/database').default;
      const result = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
      return result?.value ?? null;
    } catch {
      return null;
    }
  }

  // Helper: Delete empty folder (and parent folders if empty)
  private static deleteEmptyFolder(folderPath: string): void {
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Don't delete root paths or media library paths
      const moviePath = this.getSettingSync('movie_path');
      const tvPath = this.getSettingSync('tv_path');
      
      if (folderPath === moviePath || folderPath === tvPath || folderPath === '/' || folderPath === '.') {
        return;
      }

      if (!fs.existsSync(folderPath)) {
        return;
      }

      const files = fs.readdirSync(folderPath);
      
      // Check if folder is empty (ignore hidden files like .DS_Store)
      const visibleFiles = files.filter((f: string) => !f.startsWith('.'));
      
      if (visibleFiles.length === 0) {
        fs.rmSync(folderPath, { recursive: true, force: true });
        logger.info(`Deleted empty folder: ${folderPath}`);
        
        // Recursively check parent folder
        const parentDir = path.dirname(folderPath);
        if (parentDir !== moviePath && parentDir !== tvPath) {
          this.deleteEmptyFolder(parentDir);
        }
      }
    } catch (err) {
      logger.debug('Could not delete folder:', err);
    }
  }

  // ==================== Auto Search ====================

  /**
   * Trigger auto search for a single movie
   */
  static async searchMovie(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const movie = MovieModel.findById(id);
      
      if (!movie) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      logger.info(`[Search] Starting search for movie: ${movie.title}`);
      
      const result = await autoSearchService.searchAndDownloadMovie(id);
      
      if (result) {
        return res.json({ 
          success: true, 
          message: `Found release: ${result.title}`,
          release: result
        });
      } else {
        return res.json({ 
          success: false, 
          message: 'No suitable releases found' 
        });
      }
    } catch (error: any) {
      logger.error('Search movie error:', error);
      return res.status(500).json({ error: error.message || 'Search failed' });
    }
  }

  /**
   * Trigger auto search for multiple movies
   */
  static async bulkSearchMovies(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Movie IDs required' });
      }

      logger.info(`[BulkSearch] Starting search for ${ids.length} movies`);
      
      const results = {
        searched: 0,
        found: 0,
        failed: 0,
        details: [] as any[]
      };

      for (const id of ids) {
        const movie = MovieModel.findById(id);
        if (!movie) {
          results.failed++;
          results.details.push({ id, title: 'Unknown', success: false, error: 'Movie not found' });
          continue;
        }

        try {
          results.searched++;
          const result = await autoSearchService.searchAndDownloadMovie(id);
          
          if (result) {
            results.found++;
            results.details.push({ id, title: movie.title, success: true, release: result.title });
          } else {
            results.details.push({ id, title: movie.title, success: false, error: 'No releases found' });
          }
        } catch (err: any) {
          results.failed++;
          results.details.push({ id, title: movie.title, success: false, error: err.message });
        }

        // Small delay between searches to avoid hammering indexers
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      logger.info(`[BulkSearch] Completed: ${results.found}/${results.searched} found`);
      
      return res.json(results);
    } catch (error: any) {
      logger.error('Bulk search movies error:', error);
      return res.status(500).json({ error: error.message || 'Bulk search failed' });
    }
  }

  /**
   * Trigger auto search for a single series (all missing episodes)
   */
  static async searchSeries(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const series = TVSeriesModel.findById(id);
      
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      logger.info(`[Search] Starting search for series: ${series.title}`);
      
      const result = await autoSearchService.searchAndDownloadSeries(id);
      
      return res.json({ 
        success: true, 
        message: `Searched ${result.searched} episodes, found ${result.found}`,
        ...result
      });
    } catch (error: any) {
      logger.error('Search series error:', error);
      return res.status(500).json({ error: error.message || 'Search failed' });
    }
  }

  /**
   * Trigger auto search for multiple series
   */
  static async bulkSearchSeries(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Series IDs required' });
      }

      logger.info(`[BulkSearch] Starting search for ${ids.length} series`);
      
      const results = {
        seriesSearched: 0,
        totalEpisodes: 0,
        totalFound: 0,
        details: [] as any[]
      };

      for (const id of ids) {
        const series = TVSeriesModel.findById(id);
        if (!series) {
          results.details.push({ id, title: 'Unknown', searched: 0, found: 0, error: 'Series not found' });
          continue;
        }

        try {
          results.seriesSearched++;
          const result = await autoSearchService.searchAndDownloadSeries(id);
          
          results.totalEpisodes += result.searched;
          results.totalFound += result.found;
          results.details.push({ 
            id, 
            title: series.title, 
            searched: result.searched, 
            found: result.found 
          });
        } catch (err: any) {
          results.details.push({ id, title: series.title, searched: 0, found: 0, error: err.message });
        }

        // Small delay between series to avoid hammering indexers
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info(`[BulkSearch] Completed: ${results.totalFound} episodes found across ${results.seriesSearched} series`);
      
      return res.json(results);
    } catch (error: any) {
      logger.error('Bulk search series error:', error);
      return res.status(500).json({ error: error.message || 'Bulk search failed' });
    }
  }

  // ==================== Folder Rename ====================

  /**
   * Preview movie folder rename based on current naming settings
   */
  static async previewMovieFolderRename(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const movie = MovieModel.findById(id);
      
      if (!movie || !movie.folder_path) {
        return res.status(404).json({ error: 'Movie not found or no folder set' });
      }

      const currentFolderName = path.basename(movie.folder_path);
      const newFolderName = fileNamingService.generateMovieFolderName({
        title: movie.title,
        year: movie.year || undefined,
        tmdbId: movie.tmdb_id || undefined,
        imdbId: movie.imdb_id || undefined
      });

      const needsRename = currentFolderName !== newFolderName;

      return res.json({
        id: movie.id,
        title: movie.title,
        currentFolder: currentFolderName,
        newFolder: newFolderName,
        needsRename,
        currentPath: movie.folder_path,
        newPath: needsRename ? path.join(path.dirname(movie.folder_path), newFolderName) : movie.folder_path
      });
    } catch (error: any) {
      logger.error('Preview folder rename error:', error);
      return res.status(500).json({ error: error.message || 'Preview failed' });
    }
  }

  /**
   * Execute movie folder rename
   */
  static async executeMovieFolderRename(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const movie = MovieModel.findById(id);
      
      if (!movie || !movie.folder_path) {
        return res.status(404).json({ error: 'Movie not found or no folder set' });
      }

      if (!fs.existsSync(movie.folder_path)) {
        // Folder doesn't exist - just update the database path to what it should be
        logger.warn(`[FolderRename] Folder does not exist on disk: ${movie.folder_path}`);
        
        const currentFolderName = path.basename(movie.folder_path);
        const newFolderName = fileNamingService.generateMovieFolderName({
          title: movie.title,
          year: movie.year || undefined,
          tmdbId: movie.tmdb_id || undefined,
          imdbId: movie.imdb_id || undefined
        });

        if (currentFolderName === newFolderName) {
          return res.json({ success: true, message: 'Folder path already correct (folder not on disk)', renamed: false });
        }

        // Update database path even though folder doesn't exist
        const parentDir = path.dirname(movie.folder_path);
        const newPath = path.join(parentDir, newFolderName);
        
        MovieModel.updateFolderPath(id, newPath);
        
        // Update file paths in database too
        const files = MovieModel.findMovieFiles(id);
        for (const file of files) {
          if (file.file_path && file.file_path.startsWith(movie.folder_path)) {
            const newFilePath = file.file_path.replace(movie.folder_path, newPath);
            MovieModel.updateMovieFilePath(file.id, newFilePath);
          }
        }

        // Try to scan the new path in case files exist there
        try {
          const scanResult = await LibraryScannerController.scanMovieFiles(id, true);
          logger.info(`[FolderRename] Scanned new path, found ${scanResult.found} files`);
        } catch (scanError) {
          logger.debug(`[FolderRename] Scan after database update:`, scanError);
        }

        return res.json({ 
          success: true, 
          message: `Updated database path (folder not on disk): "${currentFolderName}" -> "${newFolderName}"`,
          renamed: true,
          databaseOnly: true,
          oldPath: movie.folder_path,
          newPath
        });
      }

      const currentFolderName = path.basename(movie.folder_path);
      const newFolderName = fileNamingService.generateMovieFolderName({
        title: movie.title,
        year: movie.year || undefined,
        tmdbId: movie.tmdb_id || undefined,
        imdbId: movie.imdb_id || undefined
      });

      if (currentFolderName === newFolderName) {
        return res.json({ success: true, message: 'Folder already has correct name', renamed: false });
      }

      const parentDir = path.dirname(movie.folder_path);
      const newPath = path.join(parentDir, newFolderName);

      // Check if target already exists
      if (fs.existsSync(newPath)) {
        return res.status(400).json({ error: 'Target folder already exists' });
      }

      // Rename the folder
      fs.renameSync(movie.folder_path, newPath);
      logger.info(`[FolderRename] Renamed: "${movie.folder_path}" -> "${newPath}"`);

      // Update database
      MovieModel.updateFolderPath(id, newPath);

      // Update file paths in movie_files table
      const files = MovieModel.findMovieFiles(id);
      for (const file of files) {
        if (file.file_path && file.file_path.startsWith(movie.folder_path)) {
          const newFilePath = file.file_path.replace(movie.folder_path, newPath);
          MovieModel.updateMovieFilePath(file.id, newFilePath);
        }
      }

      // Scan the renamed folder to pick up any files
      try {
        const scanResult = await LibraryScannerController.scanMovieFiles(id, true);
        logger.info(`[FolderRename] Scanned folder, found ${scanResult.found} files`);
      } catch (scanError) {
        logger.warn(`[FolderRename] Scan after rename failed:`, scanError);
      }

      return res.json({
        success: true,
        message: `Renamed folder from "${currentFolderName}" to "${newFolderName}"`,
        renamed: true,
        oldPath: movie.folder_path,
        newPath
      });
    } catch (error: any) {
      logger.error('Execute folder rename error:', error);
      return res.status(500).json({ error: error.message || 'Rename failed' });
    }
  }

  /**
   * Preview all movie folders that need renaming
   */
  static async previewAllMovieFolderRenames(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const movies = MovieModel.findAll(100000, 0);
      const renames: any[] = [];

      for (const movie of movies) {
        if (!movie.folder_path) continue;

        const currentFolderName = path.basename(movie.folder_path);
        const newFolderName = fileNamingService.generateMovieFolderName({
          title: movie.title,
          year: movie.year || undefined,
          tmdbId: movie.tmdb_id || undefined,
          imdbId: movie.imdb_id || undefined
        });

        if (currentFolderName !== newFolderName) {
          renames.push({
            id: movie.id,
            title: movie.title,
            currentFolder: currentFolderName,
            newFolder: newFolderName,
            currentPath: movie.folder_path,
            newPath: path.join(path.dirname(movie.folder_path), newFolderName)
          });
        }
      }

      return res.json({
        total: movies.length,
        needsRename: renames.length,
        renames
      });
    } catch (error: any) {
      logger.error('Preview all folder renames error:', error);
      return res.status(500).json({ error: error.message || 'Preview failed' });
    }
  }

  /**
   * Execute all movie folder renames
   */
  static async executeAllMovieFolderRenames(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const movies = MovieModel.findAll(100000, 0);
      const results = {
        success: 0,
        failed: 0,
        skipped: 0,
        details: [] as any[]
      };

      for (const movie of movies) {
        if (!movie.folder_path) {
          results.skipped++;
          continue;
        }

        const currentFolderName = path.basename(movie.folder_path);
        const newFolderName = fileNamingService.generateMovieFolderName({
          title: movie.title,
          year: movie.year || undefined,
          tmdbId: movie.tmdb_id || undefined,
          imdbId: movie.imdb_id || undefined
        });

        if (currentFolderName === newFolderName) {
          results.skipped++;
          continue;
        }

        const parentDir = path.dirname(movie.folder_path);
        const newPath = path.join(parentDir, newFolderName);

        try {
          // Check source exists
          if (!fs.existsSync(movie.folder_path)) {
            // Folder doesn't exist on disk - just update database
            MovieModel.updateFolderPath(movie.id, newPath);

            // Update file paths in database
            const files = MovieModel.findMovieFiles(movie.id);
            for (const file of files) {
              if (file.file_path && file.file_path.startsWith(movie.folder_path)) {
                const newFilePath = file.file_path.replace(movie.folder_path, newPath);
                MovieModel.updateMovieFilePath(file.id, newFilePath);
              }
            }

            // Try to scan the new path in case files exist there
            try {
              await LibraryScannerController.scanMovieFiles(movie.id, true);
            } catch (scanError) {
              // Ignore scan errors
            }

            results.success++;
            results.details.push({ 
              id: movie.id, 
              title: movie.title, 
              oldFolder: currentFolderName, 
              newFolder: newFolderName,
              success: true,
              databaseOnly: true
            });
            
            logger.info(`[FolderRename] Updated database path (folder not on disk): "${currentFolderName}" -> "${newFolderName}"`);
            continue;
          }

          // Check target doesn't exist
          if (fs.existsSync(newPath)) {
            results.failed++;
            results.details.push({ id: movie.id, title: movie.title, error: 'Target folder already exists' });
            continue;
          }

          // Rename actual folder
          fs.renameSync(movie.folder_path, newPath);
          MovieModel.updateFolderPath(movie.id, newPath);

          // Update file paths
          const files = MovieModel.findMovieFiles(movie.id);
          for (const file of files) {
            if (file.file_path && file.file_path.startsWith(movie.folder_path)) {
              const newFilePath = file.file_path.replace(movie.folder_path, newPath);
              MovieModel.updateMovieFilePath(file.id, newFilePath);
            }
          }

          // Scan the renamed folder to pick up files
          try {
            await LibraryScannerController.scanMovieFiles(movie.id, true);
          } catch (scanError) {
            // Ignore scan errors
          }

          results.success++;
          results.details.push({ 
            id: movie.id, 
            title: movie.title, 
            oldFolder: currentFolderName, 
            newFolder: newFolderName,
            success: true 
          });
          
          logger.info(`[FolderRename] Renamed: "${currentFolderName}" -> "${newFolderName}"`);
        } catch (err: any) {
          results.failed++;
          results.details.push({ id: movie.id, title: movie.title, error: err.message });
        }
      }

      logger.info(`[FolderRename] Completed: ${results.success} renamed, ${results.failed} failed, ${results.skipped} skipped`);
      
      return res.json(results);
    } catch (error: any) {
      logger.error('Execute all folder renames error:', error);
      return res.status(500).json({ error: error.message || 'Rename failed' });
    }
  }

  /**
   * Browse files/folders for manual import
   */
  static async browseFiles(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { path: browsePath } = req.query;
      const targetPath = (browsePath as string) || '/data';

      // Security check - only allow browsing within /data
      const fs = require('fs');
      const path = require('path');
      
      const normalizedPath = path.normalize(targetPath);
      if (!normalizedPath.startsWith('/data')) {
        return res.status(403).json({ error: 'Access denied - can only browse /data directory' });
      }

      if (!fs.existsSync(normalizedPath)) {
        return res.status(404).json({ error: 'Path not found' });
      }

      const stat = fs.statSync(normalizedPath);
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' });
      }

      const entries = fs.readdirSync(normalizedPath, { withFileTypes: true });
      const items = entries
        .filter((entry: any) => !entry.name.startsWith('.'))
        .map((entry: any) => {
          const fullPath = path.join(normalizedPath, entry.name);
          let size = 0;
          let videoCount = 0;

          if (entry.isFile()) {
            try {
              size = fs.statSync(fullPath).size;
            } catch {}
          } else if (entry.isDirectory()) {
            // Count video files in directory
            try {
              const files = fs.readdirSync(fullPath);
              const videoExtensions = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.ts'];
              videoCount = files.filter((f: string) => 
                videoExtensions.some(ext => f.toLowerCase().endsWith(ext))
              ).length;
            } catch {}
          }

          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            size,
            videoCount,
            isVideo: entry.isFile() && ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.ts']
              .some(ext => entry.name.toLowerCase().endsWith(ext))
          };
        })
        .sort((a: any, b: any) => {
          // Directories first, then files
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

      return res.json({
        path: normalizedPath,
        parent: normalizedPath !== '/data' ? path.dirname(normalizedPath) : null,
        items
      });
    } catch (error: any) {
      logger.error('Browse files error:', error);
      return res.status(500).json({ error: error.message || 'Browse failed' });
    }
  }

  /**
   * Manual import for a movie
   */
  static async manualImportMovie(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { sourcePath, deleteSource = false } = req.body;

      if (!sourcePath) {
        return res.status(400).json({ error: 'Source path is required' });
      }

      const movie = MovieModel.findById(id);
      if (!movie) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      const fs = require('fs');
      const path = require('path');

      // Validate source path exists
      if (!fs.existsSync(sourcePath)) {
        return res.status(404).json({ error: 'Source path not found' });
      }

      // Find video files
      const stat = fs.statSync(sourcePath);
      let videoFiles: string[] = [];
      const videoExtensions = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.ts'];

      if (stat.isFile()) {
        if (videoExtensions.some(ext => sourcePath.toLowerCase().endsWith(ext))) {
          videoFiles = [sourcePath];
        }
      } else if (stat.isDirectory()) {
        const findVideoFiles = (dir: string): string[] => {
          const files: string[] = [];
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isFile() && videoExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))) {
              files.push(fullPath);
            } else if (entry.isDirectory()) {
              files.push(...findVideoFiles(fullPath));
            }
          }
          return files;
        };
        videoFiles = findVideoFiles(sourcePath);
      }

      if (videoFiles.length === 0) {
        return res.status(400).json({ error: 'No video files found in source path' });
      }

      // Use the largest video file
      const largestFile = videoFiles.reduce((prev, curr) => {
        const prevSize = fs.statSync(prev).size;
        const currSize = fs.statSync(curr).size;
        return currSize > prevSize ? curr : prev;
      });

      // Ensure movie folder exists
      if (!fs.existsSync(movie.folder_path)) {
        fs.mkdirSync(movie.folder_path, { recursive: true });
      }

      // Parse quality from filename
      const { QualityProfileModel } = require('../models/QualityProfile');
      const sourceFilename = path.basename(largestFile);
      const quality = QualityProfileModel.parseQualityFromFilename(sourceFilename);

      // Generate proper filename using naming service
      const { fileNamingService, MovieNamingInfo } = require('../services/fileNaming');
      const { mediaInfoService } = require('../services/mediaInfo');
      
      // Get media info for better naming
      let mediaInfo: any = {};
      try {
        mediaInfo = await mediaInfoService.getMediaInfo(largestFile);
      } catch (e) {
        logger.warn('[ManualImport] Could not get media info:', e);
      }

      // Build naming info for the movie
      // Extract release group from filename (usually after last dash before extension)
      const releaseGroupMatch = sourceFilename.match(/-([A-Za-z0-9]+)(?:\.[a-z0-9]+)?$/i);
      const releaseGroup = releaseGroupMatch ? releaseGroupMatch[1] : undefined;

      const namingInfo = {
        title: movie.title,
        year: movie.year || undefined,
        tmdbId: movie.tmdb_id,
        imdbId: movie.imdb_id || undefined,
        quality: quality,
        videoCodec: mediaInfo.videoCodec || undefined,
        audioCodec: mediaInfo.audioCodec || undefined,
        audioChannels: mediaInfo.audioChannels || undefined,
        releaseGroup
      };

      const extension = path.extname(sourceFilename);
      let destFilename = sourceFilename;
      try {
        const generatedName = fileNamingService.generateMovieFilename(namingInfo, extension);
        if (generatedName) {
          destFilename = generatedName;
        }
      } catch (e) {
        logger.warn('[ManualImport] Could not generate filename, using original:', e);
      }

      const destPath = path.join(movie.folder_path, destFilename);

      // Copy or move the file
      try {
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }

        if (deleteSource) {
          fs.renameSync(largestFile, destPath);
          logger.info(`[ManualImport] Moved: ${largestFile} -> ${destPath}`);
          
          // Try to clean up empty source directory
          if (stat.isDirectory()) {
            try {
              const remaining = fs.readdirSync(sourcePath);
              if (remaining.length === 0) {
                fs.rmdirSync(sourcePath);
                logger.info(`[ManualImport] Removed empty source directory: ${sourcePath}`);
              }
            } catch {}
          }
        } else {
          // Try hardlink first
          try {
            fs.linkSync(largestFile, destPath);
            logger.info(`[ManualImport] Hardlinked: ${largestFile} -> ${destPath}`);
          } catch {
            fs.copyFileSync(largestFile, destPath);
            logger.info(`[ManualImport] Copied: ${largestFile} -> ${destPath}`);
          }
        }
      } catch (err: any) {
        return res.status(500).json({ error: `Failed to import file: ${err.message}` });
      }

      // Get media info and update database
      const destStat = fs.statSync(destPath);
      const finalMediaInfo = await mediaInfoService.getMediaInfo(destPath);
      const actualQuality = finalMediaInfo.qualityFull || finalMediaInfo.resolution || quality;

      MovieModel.updateFile(movie.id, destPath, destStat.size, actualQuality);

      // Update movie_files table
      MovieModel.deleteMovieFilesByMovieId(movie.id);
      MovieModel.addMovieFile({
        movie_id: movie.id,
        file_path: destPath,
        relative_path: path.basename(destPath),
        file_size: destStat.size,
        quality: actualQuality,
        resolution: finalMediaInfo.resolution || undefined,
        video_codec: finalMediaInfo.videoCodec || undefined,
        video_dynamic_range: finalMediaInfo.videoDynamicRange || undefined,
        audio_codec: finalMediaInfo.audioCodec || undefined,
        audio_channels: finalMediaInfo.audioChannels || undefined,
        audio_languages: finalMediaInfo.audioLanguages || undefined,
        audio_track_count: finalMediaInfo.audioTrackCount || 1,
        subtitle_languages: finalMediaInfo.subtitleLanguages || undefined
      });

      // Log activity
      const importDetails = JSON.stringify({
        quality: actualQuality,
        size: destStat.size,
        source: sourcePath,
        user: req.user.username
      });
      ActivityLogModel.logMovieEvent(movie.id, EVENT_TYPES.IMPORTED, 
        `Manually imported: ${destFilename}`, importDetails
      );

      logger.info(`[ManualImport] Successfully imported ${movie.title}: ${destFilename}`);

      return res.json({
        success: true,
        message: `Successfully imported ${destFilename}`,
        file: {
          path: destPath,
          size: destStat.size,
          quality: actualQuality
        }
      });
    } catch (error: any) {
      logger.error('Manual import movie error:', error);
      return res.status(500).json({ error: error.message || 'Import failed' });
    }
  }

  /**
   * Manual import for a series episode
   */
  static async manualImportEpisode(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { sourcePath, seasonNumber, episodeNumber, deleteSource = false } = req.body;

      if (!sourcePath) {
        return res.status(400).json({ error: 'Source path is required' });
      }
      if (seasonNumber === undefined || episodeNumber === undefined) {
        return res.status(400).json({ error: 'Season and episode number are required' });
      }

      const series = TVSeriesModel.findById(id);
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      const fs = require('fs');
      const path = require('path');

      // Validate source path exists
      if (!fs.existsSync(sourcePath)) {
        return res.status(404).json({ error: 'Source path not found' });
      }

      // Find video file
      const stat = fs.statSync(sourcePath);
      let videoFile: string | null = null;
      const videoExtensions = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.m4v', '.ts'];

      if (stat.isFile()) {
        if (videoExtensions.some(ext => sourcePath.toLowerCase().endsWith(ext))) {
          videoFile = sourcePath;
        }
      } else if (stat.isDirectory()) {
        // Find largest video file
        const files = fs.readdirSync(sourcePath);
        let largestSize = 0;
        for (const file of files) {
          const fullPath = path.join(sourcePath, file);
          if (videoExtensions.some(ext => file.toLowerCase().endsWith(ext))) {
            const size = fs.statSync(fullPath).size;
            if (size > largestSize) {
              largestSize = size;
              videoFile = fullPath;
            }
          }
        }
      }

      if (!videoFile) {
        return res.status(400).json({ error: 'No video file found in source path' });
      }

      // Get or create season folder
      const seasonFolder = path.join(series.folder_path, `Season ${seasonNumber.toString().padStart(2, '0')}`);
      if (!fs.existsSync(seasonFolder)) {
        fs.mkdirSync(seasonFolder, { recursive: true });
      }

      // Parse quality from filename
      const { QualityProfileModel } = require('../models/QualityProfile');
      const sourceFilename = path.basename(videoFile);
      const quality = QualityProfileModel.parseQualityFromFilename(sourceFilename);
      
      // Parse release group from filename
      const releaseGroupMatch = sourceFilename.match(/-([A-Za-z0-9]+)(?:\.[^.]+)?$/);
      const releaseGroup = releaseGroupMatch ? releaseGroupMatch[1] : undefined;

      // Generate proper filename
      const { fileNamingService } = require('../services/fileNaming');
      const { mediaInfoService } = require('../services/mediaInfo');
      
      // Find the episode
      const episodes = TVSeriesModel.findEpisodesBySeason(id, seasonNumber);
      const episode = episodes.find(e => e.episode_number === episodeNumber);
      
      let destFilename = sourceFilename;
      try {
        const episodeTitle = episode?.title || `Episode ${episodeNumber}`;
        const generatedName = await fileNamingService.generateEpisodeFileName(
          series, seasonNumber, episodeNumber, episodeTitle, sourceFilename,
          { quality, resolution: quality.match(/(2160p|1080p|720p|480p)/i)?.[1] || undefined }
        );
        if (generatedName) {
          destFilename = generatedName;
        }
      } catch (e) {
        logger.warn('[ManualImport] Could not generate filename, using original:', e);
      }

      const destPath = path.join(seasonFolder, destFilename);

      // Copy or move the file
      try {
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }

        if (deleteSource) {
          fs.renameSync(videoFile, destPath);
          logger.info(`[ManualImport] Moved: ${videoFile} -> ${destPath}`);
        } else {
          try {
            fs.linkSync(videoFile, destPath);
            logger.info(`[ManualImport] Hardlinked: ${videoFile} -> ${destPath}`);
          } catch {
            fs.copyFileSync(videoFile, destPath);
            logger.info(`[ManualImport] Copied: ${videoFile} -> ${destPath}`);
          }
        }
      } catch (err: any) {
        return res.status(500).json({ error: `Failed to import file: ${err.message}` });
      }

      // Get media info and update database
      const destStat = fs.statSync(destPath);
      const mediaInfo = await mediaInfoService.getMediaInfo(destPath);
      const actualQuality = mediaInfo.qualityFull || mediaInfo.resolution || quality;

      // Update episode in database
      if (episode) {
        TVSeriesModel.updateEpisodeFile(
          episode.id, 
          destPath, 
          destStat.size, 
          actualQuality,
          mediaInfo.videoCodec,
          mediaInfo.audioCodec,
          releaseGroup
        );
      }

      // Log activity
      const importDetails = JSON.stringify({
        season: seasonNumber,
        episode: episodeNumber,
        quality: actualQuality,
        size: destStat.size,
        source: sourcePath,
        user: req.user.username
      });
      ActivityLogModel.logSeriesEvent(series.id, EVENT_TYPES.IMPORTED,
        `Manually imported S${seasonNumber.toString().padStart(2, '0')}E${episodeNumber.toString().padStart(2, '0')}: ${destFilename}`,
        importDetails
      );

      logger.info(`[ManualImport] Successfully imported ${series.title} S${seasonNumber}E${episodeNumber}: ${destFilename}`);

      return res.json({
        success: true,
        message: `Successfully imported S${seasonNumber.toString().padStart(2, '0')}E${episodeNumber.toString().padStart(2, '0')}`,
        file: {
          path: destPath,
          size: destStat.size,
          quality: actualQuality
        }
      });
    } catch (error: any) {
      logger.error('Manual import episode error:', error);
      return res.status(500).json({ error: error.message || 'Import failed' });
    }
  }

  /**
   * Get related movies based on collection, cast, crew, genres, and title similarity
   */
  static async getRelatedMovies(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { limit = 10 } = req.query;
      
      const movie = MovieModel.findById(id);
      if (!movie) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      const related = MovieModel.findRelated(id, Math.min(Number(limit), 20));
      
      return res.json({
        movie: {
          id: movie.id,
          title: movie.title,
          year: movie.year
        },
        related: related.map(r => ({
          id: r.movie.id,
          tmdb_id: r.movie.tmdb_id,
          title: r.movie.title,
          year: r.movie.year,
          poster_path: r.movie.poster_path,
          vote_average: r.movie.vote_average,
          certification: r.movie.certification,
          has_file: r.movie.has_file,
          score: r.score,
          reasons: r.reasons
        }))
      });
    } catch (error) {
      logger.error('Get related movies error:', error);
      return res.status(500).json({ error: 'Failed to get related movies' });
    }
  }

  /**
   * Get related series based on cast, crew, genres, network, and title similarity
   */
  static async getRelatedSeries(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { limit = 10 } = req.query;
      
      const series = TVSeriesModel.findById(id);
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      const related = TVSeriesModel.findRelated(id, Math.min(Number(limit), 20));
      
      return res.json({
        series: {
          id: series.id,
          title: series.title,
          year: series.year
        },
        related: related.map(r => ({
          id: r.series.id,
          tmdb_id: r.series.tmdb_id,
          title: r.series.title,
          year: r.series.year,
          poster_path: r.series.poster_path,
          vote_average: r.series.vote_average,
          certification: r.series.certification,
          network: r.series.network,
          score: r.score,
          reasons: r.reasons
        }))
      });
    } catch (error) {
      logger.error('Get related series error:', error);
      return res.status(500).json({ error: 'Failed to get related series' });
    }
  }

  /**
   * Refresh media metadata (cast, crew, genres, collection) for a movie
   */
  static async refreshMovieMetadata(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const movie = MovieModel.findById(id);
      
      if (!movie) {
        return res.status(404).json({ error: 'Movie not found' });
      }

      if (!movie.tmdb_id) {
        return res.status(400).json({ error: 'Movie has no TMDB ID' });
      }

      const tmdbData = await tmdbService.getMovieDetails(movie.tmdb_id);
      if (!tmdbData) {
        return res.status(404).json({ error: 'TMDB data not found' });
      }

      const castData = tmdbData.credits?.cast?.slice(0, 15).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profile_path: c.profile_path
      })) || [];

      const crewData = tmdbData.credits?.crew?.filter((c: any) => 
        ['Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer'].includes(c.job)
      ).slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        job: c.job,
        department: c.department
      })) || [];

      const genres = tmdbData.genres?.map((g: any) => ({
        id: g.id,
        name: g.name
      })) || [];

      // Extract certification
      let certification: string | undefined;
      if (tmdbData.release_dates?.results) {
        const usRelease = tmdbData.release_dates.results.find((r: any) => r.iso_3166_1 === 'US');
        const auRelease = tmdbData.release_dates.results.find((r: any) => r.iso_3166_1 === 'AU');
        const releaseData = usRelease || auRelease || tmdbData.release_dates.results[0];
        if (releaseData?.release_dates) {
          const certifiedRelease = releaseData.release_dates.find((rd: any) => rd.certification);
          certification = certifiedRelease?.certification;
        }
      }

      const updated = MovieModel.updateMediaMetadata(id, {
        cast_data: castData,
        crew_data: crewData,
        genres: genres,
        collection_id: tmdbData.belongs_to_collection?.id || undefined,
        collection_name: tmdbData.belongs_to_collection?.name || undefined,
        certification: certification
      });

      logger.info(`Refreshed media metadata for movie: ${movie.title}`);
      return res.json(updated);
    } catch (error) {
      logger.error('Refresh movie metadata error:', error);
      return res.status(500).json({ error: 'Failed to refresh metadata' });
    }
  }

  /**
   * Refresh media metadata (cast, crew, genres, certification) for a series
   */
  static async refreshSeriesMetadata(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const series = TVSeriesModel.findById(id);
      
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      if (!series.tmdb_id) {
        return res.status(400).json({ error: 'Series has no TMDB ID' });
      }

      const tmdbData = await tmdbService.getTVDetails(series.tmdb_id);
      if (!tmdbData) {
        return res.status(404).json({ error: 'TMDB data not found' });
      }

      const castData = tmdbData.credits?.cast?.slice(0, 15).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profile_path: c.profile_path
      })) || tmdbData.aggregate_credits?.cast?.slice(0, 15).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.roles?.[0]?.character,
        profile_path: c.profile_path
      })) || [];

      const crewData = tmdbData.credits?.crew?.filter((c: any) => 
        ['Creator', 'Executive Producer', 'Showrunner', 'Writer'].includes(c.job)
      ).slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        job: c.job,
        department: c.department
      })) || tmdbData.created_by?.map((c: any) => ({
        id: c.id,
        name: c.name,
        job: 'Creator',
        department: 'Writing'
      })) || [];

      const genres = tmdbData.genres?.map((g: any) => ({
        id: g.id,
        name: g.name
      })) || [];

      // Extract certification
      let certification: string | undefined;
      if (tmdbData.content_ratings?.results) {
        const usRating = tmdbData.content_ratings.results.find((r: any) => r.iso_3166_1 === 'US');
        const auRating = tmdbData.content_ratings.results.find((r: any) => r.iso_3166_1 === 'AU');
        certification = usRating?.rating || auRating?.rating || tmdbData.content_ratings.results[0]?.rating;
      }

      const updated = TVSeriesModel.updateMediaMetadata(id, {
        cast_data: castData,
        crew_data: crewData,
        genres: genres,
        certification: certification
      });

      logger.info(`Refreshed media metadata for series: ${series.title}`);
      return res.json(updated);
    } catch (error) {
      logger.error('Refresh series metadata error:', error);
      return res.status(500).json({ error: 'Failed to refresh metadata' });
    }
  }
}
