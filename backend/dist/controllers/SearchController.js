"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchController = void 0;
const tmdb_1 = require("../services/tmdb");
const tvdb_1 = require("../services/tvdb");
const indexer_1 = require("../services/indexer");
const omdb_1 = require("../services/omdb");
const logger_1 = __importDefault(require("../config/logger"));
class SearchController {
    static async searchAll(req, res) {
        try {
            const { query, page = 1 } = req.query;
            if (!query || typeof query !== 'string') {
                return res.status(400).json({ error: 'Search query required' });
            }
            const results = await tmdb_1.tmdbService.searchMulti(query, Number(page));
            return res.json(results);
        }
        catch (error) {
            logger_1.default.error('Search error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Search failed' });
        }
    }
    static async searchMovies(req, res) {
        try {
            const { query, page = 1, year } = req.query;
            if (!query || typeof query !== 'string') {
                return res.status(400).json({ error: 'Search query required' });
            }
            // Check if query is a TMDB ID (all digits)
            if (/^\d+$/.test(query.trim())) {
                const tmdbId = parseInt(query.trim());
                try {
                    const movie = await tmdb_1.tmdbService.getMovieDetails(tmdbId);
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
                }
                catch (err) {
                    // If lookup by ID fails, fall through to text search
                    logger_1.default.debug(`TMDB ID lookup failed for ${tmdbId}, trying text search`);
                }
            }
            const yearNum = year ? parseInt(String(year)) : undefined;
            const results = await tmdb_1.tmdbService.searchMovies(query, Number(page), yearNum);
            return res.json(results);
        }
        catch (error) {
            logger_1.default.error('Movie search error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Search failed' });
        }
    }
    /**
     * Search TV shows - Uses TMDB for English names and working posters
     */
    static async searchTV(req, res) {
        try {
            const { query, page = 1 } = req.query;
            if (!query || typeof query !== 'string') {
                return res.status(400).json({ error: 'Search query required' });
            }
            // Check if query is a TMDB ID (all digits)
            if (/^\d+$/.test(query.trim())) {
                const tmdbId = parseInt(query.trim());
                try {
                    const show = await tmdb_1.tmdbService.getTVDetails(tmdbId);
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
                }
                catch (err) {
                    // If lookup by ID fails, fall through to text search
                    logger_1.default.debug(`TMDB TV ID lookup failed for ${tmdbId}, trying text search`);
                }
            }
            // Use TMDB for TV search (English titles, working posters)
            const results = await tmdb_1.tmdbService.searchTV(query, Number(page));
            return res.json(results);
        }
        catch (error) {
            logger_1.default.error('TV search error:', error);
            if (error.message?.includes('API key')) {
                return res.status(503).json({ error: 'API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Search failed' });
        }
    }
    static async getTrending(req, res) {
        try {
            const { type = 'all', timeWindow = 'week' } = req.query;
            const window = timeWindow === 'day' ? 'day' : 'week';
            let results;
            if (type === 'movie') {
                results = await tmdb_1.tmdbService.getTrendingMovies(window);
            }
            else if (type === 'tv') {
                results = await tmdb_1.tmdbService.getTrendingTV(window);
            }
            else {
                // Combine movies and TV for 'all' type
                const [movies, tv] = await Promise.all([
                    tmdb_1.tmdbService.getTrendingMovies(window),
                    tmdb_1.tmdbService.getTrendingTV(window)
                ]);
                // Combine and sort by popularity, adding media_type
                const combined = [
                    ...(movies?.results || []).map((m) => ({ ...m, media_type: 'movie' })),
                    ...(tv?.results || []).map((t) => ({ ...t, media_type: 'tv' }))
                ].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
                results = { results: combined };
            }
            return res.json(results);
        }
        catch (error) {
            logger_1.default.error('Trending error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Failed to get trending' });
        }
    }
    static async getPopular(req, res) {
        try {
            const { type = 'all', page = 1 } = req.query;
            let results;
            if (type === 'movie') {
                results = await tmdb_1.tmdbService.getPopularMovies(Number(page));
            }
            else if (type === 'tv') {
                results = await tmdb_1.tmdbService.getPopularTV(Number(page));
            }
            else {
                const [movies, tv] = await Promise.all([
                    tmdb_1.tmdbService.getPopularMovies(Number(page)),
                    tmdb_1.tmdbService.getPopularTV(Number(page))
                ]);
                results = { movies, tv };
            }
            return res.json(results);
        }
        catch (error) {
            logger_1.default.error('Popular error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Failed to get popular' });
        }
    }
    static async getTopRated(req, res) {
        try {
            const { type = 'movie', page = 1 } = req.query;
            let results;
            if (type === 'movie') {
                results = await tmdb_1.tmdbService.getTopRatedMovies(Number(page));
            }
            else if (type === 'tv') {
                results = await tmdb_1.tmdbService.getTopRatedTV(Number(page));
            }
            else {
                const [movies, tv] = await Promise.all([
                    tmdb_1.tmdbService.getTopRatedMovies(Number(page)),
                    tmdb_1.tmdbService.getTopRatedTV(Number(page))
                ]);
                results = { movies, tv };
            }
            return res.json(results);
        }
        catch (error) {
            logger_1.default.error('Top rated error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Failed to get top rated' });
        }
    }
    static async getUpcoming(req, res) {
        try {
            const { page = 1, type = 'movie' } = req.query;
            if (type === 'tv') {
                const results = await tmdb_1.tmdbService.getUpcomingTV(Number(page));
                return res.json(results);
            }
            // Get upcoming movies and filter to only show future releases
            const results = await tmdb_1.tmdbService.getUpcomingMovies(Number(page));
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            if (results?.results) {
                results.results = results.results.filter((movie) => {
                    // Only include movies with release dates in the future
                    return movie.release_date && movie.release_date > today;
                });
            }
            return res.json(results);
        }
        catch (error) {
            logger_1.default.error('Upcoming error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Failed to get upcoming' });
        }
    }
    static async discover(req, res) {
        try {
            const { type = 'movie', page = 1, sort_by = 'popularity.desc' } = req.query;
            // Extract filter parameters
            const filters = {};
            if (req.query.genres)
                filters.genres = String(req.query.genres).split(',').map(Number);
            if (req.query.release_date_from)
                filters.releaseDateFrom = String(req.query.release_date_from);
            if (req.query.release_date_to)
                filters.releaseDateTo = String(req.query.release_date_to);
            if (req.query.language)
                filters.language = String(req.query.language);
            if (req.query.runtime_min)
                filters.runtimeMin = Number(req.query.runtime_min);
            if (req.query.runtime_max)
                filters.runtimeMax = Number(req.query.runtime_max);
            if (req.query.vote_average_min)
                filters.voteAverageMin = Number(req.query.vote_average_min);
            if (req.query.vote_average_max)
                filters.voteAverageMax = Number(req.query.vote_average_max);
            if (req.query.vote_count_min)
                filters.voteCountMin = Number(req.query.vote_count_min);
            if (req.query.vote_count_max)
                filters.voteCountMax = Number(req.query.vote_count_max);
            if (req.query.certifications)
                filters.certifications = String(req.query.certifications).split(',');
            if (req.query.keywords)
                filters.keywords = String(req.query.keywords).split(',').map(Number);
            if (req.query.exclude_keywords)
                filters.excludeKeywords = String(req.query.exclude_keywords).split(',').map(Number);
            if (req.query.companies)
                filters.companies = String(req.query.companies).split(',').map(Number);
            if (req.query.networks)
                filters.networks = String(req.query.networks).split(',').map(Number);
            let results;
            if (type === 'movie') {
                results = await tmdb_1.tmdbService.discoverMovies(Number(page), String(sort_by), filters);
            }
            else {
                results = await tmdb_1.tmdbService.discoverTV(Number(page), String(sort_by), filters);
            }
            return res.json(results);
        }
        catch (error) {
            logger_1.default.error('Discover error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Failed to discover content' });
        }
    }
    static async getGenres(req, res) {
        try {
            const { type = 'movie' } = req.query;
            const results = type === 'movie'
                ? await tmdb_1.tmdbService.getMovieGenres()
                : await tmdb_1.tmdbService.getTVGenres();
            return res.json(results);
        }
        catch (error) {
            logger_1.default.error('Genres error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured.' });
            }
            return res.status(500).json({ error: 'Failed to get genres' });
        }
    }
    static async getLanguages(req, res) {
        try {
            const results = await tmdb_1.tmdbService.getLanguages();
            return res.json(results);
        }
        catch (error) {
            logger_1.default.error('Languages error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured.' });
            }
            return res.status(500).json({ error: 'Failed to get languages' });
        }
    }
    static async searchKeywords(req, res) {
        try {
            const { query } = req.query;
            if (!query)
                return res.json({ results: [] });
            const results = await tmdb_1.tmdbService.searchKeywords(String(query));
            return res.json(results);
        }
        catch (error) {
            logger_1.default.error('Keywords search error:', error);
            return res.status(500).json({ error: 'Failed to search keywords' });
        }
    }
    static async searchCompanies(req, res) {
        try {
            const { query } = req.query;
            if (!query)
                return res.json({ results: [] });
            const results = await tmdb_1.tmdbService.searchCompanies(String(query));
            return res.json(results);
        }
        catch (error) {
            logger_1.default.error('Companies search error:', error);
            return res.status(500).json({ error: 'Failed to search companies' });
        }
    }
    static async getMovieDetails(req, res) {
        try {
            const { id } = req.params;
            const details = await tmdb_1.tmdbService.getMovieDetails(Number(id));
            // Extract certification from release_dates
            const certification = tmdb_1.TMDBService.extractCertification(details);
            if (certification) {
                details.certification = certification;
            }
            // If OMDB API is configured and we have an IMDB ID, fetch IMDB rating
            if (details.imdb_id) {
                try {
                    const imdbRating = await omdb_1.omdbService.getIMDBRating(details.imdb_id);
                    if (imdbRating) {
                        details.imdb_rating = imdbRating.rating;
                        details.imdb_votes = imdbRating.votes;
                        details.metascore = imdbRating.metascore;
                    }
                }
                catch (e) {
                    // Silently fail - IMDB rating is optional
                    logger_1.default.debug('Failed to fetch IMDB rating:', e);
                }
            }
            return res.json(details);
        }
        catch (error) {
            logger_1.default.error('Movie details error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Failed to get movie details' });
        }
    }
    static async getTVDetails(req, res) {
        try {
            const { id } = req.params;
            const details = await tmdb_1.tmdbService.getTVDetails(Number(id));
            // Extract content rating from content_ratings
            if (details.content_ratings?.results) {
                const usRating = details.content_ratings.results.find((r) => r.iso_3166_1 === 'US');
                if (usRating?.rating) {
                    details.certification = usRating.rating;
                }
                else if (details.content_ratings.results.length > 0) {
                    // Fallback to first available rating
                    const firstRating = details.content_ratings.results.find((r) => r.rating);
                    if (firstRating?.rating) {
                        details.certification = firstRating.rating;
                    }
                }
            }
            return res.json(details);
        }
        catch (error) {
            logger_1.default.error('TV details error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Failed to get TV details' });
        }
    }
    static async getMovieCredits(req, res) {
        try {
            const { id } = req.params;
            const credits = await tmdb_1.tmdbService.getMovieCredits(Number(id));
            return res.json(credits);
        }
        catch (error) {
            logger_1.default.error('Movie credits error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Failed to get movie credits' });
        }
    }
    static async getTVCredits(req, res) {
        try {
            const { id } = req.params;
            const credits = await tmdb_1.tmdbService.getTVCredits(Number(id));
            return res.json(credits);
        }
        catch (error) {
            logger_1.default.error('TV credits error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Failed to get TV credits' });
        }
    }
    static async getSeasonDetails(req, res) {
        try {
            const { id, seasonNumber } = req.params;
            const details = await tmdb_1.tmdbService.getSeasonDetails(Number(id), Number(seasonNumber));
            return res.json(details);
        }
        catch (error) {
            logger_1.default.error('Season details error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured. Please contact admin to set API key in settings.' });
            }
            return res.status(500).json({ error: 'Failed to get season details' });
        }
    }
    static async getSimilarMovies(req, res) {
        try {
            const { id } = req.params;
            // Use recommendations instead of similar - TMDB recommendations are much better quality
            const similar = await tmdb_1.tmdbService.getMovieRecommendations(Number(id));
            return res.json(similar);
        }
        catch (error) {
            logger_1.default.error('Similar movies error:', error);
            if (error.message?.includes('TMDB API key')) {
                return res.status(503).json({ error: 'TMDB API not configured' });
            }
            return res.status(500).json({ error: 'Failed to get similar movies' });
        }
    }
    static async getSimilarTV(req, res) {
        try {
            const { id } = req.params;
            // Use recommendations instead of similar - TMDB recommendations are much better quality
            const similar = await tmdb_1.tmdbService.getTVRecommendations(Number(id));
            return res.json(similar);
        }
        catch (error) {
            logger_1.default.error('Similar TV error:', error);
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
    static async getTVDBLookup(req, res) {
        try {
            const { id } = req.params;
            const tvdbId = Number(id);
            if (!tvdbId || isNaN(tvdbId)) {
                return res.status(400).json({ error: 'Valid TVDB ID required' });
            }
            logger_1.default.info(`[TVDB] Looking up series by TVDB ID: ${tvdbId}`);
            // First try TMDB lookup by external ID - this gives us English names and proper poster paths
            try {
                const tmdbResult = await tmdb_1.tmdbService.findByExternalId(tvdbId, 'tvdb_id');
                if (tmdbResult?.tv_results?.length > 0) {
                    const show = tmdbResult.tv_results[0];
                    const year = show.first_air_date ? new Date(show.first_air_date).getFullYear() : null;
                    logger_1.default.info(`[TVDB] Found on TMDB: ${show.name} (${year})`);
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
            }
            catch (tmdbError) {
                logger_1.default.warn('[TVDB] TMDB external ID lookup failed:', tmdbError);
            }
            // Fall back to direct TVDB lookup if TMDB doesn't have it
            try {
                const tvdbDetails = await tvdb_1.tvdbService.getSeriesDetails(tvdbId);
                if (tvdbDetails) {
                    const year = tvdbDetails.year ? parseInt(tvdbDetails.year) :
                        (tvdbDetails.firstAired ? new Date(tvdbDetails.firstAired).getFullYear() : null);
                    // Use English name if available, otherwise use original name
                    const englishName = tvdbDetails.nameEnglish || tvdbDetails.name;
                    const englishOverview = tvdbDetails.overviewEnglish || tvdbDetails.overview;
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
                    logger_1.default.info(`[TVDB] Found via TVDB API: ${result.name} (${result.year})`);
                    return res.json(result);
                }
            }
            catch (tvdbError) {
                logger_1.default.warn('[TVDB] Direct TVDB lookup failed:', tvdbError);
            }
            return res.status(404).json({ error: 'Series not found' });
        }
        catch (error) {
            logger_1.default.error('TVDB lookup error:', error);
            return res.status(500).json({ error: 'Failed to lookup TVDB ID' });
        }
    }
    static async searchMovieReleases(req, res) {
        try {
            const { title, year } = req.query;
            logger_1.default.info(`[API] Movie release search request: title="${title}" year="${year}"`);
            if (!title || typeof title !== 'string') {
                return res.status(400).json({ error: 'Title required' });
            }
            // Prevent caching of search results
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.set('Pragma', 'no-cache');
            // Interactive/manual searches use 'interactive' to respect indexer settings
            const releases = await indexer_1.indexerService.searchMovie(title, year ? parseInt(year) : undefined, 'interactive');
            logger_1.default.info(`[API] Returning ${releases.length} movie releases`);
            return res.json(releases);
        }
        catch (error) {
            logger_1.default.error('Movie release search error:', error);
            return res.status(500).json({ error: 'Failed to search releases' });
        }
    }
    static async searchTVReleases(req, res) {
        try {
            const { title, season, episode } = req.query;
            logger_1.default.info(`[API] TV release search request: title="${title}" season="${season}" episode="${episode}"`);
            if (!title || typeof title !== 'string') {
                return res.status(400).json({ error: 'Title required' });
            }
            // Prevent caching of search results
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.set('Pragma', 'no-cache');
            // Interactive/manual searches use 'interactive' to respect indexer settings
            const releases = await indexer_1.indexerService.searchTV(title, season ? parseInt(season) : undefined, episode ? parseInt(episode) : undefined, 'interactive');
            logger_1.default.info(`[API] Returning ${releases.length} TV releases`);
            return res.json(releases);
        }
        catch (error) {
            logger_1.default.error('TV release search error:', error);
            return res.status(500).json({ error: 'Failed to search releases' });
        }
    }
    // Get person/actor details
    static async getPersonDetails(req, res) {
        try {
            const { id } = req.params;
            const details = await tmdb_1.tmdbService.getPersonDetails(Number(id));
            return res.json(details);
        }
        catch (error) {
            logger_1.default.error('Person details error:', error);
            return res.status(500).json({ error: 'Failed to get person details' });
        }
    }
}
exports.SearchController = SearchController;
//# sourceMappingURL=SearchController.js.map