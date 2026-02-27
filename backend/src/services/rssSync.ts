import db from '../config/database';
import logger from '../config/logger';
import { IndexerService } from './indexer';
import { downloadClientService } from './downloadClient';
import { notificationService } from './notification';
import { MovieModel } from '../models/Movie';
import { TVSeriesModel } from '../models/TVSeries';
import { QualityProfileModel } from '../models/QualityProfile';
import { ReleaseBlacklistModel } from '../models/ReleaseBlacklist';
import { CustomFormatModel } from '../models/CustomFormat';
import { DownloadModel } from '../models/Download';
import { ActivityLogModel, EVENT_TYPES } from '../models/ActivityLog';

interface RssRelease {
  id: string;
  indexer_id: string;
  guid: string;
  title: string;
  download_url: string;
  size: number;
  publish_date: string;
  categories: string;
  processed: number;
  grabbed: number;
}

interface WantedMovie {
  id: string;
  title: string;
  year: number | null;
  quality_profile_id: string;
  has_file: number;
  monitored: number;
  quality: string | null;
  file_path: string | null;
}

interface WantedEpisode {
  episode_id: string;
  series_id: string;
  series_title: string;
  season_number: number;
  episode_number: number;
  quality_profile_id: string;
  has_file: number;
  quality: string | null;
  file_path: string | null;
}

interface SearchResult {
  guid: string;
  title: string;
  size: number;
  seeders: number;
  leechers: number;
  grabs: number;
  downloadUrl: string;
  infoUrl: string;
  indexer: string;
  indexerType: 'torznab' | 'newznab';
  protocol: 'torrent' | 'usenet';
  quality: string;
  publishDate: string;
  categories: string[];
}

export class RssSyncService {
  private indexerService: IndexerService;

  constructor() {
    this.indexerService = new IndexerService();
  }

  /**
   * Run RSS sync for all enabled indexers
   */
  async syncAll(): Promise<{ indexersChecked: number; releasesFound: number; grabbed: number }> {
    logger.info('[RSS] Starting RSS sync...');
    
    const indexers = await this.indexerService.getIndexersForRss();
    
    if (indexers.length === 0) {
      logger.info('[RSS] No indexers enabled for RSS');
      return { indexersChecked: 0, releasesFound: 0, grabbed: 0 };
    }

    let totalReleases = 0;
    let totalGrabbed = 0;

    for (const indexer of indexers) {
      try {
        logger.info(`[RSS] Fetching RSS from ${indexer.name}...`);
        const releases = await this.indexerService.fetchRss(indexer);
        
        if (releases.length === 0) {
          logger.info(`[RSS] No releases from ${indexer.name}`);
          continue;
        }

        logger.info(`[RSS] Got ${releases.length} releases from ${indexer.name}`);
        totalReleases += releases.length;

        // Store releases in cache and check against wanted items
        for (const release of releases) {
          const isNew = this.cacheRelease(indexer.id, release);
          
          if (isNew) {
            // Check if this release matches any wanted items
            const grabbed = await this.processRelease(release);
            if (grabbed) {
              totalGrabbed++;
            }
          }
        }
      } catch (error: any) {
        logger.error(`[RSS] Error syncing ${indexer.name}: ${error.message}`);
      }
    }

    // Clean up old releases (older than 7 days)
    this.cleanupOldReleases();

    logger.info(`[RSS] Sync complete: ${indexers.length} indexers, ${totalReleases} releases, ${totalGrabbed} grabbed`);
    return { indexersChecked: indexers.length, releasesFound: totalReleases, grabbed: totalGrabbed };
  }

