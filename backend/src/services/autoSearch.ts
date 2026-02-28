import { indexerService } from './indexer';
import { downloadClientService } from './downloadClient';
import { MovieModel } from '../models/Movie';
import { TVSeriesModel } from '../models/TVSeries';
import { DownloadModel } from '../models/Download';
import { QualityProfileModel } from '../models/QualityProfile';
import { CustomFormatModel } from '../models/CustomFormat';
import { ReleaseBlacklistModel } from '../models/ReleaseBlacklist';
import logger from '../config/logger';
import db from '../config/database';

interface SearchResult {
  title: string;
  downloadUrl: string;
  size: number;
  seeders: number;
  indexer: string;
  quality: string;
  score: number;
  customFormatScore: number;
  protocol?: 'torrent' | 'usenet';
}

export class AutoSearchService {
  /**
   * Automatically search and download best release for a movie
   * Will also search for upgrades if the movie already has a file
   */
  async searchAndDownloadMovie(movieId: string, forceUpgradeSearch: boolean = false): Promise<SearchResult | null> {
    try {
      const movie = MovieModel.findById(movieId);
      if (!movie) {
        logger.error(`Movie not found: ${movieId}`);
        return null;
      }

      // CRITICAL: Check if there's already an active download for this movie
      const activeDownload = DownloadModel.findActiveByMovieId(movieId);
      if (activeDownload) {
        logger.info(`Movie ${movie.title} already has an active download: ${activeDownload.title} (${activeDownload.status})`);
        return null;
      }

      // Get quality profile
      const profileStmt = db.prepare('SELECT * FROM quality_profiles WHERE id = ?');
      const profile = profileStmt.get(movie.quality_profile_id) as any;
      if (profile) {
        profile.upgrade_allowed = Boolean(profile.upgrade_allowed);
        profile.items = JSON.parse(profile.items || '[]');
      }

      // Check if we already have a file and should search for upgrades
      let currentIsProper = false;
      let currentIsRepack = false;
      
      if (movie.has_file && movie.quality_profile_id) {
        // Get current quality - first try movie table, then fall back to movie_files
        let currentQuality = movie.quality;
        
        // If quality is missing from movies table, get it from movie_files
        if (!currentQuality || currentQuality === 'Unknown') {
          const fileQualityStmt = db.prepare('SELECT quality, is_proper, is_repack FROM movie_files WHERE movie_id = ? LIMIT 1');
          const currentFile = fileQualityStmt.get(movie.id) as { quality?: string; is_proper?: number; is_repack?: number } | undefined;
          if (currentFile) {
            currentQuality = currentFile.quality || 'Unknown';
            currentIsProper = Boolean(currentFile.is_proper);
            currentIsRepack = Boolean(currentFile.is_repack);
          }
        } else {
          // Get proper/repack status from movie_files
          const fileStmt = db.prepare('SELECT is_proper, is_repack FROM movie_files WHERE movie_id = ? LIMIT 1');
          const currentFile = fileStmt.get(movie.id) as { is_proper?: number; is_repack?: number } | undefined;
          if (currentFile) {
            currentIsProper = Boolean(currentFile.is_proper);
            currentIsRepack = Boolean(currentFile.is_repack);
          }
        }
        
        currentQuality = currentQuality || 'Unknown';
        
        // Check if upgrades are allowed and we haven't reached cutoff
        if (!forceUpgradeSearch && !profile?.upgrade_allowed) {
          logger.info(`Skipping upgrade search for ${movie.title} - upgrades not allowed`);
          return null;
        }
        
        if (QualityProfileModel.meetsCutoff(movie.quality_profile_id, currentQuality) && !forceUpgradeSearch) {
          logger.info(`Skipping upgrade search for ${movie.title} - already at cutoff quality (${currentQuality})`);
          return null;
        }
        
        logger.info(`Searching for upgrade for movie: ${movie.title} (current: ${currentQuality}${currentIsProper ? ' PROPER' : ''}${currentIsRepack ? ' REPACK' : ''})`);
      } else {
        logger.info(`Auto-searching for movie: ${movie.title} (${movie.year})`);
      }

      // Search all indexers
      const releases = await indexerService.searchMovie(movie.title, movie.year ?? undefined);

      if (releases.length === 0) {
        logger.warn(`No releases found for: ${movie.title}`);
        return null;
      }

      // Get blacklisted releases for this movie
      const blacklistedReleases = ReleaseBlacklistModel.getForMovie(movieId);
      const blacklistedTitles = blacklistedReleases.map(r => r.release_title);
      
      if (blacklistedTitles.length > 0) {
        logger.info(`[Blacklist] ${blacklistedTitles.length} releases blacklisted for ${movie.title}`);
      }

      // Score and filter releases with title validation and blacklist
      const scored = this.scoreReleases(releases, profile, movie.title, blacklistedTitles, movie.year ?? undefined);

      if (scored.length === 0) {
        logger.warn(`No suitable releases found for: ${movie.title}`);
        return null;
      }

      // Select best release
      const best = scored[0];
      
      // Check if best release is proper/repack
      const { isProper: newIsProper, isRepack: newIsRepack } = QualityProfileModel.isProperOrRepack(best.title);
      
      // If movie already has file, check if best release is actually an upgrade
      if (movie.has_file) {
        // Get current quality - first try movie table, then fall back to movie_files
        let currentQualityForUpgrade = movie.quality;
        if (!currentQualityForUpgrade || currentQualityForUpgrade === 'Unknown') {
          const fileQualityStmt = db.prepare('SELECT quality FROM movie_files WHERE movie_id = ? LIMIT 1');
          const currentFile = fileQualityStmt.get(movie.id) as { quality?: string } | undefined;
          currentQualityForUpgrade = currentFile?.quality || 'Unknown';
        }
        
        if (!QualityProfileModel.shouldUpgrade(movie.quality_profile_id!, currentQualityForUpgrade, best.quality, {
          currentIsProper,
          currentIsRepack,
          newIsProper,
          newIsRepack
        })) {
          logger.info(`No quality upgrade available for ${movie.title} (current: ${currentQualityForUpgrade}, best: ${best.quality})`);
          return null;
        }
        logger.info(`Found quality upgrade for ${movie.title}: ${currentQualityForUpgrade} -> ${best.quality}${newIsProper ? ' PROPER' : ''}${newIsRepack ? ' REPACK' : ''}`);
      }
      
      logger.info(`Selected best release: ${best.title} (score: ${best.score}, protocol: ${best.protocol || 'unknown'})`);

      // Start download
      const download = DownloadModel.create({
        movie_id: movieId,
        media_type: 'movie',
        title: best.title,
        download_url: best.downloadUrl,
        size: best.size,
        seeders: best.seeders,
        indexer: best.indexer,
        quality: best.quality
      });

      // Use unified download client service
      const savePath = movie.folder_path || `/data/movies/${movie.title}`;
      const addResult = await downloadClientService.addDownload(
        best.downloadUrl,
        'movie',
        savePath,
        undefined, // Let service pick the client
        best.protocol
      );

      if (addResult.success) {
        if (addResult.downloadId) {
          DownloadModel.updateTorrentHash(download.id, addResult.downloadId);
        }
        if (addResult.clientId) {
          DownloadModel.updateDownloadClient(download.id, addResult.clientId);
        }
        logger.info(`Download started for: ${movie.title}`);
        return best;
      } else {
        logger.error(`Failed to add download: ${addResult.message}`);
        DownloadModel.updateStatus(download.id, 'failed');
        return { ...best, error: addResult.message } as any;
      }
    } catch (error) {
      logger.error('Auto-search error:', error);
      return null;
    }
  }

