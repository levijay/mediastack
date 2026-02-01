import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { InteractiveSearchModal } from '../components/InteractiveSearchModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { PreviewRenameModal } from '../components/PreviewRenameModal';
import { EditMovieModal } from '../components/EditMovieModal';
import { EditSeriesModal } from '../components/EditSeriesModal';
import { AddToLibraryModal } from '../components/AddToLibraryModal';
import { FixMatchModal } from '../components/FixMatchModal';
import { ManualImportModal } from '../components/ManualImportModal';
import { useToast } from '../components/Toast';
import { useTimezone } from '../contexts/TimezoneContext';
import { useUISettings } from '../contexts/UISettingsContext';
import { api, getCachedImageUrl } from '../services/api';

interface CastMember {
 id: number;
 name: string;
 character: string;
 profile_path: string | null;
 order: number;
}

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
 video_codec?: string;
 audio_codec?: string;
}

interface Season {
 id: string;
 season_number: number;
 monitored: boolean;
 episodes?: Episode[];
}

export function MediaDetailPage() {
 const { id } = useParams<{ id: string }>();
 const location = useLocation();
 const navigate = useNavigate();
 const { addToast } = useToast();
 const { formatDate, formatTime } = useTimezone();
 const { settings: uiSettings } = useUISettings();

 const isFromDiscover = location.pathname.startsWith('/discover/');
 const mediaType: 'movie' | 'tv' = location.pathname.includes('/movie') ? 'movie' : 'tv';
 const tmdbId = isFromDiscover ? parseInt(id || '0') : null;

 const [media, setMedia] = useState<any>(null);
 const [tmdbDetails, setTmdbDetails] = useState<any>(null);
 const [cast, setCast] = useState<CastMember[]>([]);
 const [similar, setSimilar] = useState<any[]>([]);
 const [relatedInLibrary, setRelatedInLibrary] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 const [inLibrary, setInLibrary] = useState(false);
 const [libraryId, setLibraryId] = useState<string | null>(null);
 const [movieFiles, setMovieFiles] = useState<any[]>([]);
 const [seasons, setSeasons] = useState<Season[]>([]);
 const [tmdbSeasons, setTmdbSeasons] = useState<any[]>([]);
 const [activityLog, setActivityLog] = useState<any[]>([]);
 const [qualityProfileName, setQualityProfileName] = useState<string | null>(null);

 const [activeTab, setActiveTab] = useState<'files' | 'history'>('files');
 const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());
 const [showSearchModal, setShowSearchModal] = useState(false);
 const [searchEpisode, setSearchEpisode] = useState<{ season: number; episode: number } | null>(null);
 const [showDeleteModal, setShowDeleteModal] = useState(false);
 const [showRenameModal, setShowRenameModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [showAddModal, setShowAddModal] = useState(false);
 const [showFixMatchModal, setShowFixMatchModal] = useState(false);
 const [showManualImportModal, setShowManualImportModal] = useState(false);
 const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
 const [deleteEpisodeInfo, setDeleteEpisodeInfo] = useState<{ id: string; title: string; seasonId: string } | null>(null);
 const [scanning, setScanning] = useState(false);

 useEffect(() => {
  // Set loading immediately to prevent flash of stale content
  setLoading(true);
  
  // Reset state when navigating to a different item
  setMedia(null);
  setTmdbDetails(null);
  setCast([]);
  setSimilar([]);
  setRelatedInLibrary([]);
  setSeasons([]);
  setTmdbSeasons([]);
  setMovieFiles([]);
  setActivityLog([]);
  setInLibrary(false);
  setLibraryId(null);
  setQualityProfileName(null);
  setActiveTab('files');
  setExpandedSeasons(new Set());
  
  // Load data after state reset
  loadData();
 }, [id, isFromDiscover, mediaType]);

 useEffect(() => {
  if (activeTab !== 'history' || !libraryId) return;
  const interval = setInterval(loadActivity, 10000);
  return () => clearInterval(interval);
 }, [activeTab, libraryId]);

 const loadData = async () => {
  setLoading(true);
  try {
   if (isFromDiscover && tmdbId) {
    await loadFromTMDB(tmdbId);
   } else if (id) {
    await loadFromLibrary(id);
   }
  } catch (error) {
   console.error('Failed to load media:', error);
  } finally {
   setLoading(false);
  }
 };

 const loadFromTMDB = async (tmdbId: number) => {
  try {
   const details = mediaType === 'movie' 
    ? await api.getMovieDetails(tmdbId)
    : await api.getTVDetails(tmdbId);
   
   setTmdbDetails(details);
   setMedia({
    tmdb_id: tmdbId,
    title: details.title || details.name,
    year: details.release_date ? new Date(details.release_date).getFullYear() 
        : details.first_air_date ? new Date(details.first_air_date).getFullYear() : null,
    overview: details.overview,
    runtime: details.runtime || details.episode_run_time?.[0],
    vote_average: details.vote_average,
    vote_count: details.vote_count,
    poster_path: details.poster_path,
    backdrop_path: details.backdrop_path,
    genres: details.genres,
    status: details.status,
    network: details.networks?.[0]?.name,
    origin_country: details.origin_country?.[0] || details.production_countries?.[0]?.iso_3166_1,
   });

   if (details.credits) {
    setCast(details.credits.cast?.slice(0, 12) || []);
   }

   // For TV shows, fetch season details from TMDB
   if (mediaType === 'tv' && details.seasons) {
    const seasonsWithEpisodes = await Promise.all(
     details.seasons
      .filter((s: any) => s.season_number > 0) // Skip specials
      .map(async (season: any) => {
       try {
        const seasonDetails = await api.getSeasonDetails(tmdbId, season.season_number);
        return {
         ...season,
         episodes: seasonDetails.episodes || []
        };
       } catch {
        return { ...season, episodes: [] };
       }
      })
    );
    setTmdbSeasons(seasonsWithEpisodes);
   }

   const similarData = mediaType === 'movie'
    ? await api.getSimilarMovies(tmdbId)
    : await api.getSimilarTV(tmdbId);
   setSimilar(similarData?.results?.slice(0, 10) || []);

   await checkLibraryStatus(tmdbId);
  } catch (error) {
   console.error('Failed to load TMDB data:', error);
  }
 };

 const loadFromLibrary = async (libraryId: string) => {
  try {
   const data = mediaType === 'movie'
    ? await api.getMovieById(libraryId)
    : await api.getSeriesById(libraryId);
   
   setMedia(data);
   setInLibrary(true);
   setLibraryId(libraryId);

   // Fetch quality profile name
   if (data.quality_profile_id) {
    try {
     const profiles = await api.getQualityProfiles();
     const profile = profiles.find((p: any) => p.id === data.quality_profile_id);
     if (profile) setQualityProfileName(profile.name);
    } catch (e) { /* ignore */ }
   }

   // Fetch custom related media from our library (based on cast, crew, collection, genres)
   try {
    const relatedData = mediaType === 'movie'
     ? await api.getRelatedMovies(libraryId, 10)
     : await api.getRelatedSeries(libraryId, 10);
    setRelatedInLibrary(relatedData?.related || []);
   } catch (e) {
    console.warn('Failed to load related media:', e);
   }

   if (data.tmdb_id) {
    const details = mediaType === 'movie'
     ? await api.getMovieDetails(data.tmdb_id)
     : await api.getTVDetails(data.tmdb_id);
    setTmdbDetails(details);
    
    if (details?.credits) {
     setCast(details.credits.cast?.slice(0, 12) || []);
    }

    // Still load TMDB similar as fallback if no related items in library
    const similarData = mediaType === 'movie'
     ? await api.getSimilarMovies(data.tmdb_id)
     : await api.getSimilarTV(data.tmdb_id);
    setSimilar(similarData?.results?.slice(0, 10) || []);
   }

   if (mediaType === 'movie') {
    const files = await api.getMovieFiles(libraryId);
    setMovieFiles(files);
   } else {
    const seasonsData = await api.getSeasons(libraryId);
    const seasonsWithEpisodes = await Promise.all(
     seasonsData.map(async (season: Season) => {
      const episodes = await api.getEpisodes(libraryId, season.season_number);
      return { ...season, episodes };
     })
    );
    setSeasons(seasonsWithEpisodes);
   }

   await loadActivity(libraryId);
  } catch (error) {
   console.error('Failed to load library data:', error);
  }
 };

 const checkLibraryStatus = async (tmdbId: number) => {
  try {
   if (mediaType === 'movie') {
    const movies = await api.getMovies();
    const found = movies.items.find((m: any) => m.tmdb_id === tmdbId);
    if (found) { setInLibrary(true); setLibraryId(found.id); }
   } else {
    const series = await api.getSeries();
    const found = series.items.find((s: any) => s.tmdb_id === tmdbId);
    if (found) { setInLibrary(true); setLibraryId(found.id); }
   }
  } catch (error) {
   console.error('Failed to check library status:', error);
  }
 };

 const loadActivity = async (activityLibraryId?: string) => {
  const libId = activityLibraryId || libraryId;
  if (!libId) return;
  try {
   const data = mediaType === 'movie'
    ? await api.getMovieActivity(libId, 20)
    : await api.getSeriesActivity(libId, 50);
   setActivityLog(data);
  } catch (error) {
   console.error('Failed to load activity:', error);
  }
 };

 const formatRuntime = (minutes?: number) => {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
 };

 const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'N/A';
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
 };

 // Helper to safely parse language arrays that could be: array, JSON string, comma-separated string, or null
 const parseLanguages = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
   // Try JSON parse first
   try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    // If it parsed to a string, fall through to comma handling
    if (typeof parsed === 'string') {
     value = parsed;
    } else {
     return [String(value)];
    }
   } catch {
    // Not JSON, continue with comma-separated handling
   }
   // Handle comma-separated strings like "English, Spanish, French"
   if (value.includes(',')) {
    return value.split(',').map((s: string) => s.trim()).filter((s: string) => s);
   }
   return [value]; // Plain string like "English"
  }
  return [];
 };

 const handleSearch = () => {
  setSearchEpisode(null); // Clear episode search when doing full search
  setShowSearchModal(true);
 };

 const handleScan = async () => {
  if (!libraryId) return;
  setScanning(true);
  try {
   // First refresh metadata from TMDB (cast, crew, genres, collection, certification)
   try {
    if (mediaType === 'movie') {
     await api.refreshMovieMetadata(libraryId);
    } else {
     await api.refreshSeriesMetadata(libraryId);
    }
   } catch (e) {
    console.warn('Failed to refresh metadata:', e);
   }

   // Then scan for files
   const result = mediaType === 'movie' ? await api.scanMovie(libraryId) : await api.scanSeries(libraryId);
   if (result.found > 0 || result.matched > 0) {
    addToast({ type: 'success', message: `Refreshed metadata and found ${result.found || result.matched} file(s)` });
   } else {
    addToast({ type: 'success', message: 'Metadata refreshed' });
   }
   loadData();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to refresh' });
  } finally {
   setScanning(false);
  }
 };

 const handleDelete = async (deleteFiles: boolean, addExclusion: boolean) => {
  if (!libraryId) return;
  try {
   if (mediaType === 'movie') {
    await api.deleteMovie(libraryId, deleteFiles, addExclusion);
    navigate('/movies');
   } else {
    await api.deleteSeries(libraryId, deleteFiles, addExclusion);
    navigate('/series');
   }
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to delete' });
  }
 };

 const handleAddSuccess = (newLibraryId: string) => {
  setInLibrary(true);
  setLibraryId(newLibraryId);
  addToast({ type: 'success', message: `Added to library` });
  navigate(`/${mediaType === 'movie' ? 'movies' : 'series'}/${newLibraryId}`);
 };

 const toggleSeason = (seasonNumber: number) => {
  const newExpanded = new Set(expandedSeasons);
  if (newExpanded.has(seasonNumber)) newExpanded.delete(seasonNumber);
  else newExpanded.add(seasonNumber);
  setExpandedSeasons(newExpanded);
 };

 const getRatingPercentage = () => media?.vote_average ? Math.round(media.vote_average * 10) : 0;

 if (loading) {
  return (
   <Layout>
    <div className="flex items-center justify-center h-64">
     <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--navbar-bg)' }}></div>
    </div>
   </Layout>
  );
 }

 if (!media) {
  return (
   <Layout>
    <div className="text-center py-12">
     <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Not found</h2>
     <button onClick={() => navigate(-1)} className="mt-4 hover:underline" style={{ color: 'var(--navbar-bg)' }}>Go back</button>
    </div>
   </Layout>
  );
 }

 const ratingPct = getRatingPercentage();

 return (
  <Layout>
   <div className="-mx-6 -mt-6">
    {/* Backdrop with blur and heavy fade */}
    <div className="relative h-32 md:h-52 lg:h-60 overflow-hidden">
     {media.backdrop_path ? (
      <img src={getCachedImageUrl(media.backdrop_path, 'w1280') || ''} alt="" className="absolute inset-0 w-full h-full object-cover blur-[2px] scale-105" />
     ) : (
      <div className="absolute inset-0 w-full h-full bg-gray-800"></div>
     )}
     <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/80"></div>
     <div className="absolute inset-0 bg-black/20"></div>
     
     {/* Title overlay - desktop only */}
     <div className="hidden md:block absolute bottom-0 left-0 right-0 px-6 pb-4 pl-56 lg:pl-64">
      <div className="flex items-start gap-3 mb-2">
       {inLibrary && (
        <button 
         onClick={async () => {
          try {
           const newMonitored = !media.monitored;
           if (mediaType === 'movie') {
            await api.updateMovie(libraryId!, { monitored: newMonitored });
           } else {
            await api.updateSeries(libraryId!, { monitored: newMonitored });
            // Also update all seasons and episodes in local state
            setSeasons(prev => prev.map(s => ({
             ...s,
             monitored: newMonitored,
             episodes: s.episodes?.map(e => ({ ...e, monitored: newMonitored }))
            })));
           }
           setMedia((prev: any) => prev ? { ...prev, monitored: newMonitored } : prev);
           addToast({ type: 'success', message: newMonitored ? 'Now monitoring' : 'Unmonitored' });
          } catch (e) {
           addToast({ type: 'error', message: 'Failed to update' });
          }
         }}
         className="mt-2 flex-shrink-0"
         title={media.monitored ? 'Click to unmonitor' : 'Click to monitor'}
        >
         <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" style={{ color: media.monitored ? 'var(--navbar-bg)' : 'var(--text-muted)' }}>
          <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" />
         </svg>
        </button>
       )}
       <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-2">
        <h1 className="text-3xl lg:text-4xl font-bold drop-shadow-lg" style={{ color: '#ffffff' }}>{media.title}</h1>
        {media.year && <span className="text-lg lg:text-xl" style={{ color: 'rgba(255,255,255,0.7)' }}>({media.year})</span>}
       </div>
      </div>
      <div className="flex items-center gap-3 text-sm mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
       {tmdbDetails?.certification && (
        <span className="px-1.5 py-0.5 rounded text-xs font-medium border border-white/50">{tmdbDetails.certification}</span>
       )}
       {media.runtime && <span>{formatRuntime(media.runtime)}</span>}
       {mediaType === 'tv' && media.season_count && <span>{media.season_count} Season{media.season_count !== 1 ? 's' : ''}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
       {mediaType === 'tv' && media.status && (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
         media.status === 'Continuing' || media.status === 'Returning Series' ? 'bg-green-500/80' :
         media.status === 'Ended' ? 'bg-red-500/80' :
         media.status === 'Canceled' ? 'bg-orange-500/80' : 'bg-gray-500/80'
        }`} style={{ color: '#ffffff' }}>
         {media.status}
        </span>
       )}
       {tmdbDetails?.original_language && (
        <span className="px-2 py-0.5 rounded text-xs bg-gray-600/80" style={{ color: '#ffffff' }}>
         {tmdbDetails.original_language === 'en' ? 'English' : tmdbDetails.original_language.toUpperCase()}
        </span>
       )}
       {tmdbDetails?.genres?.slice(0, 4).map((g: any) => (
        <span key={g.id} className="px-2 py-0.5 rounded text-xs bg-gray-600/80" style={{ color: '#ffffff' }}>{g.name}</span>
       ))}
      </div>
      {inLibrary && (
       <div className="flex flex-wrap items-center gap-2 mt-2">
        {mediaType === 'movie' && media.minimum_availability && (
         <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/80" style={{ color: '#ffffff' }}>
          {media.minimum_availability === 'announced' ? 'Announced' : 
           media.minimum_availability === 'inCinemas' ? 'In Cinemas' :
           media.minimum_availability === 'released' ? 'Released' :
           media.minimum_availability === 'preDB' ? 'PreDB' : media.minimum_availability}
         </span>
        )}
        {qualityProfileName && (
         <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-500/80" style={{ color: '#ffffff' }}>
          {qualityProfileName}
         </span>
        )}
        {mediaType === 'movie' && (
         media.has_file ? (
          <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/80" style={{ color: '#ffffff' }}>Downloaded</span>
         ) : (
          <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/80" style={{ color: '#ffffff' }}>Missing</span>
         )
        )}
       </div>
      )}
     </div>
    </div>

    {/* Main Layout: Left Sidebar + Content */}
    <div className="relative px-4 md:px-6" style={{ backgroundColor: 'var(--background)' }}>
     <div className="flex flex-col md:flex-row gap-4 md:gap-6">
      {/* Left Sidebar: Poster, Rating, Cast - hidden on mobile */}
      <div className="hidden md:block w-44 lg:w-52 flex-shrink-0 -mt-32 lg:-mt-36 z-10 space-y-4">
       {/* Poster */}
       {media.poster_path ? (
        <img src={getCachedImageUrl(media.poster_path, 'w342') || ''} alt={media.title}
         className="w-full rounded-lg shadow-2xl" />
       ) : (
        <div className="w-full aspect-[2/3] bg-gray-700 rounded-lg flex items-center justify-center">
         <svg className="w-12 h-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
         </svg>
        </div>
       )}

       {/* Rating Badges - Compact horizontal layout */}
       <div className="space-y-2">
        {/* TMDB Rating */}
        <div className="flex items-center gap-3 bg-[#01b4e4] rounded-lg px-3 py-2">
         <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg" alt="TMDB" className="w-8 h-8 flex-shrink-0" />
         <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold text-white">{ratingPct}%</span>
          {media.vote_count && (
           <span className="text-xs text-white/80">{media.vote_count.toLocaleString()} votes</span>
          )}
         </div>
        </div>
        
        {/* IMDB Rating (if available) */}
        {tmdbDetails?.imdb_rating && (
         <div className="flex items-center gap-3 bg-[#f5c518] rounded-lg px-3 py-2">
          <svg className="w-12 h-6 flex-shrink-0" viewBox="0 0 575.6 289.6" fill="#000">
           <path d="M25.6 0h523.5c14.1 0 25.6 11.5 25.6 25.6v238.4c0 14.1-11.5 25.6-25.6 25.6H25.6C11.5 289.6 0 278.1 0 264V25.6C0 11.5 11.5 0 25.6 0z"/>
           <path fill="#f5c518" d="M69.5 58.1h36.1v173.4H69.5z"/>
           <path fill="#f5c518" d="M201.6 58.1h-50.1l-5.8 67.2-8.9-67.2h-47.3v173.4h32.2V119.6l14.3 111.9h27.1l13.6-114.1v114h24.9V58.1z"/>
           <path fill="#f5c518" d="M290.3 97.3c-2.7-11.7-8.4-21.9-25.2-21.9h-40.6v173.4h40.6c16.7 0 22.4-10.2 25.2-21.9 2.7-11.7 3.2-29.2 3.2-64.8s-.5-53.1-3.2-64.8zm-29.7 106.9c0 14.3-.6 21.9-2.3 24.2-1.7 2.2-4 3.3-6.8 3.3h-2.6V93.1h2.6c2.8 0 5.1 1.1 6.8 3.3 1.7 2.2 2.3 9.9 2.3 24.2v83.6z"/>
           <path fill="#f5c518" d="M404.2 109.6c-4.6-25.5-15.9-34.2-42.7-34.2-33.9 0-44.3 14.2-44.3 59.3v66.3c0 41.9 8.9 56.2 42.7 56.2 33.9 0 44.3-14.2 44.3-59.3v-22.6h-35v26.1c0 16.9-.7 25.5-9.3 25.5s-8.7-8.7-8.7-25.5v-75.6c0-16.9.2-25.5 8.7-25.5 8.5 0 9.2 8.7 9.2 25.5v10.9h35.1v-27.1z"/>
         </svg>
          <div className="flex items-baseline gap-1.5">
           <span className="text-xl font-bold text-black">{tmdbDetails.imdb_rating.toFixed(1)}</span>
           {tmdbDetails.imdb_votes && (
            <span className="text-xs text-black/70">{tmdbDetails.imdb_votes} votes</span>
           )}
          </div>
         </div>
        )}
       </div>

       {/* Add to Library - only if NOT in library */}
       {!inLibrary && (
        <button onClick={() => setShowAddModal(true)}
         className="w-full py-2.5 px-4 rounded-lg text-sm font-medium"
         style={{ backgroundColor: 'var(--navbar-bg)', color: 'var(--navbar-text)' }}>
         + Add to Library
        </button>
       )}

       {/* Cast Card */}
       {(uiSettings.showCast ?? true) && cast.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--card-bg)' }}>
         <div className="px-3 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Cast</h3>
          <button 
           onClick={() => navigate(`/${mediaType}/${media.tmdb_id}/cast-crew`)}
           className="text-xs font-medium" 
           style={{ color: 'var(--navbar-bg)' }}
          >
           Show all →
          </button>
         </div>
         <div className="p-2 space-y-2">
          {cast.slice(0, 8).map(member => (
           <div 
            key={member.id} 
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-1 -m-1 transition-colors"
            onClick={() => navigate(`/person/${member.id}`)}
           >
            {member.profile_path ? (
             <img src={getCachedImageUrl(member.profile_path, 'w92') || ''} alt={member.name}
              className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
            ) : (
             <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{member.name.charAt(0)}</span>
             </div>
            )}
            <div className="min-w-0 flex-1">
             <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{member.name}</p>
             <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{member.character}</p>
            </div>
           </div>
          ))}
         </div>
        </div>
       )}
      </div>

      {/* Mobile-only: Poster with title beside it, button under poster */}
      <div className="md:hidden -mt-12 z-10 space-y-3">
       {/* Poster + Metadata row */}
       <div className="flex gap-3">
        {/* Poster column */}
        <div className="w-28 flex-shrink-0 space-y-2">
         {media.poster_path ? (
          <img src={getCachedImageUrl(media.poster_path, 'w185') || ''} alt={media.title}
           className="w-full rounded-lg shadow-xl" />
         ) : (
          <div className="w-full aspect-[2/3] bg-gray-700 rounded-lg flex items-center justify-center">
           <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
           </svg>
          </div>
         )}
         
         {/* Add to Library - under poster */}
         {!inLibrary && (
          <button onClick={() => setShowAddModal(true)}
           className="w-full py-2 px-2 rounded text-xs font-medium"
           style={{ backgroundColor: 'var(--navbar-bg)', color: 'var(--navbar-text)' }}>
           + Add to Library
          </button>
         )}
        </div>
        
        {/* Metadata beside poster */}
        <div className="flex-1 space-y-2">
         {/* Title + Year + Monitor */}
         <div className="flex items-start gap-2">
          {inLibrary && (
           <button 
            onClick={async () => {
             try {
              const newMonitored = !media.monitored;
              if (mediaType === 'movie') {
               await api.updateMovie(libraryId!, { monitored: newMonitored });
              } else {
               await api.updateSeries(libraryId!, { monitored: newMonitored });
               setSeasons(prev => prev.map(s => ({
                ...s,
                monitored: newMonitored,
                episodes: s.episodes?.map(e => ({ ...e, monitored: newMonitored }))
               })));
              }
              setMedia((prev: any) => prev ? { ...prev, monitored: newMonitored } : prev);
              addToast({ type: 'success', message: newMonitored ? 'Now monitoring' : 'Unmonitored' });
             } catch (e) {
              addToast({ type: 'error', message: 'Failed to update' });
             }
            }}
            className="flex-shrink-0 mt-0.5"
            title={media.monitored ? 'Click to unmonitor' : 'Click to monitor'}
           >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: media.monitored ? 'var(--navbar-bg)' : 'var(--text-muted)' }}>
             <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" />
            </svg>
           </button>
          )}
          <div>
           <h1 className="text-lg font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{media.title}</h1>
           {media.year && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>({media.year})</span>}
          </div>
         </div>

         {/* Certification + Runtime */}
         <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {tmdbDetails?.certification && (
           <span className="px-1.5 py-0.5 rounded text-xs font-medium border" style={{ borderColor: 'var(--border-color)' }}>{tmdbDetails.certification}</span>
          )}
          {media.runtime && <span>{formatRuntime(media.runtime)}</span>}
          {mediaType === 'tv' && media.season_count && <span>{media.season_count} Season{media.season_count !== 1 ? 's' : ''}</span>}
         </div>

         {/* Genres */}
         <div className="flex flex-wrap gap-1.5">
          {tmdbDetails?.genres?.slice(0, 3).map((g: any) => (
           <span key={g.id} className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-secondary)' }}>{g.name}</span>
          ))}
         </div>

         {/* Library badges */}
         {inLibrary && (
          <div className="flex flex-wrap gap-1.5">
           {qualityProfileName && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/80 text-white">{qualityProfileName}</span>
           )}
           {mediaType === 'movie' && (
            media.has_file ? (
             <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/80 text-white">Downloaded</span>
            ) : (
             <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/80 text-white">Missing</span>
            )
           )}
           {mediaType === 'tv' && media.status && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
             media.status === 'Continuing' || media.status === 'Returning Series' ? 'bg-green-500/80' :
             media.status === 'Ended' ? 'bg-red-500/80' : 'bg-gray-500/80'
            } text-white`}>
             {media.status}
            </span>
           )}
          </div>
         )}

         {/* TMDB Rating */}
         <div className="flex items-center gap-2 bg-[#01b4e4] rounded px-2 py-1 w-fit">
          <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg" alt="TMDB" className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-bold text-white">{ratingPct}%</span>
          {media.vote_count && (
           <span className="text-xs text-white/80">{media.vote_count.toLocaleString()}</span>
          )}
         </div>
        </div>
       </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 pt-3 md:pt-4 pb-6">
       {/* Synopsis */}
       <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: 'var(--card-bg)' }}>
        {tmdbDetails?.tagline && (
         <p className="text-sm italic mb-3" style={{ color: 'var(--text-muted)' }}>"{tmdbDetails.tagline}"</p>
        )}
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Synopsis</h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{media.overview || 'No synopsis available.'}</p>
       </div>

       {/* Discover TV Seasons (non-library) */}
       {!inLibrary && mediaType === 'tv' && tmdbSeasons.length > 0 && (
        <div className="rounded-lg overflow-hidden mb-4" style={{ backgroundColor: 'var(--card-bg)' }}>
         <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Seasons & Episodes</h3>
         </div>
         <div className="p-4">
          <div className="space-y-2">
           {tmdbSeasons.sort((a, b) => b.season_number - a.season_number).map(season => (
            <div key={season.id} className="border rounded" style={{ borderColor: 'var(--border-color)' }}>
             <button onClick={() => toggleSeason(season.season_number)} className="w-full px-4 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--surface-bg)' }}>
              <div className="flex items-center gap-3">
               <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Season {season.season_number}</span>
               <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{season.episode_count || season.episodes?.length || 0} episodes</span>
              </div>
              <svg className={`w-5 h-5 transition-transform ${expandedSeasons.has(season.season_number) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-secondary)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
             </button>
             {expandedSeasons.has(season.season_number) && season.episodes && (
              <div className="border-t" style={{ borderColor: 'var(--border-color)' }}>
               {/* Episode column headers */}
               <div className="px-3 md:px-4 py-1.5 flex items-center gap-2 md:gap-3 border-b text-xs font-medium" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)', backgroundColor: 'var(--card-bg)' }}>
                <span className="w-6 md:w-8 text-center flex-shrink-0">#</span>
                <span className="w-16 md:w-24 flex-shrink-0">Air Date</span>
                <span className="flex-1">Title</span>
                <span className="hidden md:block w-12 flex-shrink-0 text-right">Runtime</span>
                <span className="hidden md:block w-12 flex-shrink-0 text-right">Rating</span>
               </div>
               {[...season.episodes].sort((a: any, b: any) => {
                if (!a.air_date && !b.air_date) return b.episode_number - a.episode_number;
                if (!a.air_date) return 1;
                if (!b.air_date) return -1;
                const dateA = new Date(a.air_date).getTime();
                const dateB = new Date(b.air_date).getTime();
                // If same date, sort by episode number descending
                if (dateA === dateB) return b.episode_number - a.episode_number;
                return dateB - dateA;
               }).map((ep: any) => (
                <div key={ep.id} className="px-3 md:px-4 py-2 flex items-center gap-2 md:gap-3 border-b last:border-b-0" style={{ borderColor: 'var(--border-color)' }}>
                 <span className="w-6 md:w-8 text-center text-sm flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{ep.episode_number}</span>
                 <span className="w-16 md:w-24 text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{ep.air_date ? formatDate(ep.air_date) : '—'}</span>
                 <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{ep.name}</span>
                 <span className="hidden md:block w-12 text-xs flex-shrink-0 text-right" style={{ color: 'var(--text-muted)' }}>{ep.runtime ? `${ep.runtime}m` : '—'}</span>
                 <span className="hidden md:flex w-12 text-xs flex-shrink-0 text-right items-center justify-end gap-0.5" style={{ color: 'var(--text-muted)' }}>
                  {ep.vote_average > 0 ? <><span style={{ color: '#f5c518' }}>★</span>{ep.vote_average.toFixed(1)}</> : '—'}
                 </span>
                </div>
               ))}
              </div>
             )}
            </div>
           ))}
          </div>
         </div>
        </div>
       )}

       {/* Files/History Section */}
       {inLibrary && (
        <div className="rounded-lg overflow-hidden mb-4" style={{ backgroundColor: 'var(--card-bg)' }}>
         {/* Smartbar */}
         <div className="px-3 md:px-4 py-2 md:py-2.5 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-1.5 md:gap-2">
           <button onClick={handleSearch} className="px-2 md:px-3 py-1.5 text-sm font-medium rounded flex items-center gap-1.5"
            style={{ backgroundColor: 'var(--navbar-bg)', color: 'var(--navbar-text)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <span className="hidden sm:inline">Search</span>
           </button>
           <button onClick={() => setShowManualImportModal(true)} className="px-2 md:px-3 py-1.5 text-sm font-medium rounded flex items-center gap-1.5 border"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            title="Manual Import">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <span className="hidden sm:inline">Import</span>
           </button>
           {mediaType === 'movie' && (
            <button onClick={() => setShowFixMatchModal(true)} className="px-2 md:px-3 py-1.5 text-sm font-medium rounded flex items-center gap-1.5 border"
             style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
             <span className="hidden sm:inline">Fix Match</span>
            </button>
           )}
           <button onClick={handleScan} disabled={scanning} className="px-2 md:px-3 py-1.5 text-sm font-medium rounded flex items-center gap-1.5 border"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <svg className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            <span className="hidden sm:inline">Refresh</span>
           </button>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
           {(movieFiles.length > 0 || seasons.some(s => s.episodes?.some(e => e.has_file))) && (
            <button onClick={() => setShowRenameModal(true)} className="px-2 md:px-3 py-1.5 text-sm font-medium rounded flex items-center gap-1.5 border"
             style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
             <span className="hidden sm:inline">Rename</span>
            </button>
           )}
           <button onClick={() => setShowEditModal(true)} className="px-2 md:px-3 py-1.5 text-sm font-medium rounded flex items-center gap-1.5 border"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <span className="hidden sm:inline">Edit</span>
            <svg className="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
           </button>
           <button onClick={() => setShowDeleteModal(true)} className="px-2 md:px-3 py-1.5 text-sm font-medium rounded flex items-center gap-1.5 text-red-500 border border-red-300">
            <span className="hidden sm:inline">Delete</span>
            <svg className="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
           </button>
          </div>
         </div>

         {/* Tabs */}
         <div className="border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex">
           <button onClick={() => setActiveTab('files')}
            className="px-6 py-3 text-sm font-medium border-b-2"
            style={{ color: activeTab === 'files' ? 'var(--navbar-bg)' : 'var(--text-secondary)', borderColor: activeTab === 'files' ? 'var(--navbar-bg)' : 'transparent' }}>
            {mediaType === 'movie' ? 'Files' : 'Seasons & Episodes'}
           </button>
           <button onClick={() => setActiveTab('history')}
            className="px-6 py-3 text-sm font-medium border-b-2"
            style={{ color: activeTab === 'history' ? 'var(--navbar-bg)' : 'var(--text-secondary)', borderColor: activeTab === 'history' ? 'var(--navbar-bg)' : 'transparent' }}>
            History
           </button>
          </div>
         </div>

         {/* Tab Content */}
         <div className="p-4">
          {activeTab === 'files' && mediaType === 'movie' && (
           movieFiles.length > 0 ? (
            <div className="table-responsive">
            <table className="w-full text-sm">
             <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
               <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Filename</th>
               <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Info</th>
               <th className="text-center py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Size</th>
               <th className="w-10"></th>
              </tr>
             </thead>
             <tbody>
              {movieFiles.map((file: any) => (
               <tr key={file.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-color)' }}>
                <td className="py-3 px-3">
                 <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{file.path?.split('/').pop() || file.relative_path || 'Unknown'}</span>
                </td>
                <td className="py-3 px-3">
                 <div className="flex flex-wrap justify-center gap-1">
                  {file.quality && <span className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: 'var(--navbar-bg)', color: 'var(--navbar-text)' }}>{file.quality}</span>}
                  {file.video_codec && <span className="px-2 py-0.5 text-xs rounded bg-blue-900/30 text-blue-400">{file.video_codec}</span>}
                  {file.audio_codec && <span className="px-2 py-0.5 text-xs rounded bg-purple-900/30 text-purple-400">{file.audio_codec}</span>}
                  {file.audio_channels && <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">{file.audio_channels}ch</span>}
                  {parseLanguages(file.audio_languages).length > 1 && (
                   <span 
                    className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-help"
                    title={parseLanguages(file.audio_languages).map((l: string) => l.toUpperCase()).join(', ')}
                   >Multi-Audio ({parseLanguages(file.audio_languages).length})</span>
                  )}
                  {parseLanguages(file.subtitle_languages).length > 0 && (
                   <span 
                    className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 cursor-help"
                    title={parseLanguages(file.subtitle_languages).map((l: string) => l.toUpperCase()).join(', ')}
                   >{parseLanguages(file.subtitle_languages).length} Subs</span>
                  )}
                 </div>
                </td>
                <td className="py-3 px-3 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>{file.file_size ? formatFileSize(file.file_size) : 'N/A'}</td>
                <td className="py-3 px-3 text-right">
                 <button onClick={() => setDeleteFileId(file.id)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 </button>
                </td>
               </tr>
              ))}
             </tbody>
            </table></div>
           ) : (
            <div className="text-center py-8">
             <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No files found</p>
            </div>
           )
          )}

          {activeTab === 'files' && mediaType === 'tv' && (
           <div className="space-y-2">
            {seasons.filter(s => s.season_number > 0).sort((a, b) => b.season_number - a.season_number).map(season => (
             <div key={season.id} className="border rounded" style={{ borderColor: 'var(--border-color)' }}>
              <div 
               className="w-full px-4 py-3 flex items-center justify-between cursor-pointer" 
               style={{ backgroundColor: 'var(--surface-bg)' }}
               onClick={() => toggleSeason(season.season_number)}
              >
               <div className="flex items-center gap-3">
                <button
                 onClick={async (e) => {
                  e.stopPropagation();
                  try {
                   const newMonitored = !season.monitored;
                   await api.updateSeason(libraryId!, season.season_number, { monitored: newMonitored });
                   // Update season and all its episodes
                   const updatedSeasons = seasons.map(s => s.id === season.id ? { 
                    ...s, 
                    monitored: newMonitored,
                    episodes: s.episodes?.map(ep => ({ ...ep, monitored: newMonitored }))
                   } : s);
                   setSeasons(updatedSeasons);
                   
                   // Check if all seasons are now unmonitored - if so, unmonitor the show
                   const allSeasonsUnmonitored = updatedSeasons.filter(s => s.season_number > 0).every(s => !s.monitored);
                   if (allSeasonsUnmonitored && media.monitored) {
                    await api.updateSeries(libraryId!, { monitored: false });
                    setMedia((prev: any) => prev ? { ...prev, monitored: false } : prev);
                   }
                   // If monitoring a season and show is unmonitored, monitor the show too
                   if (newMonitored && !media.monitored) {
                    await api.updateSeries(libraryId!, { monitored: true });
                    setMedia((prev: any) => prev ? { ...prev, monitored: true } : prev);
                   }
                   
                   addToast({ type: 'success', message: newMonitored ? 'Season now monitoring' : 'Season unmonitored' });
                  } catch (e) {
                   addToast({ type: 'error', message: 'Failed to update season' });
                  }
                 }}
                 className="flex-shrink-0"
                 title={season.monitored ? 'Click to unmonitor' : 'Click to monitor'}
                >
                 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" style={{ color: season.monitored ? 'var(--navbar-bg)' : 'var(--text-muted)' }}>
                  <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" />
                 </svg>
                </button>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Season {season.season_number}</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{season.episodes?.filter(e => e.has_file).length || 0}/{season.episodes?.length || 0} episodes</span>
               </div>
               <div className="flex items-center gap-2">
                <svg className={`w-5 h-5 transition-transform ${expandedSeasons.has(season.season_number) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-secondary)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
               </div>
              </div>
              {expandedSeasons.has(season.season_number) && season.episodes && (
               <div className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                {/* Episode column headers */}
                <div className="px-3 md:px-4 py-1.5 flex items-center gap-2 md:gap-3 border-b text-xs font-medium" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)', backgroundColor: 'var(--card-bg)' }}>
                 <span className="w-4 flex-shrink-0"></span>
                 <span className="w-6 md:w-8 text-center flex-shrink-0">#</span>
                 <span className="hidden md:block w-24 flex-shrink-0">Air Date</span>
                 <span className="flex-1">Title</span>
                 <span className="text-right">Info</span>
                </div>
                {[...season.episodes].sort((a, b) => {
                 if (!a.air_date && !b.air_date) return b.episode_number - a.episode_number;
                 if (!a.air_date) return 1;
                 if (!b.air_date) return -1;
                 const dateA = new Date(a.air_date).getTime();
                 const dateB = new Date(b.air_date).getTime();
                 // If same date, sort by episode number descending
                 if (dateA === dateB) return b.episode_number - a.episode_number;
                 return dateB - dateA;
                }).map(ep => (
                 <div key={ep.id} className="px-3 md:px-4 py-2 flex items-center justify-between border-b last:border-b-0" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                   <button
                    onClick={async () => {
                     try {
                      await api.updateEpisode(ep.id, { monitored: !ep.monitored });
                      setSeasons(prev => prev.map(s => s.id === season.id ? {
                       ...s,
                       episodes: s.episodes?.map(e => e.id === ep.id ? { ...e, monitored: !e.monitored } : e)
                      } : s));
                      addToast({ type: 'success', message: ep.monitored ? 'Episode unmonitored' : 'Episode now monitoring' });
                     } catch (e) {
                      addToast({ type: 'error', message: 'Failed to update episode' });
                     }
                    }}
                    className="flex-shrink-0 w-5"
                    title={ep.monitored ? 'Click to unmonitor' : 'Click to monitor'}
                   >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: ep.monitored ? 'var(--navbar-bg)' : 'var(--text-muted)' }}>
                     <path d="M5 2h14a1 1 0 011 1v19.143a.5.5 0 01-.766.424L12 18.03l-7.234 4.536A.5.5 0 014 22.143V3a1 1 0 011-1z" />
                    </svg>
                   </button>
                   <span className="w-6 md:w-10 text-sm flex-shrink-0 text-right" style={{ color: 'var(--text-secondary)' }}>{ep.episode_number}</span>
                   <span className="hidden md:block w-24 text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{ep.air_date ? formatDate(ep.air_date) : '—'}</span>
                   <div className="min-w-0 flex-1">
                    <span className="text-sm block truncate" style={{ color: 'var(--text-primary)' }}>{ep.title}</span>
                    {ep.file_path && <span className="hidden md:block text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>{ep.file_path.split('/').pop()}</span>}
                   </div>
                   <span className="hidden md:block text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{ep.runtime ? `${ep.runtime}m` : ''}</span>
                   {ep.vote_average !== undefined && ep.vote_average > 0 && (
                    <span className="hidden md:flex text-xs flex-shrink-0 items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
                     <span style={{ color: '#f5c518' }}>★</span>{ep.vote_average.toFixed(1)}
                    </span>
                   )}
                  </div>
                  <div className="flex items-center gap-1 md:gap-2 flex-shrink-0 ml-2">
                   {ep.has_file && (
                    <div className="flex flex-wrap gap-1 justify-end">
                     <span className="px-1.5 md:px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{ep.quality || 'OK'}</span>
                     <span className="hidden md:inline-block px-2 py-0.5 text-xs rounded bg-blue-900/30 text-blue-400">{ep.video_codec}</span>
                     <span className="hidden md:inline-block px-2 py-0.5 text-xs rounded bg-purple-900/30 text-purple-400">{ep.audio_codec}</span>
                     {ep.file_size && <span className="hidden md:inline-block px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">{formatFileSize(ep.file_size)}</span>}
                    </div>
                   )}
                   {!ep.has_file && (
                    <span className="px-1.5 md:px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Missing</span>
                   )}
                   {/* Search button for episode */}
                   <button
                    onClick={() => {
                     setSearchEpisode({ season: season.season_number, episode: ep.episode_number });
                     setShowSearchModal(true);
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    style={{ color: 'var(--text-muted)' }}
                    title="Search for release"
                   >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                   </button>
                   {ep.has_file && (
                    <button
                     onClick={() => setDeleteEpisodeInfo({ id: ep.id, title: ep.title, seasonId: season.id })}
                     className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                     title="Delete file"
                    >
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                   )}
                  </div>
                 </div>
                ))}
               </div>
              )}
             </div>
            ))}
           </div>
          )}

          {activeTab === 'history' && (
           activityLog.length > 0 ? (
            <div className="space-y-2">
             {activityLog.map((log: any) => (
              <div key={log.id} className="p-3 rounded border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-bg)' }}>
               <div className="flex items-center justify-between">
                <div>
                 <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{log.event_label}</p>
                 <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{log.message}</p>
                </div>
                <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDate(log.created_at)} {formatTime(log.created_at)}</span>
               </div>
              </div>
             ))}
            </div>
           ) : (
            <div className="text-center py-8">
             <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No activity yet</p>
            </div>
           )
          )}
         </div>
        </div>
       )}

       {/* Mobile Cast Section - above Related Movies on mobile */}
       {(uiSettings.showCast ?? true) && cast.length > 0 && (
        <div className="md:hidden rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--card-bg)' }}>
         <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Cast</h3>
          <button 
           onClick={() => navigate(`/${mediaType}/${media.tmdb_id}/cast-crew`)}
           className="text-xs font-medium" 
           style={{ color: 'var(--navbar-bg)' }}
          >
           Show all →
          </button>
         </div>
         <div className="p-3">
          <div className="flex gap-3 overflow-x-auto pb-2">
           {cast.slice(0, 10).map(member => (
            <div 
             key={member.id} 
             className="flex-shrink-0 w-20 text-center cursor-pointer"
             onClick={() => navigate(`/person/${member.id}`)}
            >
             {member.profile_path ? (
              <img src={getCachedImageUrl(member.profile_path, 'w185') || ''} alt={member.name}
               className="w-16 h-16 mx-auto rounded-full object-cover" />
             ) : (
              <div className="w-16 h-16 mx-auto rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
               <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{member.name.charAt(0)}</span>
              </div>
             )}
             <p className="text-xs font-medium mt-1 truncate" style={{ color: 'var(--text-primary)' }}>{member.name}</p>
             <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{member.character}</p>
            </div>
           ))}
          </div>
         </div>
        </div>
       )}

       {/* Related Movies/Series - combines library items with TMDB similar */}
       {(uiSettings.showSimilar ?? true) && (relatedInLibrary.length > 0 || similar.length > 0) && (
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--card-bg)' }}>
         <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
           Related {mediaType === 'movie' ? 'Movies' : 'Series'}
          </h3>
         </div>
         <div className="p-4">
          <div className="flex gap-4 overflow-x-auto pb-2">
           {/* Show library related items OR TMDB similar (not both) */}
           {(() => {
            // If we have library matches, show ONLY those. Otherwise fall back to TMDB similar.
            const items = relatedInLibrary.length > 0
             ? relatedInLibrary.map((item: any) => ({
                ...item,
                isLibrary: true,
                displayTitle: item.title,
                displayYear: item.year,
                displayRating: item.vote_average,
                displayCertification: item.certification,
                reasons: item.reasons?.filter((r: string) => !r.toLowerCase().includes('title match') && !r.toLowerCase().includes('similar title')) || []
               }))
             : similar.slice(0, 10).map((item: any) => ({
                id: item.id,
                tmdb_id: item.id,
                poster_path: item.poster_path,
                isLibrary: false,
                displayTitle: item.title || item.name,
                displayYear: item.release_date?.split('-')[0] || item.first_air_date?.split('-')[0],
                displayRating: item.vote_average,
                displayCertification: null,
                reasons: []
               }));
            
            return items.map((item: any) => (
             <div key={`${item.isLibrary ? 'lib' : 'tmdb'}-${item.id}`} className="flex-shrink-0 w-36 cursor-pointer group" onClick={async () => {
              if (item.isLibrary) {
               navigate(mediaType === 'movie' ? `/movies/${item.id}` : `/series/${item.id}`);
              } else {
               // Check if TMDB item is in library
               try {
                if (mediaType === 'movie') {
                 const movies = await api.getMovies();
                 const inLib = movies.items?.find((m: any) => m.tmdb_id === item.id);
                 if (inLib) {
                  navigate(`/movies/${inLib.id}`);
                  return;
                 }
                } else {
                 const series = await api.getSeries();
                 const inLib = series.items?.find((s: any) => s.tmdb_id === item.id);
                 if (inLib) {
                  navigate(`/series/${inLib.id}`);
                  return;
                 }
                }
               } catch (e) { /* ignore */ }
               navigate(`/discover/${mediaType === 'movie' ? 'movie' : 'tv'}/${item.id}`);
              }
             }}>
              <div className="relative">
               {item.poster_path ? (
                <img src={getCachedImageUrl(item.poster_path, 'w185') || ''} alt={item.displayTitle} className="w-full aspect-[2/3] object-cover rounded group-hover:scale-105 transition-transform" />
               ) : (
                <div className="w-full aspect-[2/3] bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                 <span className="text-gray-400 text-xs">No Image</span>
                </div>
               )}
               {item.isLibrary && (
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--navbar-bg)' }}>
                 <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                 </svg>
                </div>
               )}
               {item.displayRating > 0 && (
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded-md text-white text-xs font-medium pointer-events-none">
                 ★ {item.displayRating?.toFixed(1)}
                </div>
               )}
              </div>
              <p className="mt-2 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.displayTitle}</p>
              <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
               {item.displayCertification && (
                <span className="px-1 py-0.5 text-[10px] font-medium border rounded" style={{ borderColor: 'var(--border-color)' }}>{item.displayCertification}</span>
               )}
               {item.displayYear && <span>{item.displayYear}</span>}
              </p>
              {item.reasons && item.reasons.length > 0 && (
               <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--navbar-bg)' }} title={item.reasons.join(', ')}>
                {item.reasons[0]}
               </p>
              )}
             </div>
            ));
           })()}
          </div>
         </div>
        </div>
       )}
      </div>
     </div>
    </div>
   </div>

   {/* Modals */}
   {showAddModal && media && (
    <AddToLibraryModal isOpen={showAddModal}
     item={{ id: media.tmdb_id, title: media.title, name: media.title, overview: media.overview, poster_path: media.poster_path, backdrop_path: media.backdrop_path, release_date: tmdbDetails?.release_date, first_air_date: tmdbDetails?.first_air_date, vote_average: media.vote_average }}
     mediaType={mediaType} onClose={() => setShowAddModal(false)} onSuccess={handleAddSuccess} onError={(error) => addToast({ type: 'error', message: error })} />
   )}

   {showSearchModal && libraryId && (
    <InteractiveSearchModal 
     isOpen={showSearchModal} 
     onClose={() => { setShowSearchModal(false); setSearchEpisode(null); }} 
     mediaType={mediaType} 
     mediaId={libraryId} 
     title={media.title} 
     year={media.year} 
     qualityProfileId={media.quality_profile_id}
     seasonNumber={searchEpisode?.season}
     episodeNumber={searchEpisode?.episode}
    />
   )}

   {showDeleteModal && media && (
    <DeleteConfirmModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDelete} title={`Delete ${mediaType === 'movie' ? 'Movie' : 'Series'}`} itemName={media.title} hasFiles={mediaType === 'movie' ? (media.has_file || movieFiles.length > 0) : true} showExclusionOption={true} isSeries={mediaType === 'tv'} />
   )}

   {showRenameModal && libraryId && (
    <PreviewRenameModal type={mediaType === 'movie' ? 'movie' : 'series'} id={libraryId} title={media.title} onClose={() => setShowRenameModal(false)} onComplete={() => loadData()} />
   )}

   {showEditModal && media && libraryId && mediaType === 'movie' && (
    <EditMovieModal movie={{ ...media, id: libraryId }} onClose={() => setShowEditModal(false)} onSave={() => { loadData(); setShowEditModal(false); }} onDelete={() => { setShowEditModal(false); setShowDeleteModal(true); }} />
   )}

   {showEditModal && media && libraryId && mediaType === 'tv' && (
    <EditSeriesModal series={{ ...media, id: libraryId }} onClose={() => setShowEditModal(false)} onSave={() => { loadData(); setShowEditModal(false); }} onDelete={() => { setShowEditModal(false); setShowDeleteModal(true); }} />
   )}

   {showFixMatchModal && media && libraryId && mediaType === 'movie' && (
    <FixMatchModal movie={{ id: libraryId, tmdb_id: media.tmdb_id, title: media.title, year: media.year, poster_path: media.poster_path }} onClose={() => setShowFixMatchModal(false)} onSave={() => { loadData(); setShowFixMatchModal(false); }} />
   )}

   {deleteFileId && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="w-full max-w-md overflow-hidden rounded-lg" style={{ backgroundColor: 'var(--card-bg)' }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
       <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Delete File</h3>
      </div>
      <div className="p-6">
       <p style={{ color: 'var(--text-secondary)' }}>Are you sure you want to delete this file?</p>
      </div>
      <div className="px-6 py-4 flex justify-end gap-3" style={{ backgroundColor: 'var(--surface-bg)' }}>
       <button onClick={() => setDeleteFileId(null)} className="px-4 py-2 text-sm rounded" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
       <button onClick={async () => {
        try { await api.deleteMovieFile(libraryId!, deleteFileId); addToast({ type: 'success', message: 'File deleted' }); loadData(); } catch (e) { addToast({ type: 'error', message: 'Failed to delete file' }); }
        setDeleteFileId(null);
       }} className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
      </div>
     </div>
    </div>
   )}

   {deleteEpisodeInfo && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="w-full max-w-md overflow-hidden rounded-lg" style={{ backgroundColor: 'var(--card-bg)' }}>
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
       <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Delete Episode File</h3>
      </div>
      <div className="p-6">
       <p style={{ color: 'var(--text-secondary)' }}>Are you sure you want to delete the file for "{deleteEpisodeInfo.title}"?</p>
      </div>
      <div className="px-6 py-4 flex justify-end gap-3" style={{ backgroundColor: 'var(--surface-bg)' }}>
       <button onClick={() => setDeleteEpisodeInfo(null)} className="px-4 py-2 text-sm rounded" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
       <button onClick={async () => {
        try {
         await api.deleteEpisodeFile(deleteEpisodeInfo.id);
         setSeasons(prev => prev.map(s => s.id === deleteEpisodeInfo.seasonId ? {
          ...s,
          episodes: s.episodes?.map(e => e.id === deleteEpisodeInfo.id ? { ...e, has_file: false, file_path: undefined, quality: undefined, file_size: undefined } : e)
         } : s));
         addToast({ type: 'success', message: 'Episode file deleted' });
        } catch (e) {
         addToast({ type: 'error', message: 'Failed to delete file' });
        }
        setDeleteEpisodeInfo(null);
       }} className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
      </div>
     </div>
    </div>
   )}

   {showManualImportModal && libraryId && media && (
    <ManualImportModal
     isOpen={showManualImportModal}
     onClose={() => setShowManualImportModal(false)}
     mediaType={mediaType}
     mediaId={libraryId}
     mediaTitle={media.title}
     seasons={seasons.map(s => ({ season_number: s.season_number, episode_count: s.episodes?.length || 0 }))}
     onSuccess={() => {
      loadData();
      addToast({ type: 'success', message: 'File imported successfully' });
     }}
    />
   )}
  </Layout>
 );
}
