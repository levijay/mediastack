import axios from 'axios';
import db from '../config/database';
import logger from '../config/logger';

const TVDB_BASE_URL = 'https://api4.thetvdb.com/v4';

interface TVDBEpisode {
  id: number;
  seriesId: number;
  name: string;
  aired: string;
  runtime: number;
  overview: string;
  image: string;
  seasonNumber: number;
  number: number; // episode number
}

interface TVDBSeason {
  id: number;
  seriesId: number;
  type: { id: number; name: string };
  number: number;
  name: string;
  image: string;
}

interface TVDBTranslation {
  name: string;
  overview: string;
  language: string;
  aliases?: string[];
}

interface TVDBSeries {
  id: number;
  name: string;
  slug: string;
  image: string;
  firstAired: string;
  lastAired: string;
  nextAired: string;
  score: number;
  status: { id: number; name: string };
  originalCountry: string;
  originalLanguage: string;
  defaultSeasonType: number;
  isOrderRandomized: boolean;
  lastUpdated: string;
  averageRuntime: number;
  episodes: TVDBEpisode[];
  overview: string;
  year: string;
  nameTranslations?: string[];
  overviewTranslations?: string[];
}

export class TVDBService {
  private token: string = '';
  private tokenExpiry: number = 0;

  private getApiKey(): string {
    try {
      const stmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
      const result = stmt.get('tvdb_api_key') as { value: string } | undefined;
      if (result?.value) {
        return result.value;
      }
    } catch (error) {
      // Database might not be initialized yet
    }
    return process.env.TVDB_API_KEY || '';
  }

  private async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('TVDB API key not configured. Please set API key in Settings.');
    }

    try {
      const response = await axios.post(`${TVDB_BASE_URL}/login`, {
        apikey: apiKey
      });

      if (response.data?.data?.token) {
        this.token = response.data.data.token;
        // Token is valid for 30 days, but we'll refresh after 29 days
        this.tokenExpiry = Date.now() + (29 * 24 * 60 * 60 * 1000);
        return this.token;
      }

      throw new Error('Failed to get TVDB token');
    } catch (error: any) {
      logger.error('TVDB authentication failed:', error.message);
      throw new Error('Failed to authenticate with TVDB. Check your API key.');
    }
  }

  private async makeRequest(endpoint: string, params: any = {}): Promise<any> {
    const token = await this.authenticate();

    try {
      const response = await axios.get(`${TVDB_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        params
      });
      return response.data?.data;
    } catch (error: any) {
      // If 401, token might be expired - clear and retry once
      if (error.response?.status === 401) {
        this.token = '';
        this.tokenExpiry = 0;
        const newToken = await this.authenticate();
        const retryResponse = await axios.get(`${TVDB_BASE_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'Accept': 'application/json'
          },
          params
        });
        return retryResponse.data?.data;
      }
      throw error;
    }
  }

  /**
   * Search for TV series by name
   */
  async searchSeries(query: string): Promise<any[]> {
    try {
      const data = await this.makeRequest('/search', { query, type: 'series' });
      return data || [];
    } catch (error) {
      logger.error('TVDB search failed:', error);
      return [];
    }
  }

  /**
   * Get English translation for a series
   */
  async getSeriesTranslation(tvdbId: number, language: string = 'eng'): Promise<TVDBTranslation | null> {
    try {
      const data = await this.makeRequest(`/series/${tvdbId}/translations/${language}`);
      return data;
    } catch (error) {
      logger.debug(`TVDB translation for ${tvdbId} in ${language} not found`);
      return null;
    }
  }

  /**
   * Get series details by TVDB ID with English translation
   */
  async getSeriesDetails(tvdbId: number): Promise<TVDBSeries | null> {
    try {
      const data = await this.makeRequest(`/series/${tvdbId}/extended`, { meta: 'episodes' });
      
      if (data) {
        // Try to get English translation if original language is not English
        if (data.originalLanguage !== 'eng') {
          try {
            const translation = await this.getSeriesTranslation(tvdbId, 'eng');
            if (translation?.name) {
              logger.info(`[TVDB] Using English translation for ${data.name} -> ${translation.name}`);
              data.nameEnglish = translation.name;
              data.overviewEnglish = translation.overview;
            }
          } catch (e) {
            logger.debug(`[TVDB] No English translation for ${tvdbId}`);
          }
        }
      }
      
      return data;
    } catch (error) {
      logger.error(`TVDB get series ${tvdbId} failed:`, error);
      return null;
    }
  }

  /**
   * Get series episodes (all seasons)
   */
  async getSeriesEpisodes(tvdbId: number, seasonType: string = 'default'): Promise<TVDBEpisode[]> {
    try {
      const data = await this.makeRequest(`/series/${tvdbId}/episodes/${seasonType}`);
      return data?.episodes || [];
    } catch (error) {
      logger.error(`TVDB get episodes for ${tvdbId} failed:`, error);
      return [];
    }
  }

  /**
   * Get season details
   */
  async getSeasonDetails(tvdbId: number, seasonNumber: number): Promise<{ episodes: TVDBEpisode[] }> {
    try {
      // Get all episodes and filter by season
      const allEpisodes = await this.getSeriesEpisodes(tvdbId);
      const seasonEpisodes = allEpisodes.filter(ep => ep.seasonNumber === seasonNumber);
      
      return { episodes: seasonEpisodes };
    } catch (error) {
      logger.error(`TVDB get season ${seasonNumber} for ${tvdbId} failed:`, error);
      return { episodes: [] };
    }
  }

  /**
   * Get episode details
   */
  async getEpisodeDetails(episodeId: number): Promise<TVDBEpisode | null> {
    try {
      const data = await this.makeRequest(`/episodes/${episodeId}/extended`);
      return data;
    } catch (error) {
      logger.error(`TVDB get episode ${episodeId} failed:`, error);
      return null;
    }
  }

  /**
   * Check if TVDB API is configured and working
   */
  async isConfigured(): Promise<boolean> {
    try {
      await this.authenticate();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Test the API key by searching for a known show
   */
  async testApiKey(apiKey?: string): Promise<{ success: boolean; message: string; data?: any }> {
    // Temporarily use provided API key if given
    const originalToken = this.token;
    const originalExpiry = this.tokenExpiry;
    
    try {
      if (apiKey) {
        // Force re-authentication with new key
        this.token = '';
        this.tokenExpiry = 0;
        
        // Temporarily override getApiKey
        const response = await axios.post(`${TVDB_BASE_URL}/login`, {
          apikey: apiKey
        });

        if (!response.data?.data?.token) {
          return { success: false, message: 'Invalid API key - authentication failed' };
        }
        
        this.token = response.data.data.token;
        this.tokenExpiry = Date.now() + (29 * 24 * 60 * 60 * 1000);
      } else {
        await this.authenticate();
      }

      // Search for "Stranger Things" as a test
      const results = await this.makeRequest('/search', { query: 'Stranger Things', type: 'series' });
      
      if (results && results.length > 0) {
        const show = results[0];
        return { 
          success: true, 
          message: `Connected! Found: ${show.name} (${show.year || 'N/A'})`,
          data: { name: show.name, year: show.year, id: show.tvdb_id || show.id }
        };
      }
      
      return { success: false, message: 'API connected but no results found' };
    } catch (error: any) {
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Connection failed' 
      };
    } finally {
      // Restore original token if we were testing a different key
      if (apiKey) {
        this.token = originalToken;
        this.tokenExpiry = originalExpiry;
      }
    }
  }
}

export const tvdbService = new TVDBService();