  /**
   * Cache a release in the database, returns true if it's a new release
   */
  private cacheRelease(indexerId: string, release: SearchResult): boolean {
    try {
      const id = require('crypto').randomUUID();
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO rss_releases (id, indexer_id, guid, title, download_url, size, publish_date, categories)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        id,
        indexerId,
        release.guid,
        release.title,
        release.downloadUrl,
        release.size || 0,
        release.publishDate || new Date().toISOString(),
        JSON.stringify(release.categories || [])
      );
      return result.changes > 0;
    } catch (error) {
      // Duplicate - already in cache
      return false;
    }
  }

  /**
   * Process a release to see if it matches any wanted movies or episodes
   */
  private async processRelease(release: SearchResult): Promise<boolean> {
    // Check movies first
    const movieMatch = await this.matchMovie(release);
    if (movieMatch) {
      return true;
    }

    // Check TV episodes
    const tvMatch = await this.matchTVEpisode(release);
    if (tvMatch) {
      return true;
    }

    return false;
  }

  /**
   * Check if a release matches a wanted movie and grab it
   * Handles both missing movies AND quality upgrades/repacks/propers
   */
  private async matchMovie(release: SearchResult): Promise<boolean> {
    // Get all monitored movies (both missing AND with files for upgrades)
    const wantedMovies = db.prepare(`
      SELECT m.id, m.title, m.year, m.quality_profile_id, m.has_file, m.monitored,
             COALESCE(mf.quality, m.quality) as quality,
             mf.file_path
      FROM movies m
      LEFT JOIN (
        SELECT movie_id, MAX(quality) as quality, MAX(file_path) as file_path
        FROM movie_files GROUP BY movie_id
      ) mf ON m.id = mf.movie_id
      WHERE m.monitored = 1
    `).all() as WantedMovie[];

    const releaseQuality = this.detectQuality(release.title);
    const releaseIsProper = this.isProper(release.title);
    const releaseIsRepack = this.isRepack(release.title);

    for (const movie of wantedMovies) {
      if (this.titleMatches(release.title, movie.title, movie.year)) {
        logger.info(`[RSS] Potential match for movie "${movie.title}": ${release.title}`);
        
        // Verify quality matches profile
        const profile = QualityProfileModel.findById(movie.quality_profile_id);
        if (!profile) continue;

        if (!QualityProfileModel.meetsProfile(movie.quality_profile_id, releaseQuality)) {
          logger.debug(`[RSS] Quality ${releaseQuality} not allowed for ${movie.title}`);
          continue;
        }

        // Check if this is a missing file OR an upgrade
        if (movie.has_file && movie.quality) {
          // Already has file - check if this is an upgrade
          const currentIsProper = movie.file_path ? this.isProper(movie.file_path) : false;
          const currentIsRepack = movie.file_path ? this.isRepack(movie.file_path) : false;

          const shouldUpgrade = QualityProfileModel.shouldUpgrade(
            movie.quality_profile_id,
            movie.quality,
            releaseQuality,
            {
              currentIsProper,
              currentIsRepack,
              newIsProper: releaseIsProper,
              newIsRepack: releaseIsRepack
            }
          );

          if (!shouldUpgrade) {
            logger.debug(`[RSS] Not an upgrade for ${movie.title} (current: ${movie.quality}, new: ${releaseQuality})`);
            continue;
          }
          logger.info(`[RSS] Upgrade available for "${movie.title}": ${movie.quality} → ${releaseQuality}${releaseIsProper ? ' (PROPER)' : ''}${releaseIsRepack ? ' (REPACK)' : ''}`);
        }

        // Check blacklist
        const blacklisted = ReleaseBlacklistModel.getForMovie(movie.id);
        if (blacklisted.some(b => b.release_title.toLowerCase() === release.title.toLowerCase())) {
          logger.debug(`[RSS] Release blacklisted for ${movie.title}`);
          continue;
        }

        // Check custom format score
        const cfScore = CustomFormatModel.calculateReleaseScore(release.title, movie.quality_profile_id, release.size);
        const minCfScore = profile.min_custom_format_score || 0;
        if (cfScore < minCfScore) {
          logger.debug(`[RSS] Custom format score ${cfScore} below minimum ${minCfScore} for ${movie.title}`);
          continue;
        }

        // CRITICAL: Check if there's already an active download for this movie
        const activeDownload = DownloadModel.findActiveByMovieId(movie.id);
        if (activeDownload) {
          logger.debug(`[RSS] Movie "${movie.title}" already has an active download: ${activeDownload.title} (${activeDownload.status})`);
          continue;
        }

        // Also check if this exact release URL is already being downloaded
        const existingRelease = DownloadModel.findByDownloadUrl(release.downloadUrl);
        if (existingRelease) {
          logger.debug(`[RSS] Release already downloading: ${release.title}`);
          continue;
        }

        // Grab the release directly!
        const action = movie.has_file ? 'Upgrading' : 'Grabbing';
        logger.info(`[RSS] ${action} release for movie "${movie.title}": ${release.title}`);
        const grabbed = await this.grabRelease(release, 'movie', movie.id, movie.title);
        if (grabbed) {
          this.markReleaseGrabbed(release.guid);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a release matches a wanted TV episode and grab it
   * Handles both missing episodes AND quality upgrades/repacks/propers
   */
  private async matchTVEpisode(release: SearchResult): Promise<boolean> {
    // Extract season/episode from release title
    const seMatch = release.title.match(/S(\d{2})E(\d{2})/i);
    if (!seMatch) {
      // Try season pack format
      const seasonMatch = release.title.match(/S(\d{2})(?![E\d])/i);
      if (seasonMatch) {
        // Season pack - handle separately
        return this.matchSeasonPack(release, parseInt(seasonMatch[1]));
      }
      return false;
    }

    const releaseSeason = parseInt(seMatch[1]);
    const releaseEpisode = parseInt(seMatch[2]);
    const releaseQuality = this.detectQuality(release.title);
    const releaseIsProper = this.isProper(release.title);
    const releaseIsRepack = this.isRepack(release.title);

    // Get monitored episodes (both missing AND with files for upgrades)
    const wantedEpisodes = db.prepare(`
      SELECT e.id as episode_id, e.series_id, s.title as series_title, 
             e.season_number, e.episode_number, s.quality_profile_id, e.has_file,
             ef.quality, ef.file_path
      FROM episodes e
      JOIN tv_series s ON e.series_id = s.id
      LEFT JOIN episode_files ef ON e.id = ef.episode_id
      WHERE e.monitored = 1 AND s.monitored = 1
      AND e.season_number = ? AND e.episode_number = ?
    `).all(releaseSeason, releaseEpisode) as WantedEpisode[];

    for (const ep of wantedEpisodes) {
      if (this.titleMatches(release.title, ep.series_title)) {
        logger.info(`[RSS] Potential match for "${ep.series_title}" S${ep.season_number}E${ep.episode_number}: ${release.title}`);
        
        // Verify quality matches profile
        const profile = QualityProfileModel.findById(ep.quality_profile_id);
        if (!profile) continue;

        if (!QualityProfileModel.meetsProfile(ep.quality_profile_id, releaseQuality)) {
          logger.debug(`[RSS] Quality ${releaseQuality} not allowed`);
          continue;
        }

        // Check if this is a missing file OR an upgrade
        if (ep.has_file && ep.quality) {
          // Already has file - check if this is an upgrade
          const currentIsProper = ep.file_path ? this.isProper(ep.file_path) : false;
          const currentIsRepack = ep.file_path ? this.isRepack(ep.file_path) : false;

          const shouldUpgrade = QualityProfileModel.shouldUpgrade(
            ep.quality_profile_id,
            ep.quality,
            releaseQuality,
            {
              currentIsProper,
              currentIsRepack,
              newIsProper: releaseIsProper,
              newIsRepack: releaseIsRepack
            }
          );

          if (!shouldUpgrade) {
            logger.debug(`[RSS] Not an upgrade for ${ep.series_title} S${ep.season_number}E${ep.episode_number} (current: ${ep.quality}, new: ${releaseQuality})`);
            continue;
          }
          logger.info(`[RSS] Upgrade available for "${ep.series_title}" S${ep.season_number}E${ep.episode_number}: ${ep.quality} → ${releaseQuality}${releaseIsProper ? ' (PROPER)' : ''}${releaseIsRepack ? ' (REPACK)' : ''}`);
        }

        // Check blacklist
        const blacklisted = ReleaseBlacklistModel.getForSeries(ep.series_id)
          .filter((b: any) => !b.season_number || (b.season_number === ep.season_number && (!b.episode_number || b.episode_number === ep.episode_number)));
        if (blacklisted.some((b: any) => b.release_title.toLowerCase() === release.title.toLowerCase())) {
          logger.debug(`[RSS] Release blacklisted`);
          continue;
        }

        // Check custom format score
        const cfScore = CustomFormatModel.calculateReleaseScore(release.title, ep.quality_profile_id, release.size);
        const minCfScore = profile.min_custom_format_score || 0;
        if (cfScore < minCfScore) {
          logger.debug(`[RSS] Custom format score ${cfScore} below minimum ${minCfScore}`);
          continue;
        }

        // CRITICAL: Check if there's already an active download for this episode
        const activeDownload = DownloadModel.findActiveByEpisode(ep.series_id, ep.season_number, ep.episode_number);
        if (activeDownload) {
          logger.debug(`[RSS] Episode "${ep.series_title}" S${ep.season_number}E${ep.episode_number} already has an active download: ${activeDownload.title} (${activeDownload.status})`);
          continue;
        }

        // Also check if this exact release URL is already being downloaded
        const existingRelease = DownloadModel.findByDownloadUrl(release.downloadUrl);
        if (existingRelease) {
          logger.debug(`[RSS] Release already downloading: ${release.title}`);
          continue;
        }

        // Grab the release directly!
        const action = ep.has_file ? 'Upgrading' : 'Grabbing';
        logger.info(`[RSS] ${action} release for "${ep.series_title}" S${ep.season_number}E${ep.episode_number}`);
        const grabbed = await this.grabRelease(
          release, 
          'episode', 
          ep.series_id, 
          `${ep.series_title} S${String(ep.season_number).padStart(2, '0')}E${String(ep.episode_number).padStart(2, '0')}`,
          ep.season_number,
          ep.episode_number
        );
        if (grabbed) {
          this.markReleaseGrabbed(release.guid);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Match a season pack release
   */
  private async matchSeasonPack(release: SearchResult, seasonNumber: number): Promise<boolean> {
    // Get series with wanted episodes in this season (missing or upgradeable)
    const wantedSeries = db.prepare(`
      SELECT DISTINCT s.id, s.title, s.quality_profile_id
      FROM tv_series s
      JOIN episodes e ON s.id = e.series_id
      WHERE s.monitored = 1 AND e.monitored = 1
      AND e.season_number = ?
      AND (e.has_file = 0 OR s.quality_profile_id IN (
        SELECT id FROM quality_profiles WHERE upgrade_allowed = 1
      ))
    `).all(seasonNumber) as any[];

    for (const series of wantedSeries) {
      if (this.titleMatches(release.title, series.title)) {
        logger.info(`[RSS] Potential season pack match for "${series.title}" S${seasonNumber}: ${release.title}`);
        
        // Verify quality matches profile
        const profile = QualityProfileModel.findById(series.quality_profile_id);
        if (!profile) continue;

        const quality = this.detectQuality(release.title);
        if (!QualityProfileModel.meetsProfile(series.quality_profile_id, quality)) {
          logger.debug(`[RSS] Quality ${quality} not allowed for season pack`);
          continue;
        }

        // CRITICAL: Check if there's already an active download for this season
        // Check if any episode in this season already has an active download
        const activeSeasonDownload = db.prepare(`
          SELECT * FROM downloads 
          WHERE series_id = ? AND season_number = ?
          AND status IN ('queued', 'downloading', 'importing')
          LIMIT 1
        `).get(series.id, seasonNumber);
        if (activeSeasonDownload) {
          logger.debug(`[RSS] Season pack "${series.title}" S${seasonNumber} already has an active download`);
          continue;
        }

        // Also check if this exact release URL is already being downloaded
        const existingRelease = DownloadModel.findByDownloadUrl(release.downloadUrl);
        if (existingRelease) {
          logger.debug(`[RSS] Release already downloading: ${release.title}`);
          continue;
        }

        // Grab season pack
        const grabbed = await this.grabRelease(
          release, 
          'episode', 
          series.id, 
          `${series.title} S${String(seasonNumber).padStart(2, '0')}`,
          seasonNumber
        );
        if (grabbed) {
          this.markReleaseGrabbed(release.guid);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Actually grab a release - send to download client
   */
  private async grabRelease(
    release: SearchResult, 
    mediaType: 'movie' | 'episode',
    mediaId: string,
    title: string,
    seasonNumber?: number,
    episodeNumber?: number
  ): Promise<boolean> {
    try {
      // Create download record
      const download = DownloadModel.create({
        movie_id: mediaType === 'movie' ? mediaId : undefined,
        series_id: mediaType === 'episode' ? mediaId : undefined,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        media_type: mediaType === 'movie' ? 'movie' : 'tv',
        title: release.title,
        download_url: release.downloadUrl,
        size: release.size,
        seeders: release.seeders,
        indexer: release.indexer,
        quality: release.quality || this.detectQuality(release.title)
      });

      // Add to download client (uses 'tv' not 'episode')
      const addResult = await downloadClientService.addDownload(
        release.downloadUrl,
        mediaType === 'movie' ? 'movie' : 'tv',
        '',  // Empty save path - let client use default
        undefined,  // Auto-select client
        release.protocol
      );

      if (!addResult.success) {
        logger.error(`[RSS] Failed to add download: ${addResult.message}`);
        DownloadModel.updateStatus(download.id, 'failed', 0, addResult.message);
        return false;
      }

      // Update download with client info
      if (addResult.clientId) {
        DownloadModel.updateDownloadClient(download.id, addResult.clientId);
      }
      if (addResult.downloadId) {
        DownloadModel.updateTorrentHash(download.id, addResult.downloadId);
      }

      DownloadModel.updateStatus(download.id, 'downloading');

      // Log activity
      if (mediaType === 'movie') {
        ActivityLogModel.logMovieEvent(
          mediaId,
          EVENT_TYPES.GRABBED,
          `${release.title} grabbed from ${release.indexer} (RSS)`,
          JSON.stringify({
            indexer: release.indexer,
            quality: release.quality,
            size: release.size ? `${(release.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Unknown',
            seeders: release.seeders,
            protocol: release.protocol,
            source: 'RSS'
          })
        );

        // Send notification
        const movie = MovieModel.findById(mediaId);
        notificationService.notify({
          event: 'onGrab',
          title: 'Release Grabbed (RSS)',
          message: `${release.title} grabbed from ${release.indexer}`,
          mediaType: 'movie',
          mediaTitle: movie?.title || title
        }).catch(err => logger.error('Notification error:', err));
      } else {
        ActivityLogModel.logSeriesEvent(
          mediaId,
          EVENT_TYPES.GRABBED,
          `${release.title} grabbed from ${release.indexer} (RSS)`,
          JSON.stringify({
            indexer: release.indexer,
            quality: release.quality,
            size: release.size ? `${(release.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Unknown',
            seeders: release.seeders,
            protocol: release.protocol,
            season: seasonNumber,
            episode: episodeNumber,
            source: 'RSS'
          })
        );

        // Send notification
        const series = TVSeriesModel.findById(mediaId);
        notificationService.notify({
          event: 'onGrab',
          title: 'Release Grabbed (RSS)',
          message: `${release.title} grabbed from ${release.indexer}`,
          mediaType: 'series',
          mediaTitle: series?.title || title
        }).catch(err => logger.error('Notification error:', err));
      }

      logger.info(`[RSS] Successfully grabbed: ${release.title}`);
      return true;
    } catch (error: any) {
      logger.error(`[RSS] Failed to grab release: ${error.message}`);
      return false;
    }
  }

  /**
   * Detect quality from release title
   */
  private detectQuality(title: string): string {
    const upperTitle = title.toUpperCase();
    
    // Resolution
    if (upperTitle.includes('2160P') || upperTitle.includes('4K') || upperTitle.includes('UHD')) {
      if (upperTitle.includes('REMUX')) return 'Remux-2160p';
      if (upperTitle.includes('BLURAY') || upperTitle.includes('BD')) return 'Bluray-2160p';
      if (upperTitle.includes('WEB-DL') || upperTitle.includes('WEBDL')) return 'WEBDL-2160p';
      if (upperTitle.includes('WEBRIP') || upperTitle.includes('WEB-RIP')) return 'WEBRip-2160p';
      if (upperTitle.includes('WEB')) return 'WEBDL-2160p';
      return 'HDTV-2160p';
    }
    
    if (upperTitle.includes('1080P')) {
      if (upperTitle.includes('REMUX')) return 'Remux-1080p';
      if (upperTitle.includes('BLURAY') || upperTitle.includes('BD')) return 'Bluray-1080p';
      if (upperTitle.includes('WEB-DL') || upperTitle.includes('WEBDL')) return 'WEBDL-1080p';
      if (upperTitle.includes('WEBRIP') || upperTitle.includes('WEB-RIP')) return 'WEBRip-1080p';
      if (upperTitle.includes('WEB')) return 'WEBDL-1080p';
      return 'HDTV-1080p';
    }
    
    if (upperTitle.includes('720P')) {
      if (upperTitle.includes('BLURAY') || upperTitle.includes('BD')) return 'Bluray-720p';
      if (upperTitle.includes('WEB-DL') || upperTitle.includes('WEBDL')) return 'WEBDL-720p';
      if (upperTitle.includes('WEBRIP') || upperTitle.includes('WEB-RIP')) return 'WEBRip-720p';
      if (upperTitle.includes('WEB')) return 'WEBDL-720p';
      return 'HDTV-720p';
    }
    
    if (upperTitle.includes('480P') || upperTitle.includes('SDTV')) {
      return 'SDTV';
    }
    
    // Default
    if (upperTitle.includes('WEB-DL') || upperTitle.includes('WEBDL')) return 'WEBDL-1080p';
    if (upperTitle.includes('WEB')) return 'WEBDL-1080p';
    if (upperTitle.includes('HDTV')) return 'HDTV-1080p';
    if (upperTitle.includes('BLURAY') || upperTitle.includes('BD')) return 'Bluray-1080p';
    
    return 'Unknown';
  }

  /**
   * Check if a release/file is a PROPER release
   */
  private isProper(title: string): boolean {
    const upperTitle = title.toUpperCase();
    return upperTitle.includes('PROPER') || upperTitle.includes('.PROPER.');
  }

  /**
   * Check if a release/file is a REPACK release
   */
  private isRepack(title: string): boolean {
    const upperTitle = title.toUpperCase();
    return upperTitle.includes('REPACK') || upperTitle.includes('.REPACK.') ||
           upperTitle.includes('RERIP') || upperTitle.includes('.RERIP.');
  }

  /**
   * Check if a release title matches an expected title
   */
  private titleMatches(releaseTitle: string, expectedTitle: string, expectedYear?: number | null): boolean {
    // Normalize titles
    const normalizeTitle = (title: string) => {
      return title
        .toLowerCase()
        .replace(/a\.i\./gi, 'ai')
        .replace(/&/g, ' and ')
        .replace(/['']/g, '')
        .replace(/\//g, ' ')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+and\s+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Convert dots/underscores to spaces for easier parsing
    let extractedTitle = releaseTitle.replace(/[._]/g, ' ');
    
    // CRITICAL: Check if this is a TV episode/season (S##E## or S## or Season ##)
    // If we're matching for a movie (year provided), reject TV patterns
    if (expectedYear !== undefined) {
      const tvPatterns = [
        /\bS\d{1,2}E\d{1,2}\b/i,           // S01E01
        /\bS\d{1,2}\s*E\d{1,2}\b/i,         // S01 E01
        /\bS\d{1,2}\b(?!\d)/i,              // S01 alone (season pack) - not followed by more digits
        /\b\d{1,2}x\d{1,2}\b/,               // 1x01
        /\bSeason\s*\d+/i,                   // Season 1 (with or without episode)
        /\bEpisode\s*\d+/i,                  // Episode 1
        /\bComplete\s*Series/i,              // Complete Series
        /\bMini[\s-]*Series/i,               // Mini-Series / Miniseries
      ];
      
      for (const pattern of tvPatterns) {
        if (pattern.test(releaseTitle)) {
          return false; // This is a TV show, not a movie
        }
      }
    }

    // Extract title from release (before year/quality)
    const splitPatterns = [
      /\s+(19|20)\d{2}\s/,
      /\s+S\d{2}/i,
      /\s+(720p|1080p|2160p|4k)/i,
      /\s+(WEB|HDTV|BluRay|BDRip)/i,
    ];
    
    for (const pattern of splitPatterns) {
      const match = extractedTitle.match(pattern);
      if (match && match.index !== undefined) {
        extractedTitle = extractedTitle.substring(0, match.index);
        break;
      }
    }

    const normalizedRelease = normalizeTitle(extractedTitle);
    const normalizedExpected = normalizeTitle(expectedTitle);

    const releaseWords = normalizedRelease.split(/\s+/).filter(w => w.length > 0);
    const allExpectedWords = normalizedExpected.split(/\s+/).filter(w => w.length > 1);

    if (allExpectedWords.length === 0) return false;

    // Common articles that are often omitted in release names
    const commonArticles = ['the', 'a', 'an', 'and', 'of', 'in', 'on', 'at', 'to', 'for'];
    
    // Separate content words (required) from articles (optional)
    const expectedWords = allExpectedWords.filter(w => !commonArticles.includes(w));
    const articleWords = allExpectedWords.filter(w => commonArticles.includes(w));

    if (expectedWords.length === 0) return false;

    // Require exact CONTENT word matches (articles are optional)
    const matchedWords = expectedWords.filter(ew => 
      releaseWords.some(rw => rw === ew)
    );
    
    const matchRatio = matchedWords.length / expectedWords.length;
    if (matchRatio < 0.8) return false;

    // STRICT: Check that the expected title appears near the START of the release title
    // Don't allow "He-Man and the Masters of the Universe" to match "Masters of the Universe"
    // The first CONTENT word of expected should appear within the first few words of release
    const firstExpectedWord = expectedWords[0];
    const firstExpectedIdx = releaseWords.indexOf(firstExpectedWord);
    
    // For SHORT titles (1-2 content words like "War", "It", "Up", "The Tank"), be VERY strict
    // First word must be at position 0 or 1 only
    if (expectedWords.length <= 2) {
      if (firstExpectedIdx < 0 || firstExpectedIdx > 1) {
        return false;
      }
    } else {
      // For longer titles, allow position 0, 1, or 2
      if (firstExpectedIdx < 0 || firstExpectedIdx > 2) {
        return false;
      }
    }

    // Check year if provided (for movies)
    if (expectedYear) {
      const yearMatch = releaseTitle.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        const releaseYear = parseInt(yearMatch[0]);
        // Allow 1 year tolerance for edge cases (December release in next year, etc.)
        if (Math.abs(releaseYear - expectedYear) > 1) {
          return false;
        }
      }
      // If no year found and we're expecting 2024+ (unreleased/upcoming movie), be cautious
      // Don't auto-match releases without years for future movies
      else if (expectedYear >= new Date().getFullYear()) {
        return false;
      }
    }

    // Check extra words limit - be stricter for short titles
    const unmatchedReleaseWords = releaseWords.filter(rw => 
      !allExpectedWords.some(ew => ew === rw)
    );
    
    // For short titles, allow fewer extra words
    let maxExtraWords: number;
    if (expectedWords.length <= 2) {
      maxExtraWords = 1; // Very strict for short titles
    } else {
      maxExtraWords = Math.max(2, Math.floor(matchedWords.length * 0.5));
    }
    
    if (unmatchedReleaseWords.length > maxExtraWords) {
      return false;
    }

    return true;
  }

  /**
   * Mark a release as grabbed in the cache
   */
  private markReleaseGrabbed(guid: string): void {
    try {
      db.prepare('UPDATE rss_releases SET grabbed = 1, processed = 1 WHERE guid = ?').run(guid);
    } catch (error) {
      // Ignore
    }
  }

  /**
   * Clean up old releases from the cache
   */
  private cleanupOldReleases(): void {
    try {
      const result = db.prepare(`
        DELETE FROM rss_releases 
        WHERE created_at < datetime('now', '-7 days')
      `).run();
      
      if (result.changes > 0) {
        logger.info(`[RSS] Cleaned up ${result.changes} old releases from cache`);
      }
    } catch (error) {
      // Ignore
    }
  }

  /**
   * Get recent RSS releases for display
   */
  getRecentReleases(limit: number = 100): RssRelease[] {
    return db.prepare(`
      SELECT * FROM rss_releases 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit) as RssRelease[];
  }

  /**
   * Get RSS sync stats
   */
  getStats(): { totalCached: number; grabbed: number; processed: number } {
    const result = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(grabbed) as grabbed,
        SUM(processed) as processed
      FROM rss_releases
    `).get() as any;
    
    return {
      totalCached: result?.total || 0,
      grabbed: result?.grabbed || 0,
      processed: result?.processed || 0
    };
  }
}

export const rssSyncService = new RssSyncService();
