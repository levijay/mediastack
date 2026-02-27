import { Request, Response } from 'express';
import db from '../config/database';
import logger from '../config/logger';

interface AuthRequest extends Request {
  user?: { id: string; username: string; role: string };
}

export class ReportsController {
  /**
   * Get distinct values for filter combo boxes
   */
  static async getFilterOptions(req: AuthRequest, res: Response) {
    try {
      // Get distinct qualities from movie_files
      const movieQualities = db.prepare(`
        SELECT DISTINCT quality FROM movie_files WHERE quality IS NOT NULL AND quality != '' ORDER BY quality
      `).all() as { quality: string }[];

      // Get distinct qualities from episodes
      const episodeQualities = db.prepare(`
        SELECT DISTINCT quality FROM episodes WHERE quality IS NOT NULL AND quality != '' ORDER BY quality
      `).all() as { quality: string }[];

      // Combine and dedupe qualities
      const allQualities = [...new Set([
        ...movieQualities.map(q => q.quality),
        ...episodeQualities.map(q => q.quality)
      ])].sort();

      // Get distinct resolutions
      const resolutions = db.prepare(`
        SELECT DISTINCT resolution FROM movie_files WHERE resolution IS NOT NULL AND resolution != '' ORDER BY resolution
      `).all() as { resolution: string }[];

      // Get distinct video codecs
      const movieVideoCodecs = db.prepare(`
        SELECT DISTINCT video_codec FROM movie_files WHERE video_codec IS NOT NULL AND video_codec != '' ORDER BY video_codec
      `).all() as { video_codec: string }[];

      const episodeVideoCodecs = db.prepare(`
        SELECT DISTINCT video_codec FROM episodes WHERE video_codec IS NOT NULL AND video_codec != '' ORDER BY video_codec
      `).all() as { video_codec: string }[];

      const allVideoCodecs = [...new Set([
        ...movieVideoCodecs.map(v => v.video_codec),
        ...episodeVideoCodecs.map(v => v.video_codec)
      ])].sort();

      // Get distinct audio codecs
      const movieAudioCodecs = db.prepare(`
        SELECT DISTINCT audio_codec FROM movie_files WHERE audio_codec IS NOT NULL AND audio_codec != '' ORDER BY audio_codec
      `).all() as { audio_codec: string }[];

      const episodeAudioCodecs = db.prepare(`
        SELECT DISTINCT audio_codec FROM episodes WHERE audio_codec IS NOT NULL AND audio_codec != '' ORDER BY audio_codec
      `).all() as { audio_codec: string }[];

      const allAudioCodecs = [...new Set([
        ...movieAudioCodecs.map(a => a.audio_codec),
        ...episodeAudioCodecs.map(a => a.audio_codec)
      ])].sort();

      // Get distinct HDR types
      const hdrTypes = db.prepare(`
        SELECT DISTINCT video_dynamic_range FROM movie_files WHERE video_dynamic_range IS NOT NULL AND video_dynamic_range != '' ORDER BY video_dynamic_range
      `).all() as { video_dynamic_range: string }[];

      // Get distinct audio channels
      const audioChannels = db.prepare(`
        SELECT DISTINCT audio_channels FROM movie_files WHERE audio_channels IS NOT NULL AND audio_channels != '' ORDER BY audio_channels
      `).all() as { audio_channels: string }[];

      // Get distinct release groups
      const releaseGroups = db.prepare(`
        SELECT DISTINCT release_group FROM movie_files WHERE release_group IS NOT NULL AND release_group != '' ORDER BY release_group
      `).all() as { release_group: string }[];

      // Get years range from movies
      const yearRange = db.prepare(`
        SELECT MIN(year) as min_year, MAX(year) as max_year FROM movies WHERE year IS NOT NULL
      `).get() as { min_year: number; max_year: number };

      // Get distinct genres from movies (genres is JSON array)
      let allGenres: string[] = [];
      try {
        const movieGenres = db.prepare(`
          SELECT DISTINCT genres FROM movies WHERE genres IS NOT NULL AND genres != '[]' AND genres != ''
        `).all() as { genres: string }[];
        
        const genreSet = new Set<string>();
        movieGenres.forEach(row => {
          try {
            const genres = JSON.parse(row.genres);
            if (Array.isArray(genres)) {
              genres.forEach(genre => {
                if (typeof genre === 'string' && genre.trim()) {
                  genreSet.add(genre.trim());
                }
              });
            }
          } catch (e) {
            // Skip invalid JSON
            logger.debug('Failed to parse genres JSON:', row.genres);
          }
        });
        allGenres = Array.from(genreSet).sort();
      } catch (error) {
        logger.warn('Failed to extract genres:', error);
        allGenres = [];
      }

      return res.json({
        qualities: allQualities,
        resolutions: resolutions.map(r => r.resolution),
        videoCodecs: allVideoCodecs,
        audioCodecs: allAudioCodecs,
        hdrTypes: hdrTypes.map(h => h.video_dynamic_range),
        audioChannels: audioChannels.map(a => a.audio_channels),
        releaseGroups: releaseGroups.map(r => r.release_group),
        yearRange: { min: yearRange?.min_year || 1900, max: yearRange?.max_year || new Date().getFullYear() },
        genres: allGenres
      });
    } catch (error) {
      logger.error('Get filter options error:', error);
      return res.status(500).json({ error: 'Failed to get filter options' });
    }
  }