  /**
   * Automatically search and download best release for an episode
   * Will also search for upgrades if the episode already has a file
   */
  async searchAndDownloadEpisode(
    seriesId: string,
    seasonNumber: number,
    episodeNumber: number,
    forceUpgradeSearch: boolean = false
  ): Promise<SearchResult | null> {
    try {
      const series = TVSeriesModel.findById(seriesId);
      if (!series) {
        logger.error(`Series not found: ${seriesId}`);
        return null;
      }

      const episode = TVSeriesModel.findEpisodesBySeason(seriesId, seasonNumber).find(
        (e: any) => e.episode_number === episodeNumber
      );

      if (!episode) {
        logger.error(`Episode not found: S${seasonNumber}E${episodeNumber}`);
        return null;
      }

      // CRITICAL: Check if there's already an active download for this episode
      const activeDownload = DownloadModel.findActiveByEpisode(seriesId, seasonNumber, episodeNumber);
      if (activeDownload) {
        logger.info(`Episode ${series.title} S${seasonNumber}E${episodeNumber} already has an active download: ${activeDownload.title} (${activeDownload.status})`);
        return null;
      }

      // Get quality profile
      const profileStmt = db.prepare('SELECT * FROM quality_profiles WHERE id = ?');
      const profile = profileStmt.get(series.quality_profile_id) as any;
      if (profile) {
        profile.upgrade_allowed = Boolean(profile.upgrade_allowed);
        profile.items = JSON.parse(profile.items || '[]');
      }

      // Check if we already have a file and should search for upgrades
      let currentIsProper = false;
      let currentIsRepack = false;
      
      if (episode.has_file && series.quality_profile_id) {
        const currentQuality = episode.quality || 'Unknown';
        
        // Get proper/repack status from episode
        currentIsProper = Boolean(episode.is_proper);
        currentIsRepack = Boolean(episode.is_repack);
        
        if (!forceUpgradeSearch && !profile?.upgrade_allowed) {
          logger.debug(`Skipping upgrade search for ${series.title} S${seasonNumber}E${episodeNumber} - upgrades not allowed`);
          return null;
        }
        
        if (QualityProfileModel.meetsCutoff(series.quality_profile_id, currentQuality) && !forceUpgradeSearch) {
          logger.debug(`Skipping upgrade search for ${series.title} S${seasonNumber}E${episodeNumber} - already at cutoff quality (${currentQuality})`);
          return null;
        }
        
        logger.info(`Searching for upgrade for: ${series.title} S${seasonNumber}E${episodeNumber} (current: ${currentQuality}${currentIsProper ? ' PROPER' : ''}${currentIsRepack ? ' REPACK' : ''})`);
      } else {
        logger.info(`Auto-searching for: ${series.title} S${seasonNumber}E${episodeNumber}`);
      }

      // Search all indexers
      const releases = await indexerService.searchTV(series.title, seasonNumber, episodeNumber);

      if (releases.length === 0) {
        logger.warn(`No releases found for: ${series.title} S${seasonNumber}E${episodeNumber}`);
        return null;
      }

      // Get blacklisted releases for this episode
      const blacklistedReleases = ReleaseBlacklistModel.getForSeries(seriesId)
        .filter(r => 
          !r.season_number || r.season_number === seasonNumber
        )
        .filter(r => 
          !r.episode_number || r.episode_number === episodeNumber
        );
      const blacklistedTitles = blacklistedReleases.map(r => r.release_title);
      
      if (blacklistedTitles.length > 0) {
        logger.info(`[Blacklist] ${blacklistedTitles.length} releases blacklisted for ${series.title} S${seasonNumber}E${episodeNumber}`);
      }

      // Score and filter releases with title validation and blacklist
      const scored = this.scoreReleases(releases, profile, series.title, blacklistedTitles);

      if (scored.length === 0) {
        logger.warn(`No suitable releases found`);
        return null;
      }

      // Select best release
      const best = scored[0];
      
      // Check if best release is proper/repack
      const { isProper: newIsProper, isRepack: newIsRepack } = QualityProfileModel.isProperOrRepack(best.title);
      
      // If episode already has file, check if best release is actually an upgrade
      if (episode.has_file) {
        const currentQuality = episode.quality || 'Unknown';
        if (!QualityProfileModel.shouldUpgrade(series.quality_profile_id!, currentQuality, best.quality, {
          currentIsProper,
          currentIsRepack,
          newIsProper,
          newIsRepack
        })) {
          logger.info(`No quality upgrade available for ${series.title} S${seasonNumber}E${episodeNumber} (current: ${currentQuality}, best: ${best.quality})`);
          return null;
        }
        logger.info(`Found quality upgrade for ${series.title} S${seasonNumber}E${episodeNumber}: ${currentQuality} -> ${best.quality}${newIsProper ? ' PROPER' : ''}${newIsRepack ? ' REPACK' : ''}`);
      }
      
      logger.info(`Selected best release: ${best.title} (score: ${best.score}, protocol: ${best.protocol || 'unknown'})`);

      // Start download
      const download = DownloadModel.create({
        series_id: seriesId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        media_type: 'tv',
        title: best.title,
        download_url: best.downloadUrl,
        size: best.size,
        seeders: best.seeders,
        indexer: best.indexer,
        quality: best.quality
      });

      // Use unified download client service
      const savePath = series.folder_path || `/data/tv/${series.title}`;
      const addResult = await downloadClientService.addDownload(
        best.downloadUrl,
        'tv',
        savePath,
        undefined, // Let service pick the client
        best.protocol
      );

      if (addResult.success) {
        if (addResult.downloadId) {
          DownloadModel.updateTorrentHash(download.id, addResult.downloadId);
        }
        if (addResult.clientId) {
          DownloadModel.updateDownloadClient(download.id, addResult.clientId);
        }
        logger.info(`Download started for: ${series.title} S${seasonNumber}E${episodeNumber}`);
        return best;
      } else {
        logger.error(`Failed to add download: ${addResult.message}`);
        DownloadModel.updateStatus(download.id, 'failed');
        return { ...best, error: addResult.message } as any;
      }
    } catch (error) {
      logger.error('Auto-search error:', error);
      return null;
    }
  }

