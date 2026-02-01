"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarController = void 0;
const TVSeries_1 = require("../models/TVSeries");
const Movie_1 = require("../models/Movie");
const logger_1 = __importDefault(require("../config/logger"));
class CalendarController {
    static async getUpcoming(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const { start, end } = req.query;
            // Get all monitored series
            const series = TVSeries_1.TVSeriesModel.findMonitored();
            // Get all episodes for monitored series
            const allEpisodes = [];
            for (const s of series) {
                const episodes = TVSeries_1.TVSeriesModel.findEpisodesBySeriesId(s.id);
                const episodesWithSeries = episodes.map(e => ({
                    ...e,
                    type: 'episode',
                    series_title: s.title,
                    series_poster: s.poster_path
                }));
                allEpisodes.push(...episodesWithSeries);
            }
            // Get monitored movies with future release dates
            const allMovies = Movie_1.MovieModel.findMonitored();
            const upcomingMovies = allMovies
                .filter(m => m.theatrical_release_date || m.digital_release_date || m.physical_release_date)
                .map(m => {
                // Use the earliest available release date
                const releaseDate = m.theatrical_release_date || m.digital_release_date || m.physical_release_date;
                return {
                    id: m.id,
                    type: 'movie',
                    title: m.title,
                    release_date: releaseDate,
                    air_date: releaseDate, // Use air_date field for consistency with episodes
                    poster_path: m.poster_path,
                    has_file: m.has_file,
                    monitored: m.monitored,
                    year: m.year,
                    tmdb_id: m.tmdb_id
                };
            });
            // Filter episodes by date range if provided
            let filteredEpisodes = allEpisodes;
            if (start) {
                filteredEpisodes = filteredEpisodes.filter(e => e.air_date && e.air_date >= start);
            }
            if (end) {
                filteredEpisodes = filteredEpisodes.filter(e => e.air_date && e.air_date <= end);
            }
            // Filter movies by date range if provided
            let filteredMovies = upcomingMovies;
            if (start) {
                filteredMovies = filteredMovies.filter(m => m.air_date && m.air_date >= start);
            }
            if (end) {
                filteredMovies = filteredMovies.filter(m => m.air_date && m.air_date <= end);
            }
            // Combine episodes and movies
            const combined = [...filteredEpisodes, ...filteredMovies];
            // Sort by air date
            combined.sort((a, b) => {
                if (!a.air_date)
                    return 1;
                if (!b.air_date)
                    return -1;
                return a.air_date.localeCompare(b.air_date);
            });
            return res.json(combined);
        }
        catch (error) {
            logger_1.default.error('Get upcoming error:', error);
            return res.status(500).json({ error: 'Failed to get upcoming episodes' });
        }
    }
    static async getMissing(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const missingEpisodes = TVSeries_1.TVSeriesModel.findMissingEpisodes();
            // Enrich with series info
            const enriched = [];
            for (const episode of missingEpisodes) {
                const series = TVSeries_1.TVSeriesModel.findById(episode.series_id);
                if (series) {
                    enriched.push({
                        ...episode,
                        series_title: series.title,
                        series_poster: series.poster_path
                    });
                }
            }
            return res.json(enriched);
        }
        catch (error) {
            logger_1.default.error('Get missing error:', error);
            return res.status(500).json({ error: 'Failed to get missing episodes' });
        }
    }
}
exports.CalendarController = CalendarController;
//# sourceMappingURL=CalendarController.js.map