import db from '../config/database';

export interface NamingConfig {
  id: number;
  rename_movies: boolean;
  rename_episodes: boolean;
  replace_illegal_characters: boolean;
  colon_replacement: string;
  standard_movie_format: string;
  movie_folder_format: string;
  standard_episode_format: string;
  daily_episode_format: string;
  anime_episode_format: string;
  series_folder_format: string;
  season_folder_format: string;
  specials_folder_format: string;
  multi_episode_style: string;
  updated_at: string;
}

export type MultiEpisodeStyle = 'extend' | 'duplicate' | 'prefixed_range' | 'scene' | 'range';

export class NamingConfigModel {
  // Get the naming configuration
  static get(): NamingConfig {
    const stmt = db.prepare('SELECT * FROM naming_config WHERE id = 1');
    const row = stmt.get() as any;
    
    if (!row) {
      // Create default if doesn't exist
      db.prepare('INSERT INTO naming_config (id) VALUES (1)').run();
      return this.get();
    }
    
    return {
      ...row,
      rename_movies: Boolean(row.rename_movies),
      rename_episodes: Boolean(row.rename_episodes),
      replace_illegal_characters: Boolean(row.replace_illegal_characters),
    };
  }

  // Update the naming configuration
  static update(data: Partial<Omit<NamingConfig, 'id' | 'updated_at'>>): NamingConfig {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.rename_movies !== undefined) {
      updates.push('rename_movies = ?');
      values.push(data.rename_movies ? 1 : 0);
    }
    if (data.rename_episodes !== undefined) {
      updates.push('rename_episodes = ?');
      values.push(data.rename_episodes ? 1 : 0);
    }
    if (data.replace_illegal_characters !== undefined) {
      updates.push('replace_illegal_characters = ?');
      values.push(data.replace_illegal_characters ? 1 : 0);
    }
    if (data.colon_replacement !== undefined) {
      updates.push('colon_replacement = ?');
      values.push(data.colon_replacement);
    }
    if (data.standard_movie_format !== undefined) {
      updates.push('standard_movie_format = ?');
      values.push(data.standard_movie_format);
    }
    if (data.movie_folder_format !== undefined) {
      updates.push('movie_folder_format = ?');
      values.push(data.movie_folder_format);
    }
    if (data.standard_episode_format !== undefined) {
      updates.push('standard_episode_format = ?');
      values.push(data.standard_episode_format);
    }
    if (data.daily_episode_format !== undefined) {
      updates.push('daily_episode_format = ?');
      values.push(data.daily_episode_format);
    }
    if (data.anime_episode_format !== undefined) {
      updates.push('anime_episode_format = ?');
      values.push(data.anime_episode_format);
    }
    if (data.series_folder_format !== undefined) {
      updates.push('series_folder_format = ?');
      values.push(data.series_folder_format);
    }
    if (data.season_folder_format !== undefined) {
      updates.push('season_folder_format = ?');
      values.push(data.season_folder_format);
    }
    if (data.specials_folder_format !== undefined) {
      updates.push('specials_folder_format = ?');
      values.push(data.specials_folder_format);
    }
    if (data.multi_episode_style !== undefined) {
      updates.push('multi_episode_style = ?');
      values.push(data.multi_episode_style);
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      
      const stmt = db.prepare(`UPDATE naming_config SET ${updates.join(', ')} WHERE id = 1`);
      stmt.run(...values);
    }
    
