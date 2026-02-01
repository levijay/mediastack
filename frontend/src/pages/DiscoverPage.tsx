import { useEffect, useState, useRef, useCallback } from 'react';
import { Layout } from '../components/layout/Layout';
import { api } from '../services/api';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useUISettings } from '../contexts/UISettingsContext';
import { AddToLibraryModal } from '../components/AddToLibraryModal';
import { PosterSizeSelector } from '../components/PosterSizeSelector';

type SortOption = {
 value: string;
 label: string;
};

interface FilterState {
 genres: number[];
 releaseDateFrom: string;
 releaseDateTo: string;
 language: string;
 status: string;
 runtimeMin: number;
 runtimeMax: number;
 voteAverageMin: number;
 voteAverageMax: number;
 voteCountMin: number;
 voteCountMax: number;
 certifications: string[];
 keywords: { id: number; name: string }[];
 excludeKeywords: { id: number; name: string }[];
 companies: { id: number; name: string }[];
 hideInLibrary: boolean;
}

interface Genre {
 id: number;
 name: string;
}

interface Language {
 iso_639_1: string;
 english_name: string;
 name: string;
}

const movieSortOptions: SortOption[] = [
 { value: 'popularity.desc', label: 'Popularity Descending' },
 { value: 'popularity.asc', label: 'Popularity Ascending' },
 { value: 'primary_release_date.desc', label: 'Release Date Descending' },
 { value: 'primary_release_date.asc', label: 'Release Date Ascending' },
 { value: 'vote_average.desc', label: 'TMDB Rating Descending' },
 { value: 'vote_average.asc', label: 'TMDB Rating Ascending' },
 { value: 'original_title.asc', label: 'Title (A-Z) Ascending' },
 { value: 'original_title.desc', label: 'Title (Z-A) Descending' },
];

const tvSortOptions: SortOption[] = [
 { value: 'popularity.desc', label: 'Popularity Descending' },
 { value: 'popularity.asc', label: 'Popularity Ascending' },
 { value: 'first_air_date.desc', label: 'First Air Date Descending' },
 { value: 'first_air_date.asc', label: 'First Air Date Ascending' },
 { value: 'vote_average.desc', label: 'TMDB Rating Descending' },
 { value: 'vote_average.asc', label: 'TMDB Rating Ascending' },
 { value: 'name.asc', label: 'Title (A-Z) Ascending' },
 { value: 'name.desc', label: 'Title (Z-A) Descending' },
];

const movieContentRatings = ['NR', 'G', 'PG', 'PG-13', 'R', 'NC-17'];
const tvContentRatings = ['NR', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];

const tvStatusOptions = [
 { value: '', label: 'Any Status' },
 { value: 'returning', label: 'Returning Series' },
 { value: 'ended', label: 'Ended' },
 { value: 'canceled', label: 'Canceled' },
 { value: 'in_production', label: 'In Production' },
];

const defaultFilters: FilterState = {
 genres: [],
 releaseDateFrom: '',
 releaseDateTo: '',
 language: '',
 status: '',
 runtimeMin: 0,
 runtimeMax: 400,
 voteAverageMin: 1,
 voteAverageMax: 10,
 voteCountMin: 0,
 voteCountMax: 1000,
 certifications: [],
 keywords: [],
 excludeKeywords: [],
 companies: [],
 hideInLibrary: false,
};

// Poster size configurations matching MediaLibraryPage
const posterSizeConfig = {
 1: { grid: 'grid-cols-[repeat(auto-fill,minmax(80px,80px))]', imgSize: 'w154' },
 2: { grid: 'grid-cols-[repeat(auto-fill,minmax(100px,100px))]', imgSize: 'w154' },
 3: { grid: 'grid-cols-[repeat(auto-fill,minmax(120px,120px))]', imgSize: 'w185' },
 4: { grid: 'grid-cols-[repeat(auto-fill,minmax(140px,140px))]', imgSize: 'w185' },
 5: { grid: 'grid-cols-[repeat(auto-fill,minmax(160px,160px))]', imgSize: 'w300' },
 6: { grid: 'grid-cols-[repeat(auto-fill,minmax(180px,180px))]', imgSize: 'w300' },
 7: { grid: 'grid-cols-[repeat(auto-fill,minmax(200px,200px))]', imgSize: 'w342' },
 8: { grid: 'grid-cols-[repeat(auto-fill,minmax(220px,220px))]', imgSize: 'w342' },
 9: { grid: 'grid-cols-[repeat(auto-fill,minmax(250px,250px))]', imgSize: 'w500' },
 10: { grid: 'grid-cols-[repeat(auto-fill,minmax(280px,280px))]', imgSize: 'w500' },
};