  /**
   * Automatically search and download all missing episodes for a series
   * Also searches for quality upgrades if enabled in the profile
   */
  async searchAndDownloadSeries(seriesId: string, includeUpgrades: boolean = true): Promise<{ searched: number; found: number }> {
    try {
      const series = TVSeriesModel.findById(seriesId);
      if (!series) {
        logger.error(`Series not found: ${seriesId}`);
        return { searched: 0, found: 0 };
      }

      // Get quality profile to check if upgrades are allowed
      const profileStmt = db.prepare('SELECT * FROM quality_profiles WHERE id = ?');
      const profile = profileStmt.get(series.quality_profile_id) as any;
      const upgradesAllowed = includeUpgrades && profile?.upgrade_allowed;

      logger.info(`Auto-searching for ${series.title} (missing episodes${upgradesAllowed ? ' + upgrades' : ''})`);

      // Get all episodes that are monitored but don't have files
      const seasons = TVSeriesModel.findSeasonsBySeriesId(seriesId);
      let searched = 0;
      let found = 0;

      for (const season of seasons) {
        // Skip specials (season 0)
        if (season.season_number === 0) continue;
        
        const episodes = TVSeriesModel.findEpisodesBySeason(seriesId, season.season_number);
        
        for (const episode of episodes) {
          // Skip if not monitored
          if (!episode.monitored) continue;
          
          // Skip future episodes (compare dates only, ignoring time/timezone issues)
          if (episode.air_date) {
            // Compare just the date strings (YYYY-MM-DD format)
            const today = new Date().toISOString().split('T')[0];
            if (episode.air_date > today) continue;
          }
          
          // Determine if we should search:
          // - Missing episodes (no file): always search
          // - Episodes with files: only search if upgrades are allowed
          const isMissing = !episode.has_file;
          const shouldSearchForUpgrade = episode.has_file && upgradesAllowed;
          
          if (!isMissing && !shouldSearchForUpgrade) continue;

          searched++;
          
          try {
            const result = await this.searchAndDownloadEpisode(
              seriesId,
              season.season_number,
              episode.episode_number
            );
            
            if (result) {
              found++;
            }
            
            // Small delay between searches to avoid hammering indexers
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            logger.error(`Failed to search for S${season.season_number}E${episode.episode_number}:`, err);
          }
        }
      }

      logger.info(`Finished auto-search for ${series.title}: searched ${searched}, found ${found}`);
      return { searched, found };
    } catch (error) {
      logger.error('Auto-search series error:', error);
      return { searched: 0, found: 0 };
    }
  }

