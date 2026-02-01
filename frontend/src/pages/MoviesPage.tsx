import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { api, getCachedImageUrl } from '../services/api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { useUISettings } from '../contexts/UISettingsContext';
import { SmartBar } from '../components/SmartBar';

// Poster size configurations
const posterSizeConfig: Record<number, { grid: string; imgSize: string; minWidth: string }> = {
 1: { grid: 'grid-cols-[repeat(auto-fill,minmax(80px,80px))]', imgSize: 'w154', minWidth: '80px' },
 2: { grid: 'grid-cols-[repeat(auto-fill,minmax(100px,100px))]', imgSize: 'w154', minWidth: '100px' },
 3: { grid: 'grid-cols-[repeat(auto-fill,minmax(120px,120px))]', imgSize: 'w185', minWidth: '120px' },
 4: { grid: 'grid-cols-[repeat(auto-fill,minmax(140px,140px))]', imgSize: 'w185', minWidth: '140px' },
 5: { grid: 'grid-cols-[repeat(auto-fill,minmax(160px,160px))]', imgSize: 'w300', minWidth: '160px' },
 6: { grid: 'grid-cols-[repeat(auto-fill,minmax(180px,180px))]', imgSize: 'w300', minWidth: '180px' },
 7: { grid: 'grid-cols-[repeat(auto-fill,minmax(200px,200px))]', imgSize: 'w342', minWidth: '200px' },
 8: { grid: 'grid-cols-[repeat(auto-fill,minmax(220px,220px))]', imgSize: 'w342', minWidth: '220px' },
 9: { grid: 'grid-cols-[repeat(auto-fill,minmax(250px,250px))]', imgSize: 'w500', minWidth: '250px' },
 10: { grid: 'grid-cols-[repeat(auto-fill,minmax(280px,280px))]', imgSize: 'w500', minWidth: '280px' },
};

// A-Z index component
function AlphaIndex({ letters, activeLetter, onLetterClick }: { 
 letters: string[]; 
 activeLetter: string | null;
 onLetterClick: (letter: string) => void;
}) {
 const alphabet = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
 
 if (letters.length === 0) return null;
 
 return (
  <div 
   className="fixed right-1 top-1/2 -translate-y-1/2 z-[9999] flex flex-col items-center py-2 px-1 shadow-xl border"
   style={{ 
    backgroundColor: 'var(--navbar-bg)', 
    borderColor: 'var(--border-color)'
   }}
  >
   {alphabet.map(letter => {
    const hasItems = letters.includes(letter);
    const isActive = activeLetter === letter;
    return (
     <button
      key={letter}
      onClick={() => hasItems && onLetterClick(letter)}
      disabled={!hasItems}
      className="w-7 h-6 text-xs font-semibold rounded transition-all flex items-center justify-center"
      style={{
       color: hasItems 
        ? isActive 
         ? 'white' 
         : 'var(--navbar-text)'
        : 'var(--text-muted)',
       backgroundColor: isActive ? 'var(--navbar-bg)' : 'transparent',
       opacity: hasItems ? 1 : 0.4,
       cursor: hasItems ? 'pointer' : 'default',
       filter: isActive ? 'brightness(1.5)' : undefined
      }}
      onMouseEnter={(e) => {
       if (hasItems && !isActive) {
        e.currentTarget.style.filter = 'brightness(1.3)';
       }
      }}
      onMouseLeave={(e) => {
       if (!isActive) {
        e.currentTarget.style.filter = '';
       }
      }}
     >
      {letter}
     </button>
    );
   })}
  </div>
 );
}

type ViewMode = 'poster' | 'table';

// Number of items to render initially and load more
const INITIAL_RENDER_COUNT = 100;
const LOAD_MORE_COUNT = 100;