export function DiscoverPage() {
 const [searchParams] = useSearchParams();
 const navigate = useNavigate();
 const { addToast } = useToast();
 const { settings, updateSettings } = useUISettings();
 
 const [items, setItems] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadingMore, setLoadingMore] = useState(false);
 const [category, setCategory] = useState<'movie' | 'tv'>('movie');
 const [sortBy, setSortBy] = useState('popularity.desc');
 const [page, setPage] = useState(1);
 const [hasMore, setHasMore] = useState(true);
 
 const [filters, setFilters] = useState<FilterState>(defaultFilters);
 const [showFilters, setShowFilters] = useState(false);
 const [genres, setGenres] = useState<Genre[]>([]);
 const [languages, setLanguages] = useState<Language[]>([]);
 const [keywordSearch, setKeywordSearch] = useState('');
 const [keywordResults, setKeywordResults] = useState<any[]>([]);
 const [excludeKeywordSearch, setExcludeKeywordSearch] = useState('');
 const [excludeKeywordResults, setExcludeKeywordResults] = useState<any[]>([]);
 const [companySearch, setCompanySearch] = useState('');
 const [companyResults, setCompanyResults] = useState<any[]>([]);
 
 const [searchMode, setSearchMode] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 
 const [libraryMovies, setLibraryMovies] = useState<Map<number, string>>(new Map());
 const [librarySeries, setLibrarySeries] = useState<Map<number, string>>(new Map());
 const [addModalItem, setAddModalItem] = useState<any | null>(null);
 const [addModalOpen, setAddModalOpen] = useState(false);
 
 // API key status
 const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean | null>(null);

 // Refs
 const observerRef = useRef<IntersectionObserver | null>(null);
 const loadMoreRef = useRef<HTMLDivElement | null>(null);
 const filterModalRef = useRef<HTMLDivElement | null>(null);

 // Get poster config from settings
 const posterConfig = posterSizeConfig[settings.posterSize as keyof typeof posterSizeConfig] || posterSizeConfig[5];

 // Check API key on mount
 useEffect(() => {
  const checkApiKey = async () => {
   try {
    const response = await api.getSettings();
    const hasKey = !!response.tmdb_api_key;
    setApiKeyConfigured(hasKey);
   } catch (error) {
    console.error('Failed to check API key:', error);
    setApiKeyConfigured(false);
   }
  };
  checkApiKey();
 }, []);

 // Calculate active filter count
 const getActiveFilterCount = () => {
  let count = 0;
  if (filters.genres.length > 0) count++;
  if (filters.releaseDateFrom || filters.releaseDateTo) count++;
  if (filters.language) count++;
  if (filters.status) count++;
  if (filters.runtimeMin > 0 || filters.runtimeMax < 400) count++;
  if (filters.voteAverageMin > 1 || filters.voteAverageMax < 10) count++;
  if (filters.voteCountMin > 0 || filters.voteCountMax < 1000) count++;
  if (filters.certifications.length > 0) count++;
  if (filters.keywords.length > 0) count++;
  if (filters.excludeKeywords.length > 0) count++;
  if (filters.companies.length > 0) count++;
  if (filters.hideInLibrary) count++;
  return count;
 };

 const activeFilterCount = getActiveFilterCount();

 useEffect(() => {
  const typeParam = searchParams.get('type');
  if (typeParam === 'tv' || typeParam === 'movie') {
   setCategory(typeParam);
  }
  
  // Handle genre filter from URL
  const genresParam = searchParams.get('genres');
  if (genresParam) {
   const genreIds = genresParam.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
   if (genreIds.length > 0) {
    setFilters(prev => ({ ...prev, genres: genreIds }));
   }
  }
  
  loadLibrary();
 }, [searchParams]);

 useEffect(() => {
  // Only load genres/languages if API key is configured
  if (apiKeyConfigured) {
   loadGenres();
   loadLanguages();
  }
 }, [category, apiKeyConfigured]);

 // Reset and reload when category, sort, or filters change
 useEffect(() => {
  // Only load content if API key is configured
  if (apiKeyConfigured && !searchMode) {
   setItems([]);
   setPage(1);
   setHasMore(true);
   loadContent(1, true);
  }
 }, [category, sortBy, filters, searchMode, apiKeyConfigured]);

 // Set up infinite scroll observer
 useEffect(() => {
  if (observerRef.current) {
   observerRef.current.disconnect();
  }

  observerRef.current = new IntersectionObserver(
   (entries) => {
    if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && apiKeyConfigured) {
     loadMore();
    }
   },
   { threshold: 0.1 }
  );

  if (loadMoreRef.current) {
   observerRef.current.observe(loadMoreRef.current);
  }

  return () => {
   if (observerRef.current) {
    observerRef.current.disconnect();
   }
  };
 }, [hasMore, loading, loadingMore, page]);

 // Close filter modal on outside click
 useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
   if (filterModalRef.current && !filterModalRef.current.contains(e.target as Node)) {
    setShowFilters(false);
   }
  };
  if (showFilters) {
   document.addEventListener('mousedown', handleClickOutside);
  }
  return () => document.removeEventListener('mousedown', handleClickOutside);
 }, [showFilters]);

 const loadLibrary = async () => {
  try {
   const [movies, series] = await Promise.all([
    api.getMovies(),
    api.getSeries()
   ]);
   setLibraryMovies(new Map(movies.items.map((m: any) => [m.tmdb_id, m.id])));
   setLibrarySeries(new Map(series.items.map((s: any) => [s.tmdb_id, s.id])));
  } catch (error) {
   console.error('Failed to load library:', error);
  }
 };

 const loadGenres = async () => {
  try {
   const data = await api.getGenres(category);
   setGenres(data.genres || []);
  } catch (error) {
   console.error('Failed to load genres:', error);
  }
 };

 const loadLanguages = async () => {
  try {
   const data = await api.getLanguages();
   const sorted = (data || []).sort((a: Language, b: Language) => 
    a.english_name.localeCompare(b.english_name)
   );
   setLanguages(sorted);
  } catch (error) {
   console.error('Failed to load languages:', error);
  }
 };

 const loadContent = async (pageNum: number, reset: boolean = false) => {
  // Don't make requests if API key is not configured
  if (!apiKeyConfigured) {
   setLoading(false);
   return;
  }
  
  // Capture current category to prevent race conditions
  const requestCategory = category;
  
  try {
   if (reset) {
    setLoading(true);
   } else {
    setLoadingMore(true);
   }

   const filterParams = {
    genres: filters.genres,
    releaseDateFrom: filters.releaseDateFrom,
    releaseDateTo: filters.releaseDateTo,
    language: filters.language,
    runtimeMin: filters.runtimeMin,
    runtimeMax: filters.runtimeMax,
    voteAverageMin: filters.voteAverageMin,
    voteAverageMax: filters.voteAverageMax,
    voteCountMin: filters.voteCountMin,
    voteCountMax: filters.voteCountMax,
    certifications: filters.certifications,
    keywords: filters.keywords.map(k => k.id),
    excludeKeywords: filters.excludeKeywords.map(k => k.id),
    companies: filters.companies.map(c => c.id),
   };

   const data = await api.discover(requestCategory, pageNum, sortBy, filterParams);
   
   // Only apply results if category hasn't changed during the request
   if (requestCategory !== category) {
    console.log('Category changed during request, discarding results');
    return;
   }
   
   if (reset) {
    setItems(data.results || []);
   } else {
    setItems(prev => [...prev, ...(data.results || [])]);
   }
   
   setHasMore(pageNum < (data.total_pages || 1));
   setPage(pageNum);
  } catch (error) {
   console.error('Failed to load content:', error);
  } finally {
   setLoading(false);
   setLoadingMore(false);
  }
 };

 const loadMore = useCallback(() => {
  if (!loadingMore && hasMore && !searchMode && apiKeyConfigured) {
   loadContent(page + 1, false);
  }
 }, [loadingMore, hasMore, page, searchMode, apiKeyConfigured, category]);

 const handleSearch = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!apiKeyConfigured) {
   addToast({ type: 'error', message: 'TMDB API key not configured' });
   return;
  }
  if (!searchQuery.trim()) {
   setSearchMode(false);
   setItems([]);
   setPage(1);
   loadContent(1, true);
   return;
  }

  try {
   setLoading(true);
   setSearchMode(true);
   
   const data = category === 'movie' 
    ? await api.searchMovies(searchQuery)
    : await api.searchTV(searchQuery);
   
   setItems(data.results || []);
   setHasMore(false);
  } catch (error) {
   console.error('Search failed:', error);
  } finally {
   setLoading(false);
  }
 };

 const clearSearch = () => {
  setSearchQuery('');
  setSearchMode(false);
  setItems([]);
  setPage(1);
  if (apiKeyConfigured) {
   loadContent(1, true);
  }
 };

 const handleCategoryChange = (newCategory: 'movie' | 'tv') => {
  setCategory(newCategory);
  setSortBy('popularity.desc');
  setFilters(defaultFilters);
 };

 const searchKeywords = async (query: string, isExclude: boolean = false) => {
  if (!query.trim()) {
   if (isExclude) {
    setExcludeKeywordResults([]);
   } else {
    setKeywordResults([]);
   }
   return;
  }
  try {
   const data = await api.searchKeywords(query);
   if (isExclude) {
    setExcludeKeywordResults(data.results || []);
   } else {
    setKeywordResults(data.results || []);
   }
  } catch (error) {
   console.error('Keyword search failed:', error);
  }
 };

 const searchCompanies = async (query: string) => {
  if (!query.trim()) {
   setCompanyResults([]);
   return;
  }
  try {
   const data = await api.searchCompanies(query);
   setCompanyResults(data.results || []);
  } catch (error) {
   console.error('Company search failed:', error);
  }
 };

 const clearFilters = () => {
  setFilters(defaultFilters);
 };

 const handleAddSuccess = (libraryId: string, autoSearch: boolean) => {
  if (addModalItem) {
   const searchMsg = autoSearch ? ' Searching for releases...' : '';
   if (category === 'movie') {
    setLibraryMovies(prev => new Map(prev).set(addModalItem.id, libraryId));
    addToast({ type: 'success', message: `${addModalItem.title} added to your library!${searchMsg}` });
   } else {
    setLibrarySeries(prev => new Map(prev).set(addModalItem.id, libraryId));
    addToast({ type: 'success', message: `${addModalItem.name} added to your library!${searchMsg}` });
   }
  }
  setAddModalItem(null);
 };

 const handleAddError = (error: string) => {
  if (error === 'Already in library') {
   loadLibrary();
   addToast({ type: 'info', message: `Already in your library` });
  } else {
   addToast({ type: 'error', message: `Failed to add: ${error}` });
  }
 };

 const sortOptions = category === 'movie' ? movieSortOptions : tvSortOptions;
 const contentRatings = category === 'movie' ? movieContentRatings : tvContentRatings;

 return (
  <Layout>
   <div className="space-y-6">
    <div>
     <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Discover</h1>
     <p className="text-sm text-gray-500 dark:text-gray-400">Browse and add to your library</p>
    </div>

    {/* Combined SmartBar: Search + Category + Sort + Filters */}
    <div className="flex items-center gap-3 flex-wrap p-3 border" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
     {/* Search */}
     <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
      <div className="relative flex-1">
       <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
       </svg>
       <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={`Search ${category === 'movie' ? 'movies' : 'TV shows'}...`}
        className="w-full pl-10 pr-4 py-2 text-sm border"
        style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}
       />
      </div>
      {searchMode && (
       <button type="button" onClick={clearSearch} className="px-3 py-2 text-sm " style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
        Clear
       </button>
      )}
     </form>

     {/* Divider */}
     <div className="h-6 w-px hidden sm:block" style={{ backgroundColor: 'var(--border-color)' }} />

     {/* Category Tabs */}
     <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface-bg)' }}>
      <button
       onClick={() => handleCategoryChange('movie')}
       className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
       style={{ 
        backgroundColor: category === 'movie' ? 'var(--navbar-bg)' : 'transparent', 
        color: category === 'movie' ? 'var(--navbar-text)' : 'var(--text-secondary)' 
       }}
      >
       Movies
      </button>
      <button
       onClick={() => handleCategoryChange('tv')}
       className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
       style={{ 
        backgroundColor: category === 'tv' ? 'var(--navbar-bg)' : 'transparent', 
        color: category === 'tv' ? 'var(--navbar-text)' : 'var(--text-secondary)' 
       }}
      >
       TV Shows
      </button>
     </div>

     {/* Poster Size */}
     <PosterSizeSelector 
      value={settings.posterSize || 5} 
      onChange={(size) => updateSettings({ posterSize: size })} 
     />

     {/* Divider */}
     <div className="h-6 w-px hidden sm:block" style={{ backgroundColor: 'var(--border-color)' }} />

     {/* Sort */}
     <div className="flex items-center gap-2">
      <svg className="w-4 h-4 hidden sm:block" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
      <select
       value={sortBy}
       onChange={(e) => setSortBy(e.target.value)}
       disabled={searchMode}
       className="px-3 py-2 text-sm border disabled:opacity-50"
       style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}
      >
       {sortOptions.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
       ))}
      </select>
     </div>

     {/* Filter Button */}
     <div className="relative">
      <button
       onClick={() => setShowFilters(!showFilters)}
       disabled={searchMode}
       className="flex items-center gap-2 px-3 py-2 text-sm border disabled:opacity-50"
       style={{
        backgroundColor: activeFilterCount > 0 || showFilters ? 'var(--btn-primary-bg)' : 'transparent',
        borderColor: activeFilterCount > 0 || showFilters ? 'var(--btn-primary-bg)' : 'var(--border-color)',
        color: activeFilterCount > 0 || showFilters ? 'var(--btn-primary-text)' : 'var(--text-secondary)'
       }}
      >
       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
       </svg>
       {activeFilterCount > 0 ? `${activeFilterCount} Filters` : 'Filters'}
      </button>

       {/* Filter Modal - Full screen on mobile, dropdown on desktop */}
       {showFilters && (
        <>
         {/* Mobile overlay */}
         <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setShowFilters(false)}
         />
         <div
          ref={filterModalRef}
          className="fixed inset-4 md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 md:w-[480px] max-h-[90vh] md:max-h-[85vh] overflow-hidden shadow-2xl z-50 border flex flex-col"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
         >
         {/* Header */}
         <div className="border-b px-4 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-3">
           <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Filters</h3>
           {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-600 text-white">
             {activeFilterCount} active
            </span>
           )}
          </div>
          <div className="flex items-center gap-2">
           {activeFilterCount > 0 && (
            <button
             onClick={clearFilters}
             className="px-2 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
             Clear all
            </button>
           )}
           <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-gray-700 rounded transition-colors" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
           </button>
          </div>
         </div>

         <div className="flex-1 overflow-y-auto">
          {/* Hide In Library Toggle */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
           <label className="flex items-center justify-between cursor-pointer">
            <div>
             <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Hide items in library</span>
             <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Only show items not already in your library</p>
            </div>
            <button
             onClick={() => setFilters({ ...filters, hideInLibrary: !filters.hideInLibrary })}
             className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              filters.hideInLibrary ? 'bg-primary-600' : 'bg-gray-600'
             }`}
            >
             <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
               filters.hideInLibrary ? 'translate-x-4' : 'translate-x-0.5'
              }`}
             />
            </button>
           </label>
          </div>

          {/* Quick Filters - Genres */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
           <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Genres</label>
           <div className="flex flex-wrap gap-1.5">
            {genres.map(genre => (
             <button
              key={genre.id}
              onClick={() => {
               if (filters.genres.includes(genre.id)) {
                setFilters({ ...filters, genres: filters.genres.filter(g => g !== genre.id) });
               } else {
                setFilters({ ...filters, genres: [...filters.genres, genre.id] });
               }
              }}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
               filters.genres.includes(genre.id)
                ? 'bg-primary-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
              }`}
             >
              {genre.name}
             </button>
            ))}
           </div>
          </div>

          {/* Date & Language Row */}
          <div className="p-4 border-b grid grid-cols-1 md:grid-cols-2 gap-4" style={{ borderColor: 'var(--border-color)' }}>
           <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
             {category === 'movie' ? 'Release Date' : 'Air Date'}
            </label>
            <div className="space-y-2">
             <input
              type="date"
              value={filters.releaseDateFrom}
              onChange={(e) => setFilters({ ...filters, releaseDateFrom: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border rounded"
              style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              placeholder="From"
             />
             <input
              type="date"
              value={filters.releaseDateTo}
              onChange={(e) => setFilters({ ...filters, releaseDateTo: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border rounded"
              style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              placeholder="To"
             />
            </div>
           </div>
           <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Language</label>
            <select
             value={filters.language}
             onChange={(e) => setFilters({ ...filters, language: e.target.value })}
             className="w-full px-2 py-1.5 text-sm border rounded"
             style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
             <option value="">Any</option>
             {languages.slice(0, 50).map(lang => (
              <option key={lang.iso_639_1} value={lang.iso_639_1}>{lang.english_name}</option>
             ))}
            </select>
            {category === 'tv' && (
             <>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2 mt-3" style={{ color: 'var(--text-muted)' }}>Status</label>
              <select
               value={filters.status}
               onChange={(e) => setFilters({ ...filters, status: e.target.value })}
               className="w-full px-2 py-1.5 text-sm border rounded"
               style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
               {tvStatusOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
               ))}
              </select>
             </>
            )}
           </div>
          </div>

          {/* Content Rating */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
           <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Content Rating</label>
           <div className="flex flex-wrap gap-1.5">
            {contentRatings.map(rating => (
             <button
              key={rating}
              onClick={() => {
               if (filters.certifications.includes(rating)) {
                setFilters({ ...filters, certifications: filters.certifications.filter(c => c !== rating) });
               } else {
                setFilters({ ...filters, certifications: [...filters.certifications, rating] });
               }
              }}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
               filters.certifications.includes(rating)
                ? 'bg-primary-600 text-white'
                : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
              }`}
             >
              {rating}
             </button>
            ))}
           </div>
          </div>

          {/* Rating & Runtime */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
             <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Rating ({filters.voteAverageMin}-{filters.voteAverageMax})
             </label>
             <div className="flex items-center gap-2">
              <input
               type="number"
               min="1"
               max="10"
               step="0.5"
               value={filters.voteAverageMin}
               onChange={(e) => setFilters({ ...filters, voteAverageMin: Number(e.target.value) })}
               className="w-16 px-2 py-1 text-sm text-center border rounded"
               style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input
               type="number"
               min="1"
               max="10"
               step="0.5"
               value={filters.voteAverageMax}
               onChange={(e) => setFilters({ ...filters, voteAverageMax: Number(e.target.value) })}
               className="w-16 px-2 py-1 text-sm text-center border rounded"
               style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
             </div>
            </div>
            <div>
             <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Runtime (max {filters.runtimeMax}m)
             </label>
             <input
              type="range"
              min="0"
              max="400"
              value={filters.runtimeMax}
              onChange={(e) => setFilters({ ...filters, runtimeMax: Number(e.target.value) })}
              className="w-full h-1.5 bg-gray-700 rounded appearance-none cursor-pointer accent-primary-500"
             />
            </div>
           </div>
          </div>

          {/* Keywords */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
           <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Keywords (Include)</label>
           <div className="relative">
            <input
             type="text"
             value={keywordSearch}
             onChange={(e) => {
              setKeywordSearch(e.target.value);
              searchKeywords(e.target.value);
             }}
             placeholder="Search and add keywords..."
             className="w-full px-3 py-1.5 text-sm border rounded"
             style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            {keywordResults.length > 0 && (
             <div className="absolute z-20 w-full mt-1 border rounded shadow-xl max-h-32 overflow-y-auto" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
              {keywordResults.map((kw: any) => (
               <button
                key={kw.id}
                onClick={() => {
                 if (!filters.keywords.find(k => k.id === kw.id)) {
                  setFilters({ ...filters, keywords: [...filters.keywords, kw] });
                 }
                 setKeywordSearch('');
                 setKeywordResults([]);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700/50"
                style={{ color: 'var(--text-secondary)' }}
               >
                {kw.name}
               </button>
              ))}
             </div>
            )}
           </div>
           {filters.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
             {filters.keywords.map(kw => (
              <span key={kw.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-900/30 border border-green-700/50 rounded text-xs text-green-300">
               {kw.name}
               <button onClick={() => setFilters({ ...filters, keywords: filters.keywords.filter(k => k.id !== kw.id) })} className="hover:text-white">×</button>
              </span>
             ))}
            </div>
           )}
           
           <label className="block text-xs font-semibold uppercase tracking-wider mb-2 mt-4" style={{ color: 'var(--text-muted)' }}>Keywords (Exclude)</label>
           <div className="relative">
            <input
             type="text"
             value={excludeKeywordSearch}
             onChange={(e) => {
              setExcludeKeywordSearch(e.target.value);
              searchKeywords(e.target.value, true);
             }}
             placeholder="Search keywords to exclude..."
             className="w-full px-3 py-1.5 text-sm border rounded"
             style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            {excludeKeywordResults.length > 0 && (
             <div className="absolute z-20 w-full mt-1 border rounded shadow-xl max-h-32 overflow-y-auto" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
              {excludeKeywordResults.map((kw: any) => (
               <button
                key={kw.id}
                onClick={() => {
                 if (!filters.excludeKeywords.find(k => k.id === kw.id)) {
                  setFilters({ ...filters, excludeKeywords: [...filters.excludeKeywords, kw] });
                 }
                 setExcludeKeywordSearch('');
                 setExcludeKeywordResults([]);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700/50"
                style={{ color: 'var(--text-secondary)' }}
               >
                {kw.name}
               </button>
              ))}
             </div>
            )}
           </div>
           {filters.excludeKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
             {filters.excludeKeywords.map(kw => (
              <span key={kw.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
               {kw.name}
               <button onClick={() => setFilters({ ...filters, excludeKeywords: filters.excludeKeywords.filter(k => k.id !== kw.id) })} className="hover:text-white">×</button>
              </span>
             ))}
            </div>
           )}
          </div>

          {/* Studio (Movies only) */}
          {category === 'movie' && (
           <div className="p-4">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Studio</label>
            <div className="relative">
             <input
              type="text"
              value={companySearch}
              onChange={(e) => {
               setCompanySearch(e.target.value);
               searchCompanies(e.target.value);
              }}
              placeholder="Search studios..."
              className="w-full px-3 py-1.5 text-sm border rounded"
              style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
             />
             {companyResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 border rounded shadow-xl max-h-32 overflow-y-auto" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
               {companyResults.map((company: any) => (
                <button
                 key={company.id}
                 onClick={() => {
                  if (!filters.companies.find(c => c.id === company.id)) {
                   setFilters({ ...filters, companies: [...filters.companies, company] });
                  }
                  setCompanySearch('');
                  setCompanyResults([]);
                 }}
                 className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700/50"
                 style={{ color: 'var(--text-secondary)' }}
                >
                 {company.name}
                </button>
               ))}
              </div>
             )}
            </div>
            {filters.companies.length > 0 && (
             <div className="flex flex-wrap gap-1.5 mt-2">
              {filters.companies.map(company => (
               <span key={company.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/30 border border-blue-700/50 rounded text-xs text-blue-300">
                {company.name}
                <button onClick={() => setFilters({ ...filters, companies: filters.companies.filter(c => c.id !== company.id) })} className="hover:text-white">×</button>
               </span>
              ))}
             </div>
            )}
           </div>
          )}
         </div>

         {/* Footer */}
         <div className="border-t px-4 py-3 flex justify-end gap-2" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
          <button
           onClick={() => setShowFilters(false)}
           className="px-4 py-1.5 text-sm font-medium transition-colors rounded"
           style={{ backgroundColor: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
          >
           Apply Filters
          </button>
         </div>
        </div>
        </>
       )}
      </div>
    </div>

    {/* Search mode indicator */}
    {searchMode && (
     <div className="px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface-bg)', color: 'var(--text-secondary)' }}>
      Showing search results for: <strong style={{ color: 'var(--text-primary)' }}>{searchQuery}</strong>
     </div>
    )}

    {/* API Key Error */}
    {apiKeyConfigured === false && (
     <div className="text-center py-16">
      <div className="max-w-md mx-auto">
       <svg className="mx-auto h-16 w-16 text-yellow-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
       </svg>
       <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">TMDB API Key Required</h3>
       <p className="text-gray-500 dark:text-gray-400 mb-6">
        To discover movies and TV shows, you need to configure your TMDB API key in the settings.
       </p>
       <button
        onClick={() => navigate('/settings?tab=api')}
        className="px-6 py-2.5 bg-primary-600 text-white hover:bg-primary-700 transition-colors font-medium"
       >
        Go to API Settings
       </button>
      </div>
     </div>
    )}

    {/* Content Grid */}
    {apiKeyConfigured === null ? (
     <div className="text-center py-12 text-gray-500 dark:text-gray-400">Checking configuration...</div>
    ) : apiKeyConfigured === false ? null : loading && items.length === 0 ? (
     <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
    ) : (
     <>
      <div className={`grid ${posterConfig.grid} gap-3`}>
       {items
        .filter((item: any) => {
         if (!filters.hideInLibrary) return true;
         const libraryId = category === 'movie' 
          ? libraryMovies.get(item.id)
          : librarySeries.get(item.id);
         return !libraryId; // Hide if in library
        })
        .map((item: any) => {
        const libraryId = category === 'movie' 
         ? libraryMovies.get(item.id)
         : librarySeries.get(item.id);
        const inLibrary = !!libraryId;
        const title = item.title || item.name;
        const date = item.release_date || item.first_air_date;
        const year = date ? new Date(date).getFullYear() : null;
        const overview = item.overview || '';

        return (
         <div 
          key={`${category}-${item.id}`} 
          className="group relative overflow-hidden shadow hover:shadow-lg transition-all cursor-pointer"
          onClick={() => {
           if (inLibrary) {
            navigate(category === 'movie' ? `/movies/${libraryId}` : `/series/${libraryId}`);
           } else {
            navigate(`/discover/${category}/${item.id}`);
           }
          }}
         >
          {/* Poster */}
          <div className="aspect-[2/3] relative">
           {item.poster_path ? (
            <img
             src={`https://image.tmdb.org/t/p/${posterConfig.imgSize}${item.poster_path}`}
             alt={title}
             className="w-full h-full object-cover"
             loading="lazy"
            />
           ) : (
            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
             <span className="text-gray-400 text-sm">No Poster</span>
            </div>
           )}
           
           {/* In Library Badge */}
           {inLibrary && (
            <div className="absolute top-2 left-2 z-10">
             <span className="px-2 py-1 bg-green-500 text-white text-xs font-medium">
              In Library
             </span>
            </div>
           )}

           {/* Hover Overlay */}
           <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
            <h3 className="text-white font-semibold text-sm leading-tight mb-1">
             {title}
            </h3>
            <p className="text-gray-300 text-xs mb-2">
             {year || 'TBA'}
            </p>
            <p className="text-gray-400 text-xs line-clamp-3 mb-3">
             {overview || 'No synopsis available.'}
            </p>

            {inLibrary ? (
             <button
              onClick={(e) => {
               e.stopPropagation();
               navigate(category === 'movie' ? `/movies/${libraryId}` : `/series/${libraryId}`);
              }}
              className="w-full py-2 text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
             >
              View in Library
             </button>
            ) : (
             <div className="flex gap-2">
              <button
               onClick={(e) => {
                e.stopPropagation();
                navigate(`/discover/${category}/${item.id}`);
               }}
               className="flex-1 py-2 text-sm font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 flex items-center justify-center gap-1"
              >
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
               Info
              </button>
              <button
               onClick={(e) => {
                e.stopPropagation();
                setAddModalItem(item);
                setAddModalOpen(true);
               }}
               className="px-3 py-2 text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700 flex items-center justify-center"
               title="Add to Library"
              >
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
               </svg>
              </button>
             </div>
            )}
           </div>
          </div>
         </div>
        );
       })}
      </div>

      {/* Load More Trigger */}
      {!searchMode && (
       <div 
        ref={loadMoreRef}
        className="flex justify-center py-8"
       >
        {loadingMore && (
         <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
          <span>Loading more...</span>
         </div>
        )}
        {!hasMore && items.length > 0 && (
         <span className="text-gray-500 dark:text-gray-400 text-sm">
          No more items to load
         </span>
        )}
       </div>
      )}
     </>
    )}
   </div>

   {/* Add to Library Modal */}
   <AddToLibraryModal
    isOpen={addModalOpen}
    item={addModalItem}
    mediaType={category}
    onClose={() => {
     setAddModalOpen(false);
     setAddModalItem(null);
    }}
    onSuccess={handleAddSuccess}
    onError={handleAddError}
   />
  </Layout>
 );
}
