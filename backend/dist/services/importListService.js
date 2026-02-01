"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importListService = exports.ImportListService = void 0;
const axios_1 = __importDefault(require("axios"));
const ImportList_1 = require("../models/ImportList");
const Movie_1 = require("../models/Movie");
const TVSeries_1 = require("../models/TVSeries");
const Exclusion_1 = require("../models/Exclusion");
const ActivityLog_1 = require("../models/ActivityLog");
const logger_1 = __importDefault(require("../config/logger"));
const database_1 = __importDefault(require("../config/database"));
class ImportListService {
    static getInstance() {
        if (!ImportListService.instance) {
            ImportListService.instance = new ImportListService();
        }
        return ImportListService.instance;
    }
    getApiKey() {
        // Try to get from database first
        try {
            const stmt = database_1.default.prepare('SELECT value FROM system_settings WHERE key = ?');
            const result = stmt.get('tmdb_api_key');
            if (result?.value) {
                return result.value;
            }
        }
        catch (error) {
            // Database might not be initialized yet, fall back to env
        }
        // Fall back to environment variable
        return process.env.TMDB_API_KEY || '';
    }
    // Fetch items from a specific list
    async fetchListItems(list) {
        try {
            switch (list.type) {
                case 'imdb':
                    return await this.fetchIMDbList(list);
                case 'trakt':
                    return await this.fetchTraktList(list);
                case 'stevenlu':
                    return await this.fetchStevenLuList(list);
                case 'tmdb':
                    return await this.fetchTMDbList(list);
                case 'youtube':
                    return await this.fetchYouTubeList(list);
                default:
                    logger_1.default.warn(`Unknown list type: ${list.type}`);
                    return [];
            }
        }
        catch (error) {
            logger_1.default.error(`Failed to fetch list items for ${list.name}: ${error.message}`);
            return [];
        }
    }
    // Fetch from IMDb lists (via scraping)
    async fetchIMDbList(list) {
        const listId = list.list_id || '';
        // For preset lists, use TMDB equivalent with English filter
        if (listId === 'top250') {
            return await this.fetchTMDbTopRated(list.media_type, true); // true = English only
        }
        if (listId === 'popular' || listId === 'boxoffice') {
            return await this.fetchTMDbPopular(list.media_type, true);
        }
        // For custom IMDb list IDs (ls123456789)
        if (listId.startsWith('ls')) {
            return await this.scrapeIMDbList(listId, list.media_type);
        }
        // For user watchlists (ur123456789)
        if (listId.startsWith('ur')) {
            logger_1.default.warn(`IMDb user watchlists (${listId}) require authentication - not supported`);
            return [];
        }
        // Try to search by list name (e.g., "Upcoming Movies 2026")
        if (listId) {
            return await this.searchIMDbListByName(listId, list.media_type);
        }
        return [];
    }
    // Scrape IMDb list page
    async scrapeIMDbList(listId, mediaType) {
        try {
            logger_1.default.info(`Scraping IMDb list: ${listId}`);
            const url = `https://www.imdb.com/list/${listId}/`;
            const response = await axios_1.default.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                },
                timeout: 15000
            });
            const items = [];
            const html = response.data;
            // Extract IMDb IDs from the list page using regex
            // Look for patterns like /title/tt1234567/
            const imdbIdPattern = /\/title\/(tt\d{7,})\//g;
            const matches = html.matchAll(imdbIdPattern);
            const seenIds = new Set();
            for (const match of matches) {
                const imdbId = match[1];
                if (!seenIds.has(imdbId)) {
                    seenIds.add(imdbId);
                    // Extract title if available nearby in HTML
                    // Try to find the title from the JSON-LD or list item data
                    items.push({
                        imdb_id: imdbId,
                        title: '', // Will be populated when syncing via TMDB lookup
                        media_type: mediaType
                    });
                }
            }
            logger_1.default.info(`Found ${items.length} items from IMDb list ${listId}`);
            return items.slice(0, 100); // Limit to first 100
        }
        catch (error) {
            logger_1.default.error(`Failed to scrape IMDb list ${listId}: ${error.message}`);
            return [];
        }
    }
    // Search for IMDb list by name using TMDB discover
    async searchIMDbListByName(searchTerm, mediaType) {
        try {
            logger_1.default.info(`Searching for movies matching: ${searchTerm}`);
            // Parse year from search term if present (e.g., "Upcoming Movies 2026")
            const yearMatch = searchTerm.match(/20\d{2}/);
            const year = yearMatch ? parseInt(yearMatch[0]) : null;
            // Use TMDB discover with date filters
            const isUpcoming = searchTerm.toLowerCase().includes('upcoming');
            const currentDate = new Date().toISOString().split('T')[0];
            if (mediaType === 'movie') {
                const params = {
                    api_key: this.getApiKey(),
                    with_original_language: 'en',
                    sort_by: isUpcoming ? 'primary_release_date.asc' : 'popularity.desc',
                    page: 1
                };
                if (isUpcoming && year) {
                    params['primary_release_date.gte'] = `${year}-01-01`;
                    params['primary_release_date.lte'] = `${year}-12-31`;
                }
                else if (isUpcoming) {
                    params['primary_release_date.gte'] = currentDate;
                }
                const items = [];
                // Fetch up to 5 pages
                for (let page = 1; page <= 5; page++) {
                    params.page = page;
                    const response = await axios_1.default.get('https://api.themoviedb.org/3/discover/movie', {
                        params,
                        timeout: 10000
                    });
                    for (const item of response.data.results) {
                        // Only include English language movies
                        if (item.original_language === 'en') {
                            items.push({
                                tmdb_id: item.id,
                                title: item.title,
                                year: parseInt((item.release_date || '').split('-')[0]) || undefined,
                                media_type: 'movie'
                            });
                        }
                    }
                    if (response.data.results.length < 20)
                        break;
                }
                logger_1.default.info(`Found ${items.length} movies for "${searchTerm}"`);
                return items;
            }
            return [];
        }
        catch (error) {
            logger_1.default.error(`Failed to search for list "${searchTerm}": ${error.message}`);
            return [];
        }
    }
    // Fetch from Trakt lists
    async fetchTraktList(list) {
        const listId = list.list_id || '';
        const mediaType = list.media_type;
        // Trakt API would require API key
        // For now, use TMDB equivalent for trending/popular
        if (listId === 'trending' || listId === 'popular') {
            return await this.fetchTMDbPopular(mediaType);
        }
        if (listId === 'anticipated') {
            return await this.fetchTMDbUpcoming(mediaType);
        }
        return [];
    }
    // Fetch from StevenLu list (free API)
    async fetchStevenLuList(list) {
        try {
            const response = await axios_1.default.get('https://s3.amazonaws.com/popular-movies/movies.json', {
                timeout: 10000
            });
            const items = response.data.map((item) => ({
                imdb_id: item.imdb_id,
                title: item.title,
                year: item.year,
                media_type: 'movie'
            }));
            return items;
        }
        catch (error) {
            logger_1.default.error(`Failed to fetch StevenLu list: ${error.message}`);
            return [];
        }
    }
    // Fetch from YouTube trailer channels
    async fetchYouTubeList(list) {
        const listId = list.list_id || '';
        if (!listId) {
            logger_1.default.warn('No YouTube playlist ID provided');
            return [];
        }
        try {
            // Use RSS feed with playlist_id (format: UULFxxxxxxx for uploads playlist)
            const items = await this.fetchYouTubeRSS(listId);
            if (items.length > 0) {
                return items;
            }
            // Fallback: try scraping the channel page
            // Convert playlist ID back to channel ID if needed (UULF -> UC)
            let channelId = listId;
            if (listId.startsWith('UULF')) {
                channelId = 'UC' + listId.substring(4);
            }
            return await this.scrapeYouTubeChannel(channelId);
        }
        catch (error) {
            logger_1.default.error(`Failed to fetch YouTube list ${listId}: ${error.message}`);
            return [];
        }
    }
    // Scrape YouTube channel videos page
    async scrapeYouTubeChannel(channelId) {
        try {
            // Try different URL formats
            let html = '';
            const urls = [
                `https://www.youtube.com/channel/${channelId}/videos`,
                `https://www.youtube.com/@${channelId}/videos`,
                `https://www.youtube.com/c/${channelId}/videos`,
                `https://www.youtube.com/${channelId}/videos`
            ];
            for (const url of urls) {
                try {
                    logger_1.default.info(`Trying YouTube URL: ${url}`);
                    const response = await axios_1.default.get(url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5'
                        },
                        timeout: 15000
                    });
                    if (response.status === 200) {
                        html = response.data;
                        logger_1.default.info(`Successfully fetched: ${url}`);
                        break;
                    }
                }
                catch (e) {
                    // Try next URL
                    continue;
                }
            }
            if (!html) {
                logger_1.default.warn(`Could not fetch YouTube channel: ${channelId}`);
                return [];
            }
            const items = [];
            const seenTitles = new Set();
            // Extract video titles from the page using multiple patterns
            // YouTube embeds video data in JSON within the page
            const titlePatterns = [
                /"title":\s*\{\s*"runs":\s*\[\s*\{\s*"text":\s*"([^"]+)"/g,
                /"title":\s*\{\s*"simpleText":\s*"([^"]+)"/g,
                /"videoRenderer"[\s\S]*?"title"[\s\S]*?"text":\s*"([^"]+)"/g,
            ];
            const allTitles = [];
            for (const pattern of titlePatterns) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    allTitles.push(match[1]);
                }
            }
            // Deduplicate titles
            const uniqueTitles = [...new Set(allTitles)];
            logger_1.default.info(`Found ${uniqueTitles.length} video titles from YouTube page`);
            for (const rawTitle of uniqueTitles) {
                // Skip non-trailer content (but be more lenient)
                const lowerTitle = rawTitle.toLowerCase();
                if (!lowerTitle.includes('trailer') &&
                    !lowerTitle.includes('teaser') &&
                    !lowerTitle.includes('clip') &&
                    !lowerTitle.includes('promo') &&
                    !lowerTitle.includes('sneak peek') &&
                    !lowerTitle.includes('first look')) {
                    continue;
                }
                const movieInfo = this.parseMovieTitleFromTrailer(rawTitle);
                if (movieInfo && !seenTitles.has(movieInfo.title.toLowerCase())) {
                    seenTitles.add(movieInfo.title.toLowerCase());
                    // Search TMDB for this movie
                    const tmdbResult = await this.searchTMDbForMovie(movieInfo.title, movieInfo.year);
                    if (tmdbResult) {
                        items.push({
                            tmdb_id: tmdbResult.id,
                            title: tmdbResult.title,
                            year: tmdbResult.year,
                            media_type: 'movie'
                        });
                        // Small delay to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                    // Limit to 50 movies
                    if (items.length >= 50)
                        break;
                }
            }
            logger_1.default.info(`Found ${items.length} movies from YouTube channel ${channelId}`);
            return items;
        }
        catch (error) {
            logger_1.default.error(`Failed to scrape YouTube channel ${channelId}: ${error.message}`);
            return [];
        }
    }
    // Fetch YouTube RSS feed using playlist ID
    async fetchYouTubeRSS(playlistId) {
        try {
            const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
            logger_1.default.info(`Fetching YouTube RSS: ${feedUrl}`);
            const response = await axios_1.default.get(feedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000
            });
            const xml = response.data;
            const items = [];
            const seenTitles = new Set();
            // Parse video titles from RSS feed using regex
            const titlePattern = /<entry>[\s\S]*?<title>([^<]+)<\/title>/g;
            let match;
            while ((match = titlePattern.exec(xml)) !== null) {
                const rawTitle = match[1];
                const movieInfo = this.parseMovieTitleFromTrailer(rawTitle);
                if (movieInfo && !seenTitles.has(movieInfo.title.toLowerCase())) {
                    seenTitles.add(movieInfo.title.toLowerCase());
                    const tmdbResult = await this.searchTMDbForMovie(movieInfo.title, movieInfo.year);
                    if (tmdbResult) {
                        items.push({
                            tmdb_id: tmdbResult.id,
                            title: tmdbResult.title,
                            year: tmdbResult.year,
                            media_type: 'movie'
                        });
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
            }
            logger_1.default.info(`Found ${items.length} movies from YouTube RSS ${playlistId}`);
            return items.slice(0, 50);
        }
        catch (error) {
            logger_1.default.warn(`YouTube RSS failed for ${playlistId}: ${error.message}`);
            return [];
        }
    }
    // Parse movie title from trailer video title
    parseMovieTitleFromTrailer(videoTitle) {
        // Common patterns in trailer titles:
        // "Movie Name (2024) Official Trailer"
        // "MOVIE NAME - Official Trailer (2024)"
        // "Movie Name | Official Trailer | 2024"
        // "Movie Name Trailer (2024)"
        // "Movie Name - Teaser Trailer"
        let title = videoTitle;
        let year;
        // Extract year if present
        const yearMatch = title.match(/\(?(20\d{2})\)?/);
        if (yearMatch) {
            year = parseInt(yearMatch[1]);
        }
        // Remove common trailer keywords and patterns
        const removePatterns = [
            /\s*[-|]\s*official\s*(trailer|teaser|clip|featurette|promo)/gi,
            /\s*[-|]\s*(trailer|teaser|clip|featurette|promo)\s*\d*/gi,
            /\s*official\s*(trailer|teaser|clip|featurette|promo)\s*\d*/gi,
            /\s*(trailer|teaser|clip|featurette|promo)\s*\d*\s*$/gi,
            /\s*\(?(20\d{2})\)?\s*$/gi,
            /\s*[-|]\s*(hd|4k|uhd|imax|dolby)/gi,
            /\s*\[(hd|4k|uhd|new|exclusive)\]/gi,
            /\s*#\d+\s*$/gi,
            /\s*ft\.?\s*[^|]+$/gi,
            /\s*starring\s*[^|]+$/gi,
            /\s*[-|]\s*in\s*cinemas?\s*[^|]*/gi,
            /\s*[-|]\s*coming\s*(soon|this\s*\w+)/gi,
            /\s*[-|]\s*only\s*in\s*theaters?/gi,
        ];
        for (const pattern of removePatterns) {
            title = title.replace(pattern, '');
        }
        // Clean up
        title = title
            .replace(/\s+/g, ' ')
            .replace(/[-|:]\s*$/, '')
            .trim();
        // Skip if title is too short or too long
        if (title.length < 2 || title.length > 100) {
            return null;
        }
        // Skip if title looks like a channel name or non-movie content
        const skipPatterns = [
            /^(subscribe|like|comment|channel|playlist)/i,
            /^(top\s*\d+|best\s*\d+|worst\s*\d+)/i,
            /^(review|reaction|explained|breakdown)/i,
            /compilation/i,
        ];
        for (const pattern of skipPatterns) {
            if (pattern.test(title)) {
                return null;
            }
        }
        return { title, year };
    }
    // Search TMDB for a movie by title and optional year
    async searchTMDbForMovie(title, year) {
        try {
            const params = {
                api_key: this.getApiKey(),
                query: title,
                include_adult: false
            };
            if (year) {
                params.year = year;
            }
            const response = await axios_1.default.get('https://api.themoviedb.org/3/search/movie', {
                params,
                timeout: 10000
            });
            const results = response.data.results;
            if (results && results.length > 0) {
                // Find best match - prefer exact title match with correct year
                let bestMatch = results[0];
                for (const result of results) {
                    const resultYear = result.release_date ? parseInt(result.release_date.split('-')[0]) : null;
                    const titleMatch = result.title.toLowerCase() === title.toLowerCase();
                    const yearMatch = year && resultYear === year;
                    if (titleMatch && yearMatch) {
                        bestMatch = result;
                        break;
                    }
                    else if (yearMatch && !bestMatch.release_date?.startsWith(String(year))) {
                        bestMatch = result;
                    }
                }
                return {
                    id: bestMatch.id,
                    title: bestMatch.title,
                    year: bestMatch.release_date ? parseInt(bestMatch.release_date.split('-')[0]) : undefined
                };
            }
            return null;
        }
        catch (error) {
            logger_1.default.warn(`TMDB search failed for "${title}": ${error.message}`);
            return null;
        }
    }
    // Fetch from TMDB lists
    async fetchTMDbList(list) {
        const listId = list.list_id || '';
        const mediaType = list.media_type;
        switch (listId) {
            case 'popular':
                return await this.fetchTMDbPopular(mediaType);
            case 'top_rated':
                return await this.fetchTMDbTopRated(mediaType);
            case 'now_playing':
            case 'on_the_air':
                return await this.fetchTMDbNowPlaying(mediaType);
            case 'upcoming':
            case 'airing_today':
                return await this.fetchTMDbUpcoming(mediaType);
            default:
                // Try to fetch as a custom list ID
                if (listId && !isNaN(parseInt(listId))) {
                    return await this.fetchTMDbCustomList(parseInt(listId));
                }
                return await this.fetchTMDbPopular(mediaType);
        }
    }
    async fetchTMDbPopular(mediaType, englishOnly = true) {
        try {
            const endpoint = mediaType === 'movie'
                ? 'https://api.themoviedb.org/3/discover/movie'
                : 'https://api.themoviedb.org/3/discover/tv';
            const items = [];
            // Fetch first 3 pages (60 items)
            for (let page = 1; page <= 3; page++) {
                const params = {
                    api_key: this.getApiKey(),
                    page,
                    sort_by: 'popularity.desc'
                };
                if (englishOnly) {
                    params.with_original_language = 'en';
                }
                const response = await axios_1.default.get(endpoint, {
                    params,
                    timeout: 10000
                });
                for (const item of response.data.results) {
                    // Additional filter for English language
                    if (!englishOnly || item.original_language === 'en') {
                        items.push({
                            tmdb_id: item.id,
                            title: item.title || item.name,
                            year: parseInt((item.release_date || item.first_air_date || '').split('-')[0]) || undefined,
                            media_type: mediaType
                        });
                    }
                }
            }
            return items;
        }
        catch (error) {
            logger_1.default.error(`Failed to fetch TMDB popular: ${error.message}`);
            return [];
        }
    }
    async fetchTMDbTopRated(mediaType, englishOnly = true) {
        try {
            const endpoint = mediaType === 'movie'
                ? 'https://api.themoviedb.org/3/discover/movie'
                : 'https://api.themoviedb.org/3/discover/tv';
            const items = [];
            for (let page = 1; page <= 3; page++) {
                const params = {
                    api_key: this.getApiKey(),
                    page,
                    sort_by: 'vote_average.desc',
                    'vote_count.gte': 1000 // Ensure enough votes for reliable rating
                };
                if (englishOnly) {
                    params.with_original_language = 'en';
                }
                const response = await axios_1.default.get(endpoint, {
                    params,
                    timeout: 10000
                });
                for (const item of response.data.results) {
                    if (!englishOnly || item.original_language === 'en') {
                        items.push({
                            tmdb_id: item.id,
                            title: item.title || item.name,
                            year: parseInt((item.release_date || item.first_air_date || '').split('-')[0]) || undefined,
                            media_type: mediaType
                        });
                    }
                }
            }
            return items;
        }
        catch (error) {
            logger_1.default.error(`Failed to fetch TMDB top rated: ${error.message}`);
            return [];
        }
    }
    async fetchTMDbNowPlaying(mediaType, englishOnly = true) {
        try {
            const endpoint = mediaType === 'movie'
                ? 'https://api.themoviedb.org/3/movie/now_playing'
                : 'https://api.themoviedb.org/3/tv/on_the_air';
            const response = await axios_1.default.get(endpoint, {
                params: {
                    api_key: this.getApiKey(),
                    language: 'en-US'
                },
                timeout: 10000
            });
            const items = [];
            for (const item of response.data.results) {
                if (!englishOnly || item.original_language === 'en') {
                    items.push({
                        tmdb_id: item.id,
                        title: item.title || item.name,
                        year: parseInt((item.release_date || item.first_air_date || '').split('-')[0]) || undefined,
                        media_type: mediaType
                    });
                }
            }
            return items;
        }
        catch (error) {
            logger_1.default.error(`Failed to fetch TMDB now playing: ${error.message}`);
            return [];
        }
    }
    async fetchTMDbUpcoming(mediaType, englishOnly = true) {
        try {
            const endpoint = mediaType === 'movie'
                ? 'https://api.themoviedb.org/3/movie/upcoming'
                : 'https://api.themoviedb.org/3/tv/airing_today';
            const response = await axios_1.default.get(endpoint, {
                params: {
                    api_key: this.getApiKey(),
                    language: 'en-US'
                },
                timeout: 10000
            });
            const items = [];
            for (const item of response.data.results) {
                if (!englishOnly || item.original_language === 'en') {
                    items.push({
                        tmdb_id: item.id,
                        title: item.title || item.name,
                        year: parseInt((item.release_date || item.first_air_date || '').split('-')[0]) || undefined,
                        media_type: mediaType
                    });
                }
            }
            return items;
        }
        catch (error) {
            logger_1.default.error(`Failed to fetch TMDB upcoming: ${error.message}`);
            return [];
        }
    }
    async fetchTMDbCustomList(listId) {
        try {
            const response = await axios_1.default.get(`https://api.themoviedb.org/3/list/${listId}`, {
                params: { api_key: this.getApiKey() },
                timeout: 10000
            });
            return response.data.items.map((item) => ({
                tmdb_id: item.id,
                title: item.title || item.name,
                year: parseInt((item.release_date || item.first_air_date || '').split('-')[0]) || undefined,
                media_type: item.media_type
            }));
        }
        catch (error) {
            logger_1.default.error(`Failed to fetch TMDB custom list ${listId}: ${error.message}`);
            return [];
        }
    }
    // Look up TMDB ID from IMDb ID
    async getTmdbIdFromImdb(imdbId, mediaType) {
        try {
            const { tmdbService } = require('./tmdb');
            const result = await tmdbService.findByExternalId(imdbId, 'imdb_id');
            if (mediaType === 'movie' && result?.movie_results?.length > 0) {
                return result.movie_results[0].id;
            }
            else if (mediaType === 'tv' && result?.tv_results?.length > 0) {
                return result.tv_results[0].id;
            }
            return null;
        }
        catch (error) {
            logger_1.default.error(`Failed to look up TMDB ID for IMDb ${imdbId}: ${error.message}`);
            return null;
        }
    }
    // Sync a list - fetch items and add new ones to library
    async syncList(list) {
        const results = { added: 0, existing: 0, failed: 0 };
        const { tmdbService } = require('./tmdb');
        const { fileNamingService } = require('./fileNaming');
        try {
            logger_1.default.info(`[ImportList] Syncing: ${list.name}`);
            const items = await this.fetchListItems(list);
            logger_1.default.info(`[ImportList] Found ${items.length} items in ${list.name}`);
            for (const item of items) {
                try {
                    // Get TMDB ID - either directly or by looking up from IMDb ID
                    let tmdbId = item.tmdb_id;
                    if (!tmdbId && item.imdb_id) {
                        tmdbId = await this.getTmdbIdFromImdb(item.imdb_id, list.media_type) || undefined;
                        if (!tmdbId) {
                            logger_1.default.warn(`[ImportList] Could not find TMDB ID for ${item.title} (IMDb: ${item.imdb_id})`);
                            results.failed++;
                            continue;
                        }
                    }
                    if (!tmdbId) {
                        logger_1.default.warn(`[ImportList] No TMDB ID available for ${item.title}`);
                        results.failed++;
                        continue;
                    }
                    if (list.media_type === 'movie') {
                        // Check if movie already exists
                        const existing = Movie_1.MovieModel.findByTmdbId(tmdbId);
                        if (existing) {
                            results.existing++;
                            continue;
                        }
                        // Check if movie is in exclusion list
                        if (Exclusion_1.ExclusionModel.isExcluded(tmdbId, 'movie')) {
                            logger_1.default.debug(`[ImportList] Skipping excluded movie: ${item.title} (TMDB: ${tmdbId})`);
                            continue;
                        }
                        if (!list.enable_auto_add) {
                            continue;
                        }
                        // Fetch full movie details from TMDB
                        const tmdbData = await tmdbService.getMovieDetails(tmdbId);
                        if (!tmdbData) {
                            logger_1.default.warn(`[ImportList] Could not fetch TMDB details for movie ${tmdbId}`);
                            results.failed++;
                            continue;
                        }
                        // Build folder path
                        const rootFolder = list.root_folder || '/data/media/movies';
                        const movieYear = tmdbData.release_date ? parseInt(tmdbData.release_date.split('-')[0]) : item.year;
                        const folderName = fileNamingService.generateMovieFolderName({ title: tmdbData.title, year: movieYear, tmdbId });
                        const folderPath = `${rootFolder}/${folderName}`;
                        // Create the movie
                        const movie = Movie_1.MovieModel.create({
                            tmdb_id: tmdbId,
                            title: tmdbData.title,
                            year: movieYear,
                            overview: tmdbData.overview,
                            runtime: tmdbData.runtime,
                            vote_average: tmdbData.vote_average,
                            vote_count: tmdbData.vote_count,
                            poster_path: tmdbData.poster_path,
                            backdrop_path: tmdbData.backdrop_path,
                            folder_path: folderPath,
                            quality_profile_id: list.quality_profile_id || undefined,
                            monitored: true,
                            has_file: false
                        });
                        logger_1.default.info(`[ImportList] Added movie: ${movie.title} (${movieYear})`);
                        results.added++;
                        // Log activity
                        ActivityLog_1.ActivityLogModel.logMovieEvent(movie.id, ActivityLog_1.EVENT_TYPES.ADDED, `${movie.title} (${movieYear || 'N/A'}) added from import list "${list.name}"`, JSON.stringify({
                            source: 'Import List',
                            list_name: list.name,
                            list_type: list.type,
                            tmdb_id: tmdbId,
                            monitored: true
                        }));
                        // Run refresh & scan for the new movie
                        try {
                            const { LibraryScannerController } = require('../controllers/LibraryScannerController');
                            await LibraryScannerController.scanMovieFiles(movie.id, true);
                            logger_1.default.info(`Scanned files for movie: ${movie.title}`);
                        }
                        catch (scanError) {
                            logger_1.default.warn(`Failed to scan files for ${movie.title}: ${scanError.message}`);
                        }
                        // Trigger search if enabled
                        if (list.search_on_add) {
                            try {
                                const { autoSearchService } = require('./autoSearch');
                                await autoSearchService.searchAndDownloadMovie(movie.id);
                                logger_1.default.info(`Triggered search for movie: ${movie.title}`);
                            }
                            catch (searchError) {
                                logger_1.default.warn(`Failed to trigger search for ${movie.title}: ${searchError.message}`);
                            }
                        }
                    }
                    else {
                        // TV Series
                        const existing = TVSeries_1.TVSeriesModel.findByTmdbId(tmdbId);
                        if (existing) {
                            results.existing++;
                            continue;
                        }
                        // Check if series is in exclusion list
                        if (Exclusion_1.ExclusionModel.isExcluded(tmdbId, 'tv')) {
                            logger_1.default.debug(`[ImportList] Skipping excluded series: ${item.title} (TMDB: ${tmdbId})`);
                            continue;
                        }
                        if (!list.enable_auto_add) {
                            continue;
                        }
                        // Fetch full series details from TMDB
                        const tmdbData = await tmdbService.getTVDetails(tmdbId);
                        if (!tmdbData) {
                            logger_1.default.warn(`[ImportList] Could not fetch TMDB details for series ${tmdbId}`);
                            results.failed++;
                            continue;
                        }
                        // Build folder path
                        const rootFolder = list.root_folder || '/data/media/tv';
                        const seriesYear = tmdbData.first_air_date ? parseInt(tmdbData.first_air_date.split('-')[0]) : item.year;
                        const folderName = fileNamingService.generateSeriesFolderName({ title: tmdbData.name, year: seriesYear, tmdbId });
                        const folderPath = `${rootFolder}/${folderName}`;
                        // Create the series
                        const series = TVSeries_1.TVSeriesModel.create({
                            tmdb_id: tmdbId,
                            title: tmdbData.name,
                            year: seriesYear,
                            overview: tmdbData.overview,
                            status: tmdbData.status,
                            network: tmdbData.networks?.[0]?.name || null,
                            vote_average: tmdbData.vote_average,
                            vote_count: tmdbData.vote_count,
                            poster_path: tmdbData.poster_path,
                            backdrop_path: tmdbData.backdrop_path,
                            folder_path: folderPath,
                            quality_profile_id: list.quality_profile_id || undefined,
                            monitored: true
                        });
                        logger_1.default.info(`[ImportList] Added series: ${series.title} (${seriesYear})`);
                        results.added++;
                        // Log activity
                        ActivityLog_1.ActivityLogModel.logSeriesEvent(series.id, ActivityLog_1.EVENT_TYPES.ADDED, `${series.title} (${seriesYear || 'N/A'}) added from import list "${list.name}"`, JSON.stringify({
                            source: 'Import List',
                            list_name: list.name,
                            list_type: list.type,
                            tmdb_id: tmdbId,
                            monitored: true
                        }));
                        // Queue background task to fetch episode metadata
                        // This happens async so the user isn't stuck waiting
                        setImmediate(async () => {
                            try {
                                const seasons = tmdbData.seasons || [];
                                for (const season of seasons) {
                                    if (season.season_number === 0)
                                        continue; // Skip specials by default
                                    // Determine if season should be monitored based on list.monitor setting
                                    let shouldMonitor = true;
                                    if (list.monitor === 'none') {
                                        shouldMonitor = false;
                                    }
                                    else if (list.monitor === 'firstSeason' && season.season_number !== 1) {
                                        shouldMonitor = false;
                                    }
                                    else if (list.monitor === 'latestSeason') {
                                        const maxSeason = Math.max(...seasons.filter((s) => s.season_number > 0).map((s) => s.season_number));
                                        if (season.season_number !== maxSeason) {
                                            shouldMonitor = false;
                                        }
                                    }
                                    try {
                                        const seasonDetails = await tmdbService.getSeasonDetails(tmdbId, season.season_number);
                                        if (seasonDetails?.episodes) {
                                            for (const ep of seasonDetails.episodes) {
                                                TVSeries_1.TVSeriesModel.createEpisode({
                                                    series_id: series.id,
                                                    season_number: season.season_number,
                                                    episode_number: ep.episode_number,
                                                    title: ep.name,
                                                    overview: ep.overview,
                                                    air_date: ep.air_date,
                                                    monitored: shouldMonitor
                                                });
                                            }
                                        }
                                        // Small delay between seasons to avoid rate limiting
                                        await new Promise(resolve => setTimeout(resolve, 300));
                                    }
                                    catch (seasonError) {
                                        logger_1.default.warn(`Failed to fetch season ${season.season_number} for ${series.title}: ${seasonError.message}`);
                                    }
                                }
                                // Run file scan after episodes are loaded
                                try {
                                    const { LibraryScannerController } = require('../controllers/LibraryScannerController');
                                    await LibraryScannerController.scanSeriesFiles(series.id, true);
                                    logger_1.default.info(`Completed episode metadata and file scan for series: ${series.title}`);
                                }
                                catch (scanError) {
                                    logger_1.default.warn(`Failed to scan files for ${series.title}: ${scanError.message}`);
                                }
                                // Trigger search if enabled
                                if (list.search_on_add) {
                                    try {
                                        const { autoSearchService } = require('./autoSearch');
                                        await autoSearchService.searchAndDownloadSeries(series.id);
                                        logger_1.default.info(`Triggered search for series: ${series.title}`);
                                    }
                                    catch (searchError) {
                                        logger_1.default.warn(`Failed to trigger search for ${series.title}: ${searchError.message}`);
                                    }
                                }
                            }
                            catch (bgError) {
                                logger_1.default.error(`Background episode fetch failed for ${series.title}: ${bgError.message}`);
                            }
                        });
                    }
                    // Add small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 250));
                }
                catch (error) {
                    logger_1.default.error(`Failed to process item ${item.title}: ${error.message}`);
                    results.failed++;
                }
            }
            // Update last sync time
            ImportList_1.ImportListModel.updateLastSync(list.id);
            logger_1.default.info(`Sync complete for ${list.name}: ${results.added} added, ${results.existing} existing, ${results.failed} failed`);
        }
        catch (error) {
            logger_1.default.error(`Failed to sync list ${list.name}: ${error.message}`);
        }
        return results;
    }
    // Sync all enabled lists that are due
    async syncDueLists() {
        const dueLists = ImportList_1.ImportListModel.getDueForSync();
        for (const list of dueLists) {
            await this.syncList(list);
        }
    }
    // Preview what items would be added from a list
    async previewList(list) {
        const { tmdbService } = require('./tmdb');
        const rawItems = await this.fetchListItems(list);
        let newCount = 0;
        let existingCount = 0;
        const items = [];
        for (const item of rawItems) {
            let tmdbId = item.tmdb_id;
            // If we only have IMDb ID, look up TMDB ID
            if (!tmdbId && item.imdb_id) {
                tmdbId = await this.getTmdbIdFromImdb(item.imdb_id, list.media_type) || undefined;
            }
            let enrichedItem = {
                tmdb_id: tmdbId,
                imdb_id: item.imdb_id,
                title: item.title,
                year: item.year,
                media_type: item.media_type,
                poster_path: null,
                overview: null,
                vote_average: null,
                genres: [],
                network: null,
                in_library: false
            };
            // Check if in library and get details
            if (list.media_type === 'movie') {
                const existing = tmdbId ? Movie_1.MovieModel.findByTmdbId(tmdbId) : null;
                if (existing) {
                    existingCount++;
                    enrichedItem.in_library = true;
                    enrichedItem.poster_path = existing.poster_path;
                    enrichedItem.overview = existing.overview;
                    enrichedItem.vote_average = existing.vote_average;
                }
                else {
                    newCount++;
                    // Fetch details from TMDB for new items
                    if (tmdbId) {
                        try {
                            const tmdbData = await tmdbService.getMovieDetails(tmdbId);
                            if (tmdbData) {
                                enrichedItem.poster_path = tmdbData.poster_path;
                                enrichedItem.overview = tmdbData.overview;
                                enrichedItem.title = tmdbData.title || item.title;
                                enrichedItem.year = tmdbData.release_date ? parseInt(tmdbData.release_date.split('-')[0]) : item.year;
                                enrichedItem.vote_average = tmdbData.vote_average;
                                enrichedItem.genres = tmdbData.genres?.map((g) => g.name) || [];
                            }
                        }
                        catch (e) {
                            // Keep basic info if TMDB fetch fails
                        }
                    }
                }
            }
            else {
                const existing = tmdbId ? TVSeries_1.TVSeriesModel.findByTmdbId(tmdbId) : null;
                if (existing) {
                    existingCount++;
                    enrichedItem.in_library = true;
                    enrichedItem.poster_path = existing.poster_path;
                    enrichedItem.overview = existing.overview;
                    enrichedItem.vote_average = existing.vote_average;
                    enrichedItem.network = existing.network;
                }
                else {
                    newCount++;
                    // Fetch details from TMDB for new items
                    if (tmdbId) {
                        try {
                            const tmdbData = await tmdbService.getTVDetails(tmdbId);
                            if (tmdbData) {
                                enrichedItem.poster_path = tmdbData.poster_path;
                                enrichedItem.overview = tmdbData.overview;
                                enrichedItem.title = tmdbData.name || item.title;
                                enrichedItem.year = tmdbData.first_air_date ? parseInt(tmdbData.first_air_date.split('-')[0]) : item.year;
                                enrichedItem.vote_average = tmdbData.vote_average;
                                enrichedItem.genres = tmdbData.genres?.map((g) => g.name) || [];
                                enrichedItem.network = tmdbData.networks?.[0]?.name || null;
                            }
                        }
                        catch (e) {
                            // Keep basic info if TMDB fetch fails
                        }
                    }
                }
            }
            items.push(enrichedItem);
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return { items, newCount, existingCount };
    }
}
exports.ImportListService = ImportListService;
exports.importListService = ImportListService.getInstance();
//# sourceMappingURL=importListService.js.map