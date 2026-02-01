import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { InteractiveSearchModal } from '../components/InteractiveSearchModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { PreviewRenameModal } from '../components/PreviewRenameModal';
import { EditSeriesModal } from '../components/EditSeriesModal';
import { useUISettings } from '../contexts/UISettingsContext';
import { useTimezone } from '../contexts/TimezoneContext';
import { useToast } from '../components/Toast';
import { api, getCachedImageUrl } from '../services/api';

interface Episode {
 id: string;
 episode_number: number;
 title: string;
 overview: string;
 air_date: string;
 runtime?: number;
 vote_average?: number;
 vote_count?: number;
 monitored: boolean;
 has_file: boolean;
 quality?: string;
 file_path?: string;
 file_size?: number;
 resolution?: string;
 video_codec?: string;
 audio_codec?: string;
 download_status?: string | null;
 download_progress?: number | null;
}

interface Season {
 id: string;
 season_number: number;
 monitored: boolean;
 episodes?: Episode[];
}

interface Series {
 id: string;
 tmdb_id: number;
 tvdb_id?: number;
 title: string;
 year: number;
 overview: string;
 network?: string;
 vote_average?: number;
 vote_count?: number;
 poster_path: string;
 backdrop_path: string;
 monitored: boolean;
 status?: string;
 folder_path?: string;
 quality_profile_id?: string;
 series_type?: string;
 use_season_folder?: boolean;
 monitor_new_seasons?: string;
 tags?: string[];
}

interface QualityProfile {
 id: string;
 name: string;
}

interface CastMember {
 id: number;
 name: string;
 character: string;
 profile_path: string | null;
 order: number;
}