  /**
   * Search movies with filters
   */
  static async searchMovies(req: AuthRequest, res: Response) {
    try {
      const {
        quality,
        resolution,
        videoCodec,
        audioCodec,
        hdrType,
        audioChannels,
        releaseGroup,
        yearFrom,
        yearTo,
        ratingFrom,
        ratingTo,
        sizeFrom,
        sizeTo,
        hasFile,
        monitored,
        genre,
        // Special filters
        titleMismatch,
        multipleFiles,
        missingFile,
        noRating,
        sortBy = 'file_size',
        sortDir = 'desc',
        limit = 100
      } = req.query;

      let conditions: string[] = [];
      let params: any[] = [];

      // Build WHERE conditions
      if (quality) {
        conditions.push('mf.quality = ?');
        params.push(quality);
      }
      if (resolution) {
        conditions.push('mf.resolution = ?');
        params.push(resolution);
      }
      if (videoCodec) {
        conditions.push('mf.video_codec = ?');
        params.push(videoCodec);
      }
      if (audioCodec) {
        conditions.push('mf.audio_codec = ?');
        params.push(audioCodec);
      }
      if (hdrType) {
        conditions.push('mf.video_dynamic_range = ?');
        params.push(hdrType);
      }
      if (audioChannels) {
        conditions.push('mf.audio_channels = ?');
        params.push(audioChannels);
      }
      if (releaseGroup) {
        conditions.push('mf.release_group = ?');
        params.push(releaseGroup);
      }
      if (genre) {
        // Check if genre exists in the JSON array using json_each
        conditions.push('EXISTS (SELECT 1 FROM json_each(m.genres) WHERE value = ?)');
        params.push(genre);
      }
      if (yearFrom) {
        conditions.push('m.year >= ?');
        params.push(Number(yearFrom));
      }
      if (yearTo) {
        conditions.push('m.year <= ?');
        params.push(Number(yearTo));
      }
      if (ratingFrom) {
        conditions.push('m.vote_average >= ?');
        params.push(Number(ratingFrom));
      }
      if (ratingTo) {
        conditions.push('m.vote_average <= ?');
        params.push(Number(ratingTo));
      }
      if (sizeFrom) {
        conditions.push('mf.file_size >= ?');
        params.push(Number(sizeFrom) * 1024 * 1024 * 1024); // GB to bytes
      }
      if (sizeTo) {
        conditions.push('mf.file_size <= ?');
        params.push(Number(sizeTo) * 1024 * 1024 * 1024); // GB to bytes
      }
      if (hasFile === 'true') {
        conditions.push('m.has_file = 1');
      } else if (hasFile === 'false') {
        conditions.push('m.has_file = 0');
      }
      if (monitored === 'true') {
        conditions.push('m.monitored = 1');
      } else if (monitored === 'false') {
        conditions.push('m.monitored = 0');
      }

      // Special filters
      if (missingFile === 'true') {
        conditions.push('m.has_file = 0');
      }
      if (noRating === 'true') {
        conditions.push('(m.vote_average IS NULL OR m.vote_average = 0)');
      }

      // Title mismatch - filename doesn't contain movie title
      if (titleMismatch === 'true') {
        // Ensure we only check movies with files
        conditions.push('m.has_file = 1');
        // Rest is handled in post-processing
      }

      // Multiple files - movies with more than one file
      if (multipleFiles === 'true') {
        // This needs a subquery
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      // Determine sort column
      const sortColumns: { [key: string]: string } = {
        title: 'm.title',
        year: 'm.year',
        file_size: 'total_size',
        rating: 'm.vote_average',
        runtime: 'm.runtime',
        quality: 'mf.quality'
      };
      const orderBy = sortColumns[sortBy as string] || 'total_size';
      const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC';

      let query: string;
      
      if (multipleFiles === 'true') {
        // Movies with multiple files
        query = `
          SELECT 
            m.id, m.tmdb_id, m.title, m.year, m.runtime, m.vote_average, m.poster_path,
            m.folder_path, m.monitored, m.has_file,
            COUNT(mf.id) as file_count,
            SUM(mf.file_size) as total_size,
            GROUP_CONCAT(mf.id) as file_ids,
            GROUP_CONCAT(mf.file_path, '|||') as full_paths,
            GROUP_CONCAT(mf.relative_path, '|||') as file_paths,
            GROUP_CONCAT(mf.quality, '|||') as qualities,
            GROUP_CONCAT(mf.resolution, '|||') as resolutions,
            GROUP_CONCAT(mf.video_codec, '|||') as video_codecs,
            GROUP_CONCAT(mf.video_dynamic_range, '|||') as hdr_types,
            GROUP_CONCAT(mf.audio_codec, '|||') as audio_codecs,
            GROUP_CONCAT(mf.audio_channels, '|||') as audio_channels_list,
            GROUP_CONCAT(mf.file_size, '|||') as file_sizes,
            GROUP_CONCAT(mf.release_group, '|||') as release_groups,
            GROUP_CONCAT(mf.subtitle_languages, '|||') as subtitle_langs
          FROM movies m
          LEFT JOIN movie_files mf ON m.id = mf.movie_id
          ${whereClause}
          GROUP BY m.id
          HAVING file_count > 1
          ORDER BY ${orderBy} ${orderDir}
          LIMIT ?
        `;
      } else {
        query = `
          SELECT 
            m.id, m.tmdb_id, m.title, m.year, m.runtime, m.vote_average, m.poster_path,
            m.folder_path, m.monitored, m.has_file,
            COUNT(mf.id) as file_count,
            SUM(mf.file_size) as total_size,
            GROUP_CONCAT(mf.id) as file_ids,
            GROUP_CONCAT(mf.file_path, '|||') as full_paths,
            GROUP_CONCAT(mf.relative_path, '|||') as file_paths,
            GROUP_CONCAT(mf.quality, '|||') as qualities,
            GROUP_CONCAT(mf.resolution, '|||') as resolutions,
            GROUP_CONCAT(mf.video_codec, '|||') as video_codecs,
            GROUP_CONCAT(mf.video_dynamic_range, '|||') as hdr_types,
            GROUP_CONCAT(mf.audio_codec, '|||') as audio_codecs,
            GROUP_CONCAT(mf.audio_channels, '|||') as audio_channels_list,
            GROUP_CONCAT(mf.file_size, '|||') as file_sizes,
            GROUP_CONCAT(mf.release_group, '|||') as release_groups,
            GROUP_CONCAT(mf.subtitle_languages, '|||') as subtitle_langs
          FROM movies m
          LEFT JOIN movie_files mf ON m.id = mf.movie_id
          ${whereClause}
          GROUP BY m.id
          ORDER BY ${orderBy} ${orderDir}
          LIMIT ?
        `;
      }

      params.push(Number(limit));

      const results = db.prepare(query).all(...params) as any[];

      // Post-process results
      let processedResults = results.map(row => {
        const files = [];
        if (row.file_ids) {
          const ids = row.file_ids.split(',');
          const fullPaths = row.full_paths?.split('|||') || [];
          const paths = row.file_paths?.split('|||') || [];
          const quals = row.qualities?.split('|||') || [];
          const resos = row.resolutions?.split('|||') || [];
          const vCodecs = row.video_codecs?.split('|||') || [];
          const hdrs = row.hdr_types?.split('|||') || [];
          const aCodecs = row.audio_codecs?.split('|||') || [];
          const aChannels = row.audio_channels_list?.split('|||') || [];
          const sizes = row.file_sizes?.split('|||') || [];
          const groups = row.release_groups?.split('|||') || [];
          const subs = row.subtitle_langs?.split('|||') || [];

          for (let i = 0; i < ids.length; i++) {
            files.push({
              id: ids[i],
              file_path: fullPaths[i] || null,
              relative_path: paths[i] || null,
              quality: quals[i] || null,
              resolution: resos[i] || null,
              video_codec: vCodecs[i] || null,
              video_dynamic_range: hdrs[i] || null,
              audio_codec: aCodecs[i] || null,
              audio_channels: aChannels[i] || null,
              file_size: parseInt(sizes[i]) || 0,
              release_group: groups[i] || null,
              subtitle_languages: subs[i] || null
            });
          }
        }

        return {
          id: row.id,
          tmdb_id: row.tmdb_id,
          title: row.title,
          year: row.year,
          runtime: row.runtime,
          vote_average: row.vote_average,
          poster_path: row.poster_path,
          folder_path: row.folder_path,
          monitored: row.monitored === 1,
          has_file: row.has_file === 1,
          file_count: row.file_count || 0,
          total_size: row.total_size || 0,
          files
        };
      });

      // Title mismatch filter (post-processing)
      if (titleMismatch === 'true') {
        processedResults = processedResults.filter(movie => {
          if (movie.files.length === 0) return false;
          
          // Helper to normalize a title for comparison
          const normalizeTitle = (str: string): string => {
            return str
              .toLowerCase()
              // Replace colon variations with consistent format
              .replace(/:\s*/g, ' ')
              .replace(/\s*-\s*/g, ' ')
              // Replace & with and
              .replace(/&/g, 'and')
              // Remove apostrophes
              .replace(/['\']/g, '')
              // Keep only alphanumeric and spaces
              .replace(/[^a-z0-9\s]/g, '')
              // Collapse multiple spaces
              .replace(/\s+/g, ' ')
              .trim();
          };
          
          // Helper to extract title from filename (before year/quality markers)
          const extractTitleFromFilename = (filepath: string): string => {
            // Get just the filename without path
            const parts = filepath.split(/[/\\]/);
            let name = parts[parts.length - 1];
            
            // Remove file extension
            name = name.replace(/\.[^.]+$/, '');
            
            // Try to find where the title ends (usually at year or quality)
            const yearMatch = name.match(/[\.\s\-_\[\(]+(19|20)\d{2}[\.\s\-_\]\)]*/);
            if (yearMatch && yearMatch.index !== undefined) {
              name = name.substring(0, yearMatch.index);
            }
            
            // Also try quality markers if no year found
            const qualityMatch = name.match(/[\.\s\-_]+(2160p|1080p|720p|480p|4K|UHD|HDR)/i);
            if (qualityMatch && qualityMatch.index !== undefined) {
              const qualityIndex = qualityMatch.index;
              if (!yearMatch || qualityIndex < (yearMatch.index || Infinity)) {
                name = name.substring(0, qualityIndex);
              }
            }
            
            // Replace dots and underscores with spaces
            name = name.replace(/[._]/g, ' ');
            
            return name;
          };
          
          const normalizedMovieTitle = normalizeTitle(movie.title);
          
          // Check if any file has a mismatched title
          return movie.files.some((f: any) => {
            // Use relative_path or fall back to file_path
            const filepath = f.relative_path || f.file_path;
            if (!filepath) return false;
            
            const filenameTitle = extractTitleFromFilename(filepath);
            const normalizedFilename = normalizeTitle(filenameTitle);
            
            // Skip if we couldn't extract a meaningful title from filename
            if (normalizedFilename.length < 2) return false;
            
            // Check if titles match (allowing for some flexibility)
            // Both should contain the same core words
            const movieWords = normalizedMovieTitle.split(' ').filter(w => w.length > 2);
            const fileWords = normalizedFilename.split(' ').filter(w => w.length > 2);
            
            // Skip if movie title is too short to compare
            if (movieWords.length === 0) return false;
            
            // Count how many significant words from movie title appear in filename
            const matchingWords = movieWords.filter(word => 
              fileWords.some(fw => fw.includes(word) || word.includes(fw))
            );
            
            // Consider it a mismatch if less than 50% of words match (more lenient)
            const matchRatio = matchingWords.length / movieWords.length;
            return matchRatio < 0.5;
          });
        });
      }

      return res.json({
        items: processedResults,
        total: processedResults.length
      });
    } catch (error) {
      logger.error('Search movies error:', error);
      return res.status(500).json({ error: 'Failed to search movies' });
    }
  }

  /**
   * Search episodes with filters
   */
  static async searchEpisodes(req: AuthRequest, res: Response) {
    try {
      const {
        quality,
        videoCodec,
        audioCodec,
        sizeFrom,
        sizeTo,
        hasFile,
        monitored,
        sortBy = 'file_size',
        sortDir = 'desc',
        limit = 100
      } = req.query;

      let conditions: string[] = ['e.has_file = 1']; // Only episodes with files
      let params: any[] = [];

      if (quality) {
        conditions.push('e.quality = ?');
        params.push(quality);
      }
      if (videoCodec) {
        conditions.push('e.video_codec = ?');
        params.push(videoCodec);
      }
      if (audioCodec) {
        conditions.push('e.audio_codec = ?');
        params.push(audioCodec);
      }
      if (sizeFrom) {
        conditions.push('e.file_size >= ?');
        params.push(Number(sizeFrom) * 1024 * 1024 * 1024);
      }
      if (sizeTo) {
        conditions.push('e.file_size <= ?');
        params.push(Number(sizeTo) * 1024 * 1024 * 1024);
      }
      if (hasFile === 'true') {
        conditions.push('e.has_file = 1');
      } else if (hasFile === 'false') {
        conditions.push('e.has_file = 0');
      }
      if (monitored === 'true') {
        conditions.push('e.monitored = 1');
      } else if (monitored === 'false') {
        conditions.push('e.monitored = 0');
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      const sortColumns: { [key: string]: string } = {
        title: 's.title',
        file_size: 'e.file_size',
        quality: 'e.quality'
      };
      const orderBy = sortColumns[sortBy as string] || 'e.file_size';
      const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC';

      const query = `
        SELECT 
          e.id, e.series_id, e.season_number, e.episode_number, e.title as episode_title,
          e.file_path, e.file_size, e.quality, e.video_codec, e.audio_codec,
          e.monitored, e.has_file,
          s.title as series_title, s.year, s.poster_path
        FROM episodes e
        JOIN tv_series s ON e.series_id = s.id
        ${whereClause}
        ORDER BY ${orderBy} ${orderDir}
        LIMIT ?
      `;

      params.push(Number(limit));

      const results = db.prepare(query).all(...params) as any[];

      const processedResults = results.map(row => ({
        id: row.id,
        series_id: row.series_id,
        series_title: row.series_title,
        series_year: row.year,
        poster_path: row.poster_path,
        season_number: row.season_number,
        episode_number: row.episode_number,
        episode_title: row.episode_title,
        file_path: row.file_path,
        file_size: row.file_size || 0,
        quality: row.quality,
        video_codec: row.video_codec,
        audio_codec: row.audio_codec,
        monitored: row.monitored === 1,
        has_file: row.has_file === 1
      }));

      return res.json({
        items: processedResults,
        total: processedResults.length
      });
    } catch (error) {
      logger.error('Search episodes error:', error);
      return res.status(500).json({ error: 'Failed to search episodes' });
    }
  }

  /**
   * Get summary statistics
   */
  static async getStats(req: AuthRequest, res: Response) {
    try {
      // Movie stats
      const movieStats = db.prepare(`
        SELECT 
          COUNT(*) as total_movies,
          SUM(CASE WHEN has_file = 1 THEN 1 ELSE 0 END) as movies_with_files,
          SUM(CASE WHEN has_file = 0 THEN 1 ELSE 0 END) as movies_missing
        FROM movies
      `).get() as any;

      const movieFileStats = db.prepare(`
        SELECT 
          COUNT(*) as total_files,
          SUM(file_size) as total_size
        FROM movie_files
      `).get() as any;

      // Movies with multiple files
      const multipleFilesCount = db.prepare(`
        SELECT COUNT(*) as count
        FROM (
          SELECT movie_id, COUNT(*) as file_count
          FROM movie_files
          GROUP BY movie_id
          HAVING file_count > 1
        )
      `).get() as { count: number };

      // Series stats
      const seriesStats = db.prepare(`
        SELECT 
          COUNT(*) as total_series
        FROM tv_series
      `).get() as any;

      const episodeStats = db.prepare(`
        SELECT 
          COUNT(*) as total_episodes,
          SUM(CASE WHEN has_file = 1 THEN 1 ELSE 0 END) as episodes_with_files,
          SUM(CASE WHEN has_file = 0 THEN 1 ELSE 0 END) as episodes_missing,
          SUM(CASE WHEN has_file = 1 THEN COALESCE(file_size, 0) ELSE 0 END) as total_size
        FROM episodes
      `).get() as any;

      return res.json({
        movies: {
          total: movieStats.total_movies || 0,
          withFiles: movieStats.movies_with_files || 0,
          missing: movieStats.movies_missing || 0,
          totalFiles: movieFileStats.total_files || 0,
          totalSize: movieFileStats.total_size || 0,
          multipleFiles: multipleFilesCount.count || 0
        },
        series: {
          total: seriesStats.total_series || 0,
          totalEpisodes: episodeStats.total_episodes || 0,
          episodesWithFiles: episodeStats.episodes_with_files || 0,
          episodesMissing: episodeStats.episodes_missing || 0,
          totalSize: episodeStats.total_size || 0
        }
      });
    } catch (error) {
      logger.error('Get stats error:', error);
      return res.status(500).json({ error: 'Failed to get stats' });
    }
  }
}
