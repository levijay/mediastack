import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

export function TVSeriesPage() {
 const navigate = useNavigate();
 const [searchParams] = useSearchParams();
 const { addToast } = useToast();
 const { settings, updateSettings } = useUISettings();
 
 const [series, setSeries] = useState<any[]>([]);
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
 const seriesRefs = useRef<Record<string, HTMLDivElement | null>>({});
 
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
 
 // Delete modal state
 const [showDeleteModal, setShowDeleteModal] = useState(false);
 const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
 const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
 const [deleteWithFiles, setDeleteWithFiles] = useState(false);
 const [deleting, setDeleting] = useState(false);
 const [searchingSelected, setSearchingSelected] = useState(false);
 const [settingProfile, setSettingProfile] = useState(false);

 useEffect(() => {
  loadSeries();
  loadQualityProfiles();
  loadCustomFilters();
 }, []);

 const loadQualityProfiles = async () => {
  try {
   const profiles = await api.getQualityProfiles();
   // Filter profiles for series (media_type = 'series' or 'both')
   const filteredProfiles = profiles.filter((p: any) => 
    !p.media_type || p.media_type === 'both' || p.media_type === 'series'
   );
   setQualityProfiles(filteredProfiles);
  } catch (error) {
   console.error('Failed to load quality profiles:', error);
  }
 };

 const loadCustomFilters = () => {
  const saved = localStorage.getItem('customFilters_series');
  if (saved) {
   try {
    setCustomFilters(JSON.parse(saved));
   } catch (e) {
    console.error('Failed to parse custom filters:', e);
   }
  }
 };

 const saveCustomFilters = (filters: any[]) => {
  localStorage.setItem('customFilters_series', JSON.stringify(filters));
  setCustomFilters(filters);
 };

 const loadSeries = async () => {
  try {
   const response = await api.getSeries();
   const data = response.items || response;
   data.sort((a: any, b: any) => a.title.localeCompare(b.title));
   setSeries(data);
  } catch (error) {
   console.error('Failed to load series:', error);
  } finally {
   setLoading(false);
  }
 };

 const filteredSeries = useMemo(() => {
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
  
  // Helper to check if cutoff is met for a series (based on lowest quality episode)
  const isCutoffMet = (show: any): boolean => {
   if (!show.quality_profile_id || show.downloaded_count === 0) return true;
   const profile = qualityProfiles.find((p: any) => p.id === show.quality_profile_id);
   if (!profile || !profile.cutoff_quality) return true;
   
   // Use the series quality if available
   if (show.quality) {
    const currentRank = getQualityRank(show.quality);
    const cutoffRank = getQualityRank(profile.cutoff_quality);
    return currentRank >= cutoffRank;
   }
   return true;
  };
  
  return series.filter(show => {
   const matchesSearch = show.title.toLowerCase().includes(searchTerm.toLowerCase());
   const hasAllEpisodes = show.downloaded_count === show.episode_count && show.episode_count > 0;
   
   let matchesFilter = true;
   if (filter === 'all') {
    matchesFilter = true;
   } else if (filter === 'monitored') {
    matchesFilter = show.monitored;
   } else if (filter === 'unmonitored') {
    matchesFilter = !show.monitored;
   } else if (filter === 'missing') {
    matchesFilter = !hasAllEpisodes;
   } else if (filter === 'wanted') {
    matchesFilter = show.monitored && !hasAllEpisodes;
   } else if (filter === 'downloaded') {
    matchesFilter = hasAllEpisodes;
   } else if (filter === 'cutoff_unmet') {
    matchesFilter = show.downloaded_count > 0 && !isCutoffMet(show);
   } else if (filter.startsWith('custom_')) {
    // Custom filter
    const customFilter = customFilters.find(f => f.id === filter);
    if (customFilter) {
     const { conditions } = customFilter;
     if (conditions.monitored !== undefined && show.monitored !== conditions.monitored) matchesFilter = false;
     if (conditions.hasFile !== undefined) {
      const hasFiles = hasAllEpisodes;
      if (hasFiles !== conditions.hasFile) matchesFilter = false;
     }
     if (conditions.cutoffMet !== undefined) {
      // Only check cutoff for series with downloaded episodes
      if (show.downloaded_count === 0) {
       matchesFilter = false; // Series without downloads don't match cutoff conditions
      } else {
       const cutoffStatus = isCutoffMet(show);
       if (cutoffStatus !== conditions.cutoffMet) matchesFilter = false;
      }
     }
     if (conditions.qualityProfileId && show.quality_profile_id !== conditions.qualityProfileId) matchesFilter = false;
     if (conditions.minYear && show.year < conditions.minYear) matchesFilter = false;
     if (conditions.maxYear && show.year > conditions.maxYear) matchesFilter = false;
    }
   }
   
   return matchesSearch && matchesFilter;
  });
 }, [series, searchTerm, filter, customFilters, qualityProfiles]);

 // Get unique first letters for A-Z index
 const availableLetters = useMemo(() => {
  const letters = new Set<string>();
  filteredSeries.forEach(show => {
   const firstChar = show.title.charAt(0).toUpperCase();
   const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
   letters.add(letter);
  });
  return Array.from(letters).sort((a, b) => {
   if (a === '#') return -1;
   if (b === '#') return 1;
   return a.localeCompare(b);
  });
 }, [filteredSeries]);

 // Find first series for each letter
 const firstSeriesByLetter = useMemo(() => {
  const map: Record<string, string> = {};
  filteredSeries.forEach(show => {
   const firstChar = show.title.charAt(0).toUpperCase();
   const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
   if (!map[letter]) {
    map[letter] = show.id;
   }
  });
  return map;
 }, [filteredSeries]);

 // Scroll tracking for A-Z index
 useEffect(() => {
  const handleScroll = () => {
   const scrollPos = window.scrollY + 200;
   let currentLetter: string | null = null;
   
   for (const letter of availableLetters) {
    const seriesId = firstSeriesByLetter[letter];
    if (seriesId) {
     const element = seriesRefs.current[seriesId];
     if (element && element.offsetTop <= scrollPos) {
      currentLetter = letter;
     }
    }
   }
   setActiveLetter(currentLetter);
  };
  
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
 }, [availableLetters, firstSeriesByLetter]);

 const scrollToLetter = useCallback((letter: string) => {
  const seriesId = firstSeriesByLetter[letter];
  if (seriesId) {
   // Find the index of this series in filteredSeries
   const seriesIndex = filteredSeries.findIndex(s => s.id === seriesId);
   if (seriesIndex >= 0) {
    // Ensure we've loaded enough items to include this series
    if (seriesIndex >= visibleCount) {
     setVisibleCount(seriesIndex + LOAD_MORE_COUNT);
     // Wait for render then scroll
     setTimeout(() => {
      const element = seriesRefs.current[seriesId];
      if (element) {
       element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
     }, 50);
    } else {
     // Already loaded, scroll immediately
     const element = seriesRefs.current[seriesId];
     if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
     }
    }
   }
  }
 }, [firstSeriesByLetter, filteredSeries, visibleCount]);

 // Reset visible count when filter changes
 useEffect(() => {
  setVisibleCount(INITIAL_RENDER_COUNT);
 }, [filter, searchTerm]);

 // Infinite scroll - load more when reaching bottom
 useEffect(() => {
  const observer = new IntersectionObserver(
   (entries) => {
    if (entries[0].isIntersecting && visibleCount < filteredSeries.length) {
     setVisibleCount(prev => Math.min(prev + LOAD_MORE_COUNT, filteredSeries.length));
    }
   },
   { threshold: 0.1, rootMargin: '200px' }
  );

  if (loadMoreRef.current) {
   observer.observe(loadMoreRef.current);
  }

  return () => observer.disconnect();
 }, [visibleCount, filteredSeries.length]);

 // Visible series for rendering (windowed)
 const visibleSeries = useMemo(() => {
  return filteredSeries.slice(0, visibleCount);
 }, [filteredSeries, visibleCount]);

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
  if (selectedIds.size === filteredSeries.length) {
   setSelectedIds(new Set());
  } else {
   setSelectedIds(new Set(filteredSeries.map(s => s.id)));
  }
 };

 const handleBulkMonitor = async () => {
  if (selectedIds.size === 0) return;
  try {
   const ids = Array.from(selectedIds);
   await api.bulkUpdateSeries(ids, { monitored: true });
   setSeries(prev => prev.map(s => selectedIds.has(s.id) ? { ...s, monitored: true } : s));
   addToast({ type: 'success', message: `Monitored ${selectedIds.size} series` });
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
   await api.bulkUpdateSeries(ids, { monitored: false });
   setSeries(prev => prev.map(s => selectedIds.has(s.id) ? { ...s, monitored: false } : s));
   addToast({ type: 'success', message: `Unmonitored ${selectedIds.size} series` });
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
   const result = await api.bulkSearchSeries(ids);
   addToast({ 
    type: 'success', 
    message: `Search complete: ${result.totalFound} episodes found across ${result.seriesSearched} series` 
   });
   setSelectedIds(new Set());
   setSelectMode(false);
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to search series' });
  } finally {
   setSearchingSelected(false);
  }
 };

 const handleBulkSetProfile = async (profileId: string) => {
  if (selectedIds.size === 0) return;
  setSettingProfile(true);
  try {
   const ids = Array.from(selectedIds);
   await api.bulkUpdateSeries(ids, { quality_profile_id: profileId });
   
   const profileName = qualityProfiles.find(p => p.id === profileId)?.name || 'profile';
   addToast({ 
    type: 'success',
    message: `Set ${ids.length} series to ${profileName}`
   });
   
   setSelectedIds(new Set());
   setSelectMode(false);
   loadSeries();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to set profile' });
  } finally {
   setSettingProfile(false);
  }
 };

 const handleDelete = async (deleteFiles: boolean, addExclusion: boolean) => {
  setDeleting(true);
  try {
   if (deleteTargetId) {
    await api.deleteSeries(deleteTargetId, deleteFiles, addExclusion);
    addToast({ type: 'success', message: 'Series deleted successfully' });
   }
   loadSeries();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to delete series' });
  } finally {
   setDeleting(false);
   setShowDeleteModal(false);
   setDeleteTargetId(null);
  }
 };

 const handleBulkDelete = async () => {
  setDeleting(true);
  try {
   await api.bulkDeleteSeries(Array.from(selectedIds), deleteWithFiles);
   addToast({ type: 'success', message: `Deleted ${selectedIds.size} series` });
   setSelectedIds(new Set());
   setSelectMode(false);
   loadSeries();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to delete series' });
  } finally {
   setDeleting(false);
   setShowBulkDeleteModal(false);
   setDeleteWithFiles(false);
  }
 };

 const handleToggleMonitor = async (show: any, e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  try {
   await api.updateSeries(show.id, { monitored: !show.monitored });
   setSeries(prev => prev.map(s => s.id === show.id ? { ...s, monitored: !s.monitored } : s));
   addToast({ type: 'success', message: `${show.title} ${!show.monitored ? 'monitored' : 'unmonitored'}` });
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to update monitor status' });
  }
 };

 const openDeleteModal = (seriesId: string, e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setDeleteTargetId(seriesId);
  setShowDeleteModal(true);
 };

 const openBulkDeleteModal = () => {
  setShowBulkDeleteModal(true);
 };

 const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'monitored', label: 'Monitored Only' },
  { value: 'unmonitored', label: 'Unmonitored' },
  { value: 'missing', label: 'Missing' },
  { value: 'wanted', label: 'Wanted' },
  { value: 'downloaded', label: 'Complete' },
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
     <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>TV Series</h1>
     <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Browse and manage your media library</p>
    </div>

    {/* Smart Bar */}
    <SmartBar
     totalItems={filteredSeries.length}
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
     onSetProfile={handleBulkSetProfile}
     settingProfile={settingProfile}
     onRefresh={loadSeries}
     addLink="/discover?category=tv"
     addLabel="Add Series"
     importLink="/settings?tab=import"
    />

    {/* Content */}
    {filteredSeries.length === 0 ? (
     <div className="text-center py-12 " style={{ backgroundColor: 'var(--surface-bg)' }}>
      <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
       {searchTerm ? 'No series match your search' : 'No series in your library'}
      </p>
      <a
       href="/discover?category=tv"
       className="inline-block px-6 py-3 transition-colors"
       style={{ backgroundColor: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
      >
       Browse Series to Add
      </a>
     </div>
    ) : viewMode === 'poster' ? (
     /* Poster View - Continuous Grid */
     <div className={`grid ${posterConfig.grid} gap-4`}>
      {visibleSeries.map((show) => {
       const firstChar = show.title.charAt(0).toUpperCase();
       const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
       const isFirstOfLetter = firstSeriesByLetter[letter] === show.id;
       
       return (
        <div
         key={show.id}
         ref={el => seriesRefs.current[show.id] = el}
         data-letter={letter}
         className={`shadow hover:shadow-lg transition-shadow overflow-hidden group relative cursor-pointer ${
          selectMode && selectedIds.has(show.id) ? 'ring-2 ring-primary-500' : ''
         } ${isFirstOfLetter ? 'scroll-mt-32' : ''}`}
         style={{ backgroundColor: 'var(--surface-bg)' }}
         onClick={selectMode ? () => toggleSelect(show.id) : () => navigate(`/series/${show.id}`)}
        >
         {/* Selection checkbox */}
         {selectMode && (
          <div className="absolute top-2 right-2 z-10">
           <input
            type="checkbox"
            checked={selectedIds.has(show.id)}
            onChange={() => toggleSelect(show.id)}
            className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            onClick={(e) => e.stopPropagation()}
           />
          </div>
         )}

         <div className="relative aspect-[2/3]">
          {show.poster_path ? (
           <img
            src={getCachedImageUrl(show.poster_path, posterConfig.imgSize) || ''}
            alt={show.title}
            className="w-full h-full object-cover"
            loading="lazy"
           />
          ) : (
           <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--hover-bg)' }}>
            <span style={{ color: 'var(--text-muted)' }}>No Poster</span>
           </div>
          )}
          
          {/* Episode count badge */}
          <div className="absolute top-2 left-2">
           <span className={`px-2 py-1 text-white text-xs rounded ${
            show.downloaded_count === show.episode_count && show.episode_count > 0
             ? 'bg-green-500'
             : show.downloaded_count > 0
              ? 'bg-yellow-500'
              : 'bg-red-500'
           }`}>
            {show.downloaded_count || 0}/{show.episode_count || 0}
           </span>
          </div>

          {/* Hover action buttons */}
          {!selectMode && (
           <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
             onClick={(e) => handleToggleMonitor(show, e)}
             className={`p-2 rounded-full ${show.monitored ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-600'} text-white`}
             title={show.monitored ? 'Unmonitor' : 'Monitor'}
            >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {show.monitored ? (
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              ) : (
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              )}
             </svg>
            </button>
            <button
             onClick={(e) => openDeleteModal(show.id, e)}
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
          <h3 className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>{show.title}</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{show.year}</p>
         </div>
        </div>
       );
      })}
     </div>
    ) : (
     /* Table View */
     <div className="border overflow-hidden" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
      <div className="table-responsive">
      <table className="w-full">
       <thead style={{ backgroundColor: 'var(--table-header-bg)' }}>
        <tr>
         {selectMode && (
          <th className="px-3 py-2 w-10">
           <input
            type="checkbox"
            checked={selectedIds.size === filteredSeries.length && filteredSeries.length > 0}
            onChange={selectAll}
            className="w-4 h-4 rounded border-gray-300 text-primary-600"
           />
          </th>
         )}
         <th className="px-3 py-2 text-left text-xs font-medium uppercase" style={{ color: 'var(--text-secondary)' }}>Title</th>
         <th className="px-3 py-2 text-left text-xs font-medium uppercase w-16" style={{ color: 'var(--text-secondary)' }}>Year</th>
         <th className="px-3 py-2 text-left text-xs font-medium uppercase w-28" style={{ color: 'var(--text-secondary)' }}>Network</th>
         <th className="px-3 py-2 text-left text-xs font-medium uppercase w-24" style={{ color: 'var(--text-secondary)' }}>Episodes</th>
         <th className="px-3 py-2 text-left text-xs font-medium uppercase w-24" style={{ color: 'var(--text-secondary)' }}>Size</th>
         <th className="px-3 py-2 text-left text-xs font-medium uppercase w-24" style={{ color: 'var(--text-secondary)' }}>Monitored</th>
         <th className="px-3 py-2 text-right text-xs font-medium uppercase w-24" style={{ color: 'var(--text-secondary)' }}>Actions</th>
        </tr>
       </thead>
       <tbody>
        {visibleSeries.map((show) => (
         <tr
          key={show.id}
          onClick={() => selectMode ? toggleSelect(show.id) : navigate(`/series/${show.id}`)}
          className="cursor-pointer border-t transition-colors"
          style={{ 
           borderColor: 'var(--border-color)',
           backgroundColor: selectMode && selectedIds.has(show.id) ? 'var(--selected-bg)' : undefined
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--table-row-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectMode && selectedIds.has(show.id) ? 'var(--selected-bg)' : ''}
         >
          {selectMode && (
           <td className="px-3 py-2">
            <input
             type="checkbox"
             checked={selectedIds.has(show.id)}
             onChange={() => toggleSelect(show.id)}
             onClick={(e) => e.stopPropagation()}
             className="w-4 h-4 rounded border-gray-300 text-primary-600"
            />
           </td>
          )}
          <td className="px-3 py-2">
           <div className="flex items-center gap-3">
            <div className="w-8 h-12 overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--hover-bg)' }}>
             {show.poster_path && (
              <img src={getCachedImageUrl(show.poster_path, 'w92') || ''} alt="" className="w-full h-full object-cover" />
             )}
            </div>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{show.title}</span>
           </div>
          </td>
          <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{show.year}</td>
          <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{show.network || '-'}</td>
          <td className="px-3 py-2">
           <span className={`text-sm ${
            show.downloaded_count === show.episode_count && show.episode_count > 0
             ? 'text-green-600 dark:text-green-400' 
             : show.downloaded_count > 0
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-red-600 dark:text-red-400'
           }`}>
            {show.downloaded_count || 0}/{show.episode_count || 0}
           </span>
          </td>
          <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
           {show.total_size ? `${(show.total_size / (1024 * 1024 * 1024)).toFixed(2)} GB` : '-'}
          </td>
          <td className="px-3 py-2">
           <button
            onClick={(e) => handleToggleMonitor(show, e)}
            className={`px-2 py-1 text-xs rounded ${
             show.monitored ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}
           >
            {show.monitored ? 'Yes' : 'No'}
           </button>
          </td>
          <td className="px-3 py-2 text-right">
           <button
            onClick={(e) => openDeleteModal(show.id, e)}
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
   {visibleCount < filteredSeries.length && (
    <div 
     ref={loadMoreRef}
     className="flex justify-center py-8"
    >
     <div className="text-center">
      <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2" />
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
       Loading more... ({visibleCount} of {filteredSeries.length})
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
    title="Delete Series"
    itemName={series.find(s => s.id === deleteTargetId)?.title || 'this series'}
    hasFiles={true}
    showExclusionOption={true}
    isSeries={true}
   />

   {/* Bulk Delete Confirmation Modal */}
   <ConfirmModal
    isOpen={showBulkDeleteModal}
    title={`Delete ${selectedIds.size} series?`}
    message={
     <div className="space-y-4">
      <p>
       Are you sure you want to delete {selectedIds.size} series? This cannot be undone.
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