  /**
   * Score releases based on quality profile preferences, custom formats, and title match
   * Filters out blacklisted releases
   */
  private scoreReleases(
    releases: any[], 
    profile: any, 
    expectedTitle?: string,
    blacklistedTitles: string[] = [],
    expectedYear?: number
  ): SearchResult[] {
    // Get profile's minimum custom format score
    const minCfScore = profile.min_custom_format_score || 0;
    
    // Normalize blacklisted titles for comparison
    const normalizedBlacklist = new Set(
      blacklistedTitles.map(t => t.toLowerCase().trim())
    );
    
    return releases
      .filter(r => {
        // Filter out blacklisted releases
        const normalizedTitle = r.title?.toLowerCase().trim();
        if (normalizedBlacklist.has(normalizedTitle)) {
          logger.debug(`[SCORE] Rejected - blacklisted release: "${r.title}"`);
          return false;
        }
        return true;
      })
      .map(r => {
        const quality = this.detectQuality(r.title);
        const baseScore = this.calculateScore(r, profile, expectedTitle, expectedYear);
        const customFormatScore = profile.id 
          ? CustomFormatModel.calculateReleaseScore(r.title, profile.id, r.size)
          : 0;
        
        return {
          ...r,
          quality,
          score: baseScore,
          customFormatScore,
          // Combined score for sorting
          totalScore: baseScore + customFormatScore
        };
      })
      .filter(r => {
        // Must pass base quality checks
        if (r.score <= 0) return false;
        // Must meet minimum custom format score
        if (r.customFormatScore < minCfScore) {
          logger.debug(`[SCORE] Rejected - custom format score ${r.customFormatScore} below minimum ${minCfScore}: "${r.title}"`);
          return false;
        }
        return true;
      })
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Calculate base score for a release (quality profile based)
   */
  private calculateScore(release: any, profile: any, expectedTitle?: string, expectedYear?: number): number {
    let score = 0;

    // Title match validation - if expected title provided, validate it matches
    if (expectedTitle) {
      const titleMatch = this.validateTitleMatch(release.title, expectedTitle);
      if (!titleMatch) {
        logger.debug(`[SCORE] Rejected - title mismatch: "${release.title}" vs "${expectedTitle}"`);
        return 0; // Reject releases that don't match the title
      }
    }
    
    // Year validation - if expected year provided, verify the release contains it
    if (expectedYear) {
      const releaseYear = this.extractYearFromRelease(release.title);
      if (releaseYear && Math.abs(releaseYear - expectedYear) > 1) {
        // Allow ±1 year for edge cases (late year releases, etc)
        logger.debug(`[SCORE] Rejected - year mismatch: release has ${releaseYear}, expected ${expectedYear}: "${release.title}"`);
        return 0;
      }
    }

    const quality = this.detectQuality(release.title);
    
    // Check if quality is allowed in profile using QualityProfileModel
    if (!QualityProfileModel.meetsProfile(profile.id, quality)) {
      logger.debug(`[SCORE] Rejected - quality ${quality} not allowed in profile ${profile.name}`);
      return 0;
    }
    
    // Quality is allowed, add base score
    score += 100;
    
    // Calculate quality ranks for comparison
    const qualityWeight = QualityProfileModel.getQualityWeight(quality);
    const cutoffWeight = QualityProfileModel.getQualityWeight(profile.cutoff_quality);
    
    // Prefer cutoff quality
    if (qualityWeight === cutoffWeight) {
      score += 50;
    } else if (qualityWeight < cutoffWeight) {
      // Penalize lower than cutoff
      score -= Math.min((cutoffWeight - qualityWeight) * 5, 40);
    } else {
      // Small penalty for higher than cutoff (uses more space)
      score -= Math.min((qualityWeight - cutoffWeight) * 2, 20);
    }

    // Seeders bonus (up to 50 points)
    score += Math.min(release.seeders / 2, 50);

    // Size check (penalize if way too large or too small)
    const expectedSize = this.getExpectedSize(quality, release.type || 'movie');
    if (release.size) {
      const sizeRatio = release.size / expectedSize;
      if (sizeRatio < 0.3 || sizeRatio > 3) {
        // Way off expected size
        score -= 50;
      } else if (sizeRatio < 0.5 || sizeRatio > 2) {
        // Somewhat off
        score -= 20;
      }
    }

    // Prefer WEB-DL/BluRay for better quality sources
    if (release.title.match(/WEB-?DL|BluRay|BRRip/i)) {
      score += 20;
    }

    return Math.max(score, 0);
  }

  /**
   * Detect quality from release title (returns full quality string like WEB-1080p or CAM)
   */
  private detectQuality(title: string): string {
    const upper = title.toUpperCase();
    
    // First check for low quality sources (these override resolution detection)
    // These are standalone qualities without resolution
    if (upper.includes('WORKPRINT') || upper.includes('WP-') || upper.includes('.WP.')) {
      return 'WORKPRINT';
    }
    if (upper.includes('CAM') || upper.includes('HDCAM') || upper.includes('HD-CAM') ||
        upper.includes('CAMRIP') || upper.includes('CAM-RIP')) {
      return 'CAM';
    }
    if (upper.includes('TELESYNC') || upper.includes('TS-') || upper.includes('.TS.') || 
        upper.includes('HDTS') || upper.includes('HD-TS') || upper.includes('PDVD')) {
      return 'TELESYNC';
    }
    if (upper.includes('TELECINE') || upper.includes('TC-') || upper.includes('.TC.') ||
        upper.includes('HDTC') || upper.includes('HD-TC')) {
      return 'TELECINE';
    }
    if (upper.includes('DVDSCR') || upper.includes('DVD-SCR') || upper.includes('DVDSCREENER') ||
        upper.includes('SCREENER') || upper.includes('SCR')) {
      return 'DVDSCR';
    }
    if (upper.includes('REGIONAL')) {
      return 'REGIONAL';
    }
    
    // Detect resolution
    let resolution = '';
    if (upper.includes('2160P') || upper.includes('4K') || upper.includes('UHD')) {
      resolution = '2160p';
    } else if (upper.includes('1080P')) {
      resolution = '1080p';
    } else if (upper.includes('720P')) {
      resolution = '720p';
    } else if (upper.includes('480P')) {
      resolution = '480p';
    } else {
      resolution = '1080p'; // Default
    }
    
    // Detect source
    let source = '';
    if (upper.includes('REMUX')) {
      source = 'Remux';
    } else if (upper.includes('BLURAY') || upper.includes('BLU-RAY') || upper.includes('BDRIP') || upper.includes('BRRIP')) {
      source = 'Bluray';
    } else if (upper.includes('WEBDL') || upper.includes('WEB-DL') || upper.includes('WEB DL')) {
      source = 'WEBDL';
    } else if (upper.includes('WEBRIP') || upper.includes('WEB-RIP') || upper.includes('WEB RIP')) {
      source = 'WEBRip';
    } else if (upper.includes('WEB')) {
      source = 'WEB'; // Generic WEB
    } else if (upper.includes('HDTV')) {
      source = 'HDTV';
    } else if (upper.includes('DVDRIP') || upper.includes('DVD')) {
      source = 'DVD';
    } else if (upper.includes('SDTV')) {
      source = 'SDTV';
    }
    
    // Combine source and resolution
    if (source && resolution) {
      return `${source}-${resolution}`;
    }
    
    // Return just resolution if no source detected (will be normalized later)
    return resolution;
  }

  /**
   * Get quality rank for comparison
   */
  private getQualityRank(quality: string): number {
    const ranks: Record<string, number> = {
      '480p': 1,
      '720p': 2,
      '1080p': 3,
      '2160p': 4
    };
    return ranks[quality] || 0;
  }

  /**
   * Get expected size for quality
   */
  private getExpectedSize(quality: string, type: string): number {
    // Extract resolution from full quality string (e.g., "WEB-1080p" -> "1080p")
    const resolution = quality.includes('-') ? quality.split('-').pop()! : quality;
    
    // Expected sizes in bytes (approximate)
    const movieSizes: Record<string, number> = {
      '480p': 700 * 1024 * 1024,      // 700 MB
      '720p': 1.5 * 1024 * 1024 * 1024, // 1.5 GB
      '1080p': 3 * 1024 * 1024 * 1024,  // 3 GB
      '2160p': 10 * 1024 * 1024 * 1024  // 10 GB
    };

    const episodeSizes: Record<string, number> = {
      '480p': 200 * 1024 * 1024,       // 200 MB
      '720p': 500 * 1024 * 1024,       // 500 MB
      '1080p': 1 * 1024 * 1024 * 1024, // 1 GB
      '2160p': 3 * 1024 * 1024 * 1024  // 3 GB
    };

    return type === 'tv' ? episodeSizes[resolution] || episodeSizes['1080p'] : movieSizes[resolution] || movieSizes['1080p'];
  }

  /**
   * Validate that a release title matches the expected title
   */
  private validateTitleMatch(releaseTitle: string, expectedTitle: string): boolean {
    // Normalize both titles
    const normalizedExpected = this.normalizeTitle(expectedTitle);
    const expectedWords = normalizedExpected.split(/\s+/).filter(w => w.length > 1);
    
    // If no meaningful expected words, skip validation
    if (expectedWords.length === 0) {
      return true;
    }
    
    // Extract title from release name (before year/quality info)
    const extractedTitle = this.extractTitleFromRelease(releaseTitle);
    const normalizedRelease = this.normalizeTitle(extractedTitle);
    const releaseWords = normalizedRelease.split(/\s+/).filter(w => w.length > 0);
    
    // STRICT: Require exact word matches only (no partial matches like "rising" in "uprising")
    const matchedWords = expectedWords.filter(expectedWord => 
      releaseWords.some(releaseWord => releaseWord === expectedWord)
    );
    const matchRatio = matchedWords.length / expectedWords.length;
    
    // Check extra words in release that don't match expected
    const unmatchedReleaseWords = releaseWords.filter(rw => 
      !expectedWords.some(ew => ew === rw)
    );
    
    // Stricter requirements:
    // 1. At least 80% of expected words must match exactly
    // 2. Release can't have more than 2x unmatched words vs matched words
    const requiredRatio = 0.8;
    const maxExtraWords = Math.max(2, matchedWords.length * 2);
    
    if (matchRatio < requiredRatio) {
      logger.debug(`[VALIDATE] Title mismatch (${Math.round(matchRatio * 100)}% match): "${extractedTitle}" vs "${expectedTitle}"`);
      return false;
    }
    
    if (unmatchedReleaseWords.length > maxExtraWords) {
      logger.debug(`[VALIDATE] Too many extra words (${unmatchedReleaseWords.length} > ${maxExtraWords}): "${extractedTitle}" vs "${expectedTitle}"`);
      return false;
    }
    
    return true;
  }

  /**
   * Normalize a title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      // Normalize "A.I." to "ai" (keep as one word)
      .replace(/a\.i\./gi, 'ai')
      // Normalize ampersand and "and" to the same thing
      .replace(/&/g, ' and ')
      .replace(/['']/g, '')
      // Normalize slashes to spaces (for titles like "Good/Bad")
      .replace(/\//g, ' ')
      .replace(/[^\w\s]/g, ' ')
      // Normalize " and " to a single space for comparison
      .replace(/\s+and\s+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract the title portion from a release name
   */
  private extractTitleFromRelease(releaseName: string): string {
    let title = releaseName.replace(/[._]/g, ' ');
    
    const splitPatterns = [
      /\s+(19|20)\d{2}\s/,
      /\s+S\d{2}E?\d*/i,
      /\s+(720p|1080p|2160p|4k)/i,
      /\s+(WEB|HDTV|BluRay|BDRip|DVDRip|HDRip|AMZN|NF|DSNP)/i,
      /\s+(x264|x265|H\.?264|H\.?265|HEVC|AVC)/i,
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

  /**
   * Extract the year from a release name
   */
  private extractYearFromRelease(releaseName: string): number | null {
    // Replace dots/underscores with spaces for better matching
    const normalized = releaseName.replace(/[._]/g, ' ');
    
    // Match year pattern (19xx or 20xx)
    const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      return parseInt(yearMatch[0], 10);
    }
    
    return null;
  }

  /**
   * Search for all missing monitored movies in the library
   * Only searches movies that meet their minimum_availability criteria
   */
  async searchAllMissingMovies(concurrentLimit: number = 1): Promise<{ total: number; searched: number; found: number; skipped: number }> {
    try {
      // Get all monitored movies without files
      const allMissingMovies = MovieModel.findMissing();
      // Get only those that are actually available
      const missingMovies = MovieModel.findMissingAndAvailable();
      const skippedCount = allMissingMovies.length - missingMovies.length;
      
      if (missingMovies.length === 0) {
        if (skippedCount > 0) {
          logger.info(`No missing movies available for search. ${skippedCount} movie(s) skipped due to minimum availability settings.`);
        } else {
          logger.info('No missing monitored movies to search');
        }
        return { total: allMissingMovies.length, searched: 0, found: 0, skipped: skippedCount };
      }

      logger.info(`Starting missing movie search: ${missingMovies.length} movies to search, ${skippedCount} skipped (not yet available)`);
      
      let searched = 0;
      let found = 0;

      // Process in batches based on concurrent limit
      for (let i = 0; i < missingMovies.length; i += concurrentLimit) {
        const batch = missingMovies.slice(i, i + concurrentLimit);
        
        const results: number[] = await Promise.all(
          batch.map(async (movie): Promise<number> => {
            try {
              const result = await this.searchAndDownloadMovie(movie.id);
              return result ? 1 : 0;
            } catch (err) {
              logger.error(`Failed to search for movie ${movie.title}:`, err);
              return 0;
            }
          })
        );
        
        searched += batch.length;
        found += results.reduce((a, b) => a + b, 0);
        
        // Log progress
        logger.info(`Missing movie search progress: ${searched}/${missingMovies.length} searched, ${found} found`);
        
        // Delay between batches to avoid hammering indexers
        if (i + concurrentLimit < missingMovies.length) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      logger.info(`Missing movie search complete: ${searched} searched, ${found} found, ${skippedCount} skipped`);
      return { total: allMissingMovies.length, searched, found, skipped: skippedCount };
    } catch (error) {
      logger.error('Search all missing movies error:', error);
      return { total: 0, searched: 0, found: 0, skipped: 0 };
    }
  }

  /**
   * Search for all missing monitored episodes across all series
   */
  async searchAllMissingSeries(concurrentLimit: number = 1): Promise<{ total: number; searched: number; found: number }> {
    try {
      // Get all monitored series
      const monitoredSeries = TVSeriesModel.findMonitored();
      
      if (monitoredSeries.length === 0) {
        logger.info('No monitored series to search');
        return { total: 0, searched: 0, found: 0 };
      }

      // Get all missing episodes across all series
      const allMissingEpisodes: Array<{ seriesId: string; seriesTitle: string; season: number; episode: number }> = [];
      
      for (const series of monitoredSeries) {
        const seasons = TVSeriesModel.findSeasonsBySeriesId(series.id);
        
        for (const season of seasons) {
          // Skip specials (season 0)
          if (season.season_number === 0) continue;
          
          const episodes = TVSeriesModel.findEpisodesBySeason(series.id, season.season_number);
          
          for (const episode of episodes) {
            // Skip if already has file or not monitored
            if (episode.has_file || !episode.monitored) continue;
            
            // Skip future episodes (compare dates only, ignoring time/timezone issues)
            if (episode.air_date) {
              const today = new Date().toISOString().split('T')[0];
              if (episode.air_date > today) continue;
            }
            
            allMissingEpisodes.push({
              seriesId: series.id,
              seriesTitle: series.title,
              season: season.season_number,
              episode: episode.episode_number
            });
          }
        }
      }

      if (allMissingEpisodes.length === 0) {
        logger.info('No missing monitored episodes to search');
        return { total: 0, searched: 0, found: 0 };
      }

      logger.info(`Starting missing episode search: ${allMissingEpisodes.length} episodes to search`);
      
      let searched = 0;
      let found = 0;

      // Process in batches based on concurrent limit
      for (let i = 0; i < allMissingEpisodes.length; i += concurrentLimit) {
        const batch = allMissingEpisodes.slice(i, i + concurrentLimit);
        
        const results: number[] = await Promise.all(
          batch.map(async (ep): Promise<number> => {
            try {
              const result = await this.searchAndDownloadEpisode(ep.seriesId, ep.season, ep.episode);
              return result ? 1 : 0;
            } catch (err) {
              logger.error(`Failed to search for ${ep.seriesTitle} S${ep.season}E${ep.episode}:`, err);
              return 0;
            }
          })
        );
        
        searched += batch.length;
        found += results.reduce((a, b) => a + b, 0);
        
        // Log progress every 10 batches or at the end
        if ((i / concurrentLimit) % 10 === 0 || i + concurrentLimit >= allMissingEpisodes.length) {
          logger.info(`Missing episode search progress: ${searched}/${allMissingEpisodes.length} searched, ${found} found`);
        }
        
        // Delay between batches to avoid hammering indexers
        if (i + concurrentLimit < allMissingEpisodes.length) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      logger.info(`Missing episode search complete: ${searched} searched, ${found} found`);
      return { total: allMissingEpisodes.length, searched, found };
    } catch (error) {
      logger.error('Search all missing series error:', error);
      return { total: 0, searched: 0, found: 0 };
    }
  }

  /**
   * Search for all missing media (movies and episodes)
   * Used by the background worker
   */
  async searchAllMissing(concurrentLimit: number = 1): Promise<{
    movies: { total: number; searched: number; found: number };
    episodes: { total: number; searched: number; found: number };
  }> {
    logger.info('=== Starting Missing Media Search ===');
    
    // Search movies first
    const movieResults = await this.searchAllMissingMovies(concurrentLimit);
    
    // Then search episodes
    const episodeResults = await this.searchAllMissingSeries(concurrentLimit);
    
    logger.info('=== Missing Media Search Complete ===');
    logger.info(`Movies: ${movieResults.found}/${movieResults.total} found`);
    logger.info(`Episodes: ${episodeResults.found}/${episodeResults.total} found`);
    
    return {
      movies: movieResults,
      episodes: episodeResults
    };
  }

  /**
   * Search for quality upgrades for movies below cutoff
   */
  async searchCutoffUnmetMovies(concurrentLimit: number = 1): Promise<{ total: number; searched: number; found: number }> {
    try {
      // Get all monitored movies with files
      const moviesWithFiles = MovieModel.findWithFiles();
      
      // Filter to those below cutoff quality
      const cutoffUnmet: typeof moviesWithFiles = [];
      
      for (const movie of moviesWithFiles) {
        if (!movie.quality_profile_id || !movie.quality) continue;
        
        // Check if profile allows upgrades
        const profile = QualityProfileModel.findById(movie.quality_profile_id);
        if (!profile || !profile.upgrade_allowed) continue;
        
        // Check if current quality is below cutoff
        if (!QualityProfileModel.meetsCutoff(movie.quality_profile_id, movie.quality)) {
          cutoffUnmet.push(movie);
        }
      }
      
      if (cutoffUnmet.length === 0) {
        logger.info('No movies below cutoff quality to search');
        return { total: 0, searched: 0, found: 0 };
      }

      logger.info(`Starting cutoff unmet movie search: ${cutoffUnmet.length} movies to search`);
      
      let searched = 0;
      let found = 0;

      // Process in batches based on concurrent limit
      for (let i = 0; i < cutoffUnmet.length; i += concurrentLimit) {
        const batch = cutoffUnmet.slice(i, i + concurrentLimit);
        
        const results: number[] = await Promise.all(
          batch.map(async (movie): Promise<number> => {
            try {
              const result = await this.searchAndDownloadMovie(movie.id);
              return result ? 1 : 0;
            } catch (err) {
              logger.error(`Failed to search upgrade for movie ${movie.title}:`, err);
              return 0;
            }
          })
        );
        
        searched += batch.length;
        found += results.reduce((a, b) => a + b, 0);
        
        // Log progress
        logger.info(`Cutoff unmet movie search progress: ${searched}/${cutoffUnmet.length} searched, ${found} found`);
        
        // Delay between batches to avoid hammering indexers
        if (i + concurrentLimit < cutoffUnmet.length) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      logger.info(`Cutoff unmet movie search complete: ${searched} searched, ${found} upgrades found`);
      return { total: cutoffUnmet.length, searched, found };
    } catch (error) {
      logger.error('Search cutoff unmet movies error:', error);
      return { total: 0, searched: 0, found: 0 };
    }
  }

  /**
   * Search for quality upgrades for episodes below cutoff
   */
  async searchCutoffUnmetSeries(concurrentLimit: number = 1): Promise<{ total: number; searched: number; found: number }> {
    try {
      // Get all monitored series
      const monitoredSeries = TVSeriesModel.findMonitored();
      
      if (monitoredSeries.length === 0) {
        logger.info('No monitored series for cutoff search');
        return { total: 0, searched: 0, found: 0 };
      }

      // Get all episodes with files that are below cutoff
      const cutoffUnmetEpisodes: Array<{ seriesId: string; seriesTitle: string; season: number; episode: number }> = [];
      
      for (const series of monitoredSeries) {
        if (!series.quality_profile_id) continue;
        
        // Check if profile allows upgrades
        const profile = QualityProfileModel.findById(series.quality_profile_id);
        if (!profile || !profile.upgrade_allowed) continue;
        
        const seasons = TVSeriesModel.findSeasonsBySeriesId(series.id);
        
        for (const season of seasons) {
          // Skip specials (season 0)
          if (season.season_number === 0) continue;
          
          const episodes = TVSeriesModel.findEpisodesBySeason(series.id, season.season_number);
          
          for (const episode of episodes) {
            // Only check episodes that have files and are monitored
            if (!episode.has_file || !episode.monitored || !episode.quality) continue;
            
            // Check if current quality is below cutoff
            if (!QualityProfileModel.meetsCutoff(series.quality_profile_id, episode.quality)) {
              cutoffUnmetEpisodes.push({
                seriesId: series.id,
                seriesTitle: series.title,
                season: season.season_number,
                episode: episode.episode_number
              });
            }
          }
        }
      }

      if (cutoffUnmetEpisodes.length === 0) {
        logger.info('No episodes below cutoff quality to search');
        return { total: 0, searched: 0, found: 0 };
      }

      logger.info(`Starting cutoff unmet episode search: ${cutoffUnmetEpisodes.length} episodes to search`);
      
      let searched = 0;
      let found = 0;

      // Process in batches based on concurrent limit
      for (let i = 0; i < cutoffUnmetEpisodes.length; i += concurrentLimit) {
        const batch = cutoffUnmetEpisodes.slice(i, i + concurrentLimit);
        
        const results: number[] = await Promise.all(
          batch.map(async (ep): Promise<number> => {
            try {
              const result = await this.searchAndDownloadEpisode(ep.seriesId, ep.season, ep.episode);
              return result ? 1 : 0;
            } catch (err) {
              logger.error(`Failed to search upgrade for ${ep.seriesTitle} S${ep.season}E${ep.episode}:`, err);
              return 0;
            }
          })
        );
        
        searched += batch.length;
        found += results.reduce((a, b) => a + b, 0);
        
        // Log progress every 10 batches or at the end
        if ((i / concurrentLimit) % 10 === 0 || i + concurrentLimit >= cutoffUnmetEpisodes.length) {
          logger.info(`Cutoff unmet episode search progress: ${searched}/${cutoffUnmetEpisodes.length} searched, ${found} found`);
        }
        
        // Delay between batches to avoid hammering indexers
        if (i + concurrentLimit < cutoffUnmetEpisodes.length) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      logger.info(`Cutoff unmet episode search complete: ${searched} searched, ${found} upgrades found`);
      return { total: cutoffUnmetEpisodes.length, searched, found };
    } catch (error) {
      logger.error('Search cutoff unmet series error:', error);
      return { total: 0, searched: 0, found: 0 };
    }
  }

  /**
   * Search for all cutoff unmet media (movies and episodes)
   * Used by the background worker
   */
  async searchAllCutoffUnmet(concurrentLimit: number = 1): Promise<{
    movies: { total: number; searched: number; found: number };
    episodes: { total: number; searched: number; found: number };
  }> {
    logger.info('=== Starting Cutoff Unmet Search (Quality Upgrades) ===');
    
    // Search movies first
    const movieResults = await this.searchCutoffUnmetMovies(concurrentLimit);
    
    // Then search episodes
    const episodeResults = await this.searchCutoffUnmetSeries(concurrentLimit);
    
    logger.info('=== Cutoff Unmet Search Complete ===');
    logger.info(`Movies: ${movieResults.found}/${movieResults.total} upgrades found`);
    logger.info(`Episodes: ${episodeResults.found}/${episodeResults.total} upgrades found`);
    
    return {
      movies: movieResults,
      episodes: episodeResults
    };
  }
}

export const autoSearchService = new AutoSearchService();
