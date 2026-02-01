import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface ImportList {
  id: string;
  name: string;
  type: string;  // 'imdb', 'trakt', 'stevenlu', 'tmdb', 'custom'
  media_type: string;  // 'movie' or 'tv'
  enabled: boolean;
  enable_auto_add: boolean;
  search_on_add: boolean;
  quality_profile_id: string | null;
  root_folder: string | null;
  monitor: string;  // 'all', 'future', 'missing', 'existing', 'firstSeason', 'latestSeason', 'none'
  minimum_availability: string;  // 'announced', 'inCinemas', 'released', 'preDB'
  list_id: string | null;
  url: string | null;
  refresh_interval: number;  // minutes
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

interface DbRow {
  id: string;
  name: string;
  type: string;
  media_type: string;
  enabled: number;
  enable_auto_add: number;
  search_on_add: number;
  quality_profile_id: string | null;
  root_folder: string | null;
  monitor: string;
  minimum_availability: string;
  list_id: string | null;
  url: string | null;
  refresh_interval: number;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

function rowToImportList(row: DbRow): ImportList {
  return {
    ...row,
    enabled: Boolean(row.enabled),
    enable_auto_add: Boolean(row.enable_auto_add),
    search_on_add: Boolean(row.search_on_add),
  };
}

export const ImportListModel = {
  getAll(): ImportList[] {
    const stmt = db.prepare('SELECT * FROM import_lists ORDER BY name ASC');
    return (stmt.all() as DbRow[]).map(rowToImportList);
  },

  getById(id: string): ImportList | null {
    const stmt = db.prepare('SELECT * FROM import_lists WHERE id = ?');
    const row = stmt.get(id) as DbRow | undefined;
    return row ? rowToImportList(row) : null;
  },

  getEnabled(): ImportList[] {
    const stmt = db.prepare('SELECT * FROM import_lists WHERE enabled = 1 ORDER BY name ASC');
    return (stmt.all() as DbRow[]).map(rowToImportList);
  },

  getByMediaType(mediaType: string): ImportList[] {
    const stmt = db.prepare('SELECT * FROM import_lists WHERE media_type = ? ORDER BY name ASC');
    return (stmt.all(mediaType) as DbRow[]).map(rowToImportList);
  },

  getDueForSync(): ImportList[] {
    const stmt = db.prepare(`
      SELECT * FROM import_lists 
      WHERE enabled = 1 
      AND (last_sync IS NULL OR datetime(last_sync, '+' || refresh_interval || ' minutes') <= datetime('now'))
      ORDER BY name ASC
    `);
    return (stmt.all() as DbRow[]).map(rowToImportList);
  },

  create(data: Partial<ImportList>): ImportList {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO import_lists (
        id, name, type, media_type, enabled, enable_auto_add, search_on_add,
        quality_profile_id, root_folder, monitor, minimum_availability,
        list_id, url, refresh_interval, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name || 'New List',
      data.type || 'imdb',
      data.media_type || 'movie',
      data.enabled !== false ? 1 : 0,
      data.enable_auto_add !== false ? 1 : 0,
      data.search_on_add ? 1 : 0,
      data.quality_profile_id || null,
      data.root_folder || null,
      data.monitor || 'all',
      data.minimum_availability || 'released',
      data.list_id || null,
      data.url || null,
      data.refresh_interval || 720,
      now,
      now
    );

    return this.getById(id)!;
  },

  update(id: string, data: Partial<ImportList>): ImportList | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE import_lists SET
        name = ?,
        type = ?,
        media_type = ?,
        enabled = ?,
        enable_auto_add = ?,
        search_on_add = ?,
        quality_profile_id = ?,
        root_folder = ?,
        monitor = ?,
        minimum_availability = ?,
        list_id = ?,
        url = ?,
        refresh_interval = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      data.name ?? existing.name,
      data.type ?? existing.type,
      data.media_type ?? existing.media_type,
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
      data.enable_auto_add !== undefined ? (data.enable_auto_add ? 1 : 0) : (existing.enable_auto_add ? 1 : 0),
      data.search_on_add !== undefined ? (data.search_on_add ? 1 : 0) : (existing.search_on_add ? 1 : 0),
      data.quality_profile_id ?? existing.quality_profile_id,
      data.root_folder ?? existing.root_folder,
      data.monitor ?? existing.monitor,
      data.minimum_availability ?? existing.minimum_availability,
      data.list_id ?? existing.list_id,
      data.url ?? existing.url,
      data.refresh_interval ?? existing.refresh_interval,
      now,
      id
    );

    return this.getById(id);
  },

  updateLastSync(id: string): void {
    const now = new Date().toISOString();
    const stmt = db.prepare('UPDATE import_lists SET last_sync = ?, updated_at = ? WHERE id = ?');
    stmt.run(now, now, id);
  },

  delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM import_lists WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  // Get available list types with their presets
  getListTypes() {
    return {
      movie: [
        {
          type: 'imdb',
          name: 'IMDb Lists',
          description: 'Import from IMDb lists, Top 250, or Popular Movies',
          presets: [
            { id: 'top250', name: 'IMDb Top 250', listId: 'top250' },
            { id: 'popular', name: 'IMDb Popular Movies', listId: 'popular' },
            { id: 'boxoffice', name: 'IMDb Box Office', listId: 'boxoffice' },
          ]
        },
        {
          type: 'trakt',
          name: 'Trakt Lists',
          description: 'Import from Trakt public lists',
          presets: [
            { id: 'trending', name: 'Trakt Trending', listId: 'trending' },
            { id: 'popular', name: 'Trakt Popular', listId: 'popular' },
            { id: 'anticipated', name: 'Trakt Most Anticipated', listId: 'anticipated' },
          ]
        },
        {
          type: 'stevenlu',
          name: 'StevenLu List',
          description: 'Popular movies from StevenLu',
          presets: []
        },
        {
          type: 'tmdb',
          name: 'TMDB Lists',
          description: 'Import from TMDB lists or collections',
          presets: [
            { id: 'popular', name: 'TMDB Popular', listId: 'popular' },
            { id: 'top_rated', name: 'TMDB Top Rated', listId: 'top_rated' },
            { id: 'now_playing', name: 'TMDB Now Playing', listId: 'now_playing' },
            { id: 'upcoming', name: 'TMDB Upcoming', listId: 'upcoming' },
          ]
        },
        {
          type: 'youtube',
          name: 'YouTube Trailer Channels',
          description: 'Import movies from YouTube trailer channels (use playlist ID starting with UULF)',
          presets: [
            { id: 'movietrailerssource', name: 'Movie Trailers Source', listId: 'UULFpJN7kiUkDrH11p0GQhLyFw' },
            { id: 'filmselect', name: 'FilmSelect Trailer', listId: 'UULFDHv5A6lFccm37IP3DdgB8g' },
            { id: 'kinocheck', name: 'KinoCheck International', listId: 'UULF5MBwWVjB4TmJmLPtG0t1_g' },
          ]
        }
      ],
      tv: [
        {
          type: 'imdb',
          name: 'IMDb Lists',
          description: 'Import from IMDb TV lists',
          presets: [
            { id: 'popular-tv', name: 'IMDb Popular TV', listId: 'popular-tv' },
          ]
        },
        {
          type: 'trakt',
          name: 'Trakt Lists',
          description: 'Import from Trakt public TV lists',
          presets: [
            { id: 'trending', name: 'Trakt Trending', listId: 'trending' },
            { id: 'popular', name: 'Trakt Popular', listId: 'popular' },
            { id: 'anticipated', name: 'Trakt Most Anticipated', listId: 'anticipated' },
          ]
        },
        {
          type: 'tmdb',
          name: 'TMDB Lists',
          description: 'Import from TMDB TV lists',
          presets: [
            { id: 'popular', name: 'TMDB Popular', listId: 'popular' },
            { id: 'top_rated', name: 'TMDB Top Rated', listId: 'top_rated' },
            { id: 'on_the_air', name: 'TMDB On The Air', listId: 'on_the_air' },
            { id: 'airing_today', name: 'TMDB Airing Today', listId: 'airing_today' },
          ]
        }
      ]
    };
  }
};
