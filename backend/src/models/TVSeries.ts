import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';

export interface CastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department?: string;
}

export interface Genre {
  id: number;
  name: string;
}

export interface TVSeries {
  id: string;
  tvdb_id: number | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  status: string | null;
  overview: string | null;
  network: string | null;
  year: number | null;
  vote_average: number | null;
  vote_count: number | null;
  poster_path: string | null;
  backdrop_path: string | null;
  folder_path: string;
  quality_profile_id: string | null;
  language_profile_id: string | null;
  monitored: boolean;
  season_folder: boolean;
  series_type: string | null;
  use_season_folder: boolean | null;
  monitor_new_seasons: string | null;
  tags: string | null;
  cast_data?: CastMember[] | null;
  crew_data?: CrewMember[] | null;
  genres?: Genre[] | null;
  certification?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Season {
  id: string;
  series_id: string;
  season_number: number;
  monitored: boolean;
  created_at: string;
  updated_at: string;
}

export interface Episode {
  id: string;
  series_id: string;
  season_number: number;
  episode_number: number;
  title: string;
  overview: string | null;
  air_date: string | null;
  has_file: boolean;
  file_path: string | null;
  file_size: number | null;
  quality: string | null;
  video_codec: string | null;
  audio_codec: string | null;
  release_group: string | null;
  monitored: boolean;
  is_proper?: boolean;
  is_repack?: boolean;
  created_at: string;
  updated_at: string;
}

export class TVSeriesModel {
  static create(data: {
    tvdb_id?: number;
    tmdb_id?: number;
    imdb_id?: string;
    title: string;
    status?: string;
    overview?: string;
    network?: string;
    year?: number;
    vote_average?: number;
    vote_count?: number;
    poster_path?: string;
    backdrop_path?: string;
    folder_path: string;
    quality_profile_id?: string;
    language_profile_id?: string;
    monitored?: boolean;
    season_folder?: boolean;
    cast_data?: CastMember[];
    crew_data?: CrewMember[];
    genres?: Genre[];
  }): TVSeries {
    const id = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO tv_series (
        id, tvdb_id, tmdb_id, imdb_id, title, status, overview, network, year,
        vote_average, vote_count, poster_path, backdrop_path, folder_path, 
        quality_profile_id, language_profile_id, monitored, season_folder,
        cast_data, crew_data, genres
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.tvdb_id || null,
      data.tmdb_id || null,
      data.imdb_id || null,
      data.title,
      data.status || null,
      data.overview || null,
      data.network || null,
      data.year || null,
      data.vote_average || null,
      data.vote_count || null,
      data.poster_path || null,
      data.backdrop_path || null,
      data.folder_path,
      data.quality_profile_id || null,
      data.language_profile_id || null,
      data.monitored !== false ? 1 : 0,
      data.season_folder !== false ? 1 : 0,
      data.cast_data ? JSON.stringify(data.cast_data) : null,
      data.crew_data ? JSON.stringify(data.crew_data) : null,
      data.genres ? JSON.stringify(data.genres) : null
    );

    return this.findById(id)!;
  }