    return this.get();
  }

  // Get available tokens for movies
  static getMovieTokens(): { token: string; description: string; example: string }[] {
    return [
      { token: '{Movie Title}', description: 'Movie title', example: 'The Dark Knight' },
      { token: '{Movie CleanTitle}', description: 'Movie title without special characters', example: 'The Dark Knight' },
      { token: '{Movie TitleThe}', description: 'Movie title with "The" moved to end', example: 'Dark Knight, The' },
      { token: '{Release Year}', description: 'Release year', example: '2008' },
      { token: '{Quality Full}', description: 'Full quality string', example: 'Bluray-1080p Proper' },
      { token: '{Quality Title}', description: 'Quality title', example: 'Bluray-1080p' },
      { token: '{MediaInfo VideoDynamicRange}', description: 'HDR format', example: 'HDR' },
      { token: '{MediaInfo VideoCodec}', description: 'Video codec', example: 'x265' },
      { token: '{MediaInfo AudioCodec}', description: 'Audio codec', example: 'DTS' },
      { token: '{MediaInfo AudioChannels}', description: 'Audio channels', example: '5.1' },
      { token: '{MediaInfo Simple}', description: 'Simplified media info', example: 'x265 DTS' },
      { token: '{Release Group}', description: 'Release group name', example: 'SPARKS' },
      { token: '{Edition Tags}', description: 'Edition tags', example: 'Directors Cut' },
      { token: '{tmdb-id}', description: 'TMDB ID', example: '155' },
      { token: '{imdb-id}', description: 'IMDB ID', example: 'tt0468569' },
    ];
  }

  // Get available tokens for episodes
  static getEpisodeTokens(): { token: string; description: string; example: string }[] {
    return [
      { token: '{Series Title}', description: 'Series title', example: 'Breaking Bad' },
      { token: '{Series CleanTitle}', description: 'Series title without special characters', example: 'Breaking Bad' },
      { token: '{Series TitleYear}', description: 'Series title with year', example: 'Breaking Bad (2008)' },
      { token: '{Series Year}', description: 'Series year', example: '2008' },
      { token: '{season:0}', description: 'Season number (1 digit minimum)', example: '1' },
      { token: '{season:00}', description: 'Season number (2 digits)', example: '01' },
      { token: '{episode:0}', description: 'Episode number (1 digit minimum)', example: '1' },
      { token: '{episode:00}', description: 'Episode number (2 digits)', example: '01' },
      { token: '{Episode Title}', description: 'Episode title', example: 'Pilot' },
      { token: '{Episode CleanTitle}', description: 'Episode title without special characters', example: 'Pilot' },
      { token: '{Air-Date}', description: 'Air date for daily shows', example: '2008-01-20' },
      { token: '{absolute:00}', description: 'Absolute episode number (anime)', example: '01' },
      { token: '{absolute:000}', description: 'Absolute episode number (3 digits)', example: '001' },
      { token: '{Quality Full}', description: 'Full quality string', example: 'WEBDL-1080p Proper' },
      { token: '{Quality Title}', description: 'Quality title', example: 'WEBDL-1080p' },
      { token: '{MediaInfo VideoCodec}', description: 'Video codec', example: 'x264' },
      { token: '{MediaInfo AudioCodec}', description: 'Audio codec', example: 'AAC' },
      { token: '{MediaInfo AudioChannels}', description: 'Audio channels', example: '2.0' },
      { token: '{MediaInfo Simple}', description: 'Simplified media info', example: 'x264 AAC' },
      { token: '{Release Group}', description: 'Release group name', example: 'LOL' },
      { token: '{tvdb-id}', description: 'TVDB ID', example: '81189' },
      { token: '{tmdb-id}', description: 'TMDB ID', example: '1396' },
    ];
  }

  // Get available tokens for folders
  static getFolderTokens(): { token: string; description: string; example: string }[] {
    return [
      { token: '{Series Title}', description: 'Series title', example: 'Breaking Bad' },
      { token: '{Series CleanTitle}', description: 'Series title without special characters', example: 'Breaking Bad' },
      { token: '{Series TitleYear}', description: 'Series title with year', example: 'Breaking Bad (2008)' },
      { token: '{Series Year}', description: 'Series year', example: '2008' },
      { token: '{tvdb-id}', description: 'TVDB ID', example: '81189' },
      { token: '{tmdb-id}', description: 'TMDB ID', example: '1396' },
      { token: '{season:0}', description: 'Season number (1 digit minimum)', example: '1' },
      { token: '{season:00}', description: 'Season number (2 digits)', example: '01' },
    ];
  }
}
