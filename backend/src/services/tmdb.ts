import axios from 'axios';
import db from '../config/database';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

interface TMDBMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  genre_ids: number[];
}

interface TMDBTVShow {
  id: number;
  name: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  genre_ids: number[];
}

export class TMDBService {
  private getApiKey(): string {
    // Try to get from database first
    try {
      const stmt = db.prepare('SELECT value FROM system_settings WHERE key = ?');
      const result = stmt.get('tmdb_api_key') as { value: string } | undefined;
      if (result?.value) {
        return result.value;
      }
    } catch (error) {
      // Database might not be initialized yet, fall back to env
    }

    // Fall back to environment variable
    return process.env.TMDB_API_KEY || '';
  }

  private checkApiKey(apiKey: string) {
    if (!apiKey || apiKey === '') {
      throw new Error('TMDB API key not configured. Please set API key in Settings.');
    }
  }

  private async makeRequest(endpoint: string, params: any = {}) {
    const apiKey = this.getApiKey();
    this.checkApiKey(apiKey);

    const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
      params: {
        ...params,
        api_key: apiKey
      }
    });
    return response.data;
  }

  // Search
  async searchMovies(query: string, page: number = 1, year?: number) {
    const params: any = { query, page };
    if (year) params.year = year;
    
    const result = await this.makeRequest('/search/movie', params);
    
    // If no results and query is mostly numbers with spaces (like "12 12 12"),
    // try with different separators
    if ((!result.results || result.results.length === 0) && /^\d+(\s+\d+)+$/.test(query.trim())) {
      // Try with slashes: "12 12 12" -> "12/12/12"
      const slashQuery = query.trim().replace(/\s+/g, '/');
      const slashResult = await this.makeRequest('/search/movie', { ...params, query: slashQuery });
      if (slashResult.results?.length > 0) return slashResult;
      
      // Try with hyphens: "12 12 12" -> "12-12-12"
      const hyphenQuery = query.trim().replace(/\s+/g, '-');
      const hyphenResult = await this.makeRequest('/search/movie', { ...params, query: hyphenQuery });
      if (hyphenResult.results?.length > 0) return hyphenResult;
    }
    
    return result;
  }

  async searchTV(query: string, page: number = 1) {
    return this.makeRequest('/search/tv', { query, page });
  }

  async searchMulti(query: string, page: number = 1) {
    return this.makeRequest('/search/multi', { query, page });
  }

  // Trending
  async getTrendingMovies(timeWindow: 'day' | 'week' = 'week') {
    return this.makeRequest(`/trending/movie/${timeWindow}`);
  }

  async getTrendingTV(timeWindow: 'day' | 'week' = 'week') {
    return this.makeRequest(`/trending/tv/${timeWindow}`);
  }

  // Popular
  async getPopularMovies(page: number = 1) {
    return this.makeRequest('/movie/popular', { page });
  }

  async getPopularTV(page: number = 1) {
    return this.makeRequest('/tv/popular', { page });
  }

  async getTopRatedMovies(page: number = 1) {
    return this.makeRequest('/movie/top_rated', { page });
  }

  async getTopRatedTV(page: number = 1) {
    return this.makeRequest('/tv/top_rated', { page });
  }

  async getUpcomingMovies(page: number = 1) {
    // Use discover endpoint with date filter for more accurate upcoming movies
    const today = new Date();
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    
    const params = {
      page,
      sort_by: 'release_date.asc',
      'primary_release_date.gte': today.toISOString().split('T')[0],
      'primary_release_date.lte': threeMonthsLater.toISOString().split('T')[0],
      'vote_count.gte': 0, // Include movies with no votes yet
      with_release_type: '2|3' // Theatrical (2) or Theatrical Limited (3)
    };
    
    return this.makeRequest('/discover/movie', params);
  }

  async getUpcomingTV(page: number = 1) {
    // Get TV shows that are airing soon (on the air)
    return this.makeRequest('/tv/on_the_air', { page });
  }

  // Similar content
  async getSimilarMovies(movieId: number, page: number = 1) {
    return this.makeRequest(`/movie/${movieId}/similar`, { page });
  }

  async getSimilarTV(tvId: number, page: number = 1) {
    return this.makeRequest(`/tv/${tvId}/similar`, { page });
  }

  async getMovieRecommendations(movieId: number, page: number = 1) {
    return this.makeRequest(`/movie/${movieId}/recommendations`, { page });
  }

  async getTVRecommendations(tvId: number, page: number = 1) {
    return this.makeRequest(`/tv/${tvId}/recommendations`, { page });
  }

  // Get genre lists
  async getMovieGenres() {
    return this.makeRequest('/genre/movie/list');
  }

  async getTVGenres() {
    return this.makeRequest('/genre/tv/list');
  }

  // Get languages
  async getLanguages() {
    return this.makeRequest('/configuration/languages');
  }

  // Discover with sorting and filters
  async discoverMovies(page: number = 1, sortBy: string = 'popularity.desc', filters: any = {}) {
    const params: any = { 
      page, 
      sort_by: sortBy,
      include_adult: false,
      include_video: false,
    };

    // Apply filters
    // Use pipe (|) for OR logic - movies/shows with ANY of the selected genres
    if (filters.genres?.length) params.with_genres = filters.genres.join('|');
    if (filters.releaseDateFrom) params['primary_release_date.gte'] = filters.releaseDateFrom;
    if (filters.releaseDateTo) params['primary_release_date.lte'] = filters.releaseDateTo;
    if (filters.language) params.with_original_language = filters.language;
    if (filters.runtimeMin) params['with_runtime.gte'] = filters.runtimeMin;
    if (filters.runtimeMax) params['with_runtime.lte'] = filters.runtimeMax;
    if (filters.voteAverageMin) params['vote_average.gte'] = filters.voteAverageMin;
    if (filters.voteAverageMax) params['vote_average.lte'] = filters.voteAverageMax;
    if (filters.voteCountMin) params['vote_count.gte'] = filters.voteCountMin;
    if (filters.voteCountMax && filters.voteCountMax < 1000) params['vote_count.lte'] = filters.voteCountMax;
    if (filters.certifications?.length) params.certification = filters.certifications.join('|');
    if (filters.certifications?.length) params.certification_country = 'US';
    if (filters.keywords?.length) params.with_keywords = filters.keywords.join(',');
    if (filters.excludeKeywords?.length) params.without_keywords = filters.excludeKeywords.join(',');
    if (filters.companies?.length) params.with_companies = filters.companies.join(',');

    // Default minimum votes for rating sort
    if (sortBy.includes('vote_average') && !filters.voteCountMin) {
      params['vote_count.gte'] = 100;
    }

    return this.makeRequest('/discover/movie', params);
  }

  async discoverTV(page: number = 1, sortBy: string = 'popularity.desc', filters: any = {}) {
    const params: any = { 
      page, 
      sort_by: sortBy,
      include_adult: false,
    };

    // Apply filters
    // Use pipe (|) for OR logic - shows with ANY of the selected genres
    if (filters.genres?.length) params.with_genres = filters.genres.join('|');
    if (filters.releaseDateFrom) params['first_air_date.gte'] = filters.releaseDateFrom;
    if (filters.releaseDateTo) params['first_air_date.lte'] = filters.releaseDateTo;
    if (filters.language) params.with_original_language = filters.language;
    if (filters.runtimeMin) params['with_runtime.gte'] = filters.runtimeMin;
    if (filters.runtimeMax) params['with_runtime.lte'] = filters.runtimeMax;
    if (filters.voteAverageMin) params['vote_average.gte'] = filters.voteAverageMin;
    if (filters.voteAverageMax) params['vote_average.lte'] = filters.voteAverageMax;
    if (filters.voteCountMin) params['vote_count.gte'] = filters.voteCountMin;
    if (filters.voteCountMax && filters.voteCountMax < 1000) params['vote_count.lte'] = filters.voteCountMax;
    if (filters.keywords?.length) params.with_keywords = filters.keywords.join(',');
    if (filters.excludeKeywords?.length) params.without_keywords = filters.excludeKeywords.join(',');
    if (filters.networks?.length) params.with_networks = filters.networks.join(',');

    // Default minimum votes for rating sort
    if (sortBy.includes('vote_average') && !filters.voteCountMin) {
      params['vote_count.gte'] = 100;
    }

    return this.makeRequest('/discover/tv', params);
  }

  // Search keywords
  async searchKeywords(query: string) {
    return this.makeRequest('/search/keyword', { query });
  }

  // Search companies
  async searchCompanies(query: string) {
    return this.makeRequest('/search/company', { query });
  }

  // Details
  async getMovieDetails(movieId: number) {
    return this.makeRequest(`/movie/${movieId}`, { append_to_response: 'credits,release_dates' });
  }

  /**
   * Extract certification (content rating) from TMDB movie response
   * Returns US certification if available, otherwise first non-empty certification
   */
  static extractCertification(movieData: any): string | null {
    if (!movieData?.release_dates?.results) {
      return null;
    }
    
    // Prefer US certification
    const usRelease = movieData.release_dates.results.find((r: any) => r.iso_3166_1 === 'US');
    if (usRelease?.release_dates) {
      const withCert = usRelease.release_dates.find((r: any) => r.certification);
      if (withCert?.certification) {
        return withCert.certification;
      }
    }
    
    // Fallback to any certification
    for (const region of movieData.release_dates.results) {
      if (region.release_dates) {
        const withCert = region.release_dates.find((r: any) => r.certification);
        if (withCert?.certification) {
          return withCert.certification;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract release dates from TMDB movie response
   * Release types: 1=Premiere, 2=Theatrical (limited), 3=Theatrical, 4=Digital, 5=Physical, 6=TV
   * Returns dates in ISO format for US region, or first available region
   */
  static extractReleaseDates(movieData: any): {
    theatricalDate?: string;
    digitalDate?: string;
    physicalDate?: string;
  } {
    const result: { theatricalDate?: string; digitalDate?: string; physicalDate?: string } = {};
    
    if (!movieData?.release_dates?.results) {
      return result;
    }
    
    // Prefer US dates, fallback to any available
    const usRelease = movieData.release_dates.results.find((r: any) => r.iso_3166_1 === 'US');
    const releases = usRelease?.release_dates || [];
    
    // If no US dates, try to get earliest from any region
    let allReleases: Array<{ type: number; release_date: string }> = releases;
    if (allReleases.length === 0) {
      for (const region of movieData.release_dates.results) {
        if (region.release_dates?.length > 0) {
          allReleases = region.release_dates;
          break;
        }
      }
    }
    
    // Find theatrical (type 2 or 3)
    const theatrical = allReleases.find((r: any) => r.type === 3) || allReleases.find((r: any) => r.type === 2);
    if (theatrical?.release_date) {
      result.theatricalDate = theatrical.release_date.split('T')[0];
    }
    
    // Find digital (type 4)
    const digital = allReleases.find((r: any) => r.type === 4);
    if (digital?.release_date) {
      result.digitalDate = digital.release_date.split('T')[0];
    }
    
    // Find physical (type 5)
    const physical = allReleases.find((r: any) => r.type === 5);
    if (physical?.release_date) {
      result.physicalDate = physical.release_date.split('T')[0];
    }
    
    return result;
  }

  async getTVDetails(tvId: number) {
    return this.makeRequest(`/tv/${tvId}`, { append_to_response: 'credits,content_ratings' });
  }

  async getMovieCredits(movieId: number) {
    return this.makeRequest(`/movie/${movieId}/credits`);
  }

  async getTVCredits(tvId: number) {
    return this.makeRequest(`/tv/${tvId}/credits`);
  }

  async getSeasonDetails(tvId: number, seasonNumber: number) {
    return this.makeRequest(`/tv/${tvId}/season/${seasonNumber}`);
  }

  /**
   * Find media by external ID (TVDB, IMDB, etc.)
   */
  async findByExternalId(externalId: number | string, source: 'tvdb_id' | 'imdb_id' = 'tvdb_id') {
    return this.makeRequest(`/find/${externalId}`, { external_source: source });
  }

  // Images
  getImageUrl(path: string | null, size: string = 'w500'): string | null {
    if (!path) return null;
    return `${TMDB_IMAGE_BASE}/${size}${path}`;
  }

  getPosterUrl(path: string | null): string | null {
    return this.getImageUrl(path, 'w500');
  }

  getBackdropUrl(path: string | null): string | null {
    return this.getImageUrl(path, 'w1280');
  }

  /**
   * Test the API key by searching for a known show
   */
  async testApiKey(apiKey?: string): Promise<{ success: boolean; message: string; data?: any }> {
    const keyToTest = apiKey || this.getApiKey();
    
    if (!keyToTest) {
      return { success: false, message: 'No API key provided' };
    }
    
    try {
      // Search for "Stranger Things" as a test
      const response = await axios.get(`${TMDB_BASE_URL}/search/tv`, {
        params: {
          api_key: keyToTest,
          query: 'Stranger Things'
        }
      });
      
      if (response.data?.results?.length > 0) {
        const show = response.data.results[0];
        const year = show.first_air_date ? new Date(show.first_air_date).getFullYear() : 'N/A';
        return { 
          success: true, 
          message: `Connected! Found: ${show.name} (${year})`,
          data: { name: show.name, year, id: show.id }
        };
      }
      
      return { success: false, message: 'API connected but no results found' };
    } catch (error: any) {
      if (error.response?.status === 401) {
        return { success: false, message: 'Invalid API key' };
      }
      return { 
        success: false, 
        message: error.response?.data?.status_message || error.message || 'Connection failed' 
      };
    }
  }

  // Person/Actor details
  async getPersonDetails(personId: number) {
    return this.makeRequest(`/person/${personId}`, { append_to_response: 'combined_credits,external_ids' });
  }
}

export const tmdbService = new TMDBService();
