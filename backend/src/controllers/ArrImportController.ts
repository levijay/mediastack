import { Request, Response } from 'express';
import { arrService } from '../services/arrService';
import logger from '../config/logger';

interface AuthRequest extends Request {
  user?: { userId: string; username: string; role: string };
}

export class ArrImportController {
  /**
   * Test Radarr connection
   */
  static async testRadarr(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { url, apiKey } = req.body;

      if (!url || !apiKey) {
        return res.status(400).json({ error: 'URL and API key are required' });
      }

      const result = await arrService.testRadarr(url, apiKey);
      
      if (result.success) {
        return res.json({ success: true, version: result.version });
      } else {
        return res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      logger.error('Radarr test error:', error);
      return res.status(500).json({ error: 'Failed to test Radarr connection' });
    }
  }

  /**
   * Test Sonarr connection
   */
  static async testSonarr(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { url, apiKey } = req.body;

      if (!url || !apiKey) {
        return res.status(400).json({ error: 'URL and API key are required' });
      }

      const result = await arrService.testSonarr(url, apiKey);
      
      if (result.success) {
        return res.json({ success: true, version: result.version });
      } else {
        return res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      logger.error('Sonarr test error:', error);
      return res.status(500).json({ error: 'Failed to test Sonarr connection' });
    }
  }

  /**
   * Get movies from Radarr
   */
  static async getRadarrMovies(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { url, apiKey } = req.body;

      if (!url || !apiKey) {
        return res.status(400).json({ error: 'URL and API key are required' });
      }

      const movies = await arrService.getRadarrMovies(url, apiKey);
      
      // Transform to consistent format with poster URLs
      const transformedMovies = movies.map(movie => ({
        id: movie.id,
        title: movie.title,
        year: movie.year,
        tmdbId: movie.tmdbId,
        imdbId: movie.imdbId,
        overview: movie.overview,
        path: movie.path,
        hasFile: movie.hasFile,
        monitored: movie.monitored,
        posterUrl: arrService.getPosterUrl(movie.images)
      }));

      return res.json({ movies: transformedMovies, total: transformedMovies.length });
    } catch (error: any) {
      logger.error('Get Radarr movies error:', error);
      return res.status(500).json({ error: error.message || 'Failed to get movies from Radarr' });
    }
  }

  /**
   * Get series from Sonarr
   */
  static async getSonarrSeries(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { url, apiKey } = req.body;

      if (!url || !apiKey) {
        return res.status(400).json({ error: 'URL and API key are required' });
      }

      const series = await arrService.getSonarrSeries(url, apiKey);
      
      // Transform to consistent format with poster URLs
      const transformedSeries = series.map(s => ({
        id: s.id,
        title: s.title,
        year: s.year,
        tvdbId: s.tvdbId,
        imdbId: s.imdbId,
        overview: s.overview,
        path: s.path,
        monitored: s.monitored,
        posterUrl: arrService.getPosterUrl(s.images),
        seasonCount: s.statistics?.seasonCount,
        episodeCount: s.statistics?.episodeCount,
        episodeFileCount: s.statistics?.episodeFileCount,
        sizeOnDisk: s.statistics?.sizeOnDisk
      }));

      return res.json({ series: transformedSeries, total: transformedSeries.length });
    } catch (error: any) {
      logger.error('Get Sonarr series error:', error);
      return res.status(500).json({ error: error.message || 'Failed to get series from Sonarr' });
    }
  }

  /**
   * Get quality profiles from Radarr
   */
  static async getRadarrProfiles(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { url, apiKey } = req.body;

      if (!url || !apiKey) {
        return res.status(400).json({ error: 'URL and API key are required' });
      }

      const profiles = await arrService.getRadarrProfiles(url, apiKey);
      return res.json({ profiles });
    } catch (error: any) {
      logger.error('Get Radarr profiles error:', error);
      return res.status(500).json({ error: error.message || 'Failed to get quality profiles' });
    }
  }

  /**
   * Get quality profiles from Sonarr
   */
  static async getSonarrProfiles(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { url, apiKey } = req.body;

      if (!url || !apiKey) {
        return res.status(400).json({ error: 'URL and API key are required' });
      }

      const profiles = await arrService.getSonarrProfiles(url, apiKey);
      return res.json({ profiles });
    } catch (error: any) {
      logger.error('Get Sonarr profiles error:', error);
      return res.status(500).json({ error: error.message || 'Failed to get quality profiles' });
    }
  }
}
