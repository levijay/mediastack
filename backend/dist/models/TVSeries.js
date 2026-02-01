"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TVSeriesModel = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
class TVSeriesModel {
    static create(data) {
        const id = (0, uuid_1.v4)();
        const stmt = database_1.default.prepare(`
      INSERT INTO tv_series (
        id, tvdb_id, tmdb_id, imdb_id, title, status, overview, network, year,
        vote_average, vote_count, poster_path, backdrop_path, folder_path, 
        quality_profile_id, language_profile_id, monitored, season_folder,
        cast_data, crew_data, genres
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.tvdb_id || null, data.tmdb_id || null, data.imdb_id || null, data.title, data.status || null, data.overview || null, data.network || null, data.year || null, data.vote_average || null, data.vote_count || null, data.poster_path || null, data.backdrop_path || null, data.folder_path, data.quality_profile_id || null, data.language_profile_id || null, data.monitored !== false ? 1 : 0, data.season_folder !== false ? 1 : 0, data.cast_data ? JSON.stringify(data.cast_data) : null, data.crew_data ? JSON.stringify(data.crew_data) : null, data.genres ? JSON.stringify(data.genres) : null);
        return this.findById(id);
    }
    static parseSeries(row) {
        return {
            ...row,
            monitored: row.monitored === 1,
            season_folder: row.season_folder === 1,
            tags: row.tags ? JSON.parse(row.tags) : [],
            cast_data: row.cast_data ? JSON.parse(row.cast_data) : null,
            crew_data: row.crew_data ? JSON.parse(row.crew_data) : null,
            genres: row.genres ? JSON.parse(row.genres) : null,
        };
    }
    static findById(id) {
        const stmt = database_1.default.prepare('SELECT * FROM tv_series WHERE id = ?');
        const series = stmt.get(id);
        if (!series)
            return undefined;
        return this.parseSeries(series);
    }
    static findByTmdbId(tmdbId) {
        const stmt = database_1.default.prepare('SELECT * FROM tv_series WHERE tmdb_id = ?');
        const series = stmt.get(tmdbId);
        if (!series)
            return undefined;
        return this.parseSeries(series);
    }
    static findByTvdbId(tvdbId) {
        const stmt = database_1.default.prepare('SELECT * FROM tv_series WHERE tvdb_id = ?');
        const series = stmt.get(tvdbId);
        if (!series)
            return undefined;
        return this.parseSeries(series);
    }
    static findAll(limit = 100, offset = 0) {
        const stmt = database_1.default.prepare(`
      SELECT s.*, 
        COALESCE(ep.episode_count, 0) as episode_count,
        COALESCE(ep.downloaded_count, 0) as downloaded_count,
        COALESCE(ep.total_size, 0) as total_size
      FROM tv_series s
      LEFT JOIN (
        SELECT series_id, 
          COUNT(*) as episode_count,
          SUM(CASE WHEN has_file = 1 THEN 1 ELSE 0 END) as downloaded_count,
          SUM(COALESCE(file_size, 0)) as total_size
        FROM episodes 
        WHERE season_number > 0
        GROUP BY series_id
      ) ep ON s.id = ep.series_id
      ORDER BY s.title ASC
      LIMIT ? OFFSET ?
    `);
        return stmt.all(limit, offset).map(s => this.parseSeries(s));
    }
    static findRecentlyAdded(limit = 20) {
        const stmt = database_1.default.prepare(`
      SELECT s.*, 
        COALESCE(ep.episode_count, 0) as episode_count,
        COALESCE(ep.downloaded_count, 0) as downloaded_count,
        COALESCE(ep.total_size, 0) as total_size
      FROM tv_series s
      LEFT JOIN (
        SELECT series_id, 
          COUNT(*) as episode_count,
          SUM(CASE WHEN has_file = 1 THEN 1 ELSE 0 END) as downloaded_count,
          SUM(COALESCE(file_size, 0)) as total_size
        FROM episodes 
        WHERE season_number > 0
        GROUP BY series_id
      ) ep ON s.id = ep.series_id
      ORDER BY s.created_at DESC
      LIMIT ?
    `);
        return stmt.all(limit).map(s => this.parseSeries(s));
    }
    static count() {
        const totalStmt = database_1.default.prepare('SELECT COUNT(*) as count FROM tv_series');
        const monitoredStmt = database_1.default.prepare('SELECT COUNT(*) as count FROM tv_series WHERE monitored = 1');
        return {
            total: totalStmt.get().count,
            monitored: monitoredStmt.get().count
        };
    }
    static getAllFolderPaths() {
        const stmt = database_1.default.prepare('SELECT folder_path FROM tv_series WHERE folder_path IS NOT NULL');
        return stmt.all().map(s => s.folder_path);
    }
    static findMonitored() {
        const stmt = database_1.default.prepare(`
      SELECT s.*, 
        COALESCE(ep.episode_count, 0) as episode_count,
        COALESCE(ep.downloaded_count, 0) as downloaded_count,
        COALESCE(ep.total_size, 0) as total_size
      FROM tv_series s
      LEFT JOIN (
        SELECT series_id, 
          COUNT(*) as episode_count,
          SUM(CASE WHEN has_file = 1 THEN 1 ELSE 0 END) as downloaded_count,
          SUM(COALESCE(file_size, 0)) as total_size
        FROM episodes 
        WHERE season_number > 0
        GROUP BY series_id
      ) ep ON s.id = ep.series_id
      WHERE s.monitored = 1
      ORDER BY s.title ASC
    `);
        return stmt.all().map(s => this.parseSeries(s));
    }
    static updateMonitored(id, monitored) {
        const stmt = database_1.default.prepare(`
      UPDATE tv_series 
      SET monitored = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(monitored ? 1 : 0, id);
        // Cascade to all seasons and episodes
        const seasonStmt = database_1.default.prepare(`
      UPDATE seasons SET monitored = ? WHERE series_id = ?
    `);
        seasonStmt.run(monitored ? 1 : 0, id);
        const episodeStmt = database_1.default.prepare(`
      UPDATE episodes SET monitored = ? WHERE series_id = ?
    `);
        episodeStmt.run(monitored ? 1 : 0, id);
        return this.findById(id);
    }
    static delete(id) {
        const stmt = database_1.default.prepare('DELETE FROM tv_series WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    static deleteSeasonsBySeriesId(seriesId) {
        const stmt = database_1.default.prepare('DELETE FROM seasons WHERE series_id = ?');
        const result = stmt.run(seriesId);
        return result.changes;
    }
    static deleteEpisodesBySeriesId(seriesId) {
        const stmt = database_1.default.prepare('DELETE FROM episodes WHERE series_id = ?');
        const result = stmt.run(seriesId);
        return result.changes;
    }
    // Season management
    static createSeason(seriesId, seasonNumber, monitored = true) {
        const id = (0, uuid_1.v4)();
        const stmt = database_1.default.prepare(`
      INSERT INTO seasons (id, series_id, season_number, monitored)
      VALUES (?, ?, ?, ?)
    `);
        stmt.run(id, seriesId, seasonNumber, monitored ? 1 : 0);
        return this.findSeasonById(id);
    }
    static findSeasonById(id) {
        const stmt = database_1.default.prepare('SELECT * FROM seasons WHERE id = ?');
        const season = stmt.get(id);
        if (!season)
            return undefined;
        return { ...season, monitored: season.monitored === 1 };
    }
    static findSeasonsBySeriesId(seriesId) {
        const stmt = database_1.default.prepare('SELECT * FROM seasons WHERE series_id = ? ORDER BY season_number ASC');
        return stmt.all(seriesId).map(s => ({ ...s, monitored: s.monitored === 1 }));
    }
    static updateSeasonMonitored(id, monitored) {
        const stmt = database_1.default.prepare(`
      UPDATE seasons 
      SET monitored = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(monitored ? 1 : 0, id);
        // Cascade to all episodes in this season
        const season = this.findSeasonById(id);
        if (season) {
            const episodeStmt = database_1.default.prepare(`
        UPDATE episodes SET monitored = ? WHERE series_id = ? AND season_number = ?
      `);
            episodeStmt.run(monitored ? 1 : 0, season.series_id, season.season_number);
        }
        return season;
    }
    // Episode management
    static createEpisode(data) {
        const id = (0, uuid_1.v4)();
        const stmt = database_1.default.prepare(`
      INSERT INTO episodes (
        id, series_id, season_number, episode_number, title, overview, air_date, runtime, vote_average, vote_count, monitored
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.series_id, data.season_number, data.episode_number, data.title, data.overview || null, data.air_date || null, data.runtime || null, data.vote_average || null, data.vote_count || null, data.monitored !== false ? 1 : 0);
        return this.findEpisodeById(id);
    }
    static findEpisodeById(id) {
        const stmt = database_1.default.prepare('SELECT * FROM episodes WHERE id = ?');
        const episode = stmt.get(id);
        if (!episode)
            return undefined;
        return {
            ...episode,
            has_file: episode.has_file === 1,
            monitored: episode.monitored === 1
        };
    }
    static findEpisodesBySeriesId(seriesId) {
        const stmt = database_1.default.prepare(`
      SELECT * FROM episodes 
      WHERE series_id = ? 
      ORDER BY season_number ASC, episode_number ASC
    `);
        return stmt.all(seriesId).map(e => ({
            ...e,
            has_file: e.has_file === 1,
            monitored: e.monitored === 1
        }));
    }
    static findEpisodesBySeason(seriesId, seasonNumber) {
        const stmt = database_1.default.prepare(`
      SELECT * FROM episodes 
      WHERE series_id = ? AND season_number = ? 
      ORDER BY episode_number ASC
    `);
        return stmt.all(seriesId, seasonNumber).map(e => ({
            ...e,
            has_file: e.has_file === 1,
            monitored: e.monitored === 1
        }));
    }
    static findMissingEpisodes(seriesId) {
        const query = seriesId
            ? `SELECT * FROM episodes WHERE series_id = ? AND monitored = 1 AND has_file = 0 ORDER BY air_date DESC`
            : `SELECT * FROM episodes WHERE monitored = 1 AND has_file = 0 ORDER BY air_date DESC LIMIT 100`;
        const stmt = database_1.default.prepare(query);
        const results = seriesId ? stmt.all(seriesId) : stmt.all();
        return results.map(e => ({
            ...e,
            has_file: e.has_file === 1,
            monitored: e.monitored === 1
        }));
    }
    static updateEpisodeFile(id, filePath, fileSize, quality, videoCodec, audioCodec, releaseGroup) {
        const stmt = database_1.default.prepare(`
      UPDATE episodes 
      SET has_file = 1, file_path = ?, file_size = ?, quality = ?, video_codec = ?, audio_codec = ?, release_group = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(filePath, fileSize, quality, videoCodec || null, audioCodec || null, releaseGroup || null, id);
        return this.findEpisodeById(id);
    }
    static clearEpisodeFile(id) {
        const stmt = database_1.default.prepare(`
      UPDATE episodes 
      SET has_file = 0, file_path = NULL, file_size = NULL, quality = NULL, video_codec = NULL, audio_codec = NULL, release_group = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(id);
        return this.findEpisodeById(id);
    }
    static clearSeasonFiles(seriesId, seasonNumber) {
        const stmt = database_1.default.prepare(`
      UPDATE episodes 
      SET has_file = 0, file_path = NULL, file_size = NULL, quality = NULL, video_codec = NULL, audio_codec = NULL, release_group = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE series_id = ? AND season_number = ?
    `);
        const result = stmt.run(seriesId, seasonNumber);
        return result.changes;
    }
    static updateEpisodeMonitored(id, monitored) {
        const stmt = database_1.default.prepare(`
      UPDATE episodes 
      SET monitored = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(monitored ? 1 : 0, id);
        return this.findEpisodeById(id);
    }
    static updateQualityProfile(id, qualityProfileId) {
        const stmt = database_1.default.prepare(`
      UPDATE tv_series 
      SET quality_profile_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(qualityProfileId, id);
        return this.findById(id);
    }
    static updateFolderPath(id, folderPath) {
        const stmt = database_1.default.prepare(`
      UPDATE tv_series 
      SET folder_path = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(folderPath, id);
        return this.findById(id);
    }
    static updateSeriesType(id, seriesType) {
        const stmt = database_1.default.prepare(`
      UPDATE tv_series 
      SET series_type = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(seriesType, id);
        return this.findById(id);
    }
    static updateUseSeasonFolder(id, useSeasonFolder) {
        const stmt = database_1.default.prepare(`
      UPDATE tv_series 
      SET use_season_folder = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(useSeasonFolder ? 1 : 0, id);
        return this.findById(id);
    }
    static updateMonitorNewSeasons(id, monitorNewSeasons) {
        const stmt = database_1.default.prepare(`
      UPDATE tv_series 
      SET monitor_new_seasons = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(monitorNewSeasons, id);
        return this.findById(id);
    }
    static updateTags(id, tags) {
        const stmt = database_1.default.prepare(`
      UPDATE tv_series 
      SET tags = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(JSON.stringify(tags), id);
        return this.findById(id);
    }
    static updateMetadata(id, data) {
        const updates = [];
        const values = [];
        if (data.title !== undefined) {
            updates.push('title = ?');
            values.push(data.title);
        }
        if (data.status !== undefined) {
            updates.push('status = ?');
            values.push(data.status);
        }
        if (data.overview !== undefined) {
            updates.push('overview = ?');
            values.push(data.overview);
        }
        if (data.network !== undefined) {
            updates.push('network = ?');
            values.push(data.network);
        }
        if (data.vote_average !== undefined) {
            updates.push('vote_average = ?');
            values.push(data.vote_average);
        }
        if (data.vote_count !== undefined) {
            updates.push('vote_count = ?');
            values.push(data.vote_count);
        }
        if (data.poster_path !== undefined) {
            updates.push('poster_path = ?');
            values.push(data.poster_path);
        }
        if (data.backdrop_path !== undefined) {
            updates.push('backdrop_path = ?');
            values.push(data.backdrop_path);
        }
        if (updates.length === 0)
            return this.findById(id);
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        const stmt = database_1.default.prepare(`
      UPDATE tv_series 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
        stmt.run(...values);
        return this.findById(id);
    }
    /**
     * Update cast, crew, genres, and certification data for a series
     */
    static updateMediaMetadata(id, data) {
        const updates = [];
        const values = [];
        if (data.cast_data !== undefined) {
            updates.push('cast_data = ?');
            values.push(JSON.stringify(data.cast_data));
        }
        if (data.crew_data !== undefined) {
            updates.push('crew_data = ?');
            values.push(JSON.stringify(data.crew_data));
        }
        if (data.genres !== undefined) {
            updates.push('genres = ?');
            values.push(JSON.stringify(data.genres));
        }
        if (data.certification !== undefined) {
            updates.push('certification = ?');
            values.push(data.certification);
        }
        if (updates.length === 0)
            return this.findById(id);
        values.push(id);
        const stmt = database_1.default.prepare(`UPDATE tv_series SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
        stmt.run(...values);
        return this.findById(id);
    }
    /**
     * Find related series - prioritizes franchise/spinoffs, then supplements with actor matches
     * Only shows truly related content, not weak genre-only matches
     */
    static findRelated(id, limit = 10) {
        const series = this.findById(id);
        if (!series)
            return [];
        const allSeries = database_1.default.prepare('SELECT * FROM tv_series WHERE id != ?').all(id);
        // Get top 5 lead actors (more strict)
        const seriesCast = series.cast_data || [];
        const leadActorIds = seriesCast.slice(0, 5).map((c) => c.id);
        // Normalize title for franchise detection
        const normalizeTitle = (title) => {
            return title.toLowerCase()
                .replace(/^(the|a|an)\s+/i, '')
                .replace(/[^\w\s]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        };
        const baseTitle = normalizeTitle(series.title);
        const franchiseTitle = baseTitle.split(/[:\-–]/)[0].trim();
        const franchiseMatches = [];
        const actorMatches = [];
        for (const row of allSeries) {
            const otherSeries = this.parseSeries(row);
            // 1. Title Match - spinoff/sequel detection (e.g., "Star Trek" → "Star Trek: Discovery")
            const otherTitle = normalizeTitle(otherSeries.title);
            const otherFranchise = otherTitle.split(/[:\-–]/)[0].trim();
            if (franchiseTitle.length >= 4 && (otherFranchise === franchiseTitle ||
                (franchiseTitle.length >= 6 && (otherFranchise.includes(franchiseTitle) || franchiseTitle.includes(otherFranchise))))) {
                franchiseMatches.push({
                    series: otherSeries,
                    score: 100,
                    reasons: ['Same franchise']
                });
                continue; // Don't double-count
            }
            // 2. Shared Lead Actors - require at least 2 shared actors from top 5 cast
            const otherCast = otherSeries.cast_data || [];
            const otherLeadIds = otherCast.slice(0, 5).map((c) => c.id);
            const sharedLeadActors = leadActorIds.filter(actorId => otherLeadIds.includes(actorId));
            if (sharedLeadActors.length >= 2) {
                const actorNames = seriesCast.filter((c) => sharedLeadActors.includes(c.id)).map((c) => c.name).slice(0, 2);
                actorMatches.push({
                    series: otherSeries,
                    score: 50 + (sharedLeadActors.length * 10),
                    reasons: [actorNames.join(', ')]
                });
            }
        }
        // Sort actor matches by score
        actorMatches.sort((a, b) => b.score - a.score);
        // Combine: all franchise matches first, then fill with actor matches
        const results = [...franchiseMatches];
        const remaining = limit - results.length;
        if (remaining > 0) {
            results.push(...actorMatches.slice(0, remaining));
        }
        return results.slice(0, limit);
    }
}
exports.TVSeriesModel = TVSeriesModel;
//# sourceMappingURL=TVSeries.js.map