  private static parseSeries(row: any): TVSeries {
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

  static findById(id: string): TVSeries | undefined {
    const stmt = db.prepare('SELECT * FROM tv_series WHERE id = ?');
    const series = stmt.get(id) as any;
    if (!series) return undefined;
    return this.parseSeries(series);
  }

  static findByTmdbId(tmdbId: number): TVSeries | undefined {
    const stmt = db.prepare('SELECT * FROM tv_series WHERE tmdb_id = ?');
    const series = stmt.get(tmdbId) as any;
    if (!series) return undefined;
    return this.parseSeries(series);
  }

  static findByTvdbId(tvdbId: number): TVSeries | undefined {
    const stmt = db.prepare('SELECT * FROM tv_series WHERE tvdb_id = ?');
    const series = stmt.get(tvdbId) as any;
    if (!series) return undefined;
    return this.parseSeries(series);
  }

  static findAll(limit: number = 100, offset: number = 0): TVSeries[] {
    const stmt = db.prepare(`
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
    return (stmt.all(limit, offset) as any[]).map(s => this.parseSeries(s));
  }

  static findRecentlyAdded(limit: number = 20): TVSeries[] {
    const stmt = db.prepare(`
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
    return (stmt.all(limit) as any[]).map(s => this.parseSeries(s));
  }

  static count(): { total: number; monitored: number } {
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM tv_series');
    const monitoredStmt = db.prepare('SELECT COUNT(*) as count FROM tv_series WHERE monitored = 1');
    
    return {
      total: (totalStmt.get() as any).count,
      monitored: (monitoredStmt.get() as any).count
    };
  }

  static getAllFolderPaths(): string[] {
    const stmt = db.prepare('SELECT folder_path FROM tv_series WHERE folder_path IS NOT NULL');
    return (stmt.all() as any[]).map(s => s.folder_path);
  }

  static findMonitored(): TVSeries[] {
    const stmt = db.prepare(`
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
    return (stmt.all() as any[]).map(s => this.parseSeries(s));
  }

  static updateMonitored(id: string, monitored: boolean): TVSeries | undefined {
    const stmt = db.prepare(`
      UPDATE tv_series 
      SET monitored = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(monitored ? 1 : 0, id);
    
    // Cascade to all seasons and episodes
    const seasonStmt = db.prepare(`
      UPDATE seasons SET monitored = ? WHERE series_id = ?
    `);
    seasonStmt.run(monitored ? 1 : 0, id);
    
    const episodeStmt = db.prepare(`
      UPDATE episodes SET monitored = ? WHERE series_id = ?
    `);
    episodeStmt.run(monitored ? 1 : 0, id);
    
    return this.findById(id);
  }

  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM tv_series WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static deleteSeasonsBySeriesId(seriesId: string): number {
    const stmt = db.prepare('DELETE FROM seasons WHERE series_id = ?');
    const result = stmt.run(seriesId);
    return result.changes;
  }

  static deleteEpisodesBySeriesId(seriesId: string): number {
    const stmt = db.prepare('DELETE FROM episodes WHERE series_id = ?');
    const result = stmt.run(seriesId);
    return result.changes;
  }

  // Season management
  static createSeason(seriesId: string, seasonNumber: number, monitored: boolean = true): Season {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO seasons (id, series_id, season_number, monitored)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, seriesId, seasonNumber, monitored ? 1 : 0);

    return this.findSeasonById(id)!;
  }

  static findSeasonById(id: string): Season | undefined {
    const stmt = db.prepare('SELECT * FROM seasons WHERE id = ?');
    const season = stmt.get(id) as any;
    if (!season) return undefined;
    return { ...season, monitored: season.monitored === 1 };
  }

  static findSeasonsBySeriesId(seriesId: string): Season[] {
    const stmt = db.prepare('SELECT * FROM seasons WHERE series_id = ? ORDER BY season_number ASC');
    return (stmt.all(seriesId) as any[]).map(s => ({ ...s, monitored: s.monitored === 1 }));
  }

  static updateSeasonMonitored(id: string, monitored: boolean): Season | undefined {
    const stmt = db.prepare(`
      UPDATE seasons 
      SET monitored = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(monitored ? 1 : 0, id);
    
    // Cascade to all episodes in this season
    const season = this.findSeasonById(id);
    if (season) {
      const episodeStmt = db.prepare(`
        UPDATE episodes SET monitored = ? WHERE series_id = ? AND season_number = ?
      `);
      episodeStmt.run(monitored ? 1 : 0, season.series_id, season.season_number);
    }
    
    return season;
  }

  // Episode management
  static createEpisode(data: {
    series_id: string;
    season_number: number;
    episode_number: number;
    title: string;
    overview?: string;
    air_date?: string;
    runtime?: number | null;
    vote_average?: number | null;
    vote_count?: number | null;
    monitored?: boolean;
  }): Episode {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO episodes (
        id, series_id, season_number, episode_number, title, overview, air_date, runtime, vote_average, vote_count, monitored
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.series_id,
      data.season_number,
      data.episode_number,
      data.title,
      data.overview || null,
      data.air_date || null,
      data.runtime || null,
      data.vote_average || null,
      data.vote_count || null,
      data.monitored !== false ? 1 : 0
    );

    return this.findEpisodeById(id)!;
  }

  static findEpisodeById(id: string): Episode | undefined {
    const stmt = db.prepare('SELECT * FROM episodes WHERE id = ?');
    const episode = stmt.get(id) as any;
    if (!episode) return undefined;
    return {
      ...episode,
      has_file: episode.has_file === 1,
      monitored: episode.monitored === 1
    };
  }

  static findEpisodesBySeriesId(seriesId: string): Episode[] {
    const stmt = db.prepare(`
      SELECT * FROM episodes 
      WHERE series_id = ? 
      ORDER BY season_number ASC, episode_number ASC
    `);
    return (stmt.all(seriesId) as any[]).map(e => ({
      ...e,
      has_file: e.has_file === 1,
      monitored: e.monitored === 1
    }));
  }

  static findEpisodesBySeason(seriesId: string, seasonNumber: number): Episode[] {
    const stmt = db.prepare(`
      SELECT * FROM episodes 
      WHERE series_id = ? AND season_number = ? 
      ORDER BY episode_number ASC
    `);
    return (stmt.all(seriesId, seasonNumber) as any[]).map(e => ({
      ...e,
      has_file: e.has_file === 1,
      monitored: e.monitored === 1
    }));
  }

  static findMissingEpisodes(seriesId?: string): Episode[] {
    const query = seriesId
      ? `SELECT * FROM episodes WHERE series_id = ? AND monitored = 1 AND has_file = 0 ORDER BY air_date DESC`
      : `SELECT * FROM episodes WHERE monitored = 1 AND has_file = 0 ORDER BY air_date DESC LIMIT 100`;

    const stmt = db.prepare(query);
    const results = seriesId ? stmt.all(seriesId) : stmt.all();
    
    return (results as any[]).map(e => ({
      ...e,
      has_file: e.has_file === 1,
      monitored: e.monitored === 1
    }));
  }

  static updateEpisodeFile(
    id: string, 
    filePath: string, 
    fileSize: number, 
    quality: string,
    videoCodec?: string,
    audioCodec?: string,
    releaseGroup?: string
  ): Episode | undefined {
    const stmt = db.prepare(`
      UPDATE episodes 
      SET has_file = 1, file_path = ?, file_size = ?, quality = ?, video_codec = ?, audio_codec = ?, release_group = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(filePath, fileSize, quality, videoCodec || null, audioCodec || null, releaseGroup || null, id);
    return this.findEpisodeById(id);
  }

  static clearEpisodeFile(id: string): Episode | undefined {
    const stmt = db.prepare(`
      UPDATE episodes 
      SET has_file = 0, file_path = NULL, file_size = NULL, quality = NULL, video_codec = NULL, audio_codec = NULL, release_group = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(id);
    return this.findEpisodeById(id);
  }

  static clearSeasonFiles(seriesId: string, seasonNumber: number): number {
    const stmt = db.prepare(`
      UPDATE episodes 
      SET has_file = 0, file_path = NULL, file_size = NULL, quality = NULL, video_codec = NULL, audio_codec = NULL, release_group = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE series_id = ? AND season_number = ?
    `);
    const result = stmt.run(seriesId, seasonNumber);
    return result.changes;
  }

  static updateEpisodeMonitored(id: string, monitored: boolean): Episode | undefined {
    const stmt = db.prepare(`
      UPDATE episodes 
      SET monitored = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(monitored ? 1 : 0, id);
    return this.findEpisodeById(id);
  }

  static updateQualityProfile(id: string, qualityProfileId: string | null): TVSeries | undefined {
    const stmt = db.prepare(`
      UPDATE tv_series 
      SET quality_profile_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(qualityProfileId, id);
    return this.findById(id);
  }

  static updateFolderPath(id: string, folderPath: string): TVSeries | undefined {
    const stmt = db.prepare(`
      UPDATE tv_series 
      SET folder_path = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(folderPath, id);
    return this.findById(id);
  }

  static updateSeriesType(id: string, seriesType: string): TVSeries | undefined {
    const stmt = db.prepare(`
      UPDATE tv_series 
      SET series_type = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(seriesType, id);
    return this.findById(id);
  }

  static updateUseSeasonFolder(id: string, useSeasonFolder: boolean): TVSeries | undefined {
    const stmt = db.prepare(`
      UPDATE tv_series 
      SET use_season_folder = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(useSeasonFolder ? 1 : 0, id);
    return this.findById(id);
  }

  static updateMonitorNewSeasons(id: string, monitorNewSeasons: string): TVSeries | undefined {
    const stmt = db.prepare(`
      UPDATE tv_series 
      SET monitor_new_seasons = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(monitorNewSeasons, id);
    return this.findById(id);
  }

  static updateTags(id: string, tags: string[]): TVSeries | undefined {
    const stmt = db.prepare(`
      UPDATE tv_series 
      SET tags = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(tags), id);
    return this.findById(id);
  }

  static updateMetadata(id: string, data: {
    title?: string;
    status?: string;
    overview?: string;
    network?: string;
    vote_average?: number;
    vote_count?: number;
    poster_path?: string;
    backdrop_path?: string;
  }): TVSeries | undefined {
    const updates: string[] = [];
    const values: any[] = [];

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

    if (updates.length === 0) return this.findById(id);

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`
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
  static updateMediaMetadata(id: string, data: {
    cast_data?: CastMember[];
    crew_data?: CrewMember[];
    genres?: Genre[];
    certification?: string;
  }): TVSeries | undefined {
    const updates: string[] = [];
    const values: any[] = [];

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

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    const stmt = db.prepare(`UPDATE tv_series SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    stmt.run(...values);
    return this.findById(id);
  }

  /**
   * Find related series - prioritizes franchise/spinoffs, then supplements with actor matches
   * Only shows truly related content, not weak genre-only matches
   */
  static findRelated(id: string, limit: number = 10): { series: TVSeries; score: number; reasons: string[] }[] {
    const series = this.findById(id);
    if (!series) return [];

    const allSeries = db.prepare('SELECT * FROM tv_series WHERE id != ?').all(id) as any[];

    // Get top 5 lead actors (more strict)
    const seriesCast = series.cast_data || [];
    const leadActorIds = seriesCast.slice(0, 5).map((c: CastMember) => c.id);

    // Normalize title for franchise detection
    const normalizeTitle = (title: string): string => {
      return title.toLowerCase()
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const baseTitle = normalizeTitle(series.title);
    const franchiseTitle = baseTitle.split(/[:\-–]/)[0].trim();

    const franchiseMatches: { series: TVSeries; score: number; reasons: string[] }[] = [];
    const actorMatches: { series: TVSeries; score: number; reasons: string[] }[] = [];

    for (const row of allSeries) {
      const otherSeries = this.parseSeries(row);

      // 1. Title Match - spinoff/sequel detection (e.g., "Star Trek" → "Star Trek: Discovery")
      const otherTitle = normalizeTitle(otherSeries.title);
      const otherFranchise = otherTitle.split(/[:\-–]/)[0].trim();
      
      if (franchiseTitle.length >= 4 && (
        otherFranchise === franchiseTitle || 
        (franchiseTitle.length >= 6 && (otherFranchise.includes(franchiseTitle) || franchiseTitle.includes(otherFranchise)))
      )) {
        franchiseMatches.push({
          series: otherSeries,
          score: 100,
          reasons: ['Same franchise']
        });
        continue; // Don't double-count
      }

      // 2. Shared Lead Actors - require at least 2 shared actors from top 5 cast
      const otherCast = otherSeries.cast_data || [];
      const otherLeadIds = otherCast.slice(0, 5).map((c: CastMember) => c.id);
      const sharedLeadActors = leadActorIds.filter(actorId => otherLeadIds.includes(actorId));
      
      if (sharedLeadActors.length >= 2) {
        const actorNames = seriesCast.filter((c: CastMember) => sharedLeadActors.includes(c.id)).map((c: CastMember) => c.name).slice(0, 2);
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