export function MoviesPage() {
 const location = useLocation();
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const { addToast } = useToast();
 const { settings, updateSettings } = useUISettings();
 
 const [movies, setMovies] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState<string>(() => {
  // Initialize filter from URL param if present
  const urlFilter = searchParams.get('filter');
  return urlFilter || 'all';
 });
 const [searchTerm, setSearchTerm] = useState('');
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [selectMode, setSelectMode] = useState(false);
 const [activeLetter, setActiveLetter] = useState<string | null>(null);
 const movieRefs = useRef<Record<string, HTMLDivElement | null>>({});
 
 // Windowed rendering - only render visible items for performance
 const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_COUNT);
 const loadMoreRef = useRef<HTMLDivElement | null>(null);
 
 // Custom filters
 const [customFilters, setCustomFilters] = useState<any[]>([]);
 const [qualityProfiles, setQualityProfiles] = useState<any[]>([]);
 
 // View mode and poster size from settings
 const viewMode = (settings.viewMode as ViewMode) || 'poster';
 const posterSize = settings.posterSize || 5;
 const posterConfig = posterSizeConfig[posterSize] || posterSizeConfig[5];
 
 const setViewMode = (mode: ViewMode) => updateSettings({ viewMode: mode });
 const setPosterSize = (size: number) => updateSettings({ posterSize: size });
 
 // Movie table columns configuration
 const [showColumnSelector, setShowColumnSelector] = useState(false);
 const movieTableColumns = settings.movieTableColumns || {
  year: true,
  quality: true,
  size: true,
  monitored: true,
  availability: false,
  qualityProfile: false,
  runtime: false,
  rating: false,
  added: false,
 };
 
 const columnOptions = [
  { key: 'year', label: 'Year' },
  { key: 'quality', label: 'Quality' },
  { key: 'size', label: 'Size' },
  { key: 'runtime', label: 'Runtime' },
  { key: 'rating', label: 'Rating' },
  { key: 'qualityProfile', label: 'Quality Profile' },
  { key: 'availability', label: 'Availability' },
  { key: 'added', label: 'Added' },
  { key: 'monitored', label: 'Monitored' },
 ];
 
 const toggleColumn = (key: string) => {
  updateSettings({
   movieTableColumns: {
    ...movieTableColumns,
    [key]: !movieTableColumns[key as keyof typeof movieTableColumns]
   }
  });
 };
 
 // Delete modal state
 const [showDeleteModal, setShowDeleteModal] = useState(false);
 const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
 const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
 const [deleteWithFiles, setDeleteWithFiles] = useState(false);
 const [deleting, setDeleting] = useState(false);
 const [searchingSelected, setSearchingSelected] = useState(false);
 const [organizingFolders, setOrganizingFolders] = useState(false);
 const [settingProfile, setSettingProfile] = useState(false);
 const [settingAvailability, setSettingAvailability] = useState(false);

 useEffect(() => {
  loadMovies();
  loadQualityProfiles();
  loadCustomFilters();
 }, []);

 // Close column selector when clicking outside
 useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
   if (showColumnSelector) {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-column-selector]')) {
     setShowColumnSelector(false);
    }
   }
  };
  document.addEventListener('click', handleClickOutside);
  return () => document.removeEventListener('click', handleClickOutside);
 }, [showColumnSelector]);

 const loadQualityProfiles = async () => {
  try {
   const profiles = await api.getQualityProfiles();
   // Filter profiles for movies (media_type = 'movie' or 'both')
   const filteredProfiles = profiles.filter((p: any) => 
    !p.media_type || p.media_type === 'both' || p.media_type === 'movie'
   );
   setQualityProfiles(filteredProfiles);
  } catch (error) {
   console.error('Failed to load quality profiles:', error);
  }
 };

 const loadCustomFilters = () => {
  const saved = localStorage.getItem('customFilters_movies');
  if (saved) {
   try {
    setCustomFilters(JSON.parse(saved));
   } catch (e) {
    console.error('Failed to parse custom filters:', e);
   }
  }
 };

 const saveCustomFilters = (filters: any[]) => {
  localStorage.setItem('customFilters_movies', JSON.stringify(filters));
  setCustomFilters(filters);
 };

 // Check for notification from navigation
 useEffect(() => {
  if (location.state?.notification) {
   addToast({ type: 'success', message: location.state.notification });
   window.history.replaceState({}, document.title);
  }
 }, [location.state]);

 const loadMovies = async () => {
  try {
   const response = await api.getMovies();
   const data = response.items || response;
   data.sort((a: any, b: any) => a.title.localeCompare(b.title));
   setMovies(data);
  } catch (error) {
   console.error('Failed to load movies:', error);
  } finally {
   setLoading(false);
  }
 };

 const filteredMovies = useMemo(() => {
  // Quality ranking for cutoff comparison (higher is better)
  // Format: resolution * 100 + source bonus
  // This ensures Bluray-1080p > WEBDL-1080p > HDTV-1080p
  const getQualityRank = (quality: string): number => {
   const q = (quality || '').toLowerCase();
   
   // Determine resolution rank (base score)
   let resolutionRank = 0;
   if (q.includes('2160') || q.includes('4k') || q.includes('uhd')) {
    resolutionRank = 400;
   } else if (q.includes('1080')) {
    resolutionRank = 300;
   } else if (q.includes('720')) {
    resolutionRank = 200;
   } else if (q.includes('480') || q.includes('sd')) {
    resolutionRank = 100;
   }
   
   // Determine source rank (bonus points)
   let sourceRank = 0;
   if (q.includes('remux')) {
    sourceRank = 50;
   } else if (q.includes('bluray') || q.includes('blu-ray') || q.includes('bdrip') || q.includes('brrip')) {
    sourceRank = 40;
   } else if (q.includes('webdl') || q.includes('web-dl') || q.includes('web dl')) {
    sourceRank = 30;
   } else if (q.includes('webrip') || q.includes('web-rip') || q.includes('web rip')) {
    sourceRank = 25;
   } else if (q.includes('hdtv')) {
    sourceRank = 20;
   } else if (q.includes('dvd') || q.includes('sdtv')) {
    sourceRank = 10;
   }
   
   return resolutionRank + sourceRank;
  };
  
  // Helper to check if cutoff is met for a movie
  const isCutoffMet = (movie: any): boolean => {
   if (!movie.quality_profile_id || !movie.has_file || !movie.quality) return true;
   const profile = qualityProfiles.find((p: any) => p.id === movie.quality_profile_id);
   if (!profile || !profile.cutoff_quality) return true;
   
   const currentRank = getQualityRank(movie.quality);
   const cutoffRank = getQualityRank(profile.cutoff_quality);
   return currentRank >= cutoffRank;
  };
  
  return movies.filter(movie => {
   const matchesSearch = movie.title.toLowerCase().includes(searchTerm.toLowerCase());
   
   let matchesFilter = true;
   if (filter === 'all') {
    matchesFilter = true;
   } else if (filter === 'monitored') {
    matchesFilter = movie.monitored;
   } else if (filter === 'unmonitored') {
    matchesFilter = !movie.monitored;
   } else if (filter === 'missing') {
    matchesFilter = !movie.has_file;
   } else if (filter === 'wanted') {
    matchesFilter = movie.monitored && !movie.has_file;
   } else if (filter === 'downloaded') {
    matchesFilter = movie.has_file;
   } else if (filter === 'cutoff_unmet') {
    matchesFilter = movie.has_file && !isCutoffMet(movie);
   } else if (filter.startsWith('custom_')) {
    // Custom filter
    const customFilter = customFilters.find(f => f.id === filter);
    if (customFilter) {
     const { conditions } = customFilter;
     if (conditions.monitored !== undefined && movie.monitored !== conditions.monitored) matchesFilter = false;
     if (conditions.hasFile !== undefined && movie.has_file !== conditions.hasFile) matchesFilter = false;
     if (conditions.cutoffMet !== undefined) {
      // Only check cutoff for items with files
      if (!movie.has_file) {
       matchesFilter = false; // Items without files don't match cutoff conditions
      } else {
       const cutoffStatus = isCutoffMet(movie);
       if (cutoffStatus !== conditions.cutoffMet) matchesFilter = false;
      }
     }
     if (conditions.qualityProfileId && movie.quality_profile_id !== conditions.qualityProfileId) matchesFilter = false;
     if (conditions.quality) {
      // Normalize quality for comparison (WEB-DL = WEBDL, case insensitive)
      const normalizeQuality = (q: string) => q.toLowerCase().replace(/[-\s]/g, '');
      const filterQuality = normalizeQuality(conditions.quality);
      const movieQuality = normalizeQuality(movie.quality || '');
      if (!movieQuality.includes(filterQuality) && !filterQuality.includes(movieQuality)) {
       matchesFilter = false;
      }
     }
     if (conditions.minYear && movie.year < conditions.minYear) matchesFilter = false;
     if (conditions.maxYear && movie.year > conditions.maxYear) matchesFilter = false;
    }
   }
   
   return matchesSearch && matchesFilter;
  });
 }, [movies, searchTerm, filter, customFilters, qualityProfiles]);

 // Get unique first letters for A-Z index
 const availableLetters = useMemo(() => {
  const letters = new Set<string>();
  filteredMovies.forEach(movie => {
   const firstChar = movie.title.charAt(0).toUpperCase();
   const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
   letters.add(letter);
  });
  return Array.from(letters).sort((a, b) => {
   if (a === '#') return -1;
   if (b === '#') return 1;
   return a.localeCompare(b);
  });
 }, [filteredMovies]);

 // Find first movie for each letter (for scroll targeting)
 const firstMovieByLetter = useMemo(() => {
  const map: Record<string, string> = {};
  filteredMovies.forEach(movie => {
   const firstChar = movie.title.charAt(0).toUpperCase();
   const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
   if (!map[letter]) {
    map[letter] = movie.id;
   }
  });
  return map;
 }, [filteredMovies]);

 // Scroll tracking for A-Z index
 useEffect(() => {
  const handleScroll = () => {
   const scrollPos = window.scrollY + 200;
   let currentLetter: string | null = null;
   
   for (const letter of availableLetters) {
    const movieId = firstMovieByLetter[letter];
    if (movieId) {
     const element = movieRefs.current[movieId];
     if (element && element.offsetTop <= scrollPos) {
      currentLetter = letter;
     }
    }
   }
   setActiveLetter(currentLetter);
  };
  
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
 }, [availableLetters, firstMovieByLetter]);

 const scrollToLetter = useCallback((letter: string) => {
  const movieId = firstMovieByLetter[letter];
  if (movieId) {
   // Find the index of this movie in filteredMovies
   const movieIndex = filteredMovies.findIndex(m => m.id === movieId);
   if (movieIndex >= 0) {
    // Ensure we've loaded enough items to include this movie
    if (movieIndex >= visibleCount) {
     setVisibleCount(movieIndex + LOAD_MORE_COUNT);
     // Wait for render then scroll
     setTimeout(() => {
      const element = movieRefs.current[movieId];
      if (element) {
       element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
     }, 50);
    } else {
     // Already loaded, scroll immediately
     const element = movieRefs.current[movieId];
     if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
     }
    }
   }
  }
 }, [firstMovieByLetter, filteredMovies, visibleCount]);

 // Reset visible count when filter changes
 useEffect(() => {
  setVisibleCount(INITIAL_RENDER_COUNT);
 }, [filter, searchTerm]);

 // Infinite scroll - load more when reaching bottom
 useEffect(() => {
  const observer = new IntersectionObserver(
   (entries) => {
    if (entries[0].isIntersecting && visibleCount < filteredMovies.length) {
     setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, filteredMovies.length));
    }
   },
   { threshold: 0.1, rootMargin: '200px' }
  );

  if (loadMoreRef.current) {
   observer.observe(loadMoreRef.current);
  }

  return () => observer.disconnect();
 }, [visibleCount, filteredMovies.length]);

 // Visible movies for rendering (windowed)
 const visibleMovies = useMemo(() => {
  return filteredMovies.slice(0, visibleCount);
 }, [filteredMovies, visibleCount]);

 const toggleSelect = (id: string) => {
  const newSelected = new Set(selectedIds);
  if (newSelected.has(id)) {
   newSelected.delete(id);
  } else {
   newSelected.add(id);
  }
  setSelectedIds(newSelected);
 };

 const selectAll = () => {
  if (selectedIds.size === filteredMovies.length) {
   setSelectedIds(new Set());
  } else {
   setSelectedIds(new Set(filteredMovies.map(m => m.id)));
  }
 };

 const handleBulkMonitor = async () => {
  if (selectedIds.size === 0) return;
  try {
   const ids = Array.from(selectedIds);
   await api.bulkUpdateMovies(ids, { monitored: true });
   setMovies(prev => prev.map(m => selectedIds.has(m.id) ? { ...m, monitored: true } : m));
   addToast({ type: 'success', message: `Monitored ${selectedIds.size} movies` });
   setSelectedIds(new Set());
   setSelectMode(false);
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to update monitor status' });
  }
 };

 const handleBulkUnmonitor = async () => {
  if (selectedIds.size === 0) return;
  try {
   const ids = Array.from(selectedIds);
   await api.bulkUpdateMovies(ids, { monitored: false });
   setMovies(prev => prev.map(m => selectedIds.has(m.id) ? { ...m, monitored: false } : m));
   addToast({ type: 'success', message: `Unmonitored ${selectedIds.size} movies` });
   setSelectedIds(new Set());
   setSelectMode(false);
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to update monitor status' });
  }
 };

 const handleBulkSearch = async () => {
  if (selectedIds.size === 0) return;
  setSearchingSelected(true);
  try {
   const ids = Array.from(selectedIds);
   const result = await api.bulkSearchMovies(ids);
   addToast({ 
    type: 'success', 
    message: `Search complete: ${result.found}/${result.searched} found releases` 
   });
   setSelectedIds(new Set());
   setSelectMode(false);
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to search movies' });
  } finally {
   setSearchingSelected(false);
  }
 };

 const handleOrganizeFolders = async () => {
  if (selectedIds.size === 0) return;
  setOrganizingFolders(true);
  try {
   let renamed = 0;
   let failed = 0;
   const ids = Array.from(selectedIds);
   
   for (const id of ids) {
    try {
     const result = await api.executeMovieFolderRename(id);
     if (result.renamed) {
      renamed++;
     }
    } catch (err) {
     failed++;
    }
   }
   
   if (renamed > 0 || failed > 0) {
    addToast({ 
     type: renamed > 0 ? 'success' : 'info',
     message: `Renamed ${renamed} folder${renamed !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`
    });
   } else {
    addToast({ type: 'info', message: 'All folders already have correct names' });
   }
   
   setSelectedIds(new Set());
   setSelectMode(false);
   loadMovies();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to rename folders' });
  } finally {
   setOrganizingFolders(false);
  }
 };

 const handleBulkSetProfile = async (profileId: string) => {
  if (selectedIds.size === 0) return;
  setSettingProfile(true);
  try {
   const ids = Array.from(selectedIds);
   await api.bulkUpdateMovies(ids, { quality_profile_id: profileId });
   
   const profileName = qualityProfiles.find(p => p.id === profileId)?.name || 'profile';
   addToast({ 
    type: 'success',
    message: `Set ${ids.length} movie${ids.length !== 1 ? 's' : ''} to ${profileName}`
   });
   
   setSelectedIds(new Set());
   setSelectMode(false);
   loadMovies();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to set profile' });
  } finally {
   setSettingProfile(false);
  }
 };

 const handleBulkSetAvailability = async (availability: string) => {
  if (selectedIds.size === 0) return;
  setSettingAvailability(true);
  try {
   const ids = Array.from(selectedIds);
   await api.bulkUpdateMovies(ids, { minimum_availability: availability });
   
   const availabilityLabel = availability === 'announced' ? 'Announced' :
    availability === 'inCinemas' ? 'In Cinemas' : 'Released';
   addToast({ 
    type: 'success',
    message: `Set ${ids.length} movie${ids.length !== 1 ? 's' : ''} to ${availabilityLabel}`
   });
   
   setSelectedIds(new Set());
   setSelectMode(false);
   loadMovies();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to set availability' });
  } finally {
   setSettingAvailability(false);
  }
 };

 const handleDelete = async (deleteFiles: boolean, addExclusion: boolean) => {
  setDeleting(true);
  try {
   if (deleteTargetId) {
    await api.deleteMovie(deleteTargetId, deleteFiles, addExclusion);
    addToast({ type: 'success', message: 'Movie deleted successfully' });
   }
   loadMovies();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to delete movie' });
  } finally {
   setDeleting(false);
   setShowDeleteModal(false);
   setDeleteTargetId(null);
  }
 };

 const handleBulkDelete = async () => {
  setDeleting(true);
  try {
   await api.bulkDeleteMovies(Array.from(selectedIds), deleteWithFiles);
   addToast({ type: 'success', message: `Deleted ${selectedIds.size} movies` });
   setSelectedIds(new Set());
   setSelectMode(false);
   loadMovies();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to delete movies' });
  } finally {
   setDeleting(false);
   setShowBulkDeleteModal(false);
   setDeleteWithFiles(false);
  }
 };

 const handleToggleMonitor = async (movie: any, e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  try {
   await api.updateMovie(movie.id, { monitored: !movie.monitored });
   setMovies(prev => prev.map(m => m.id === movie.id ? { ...m, monitored: !m.monitored } : m));
   addToast({ type: 'success', message: `${movie.title} ${!movie.monitored ? 'monitored' : 'unmonitored'}` });
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to update monitor status' });
  }
 };

 const openDeleteModal = (movieId: string, e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setDeleteTargetId(movieId);
  setShowDeleteModal(true);
 };

 const openBulkDeleteModal = () => {
  setShowBulkDeleteModal(true);
 };

 const getQualityBadge = (quality?: string) => {
  if (!quality) return null;
  const colors: Record<string, string> = {
   '2160p': 'bg-purple-600',
   '4K': 'bg-purple-600',
   '1080p': 'bg-blue-600',
   '720p': 'bg-green-600',
   '480p': 'bg-yellow-600'
  };
  return colors[quality] || 'bg-gray-600';
 };

 const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'monitored', label: 'Monitored Only' },
  { value: 'unmonitored', label: 'Unmonitored' },
  { value: 'missing', label: 'Missing' },
  { value: 'wanted', label: 'Wanted' },
  { value: 'downloaded', label: 'Downloaded' },
  { value: 'cutoff_unmet', label: 'Cutoff Unmet' },
 ];

 if (loading) {
  return (
   <Layout>
    <div className="flex items-center justify-center h-64">
     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
   </Layout>
  );
 }

 return (
  <Layout>
   <div className="space-y-4 pr-10">
    {/* Page Title */}
    <div>
     <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Movies</h1>
     <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Browse and manage your media library</p>
    </div>

    {/* Smart Bar */}
    <SmartBar
     totalItems={filteredMovies.length}
     selectedCount={selectedIds.size}
     searchTerm={searchTerm}
     onSearchChange={setSearchTerm}
     filter={filter}
     onFilterChange={setFilter}
     filterOptions={filterOptions}
     customFilters={customFilters}
     onCustomFiltersChange={saveCustomFilters}
     qualityProfiles={qualityProfiles}
     viewMode={viewMode}
     onViewModeChange={setViewMode}
     posterSize={posterSize}
     onPosterSizeChange={setPosterSize}
     selectMode={selectMode}
     onSelectModeChange={(enabled) => {
      setSelectMode(enabled);
      if (!enabled) setSelectedIds(new Set());
     }}
     onSelectAll={selectAll}
     onDeleteSelected={openBulkDeleteModal}
     onMonitorSelected={handleBulkMonitor}
     onUnmonitorSelected={handleBulkUnmonitor}
     onSearchSelected={handleBulkSearch}
     searchingSelected={searchingSelected}
     onOrganizeFolders={handleOrganizeFolders}
     organizingFolders={organizingFolders}
     onSetProfile={handleBulkSetProfile}
     settingProfile={settingProfile}
     onSetAvailability={handleBulkSetAvailability}
     settingAvailability={settingAvailability}
     onRefresh={loadMovies}
     addLink="/discover"
     addLabel="Add Movie"
     importLink="/settings?tab=import"
    />

    {/* Content */}
    {filteredMovies.length === 0 ? (
     <div className="text-center py-12 " style={{ backgroundColor: 'var(--surface-bg)' }}>
      <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
       {searchTerm ? 'No movies match your search' : 'No movies in your library'}
      </p>
      <a
       href="/discover"
       className="inline-block px-6 py-3 transition-colors"
       style={{ backgroundColor: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
      >
       Browse Movies to Add
      </a>
     </div>
    ) : viewMode === 'poster' ? (
     /* Poster View - Continuous Grid */
     <div className={`grid ${posterConfig.grid} gap-4`}>
      {visibleMovies.map((movie) => {
       const firstChar = movie.title.charAt(0).toUpperCase();
       const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
       const isFirstOfLetter = firstMovieByLetter[letter] === movie.id;
       
       return (
        <div
         key={movie.id}
         ref={el => movieRefs.current[movie.id] = el}
         data-letter={letter}
         className={`shadow hover:shadow-lg transition-shadow overflow-hidden group relative ${
          selectMode && selectedIds.has(movie.id) ? 'ring-2 ring-primary-500' : ''
         } ${isFirstOfLetter ? 'scroll-mt-32' : ''}`}
         style={{ backgroundColor: 'var(--surface-bg)' }}
         onClick={selectMode ? () => toggleSelect(movie.id) : undefined}
        >
         {/* Selection checkbox */}
         {selectMode && (
          <div className="absolute top-2 right-2 z-10">
           <input
            type="checkbox"
            checked={selectedIds.has(movie.id)}
            onChange={() => toggleSelect(movie.id)}
            className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            onClick={(e) => e.stopPropagation()}
           />
          </div>
         )}

         <a href={`/movies/${movie.id}`} className="block">
          <div className="relative aspect-[2/3]">
           {movie.poster_path ? (
            <img
             src={getCachedImageUrl(movie.poster_path, posterConfig.imgSize) || ''}
             alt={movie.title}
             className="w-full h-full object-cover"
             loading="lazy"
            />
           ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--hover-bg)' }}>
             <span style={{ color: 'var(--text-muted)' }}>No Poster</span>
            </div>
           )}
           
           {/* Status badges */}
           <div className="absolute top-2 left-2 flex flex-col gap-1">
            {!movie.has_file && movie.download_status === 'downloading' && (
             <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded animate-pulse">
              {Math.round(movie.download_progress || 0)}%
             </span>
            )}
            {!movie.has_file && movie.download_status === 'importing' && (
             <span className="px-2 py-1 bg-purple-500 text-white text-xs rounded animate-pulse">
              Importing
             </span>
            )}
            {!movie.has_file && movie.download_status === 'queued' && (
             <span className="px-2 py-1 bg-gray-500 text-white text-xs rounded">
              Queued
             </span>
            )}
            {!movie.has_file && !movie.download_status && movie.monitored && (
             <span className="px-2 py-1 bg-yellow-500 text-white text-xs rounded">
              Missing
             </span>
            )}
            {movie.quality && (
             <span className={`px-2 py-1 text-white text-xs rounded ${getQualityBadge(movie.quality)}`}>
              {movie.quality}
             </span>
            )}
           </div>

           {/* Hover action buttons */}
           {!selectMode && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
             <button
              onClick={(e) => handleToggleMonitor(movie, e)}
              className={`p-2 rounded-full ${movie.monitored ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'} text-white`}
              title={movie.monitored ? 'Unmonitor' : 'Monitor'}
             >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               {movie.monitored ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
               ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
               )}
              </svg>
             </button>
             <button
              onClick={(e) => openDeleteModal(movie.id, e)}
              className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white"
              title="Delete"
             >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
             </button>
            </div>
           )}
          </div>
          <div className="p-2">
           <h3 className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{movie.title}</h3>
           <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{movie.year}</p>
          </div>
         </a>
        </div>
       );
      })}
     </div>
    ) : (
     /* Table View */
     <div className="border overflow-hidden" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
      {/* Column Selector */}
      <div className="flex items-center justify-end px-3 py-2 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--table-header-bg)' }}>
       <div className="relative" data-column-selector>
        <button
         onClick={() => setShowColumnSelector(!showColumnSelector)}
         className="flex items-center gap-1.5 px-2 py-1 text-xs border rounded transition-colors"
         style={{ 
          backgroundColor: 'var(--surface-bg)', 
          borderColor: 'var(--border-color)', 
          color: 'var(--text-secondary)' 
         }}
        >
         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
         </svg>
         Columns
        </button>
        {showColumnSelector && (
         <div 
          className="absolute right-0 top-full mt-1 w-48 py-1 border shadow-xl z-50"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
         >
          {columnOptions.map(col => (
           <label 
            key={col.key} 
            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-700/30"
           >
            <input
             type="checkbox"
             checked={movieTableColumns[col.key as keyof typeof movieTableColumns]}
             onChange={() => toggleColumn(col.key)}
             className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{col.label}</span>
           </label>
          ))}
         </div>
        )}
       </div>
      </div>
      <div className="table-responsive">
      <table className="w-full">
       <thead style={{ backgroundColor: 'var(--table-header-bg)' }}>
        <tr>
         {selectMode && (
          <th className="px-3 py-2 w-10">
           <input
            type="checkbox"
            checked={selectedIds.size === filteredMovies.length && filteredMovies.length > 0}
            onChange={selectAll}
            className="w-4 h-4 rounded border-gray-300 text-primary-600"
           />
          </th>
         )}
         <th className="px-3 py-2 text-left text-xs font-medium uppercase" style={{ color: 'var(--text-secondary)' }}>Title</th>
         {movieTableColumns.year && <th className="px-3 py-2 text-left text-xs font-medium uppercase w-16" style={{ color: 'var(--text-secondary)' }}>Year</th>}
         {movieTableColumns.quality && <th className="px-3 py-2 text-left text-xs font-medium uppercase w-24" style={{ color: 'var(--text-secondary)' }}>Quality</th>}
         {movieTableColumns.size && <th className="px-3 py-2 text-left text-xs font-medium uppercase w-24" style={{ color: 'var(--text-secondary)' }}>Size</th>}
         {movieTableColumns.runtime && <th className="px-3 py-2 text-left text-xs font-medium uppercase w-20" style={{ color: 'var(--text-secondary)' }}>Runtime</th>}
         {movieTableColumns.rating && <th className="px-3 py-2 text-left text-xs font-medium uppercase w-16" style={{ color: 'var(--text-secondary)' }}>Rating</th>}
         {movieTableColumns.qualityProfile && <th className="px-3 py-2 text-left text-xs font-medium uppercase w-32" style={{ color: 'var(--text-secondary)' }}>Profile</th>}
         {movieTableColumns.availability && <th className="px-3 py-2 text-left text-xs font-medium uppercase w-28" style={{ color: 'var(--text-secondary)' }}>Availability</th>}
         {movieTableColumns.added && <th className="px-3 py-2 text-left text-xs font-medium uppercase w-24" style={{ color: 'var(--text-secondary)' }}>Added</th>}
         {movieTableColumns.monitored && <th className="px-3 py-2 text-left text-xs font-medium uppercase w-24" style={{ color: 'var(--text-secondary)' }}>Monitored</th>}
         <th className="px-3 py-2 text-right text-xs font-medium uppercase w-24" style={{ color: 'var(--text-secondary)' }}>Actions</th>
        </tr>
       </thead>
       <tbody>
        {visibleMovies.map((movie) => (
         <tr
          key={movie.id}
          onClick={() => selectMode ? toggleSelect(movie.id) : navigate(`/movies/${movie.id}`)}
          className="cursor-pointer border-t transition-colors"
          style={{ 
           borderColor: 'var(--border-color)',
           backgroundColor: selectMode && selectedIds.has(movie.id) ? 'var(--selected-bg)' : undefined
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--table-row-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectMode && selectedIds.has(movie.id) ? 'var(--selected-bg)' : ''}
         >
          {selectMode && (
           <td className="px-3 py-2">
            <input
             type="checkbox"
             checked={selectedIds.has(movie.id)}
             onChange={() => toggleSelect(movie.id)}
             onClick={(e) => e.stopPropagation()}
             className="w-4 h-4 rounded border-gray-300 text-primary-600"
            />
           </td>
          )}
          <td className="px-3 py-2">
           <div className="flex items-center gap-3">
            <div className="w-8 h-12 overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--hover-bg)' }}>
             {movie.poster_path && (
              <img src={getCachedImageUrl(movie.poster_path, 'w92') || ''} alt="" className="w-full h-full object-cover" />
             )}
            </div>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{movie.title}</span>
           </div>
          </td>
          {movieTableColumns.year && <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{movie.year}</td>}
          {movieTableColumns.quality && (
           <td className="px-3 py-2">
            {movie.quality ? (
             <span className={`px-2 py-0.5 text-xs font-medium text-white rounded ${getQualityBadge(movie.quality)}`}>
              {movie.quality}
             </span>
            ) : (
             <span className="text-sm" style={{ color: 'var(--text-muted)' }}>-</span>
            )}
           </td>
          )}
          {movieTableColumns.size && (
           <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {movie.file_size ? `${(movie.file_size / (1024 * 1024 * 1024)).toFixed(2)} GB` : '-'}
           </td>
          )}
          {movieTableColumns.runtime && (
           <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {movie.runtime ? `${movie.runtime}m` : '-'}
           </td>
          )}
          {movieTableColumns.rating && (
           <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {movie.vote_average ? movie.vote_average.toFixed(1) : '-'}
           </td>
          )}
          {movieTableColumns.qualityProfile && (
           <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {qualityProfiles.find((p: any) => p.id === movie.quality_profile_id)?.name || '-'}
           </td>
          )}
          {movieTableColumns.availability && (
           <td className="px-3 py-2">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
             movie.minimum_availability === 'released' ? 'bg-green-900/30 text-green-400' :
             movie.minimum_availability === 'inCinemas' ? 'bg-yellow-900/30 text-yellow-400' :
             'bg-gray-700 text-gray-400'
            }`}>
             {movie.minimum_availability === 'released' ? 'Released' :
              movie.minimum_availability === 'inCinemas' ? 'In Cinemas' :
              movie.minimum_availability === 'announced' ? 'Announced' : '-'}
            </span>
           </td>
          )}
          {movieTableColumns.added && (
           <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {movie.created_at ? new Date(movie.created_at).toLocaleDateString() : '-'}
           </td>
          )}
          {movieTableColumns.monitored && (
           <td className="px-3 py-2">
            <button
             onClick={(e) => handleToggleMonitor(movie, e)}
             className={`px-2 py-1 text-xs rounded ${
              movie.monitored ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
             }`}
            >
             {movie.monitored ? 'Yes' : 'No'}
            </button>
           </td>
          )}
          <td className="px-3 py-2 text-right">
           <button
            onClick={(e) => openDeleteModal(movie.id, e)}
            className="p-1 text-red-500 hover:text-red-700 rounded"
            title="Delete"
           >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
           </button>
          </td>
         </tr>
        ))}
       </tbody>
      </table></div>
     </div>
    )}
   </div>

   {/* Load more trigger for infinite scroll */}
   {visibleCount < filteredMovies.length && (
    <div 
     ref={loadMoreRef}
     className="flex justify-center py-8"
    >
     <div className="text-center">
      <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2" />
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
       Loading more... ({visibleCount} of {filteredMovies.length})
      </span>
     </div>
    </div>
   )}

   {/* A-Z Index */}
   {viewMode === 'poster' && (
    <AlphaIndex 
     letters={availableLetters} 
     activeLetter={activeLetter}
     onLetterClick={scrollToLetter}
    />
   )}

   {/* Single Delete Confirmation Modal */}
   <DeleteConfirmModal
    isOpen={showDeleteModal && !!deleteTargetId}
    onClose={() => {
     setShowDeleteModal(false);
     setDeleteTargetId(null);
    }}
    onConfirm={handleDelete}
    title="Delete Movie"
    itemName={movies.find(m => m.id === deleteTargetId)?.title || 'this movie'}
    hasFiles={movies.find(m => m.id === deleteTargetId)?.has_file}
    showExclusionOption={true}
   />

   {/* Bulk Delete Confirmation Modal */}
   <ConfirmModal
    isOpen={showBulkDeleteModal}
    title={`Delete ${selectedIds.size} movies?`}
    message={
     <div className="space-y-4">
      <p>
       Are you sure you want to delete {selectedIds.size} movies? This cannot be undone.
      </p>
      <label className="flex items-center gap-2 cursor-pointer">
       <input
        type="checkbox"
        checked={deleteWithFiles}
        onChange={(e) => setDeleteWithFiles(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
       />
       <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Also delete files from disk
       </span>
      </label>
     </div>
    }
    confirmText={deleting ? 'Deleting...' : (deleteWithFiles ? 'Delete with Files' : 'Delete')}
    onConfirm={handleBulkDelete}
    onCancel={() => {
     setShowBulkDeleteModal(false);
     setDeleteWithFiles(false);
    }}
    danger
   />
  </Layout>
 );
}
