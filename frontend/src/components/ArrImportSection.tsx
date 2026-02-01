import { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { Button } from './common/Button';
import { Input } from './common/Input';

interface ArrMovie {
 id: number;
 title: string;
 year: number;
 tmdbId: number;
 imdbId?: string;
 overview?: string;
 path?: string;
 hasFile: boolean;
 monitored: boolean;
 posterUrl?: string;
 selected?: boolean;
}

interface ArrSeries {
 id: number;
 title: string;
 year: number;
 tvdbId: number;
 imdbId?: string;
 overview?: string;
 path?: string;
 monitored: boolean;
 posterUrl?: string;
 seasonCount?: number;
 episodeCount?: number;
 episodeFileCount?: number;
 sizeOnDisk?: number;
 selected?: boolean;
}

interface QualityProfile {
 id: string;
 name: string;
 media_type?: 'movie' | 'series' | 'both';
}

interface Props {
 onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function ArrImportSection({ onToast }: Props) {
 const [importSource, setImportSource] = useState<'radarr' | 'sonarr'>('radarr');
 const [url, setUrl] = useState('');
 const [apiKey, setApiKey] = useState('');
 const [connected, setConnected] = useState(false);
 const [connecting, setConnecting] = useState(false);
 const [version, setVersion] = useState<string | null>(null);
 
 const [movies, setMovies] = useState<ArrMovie[]>([]);
 const [series, setSeries] = useState<ArrSeries[]>([]);
 const [loading, setLoading] = useState(false);
 const [importing, setImporting] = useState(false);
 
 const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([]);
 const [selectedProfileId, setSelectedProfileId] = useState<string>('');
 const [minimumAvailability, setMinimumAvailability] = useState<string>('released');
 
 const [searchQuery, setSearchQuery] = useState('');
 const [filterHasFile, setFilterHasFile] = useState<'all' | 'yes' | 'no'>('all');
 const [filterMonitored, setFilterMonitored] = useState<'all' | 'yes' | 'no'>('all');
 const [hideInLibrary, setHideInLibrary] = useState(true);
 
 const [libraryTmdbIds, setLibraryTmdbIds] = useState<Set<number>>(new Set());
 const [libraryTvdbIds, setLibraryTvdbIds] = useState<Set<number>>(new Set());
 
 const [moviePath, setMoviePath] = useState('/data/movies');
 const [tvPath, setTvPath] = useState('/data/tv');
 
 const [currentPage, setCurrentPage] = useState(0);
 const ITEMS_PER_PAGE = 50;

 // Load MediaStack library to check for duplicates
 useEffect(() => {
  loadLibrary();
  loadQualityProfiles();
  loadSettings();
 }, []);

 // Reset when source changes
 useEffect(() => {
  setConnected(false);
  setMovies([]);
  setSeries([]);
  setVersion(null);
  setCurrentPage(0);
  loadQualityProfiles();
 }, [importSource]);

 const loadSettings = async () => {
  try {
   const settings = await api.getSettings();
   if (settings.movie_path) setMoviePath(settings.movie_path);
   if (settings.tv_path) setTvPath(settings.tv_path);
  } catch (error) {
   console.error('Failed to load settings:', error);
  }
 };

 const loadLibrary = async () => {
  try {
   const [moviesRes, seriesRes] = await Promise.all([
    api.getMovies(),
    api.getSeries()
   ]);
   
   const tmdbIds = new Set<number>(moviesRes.items.map((m: any) => m.tmdb_id));
   const tvdbIds = new Set<number>(seriesRes.items.map((s: any) => s.tvdb_id).filter(Boolean));
   
   setLibraryTmdbIds(tmdbIds);
   setLibraryTvdbIds(tvdbIds);
  } catch (error) {
   console.error('Failed to load library:', error);
  }
 };

 const loadQualityProfiles = async () => {
  try {
   const profiles = await api.getQualityProfiles();
   // Filter profiles by media type based on import source
   const targetType = importSource === 'radarr' ? 'movie' : 'series';
   const filteredProfiles = profiles.filter((p: QualityProfile) => 
    !p.media_type || p.media_type === 'both' || p.media_type === targetType
   );
   setQualityProfiles(filteredProfiles);
   if (filteredProfiles.length > 0 && !filteredProfiles.find((p: QualityProfile) => p.id === selectedProfileId)) {
    setSelectedProfileId(filteredProfiles[0].id);
   }
  } catch (error) {
   console.error('Failed to load quality profiles:', error);
  }
 };

 const handleConnect = async () => {
  if (!url || !apiKey) {
   onToast('Please enter URL and API key', 'error');
   return;
  }

  setConnecting(true);
  try {
   const result = importSource === 'radarr'
    ? await api.testRadarr(url, apiKey)
    : await api.testSonarr(url, apiKey);

   if (result.success) {
    setConnected(true);
    setVersion(result.version || null);
    onToast(`Connected to ${importSource === 'radarr' ? 'Radarr' : 'Sonarr'} ${result.version || ''}`, 'success');
    
    // Load items
    await loadItems();
   } else {
    onToast(result.error || 'Connection failed', 'error');
   }
  } catch (error: any) {
   onToast(error.message || 'Connection failed', 'error');
  } finally {
   setConnecting(false);
  }
 };

 const loadItems = async () => {
  setLoading(true);
  try {
   if (importSource === 'radarr') {
    const result = await api.getRadarrMovies(url, apiKey);
    setMovies(result.movies.map(m => ({ ...m, selected: false })));
    onToast(`Loaded ${result.total} movies from Radarr`, 'info');
   } else {
    const result = await api.getSonarrSeries(url, apiKey);
    setSeries(result.series.map(s => ({ ...s, selected: false })));
    onToast(`Loaded ${result.total} series from Sonarr`, 'info');
   }
  } catch (error: any) {
   onToast(error.message || 'Failed to load items', 'error');
  } finally {
   setLoading(false);
  }
 };

 const handleDisconnect = () => {
  setConnected(false);
  setMovies([]);
  setSeries([]);
  setVersion(null);
  setCurrentPage(0);
 };

 // Filter items based on search and filters
 const filteredMovies = useMemo(() => {
  return movies.filter(movie => {
   if (searchQuery && !movie.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
   if (filterHasFile === 'yes' && !movie.hasFile) return false;
   if (filterHasFile === 'no' && movie.hasFile) return false;
   if (filterMonitored === 'yes' && !movie.monitored) return false;
   if (filterMonitored === 'no' && movie.monitored) return false;
   if (hideInLibrary && libraryTmdbIds.has(movie.tmdbId)) return false;
   return true;
  });
 }, [movies, searchQuery, filterHasFile, filterMonitored, hideInLibrary, libraryTmdbIds]);

 const filteredSeries = useMemo(() => {
  return series.filter(s => {
   if (searchQuery && !s.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
   if (filterMonitored === 'yes' && !s.monitored) return false;
   if (filterMonitored === 'no' && s.monitored) return false;
   if (hideInLibrary && libraryTvdbIds.has(s.tvdbId)) return false;
   return true;
  });
 }, [series, searchQuery, filterMonitored, hideInLibrary, libraryTvdbIds]);

 const items = importSource === 'radarr' ? filteredMovies : filteredSeries;
 const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
 const paginatedItems = items.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

 const selectedCount = importSource === 'radarr'
  ? movies.filter(m => m.selected).length
  : series.filter(s => s.selected).length;

 const toggleSelect = (id: number) => {
  if (importSource === 'radarr') {
   setMovies(prev => prev.map(m => m.id === id ? { ...m, selected: !m.selected } : m));
  } else {
   setSeries(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
  }
 };

 const selectAll = () => {
  if (importSource === 'radarr') {
   const filteredIds = new Set(filteredMovies.map(m => m.id));
   setMovies(prev => prev.map(m => filteredIds.has(m.id) ? { ...m, selected: true } : m));
  } else {
   const filteredIds = new Set(filteredSeries.map(s => s.id));
   setSeries(prev => prev.map(s => filteredIds.has(s.id) ? { ...s, selected: true } : s));
  }
 };

 const deselectAll = () => {
  if (importSource === 'radarr') {
   setMovies(prev => prev.map(m => ({ ...m, selected: false })));
  } else {
   setSeries(prev => prev.map(s => ({ ...s, selected: false })));
  }
 };

 const handleImport = async () => {
  if (!selectedProfileId) {
   onToast('Please select a quality profile', 'error');
   return;
  }

  const selectedItems = importSource === 'radarr'
   ? movies.filter(m => m.selected)
   : series.filter(s => s.selected);

  if (selectedItems.length === 0) {
   onToast('No items selected', 'error');
   return;
  }

  // Helper to sanitize folder name
  const sanitizeFolderName = (name: string): string => {
   return name
    .replace(/[<>:"/\\|?*]/g, '') // Remove illegal characters
    .replace(/\s+/g, ' ')     // Normalize spaces
    .trim();
  };

  setImporting(true);
  let successCount = 0;
  let errorCount = 0;

  try {
   for (const item of selectedItems) {
    try {
     if (importSource === 'radarr') {
      const movie = item as ArrMovie;
      // Check if already in library
      if (libraryTmdbIds.has(movie.tmdbId)) {
       errorCount++;
       continue;
      }
      
      // Generate folder path
      const folderName = sanitizeFolderName(`${movie.title} (${movie.year})`);
      const folderPath = `${moviePath}/${folderName}`;
      
      // Add movie to library using TMDB ID
      await api.addMovie({
       tmdb_id: movie.tmdbId,
       title: movie.title,
       year: movie.year,
       folder_path: folderPath,
       quality_profile_id: selectedProfileId,
       minimum_availability: minimumAvailability,
       monitored: movie.monitored
      });
      
      // Update library set
      setLibraryTmdbIds(prev => new Set([...prev, movie.tmdbId]));
      successCount++;
     } else {
      const s = item as ArrSeries;
      // Check if already in library
      if (libraryTvdbIds.has(s.tvdbId)) {
       errorCount++;
       continue;
      }
      
      // Add series to library - need to search by TVDB ID first
      const searchResult = await api.searchTV(s.title);
      const matchingSeries = searchResult.results?.find((r: any) => 
       r.name?.toLowerCase() === s.title.toLowerCase() ||
       r.first_air_date?.startsWith(String(s.year))
      ) || searchResult.results?.[0];
      
      if (matchingSeries) {
       // Generate folder path
       const folderName = sanitizeFolderName(`${s.title} (${s.year})`);
       const folderPath = `${tvPath}/${folderName}`;
       
       await api.addSeries({
        tmdb_id: matchingSeries.id,
        title: s.title,
        year: s.year,
        folder_path: folderPath,
        quality_profile_id: selectedProfileId,
        monitored: s.monitored
       });
       
       setLibraryTvdbIds(prev => new Set([...prev, s.tvdbId]));
       successCount++;
      } else {
       errorCount++;
      }
     }
    } catch (error) {
     console.error('Failed to import item:', error);
     errorCount++;
    }
   }

   if (successCount > 0) {
    onToast(`Imported ${successCount} ${importSource === 'radarr' ? 'movies' : 'series'}`, 'success');
    // Deselect imported items
    if (importSource === 'radarr') {
     setMovies(prev => prev.map(m => m.selected ? { ...m, selected: false } : m));
    } else {
     setSeries(prev => prev.map(s => s.selected ? { ...s, selected: false } : s));
    }
   }
   if (errorCount > 0) {
    onToast(`${errorCount} items failed or already in library`, 'error');
   }
  } finally {
   setImporting(false);
   // Refresh library
   loadLibrary();
  }
 };

 return (
  <div className="space-y-6">
   {/* Header */}
   <div>
    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Import from Radarr/Sonarr</h2>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
     Import your existing library from Radarr or Sonarr
    </p>
   </div>

   {/* Source Selection */}
   <div className="flex items-center gap-4">
    <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 p-1">
     <button
      onClick={() => setImportSource('radarr')}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
       importSource === 'radarr'
        ? 'bg-primary-500 text-white'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
     >
      Radarr (Movies)
     </button>
     <button
      onClick={() => setImportSource('sonarr')}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
       importSource === 'sonarr'
        ? 'bg-primary-500 text-white'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
     >
      Sonarr (TV)
     </button>
    </div>
    
    {connected && version && (
     <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      Connected (v{version})
     </span>
    )}
   </div>

   {/* Connection Form */}
   {!connected && (
    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 space-y-4">
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {importSource === 'radarr' ? 'Radarr' : 'Sonarr'} URL
       </label>
       <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={`http://localhost:${importSource === 'radarr' ? '7878' : '8989'}`}
       />
       <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        e.g., http://192.168.1.100:{importSource === 'radarr' ? '7878' : '8989'}
       </p>
      </div>
      <div>
       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        API Key
       </label>
       <Input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Your API key"
       />
       <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Found in {importSource === 'radarr' ? 'Radarr' : 'Sonarr'} → Settings → General
       </p>
      </div>
     </div>
     <Button onClick={handleConnect} disabled={connecting || !url || !apiKey}>
      {connecting ? 'Connecting...' : 'Connect'}
     </Button>
    </div>
   )}

   {/* Connected View */}
   {connected && (
    <>
     {/* Toolbar */}
     <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex-1 min-w-[200px]">
       <Input
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
        placeholder="Search..."
       />
      </div>
      
      {importSource === 'radarr' && (
       <select
        value={filterHasFile}
        onChange={(e) => { setFilterHasFile(e.target.value as any); setCurrentPage(0); }}
        className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
       >
        <option value="all">All Files</option>
        <option value="yes">Has File</option>
        <option value="no">No File</option>
       </select>
      )}
      
      <select
       value={filterMonitored}
       onChange={(e) => { setFilterMonitored(e.target.value as any); setCurrentPage(0); }}
       className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
      >
       <option value="all">All Status</option>
       <option value="yes">Monitored</option>
       <option value="no">Unmonitored</option>
      </select>
      
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
       <input
        type="checkbox"
        checked={hideInLibrary}
        onChange={(e) => { setHideInLibrary(e.target.checked); setCurrentPage(0); }}
        className="rounded border-gray-300 dark:border-gray-600"
       />
       Hide already in library
      </label>
      
      <Button variant="secondary" onClick={handleDisconnect}>
       Disconnect
      </Button>
     </div>

     {/* Selection Bar */}
     <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
      <Button variant="secondary" onClick={selectAll} disabled={items.length === 0}>
       Select All ({items.length})
      </Button>
      <Button variant="secondary" onClick={deselectAll} disabled={selectedCount === 0}>
       Deselect All
      </Button>
      
      <div className="flex-1" />
      
      <span className="text-sm text-gray-600 dark:text-gray-400">
       {selectedCount} selected
      </span>
      
      <select
       value={selectedProfileId}
       onChange={(e) => setSelectedProfileId(e.target.value)}
       className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
      >
       <option value="">Select Profile...</option>
       {qualityProfiles.map(profile => (
        <option key={profile.id} value={profile.id}>{profile.name}</option>
       ))}
      </select>
      
      {importSource === 'radarr' && (
       <select
        value={minimumAvailability}
        onChange={(e) => setMinimumAvailability(e.target.value)}
        className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"
       >
        <option value="announced">Announced</option>
        <option value="inCinemas">In Cinemas</option>
        <option value="released">Released</option>
       </select>
      )}
      
      <Button 
       onClick={handleImport} 
       disabled={importing || selectedCount === 0 || !selectedProfileId}
      >
       {importing ? 'Importing...' : `Import (${selectedCount})`}
      </Button>
     </div>

     {/* Items List */}
     {loading ? (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
       <svg className="animate-spin h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
       </svg>
       Loading {importSource === 'radarr' ? 'movies' : 'series'}...
      </div>
     ) : items.length === 0 ? (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
       <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
       </svg>
       <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        No {importSource === 'radarr' ? 'movies' : 'series'} found
       </h3>
       <p className="text-gray-500 dark:text-gray-400">
        {hideInLibrary ? 'All items may already be in your library.' : 'No items match your filters.'}
       </p>
      </div>
     ) : (
      <>
       {/* Items Table */}
       <div className="table-responsive border border-gray-200 dark:border-gray-700">
        <table className="w-full">
         <thead>
          <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
           <th className="w-10 px-3 py-3"></th>
           <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Title</th>
           <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-20">Year</th>
           {importSource === 'radarr' && (
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-24">File</th>
           )}
           {importSource === 'sonarr' && (
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-32">Episodes</th>
           )}
           <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-24">Status</th>
           <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-32">In Library</th>
          </tr>
         </thead>
         <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {paginatedItems.map((item: any) => {
           const inLibrary = importSource === 'radarr'
            ? libraryTmdbIds.has(item.tmdbId)
            : libraryTvdbIds.has(item.tvdbId);
           
           return (
            <tr 
             key={item.id} 
             className={`transition-colors ${
              item.selected 
               ? 'bg-primary-50 dark:bg-primary-900/20' 
               : inLibrary 
                ? 'bg-green-50/50 dark:bg-green-900/10'
                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
             }`}
            >
             <td className="px-3 py-3">
              <input
               type="checkbox"
               checked={item.selected || false}
               onChange={() => toggleSelect(item.id)}
               disabled={inLibrary}
               className="rounded border-gray-300 dark:border-gray-600"
              />
             </td>
             <td className="px-3 py-3">
              <div className="flex items-center gap-3">
               {item.posterUrl ? (
                <img
                 src={item.posterUrl}
                 alt={item.title}
                 className="w-10 h-15 object-cover rounded flex-shrink-0"
                />
               ) : (
                <div className="w-10 h-15 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 flex items-center justify-center">
                 <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                 </svg>
                </div>
               )}
               <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.path}</p>
               </div>
              </div>
             </td>
             <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400">{item.year}</td>
             {importSource === 'radarr' && (
              <td className="px-3 py-3">
               {item.hasFile ? (
                <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                 Yes
                </span>
               ) : (
                <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                 No
                </span>
               )}
              </td>
             )}
             {importSource === 'sonarr' && (
              <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400">
               {item.episodeFileCount || 0}/{item.episodeCount || 0}
               <span className="text-xs text-gray-400 ml-1">
                ({item.seasonCount || 0} seasons)
               </span>
              </td>
             )}
             <td className="px-3 py-3">
              {item.monitored ? (
               <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                Monitored
               </span>
              ) : (
               <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                Unmonitored
               </span>
              )}
             </td>
             <td className="px-3 py-3">
              {inLibrary ? (
               <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                ✓ In Library
               </span>
              ) : (
               <span className="text-xs text-gray-400">-</span>
              )}
             </td>
            </tr>
           );
          })}
         </tbody>
        </table>
       </div>

       {/* Pagination */}
       {totalPages > 1 && (
        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-4 py-3">
         <span className="text-sm text-gray-600 dark:text-gray-400">
          Showing {currentPage * ITEMS_PER_PAGE + 1}-{Math.min((currentPage + 1) * ITEMS_PER_PAGE, items.length)} of {items.length}
         </span>
         <div className="flex items-center gap-2">
          <Button
           variant="secondary"
           onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
           disabled={currentPage === 0}
          >
           Previous
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
           Page {currentPage + 1} of {totalPages}
          </span>
          <Button
           variant="secondary"
           onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
           disabled={currentPage >= totalPages - 1}
          >
           Next
          </Button>
         </div>
        </div>
       )}
      </>
     )}
    </>
   )}
  </div>
 );
}
