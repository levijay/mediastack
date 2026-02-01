import axios from 'axios';
import db from '../config/database';
import logger from '../config/logger';

const OMDB_BASE_URL = 'https://www.omdbapi.com';

interface OMDBResponse {
  Title?: string;
  Year?: string;
  imdbRating?: string;
  imdbVotes?: string;
  imdbID?: string;
  Metascore?: string;
  Response: string;
  Error?: string;
}

export interface IMDBRating {
  rating: number | null;
  votes: string | null;
  metascore: number | null;
}

class OMDBService {
  private getApiKey(): string | null {
    try {
      const stmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
      const result = stmt.get('omdb_api_key') as { value: string } | undefined;
      return result?.value || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get IMDB rating for a given IMDB ID
   * Returns null if OMDB API key is not configured
   */
  async getIMDBRating(imdbId: string): Promise<IMDBRating | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      logger.debug('[OMDB] API key not configured, skipping IMDB rating lookup');
      return null;
    }

    try {
      const response = await axios.get<OMDBResponse>(OMDB_BASE_URL, {
        params: {
          apikey: apiKey,
          i: imdbId,
          type: 'movie'
        },
        timeout: 5000
      });

      if (response.data.Response === 'False') {
        logger.warn(`[OMDB] Error fetching rating for ${imdbId}: ${response.data.Error}`);
        return null;
      }

      const rating = response.data.imdbRating && response.data.imdbRating !== 'N/A' 
        ? parseFloat(response.data.imdbRating) 
        : null;
      
      const metascore = response.data.Metascore && response.data.Metascore !== 'N/A'
        ? parseInt(response.data.Metascore)
        : null;

      return {
        rating,
        votes: response.data.imdbVotes || null,
        metascore
      };
    } catch (error: any) {
      logger.error(`[OMDB] Failed to fetch rating for ${imdbId}:`, error.message);
      return null;
    }
  }

  /**
   * Check if OMDB API is configured and working
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, message: 'OMDB API key not configured' };
    }

    try {
      // Test with a known IMDB ID (The Shawshank Redemption)
      const response = await axios.get<OMDBResponse>(OMDB_BASE_URL, {
        params: {
          apikey: apiKey,
          i: 'tt0111161'
        },
        timeout: 5000
      });

      if (response.data.Response === 'True') {
        return { success: true, message: 'Connection successful' };
      } else {
        return { success: false, message: response.data.Error || 'Unknown error' };
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

export const omdbService = new OMDBService();
