import { Request, Response } from 'express';
import { tmdbService, TMDBService } from '../services/tmdb';
import { tvdbService } from '../services/tvdb';
import { indexerService } from '../services/indexer';
import { omdbService } from '../services/omdb';
import logger from '../config/logger';

export class SearchController {
  static async searchAll(req: Request, res: Response) {
    try {
      const { query, page = 1 } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query required' });
      }

      const results = await tmdbService.searchMulti(query, Number(page));
      
      return res.json(results);
    } catch (error: any) {
      logger.error('Search error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Search failed' });
    }
  }

  static async searchMovies(req: Request, res: Response) {
    try {
      const { query, page = 1, year } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query required' });
      }

      // Check if query is a TMDB ID (all digits)
      if (/^\d+$/.test(query.trim())) {
        const tmdbId = parseInt(query.trim());
        try {
          const movie = await tmdbService.getMovieDetails(tmdbId);
          if (movie) {
            // Format like search results
            return res.json({
              results: [{
                id: movie.id,
                title: movie.title,
                year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
                overview: movie.overview,
                poster_path: movie.poster_path,
                release_date: movie.release_date
              }],
              total_results: 1,
              page: 1,
              total_pages: 1
            });
          }
        } catch (err) {
          // If lookup by ID fails, fall through to text search
          logger.debug(`TMDB ID lookup failed for ${tmdbId}, trying text search`);
        }
      }

      const yearNum = year ? parseInt(String(year)) : undefined;
      const results = await tmdbService.searchMovies(query, Number(page), yearNum);
      
      return res.json(results);
    } catch (error: any) {
      logger.error('Movie search error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Search failed' });
    }
  }

  /**
   * Search TV shows - Uses TMDB for English names and working posters
   */
  static async searchTV(req: Request, res: Response) {
    try {
      const { query, page = 1 } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query required' });
      }

      // Check if query is a TMDB ID (all digits)
      if (/^\d+$/.test(query.trim())) {
        const tmdbId = parseInt(query.trim());
        try {
          const show = await tmdbService.getTVDetails(tmdbId);
          if (show) {
            // Format like search results
            return res.json({
              results: [{
                id: show.id,
                name: show.name,
                original_name: show.original_name,
                overview: show.overview,
                poster_path: show.poster_path,
                first_air_date: show.first_air_date
              }],
              total_results: 1,
              page: 1,
              total_pages: 1
            });
          }
        } catch (err) {
          // If lookup by ID fails, fall through to text search
          logger.debug(`TMDB TV ID lookup failed for ${tmdbId}, trying text search`);
        }
      }

      // Use TMDB for TV search (English titles, working posters)
      const results = await tmdbService.searchTV(query, Number(page));
      return res.json(results);
    } catch (error: any) {
      logger.error('TV search error:', error);
      if (error.message?.includes('API key')) {
        return res.status(503).json({ error: 'API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Search failed' });
    }
  }

  static async getTrending(req: Request, res: Response) {
    try {
      const { type = 'all', timeWindow = 'week' } = req.query;

      const window = timeWindow === 'day' ? 'day' : 'week';

      let results;
      if (type === 'movie') {
        results = await tmdbService.getTrendingMovies(window);
      } else if (type === 'tv') {
        results = await tmdbService.getTrendingTV(window);
      } else {
        // Combine movies and TV for 'all' type
        const [movies, tv] = await Promise.all([
          tmdbService.getTrendingMovies(window),
          tmdbService.getTrendingTV(window)
        ]);
        
        // Combine and sort by popularity, adding media_type
        const combined = [
          ...(movies?.results || []).map((m: any) => ({ ...m, media_type: 'movie' })),
          ...(tv?.results || []).map((t: any) => ({ ...t, media_type: 'tv' }))
        ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        
        results = { results: combined };
      }

      return res.json(results);
    } catch (error: any) {
      logger.error('Trending error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Failed to get trending' });
    }
  }

  static async getPopular(req: Request, res: Response) {
    try {
      const { type = 'all', page = 1 } = req.query;

      let results;
      if (type === 'movie') {
        results = await tmdbService.getPopularMovies(Number(page));
      } else if (type === 'tv') {
        results = await tmdbService.getPopularTV(Number(page));
      } else {
        const [movies, tv] = await Promise.all([
          tmdbService.getPopularMovies(Number(page)),
          tmdbService.getPopularTV(Number(page))
        ]);
        results = { movies, tv };
      }

      return res.json(results);
    } catch (error: any) {
      logger.error('Popular error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Failed to get popular' });
    }
  }

  static async getTopRated(req: Request, res: Response) {
    try {
      const { type = 'movie', page = 1 } = req.query;

      let results;
      if (type === 'movie') {
        results = await tmdbService.getTopRatedMovies(Number(page));
      } else if (type === 'tv') {
        results = await tmdbService.getTopRatedTV(Number(page));
      } else {
        const [movies, tv] = await Promise.all([
          tmdbService.getTopRatedMovies(Number(page)),
          tmdbService.getTopRatedTV(Number(page))
        ]);
        results = { movies, tv };
      }

      return res.json(results);
    } catch (error: any) {
      logger.error('Top rated error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Failed to get top rated' });
    }
  }

  static async getUpcoming(req: Request, res: Response) {
    try {
      const { page = 1, type = 'movie' } = req.query;
      if (type === 'tv') {
        const results = await tmdbService.getUpcomingTV(Number(page));
        return res.json(results);
      }
      
      // Get upcoming movies and filter to only show future releases
      const results = await tmdbService.getUpcomingMovies(Number(page));
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (results?.results) {
        results.results = results.results.filter((movie: any) => {
          // Only include movies with release dates in the future
          return movie.release_date && movie.release_date > today;
        });
      }
      
      return res.json(results);
    } catch (error: any) {
      logger.error('Upcoming error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Failed to get upcoming' });
    }
  }

  static async discover(req: Request, res: Response) {
    try {
      const { type = 'movie', page = 1, sort_by = 'popularity.desc' } = req.query;

      // Extract filter parameters
      const filters: any = {};
      if (req.query.genres) filters.genres = String(req.query.genres).split(',').map(Number);
      if (req.query.release_date_from) filters.releaseDateFrom = String(req.query.release_date_from);
      if (req.query.release_date_to) filters.releaseDateTo = String(req.query.release_date_to);
      if (req.query.language) filters.language = String(req.query.language);
      if (req.query.runtime_min) filters.runtimeMin = Number(req.query.runtime_min);
      if (req.query.runtime_max) filters.runtimeMax = Number(req.query.runtime_max);
      if (req.query.vote_average_min) filters.voteAverageMin = Number(req.query.vote_average_min);
      if (req.query.vote_average_max) filters.voteAverageMax = Number(req.query.vote_average_max);
      if (req.query.vote_count_min) filters.voteCountMin = Number(req.query.vote_count_min);
      if (req.query.vote_count_max) filters.voteCountMax = Number(req.query.vote_count_max);
      if (req.query.certifications) filters.certifications = String(req.query.certifications).split(',');
      if (req.query.keywords) filters.keywords = String(req.query.keywords).split(',').map(Number);
      if (req.query.exclude_keywords) filters.excludeKeywords = String(req.query.exclude_keywords).split(',').map(Number);
      if (req.query.companies) filters.companies = String(req.query.companies).split(',').map(Number);
      if (req.query.networks) filters.networks = String(req.query.networks).split(',').map(Number);

      let results;
      if (type === 'movie') {
        results = await tmdbService.discoverMovies(Number(page), String(sort_by), filters);
      } else {
        results = await tmdbService.discoverTV(Number(page), String(sort_by), filters);
      }

      return res.json(results);
    } catch (error: any) {
      logger.error('Discover error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Failed to discover content' });
    }
  }

  static async getGenres(req: Request, res: Response) {
    try {
      const { type = 'movie' } = req.query;
      const results = type === 'movie' 
        ? await tmdbService.getMovieGenres()
        : await tmdbService.getTVGenres();
      return res.json(results);
    } catch (error: any) {
      logger.error('Genres error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured.' });
      }
      return res.status(500).json({ error: 'Failed to get genres' });
    }
  }

  static async getLanguages(req: Request, res: Response) {
    try {
      const results = await tmdbService.getLanguages();
      return res.json(results);
    } catch (error: any) {
      logger.error('Languages error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured.' });
      }
      return res.status(500).json({ error: 'Failed to get languages' });
    }
  }

  static async searchKeywords(req: Request, res: Response) {
    try {
      const { query } = req.query;
      if (!query) return res.json({ results: [] });
      const results = await tmdbService.searchKeywords(String(query));
      return res.json(results);
    } catch (error: any) {
      logger.error('Keywords search error:', error);
      return res.status(500).json({ error: 'Failed to search keywords' });
    }
  }

  static async searchCompanies(req: Request, res: Response) {
    try {
      const { query } = req.query;
      if (!query) return res.json({ results: [] });
      const results = await tmdbService.searchCompanies(String(query));
      return res.json(results);
    } catch (error: any) {
      logger.error('Companies search error:', error);
      return res.status(500).json({ error: 'Failed to search companies' });
    }
  }

  static async getMovieDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const details = await tmdbService.getMovieDetails(Number(id));
      
      // Extract certification from release_dates
      const certification = TMDBService.extractCertification(details);
      if (certification) {
        details.certification = certification;
      }
      
      // If OMDB API is configured and we have an IMDB ID, fetch IMDB rating
      if (details.imdb_id) {
        try {
          const imdbRating = await omdbService.getIMDBRating(details.imdb_id);
          if (imdbRating) {
            details.imdb_rating = imdbRating.rating;
            details.imdb_votes = imdbRating.votes;
            details.metascore = imdbRating.metascore;
          }
        } catch (e) {
          // Silently fail - IMDB rating is optional
          logger.debug('Failed to fetch IMDB rating:', e);
        }
      }
      
      return res.json(details);
    } catch (error: any) {
      logger.error('Movie details error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Failed to get movie details' });
    }
  }

  static async getTVDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const details = await tmdbService.getTVDetails(Number(id));
      
      // Extract content rating from content_ratings
      if (details.content_ratings?.results) {
        const usRating = details.content_ratings.results.find((r: any) => r.iso_3166_1 === 'US');
        if (usRating?.rating) {
          details.certification = usRating.rating;
        } else if (details.content_ratings.results.length > 0) {
          // Fallback to first available rating
          const firstRating = details.content_ratings.results.find((r: any) => r.rating);
          if (firstRating?.rating) {
            details.certification = firstRating.rating;
          }
        }
      }
      
      return res.json(details);
    } catch (error: any) {
      logger.error('TV details error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Failed to get TV details' });
    }
  }

  static async getMovieCredits(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const credits = await tmdbService.getMovieCredits(Number(id));
      
      return res.json(credits);
    } catch (error: any) {
      logger.error('Movie credits error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Failed to get movie credits' });
    }
  }

  static async getTVCredits(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const credits = await tmdbService.getTVCredits(Number(id));
      
      return res.json(credits);
    } catch (error: any) {
      logger.error('TV credits error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Failed to get TV credits' });
    }
  }

  static async getSeasonDetails(req: Request, res: Response) {
    try {
      const { id, seasonNumber } = req.params;
      
      const details = await tmdbService.getSeasonDetails(Number(id), Number(seasonNumber));
      
      return res.json(details);
    } catch (error: any) {
      logger.error('Season details error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
      }
      return res.status(500).json({ error: 'Failed to get season details' });
    }
  }

  static async getSimilarMovies(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // Use recommendations instead of similar - TMDB recommendations are much better quality
      const similar = await tmdbService.getMovieRecommendations(Number(id));
      return res.json(similar);
    } catch (error: any) {
      logger.error('Similar movies error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured' });
      }
      return res.status(500).json({ error: 'Failed to get similar movies' });
    }
  }

  static async getSimilarTV(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // Use recommendations instead of similar - TMDB recommendations are much better quality
      const similar = await tmdbService.getTVRecommendations(Number(id));
      return res.json(similar);
    } catch (error: any) {
      logger.error('Similar TV error:', error);
      if (error.message?.includes('TMDB API key')) {
        return res.status(503).json({ error: 'TMDB API not configured' });
      }
      return res.status(500).json({ error: 'Failed to get similar TV shows' });
    }
  }

  /**
   * Lookup a TV show by TVDB ID - returns TMDB-formatted result for import
   * Prefers TMDB data (English names) over direct TVDB (original language)
   */
  static async getTVDBLookup(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tvdbId = Number(id);
      
      if (!tvdbId || isNaN(tvdbId)) {
        return res.status(400).json({ error: 'Valid TVDB ID required' });
      }

      logger.info(`[TVDB] Looking up series by TVDB ID: ${tvdbId}`);

      // First try TMDB lookup by external ID - this gives us English names and proper poster paths
      try {
        const tmdbResult = await tmdbService.findByExternalId(tvdbId, 'tvdb_id');
        if (tmdbResult?.tv_results?.length > 0) {
          const show = tmdbResult.tv_results[0];
          const year = show.first_air_date ? new Date(show.first_air_date).getFullYear() : null;
          logger.info(`[TVDB] Found on TMDB: ${show.name} (${year})`);
          return res.json({
            id: show.id, // Use TMDB ID
            tmdb_id: show.id,
            tvdb_id: tvdbId,
            name: show.name,
            original_name: show.original_name,
            first_air_date: show.first_air_date,
            poster_path: show.poster_path,
            overview: show.overview,
            year: year,
            source: 'tmdb'
          });
        }
      } catch (tmdbError) {
        logger.warn('[TVDB] TMDB external ID lookup failed:', tmdbError);
      }

      // Fall back to direct TVDB lookup if TMDB doesn't have it
      try {
        const tvdbDetails = await tvdbService.getSeriesDetails(tvdbId);
        
        if (tvdbDetails) {
          const year = tvdbDetails.year ? parseInt(tvdbDetails.year) : 
                       (tvdbDetails.firstAired ? new Date(tvdbDetails.firstAired).getFullYear() : null);
          
          // Use English name if available, otherwise use original name
          const englishName = (tvdbDetails as any).nameEnglish || tvdbDetails.name;
          const englishOverview = (tvdbDetails as any).overviewEnglish || tvdbDetails.overview;
          
          // Return in a TMDB-compatible format
          const result = {
            id: tvdbId, // Use TVDB ID as the ID when no TMDB match
            tvdb_id: tvdbId,
            name: englishName,
            original_name: tvdbDetails.name,
            first_air_date: tvdbDetails.firstAired,
            poster_path: null, // TVDB posters don't work with TMDB path format
            poster_url: tvdbDetails.image, // Full URL for TVDB images
            overview: englishOverview,
            year: year,
            source: 'tvdb'
          };
          
          logger.info(`[TVDB] Found via TVDB API: ${result.name} (${result.year})`);
          return res.json(result);
        }
      } catch (tvdbError) {
        logger.warn('[TVDB] Direct TVDB lookup failed:', tvdbError);
      }

      return res.status(404).json({ error: 'Series not found' });
    } catch (error: any) {
      logger.error('TVDB lookup error:', error);
      return res.status(500).json({ error: 'Failed to lookup TVDB ID' });
    }
  }

  static async searchMovieReleases(req: Request, res: Response) {
    try {
      const { title, year } = req.query;
      logger.info(`[API] Movie release search request: title="${title}" year="${year}"`);

      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title required' });
      }

      // Prevent caching of search results
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');

      // Interactive/manual searches use 'interactive' to respect indexer settings
      const releases = await indexerService.searchMovie(
        title,
        year ? parseInt(year as string) : undefined,
        'interactive'
      );

      logger.info(`[API] Returning ${releases.length} movie releases`);
      return res.json(releases);
    } catch (error: any) {
      logger.error('Movie release search error:', error);
      return res.status(500).json({ error: 'Failed to search releases' });
    }
  }

  static async searchTVReleases(req: Request, res: Response) {
    try {
      const { title, season, episode } = req.query;
      logger.info(`[API] TV release search request: title="${title}" season="${season}" episode="${episode}"`);

      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title required' });
      }

      // Prevent caching of search results
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');

      // Interactive/manual searches use 'interactive' to respect indexer settings
      const releases = await indexerService.searchTV(
        title,
        season ? parseInt(season as string) : undefined,
        episode ? parseInt(episode as string) : undefined,
        'interactive'
      );

      logger.info(`[API] Returning ${releases.length} TV releases`);
      return res.json(releases);
    } catch (error: any) {
      logger.error('TV release search error:', error);
      return res.status(500).json({ error: 'Failed to search releases' });
    }
  }

  // Get person/actor details
  static async getPersonDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const details = await tmdbService.getPersonDetails(Number(id));
      return res.json(details);
    } catch (error: any) {
      logger.error('Person details error:', error);
      return res.status(500).json({ error: 'Failed to get person details' });
    }
  }
}
