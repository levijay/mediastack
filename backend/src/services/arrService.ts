import axios from 'axios';
import logger from '../config/logger';

export interface ArrMovie {
  id: number;
  title: string;
  year: number;
  tmdbId: number;
  imdbId?: string;
  overview?: string;
  path?: string;
  hasFile: boolean;
  monitored: boolean;
  qualityProfileId?: number;
  images?: { coverType: string; remoteUrl: string }[];
}

export interface ArrSeries {
  id: number;
  title: string;
  year: number;
  tvdbId: number;
  imdbId?: string;
  overview?: string;
  path?: string;
  monitored: boolean;
  qualityProfileId?: number;
  images?: { coverType: string; remoteUrl: string }[];
  statistics?: {
    seasonCount: number;
    episodeCount: number;
    episodeFileCount: number;
    sizeOnDisk: number;
  };
}

export interface ArrQualityProfile {
  id: number;
  name: string;
}

class ArrService {
  /**
   * Test connection to a Radarr instance
   */
  async testRadarr(url: string, apiKey: string): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const baseUrl = this.normalizeUrl(url);
      const response = await axios.get(`${baseUrl}/api/v3/system/status`, {
        headers: { 'X-Api-Key': apiKey },
        timeout: 10000
      });
      
      return { 
        success: true, 
        version: response.data.version 
      };
    } catch (error: any) {
      logger.error('[ArrService] Radarr test failed:', error.message);
      return { 
        success: false, 
        error: error.response?.status === 401 ? 'Invalid API key' : error.message 
      };
    }
  }

  /**
   * Test connection to a Sonarr instance
   */
  async testSonarr(url: string, apiKey: string): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const baseUrl = this.normalizeUrl(url);
      const response = await axios.get(`${baseUrl}/api/v3/system/status`, {
        headers: { 'X-Api-Key': apiKey },
        timeout: 10000
      });
      
      return { 
        success: true, 
        version: response.data.version 
      };
    } catch (error: any) {
      logger.error('[ArrService] Sonarr test failed:', error.message);
      return { 
        success: false, 
        error: error.response?.status === 401 ? 'Invalid API key' : error.message 
      };
    }
  }

  /**
   * Get all movies from Radarr
   */
  async getRadarrMovies(url: string, apiKey: string): Promise<ArrMovie[]> {
    try {
      const baseUrl = this.normalizeUrl(url);
      const response = await axios.get(`${baseUrl}/api/v3/movie`, {
        headers: { 'X-Api-Key': apiKey },
        timeout: 30000
      });
      
      return response.data.map((movie: any) => ({
        id: movie.id,
        title: movie.title,
        year: movie.year,
        tmdbId: movie.tmdbId,
        imdbId: movie.imdbId,
        overview: movie.overview,
        path: movie.path,
        hasFile: movie.hasFile,
        monitored: movie.monitored,
        qualityProfileId: movie.qualityProfileId,
        images: movie.images
      }));
    } catch (error: any) {
      logger.error('[ArrService] Failed to get Radarr movies:', error.message);
      throw new Error(`Failed to get movies from Radarr: ${error.message}`);
    }
  }

  /**
   * Get all series from Sonarr
   */
  async getSonarrSeries(url: string, apiKey: string): Promise<ArrSeries[]> {
    try {
      const baseUrl = this.normalizeUrl(url);
      const response = await axios.get(`${baseUrl}/api/v3/series`, {
        headers: { 'X-Api-Key': apiKey },
        timeout: 30000
      });
      
      return response.data.map((series: any) => ({
        id: series.id,
        title: series.title,
        year: series.year,
        tvdbId: series.tvdbId,
        imdbId: series.imdbId,
        overview: series.overview,
        path: series.path,
        monitored: series.monitored,
        qualityProfileId: series.qualityProfileId,
        images: series.images,
        statistics: series.statistics
      }));
    } catch (error: any) {
      logger.error('[ArrService] Failed to get Sonarr series:', error.message);
      throw new Error(`Failed to get series from Sonarr: ${error.message}`);
    }
  }

  /**
   * Get quality profiles from Radarr
   */
  async getRadarrProfiles(url: string, apiKey: string): Promise<ArrQualityProfile[]> {
    try {
      const baseUrl = this.normalizeUrl(url);
      const response = await axios.get(`${baseUrl}/api/v3/qualityprofile`, {
        headers: { 'X-Api-Key': apiKey },
        timeout: 10000
      });
      
      return response.data.map((profile: any) => ({
        id: profile.id,
        name: profile.name
      }));
    } catch (error: any) {
      logger.error('[ArrService] Failed to get Radarr profiles:', error.message);
      throw new Error(`Failed to get quality profiles: ${error.message}`);
    }
  }

  /**
   * Get quality profiles from Sonarr
   */
  async getSonarrProfiles(url: string, apiKey: string): Promise<ArrQualityProfile[]> {
    try {
      const baseUrl = this.normalizeUrl(url);
      const response = await axios.get(`${baseUrl}/api/v3/qualityprofile`, {
        headers: { 'X-Api-Key': apiKey },
        timeout: 10000
      });
      
      return response.data.map((profile: any) => ({
        id: profile.id,
        name: profile.name
      }));
    } catch (error: any) {
      logger.error('[ArrService] Failed to get Sonarr profiles:', error.message);
      throw new Error(`Failed to get quality profiles: ${error.message}`);
    }
  }

  /**
   * Get poster URL from Arr images array
   */
  getPosterUrl(images: { coverType: string; remoteUrl: string }[] | undefined): string | null {
    if (!images) return null;
    const poster = images.find(img => img.coverType === 'poster');
    return poster?.remoteUrl || null;
  }

  /**
   * Normalize URL to ensure consistent format
   */
  private normalizeUrl(url: string): string {
    // Remove trailing slash
    let normalized = url.replace(/\/+$/, '');
    // Ensure http/https prefix
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `http://${normalized}`;
    }
    return normalized;
  }
}

export const arrService = new ArrService();