export function SeriesDetailPageNew() {
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const { addToast } = useToast();
 const { settings, updateSettings } = useUISettings();
 const { formatDate, formatTime } = useTimezone();
 const [series, setSeries] = useState<Series | null>(null);
 const [seasons, setSeasons] = useState<Season[]>([]);
 const [profiles, setProfiles] = useState<QualityProfile[]>([]);
 const [activityLog, setActivityLog] = useState<any[]>([]);
 const [activityExpanded, setActivityExpanded] = useState(false);
 const [loading, setLoading] = useState(true);
 const [cast, setCast] = useState<CastMember[]>([]);
 const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());
 const [showSearchModal, setShowSearchModal] = useState(false);
 const [searchEpisode, setSearchEpisode] = useState<{ season: number; episode?: number } | null>(null);
 const [showDeleteModal, setShowDeleteModal] = useState(false);
 const [showRenameModal, setShowRenameModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [showColumnSettings, setShowColumnSettings] = useState(false);
 const [deleteEpisodeId, setDeleteEpisodeId] = useState<string | null>(null);
 const [deleteSeasonNumber, setDeleteSeasonNumber] = useState<number | null>(null);

 // Default columns if not set (only customizable columns stored here)
 // Non-customizable columns: # (number), Air Date, Title - always shown
 const episodeColumns = settings.episodeColumns || {
  filename: false,
  format: true,
  size: true,
 };

 const toggleColumn = (column: keyof typeof episodeColumns) => {
  updateSettings({
   episodeColumns: {
    ...episodeColumns,
    [column]: !episodeColumns[column]
   }
  });
 };

 useEffect(() => {
  if (id) {
   loadSeries();
   loadActivityLog();
  }
  loadProfiles();
 }, [id]);

 // Auto-refresh activity log every 10 seconds when expanded
 useEffect(() => {
  if (!id || !activityExpanded) return;
  const interval = setInterval(loadActivityLog, 10000);
  return () => clearInterval(interval);
 }, [id, activityExpanded]);

 const loadProfiles = async () => {
  try {
   const data = await api.getQualityProfiles();
   setProfiles(data);
  } catch (error) {
   console.error('Failed to load profiles:', error);
  }
 };

 const getProfileName = (profileId?: string) => {
  const profile = profiles.find(p => p.id === profileId);
  return profile?.name || 'Unknown';
 };

 const loadActivityLog = async () => {
  try {
   const data = await api.getSeriesActivity(id!, 50);
   setActivityLog(data);
  } catch (error) {
   console.error('Failed to load activity log:', error);
  }
 };

 const loadSeries = async () => {
  try {
   const [seriesData, seasonsData] = await Promise.all([
    api.getSeriesById(id!),
    api.getSeasons(id!)
   ]);
   setSeries(seriesData);

   // Load episodes for each season
   const seasonsWithEpisodes = await Promise.all(
    seasonsData.map(async (season: Season) => {
     const episodes = await api.getEpisodes(id!, season.season_number);
     return { ...season, episodes };
    })
   );
   setSeasons(seasonsWithEpisodes);

   // Load cast if we have tmdb_id
   if (seriesData?.tmdb_id) {
    loadCast(seriesData.tmdb_id);
   }
  } catch (error) {
   console.error('Failed to load series:', error);
  } finally {
   setLoading(false);
  }
 };

 const loadCast = async (tmdbId: number) => {
  try {
   const details = await api.getTVDetails(tmdbId);
   if (details?.credits?.cast) {
    // Get top 12 cast members
    setCast(details.credits.cast.slice(0, 12));
   }
  } catch (error) {
   console.error('Failed to load cast:', error);
  }
 };

 const toggleSeason = (seasonNumber: number) => {
  const newExpanded = new Set(expandedSeasons);
  if (newExpanded.has(seasonNumber)) {
   newExpanded.delete(seasonNumber);
  } else {
   newExpanded.add(seasonNumber);
  }
  setExpandedSeasons(newExpanded);
 };

 const toggleSeriesMonitor = async () => {
  if (!series) return;
  try {
   const newMonitored = !series.monitored;
   await api.updateSeries(id!, { monitored: newMonitored });
   setSeries({ ...series, monitored: newMonitored });
   // Update all seasons and episodes in frontend state to match
   setSeasons(seasons.map(s => ({
    ...s,
    monitored: newMonitored,
    episodes: s.episodes?.map(e => ({ ...e, monitored: newMonitored }))
   })));
  } catch (error) {
   console.error('Failed to update series:', error);
  }
 };

 const toggleSeasonMonitor = async (season: Season, e: React.MouseEvent) => {
  e.stopPropagation();
  try {
   const newMonitored = !season.monitored;
   await api.updateSeason(id!, season.season_number, { monitored: newMonitored });
   // Update season and all its episodes in frontend state
   setSeasons(seasons.map(s => 
    s.season_number === season.season_number 
     ? { 
       ...s, 
       monitored: newMonitored,
       episodes: s.episodes?.map(e => ({ ...e, monitored: newMonitored }))
      }
     : s
   ));
  } catch (error) {
   console.error('Failed to update season:', error);
  }
 };

 const toggleEpisodeMonitor = async (episode: Episode) => {
  try {
   await api.updateEpisode(episode.id, { monitored: !episode.monitored });
   setSeasons(seasons.map(s => ({
    ...s,
    episodes: s.episodes?.map(e => 
     e.id === episode.id ? { ...e, monitored: !e.monitored } : e
    )
   })));
  } catch (error) {
   console.error('Failed to update episode:', error);
  }
 };

 const handleDelete = async (deleteFiles: boolean, addExclusion: boolean) => {
  try {
   await api.deleteSeries(id!, deleteFiles, addExclusion);
   navigate('/series');
  } catch (error) {
   console.error('Failed to delete series:', error);
  }
 };

 const [scanning, setScanning] = useState(false);
 const handleScan = async () => {
  if (!id) return;
  setScanning(true);
  try {
   const result = await api.scanSeries(id);
   if (result.matched > 0) {
    addToast({ type: 'success', message: `Matched ${result.matched} of ${result.total} file(s)` });
   } else if (result.total > 0) {
    addToast({ type: 'warning', message: `Found ${result.total} files but could not match to episodes` });
   } else {
    addToast({ type: 'warning', message: 'No video files found in folder' });
   }
   // Reload series data
   loadSeries();
  } catch (error) {
   console.error('Failed to scan series:', error);
   addToast({ type: 'error', message: 'Failed to scan series folder' });
  } finally {
   setScanning(false);
  }
 };

 const [importing, setImporting] = useState(false);
 const handleManualImport = async () => {
  if (!id) return;
  setImporting(true);
  try {
   const result = await api.manualImportSeries(id);
   
   const { imported, skipped, unmatched } = result.results;
   
   // Build detailed message
   const parts: string[] = [];
   if (imported.length > 0) {
    parts.push(`${imported.length} imported`);
   }
   if (skipped.length > 0) {
    parts.push(`${skipped.length} already have files`);
   }
   if (unmatched.length > 0) {
    // Count different unmatched reasons
    const notParsed = unmatched.filter((u: any) => u.reason.includes('Could not parse')).length;
    const notInDb = unmatched.filter((u: any) => u.reason.includes('not found in database')).length;
    if (notParsed > 0) parts.push(`${notParsed} couldn't parse`);
    if (notInDb > 0) parts.push(`${notInDb} episodes not in DB`);
   }
   
   if (imported.length > 0) {
    addToast({ 
     type: 'success', 
     message: `Import complete: ${parts.join(', ')}` 
    });
   } else if (skipped.length > 0 && unmatched.length === 0) {
    addToast({ 
     type: 'info', 
     message: `All ${skipped.length} file(s) already imported` 
    });
   } else if (unmatched.length > 0) {
    addToast({ 
     type: 'warning', 
     message: `No files imported: ${parts.join(', ')}. Check logs for details.` 
    });
   } else {
    addToast({ type: 'info', message: 'No video files found to import' });
   }
   
   // Log detailed results to console for debugging
   console.log('[ManualImport] Results:', result);
   
   // Reload series data
   loadSeries();
  } catch (error: any) {
   console.error('Failed to import:', error);
   addToast({ type: 'error', message: error.response?.data?.error || 'Failed to import files' });
  } finally {
   setImporting(false);
  }
 };

 const handleDeleteEpisodeFile = async () => {
  if (!deleteEpisodeId) return;
  try {
   await api.deleteEpisodeFile(deleteEpisodeId);
   addToast({ type: 'success', message: 'Episode file deleted successfully' });
   // Reload series data to update UI
   loadSeries();
  } catch (error: any) {
   console.error('Failed to delete episode file:', error);
   addToast({ type: 'error', message: error?.response?.data?.error || 'Failed to delete episode file' });
  } finally {
   setDeleteEpisodeId(null);
  }
 };

 const handleDeleteSeasonFiles = async () => {
  if (deleteSeasonNumber === null) return;
  try {
   const result = await api.deleteSeasonFiles(id!, deleteSeasonNumber);
   addToast({ type: 'success', message: `Deleted ${result.deleted || 'all'} files from Season ${deleteSeasonNumber}` });
   // Reload series data to update UI
   loadSeries();
  } catch (error: any) {
   console.error('Failed to delete season files:', error);
   addToast({ type: 'error', message: error?.response?.data?.error || 'Failed to delete season files' });
  } finally {
   setDeleteSeasonNumber(null);
  }
 };

 const getSeasonStats = (season: Season) => {
  const episodes = season.episodes || [];
  const total = episodes.length;
  const downloaded = episodes.filter(e => e.has_file).length;
  // Sum actual file sizes (in bytes), convert to GB for display
  const totalBytes = episodes.reduce((acc, e) => acc + (e.file_size || 0), 0);
  const totalSize = totalBytes / (1024 * 1024 * 1024); // Convert to GB
  return { total, downloaded, totalSize };
 };

 const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
 };

 const openEpisodeSearch = (seasonNumber: number, episodeNumber: number) => {
  setSearchEpisode({ season: seasonNumber, episode: episodeNumber });
  setShowSearchModal(true);
 };

 const openSeasonSearch = (seasonNumber: number) => {
  setSearchEpisode({ season: seasonNumber });
  setShowSearchModal(true);
 };

 if (loading) {
  return (
   <Layout>
    <div className="flex items-center justify-center h-64">
     <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--theme-primary)' }}></div>
    </div>
   </Layout>
  );
 }

 if (!series) {
  return (
   <Layout>
    <div className="text-center py-12">
     <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Series not found</h2>
     <button onClick={() => navigate('/series')} className="mt-4 text-primary-500 hover:underline">
      Back to TV Shows
     </button>
    </div>
   </Layout>
  );
 }

 return (
  <Layout>
   <div className="space-y-6">
    {/* Hero Section - Full Width */}
    <div className="relative overflow-hidden bg-gray-900 -mx-4 sm:-mx-6 lg:-mx-8 -mt-6" style={{ marginLeft: 'calc(-50vw + 50%)', width: '100vw' }}>
     {series.backdrop_path && (
      <div className="absolute inset-0">
       <img
        src={getCachedImageUrl(series.backdrop_path, 'w1280') || ''}
        alt=""
        className="w-full h-full object-cover opacity-30"
       />
       <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/80 to-transparent"></div>
      </div>
     )}

     <div className="relative flex gap-8 p-8 pr-12 lg:pr-20 max-w-[1800px] mx-auto">
      <div className="flex-shrink-0">
       {series.poster_path ? (
        <img
         src={getCachedImageUrl(series.poster_path, 'w300') || ''}
         alt={series.title}
         className="w-48 h-72 object-cover shadow-2xl"
        />
       ) : (
        <div className="w-48 h-72 bg-gray-800 flex items-center justify-center">
         <svg className="w-16 h-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
         </svg>
        </div>
       )}
      </div>

      <div className="flex-1 min-w-0 text-white">
       <div className="flex items-center gap-3 mb-2">
        <button 
         onClick={toggleSeriesMonitor}
         className={series.monitored ? 'text-primary-400 hover:text-primary-300' : 'text-gray-500 hover:text-gray-400'}
         title={series.monitored ? 'Click to unmonitor' : 'Click to monitor'}
        >
         <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
         </svg>
        </button>
        <h1 className="text-4xl font-bold">{series.title}</h1>
       </div>

       <div className="flex items-center gap-4 text-sm text-gray-300 mb-4">
        <span>45 Minutes</span>
        <span className="flex items-center gap-1 text-red-400">
         <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
         </svg>
         71%
        </span>
        <span>Drama</span>
        <span>{series.year}-</span>
       </div>

       {/* Ratings */}
       <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/80 rounded">
         <span className="text-xs font-medium text-green-400">TMDB</span>
         <span className="text-sm">{series.vote_average ? series.vote_average.toFixed(1) : '--'}</span>
        </div>
        {series.vote_count !== undefined && series.vote_count > 0 && (
         <span className="px-2 py-1 bg-gray-700/80 rounded text-xs">
          {series.vote_count.toLocaleString()} votes
         </span>
        )}
       </div>

       {/* Meta badges */}
       <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${series.monitored ? 'bg-green-600/80' : 'bg-gray-700/80'}`}>
         <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
         </svg>
         {series.monitored ? 'Monitored' : 'Unmonitored'}
        </span>
        <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${series.status === 'Ended' ? 'bg-gray-600/80' : 'bg-green-600/80'}`}>
         <span className={`w-2 h-2 rounded-full ${series.status === 'Ended' ? 'bg-gray-300' : 'bg-green-300'}`}></span>
         {series.status || 'Continuing'}
        </span>
        <span className="px-2 py-1 bg-blue-600/80 rounded text-xs">{getProfileName(series.quality_profile_id)}</span>
        <span className="px-2 py-1 bg-gray-700/80 rounded text-xs">English</span>
        {series.network && (
         <span className="px-2 py-1 bg-gray-700/80 rounded text-xs">{series.network}</span>
        )}
       </div>

       {/* Path */}
       <div className="mb-4">
        <div className="text-xs text-gray-400 mb-1">Path</div>
        <div className="text-sm font-mono text-gray-300 break-all">{series.folder_path || '/data/media/tv/' + series.title}</div>
       </div>

       {/* Overview */}
       <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Overview</h3>
        <p className="text-gray-300 leading-relaxed">{series.overview}</p>
       </div>

       {/* Cast - Inside Hero */}
       {(settings.showCast ?? true) && cast.length > 0 && (
        <div className="mb-8 group/cast">
         <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Cast</h3>
         <div className="relative">
          {/* Left scroll button - overlayed, hidden until hover */}
          {cast.length >= 9 && (
           <button
            onClick={() => {
             const container = document.getElementById('series-cast-scroll');
             if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
            }}
            className="absolute left-0 top-0 bottom-6 w-10 bg-gradient-to-r from-black/80 to-transparent text-white flex items-center justify-start pl-1 z-10 opacity-0 group-hover/cast:opacity-100 transition-opacity duration-200"
           >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
           </button>
          )}

          <div id="series-cast-scroll" className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
           {cast.map((member) => (
            <div key={member.id} className="flex-shrink-0 w-[135px] text-center">
             <div className="w-[105px] h-[105px] mx-auto overflow-hidden bg-gray-700 rounded-full">
              {member.profile_path ? (
               <img
                src={`https://image.tmdb.org/t/p/w185${member.profile_path}`}
                alt={member.name}
                className="w-full h-full object-cover"
               />
              ) : (
               <div className="w-full h-full flex items-center justify-center text-gray-500">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
               </div>
              )}
             </div>
             <p className="mt-2 text-sm font-medium text-white leading-tight" style={{ wordBreak: 'break-word' }}>
              {member.character}
             </p>
             <p className="text-xs text-gray-400 leading-tight mt-0.5">
              {member.name}
             </p>
            </div>
           ))}
          </div>

          {/* Right scroll button - overlayed, hidden until hover */}
          {cast.length >= 9 && (
           <button
            onClick={() => {
             const container = document.getElementById('series-cast-scroll');
             if (container) container.scrollBy({ left: 300, behavior: 'smooth' });
            }}
            className="absolute right-0 top-0 bottom-6 w-10 bg-gradient-to-l from-black/80 to-transparent text-white flex items-center justify-end pr-1 z-10 opacity-0 group-hover/cast:opacity-100 transition-opacity duration-200"
           >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
           </button>
          )}
         </div>
        </div>
       )}

       <div className="absolute bottom-4 right-4 text-xs text-gray-500">
        Metadata is provided by TMDB
       </div>
      </div>
     </div>
    </div>

    {/* Toolbar - Below hero, above seasons */}
    <div className="flex items-center gap-1 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2">
     <button 
      onClick={handleScan}
      disabled={scanning}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>{scanning ? 'Scanning...' : 'Refresh & Scan'}</span>
     </button>

     <button 
      onClick={() => setShowSearchModal(true)}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span>Search Releases</span>
     </button>

     <button 
      onClick={handleManualImport}
      disabled={importing}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
      title="Scan series folder and import any missing episode files"
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      <span>{importing ? 'Importing...' : 'Manual Import'}</span>
     </button>

     <button 
      onClick={() => setShowRenameModal(true)}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
      <span>Preview Rename</span>
     </button>

     <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2"></div>

     <button 
      onClick={() => setShowEditModal(true)}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
      <span>Edit</span>
     </button>

     <button 
      onClick={() => setShowDeleteModal(true)}
      className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      <span>Delete</span>
     </button>
    </div>

    {/* Seasons */}
    <div className="space-y-4">
     {seasons
      .filter(s => s.season_number >= 0)
      .sort((a, b) => {
       // Specials (season 0) always last
       if (a.season_number === 0) return 1;
       if (b.season_number === 0) return -1;
       // Otherwise, sort by season number descending (latest first)
       return b.season_number - a.season_number;
      })
      .map((season) => {
      const stats = getSeasonStats(season);
      const isExpanded = expandedSeasons.has(season.season_number);

      return (
       <div key={season.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Season Header */}
        <button
         onClick={() => toggleSeason(season.season_number)}
         className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
         <div className="flex items-center gap-4">
          <button
           onClick={(e) => toggleSeasonMonitor(season, e)}
           className={`${season.monitored ? 'text-primary-500' : 'text-gray-400'}`}
          >
           <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
           </svg>
          </button>
          <span className="font-semibold text-gray-900 dark:text-white">
           {season.season_number === 0 ? 'Specials' : `Season ${season.season_number}`}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
           stats.downloaded === stats.total 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
          }`}>
           {stats.downloaded} / {stats.total}
          </span>
          {stats.totalSize > 0 && (
           <span className="text-sm text-gray-500 dark:text-gray-400">
            {stats.totalSize.toFixed(1)} GiB
           </span>
          )}
         </div>

         <div className="flex items-center gap-2">
          <button 
           onClick={(e) => {
            e.stopPropagation();
            openSeasonSearch(season.season_number);
           }}
           className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
           title="Search Season"
          >
           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
           </svg>
          </button>
          {stats.downloaded > 0 && (
           <button 
            onClick={(e) => {
             e.stopPropagation();
             setDeleteSeasonNumber(season.season_number);
            }}
            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
            title="Delete All Season Files"
           >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
           </button>
          )}
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
         </div>
        </button>

        {/* Episodes Table */}
        {isExpanded && season.episodes && season.episodes.length > 0 && (
         <div>
          {/* Column Settings - only show once per expanded season */}
          <div className="flex justify-end px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
           <div className="relative">
            <button
             onClick={() => setShowColumnSettings(!showColumnSettings)}
             className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>
             Columns
            </button>
            {showColumnSettings && (
             <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg z-10 py-2 min-w-[150px]">
              {[
               { key: 'filename', label: 'Filename' },
               { key: 'format', label: 'Quality' },
               { key: 'size', label: 'Size' },
              ].map(col => (
               <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                <input
                 type="checkbox"
                 checked={episodeColumns[col.key as keyof typeof episodeColumns]}
                 onChange={() => toggleColumn(col.key as keyof typeof episodeColumns)}
                 className="w-4 h-4 rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
               </label>
              ))}
             </div>
            )}
           </div>
          </div>
          <div className="table-responsive">
          <table className="w-full table-auto">
           <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
             <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">#</th>
             <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Air Date</th>
             <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
             {episodeColumns.filename && (
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filename</th>
             )}
             {episodeColumns.format && (
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Quality</th>
             )}
             {episodeColumns.size && (
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Size</th>
             )}
             <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"></th>
            </tr>
           </thead>
           <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {season.episodes.sort((a, b) => b.episode_number - a.episode_number).map((episode) => (
             <tr key={episode.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <td className="px-4 py-3">
               <div className="flex items-center gap-2">
                <button
                 onClick={() => toggleEpisodeMonitor(episode)}
                 className={`${episode.monitored ? 'text-primary-500' : 'text-gray-400'}`}
                >
                 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                 </svg>
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">{episode.episode_number}</span>
               </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
               {episode.air_date ? formatDate(episode.air_date) : 'TBA'}
              </td>
              <td className="px-4 py-3">
               <span className="text-sm text-gray-900 dark:text-white">{episode.title}</span>
               {episode.episode_number === season.episodes![0].episode_number && (
                <span className="ml-2 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
                 Season Finale
                </span>
               )}
              </td>
              {episodeColumns.filename && (
               <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={episode.file_path || ''}>
                {episode.has_file && episode.file_path ? episode.file_path.split('/').pop() : '-'}
               </td>
              )}
              {episodeColumns.format && (
               <td className="px-4 py-3">
                {episode.has_file ? (
                 <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded font-medium">
                  {episode.quality || 'Unknown'}
                 </span>
                ) : episode.download_status === 'downloading' ? (
                 <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded font-medium animate-pulse">
                  Downloading {Math.round(episode.download_progress || 0)}%
                 </span>
                ) : episode.download_status === 'importing' ? (
                 <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded font-medium animate-pulse">
                  Importing
                 </span>
                ) : episode.download_status === 'queued' ? (
                 <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded font-medium">
                  Queued
                 </span>
                ) : (
                 <span className="text-sm text-gray-400">Missing</span>
                )}
               </td>
              )}
              {episodeColumns.size && (
               <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {episode.has_file && episode.file_size ? formatFileSize(episode.file_size) : '-'}
               </td>
              )}
              <td className="px-4 py-3 text-right">
               <div className="flex items-center justify-end gap-1">
                <button
                 onClick={() => openEpisodeSearch(season.season_number, episode.episode_number)}
                 className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                 title="Search"
                >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                 </svg>
                </button>
                {episode.has_file && (
                 <button 
                  onClick={() => setDeleteEpisodeId(episode.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                  title="Delete File"
                 >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                 </svg>
                </button>
               )}
              </div>
             </td>
            </tr>
           ))}
          </tbody>
         </table></div>
        </div>
        )}

        {isExpanded && (!season.episodes || season.episodes.length === 0) && (
         <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
          No episodes found for this season
         </div>
        )}
       </div>
      );
     })}
    </div>
   </div>

   {/* Activity Log Section - Collapsible */}
   <div className="mt-6 bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
    <button
     onClick={() => setActivityExpanded(!activityExpanded)}
     className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
    >
     <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Activity</h2>
     <div className="flex items-center gap-2">
      {activityLog.length > 0 && (
       <span className="text-sm text-gray-500 dark:text-gray-400">{activityLog.length} events</span>
      )}
      <svg 
       className={`w-5 h-5 text-gray-500 transition-transform ${activityExpanded ? 'rotate-180' : ''}`} 
       fill="none" viewBox="0 0 24 24" stroke="currentColor"
      >
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
     </div>
    </button>
    {activityExpanded && (
     <>
      {activityLog.length > 0 ? (
       <div className="divide-y divide-gray-200 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-700">
        {activityLog.map((log) => {
         let details: any = null;
         try {
          if (log.details) details = JSON.parse(log.details);
         } catch (e) {}
         
         // Format date using timezone context
         const formattedDate = formatDate(log.created_at);
         const formattedTime = formatTime(log.created_at);

         let icon = null;
         let iconBgColor = 'bg-gray-100 dark:bg-gray-700';
         if (log.event_type === 'grabbed') {
          iconBgColor = 'bg-blue-100 dark:bg-blue-900/40';
          icon = <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
         } else if (log.event_type === 'downloaded') {
          iconBgColor = 'bg-yellow-100 dark:bg-yellow-900/40';
          icon = <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
         } else if (log.event_type === 'imported') {
          iconBgColor = 'bg-green-100 dark:bg-green-900/40';
          icon = <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
         } else if (log.event_type === 'added') {
          iconBgColor = 'bg-purple-100 dark:bg-purple-900/40';
          icon = <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;
         } else if (log.event_type === 'renamed') {
          iconBgColor = 'bg-orange-100 dark:bg-orange-900/40';
          icon = <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
         } else {
          icon = <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
         }

         return (
          <div key={log.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
           <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${iconBgColor} flex items-center justify-center`}>
             {icon}
            </div>
            <div className="flex-1 min-w-0">
             <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
               {log.event_label}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
               {formattedDate} at {formattedTime}
              </p>
             </div>
             <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {log.message}
             </p>
             {details && (
              <div className="mt-2 flex flex-wrap gap-2">
               {details.source && (
                <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded">
                 {details.source}
                </span>
               )}
               {details.quality && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">
                 {details.quality}
                </span>
               )}
               {details.size && (
                <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                 {details.size}
                </span>
               )}
               {details.indexer && (
                <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded">
                 {details.indexer}
                </span>
               )}
               {details.releaseGroup && (
                <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                 {details.releaseGroup}
                </span>
               )}
               {details.season !== undefined && (
                <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                 S{String(details.season).padStart(2, '0')}{details.episode !== undefined ? `E${String(details.episode).padStart(2, '0')}` : ''}
                </span>
               )}
              </div>
             )}
            </div>
           </div>
          </div>
         );
        })}
       </div>
      ) : (
       <div className="px-6 py-12 text-center border-t border-gray-200 dark:border-gray-700">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">No activity yet</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Activity will appear here when you search, download, or import files.</p>
       </div>
      )}
     </>
    )}
   </div>

   {/* Interactive Search Modal */}
   {series && showSearchModal && (
    <InteractiveSearchModal
     isOpen={showSearchModal}
     onClose={() => {
      setShowSearchModal(false);
      setSearchEpisode(null);
     }}
     mediaType="tv"
     mediaId={series.id}
     title={series.title}
     year={series.year}
     seasonNumber={searchEpisode?.season}
     episodeNumber={searchEpisode?.episode}
     qualityProfileId={series.quality_profile_id}
    />
   )}

   <DeleteConfirmModal
    isOpen={showDeleteModal}
    onClose={() => setShowDeleteModal(false)}
    onConfirm={handleDelete}
    title="Delete Series"
    itemName={series?.title || ''}
    hasFiles={!!series?.folder_path}
   />

   {/* Episode File Delete Modal */}
   {deleteEpisodeId && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="bg-white dark:bg-gray-800 w-full max-w-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
       <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Episode File</h3>
      </div>
      <div className="p-6">
       <p className="text-gray-600 dark:text-gray-300">
        Are you sure you want to delete this episode file? The file will be removed from disk.
       </p>
      </div>
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
       <button
        onClick={() => setDeleteEpisodeId(null)}
        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 "
       >
        Cancel
       </button>
       <button
        onClick={handleDeleteEpisodeFile}
        className="px-4 py-2 text-sm bg-red-500 text-white hover:bg-red-600"
       >
        Delete File
       </button>
      </div>
     </div>
    </div>
   )}

   {/* Season Files Delete Modal */}
   {deleteSeasonNumber !== null && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="bg-white dark:bg-gray-800 w-full max-w-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
       <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Season Files</h3>
      </div>
      <div className="p-6">
       <p className="text-gray-600 dark:text-gray-300">
        Are you sure you want to delete all files for {deleteSeasonNumber === 0 ? 'Specials' : `Season ${deleteSeasonNumber}`}? 
        All episode files will be removed from disk.
       </p>
      </div>
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
       <button
        onClick={() => setDeleteSeasonNumber(null)}
        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 "
       >
        Cancel
       </button>
       <button
        onClick={handleDeleteSeasonFiles}
        className="px-4 py-2 text-sm bg-red-500 text-white hover:bg-red-600"
       >
        Delete All Files
       </button>
      </div>
     </div>
    </div>
   )}

   {/* Preview Rename Modal */}
   {showRenameModal && series && (
    <PreviewRenameModal
     type="series"
     id={series.id}
     title={series.title}
     onClose={() => setShowRenameModal(false)}
     onComplete={() => loadSeries()}
    />
   )}

   {/* Edit Series Modal */}
   {showEditModal && series && (
    <EditSeriesModal
     key={`edit-series-${series.id}`}
     series={series}
     onClose={() => setShowEditModal(false)}
     onSave={async () => {
      await Promise.all([loadSeries(), loadActivityLog()]);
      setShowEditModal(false);
     }}
     onDelete={() => {
      setShowEditModal(false);
      setShowDeleteModal(true);
     }}
    />
   )}
  </Layout>
 );
}
