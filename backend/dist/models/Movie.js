"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovieModel = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
class MovieModel {
    static create(data) {
        const id = (0, uuid_1.v4)();
        const stmt = database_1.default.prepare(`
      INSERT INTO movies (
        id, tmdb_id, title, year, overview, runtime, vote_average, vote_count,
        poster_path, backdrop_path, folder_path, quality_profile_id, monitored, has_file, file_size, quality,
        minimum_availability, theatrical_release_date, digital_release_date, physical_release_date, tmdb_status,
        cast_data, crew_data, genres, collection_id, collection_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.tmdb_id, data.title, data.year || null, data.overview || null, data.runtime || null, data.vote_average || null, data.vote_count || null, data.poster_path || null, data.backdrop_path || null, data.folder_path, data.quality_profile_id || null, data.monitored !== false ? 1 : 0, data.has_file ? 1 : 0, data.file_size || null, data.quality || null, data.minimum_availability || 'announced', data.theatrical_release_date || null, data.digital_release_date || null, data.physical_release_date || null, data.tmdb_status || null, data.cast_data ? JSON.stringify(data.cast_data) : null, data.crew_data ? JSON.stringify(data.crew_data) : null, data.genres ? JSON.stringify(data.genres) : null, data.collection_id || null, data.collection_name || null);
        return this.findById(id);
    }
    static parseMovie(row) {
        return {
            ...row,
            monitored: row.monitored === 1,
            has_file: row.has_file === 1,
            cast_data: row.cast_data ? JSON.parse(row.cast_data) : null,
            crew_data: row.crew_data ? JSON.parse(row.crew_data) : null,
            genres: row.genres ? JSON.parse(row.genres) : null,
        };
    }
    static findById(id) {
        const stmt = database_1.default.prepare('SELECT * FROM movies WHERE id = ?');
        const movie = stmt.get(id);
        if (!movie)
            return undefined;
        return this.parseMovie(movie);
    }
    static findByTmdbId(tmdbId) {
        const stmt = database_1.default.prepare('SELECT * FROM movies WHERE tmdb_id = ?');
        const movie = stmt.get(tmdbId);
        if (!movie)
            return undefined;
        return this.parseMovie(movie);
    }
    static findAll(limit = 100, offset = 0) {
        const stmt = database_1.default.prepare(`
      SELECT m.*, 
        COALESCE(mf.total_size, m.file_size, 0) as file_size,
        COALESCE(mf.quality, m.quality) as quality
      FROM movies m
      LEFT JOIN (
        SELECT movie_id, 
          SUM(file_size) as total_size,
          MAX(quality) as quality
        FROM movie_files 
        GROUP BY movie_id
      ) mf ON m.id = mf.movie_id
      ORDER BY m.title ASC
      LIMIT ? OFFSET ?
    `);
        return stmt.all(limit, offset).map(m => this.parseMovie(m));
    }
    static findRecentlyAdded(limit = 20) {
        const stmt = database_1.default.prepare(`
      SELECT m.*, 
        COALESCE(mf.total_size, m.file_size, 0) as file_size,
        COALESCE(mf.quality, m.quality) as quality
      FROM movies m
      LEFT JOIN (
        SELECT movie_id, 
          SUM(file_size) as total_size,
          MAX(quality) as quality
        FROM movie_files 
        GROUP BY movie_id
      ) mf ON m.id = mf.movie_id
      ORDER BY m.created_at DESC
      LIMIT ?
    `);
        return stmt.all(limit).map(m => this.parseMovie(m));
    }
    static count() {
        const totalStmt = database_1.default.prepare('SELECT COUNT(*) as count FROM movies');
        const monitoredStmt = database_1.default.prepare('SELECT COUNT(*) as count FROM movies WHERE monitored = 1');
        const missingStmt = database_1.default.prepare('SELECT COUNT(*) as count FROM movies WHERE monitored = 1 AND has_file = 0');
        const availableStmt = database_1.default.prepare('SELECT COUNT(*) as count FROM movies WHERE has_file = 1');
        return {
            total: totalStmt.get().count,
            monitored: monitoredStmt.get().count,
            missing: missingStmt.get().count,
            available: availableStmt.get().count
        };
    }
    static getAllFolderPaths() {
        const stmt = database_1.default.prepare('SELECT folder_path FROM movies WHERE folder_path IS NOT NULL');
        return stmt.all().map(m => m.folder_path);
    }
    static findMonitored() {
        const stmt = database_1.default.prepare(`
      SELECT m.*, 
        COALESCE(mf.total_size, m.file_size, 0) as file_size,
        COALESCE(mf.quality, m.quality) as quality
      FROM movies m
      LEFT JOIN (
        SELECT movie_id, 
          SUM(file_size) as total_size,
          MAX(quality) as quality
        FROM movie_files 
        GROUP BY movie_id
      ) mf ON m.id = mf.movie_id
      WHERE m.monitored = 1
      ORDER BY m.title ASC
    `);
        return stmt.all().map(m => ({
            ...m,
            monitored: m.monitored === 1,
            has_file: m.has_file === 1
        }));
    }
    static findMissing() {
        const stmt = database_1.default.prepare(`
      SELECT m.*, 
        COALESCE(mf.total_size, m.file_size, 0) as file_size,
        COALESCE(mf.quality, m.quality) as quality
      FROM movies m
      LEFT JOIN (
        SELECT movie_id, 
          SUM(file_size) as total_size,
          MAX(quality) as quality
        FROM movie_files 
        GROUP BY movie_id
      ) mf ON m.id = mf.movie_id
      WHERE m.monitored = 1 AND m.has_file = 0
      ORDER BY m.title ASC
    `);
        return stmt.all().map(m => ({
            ...m,
            monitored: m.monitored === 1,
            has_file: m.has_file === 1
        }));
    }
    /**
     * Find missing movies that are actually available for download based on minimum_availability
     * - announced: Any movie that has been announced
     * - inCinemas: Movie has theatrical release date in the past
     * - released: Movie has digital or physical release date in the past, OR theatrical 90+ days ago
     */
    static findMissingAndAvailable() {
        const today = new Date().toISOString().split('T')[0];
        const currentYear = new Date().getFullYear();
        const stmt = database_1.default.prepare(`
      SELECT m.*, 
        COALESCE(mf.total_size, m.file_size, 0) as file_size,
        COALESCE(mf.quality, m.quality) as quality
      FROM movies m
      LEFT JOIN (
        SELECT movie_id, 
          SUM(file_size) as total_size,
          MAX(quality) as quality
        FROM movie_files 
        GROUP BY movie_id
      ) mf ON m.id = mf.movie_id
      WHERE m.monitored = 1 AND m.has_file = 0
        AND (
          -- Announced: always available (except cancelled)
          (m.minimum_availability = 'announced' AND (m.tmdb_status IS NULL OR m.tmdb_status != 'Canceled'))
          -- In Cinemas: theatrical release date is in the past OR status is Released
          OR (m.minimum_availability = 'inCinemas' AND (
            m.theatrical_release_date <= ? 
            OR m.tmdb_status = 'Released'
          ))
          -- Released: digital or physical release date is in the past
          OR (m.minimum_availability = 'released' AND (
            m.digital_release_date <= ? 
            OR m.physical_release_date <= ?
            -- Fallback: theatrical was 90+ days ago and no digital/physical date
            OR (m.theatrical_release_date IS NOT NULL 
                AND m.digital_release_date IS NULL 
                AND m.physical_release_date IS NULL
                AND julianday(?) - julianday(m.theatrical_release_date) >= 90)
            -- Fallback: TMDB says Released and movie is from previous year
            OR (m.tmdb_status = 'Released' AND m.year < ?)
          ))
          -- Fallback for movies without minimum_availability set - use release date or fallbacks
          OR (m.minimum_availability IS NULL AND (
            m.digital_release_date <= ? 
            OR m.physical_release_date <= ?
            OR (m.tmdb_status = 'Released' AND m.year < ?)
            OR (m.theatrical_release_date IS NOT NULL 
                AND m.digital_release_date IS NULL 
                AND m.physical_release_date IS NULL
                AND julianday(?) - julianday(m.theatrical_release_date) >= 90)
          ))
        )
      ORDER BY m.title ASC
    `);
        return stmt.all(today, today, today, today, currentYear, today, today, currentYear, today).map(m => ({
            ...m,
            monitored: m.monitored === 1,
            has_file: m.has_file === 1
        }));
    }
    /**
     * Check if a specific movie is available based on its minimum_availability setting
     */
    static isMovieAvailable(movie) {
        const today = new Date().toISOString().split('T')[0];
        const todayDate = new Date();
        const availability = movie.minimum_availability || 'released';
        // Cancelled movies are never available
        if (movie.tmdb_status === 'Canceled') {
            return false;
        }
        switch (availability) {
            case 'announced':
                // Always available if announced
                return true;
            case 'inCinemas':
                // Available if theatrical date is past or status is Released
                if (movie.tmdb_status === 'Released')
                    return true;
                if (movie.theatrical_release_date && movie.theatrical_release_date <= today)
                    return true;
                return false;
            case 'released':
            default:
                // Available if digital or physical date is past
                if (movie.digital_release_date && movie.digital_release_date <= today)
                    return true;
                if (movie.physical_release_date && movie.physical_release_date <= today)
                    return true;
                // Fallback: If no digital/physical date but theatrical was 90+ days ago, 
                // assume digital release is available (typical theatrical-to-digital window)
                if (movie.theatrical_release_date && !movie.digital_release_date && !movie.physical_release_date) {
                    const theatricalDate = new Date(movie.theatrical_release_date);
                    const daysSinceTheatrical = Math.floor((todayDate.getTime() - theatricalDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSinceTheatrical >= 90)
                        return true;
                }
                // Additional fallback: If TMDB says "Released" and it's been a while, assume available
                if (movie.tmdb_status === 'Released' && movie.year) {
                    const currentYear = todayDate.getFullYear();
                    // If movie is from previous year or earlier, likely available
                    if (movie.year < currentYear)
                        return true;
                }
                return false;
        }
    }
    // Find monitored movies that have files (for upgrade search)
    static findWithFiles() {
        const stmt = database_1.default.prepare(`
      SELECT m.*, 
        COALESCE(mf.total_size, m.file_size, 0) as file_size,
        COALESCE(mf.quality, m.quality) as quality
      FROM movies m
      LEFT JOIN (
        SELECT movie_id, 
          SUM(file_size) as total_size,
          MAX(quality) as quality
        FROM movie_files 
        GROUP BY movie_id
      ) mf ON m.id = mf.movie_id
      WHERE m.monitored = 1 AND m.has_file = 1
      ORDER BY m.title ASC
    `);
        return stmt.all().map(m => ({
            ...m,
            monitored: m.monitored === 1,
            has_file: m.has_file === 1
        }));
    }
    static updateMonitored(id, monitored) {
        const stmt = database_1.default.prepare(`
      UPDATE movies 
      SET monitored = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(monitored ? 1 : 0, id);
        return this.findById(id);
    }
    static updateFile(id, filePath, fileSize, quality) {
        const stmt = database_1.default.prepare(`
      UPDATE movies 
      SET has_file = 1, file_path = ?, file_size = ?, quality = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(filePath, fileSize, quality, id);
        return this.findById(id);
    }
    static updateHasFile(id, hasFile) {
        const stmt = database_1.default.prepare(`
      UPDATE movies 
      SET has_file = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(hasFile ? 1 : 0, id);
        return this.findById(id);
    }
    static delete(id) {
        const stmt = database_1.default.prepare('DELETE FROM movies WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
    // Movie file methods
    static addMovieFile(data) {
        // Check if file with same path already exists for this movie
        const existingStmt = database_1.default.prepare('SELECT * FROM movie_files WHERE movie_id = ? AND file_path = ?');
        const existing = existingStmt.get(data.movie_id, data.file_path);
        if (existing) {
            // File already exists, return existing record instead of creating duplicate
            return existing;
        }
        const id = (0, uuid_1.v4)();
        const stmt = database_1.default.prepare(`
      INSERT INTO movie_files (
        id, movie_id, file_path, relative_path, file_size, quality, 
        resolution, video_codec, video_dynamic_range, audio_codec, 
        audio_channels, audio_languages, audio_track_count, subtitle_languages,
        runtime, scene_name, release_group, is_proper, is_repack
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, data.movie_id, data.file_path, data.relative_path || null, data.file_size, data.quality || null, data.resolution || null, data.video_codec || null, data.video_dynamic_range || null, data.audio_codec || null, data.audio_channels || null, data.audio_languages || null, data.audio_track_count || 1, data.subtitle_languages || null, data.runtime || null, data.scene_name || null, data.release_group || null, data.is_proper ? 1 : 0, data.is_repack ? 1 : 0);
        // Update movie has_file flag
        const updateStmt = database_1.default.prepare(`
      UPDATE movies SET has_file = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
        updateStmt.run(data.movie_id);
        return this.findMovieFileById(id);
    }
    static findMovieFileById(id) {
        const stmt = database_1.default.prepare('SELECT * FROM movie_files WHERE id = ?');
        return stmt.get(id);
    }
    static findMovieFiles(movieId) {
        const stmt = database_1.default.prepare('SELECT * FROM movie_files WHERE movie_id = ? ORDER BY created_at DESC');
        return stmt.all(movieId);
    }
    static deleteMovieFile(id) {
        const file = this.findMovieFileById(id);
        if (!file)
            return false;
        const stmt = database_1.default.prepare('DELETE FROM movie_files WHERE id = ?');
        const result = stmt.run(id);
        // Check if movie has any remaining files
        const remaining = this.findMovieFiles(file.movie_id);
        if (remaining.length === 0) {
            const updateStmt = database_1.default.prepare(`
        UPDATE movies SET has_file = 0, file_path = NULL, file_size = 0, quality = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `);
            updateStmt.run(file.movie_id);
        }
        return result.changes > 0;
    }
    static deleteMovieFilesByMovieId(movieId) {
        const stmt = database_1.default.prepare('DELETE FROM movie_files WHERE movie_id = ?');
        const result = stmt.run(movieId);
        return result.changes;
    }
    static updateMovieFilePath(fileId, newPath) {
        const stmt = database_1.default.prepare(`
      UPDATE movie_files 
      SET file_path = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(newPath, fileId);
        return this.findMovieFileById(fileId);
    }
    static updateMovieFile(fileId, data) {
        const updates = [];
        const values = [];
        if (data.quality !== undefined) {
            updates.push('quality = ?');
            values.push(data.quality);
        }
        if (data.video_codec !== undefined) {
            updates.push('video_codec = ?');
            values.push(data.video_codec);
        }
        if (data.audio_codec !== undefined) {
            updates.push('audio_codec = ?');
            values.push(data.audio_codec);
        }
        if (data.video_dynamic_range !== undefined) {
            updates.push('video_dynamic_range = ?');
            values.push(data.video_dynamic_range);
        }
        if (data.audio_channels !== undefined) {
            updates.push('audio_channels = ?');
            values.push(data.audio_channels);
        }
        if (data.audio_languages !== undefined) {
            updates.push('audio_languages = ?');
            values.push(data.audio_languages);
        }
        if (data.subtitle_languages !== undefined) {
            updates.push('subtitle_languages = ?');
            values.push(data.subtitle_languages);
        }
        if (data.release_group !== undefined) {
            updates.push('release_group = ?');
            values.push(data.release_group);
        }
        if (updates.length === 0) {
            return this.findMovieFileById(fileId);
        }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(fileId);
        const stmt = database_1.default.prepare(`
      UPDATE movie_files 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `);
        stmt.run(...values);
        return this.findMovieFileById(fileId);
    }
    static updateQualityProfile(id, qualityProfileId) {
        const stmt = database_1.default.prepare(`
      UPDATE movies 
      SET quality_profile_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(qualityProfileId, id);
        return this.findById(id);
    }
    static updateFolderPath(id, folderPath) {
        const stmt = database_1.default.prepare(`
      UPDATE movies 
      SET folder_path = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(folderPath, id);
        return this.findById(id);
    }
    static updateMinimumAvailability(id, minimumAvailability) {
        const stmt = database_1.default.prepare(`
      UPDATE movies 
      SET minimum_availability = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
        stmt.run(minimumAvailability, id);
        return this.findById(id);
    }
    static updateTags(id, tags) {
        const stmt = database_1.default.prepare(`
      UPDATE movies 
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
        if (data.overview !== undefined) {
            updates.push('overview = ?');
            values.push(data.overview);
        }
        if (data.runtime !== undefined) {
            updates.push('runtime = ?');
            values.push(data.runtime);
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
        if (data.tmdb_status !== undefined) {
            updates.push('tmdb_status = ?');
            values.push(data.tmdb_status);
        }
        if (data.theatrical_release_date !== undefined) {
            updates.push('theatrical_release_date = ?');
            values.push(data.theatrical_release_date);
        }
        if (data.digital_release_date !== undefined) {
            updates.push('digital_release_date = ?');
            values.push(data.digital_release_date);
        }
        if (data.physical_release_date !== undefined) {
            updates.push('physical_release_date = ?');
            values.push(data.physical_release_date);
        }
        if (data.collection_id !== undefined) {
            updates.push('collection_id = ?');
            values.push(data.collection_id);
        }
        if (data.collection_name !== undefined) {
            updates.push('collection_name = ?');
            values.push(data.collection_name);
        }
        if (updates.length === 0)
            return this.findById(id);
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        const stmt = database_1.default.prepare(`
      UPDATE movies 
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
        stmt.run(...values);
        return this.findById(id);
    }
    static fixMatch(id, data) {
        const stmt = database_1.default.prepare(`
      UPDATE movies 
      SET tmdb_id = ?, title = ?, year = ?, overview = ?, poster_path = ?, 
          backdrop_path = ?, runtime = ?, vote_average = ?, vote_count = ?,
          status = ?, imdb_id = ?, tmdb_status = ?, theatrical_release_date = ?,
          digital_release_date = ?, physical_release_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
        stmt.run(data.tmdb_id, data.title, data.year || null, data.overview || null, data.poster_path || null, data.backdrop_path || null, data.runtime || null, data.vote_average || null, data.vote_count || null, data.status || null, data.imdb_id || null, data.tmdb_status || null, data.theatrical_release_date || null, data.digital_release_date || null, data.physical_release_date || null, id);
        return this.findById(id);
    }
    /**
     * Update cast, crew, genres, collection, and certification data for a movie
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
        if (data.collection_id !== undefined) {
            updates.push('collection_id = ?');
            values.push(data.collection_id);
        }
        if (data.collection_name !== undefined) {
            updates.push('collection_name = ?');
            values.push(data.collection_name);
        }
        if (data.certification !== undefined) {
            updates.push('certification = ?');
            values.push(data.certification);
        }
        if (updates.length === 0)
            return this.findById(id);
        values.push(id);
        const stmt = database_1.default.prepare(`UPDATE movies SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
        stmt.run(...values);
        return this.findById(id);
    }
    /**
     * Find related movies - prioritizes collection items, then supplements with actor matches
     * Only shows truly related content, not weak genre-only matches
     */
    static findRelated(id, limit = 10) {
        const movie = this.findById(id);
        if (!movie)
            return [];
        const allMovies = database_1.default.prepare('SELECT * FROM movies WHERE id != ?').all(id);
        // Get top 5 lead actors (more strict than top 10)
        const movieCast = movie.cast_data || [];
        const leadActorIds = movieCast.slice(0, 5).map(c => c.id);
        const collectionMatches = [];
        const actorMatches = [];
        for (const row of allMovies) {
            const otherMovie = this.parseMovie(row);
            // 1. Same Collection - highest priority, always include
            if (movie.collection_id && otherMovie.collection_id === movie.collection_id) {
                collectionMatches.push({
                    movie: otherMovie,
                    score: 100,
                    reasons: [movie.collection_name || 'Same collection']
                });
                continue; // Don't double-count
            }
            // 2. Shared Lead Actors - require at least 2 shared actors from top 5 cast
            const otherCast = otherMovie.cast_data || [];
            const otherLeadIds = otherCast.slice(0, 5).map((c) => c.id);
            const sharedLeadActors = leadActorIds.filter(actorId => otherLeadIds.includes(actorId));
            if (sharedLeadActors.length >= 2) {
                const actorNames = movieCast.filter(c => sharedLeadActors.includes(c.id)).map(c => c.name).slice(0, 2);
                actorMatches.push({
                    movie: otherMovie,
                    score: 50 + (sharedLeadActors.length * 10), // 70-100 points for 2-5 shared
                    reasons: [actorNames.join(', ')]
                });
            }
        }
        // Sort actor matches by score
        actorMatches.sort((a, b) => b.score - a.score);
        // Combine: all collection matches first, then fill with actor matches
        const results = [...collectionMatches];
        // Only add actor matches if we need more items
        const remaining = limit - results.length;
        if (remaining > 0) {
            results.push(...actorMatches.slice(0, remaining));
        }
        return results.slice(0, limit);
    }
}
exports.MovieModel = MovieModel;
//# sourceMappingURL=Movie.js.map