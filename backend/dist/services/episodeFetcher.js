"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.episodeFetcherService = exports.EpisodeFetcherService = void 0;
const tmdb_1 = require("./tmdb");
const tvdb_1 = require("./tvdb");
const TVSeries_1 = require("../models/TVSeries");
const logger_1 = __importDefault(require("../config/logger"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Video file extensions
const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.mov', '.wmv', '.flv', '.webm', '.ts', '.m2ts'];
class EpisodeFetcherService {
    /**
     * Fetch and populate all episodes for a TV series
     * Uses TVDB if configured and series has tvdb_id, otherwise falls back to TMDB
     */
    async fetchAndPopulateEpisodes(seriesId) {
        try {
            const series = TVSeries_1.TVSeriesModel.findById(seriesId);
            if (!series) {
                logger_1.default.error(`Series not found: ${seriesId}`);
                return 0;
            }
            // Check if TVDB is available and series has TVDB ID
            const useTVDB = series.tvdb_id && await tvdb_1.tvdbService.isConfigured();
            if (useTVDB && series.tvdb_id) {
                logger_1.default.info(`Fetching episodes from TVDB for series: ${series.title}`);
                return this.fetchFromTVDB(series);
            }
            else if (series.tmdb_id) {
                logger_1.default.info(`Fetching episodes from TMDB for series: ${series.title}`);
                return this.fetchFromTMDB(series);
            }
            else {
                logger_1.default.error(`Series ${series.title} has no TVDB or TMDB ID`);
                return 0;
            }
        }
        catch (error) {
            logger_1.default.error('Failed to fetch episodes:', error);
            throw error;
        }
    }
    /**
     * Fetch episodes from TVDB
     */
    async fetchFromTVDB(series) {
        try {
            const tvdbData = await tvdb_1.tvdbService.getSeriesDetails(series.tvdb_id);
            if (!tvdbData || !tvdbData.episodes) {
                logger_1.default.warn(`No episodes found from TVDB for series: ${series.title}`);
                // Fall back to TMDB if available
                if (series.tmdb_id) {
                    return this.fetchFromTMDB(series);
                }
                return 0;
            }
            let totalEpisodes = 0;
            const seriesMonitored = series.monitored !== false;
            const monitorNewSeasons = series.monitor_new_seasons || 'all';
            const seriesStatus = series.status;
            const isEnded = seriesStatus === 'Ended' || seriesStatus === 'Canceled';
            const today = new Date().toISOString().split('T')[0];
            // Group episodes by season
            const episodesBySeason = new Map();
            for (const episode of tvdbData.episodes) {
                if (!episodesBySeason.has(episode.seasonNumber)) {
                    episodesBySeason.set(episode.seasonNumber, []);
                }
                episodesBySeason.get(episode.seasonNumber).push(episode);
            }
            // Get all non-specials season numbers and find the highest/current one
            const seasonNumbers = Array.from(episodesBySeason.keys()).filter(s => s > 0).sort((a, b) => b - a);
            const latestSeasonNumber = seasonNumbers[0] || 1;
            // Determine current season: latest season that has at least one aired episode
            let currentSeasonNumber = latestSeasonNumber;
            for (const seasonNum of seasonNumbers) {
                const episodes = episodesBySeason.get(seasonNum) || [];
                const hasAiredEpisodes = episodes.some(ep => ep.aired && ep.aired <= today);
                const hasFutureEpisodes = episodes.some(ep => !ep.aired || ep.aired > today);
                if (hasAiredEpisodes && hasFutureEpisodes) {
                    currentSeasonNumber = seasonNum;
                    break;
                }
                else if (hasAiredEpisodes) {
                    currentSeasonNumber = seasonNum;
                    break;
                }
            }
            // Process each season
            for (const [seasonNumber, episodes] of episodesBySeason) {
                try {
                    // Create season if doesn't exist
                    const existingSeasons = TVSeries_1.TVSeriesModel.findSeasonsBySeriesId(series.id);
                    let dbSeason = existingSeasons.find(s => s.season_number === seasonNumber);
                    // Determine if this season should be monitored based on preference
                    let shouldMonitorSeason = false;
                    if (seasonNumber === 0) {
                        // Never monitor specials by default
                        shouldMonitorSeason = false;
                    }
                    else if (!seriesMonitored) {
                        shouldMonitorSeason = false;
                    }
                    else {
                        switch (monitorNewSeasons) {
                            case 'all':
                                shouldMonitorSeason = true;
                                break;
                            case 'future':
                                // Only monitor seasons entirely in the future
                                const allEpisodesFuture = episodes.every(ep => !ep.aired || ep.aired > today);
                                shouldMonitorSeason = allEpisodesFuture;
                                break;
                            case 'current':
                                // Only monitor current/active season if series is not ended and has pending episodes
                                if (isEnded) {
                                    shouldMonitorSeason = false;
                                }
                                else {
                                    // Monitor current season with future episodes
                                    const seasonHasFutureEpisodes = episodes.some(ep => !ep.aired || ep.aired > today);
                                    shouldMonitorSeason = seasonNumber === currentSeasonNumber && seasonHasFutureEpisodes;
                                }
                                break;
                            case 'none':
                                shouldMonitorSeason = false;
                                break;
                            default:
                                shouldMonitorSeason = true;
                        }
                    }
                    if (!dbSeason) {
                        dbSeason = TVSeries_1.TVSeriesModel.createSeason(series.id, seasonNumber, shouldMonitorSeason);
                        logger_1.default.info(`Created season ${seasonNumber} for: ${series.title} (monitored: ${shouldMonitorSeason})`);
                    }
                    // Get existing episodes for this season
                    const existingEpisodes = TVSeries_1.TVSeriesModel.findEpisodesBySeason(series.id, seasonNumber);
                    // Create episodes
                    for (const episode of episodes) {
                        const existing = existingEpisodes.find(e => e.episode_number === episode.number);
                        if (!existing) {
                            TVSeries_1.TVSeriesModel.createEpisode({
                                series_id: series.id,
                                season_number: seasonNumber,
                                episode_number: episode.number,
                                title: episode.name || `Episode ${episode.number}`,
                                overview: episode.overview || '',
                                air_date: episode.aired || null,
                                runtime: episode.runtime || null,
                                monitored: shouldMonitorSeason
                            });
                            totalEpisodes++;
                        }
                    }
                }
                catch (error) {
                    logger_1.default.error(`Failed to process season ${seasonNumber}:`, error);
                }
            }
            logger_1.default.info(`Fetched ${totalEpisodes} episodes from TVDB for: ${series.title}`);
            // Auto-scan for episode files
            if (series.folder_path && fs_1.default.existsSync(series.folder_path)) {
                await this.scanEpisodeFiles(series.id, series.folder_path, series.title);
            }
            return totalEpisodes;
        }
        catch (error) {
            logger_1.default.error(`TVDB fetch failed for ${series.title}, trying TMDB:`, error);
            if (series.tmdb_id) {
                return this.fetchFromTMDB(series);
            }
            return 0;
        }
    }
    /**
     * Fetch episodes from TMDB (fallback)
     */
    async fetchFromTMDB(series) {
        if (!series.tmdb_id) {
            logger_1.default.error(`Series missing TMDB ID: ${series.title}`);
            return 0;
        }
        logger_1.default.info(`Fetching episodes from TMDB for series: ${series.title}`);
        // Fetch series details from TMDB
        const tmdbData = await tmdb_1.tmdbService.getTVDetails(series.tmdb_id);
        if (!tmdbData.seasons) {
            logger_1.default.warn(`No seasons found for series: ${series.title}`);
            return 0;
        }
        let totalEpisodes = 0;
        const seriesMonitored = series.monitored !== false;
        const monitorNewSeasons = series.monitor_new_seasons || 'all';
        const seriesStatus = series.status || tmdbData.status;
        const isEnded = seriesStatus === 'Ended' || seriesStatus === 'Canceled';
        const today = new Date().toISOString().split('T')[0];
        // Sort seasons by number (descending to find current)
        const sortedSeasons = [...tmdbData.seasons].sort((a, b) => a.season_number - b.season_number);
        const nonSpecialSeasons = sortedSeasons.filter(s => s.season_number > 0);
        const latestSeasonNumber = nonSpecialSeasons.length > 0 ? nonSpecialSeasons[nonSpecialSeasons.length - 1].season_number : 1;
        // We'll need to fetch season details first to determine current season for 'current' mode
        // For simplicity, we'll assume the latest season is "current" if series is continuing
        let currentSeasonNumber = latestSeasonNumber;
        for (const season of sortedSeasons) {
            try {
                const existingSeasons = TVSeries_1.TVSeriesModel.findSeasonsBySeriesId(series.id);
                let dbSeason = existingSeasons.find(s => s.season_number === season.season_number);
                // Determine if this season should be monitored based on preference
                let shouldMonitorSeason = false;
                if (season.season_number === 0) {
                    // Never monitor specials by default
                    shouldMonitorSeason = false;
                }
                else if (!seriesMonitored) {
                    shouldMonitorSeason = false;
                }
                else {
                    switch (monitorNewSeasons) {
                        case 'all':
                            shouldMonitorSeason = true;
                            break;
                        case 'future':
                            // Only monitor seasons entirely in the future (air_date not yet passed)
                            shouldMonitorSeason = season.air_date ? season.air_date > today : false;
                            break;
                        case 'current':
                            // Only monitor current season if series is not ended
                            if (isEnded) {
                                shouldMonitorSeason = false;
                            }
                            else {
                                // Monitor only the latest/current season
                                shouldMonitorSeason = season.season_number === currentSeasonNumber;
                            }
                            break;
                        case 'none':
                            shouldMonitorSeason = false;
                            break;
                        default:
                            shouldMonitorSeason = true;
                    }
                }
                if (!dbSeason) {
                    dbSeason = TVSeries_1.TVSeriesModel.createSeason(series.id, season.season_number, shouldMonitorSeason);
                    logger_1.default.info(`Created season ${season.season_number} for: ${series.title} (monitored: ${shouldMonitorSeason})`);
                }
                const existingEpisodes = TVSeries_1.TVSeriesModel.findEpisodesBySeason(series.id, season.season_number);
                if (existingEpisodes.length > 0 && existingEpisodes.length >= (season.episode_count || 0)) {
                    continue;
                }
                logger_1.default.info(`Fetching season ${season.season_number} details for: ${series.title}`);
                const seasonDetails = await tmdb_1.tmdbService.getSeasonDetails(series.tmdb_id, season.season_number);
                if (!seasonDetails.episodes)
                    continue;
                // For 'current' mode, refine: only monitor if season has future episodes
                if (monitorNewSeasons === 'current' && season.season_number === currentSeasonNumber && !isEnded) {
                    const hasFutureEpisodes = seasonDetails.episodes.some((ep) => !ep.air_date || ep.air_date > today);
                    if (!hasFutureEpisodes) {
                        shouldMonitorSeason = false;
                        // Update the season to not be monitored
                        if (dbSeason) {
                            TVSeries_1.TVSeriesModel.updateSeasonMonitored(dbSeason.id, false);
                        }
                    }
                }
                for (const episode of seasonDetails.episodes) {
                    const existing = existingEpisodes.find(e => e.episode_number === episode.episode_number);
                    if (!existing) {
                        TVSeries_1.TVSeriesModel.createEpisode({
                            series_id: series.id,
                            season_number: season.season_number,
                            episode_number: episode.episode_number,
                            title: episode.name,
                            overview: episode.overview,
                            air_date: episode.air_date,
                            runtime: episode.runtime || null,
                            vote_average: episode.vote_average || null,
                            vote_count: episode.vote_count || null,
                            monitored: shouldMonitorSeason
                        });
                        totalEpisodes++;
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            catch (error) {
                logger_1.default.error(`Failed to fetch season ${season.season_number}:`, error);
            }
        }
        logger_1.default.info(`Fetched ${totalEpisodes} episodes from TMDB for: ${series.title}`);
        if (series.folder_path && fs_1.default.existsSync(series.folder_path)) {
            await this.scanEpisodeFiles(series.id, series.folder_path, series.title);
        }
        return totalEpisodes;
    }
    /**
     * Scan folder for episode files and match them to episodes in database
     */
    async scanEpisodeFiles(seriesId, folderPath, seriesTitle) {
        try {
            logger_1.default.info(`Auto-scanning episode files for: ${seriesTitle}`);
            const videoFiles = this.findAllVideoFiles(folderPath);
            let matchedCount = 0;
            for (const file of videoFiles) {
                const episodeInfo = this.parseEpisodeFilename(file.filename);
                if (episodeInfo.season !== undefined && episodeInfo.episode !== undefined) {
                    const episodes = TVSeries_1.TVSeriesModel.findEpisodesBySeason(seriesId, episodeInfo.season);
                    const dbEpisode = episodes.find(e => e.episode_number === episodeInfo.episode);
                    if (dbEpisode) {
                        // Parse release group from filename
                        const releaseGroupMatch = file.filename.match(/-([A-Za-z0-9]+)(?:\.[^.]+)?$/);
                        const releaseGroup = releaseGroupMatch ? releaseGroupMatch[1] : undefined;
                        TVSeries_1.TVSeriesModel.updateEpisodeFile(dbEpisode.id, file.path, file.size, episodeInfo.quality || '', undefined, // videoCodec
                        undefined, // audioCodec
                        releaseGroup);
                        matchedCount++;
                    }
                }
            }
            logger_1.default.info(`Auto-matched ${matchedCount} episode files for: ${seriesTitle}`);
        }
        catch (error) {
            logger_1.default.error(`Failed to auto-scan episodes for ${seriesTitle}:`, error);
        }
    }
    /**
     * Find all video files recursively
     */
    findAllVideoFiles(dir) {
        const files = [];
        try {
            const items = fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path_1.default.join(dir, item.name);
                if (item.isDirectory()) {
                    files.push(...this.findAllVideoFiles(fullPath));
                }
                else if (item.isFile()) {
                    const ext = path_1.default.extname(item.name).toLowerCase();
                    if (VIDEO_EXTENSIONS.includes(ext)) {
                        const stats = fs_1.default.statSync(fullPath);
                        files.push({
                            path: fullPath,
                            filename: item.name,
                            size: stats.size
                        });
                    }
                }
            }
        }
        catch (error) {
            logger_1.default.error(`Failed to read directory ${dir}:`, error);
        }
        return files;
    }
    /**
     * Parse episode filename to extract season/episode info
     */
    parseEpisodeFilename(filename) {
        // Try S01E01 format
        const seMatch = filename.match(/[Ss](\d{1,2})[Ee](\d{1,2})/);
        if (seMatch) {
            return {
                season: parseInt(seMatch[1]),
                episode: parseInt(seMatch[2]),
                quality: this.extractQuality(filename)
            };
        }
        // Try 1x01 format
        const xMatch = filename.match(/(\d{1,2})x(\d{1,2})/);
        if (xMatch) {
            return {
                season: parseInt(xMatch[1]),
                episode: parseInt(xMatch[2]),
                quality: this.extractQuality(filename)
            };
        }
        return {};
    }
    /**
     * Extract quality info from filename
     */
    extractQuality(filename) {
        const upperFilename = filename.toUpperCase();
        if (upperFilename.includes('2160P') || upperFilename.includes('4K') || upperFilename.includes('UHD')) {
            return '2160p';
        }
        if (upperFilename.includes('1080P'))
            return '1080p';
        if (upperFilename.includes('720P'))
            return '720p';
        if (upperFilename.includes('480P'))
            return '480p';
        if (upperFilename.includes('BLURAY') || upperFilename.includes('BLU-RAY'))
            return 'BluRay';
        if (upperFilename.includes('WEBDL') || upperFilename.includes('WEB-DL'))
            return 'WEBDL';
        if (upperFilename.includes('WEBRIP'))
            return 'WEBRip';
        if (upperFilename.includes('HDTV'))
            return 'HDTV';
        return '';
    }
    /**
     * Update episodes for a series (fetch new episodes for existing seasons)
     */
    async updateEpisodes(seriesId) {
        try {
            const series = TVSeries_1.TVSeriesModel.findById(seriesId);
            if (!series || !series.tmdb_id) {
                return 0;
            }
            logger_1.default.info(`Updating episodes for series: ${series.title}`);
            const tmdbData = await tmdb_1.tmdbService.getTVDetails(series.tmdb_id);
            const seasons = TVSeries_1.TVSeriesModel.findSeasonsBySeriesId(seriesId);
            let newEpisodes = 0;
            for (const season of seasons) {
                try {
                    const seasonDetails = await tmdb_1.tmdbService.getSeasonDetails(series.tmdb_id, season.season_number);
                    if (!seasonDetails.episodes)
                        continue;
                    const existingEpisodes = TVSeries_1.TVSeriesModel.findEpisodesBySeason(seriesId, season.season_number);
                    for (const episode of seasonDetails.episodes) {
                        const existing = existingEpisodes.find(e => e.episode_number === episode.episode_number);
                        if (!existing) {
                            TVSeries_1.TVSeriesModel.createEpisode({
                                series_id: seriesId,
                                season_number: season.season_number,
                                episode_number: episode.episode_number,
                                title: episode.name,
                                overview: episode.overview,
                                air_date: episode.air_date,
                                monitored: season.monitored
                            });
                            newEpisodes++;
                        }
                    }
                    await new Promise(resolve => setTimeout(resolve, 250));
                }
                catch (error) {
                    logger_1.default.error(`Failed to update season ${season.season_number}:`, error);
                }
            }
            if (newEpisodes > 0) {
                logger_1.default.info(`Added ${newEpisodes} new episodes for: ${series.title}`);
            }
            return newEpisodes;
        }
        catch (error) {
            logger_1.default.error('Failed to update episodes:', error);
            return 0;
        }
    }
}
exports.EpisodeFetcherService = EpisodeFetcherService;
exports.episodeFetcherService = new EpisodeFetcherService();
//# sourceMappingURL=episodeFetcher.js.map