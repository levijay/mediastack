"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexerService = exports.IndexerService = void 0;
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
const xml2js_1 = __importDefault(require("xml2js"));
// Mutex for ensuring only one search operation at a time
class SearchMutex {
    constructor() {
        this.locked = false;
        this.queue = [];
    }
    async acquire() {
        return new Promise((resolve) => {
            if (!this.locked) {
                this.locked = true;
                resolve();
            }
            else {
                this.queue.push(resolve);
            }
        });
    }
    release() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next)
                next();
        }
        else {
            this.locked = false;
        }
    }
}
// Rate limiter with proper mutex to prevent hammering indexers
class IndexerRateLimiter {
    constructor() {
        this.lastRequestTime = new Map();
        this.minIntervalMs = 3000; // Minimum 3 seconds between requests to same indexer
        this.globalLastRequestTime = 0;
        this.globalMinIntervalMs = 1000; // Minimum 1 second between any indexer request
        this.mutex = new SearchMutex();
    }
    async waitForIndexer(indexerId) {
        // Acquire mutex to ensure serial access
        await this.mutex.acquire();
        try {
            const now = Date.now();
            // Check global rate limit
            const globalTimeSinceLast = now - this.globalLastRequestTime;
            if (globalTimeSinceLast < this.globalMinIntervalMs) {
                const globalWaitTime = this.globalMinIntervalMs - globalTimeSinceLast;
                logger_1.default.debug(`[RateLimit] Global wait: ${globalWaitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, globalWaitTime));
            }
            // Check per-indexer rate limit
            const lastTime = this.lastRequestTime.get(indexerId) || 0;
            const timeSinceLast = Date.now() - lastTime;
            if (timeSinceLast < this.minIntervalMs) {
                const waitTime = this.minIntervalMs - timeSinceLast;
                logger_1.default.debug(`[RateLimit] Indexer ${indexerId} wait: ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            this.lastRequestTime.set(indexerId, Date.now());
            this.globalLastRequestTime = Date.now();
        }
        finally {
            this.mutex.release();
        }
    }
}
const rateLimiter = new IndexerRateLimiter();
// Global search queue to ensure only one media search at a time
class SearchQueue {
    constructor() {
        this.mutex = new SearchMutex();
        this.lastSearchTime = 0;
        this.minSearchIntervalMs = 2000; // Minimum 2 seconds between searches
    }
    async executeSearch(searchFn) {
        await this.mutex.acquire();
        try {
            // Ensure minimum interval between searches
            const now = Date.now();
            const timeSinceLast = now - this.lastSearchTime;
            if (timeSinceLast < this.minSearchIntervalMs) {
                const waitTime = this.minSearchIntervalMs - timeSinceLast;
                logger_1.default.debug(`[SearchQueue] Waiting ${waitTime}ms before next search`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            this.lastSearchTime = Date.now();
            return await searchFn();
        }
        finally {
            this.mutex.release();
        }
    }
}
const searchQueue = new SearchQueue();
class IndexerService {
    mapIndexer(i) {
        return {
            id: i.id,
            name: i.name,
            type: i.type,
            url: i.url,
            apiKey: i.api_key,
            enabled: i.enabled === 1,
            enableRss: i.enable_rss !== 0,
            enableAutomaticSearch: i.enable_automatic_search !== 0,
            enableInteractiveSearch: i.enable_interactive_search !== 0,
            priority: i.priority || 50
        };
    }
    async getIndexers() {
        const stmt = database_1.default.prepare('SELECT * FROM indexers WHERE enabled = 1 ORDER BY priority ASC');
        const indexers = stmt.all();
        return indexers.map(i => this.mapIndexer(i));
    }
    // Get indexers enabled for automatic search
    async getIndexersForAutomaticSearch() {
        const stmt = database_1.default.prepare('SELECT * FROM indexers WHERE enabled = 1 AND enable_automatic_search = 1 ORDER BY priority ASC');
        const indexers = stmt.all();
        return indexers.map(i => this.mapIndexer(i));
    }
    // Get indexers enabled for interactive/manual search
    async getIndexersForInteractiveSearch() {
        const stmt = database_1.default.prepare('SELECT * FROM indexers WHERE enabled = 1 AND enable_interactive_search = 1 ORDER BY priority ASC');
        const indexers = stmt.all();
        return indexers.map(i => this.mapIndexer(i));
    }
    // Get indexers enabled for RSS sync
    async getIndexersForRss() {
        const stmt = database_1.default.prepare('SELECT * FROM indexers WHERE enabled = 1 AND enable_rss = 1 ORDER BY priority ASC');
        const indexers = stmt.all();
        return indexers.map(i => this.mapIndexer(i));
    }
    async getAllIndexers() {
        const stmt = database_1.default.prepare('SELECT * FROM indexers ORDER BY priority ASC');
        const indexers = stmt.all();
        return indexers.map(i => this.mapIndexer(i));
    }
    async addIndexer(data) {
        const id = require('crypto').randomUUID();
        const stmt = database_1.default.prepare(`
      INSERT INTO indexers (id, name, type, url, api_key, enabled, enable_rss, enable_automatic_search, enable_interactive_search, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.name, data.type, data.url, data.apiKey, data.enabled ? 1 : 0, data.enableRss !== false ? 1 : 0, data.enableAutomaticSearch !== false ? 1 : 0, data.enableInteractiveSearch !== false ? 1 : 0, data.priority || 50);
        return { id, ...data };
    }
    async deleteIndexer(id) {
        const stmt = database_1.default.prepare('DELETE FROM indexers WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    async updateIndexer(id, data) {
        const updates = [];
        const values = [];
        if (data.name !== undefined) {
            updates.push('name = ?');
            values.push(data.name);
        }
        if (data.type !== undefined) {
            updates.push('type = ?');
            values.push(data.type);
        }
        if (data.url !== undefined) {
            updates.push('url = ?');
            values.push(data.url);
        }
        if (data.apiKey !== undefined) {
            updates.push('api_key = ?');
            values.push(data.apiKey);
        }
        if (data.enabled !== undefined) {
            updates.push('enabled = ?');
            values.push(data.enabled ? 1 : 0);
        }
        if (data.enableRss !== undefined) {
            updates.push('enable_rss = ?');
            values.push(data.enableRss ? 1 : 0);
        }
        if (data.enableAutomaticSearch !== undefined) {
            updates.push('enable_automatic_search = ?');
            values.push(data.enableAutomaticSearch ? 1 : 0);
        }
        if (data.enableInteractiveSearch !== undefined) {
            updates.push('enable_interactive_search = ?');
            values.push(data.enableInteractiveSearch ? 1 : 0);
        }
        if (data.priority !== undefined) {
            updates.push('priority = ?');
            values.push(data.priority);
        }
        if (updates.length === 0) {
            const existing = await this.getIndexerById(id);
            return existing;
        }
        values.push(id);
        const stmt = database_1.default.prepare(`UPDATE indexers SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
        stmt.run(...values);
        return this.getIndexerById(id);
    }
    async getIndexerById(id) {
        const stmt = database_1.default.prepare('SELECT * FROM indexers WHERE id = ?');
        const indexer = stmt.get(id);
        if (!indexer)
            return null;
        return this.mapIndexer(indexer);
    }
    async testIndexer(url, apiKey, type) {
        try {
            logger_1.default.info(`Testing indexer: ${url}`);
            const response = await axios_1.default.get(`${url}/api`, {
                params: {
                    t: 'caps',
                    apikey: apiKey
                },
                timeout: 10000
            });
            if (response.status === 200) {
                logger_1.default.info(`Indexer test successful: ${url}`);
                return { success: true, message: 'Indexer connected successfully' };
            }
            return { success: false, message: 'Invalid response from indexer' };
        }
        catch (error) {
            logger_1.default.error('Indexer test failed:', error.message);
            return { success: false, message: error.message || 'Connection failed' };
        }
    }
    /**
     * Fetch RSS feed from an indexer
     */
    async fetchRss(indexer) {
        let searchUrl = indexer.url;
        if (!searchUrl.endsWith('/api')) {
            searchUrl = searchUrl.replace(/\/?$/, '/api');
        }
        try {
            await rateLimiter.waitForIndexer(indexer.id);
            // Category codes: 2000 = Movies, 5000 = TV
            // This filters RSS to only return movie and TV content
            const response = await axios_1.default.get(searchUrl, {
                params: {
                    t: 'search',
                    apikey: indexer.apiKey,
                    cat: '2000,5000',
                    limit: 100
                },
                timeout: 30000
            });
            return this.parseResults(response.data, indexer.name, indexer.type);
        }
        catch (error) {
            logger_1.default.error(`[RSS] Failed to fetch RSS from ${indexer.name}: ${error.message}`);
            return [];
        }
    }
    async searchMovie(title, year, searchType = 'automatic') {
        return searchQueue.executeSearch(async () => {
            const indexers = searchType === 'interactive'
                ? await this.getIndexersForInteractiveSearch()
                : await this.getIndexersForAutomaticSearch();
            logger_1.default.info(`[SEARCH] Movie search (${searchType}): "${title}" (${year || 'no year'}) - Found ${indexers.length} enabled indexer(s)`);
            if (indexers.length === 0) {
                logger_1.default.warn('[SEARCH] No enabled indexers configured!');
                return [];
            }
            const allResults = [];
            for (let i = 0; i < indexers.length; i++) {
                const indexer = indexers[i];
                try {
                    // Wait for rate limiter
                    await rateLimiter.waitForIndexer(indexer.id);
                    logger_1.default.info(`[SEARCH] Querying indexer: ${indexer.name} (${indexer.url})`);
                    const results = await this.searchIndexer(indexer, title, year);
                    logger_1.default.info(`[SEARCH] ${indexer.name} returned ${results.length} results`);
                    allResults.push(...results);
                }
                catch (error) {
                    logger_1.default.error(`[SEARCH] Failed on ${indexer.name}: ${error.message}`);
                }
            }
            // Filter results by title match (and year if provided)
            const filteredResults = this.filterByTitleMatch(allResults, title, 'movie', year);
            logger_1.default.info(`[SEARCH] Total results: ${allResults.length}, after title filter: ${filteredResults.length}`);
            // Sort by seeders
            return filteredResults.sort((a, b) => b.seeders - a.seeders);
        });
    }
    async searchTV(title, season, episode, searchType = 'automatic') {
        return searchQueue.executeSearch(async () => {
            const indexers = searchType === 'interactive'
                ? await this.getIndexersForInteractiveSearch()
                : await this.getIndexersForAutomaticSearch();
            logger_1.default.info(`[SEARCH] TV search (${searchType}): "${title}" S${season || '?'}E${episode || '?'} - Found ${indexers.length} enabled indexer(s)`);
            if (indexers.length === 0) {
                logger_1.default.warn('[SEARCH] No enabled indexers configured!');
                return [];
            }
            const allResults = [];
            for (let i = 0; i < indexers.length; i++) {
                const indexer = indexers[i];
                try {
                    // Wait for rate limiter
                    await rateLimiter.waitForIndexer(indexer.id);
                    logger_1.default.info(`[SEARCH] Querying indexer: ${indexer.name} (${indexer.url})`);
                    const results = await this.searchIndexerTV(indexer, title, season, episode);
                    logger_1.default.info(`[SEARCH] ${indexer.name} returned ${results.length} results`);
                    allResults.push(...results);
                }
                catch (error) {
                    logger_1.default.error(`[SEARCH] Failed on ${indexer.name}: ${error.message}`);
                }
            }
            // Filter results by title match
            const filteredResults = this.filterByTitleMatch(allResults, title, 'tv');
            logger_1.default.info(`[SEARCH] Total results: ${allResults.length}, after title filter: ${filteredResults.length}`);
            return filteredResults.sort((a, b) => b.seeders - a.seeders);
        });
    }
    /**
     * Filter search results to only include releases that match the title
     */
    filterByTitleMatch(results, searchTitle, mediaType, expectedYear) {
        // Normalize search title for comparison
        const normalizedSearch = this.normalizeTitle(searchTitle);
        // Keep short words like "AI", "IT", "Up" etc - only filter single chars
        const allSearchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 1 || /^[ai]$/i.test(w) === false);
        // Common articles that are often omitted in release names
        const commonArticles = ['the', 'a', 'an', 'and', 'of', 'in', 'on', 'at', 'to', 'for'];
        // Separate content words (required) from articles (optional)
        const contentWords = allSearchWords.filter(w => !commonArticles.includes(w));
        const articleWords = allSearchWords.filter(w => commonArticles.includes(w));
        // If no meaningful search words, skip title filtering
        if (contentWords.length === 0) {
            logger_1.default.warn(`[SEARCH] No searchable words in title: "${searchTitle}"`);
            return results;
        }
        logger_1.default.debug(`[SEARCH] Title matching: "${searchTitle}" -> content: [${contentWords.join(', ')}], articles: [${articleWords.join(', ')}]${expectedYear ? `, year: ${expectedYear}` : ''}`);
        return results.filter(result => {
            // Check category - Movies: 2000-2999, TV: 5000-5999
            if (result.categories && result.categories.length > 0) {
                const hasMovieCategory = result.categories.some(cat => cat.toLowerCase().includes('movie') ||
                    (typeof cat === 'string' && parseInt(cat) >= 2000 && parseInt(cat) < 3000));
                const hasTVCategory = result.categories.some(cat => cat.toLowerCase().includes('tv') ||
                    (typeof cat === 'string' && parseInt(cat) >= 5000 && parseInt(cat) < 6000));
                if (mediaType === 'movie' && !hasMovieCategory && hasTVCategory) {
                    logger_1.default.debug(`[SEARCH] Filtered out TV result: ${result.title}`);
                    return false;
                }
                if (mediaType === 'tv' && !hasTVCategory && hasMovieCategory) {
                    logger_1.default.debug(`[SEARCH] Filtered out Movie result: ${result.title}`);
                    return false;
                }
            }
            // Check year if provided (allow ±1 year difference)
            if (expectedYear && mediaType === 'movie') {
                const yearMatch = result.title.match(/\b(19|20)\d{2}\b/);
                if (yearMatch) {
                    const releaseYear = parseInt(yearMatch[0]);
                    if (Math.abs(releaseYear - expectedYear) > 1) {
                        logger_1.default.debug(`[SEARCH] Filtered (year mismatch: release=${releaseYear}, expected=${expectedYear}±1): ${result.title}`);
                        return false;
                    }
                }
            }
            // Extract title from release name (before year/quality info)
            const releaseTitle = this.extractTitleFromRelease(result.title);
            const normalizedRelease = this.normalizeTitle(releaseTitle);
            const releaseWords = normalizedRelease.split(/\s+/).filter(w => w.length > 0);
            // STRICT MATCHING for content words: Require exact word matches
            const matchedContentWords = contentWords.filter(searchWord => releaseWords.some(releaseWord => releaseWord === searchWord));
            // Calculate how many CONTENT words matched (articles are optional)
            const contentMatchRatio = matchedContentWords.length / contentWords.length;
            // Calculate extra words in release that aren't in search
            // This prevents "Pacific Rim Uprising" matching "Rising"
            const unmatchedReleaseWords = releaseWords.filter(rw => !allSearchWords.some(sw => sw === rw));
            // Requirements:
            // 1. At least 80% of CONTENT words must match exactly
            // 2. Release can't have more than 2x unmatched words vs matched content words
            const requiredRatio = 0.8;
            const maxExtraWords = Math.max(2, matchedContentWords.length * 2);
            if (contentMatchRatio < requiredRatio) {
                logger_1.default.debug(`[SEARCH] Filtered (${Math.round(contentMatchRatio * 100)}% content match, need ${Math.round(requiredRatio * 100)}%): "${releaseTitle}" for "${searchTitle}"`);
                return false;
            }
            if (unmatchedReleaseWords.length > maxExtraWords) {
                logger_1.default.debug(`[SEARCH] Filtered (${unmatchedReleaseWords.length} extra words > ${maxExtraWords} allowed): "${releaseTitle}" for "${searchTitle}"`);
                return false;
            }
            logger_1.default.debug(`[SEARCH] Matched: "${releaseTitle}" for "${searchTitle}" (${matchedContentWords.length}/${contentWords.length} content words, ${unmatchedReleaseWords.length} extra)`);
            return true;
        });
    }
    /**
     * Normalize a title for comparison (lowercase, remove punctuation)
     */
    normalizeTitle(title) {
        return title
            .toLowerCase()
            // Normalize "A.I." to "ai" (keep as one word)
            .replace(/a\.i\./gi, 'ai')
            // Normalize ampersand and "and" to the same thing
            .replace(/&/g, ' and ')
            .replace(/['']/g, '') // Remove apostrophes
            // Normalize slashes to spaces (for titles like "Good/Bad")
            .replace(/\//g, ' ')
            .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
            // Normalize " and " to a single space for comparison
            .replace(/\s+and\s+/g, ' ')
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .trim();
    }
    /**
     * Extract the title portion from a release name
     * e.g., "The.Tank.2025.1080p.WEB-DL" -> "The Tank"
     */
    extractTitleFromRelease(releaseName) {
        // Replace dots/underscores with spaces
        let title = releaseName.replace(/[._]/g, ' ');
        // Common patterns to split on (year, quality, source, etc.)
        const splitPatterns = [
            /\s+(19|20)\d{2}\s/, // Year
            /\s+S\d{2}E?\d*/i, // Season/Episode
            /\s+(720p|1080p|2160p|4k)/i, // Resolution
            /\s+(WEB|HDTV|BluRay|BDRip|DVDRip|HDRip|AMZN|NF|DSNP)/i, // Source
            /\s+(x264|x265|H\.?264|H\.?265|HEVC|AVC)/i, // Codec
            /\s+(AAC|DTS|DD5|AC3|FLAC)/i, // Audio
        ];
        for (const pattern of splitPatterns) {
            const match = title.match(pattern);
            if (match && match.index !== undefined) {
                title = title.substring(0, match.index);
                break;
            }
        }
        return title.trim();
    }
    async searchIndexer(indexer, title, year) {
        // Build the search URL - handle different URL formats
        let searchUrl = indexer.url;
        // If URL doesn't end with /api, append it (for Torznab compatibility)
        if (!searchUrl.endsWith('/api')) {
            searchUrl = searchUrl.replace(/\/?$/, '/api');
        }
        // Helper to remove common articles (the, a, an) from title
        const removeArticles = (t) => t
            .replace(/\b(the|a|an)\b\s*/gi, '') // Remove articles
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .trim();
        // Generate query variations for better matching
        // Some indexers handle spaces/articles differently
        const titleWithoutArticles = removeArticles(title);
        const queryVariations = [
            title, // Original: "A Quiet Place"
            title.replace(/\s+/g, '.'), // Dots: "A.Quiet.Place"
            titleWithoutArticles, // Without articles: "Quiet Place"
            titleWithoutArticles.replace(/\s+/g, '.'), // Without articles + dots: "Quiet.Place"
        ];
        // Remove duplicates and empty strings
        const uniqueQueries = [...new Set(queryVariations.filter(q => q.length > 0))];
        let allResults = [];
        for (const query of uniqueQueries) {
            // First try with t=movie (standard Torznab)
            const movieParams = {
                t: 'movie',
                apikey: indexer.apiKey,
                q: query,
                cat: '2000,2010,2020,2030,2040,2045,2050,2060', // Movies category
                limit: 100
            };
            logger_1.default.debug(`[SEARCH] Request: ${searchUrl}?t=movie&q=${encodeURIComponent(query)}&cat=2000&limit=100`);
            try {
                const response = await axios_1.default.get(searchUrl, {
                    params: movieParams,
                    timeout: 30000
                });
                const results = await this.parseResults(response.data, indexer.name, indexer.type);
                if (results.length > 0) {
                    logger_1.default.info(`[SEARCH] ${indexer.name}: Found ${results.length} results with query "${query}"`);
                    allResults.push(...results);
                    break; // Found results, no need to try other variations
                }
            }
            catch (error) {
                logger_1.default.debug(`[SEARCH] ${indexer.name}: t=movie failed for "${query}" (${error.message})`);
            }
        }
        // If no results from t=movie, try t=search as fallback
        if (allResults.length === 0) {
            logger_1.default.info(`[SEARCH] ${indexer.name}: t=movie returned 0 results, trying t=search`);
            for (const query of uniqueQueries) {
                const searchParams = {
                    t: 'search',
                    apikey: indexer.apiKey,
                    q: query,
                    cat: '2000,2010,2020,2030,2040,2045,2050,2060', // Movies category
                    limit: 100
                };
                logger_1.default.debug(`[SEARCH] Request fallback: ${searchUrl}?t=search&q=${encodeURIComponent(query)}&cat=2000&limit=100`);
                try {
                    const response = await axios_1.default.get(searchUrl, {
                        params: searchParams,
                        timeout: 30000
                    });
                    const results = await this.parseResults(response.data, indexer.name, indexer.type);
                    if (results.length > 0) {
                        logger_1.default.info(`[SEARCH] ${indexer.name}: Found ${results.length} results with t=search query "${query}"`);
                        allResults.push(...results);
                        break; // Found results, no need to try other variations
                    }
                }
                catch (error) {
                    logger_1.default.debug(`[SEARCH] ${indexer.name}: t=search failed for "${query}" (${error.message})`);
                }
            }
        }
        return allResults;
    }
    async searchIndexerTV(indexer, title, season, episode) {
        const params = {
            t: 'tvsearch',
            apikey: indexer.apiKey,
            q: title,
            cat: '5000,5010,5020,5030,5040,5045,5050,5060,5070,5080', // TV category
            limit: 100
        };
        if (season !== undefined) {
            params.season = season;
        }
        if (episode !== undefined) {
            params.ep = episode;
        }
        // Build the search URL - handle different URL formats
        let searchUrl = indexer.url;
        if (!searchUrl.endsWith('/api')) {
            searchUrl = searchUrl.replace(/\/?$/, '/api');
        }
        logger_1.default.debug(`[SEARCH] Request: ${searchUrl}?t=tvsearch&q=${encodeURIComponent(title)}&cat=5000&limit=100`);
        try {
            const response = await axios_1.default.get(searchUrl, {
                params,
                timeout: 30000
            });
            const results = await this.parseResults(response.data, indexer.name, indexer.type);
            if (results.length > 0) {
                return results;
            }
            // Fallback to t=search if t=tvsearch returned no results
            logger_1.default.info(`[SEARCH] ${indexer.name}: t=tvsearch returned 0 results, trying t=search`);
        }
        catch (error) {
            logger_1.default.warn(`[SEARCH] ${indexer.name}: t=tvsearch failed (${error.message}), trying t=search`);
        }
        // Fallback: try with t=search but still filter by TV category
        const searchParams = {
            t: 'search',
            apikey: indexer.apiKey,
            q: season !== undefined && episode !== undefined
                ? `${title} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
                : title,
            cat: '5000,5010,5020,5030,5040,5045,5050,5060,5070,5080', // TV category
            limit: 100
        };
        logger_1.default.debug(`[SEARCH] Request fallback: ${searchUrl}?t=search&q=${encodeURIComponent(searchParams.q)}&cat=5000&limit=100`);
        const searchResponse = await axios_1.default.get(searchUrl, {
            params: searchParams,
            timeout: 30000
        });
        return this.parseResults(searchResponse.data, indexer.name, indexer.type);
    }
    async parseResults(responseData, indexerName, indexerType) {
        logger_1.default.debug(`[SEARCH] Response from ${indexerName} - type: ${typeof responseData}, isArray: ${Array.isArray(responseData)}`);
        // Check if response is already JSON (Prowlarr native API or axios auto-parsed)
        if (typeof responseData === 'object') {
            if (Array.isArray(responseData)) {
                logger_1.default.info(`[SEARCH] ${indexerName} returned JSON array with ${responseData.length} items`);
                return this.parseJsonResults(responseData, indexerName, indexerType);
            }
            // It's an object but not an array - check for common wrapper properties
            if (responseData.results || responseData.data || responseData.items) {
                const items = responseData.results || responseData.data || responseData.items || [];
                logger_1.default.info(`[SEARCH] ${indexerName} returned wrapped JSON object with ${items.length} items`);
                return this.parseJsonResults(Array.isArray(items) ? items : [], indexerName, indexerType);
            }
            // Check if it's an RSS/XML response that axios parsed as object
            if (responseData.rss) {
                // Process as parsed XML
                if (!responseData.rss?.channel?.[0]?.item) {
                    logger_1.default.debug(`[SEARCH] No items found in parsed XML response from ${indexerName}`);
                    return [];
                }
                const items = responseData.rss.channel[0].item;
                return this.parseXmlItems(items, indexerName, indexerType);
            }
            // Unknown object format - log and return empty
            logger_1.default.warn(`[SEARCH] ${indexerName} returned unknown object format`);
            return [];
        }
        // Convert to string if needed
        const dataStr = typeof responseData === 'string' ? responseData : '';
        if (!dataStr) {
            logger_1.default.warn(`[SEARCH] Empty response from ${indexerName}`);
            return [];
        }
        const trimmedData = dataStr.trim();
        // Check if it's a JSON string (starts with [ or {)
        if (trimmedData.startsWith('[') || trimmedData.startsWith('{')) {
            try {
                const jsonData = JSON.parse(trimmedData);
                const items = Array.isArray(jsonData) ? jsonData : (jsonData.results || jsonData.data || []);
                logger_1.default.info(`[SEARCH] ${indexerName} returned JSON string, parsed ${items.length} items`);
                return this.parseJsonResults(items, indexerName, indexerType);
            }
            catch (e) {
                logger_1.default.error(`[SEARCH] Failed to parse JSON from ${indexerName}: ${e.message}`);
                return [];
            }
        }
        // Parse as XML (standard Torznab/Newznab)
        const parser = new xml2js_1.default.Parser();
        try {
            const result = await parser.parseStringPromise(dataStr);
            if (!result.rss?.channel?.[0]?.item) {
                logger_1.default.debug(`[SEARCH] No items found in XML response from ${indexerName}`);
                return [];
            }
            return this.parseXmlItems(result.rss.channel[0].item, indexerName, indexerType);
        }
        catch (error) {
            logger_1.default.error(`[SEARCH] Failed to parse response from ${indexerName}: ${error.message}`);
            logger_1.default.debug(`[SEARCH] Response preview: ${dataStr.substring(0, 200)}...`);
            return [];
        }
    }
    parseXmlItems(items, indexerName, indexerType) {
        const results = [];
        for (const item of items) {
            try {
                const enclosure = item.enclosure?.[0]?.$;
                const torznabAttrs = item['torznab:attr'] || item['newznab:attr'] || [];
                let seeders = 0;
                let leechers = 0;
                let grabs = 0;
                let size = parseInt(enclosure?.length || '0');
                let downloadVolumeFactor = null;
                const categories = [];
                for (const attr of torznabAttrs) {
                    const name = attr.$.name;
                    const value = attr.$.value;
                    if (name === 'seeders')
                        seeders = parseInt(value);
                    if (name === 'peers')
                        leechers = parseInt(value) - seeders;
                    if (name === 'size')
                        size = parseInt(value);
                    if (name === 'grabs')
                        grabs = parseInt(value);
                    if (name === 'downloadvolumefactor')
                        downloadVolumeFactor = parseFloat(value);
                    if (name === 'category')
                        categories.push(this.getCategoryName(value));
                }
                // Also check for category elements
                if (item.category) {
                    for (const cat of item.category) {
                        const catName = typeof cat === 'string' ? cat : cat._ || cat;
                        if (catName && !categories.includes(catName)) {
                            categories.push(catName);
                        }
                    }
                }
                // Determine protocol: torrent if has seeders or is torznab type, usenet otherwise
                const downloadUrl = enclosure?.url || item.link?.[0] || '';
                const isUsenet = indexerType === 'newznab' ||
                    downloadUrl.toLowerCase().includes('.nzb') ||
                    (seeders === 0 && downloadVolumeFactor === null);
                const protocol = isUsenet ? 'usenet' : 'torrent';
                results.push({
                    guid: item.guid?.[0]?._ || item.guid?.[0] || `${indexerName}-${Date.now()}-${Math.random()}`,
                    title: item.title[0],
                    size,
                    seeders,
                    leechers: Math.max(0, leechers),
                    grabs,
                    downloadUrl,
                    infoUrl: item.comments?.[0] || item.link?.[0] || '',
                    indexer: indexerName,
                    indexerType,
                    protocol,
                    quality: this.extractQuality(item.title[0]),
                    publishDate: item.pubDate?.[0] || new Date().toISOString(),
                    categories
                });
            }
            catch (error) {
                logger_1.default.error('Failed to parse XML search result item:', error);
            }
        }
        return results;
    }
    // Get human-readable category name from Newznab category code
    getCategoryName(code) {
        const categories = {
            '2000': 'Movies',
            '2010': 'Movies/Foreign',
            '2020': 'Movies/Other',
            '2030': 'Movies/SD',
            '2040': 'Movies/HD',
            '2045': 'Movies/UHD',
            '2050': 'Movies/BluRay',
            '2060': 'Movies/3D',
            '5000': 'TV',
            '5010': 'TV/WEB-DL',
            '5020': 'TV/Foreign',
            '5030': 'TV/SD',
            '5040': 'TV/HD',
            '5045': 'TV/UHD',
            '5050': 'TV/Other',
            '5060': 'TV/Sport',
            '5070': 'TV/Anime',
            '5080': 'TV/Documentary'
        };
        return categories[code] || code;
    }
    parseJsonResults(data, indexerName, indexerType) {
        const results = [];
        for (const item of data) {
            try {
                const downloadUrl = item.downloadUrl || item.DownloadUrl || item.link || item.Link || '';
                const seeders = item.seeders || item.Seeders || 0;
                const grabs = item.grabs || item.Grabs || 0;
                // Get categories
                let categories = [];
                if (item.categories) {
                    categories = Array.isArray(item.categories)
                        ? item.categories.map((c) => typeof c === 'string' ? c : c.name || c.Name || String(c))
                        : [];
                }
                else if (item.Categories) {
                    categories = Array.isArray(item.Categories)
                        ? item.Categories.map((c) => typeof c === 'string' ? c : c.name || c.Name || String(c))
                        : [];
                }
                else if (item.category) {
                    categories = [item.category];
                }
                // Determine protocol from item data or indexer type
                // Prowlarr includes 'protocol' field: 'torrent' or 'usenet'
                let protocol;
                if (item.protocol) {
                    protocol = item.protocol === 'usenet' ? 'usenet' : 'torrent';
                }
                else if (item.Protocol) {
                    protocol = item.Protocol === 'usenet' ? 'usenet' : 'torrent';
                }
                else if (indexerType === 'newznab') {
                    protocol = 'usenet';
                }
                else if (downloadUrl.toLowerCase().includes('.nzb')) {
                    protocol = 'usenet';
                }
                else {
                    protocol = 'torrent';
                }
                results.push({
                    guid: item.guid || item.id || `${indexerName}-${Date.now()}-${Math.random()}`,
                    title: item.title || item.Title || '',
                    size: item.size || item.Size || 0,
                    seeders,
                    leechers: item.leechers || item.Leechers || item.peers || 0,
                    grabs,
                    downloadUrl,
                    infoUrl: item.infoUrl || item.InfoUrl || item.guid || '',
                    indexer: indexerName,
                    indexerType,
                    protocol,
                    quality: this.extractQuality(item.title || item.Title || ''),
                    publishDate: item.publishDate || item.PublishDate || new Date().toISOString(),
                    categories
                });
            }
            catch (error) {
                logger_1.default.error('Failed to parse JSON search result item:', error);
            }
        }
        return results;
    }
    extractQuality(title) {
        const titleLower = title.toLowerCase();
        if (titleLower.includes('2160p') || titleLower.includes('4k'))
            return '4K';
        if (titleLower.includes('1080p'))
            return '1080p';
        if (titleLower.includes('720p'))
            return '720p';
        if (titleLower.includes('480p'))
            return '480p';
        return 'Unknown';
    }
}
exports.IndexerService = IndexerService;
exports.indexerService = new IndexerService();
//# sourceMappingURL=indexer.js.map