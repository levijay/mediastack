import axios, { AxiosInstance, AxiosError } from 'axios';

// Get API port from URL param, localStorage, or default
const getApiUrl = () => {
  if (import.meta.env.DEV) {
    return '/api';
  }
  
  const params = new URLSearchParams(window.location.search);
  const apiPort = params.get('apiPort') || localStorage.getItem('apiPort') || '5055';
  
  if (params.get('apiPort')) {
    localStorage.setItem('apiPort', apiPort);
  }
  
  return `http://${window.location.hostname}:${apiPort}/api`;
};

const API_BASE_URL = getApiUrl();

// Log for debugging
console.log('API URL:', API_BASE_URL);

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(username: string, password: string) {
    const response = await this.client.post('/auth/login', { username, password });
    return response.data;
  }

  async register(username: string, email: string, password: string) {
    const response = await this.client.post('/auth/register', { username, email, password });
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async generateApiKey() {
    const response = await this.client.post('/auth/api-key');
    return response.data;
  }

  // System
  async getHealth() {
    const response = await this.client.get('/system/health');
    return response.data;
  }

  async getStatus() {
    const response = await this.client.get('/system/status');
    return response.data;
  }

  async browseFolders(path: string = '/') {
    const response = await this.client.get('/system/browse', { params: { path } });
    return response.data;
  }

  // Search
  async searchAll(query: string, page = 1) {
    const response = await this.client.get('/search/all', { params: { query, page } });
    return response.data;
  }

  async searchMovies(query: string, year?: number, page = 1) {
    const params: any = { query, page };
    if (year) params.year = year;
    const response = await this.client.get('/search/movies', { params });
    return response.data;
  }

  async fixMovieMatch(movieId: string, newTmdbId: number) {
    const response = await this.client.post(`/library/movies/${movieId}/fix-match`, { tmdb_id: newTmdbId });
    return response.data;
  }

  async searchTV(query: string, page = 1) {
    const response = await this.client.get('/search/tv', { params: { query, page } });
    return response.data;
  }

  async getTrending(type = 'all', timeWindow = 'week') {
    const response = await this.client.get('/search/trending', { params: { type, timeWindow } });
    return response.data;
  }

  async getPopular(type = 'all', page = 1) {
    const response = await this.client.get('/search/popular', { params: { type, page } });
    return response.data;
  }

  async getMovieDetails(id: number) {
    const response = await this.client.get(`/search/movie/${id}`);
    return response.data;
  }

  async getTVDetails(id: number) {
    const response = await this.client.get(`/search/tv/${id}`);
    return response.data;
  }

  async getSeasonDetails(tvId: number, seasonNumber: number) {
    const response = await this.client.get(`/search/tv/${tvId}/season/${seasonNumber}`);
    return response.data;
  }

  async getMovieCredits(id: number) {
    const response = await this.client.get(`/search/movie/${id}/credits`);
    return response.data;
  }

  async getTVCredits(id: number) {
    const response = await this.client.get(`/search/tv/${id}/credits`);
    return response.data;
  }

  async getPersonDetails(id: number) {
    const response = await this.client.get(`/search/person/${id}`);
    return response.data;
  }

  async getSimilarMovies(id: number) {
    const response = await this.client.get(`/search/movie/${id}/similar`);
    return response.data;
  }

  async getSimilarTV(id: number) {
    const response = await this.client.get(`/search/tv/${id}/similar`);
    return response.data;
  }

  async lookupByTVDBId(tvdbId: number) {
    const response = await this.client.get(`/search/tvdb/${tvdbId}`);
    return response.data;
  }

  // Discover methods
  async discoverMoviesPopular(page = 1) {
    const response = await this.client.get('/search/popular', { params: { type: 'movie', page } });
    return response.data;
  }

  async discoverMoviesTopRated(page = 1) {
    const response = await this.client.get('/search/top-rated', { params: { type: 'movie', page } });
    return response.data;
  }

  async discoverMoviesUpcoming(page = 1) {
    const response = await this.client.get('/search/upcoming', { params: { page, type: 'movie' } });
    return response.data;
  }

  async discoverTVUpcoming(page = 1) {
    const response = await this.client.get('/search/upcoming', { params: { page, type: 'tv' } });
    return response.data;
  }

  async discoverTVPopular(page = 1) {
    const response = await this.client.get('/search/popular', { params: { type: 'tv', page } });
    return response.data;
  }

  async discover(type: 'movie' | 'tv', page = 1, sortBy = 'popularity.desc', filters: any = {}) {
    const params: any = { type, page, sort_by: sortBy };
    
    // Add filter params
    if (filters.genres?.length) params.genres = filters.genres.join(',');
    if (filters.releaseDateFrom) params.release_date_from = filters.releaseDateFrom;
    if (filters.releaseDateTo) params.release_date_to = filters.releaseDateTo;
    if (filters.language) params.language = filters.language;
    if (filters.runtimeMin !== undefined && filters.runtimeMin > 0) params.runtime_min = filters.runtimeMin;
    if (filters.runtimeMax !== undefined && filters.runtimeMax < 400) params.runtime_max = filters.runtimeMax;
    if (filters.voteAverageMin !== undefined && filters.voteAverageMin > 1) params.vote_average_min = filters.voteAverageMin;
    if (filters.voteAverageMax !== undefined && filters.voteAverageMax < 10) params.vote_average_max = filters.voteAverageMax;
    if (filters.voteCountMin !== undefined && filters.voteCountMin > 0) params.vote_count_min = filters.voteCountMin;
    if (filters.voteCountMax !== undefined && filters.voteCountMax < 1000) params.vote_count_max = filters.voteCountMax;
    if (filters.certifications?.length) params.certifications = filters.certifications.join(',');
    if (filters.keywords?.length) params.keywords = filters.keywords.join(',');
    if (filters.excludeKeywords?.length) params.exclude_keywords = filters.excludeKeywords.join(',');
    if (filters.companies?.length) params.companies = filters.companies.join(',');
    if (filters.networks?.length) params.networks = filters.networks.join(',');
    
    const response = await this.client.get('/search/discover', { params });
    return response.data;
  }

  async getGenres(type: 'movie' | 'tv' = 'movie') {
    const response = await this.client.get('/search/genres', { params: { type } });
    return response.data;
  }

  async getLanguages() {
    const response = await this.client.get('/search/languages');
    return response.data;
  }

  async searchKeywords(query: string) {
    const response = await this.client.get('/search/keywords', { params: { query } });
    return response.data;
  }

  async searchCompanies(query: string) {
    const response = await this.client.get('/search/companies', { params: { query } });
    return response.data;
  }

  // Requests
  async createRequest(data: {
    media_type: 'movie' | 'tv';
    tmdb_id: number;
    title: string;
    year?: number;
    poster_path?: string;
    seasons?: number[];
    request_note?: string;
  }) {
    const response = await this.client.post('/requests', data);
    return response.data;
  }

  async getMyRequests() {
    const response = await this.client.get('/requests/my');
    return response.data;
  }

  async getAllRequests(status?: string) {
    const response = await this.client.get('/requests', { params: { status } });
    return response.data;
  }

  async updateRequestStatus(id: string, status: string, note?: string) {
    const response = await this.client.patch(`/requests/${id}/status`, { status, note });
    return response.data;
  }

  async deleteRequest(id: string) {
    const response = await this.client.delete(`/requests/${id}`);
    return response.data;
  }

  // Settings (admin only)
  async getSettings() {
    const response = await this.client.get('/settings');
    return response.data;
  }

  async updateSetting(key: string, value: any) {
    const response = await this.client.put('/settings', { key, value });
    return response.data;
  }

  async updateSettings(settings: Record<string, string>) {
    // Update multiple settings at once
    for (const [key, value] of Object.entries(settings)) {
      await this.client.put('/settings', { key, value });
    }
    return { success: true };
  }

  async getStats() {
    const response = await this.client.get('/settings/stats');
    return response.data;
  }

  async testTmdbKey(apiKey?: string) {
    const response = await this.client.post('/settings/test-tmdb', { apiKey });
    return response.data;
  }

  async testTvdbKey(apiKey?: string) {
    const response = await this.client.post('/settings/test-tvdb', { apiKey });
    return response.data;
  }

  async testOmdbKey(apiKey?: string) {
    const response = await this.client.post('/settings/test-omdb', { apiKey });
    return response.data;
  }

  async getMovieFolderName(title: string, year?: number, tmdbId?: number): Promise<string> {
    const response = await this.client.post('/settings/naming/movie-folder', { title, year, tmdbId });
    return response.data.folderName;
  }

  async getSeriesFolderName(title: string, year?: number, tmdbId?: number): Promise<string> {
    const response = await this.client.post('/settings/naming/series-folder', { title, year, tmdbId });
    return response.data.folderName;
  }

  // Automation - Indexers
  async getIndexers() {
    const response = await this.client.get('/automation/indexers');
    return response.data;
  }

  async addIndexer(data: { name: string; type: string; url: string; apiKey: string; enabled: boolean; enableRss?: boolean; enableAutomaticSearch?: boolean; enableInteractiveSearch?: boolean }) {
    const response = await this.client.post('/automation/indexers', data);
    return response.data;
  }

  async updateIndexer(id: string, data: { name?: string; type?: string; url?: string; apiKey?: string; enabled?: boolean; enableRss?: boolean; enableAutomaticSearch?: boolean; enableInteractiveSearch?: boolean }) {
    const response = await this.client.put(`/automation/indexers/${id}`, data);
    return response.data;
  }

  async deleteIndexer(id: string) {
    const response = await this.client.delete(`/automation/indexers/${id}`);
    return response.data;
  }

  async testIndexer(data: { url: string; apiKey: string; type: string }) {
    const response = await this.client.post('/automation/indexers/test', data);
    return response.data;
  }

  async previewIndexerRss(id: string) {
    const response = await this.client.get(`/automation/indexers/${id}/rss-preview`);
    return response.data;
  }

  // Automation - Download Clients CRUD
  async getDownloadClients() {
    const response = await this.client.get('/automation/download-clients');
    return response.data;
  }

  async addDownloadClient(data: {
    name: string;
    type: 'qbittorrent' | 'sabnzbd';
    enabled?: boolean;
    host: string;
    port: number;
    use_ssl?: boolean;
    url_base?: string;
    username?: string;
    password?: string;
    api_key?: string;
    category?: string;
    priority?: number;
    remove_completed?: boolean;
    remove_failed?: boolean;
    tags?: string;
  }) {
    const response = await this.client.post('/automation/download-clients', data);
    return response.data;
  }

  async updateDownloadClient(id: string, data: Partial<{
    name: string;
    type: 'qbittorrent' | 'sabnzbd';
    enabled: boolean;
    host: string;
    port: number;
    use_ssl: boolean;
    url_base: string | null;
    username: string | null;
    password: string | null;
    api_key: string | null;
    category: string | null;
    priority: number;
    remove_completed: boolean;
    remove_failed: boolean;
    tags: string | null;
  }>) {
    const response = await this.client.put(`/automation/download-clients/${id}`, data);
    return response.data;
  }

  async deleteDownloadClient(id: string) {
    const response = await this.client.delete(`/automation/download-clients/${id}`);
    return response.data;
  }

  async testDownloadClient(data: {
    type: 'qbittorrent' | 'sabnzbd';
    host: string;
    port: number;
    use_ssl?: boolean;
    url_base?: string;
    username?: string;
    password?: string;
    api_key?: string;
  }) {
    const response = await this.client.post('/automation/download-clients/test', data);
    return response.data;
  }

  // Legacy download client testing (keeping for backwards compatibility)
  async testQbittorrent(url: string, username: string, password: string) {
    const response = await this.client.post('/automation/download-client/test/qbittorrent', {
      url, username, password
    });
    return response.data;
  }

  async testSabnzbd(url: string, apiKey: string) {
    const response = await this.client.post('/automation/download-client/test/sabnzbd', {
      url, apiKey
    });
    return response.data;
  }

  // Import Lists
  async getImportLists() {
    const response = await this.client.get('/automation/import-lists');
    return response.data;
  }

  async getImportListTypes() {
    const response = await this.client.get('/automation/import-lists/types');
    return response.data;
  }

  async getImportListById(id: string) {
    const response = await this.client.get(`/automation/import-lists/${id}`);
    return response.data;
  }

  async addImportList(data: {
    name: string;
    type: string;
    media_type: 'movie' | 'tv';
    enabled?: boolean;
    enable_auto_add?: boolean;
    search_on_add?: boolean;
    quality_profile_id?: string;
    root_folder?: string;
    monitor?: string;
    minimum_availability?: string;
    list_id?: string;
    url?: string;
    refresh_interval?: number;
  }) {
    const response = await this.client.post('/automation/import-lists', data);
    return response.data;
  }

  async updateImportList(id: string, data: Partial<{
    name: string;
    type: string;
    media_type: 'movie' | 'tv';
    enabled: boolean;
    enable_auto_add: boolean;
    search_on_add: boolean;
    quality_profile_id: string | null;
    root_folder: string | null;
    monitor: string;
    minimum_availability: string;
    list_id: string | null;
    url: string | null;
    refresh_interval: number;
  }>) {
    const response = await this.client.put(`/automation/import-lists/${id}`, data);
    return response.data;
  }

  async deleteImportList(id: string) {
    const response = await this.client.delete(`/automation/import-lists/${id}`);
    return response.data;
  }

  async syncImportList(id: string) {
    const response = await this.client.post(`/automation/import-lists/${id}/sync`);
    return response.data;
  }

  async previewImportList(id: string) {
    const response = await this.client.get(`/automation/import-lists/${id}/preview`);
    return response.data;
  }

  async syncAllImportLists() {
    const response = await this.client.post('/automation/import-lists/sync-all');
    return response.data;
  }

  // Automation - Search & Downloads
  async searchReleases(title: string, year?: number, type?: string, season?: number, episode?: number) {
    const response = await this.client.get('/automation/search', {
      params: { title, year, type, season, episode }
    });
    return response.data;
  }

  async getDownloads(status?: string) {
    const response = await this.client.get('/automation/downloads', { params: { status } });
    return response.data;
  }

  async clearDownloads(status: 'completed' | 'failed' | 'queued' | 'all') {
    const response = await this.client.delete('/automation/downloads/clear', { 
      params: { status }
    });
    return response.data;
  }

  // Library - Movies
  async getMovies(monitored?: boolean, missing?: boolean): Promise<{ items: any[]; total: number }> {
    const response = await this.client.get('/library/movies', {
      params: { monitored, missing }
    });
    // Handle both old array format and new object format
    if (Array.isArray(response.data)) {
      return { items: response.data, total: response.data.length };
    }
    return { items: response.data.items || [], total: response.data.total || 0 };
  }

  async getRecentlyAdded(limit: number = 12): Promise<any[]> {
    const response = await this.client.get('/library/recently-added', {
      params: { limit }
    });
    return response.data;
  }

  async getRecentActivity(limit: number = 10): Promise<any[]> {
    const response = await this.client.get('/library/activity', {
      params: { limit }
    });
    return response.data;
  }

  // Search library movies by title
  async searchLibraryMovies(query: string): Promise<any[]> {
    const { items } = await this.getMovies();
    const searchTerm = query.toLowerCase();
    return items.filter((movie: any) => 
      movie.title?.toLowerCase().includes(searchTerm) ||
      movie.original_title?.toLowerCase().includes(searchTerm)
    ).slice(0, 10);
  }

  // Search library series by title
  async searchLibrarySeries(query: string): Promise<any[]> {
    const { items } = await this.getSeries();
    const searchTerm = query.toLowerCase();
    return items.filter((series: any) => 
      series.name?.toLowerCase().includes(searchTerm) ||
      series.title?.toLowerCase().includes(searchTerm) ||
      series.original_name?.toLowerCase().includes(searchTerm)
    ).slice(0, 10);
  }

  async getMovieById(id: string) {
    const response = await this.client.get(`/library/movies/${id}`);
    return response.data;
  }

  async getMovieFiles(id: string) {
    const response = await this.client.get(`/library/movies/${id}/files`);
    return response.data;
  }

  async getMovieActivity(id: string, limit: number = 50) {
    const response = await this.client.get(`/library/movies/${id}/activity`, { params: { limit } });
    return response.data;
  }

  async getRelatedMovies(id: string, limit: number = 10) {
    const response = await this.client.get(`/library/movies/${id}/related`, { params: { limit } });
    return response.data;
  }

  async refreshMovieMetadata(id: string) {
    const response = await this.client.post(`/library/movies/${id}/refresh-metadata`);
    return response.data;
  }

  async addMovieFile(movieId: string, data: any) {
    const response = await this.client.post(`/library/movies/${movieId}/files`, data);
    return response.data;
  }

  async deleteMovieFile(movieId: string, fileId: string) {
    const response = await this.client.delete(`/library/movies/${movieId}/files/${fileId}`);
    return response.data;
  }

  // File Browser for Manual Import
  async browseFiles(path: string = '/data') {
    const response = await this.client.get('/library/browse', { params: { path } });
    return response.data;
  }

  // Manual Import
  async manualImportMovie(movieId: string, sourcePath: string, deleteSource: boolean = false) {
    const response = await this.client.post(`/library/movies/${movieId}/manual-import`, {
      sourcePath,
      deleteSource
    });
    return response.data;
  }

  async manualImportEpisode(seriesId: string, sourcePath: string, seasonNumber: number, episodeNumber: number, deleteSource: boolean = false) {
    const response = await this.client.post(`/library/series/${seriesId}/manual-import`, {
      sourcePath,
      seasonNumber,
      episodeNumber,
      deleteSource
    });
    return response.data;
  }

  async addMovie(data: any) {
    const response = await this.client.post('/library/movies', data);
    return response.data;
  }

  async updateMovie(id: string, data: any) {
    const response = await this.client.put(`/library/movies/${id}`, data);
    return response.data;
  }

  async deleteMovie(id: string, deleteFiles: boolean = false, addExclusion: boolean = false) {
    const response = await this.client.delete(`/library/movies/${id}`, {
      params: { deleteFiles, addExclusion }
    });
    return response.data;
  }

  async bulkUpdateMovies(ids: string[], updates: { monitored?: boolean; quality_profile_id?: string; minimum_availability?: string; tags?: string }) {
    const response = await this.client.put('/library/movies/bulk/update', { ids, updates });
    return response.data;
  }

  async bulkDeleteMovies(ids: string[], deleteFiles: boolean = false) {
    const response = await this.client.delete('/library/movies/bulk/delete', { 
      data: { ids, deleteFiles }
    });
    return response.data;
  }

  async searchMovie(movieId: string) {
    const response = await this.client.post(`/library/movies/${movieId}/search`);
    return response.data;
  }

  async bulkSearchMovies(ids: string[]) {
    const response = await this.client.post('/library/movies/bulk/search', { ids });
    return response.data;
  }

  // Movie Folder Rename
  async previewMovieFolderRename(movieId: string) {
    const response = await this.client.get(`/library/movies/${movieId}/folder-rename`);
    return response.data;
  }

  async executeMovieFolderRename(movieId: string) {
    const response = await this.client.post(`/library/movies/${movieId}/folder-rename`);
    return response.data;
  }

  async previewAllMovieFolderRenames() {
    const response = await this.client.get('/library/movies/folder-rename/preview');
    return response.data;
  }

  async executeAllMovieFolderRenames() {
    const response = await this.client.post('/library/movies/folder-rename/execute');
    return response.data;
  }

  // Movie Preview Rename
  async previewMovieRename(movieId: string) {
    const response = await this.client.get(`/library/movies/${movieId}/rename`);
    return response.data;
  }

  async executeMovieRename(movieId: string, files: { id: string; newPath: string }[]) {
    const response = await this.client.post(`/library/movies/${movieId}/rename`, { files });
    return response.data;
  }

  // Library - TV Series
  async getSeries(monitored?: boolean): Promise<{ items: any[]; total: number }> {
    const response = await this.client.get('/library/series', {
      params: { monitored }
    });
    // Handle both old array format and new object format
    if (Array.isArray(response.data)) {
      return { items: response.data, total: response.data.length };
    }
    return { items: response.data.items || [], total: response.data.total || 0 };
  }

  async getSeriesById(id: string) {
    const response = await this.client.get(`/library/series/${id}`);
    return response.data;
  }

  async getSeriesActivity(id: string, limit: number = 50) {
    const response = await this.client.get(`/library/series/${id}/activity`, { params: { limit } });
    return response.data;
  }

  async getRelatedSeries(id: string, limit: number = 10) {
    const response = await this.client.get(`/library/series/${id}/related`, { params: { limit } });
    return response.data;
  }

  async refreshSeriesMetadata(id: string) {
    const response = await this.client.post(`/library/series/${id}/refresh-metadata`);
    return response.data;
  }

  async addSeries(data: any) {
    const response = await this.client.post('/library/series', data);
    return response.data;
  }

  async updateSeries(id: string, data: any) {
    const response = await this.client.put(`/library/series/${id}`, data);
    return response.data;
  }

  async deleteSeries(id: string, deleteFiles: boolean = false, addExclusion: boolean = false) {
    const response = await this.client.delete(`/library/series/${id}`, {
      params: { deleteFiles, addExclusion }
    });
    return response.data;
  }

  async bulkUpdateSeries(ids: string[], updates: { monitored?: boolean; quality_profile_id?: string; series_type?: string; tags?: string; cascadeMonitor?: boolean }) {
    const response = await this.client.put('/library/series/bulk/update', { ids, updates });
    return response.data;
  }

  async bulkDeleteSeries(ids: string[], deleteFiles: boolean = false) {
    const response = await this.client.delete('/library/series/bulk/delete', { 
      data: { ids, deleteFiles }
    });
    return response.data;
  }

  async searchSeries(seriesId: string) {
    const response = await this.client.post(`/library/series/${seriesId}/search`);
    return response.data;
  }

  async bulkSearchSeries(ids: string[]) {
    const response = await this.client.post('/library/series/bulk/search', { ids });
    return response.data;
  }

  // Series Preview Rename
  async previewSeriesRename(seriesId: string) {
    const response = await this.client.get(`/library/series/${seriesId}/rename`);
    return response.data;
  }

  async executeSeriesRename(seriesId: string, files: { id: string; newPath: string }[]) {
    const response = await this.client.post(`/library/series/${seriesId}/rename`, { files });
    return response.data;
  }

  async getSeasons(seriesId: string) {
    const response = await this.client.get(`/library/series/${seriesId}/seasons`);
    return response.data;
  }

  async getEpisodes(seriesId: string, season?: number) {
    const response = await this.client.get(`/library/series/${seriesId}/episodes`, {
      params: { season }
    });
    return response.data;
  }

  async updateSeason(seriesId: string, seasonNumber: number, data: any) {
    const response = await this.client.put(`/library/series/${seriesId}/seasons/${seasonNumber}`, data);
    return response.data;
  }

  async updateEpisode(episodeId: string, data: any) {
    const response = await this.client.put(`/library/episodes/${episodeId}`, data);
    return response.data;
  }

  async deleteEpisodeFile(episodeId: string) {
    const response = await this.client.delete(`/library/episodes/${episodeId}/file`);
    return response.data;
  }

  async deleteSeasonFiles(seriesId: string, seasonNumber: number) {
    const response = await this.client.delete(`/library/series/${seriesId}/seasons/${seasonNumber}/files`);
    return response.data;
  }

  // Calendar
  async getUpcomingEpisodes(start?: string, end?: string) {
    const response = await this.client.get('/calendar/upcoming', {
      params: { start, end }
    });
    return response.data;
  }

  async getMissingEpisodes() {
    const response = await this.client.get('/calendar/missing');
    return response.data;
  }

  async getLibraryStats() {
    const response = await this.client.get('/library/stats');
    return response.data;
  }

  // Library Scanner
  async scanLibrary(path: string, type: 'movie' | 'tv') {
    const response = await this.client.post('/scanner/scan', { path, type });
    return response.data;
  }

  async getLibraryPaths(type: 'movie' | 'tv') {
    const response = await this.client.get('/scanner/library-paths', { params: { type } });
    return response.data;
  }

  async getScannerSuggestions(filename: string, type: 'movie' | 'tv') {
    const response = await this.client.get('/scanner/suggestions', { params: { filename, type } });
    return response.data;
  }

  async scanSeriesEpisodes(seriesId: string) {
    const response = await this.client.post(`/scanner/series/${seriesId}/episodes`);
    return response.data;
  }

  async manualImportSeries(seriesId: string) {
    const response = await this.client.post(`/scanner/series/${seriesId}/manual-import`);
    return response.data;
  }

  // Release Search
  async searchMovieReleases(title: string, year?: number) {
    console.log('[API] searchMovieReleases:', { title, year });
    const response = await this.client.get('/search/releases/movie', { params: { title, year } });
    console.log('[API] searchMovieReleases response:', response.status, response.data?.length || 0, 'results');
    return response.data;
  }

  async searchTVReleases(title: string, season?: number, episode?: number) {
    console.log('[API] searchTVReleases:', { title, season, episode });
    const response = await this.client.get('/search/releases/tv', { params: { title, season, episode } });
    console.log('[API] searchTVReleases response:', response.status, response.data?.length || 0, 'results');
    return response.data;
  }

  // Downloads
  async startDownload(data: {
    movieId?: string;
    seriesId?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    downloadUrl: string;
    title: string;
    quality: string;
    size?: number;
    seeders?: number;
    indexer?: string;
    protocol?: 'torrent' | 'usenet';
    downloadClientId?: string;
  }) {
    const response = await this.client.post('/automation/downloads', data);
    return response.data;
  }

  async getEnabledDownloadClients() {
    const response = await this.client.get('/automation/download-clients/enabled');
    return response.data;
  }

  async syncDownloads() {
    const response = await this.client.post('/automation/downloads/sync');
    return response.data;
  }

  async cancelDownload(id: string, deleteFiles: boolean = false) {
    const response = await this.client.delete(`/automation/downloads/${id}`, {
      data: { deleteFiles }
    });
    return response.data;
  }

  // ========== Release Blacklist ==========

  async getBlacklist() {
    const response = await this.client.get('/automation/blacklist');
    return response.data;
  }

  async removeFromBlacklist(id: string) {
    const response = await this.client.delete(`/automation/blacklist/${id}`);
    return response.data;
  }

  async clearMovieBlacklist(movieId: string) {
    const response = await this.client.delete(`/automation/blacklist/movie/${movieId}`);
    return response.data;
  }

  async clearSeriesBlacklist(seriesId: string) {
    const response = await this.client.delete(`/automation/blacklist/series/${seriesId}`);
    return response.data;
  }

  async getIndexerStatus() {
    const response = await this.client.get('/automation/indexers/status');
    return response.data;
  }

  // ========== Quality Profiles ==========
  
  async getQualityDefinitions() {
    const response = await this.client.get('/mediamanagement/quality/definitions');
    return response.data;
  }

  async getQualityProfiles() {
    const response = await this.client.get('/mediamanagement/quality/profiles');
    return response.data;
  }

  async getQualityProfile(id: string) {
    const response = await this.client.get(`/mediamanagement/quality/profiles/${id}`);
    return response.data;
  }

  async createQualityProfile(data: { name: string; cutoff_quality: string; upgrade_allowed: boolean; items: any[] }) {
    const response = await this.client.post('/mediamanagement/quality/profiles', data);
    return response.data;
  }

  async updateQualityProfile(id: string, data: { name?: string; cutoff_quality?: string; upgrade_allowed?: boolean; items?: any[] }) {
    const response = await this.client.put(`/mediamanagement/quality/profiles/${id}`, data);
    return response.data;
  }

  async deleteQualityProfile(id: string) {
    const response = await this.client.delete(`/mediamanagement/quality/profiles/${id}`);
    return response.data;
  }

  // ========== Naming Configuration ==========
  
  async getNamingConfig() {
    const response = await this.client.get('/mediamanagement/naming');
    return response.data;
  }

  async updateNamingConfig(data: any) {
    const response = await this.client.put('/mediamanagement/naming', data);
    return response.data;
  }

  async getNamingTokens() {
    const response = await this.client.get('/mediamanagement/naming/tokens');
    return response.data;
  }

  async previewNaming(type: string, format?: string) {
    const response = await this.client.post('/mediamanagement/naming/preview', { type, format });
    return response.data;
  }

  // File Management Settings
  async getFileManagementSettings() {
    const response = await this.client.get('/mediamanagement/file-management');
    return response.data;
  }

  async updateFileManagementSettings(data: { propers_repacks_preference?: string; delete_empty_folders?: boolean; unmonitor_deleted_media?: boolean }) {
    const response = await this.client.put('/mediamanagement/file-management', data);
    return response.data;
  }

  // ========== Scanner ==========
  
  async scanMovie(movieId: string) {
    const response = await this.client.post(`/scanner/movies/${movieId}/scan`);
    return response.data;
  }

  async scanSeries(seriesId: string) {
    const response = await this.client.post(`/scanner/series/${seriesId}/episodes`);
    return response.data;
  }

  // ========== Workers ==========
  
  async getWorkers() {
    const response = await this.client.get('/system/workers');
    return response.data;
  }

  async getWorker(id: string) {
    const response = await this.client.get(`/system/workers/${id}`);
    return response.data;
  }

  async startWorker(id: string) {
    const response = await this.client.post(`/system/workers/${id}/start`);
    return response.data;
  }

  async stopWorker(id: string) {
    const response = await this.client.post(`/system/workers/${id}/stop`);
    return response.data;
  }

  async restartWorker(id: string) {
    const response = await this.client.post(`/system/workers/${id}/restart`);
    return response.data;
  }

  async updateWorkerInterval(id: string, intervalMs: number) {
    const response = await this.client.put(`/system/workers/${id}/interval`, { interval: intervalMs });
    return response.data;
  }

  async runWorkerNow(id: string) {
    const response = await this.client.post(`/system/workers/${id}/run`);
    return response.data;
  }

  // ========== Backup/Restore ==========

  async getBackupInfo() {
    const response = await this.client.get('/system/backup/info');
    return response.data;
  }

  async createBackup() {
    const response = await this.client.get('/system/backup', {
      responseType: 'blob'
    });
    return response.data;
  }

  async previewBackup(backupData: any): Promise<{
    success: boolean;
    meta: { version: string; created_at: string };
    preview: { group: string; tables: { key: string; label: string; count: number; available: boolean }[] }[];
  }> {
    const response = await this.client.post('/system/backup/preview', backupData);
    return response.data;
  }

  async restoreBackup(backupData: any, selectedTables?: string[]) {
    const response = await this.client.post('/system/backup/restore', { backupData, selectedTables });
    return response.data;
  }

  // Scheduled Backups
  async getScheduledBackups(): Promise<string[]> {
    const response = await this.client.get('/system/backup/scheduled');
    return response.data;
  }

  async deleteScheduledBackup(filename: string) {
    const response = await this.client.delete(`/system/backup/scheduled/${encodeURIComponent(filename)}`);
    return response.data;
  }

  async downloadScheduledBackup(filename: string): Promise<Blob> {
    const response = await this.client.get(`/system/backup/scheduled/${encodeURIComponent(filename)}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Exclusion List
  async getExclusions(mediaType?: string) {
    const response = await this.client.get('/settings/exclusions', { params: { mediaType } });
    return response.data;
  }

  async addExclusion(data: { tmdb_id: number; media_type: 'movie' | 'tv'; title: string; year?: number; reason?: string }) {
    const response = await this.client.post('/settings/exclusions', data);
    return response.data;
  }

  async removeExclusion(id: string) {
    const response = await this.client.delete(`/settings/exclusions/${id}`);
    return response.data;
  }

  async clearExclusions(mediaType?: string) {
    const response = await this.client.delete('/settings/exclusions', { params: { mediaType } });
    return response.data;
  }

  // ========== Custom Formats ==========

  async getCustomFormats() {
    const response = await this.client.get('/customformats');
    return response.data;
  }

  async getCustomFormat(id: string) {
    const response = await this.client.get(`/customformats/${id}`);
    return response.data;
  }

  async createCustomFormat(data: { name: string; media_type?: 'movie' | 'series' | 'both'; specifications: any[]; include_when_renaming?: boolean; trash_id?: string }) {
    const response = await this.client.post('/customformats', data);
    return response.data;
  }

  async updateCustomFormat(id: string, data: { name?: string; media_type?: 'movie' | 'series' | 'both'; specifications?: any[]; include_when_renaming?: boolean; trash_id?: string }) {
    const response = await this.client.put(`/customformats/${id}`, data);
    return response.data;
  }

  async deleteCustomFormat(id: string) {
    const response = await this.client.delete(`/customformats/${id}`);
    return response.data;
  }

  async importCustomFormat(json: string | object, profileId?: string, score?: number, mediaType?: 'movie' | 'series' | 'both') {
    const response = await this.client.post('/customformats/import', { json, profileId, score, mediaType });
    return response.data;
  }

  async bulkImportCustomFormats(formats: (string | object)[], profileId?: string, useDefaultScores?: boolean, mediaType?: 'movie' | 'series' | 'both') {
    const response = await this.client.post('/customformats/import/bulk', { formats, profileId, useDefaultScores, mediaType });
    return response.data;
  }

  async testReleaseAgainstFormats(title: string, profileId?: string, size?: number) {
    const response = await this.client.post('/customformats/test', { title, profileId, size });
    return response.data;
  }

  async scoreReleases(releases: Array<{ title: string; size?: number }>, profileId: string) {
    const response = await this.client.post('/customformats/score', { releases, profileId });
    return response.data;
  }

  async getProfileCustomFormatScores(profileId: string) {
    const response = await this.client.get(`/customformats/profile/${profileId}/scores`);
    return response.data;
  }

  async setProfileCustomFormatScores(profileId: string, scores: Array<{ customFormatId: string; score: number }>) {
    const response = await this.client.put(`/customformats/profile/${profileId}/scores`, { scores });
    return response.data;
  }

  async setProfileCustomFormatScore(profileId: string, formatId: string, score: number) {
    const response = await this.client.put(`/customformats/profile/${profileId}/format/${formatId}/score`, { score });
    return response.data;
  }

  async removeProfileCustomFormatScore(profileId: string, formatId: string) {
    const response = await this.client.delete(`/customformats/profile/${profileId}/format/${formatId}/score`);
    return response.data;
  }

  // UI Settings
  async getUISettings(): Promise<{ ui_settings: Record<string, any> | null }> {
    const response = await this.client.get('/settings/ui');
    return response.data;
  }

  async updateUISettings(settings: Record<string, any>): Promise<{ success: boolean }> {
    const response = await this.client.put('/settings/ui', { value: settings });
    return response.data;
  }

  // Image Cache
  async getImageCacheStats() {
    const response = await this.client.get('/images/cache/stats');
    return response.data;
  }

  async clearImageCache() {
    const response = await this.client.delete('/images/cache');
    return response.data;
  }

  // Radarr/Sonarr Import
  async testRadarr(url: string, apiKey: string): Promise<{ success: boolean; version?: string; error?: string }> {
    const response = await this.client.post('/arr/radarr/test', { url, apiKey });
    return response.data;
  }

  async testSonarr(url: string, apiKey: string): Promise<{ success: boolean; version?: string; error?: string }> {
    const response = await this.client.post('/arr/sonarr/test', { url, apiKey });
    return response.data;
  }

  async getRadarrMovies(url: string, apiKey: string): Promise<{ movies: any[]; total: number }> {
    const response = await this.client.post('/arr/radarr/movies', { url, apiKey });
    return response.data;
  }

  async getSonarrSeries(url: string, apiKey: string): Promise<{ series: any[]; total: number }> {
    const response = await this.client.post('/arr/sonarr/series', { url, apiKey });
    return response.data;
  }

  async getRadarrProfiles(url: string, apiKey: string): Promise<{ profiles: { id: number; name: string }[] }> {
    const response = await this.client.post('/arr/radarr/profiles', { url, apiKey });
    return response.data;
  }

  async getSonarrProfiles(url: string, apiKey: string): Promise<{ profiles: { id: number; name: string }[] }> {
    const response = await this.client.post('/arr/sonarr/profiles', { url, apiKey });
    return response.data;
  }
  // Reports API
  async getReportFilterOptions() {
    const response = await this.client.get('/reports/filters');
    return response.data;
  }

  async searchReportMovies(filters: {
    quality?: string;
    resolution?: string;
    videoCodec?: string;
    audioCodec?: string;
    hdrType?: string;
    audioChannels?: string;
    releaseGroup?: string;
    yearFrom?: number;
    yearTo?: number;
    ratingFrom?: number;
    ratingTo?: number;
    sizeFrom?: number;
    sizeTo?: number;
    hasFile?: boolean;
    monitored?: boolean;
    titleMismatch?: boolean;
    multipleFiles?: boolean;
    missingFile?: boolean;
    noRating?: boolean;
    sortBy?: string;
    sortDir?: string;
    limit?: number;
  }) {
    const params: any = {};
    if (filters.quality) params.quality = filters.quality;
    if (filters.resolution) params.resolution = filters.resolution;
    if (filters.videoCodec) params.videoCodec = filters.videoCodec;
    if (filters.audioCodec) params.audioCodec = filters.audioCodec;
    if (filters.hdrType) params.hdrType = filters.hdrType;
    if (filters.audioChannels) params.audioChannels = filters.audioChannels;
    if (filters.releaseGroup) params.releaseGroup = filters.releaseGroup;
    if (filters.yearFrom) params.yearFrom = filters.yearFrom;
    if (filters.yearTo) params.yearTo = filters.yearTo;
    if (filters.ratingFrom) params.ratingFrom = filters.ratingFrom;
    if (filters.ratingTo) params.ratingTo = filters.ratingTo;
    if (filters.sizeFrom) params.sizeFrom = filters.sizeFrom;
    if (filters.sizeTo) params.sizeTo = filters.sizeTo;
    if (filters.hasFile !== undefined) params.hasFile = filters.hasFile;
    if (filters.monitored !== undefined) params.monitored = filters.monitored;
    if (filters.titleMismatch) params.titleMismatch = filters.titleMismatch;
    if (filters.multipleFiles) params.multipleFiles = filters.multipleFiles;
    if (filters.missingFile) params.missingFile = filters.missingFile;
    if (filters.noRating) params.noRating = filters.noRating;
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortDir) params.sortDir = filters.sortDir;
    if (filters.limit) params.limit = filters.limit;
    
    const response = await this.client.get('/reports/movies', { params });
    return response.data;
  }

  async searchReportEpisodes(filters: {
    quality?: string;
    videoCodec?: string;
    audioCodec?: string;
    sizeFrom?: number;
    sizeTo?: number;
    hasFile?: boolean;
    monitored?: boolean;
    sortBy?: string;
    sortDir?: string;
    limit?: number;
  }) {
    const params: any = {};
    if (filters.quality) params.quality = filters.quality;
    if (filters.videoCodec) params.videoCodec = filters.videoCodec;
    if (filters.audioCodec) params.audioCodec = filters.audioCodec;
    if (filters.sizeFrom) params.sizeFrom = filters.sizeFrom;
    if (filters.sizeTo) params.sizeTo = filters.sizeTo;
    if (filters.hasFile !== undefined) params.hasFile = filters.hasFile;
    if (filters.monitored !== undefined) params.monitored = filters.monitored;
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortDir) params.sortDir = filters.sortDir;
    if (filters.limit) params.limit = filters.limit;
    
    const response = await this.client.get('/reports/episodes', { params });
    return response.data;
  }

  async getReportStats() {
    const response = await this.client.get('/reports/stats');
    return response.data;
  }

  // Notifications
  async getNotifications() {
    const response = await this.client.get('/notifications');
    return response.data;
  }

  async getNotificationById(id: string) {
    const response = await this.client.get(`/notifications/${id}`);
    return response.data;
  }

  async createNotification(data: {
    name: string;
    type: 'pushbullet' | 'pushover';
    enabled: boolean;
    triggers: Record<string, boolean>;
    config: Record<string, any>;
  }) {
    const response = await this.client.post('/notifications', data);
    return response.data;
  }

  async updateNotification(id: string, data: {
    name?: string;
    type?: 'pushbullet' | 'pushover';
    enabled?: boolean;
    triggers?: Record<string, boolean>;
    config?: Record<string, any>;
  }) {
    const response = await this.client.put(`/notifications/${id}`, data);
    return response.data;
  }

  async deleteNotification(id: string) {
    const response = await this.client.delete(`/notifications/${id}`);
    return response.data;
  }

  async testNotification(data: {
    name: string;
    type: 'pushbullet' | 'pushover';
    triggers: Record<string, boolean>;
    config: Record<string, any>;
  }) {
    const response = await this.client.post('/notifications/test', data);
    return response.data;
  }

  async getPushbulletDevices(accessToken: string) {
    const response = await this.client.post('/notifications/pushbullet/devices', { accessToken });
    return response.data;
  }
}

// Helper function to get cached image URL for library items
export function getCachedImageUrl(path: string | null | undefined, size: string = 'w342'): string | null {
  if (!path) return null;
  return `${API_BASE_URL}/images/cache/${size}${path}`;
}

// Helper function to get direct TMDB image URL (for discover/dashboard)
export function getTMDBImageUrl(path: string | null | undefined, size: string = 'w342'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export const api = new ApiService();
