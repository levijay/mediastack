import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { InteractiveSearchModal } from '../components/InteractiveSearchModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { PreviewRenameModal } from '../components/PreviewRenameModal';
import { EditMovieModal } from '../components/EditMovieModal';
import { FixMatchModal } from '../components/FixMatchModal';
import { useToast } from '../components/Toast';
import { useUISettings } from '../contexts/UISettingsContext';
import { useTimezone } from '../contexts/TimezoneContext';
import { api, getCachedImageUrl } from '../services/api';

interface Movie {
 id: string;
 tmdb_id: number;
 title: string;
 year: number;
 overview: string;
 runtime?: number;
 vote_average?: number;
 vote_count?: number;
 poster_path: string;
 backdrop_path: string;
 monitored: boolean;
 has_file: boolean;
 quality?: string;
 file_path?: string;
 file_size?: number;
 folder_path?: string;
 quality_profile_id?: string;
 minimum_availability?: string;
 tags?: string[];
 download_status?: string | null;
 download_progress?: number | null;
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

export function MovieDetailPage() {
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const { addToast } = useToast();
 const { settings: uiSettings } = useUISettings();
 const { formatDate, formatTime } = useTimezone();
 const [movie, setMovie] = useState<Movie | null>(null);
 const [movieFiles, setMovieFiles] = useState<any[]>([]);
 const [activityLog, setActivityLog] = useState<any[]>([]);
 const [activityExpanded, setActivityExpanded] = useState(false);
 const [loading, setLoading] = useState(true);
 const [profiles, setProfiles] = useState<QualityProfile[]>([]);
 const [cast, setCast] = useState<CastMember[]>([]);
 const [showSearchModal, setShowSearchModal] = useState(false);

 // Helper to get relative path from folder_path
 const getRelativePath = (fullPath: string, folderPath?: string) => {
  if (!fullPath) return '';
  if (!folderPath) return fullPath.split('/').pop() || fullPath;
  
  // Find where folder_path ends in the full path
  const folderIndex = fullPath.indexOf(folderPath);
  if (folderIndex !== -1) {
   // Return path after the folder_path (removing leading slash)
   const relativePath = fullPath.substring(folderIndex + folderPath.length);
   return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
  }
  
  // Fallback: just show filename
  return fullPath.split('/').pop() || fullPath;
 };
 const [showDeleteModal, setShowDeleteModal] = useState(false);
 const [showRenameModal, setShowRenameModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [showFixMatchModal, setShowFixMatchModal] = useState(false);
 const [deleteFileId, setDeleteFileId] = useState<string | null>(null);

 useEffect(() => {
  if (id) {
   loadMovie();
   loadProfiles();
   loadMovieFiles();
   loadActivityLog();
  }
 }, [id]);

 // Auto-refresh activity log every 10 seconds when expanded
 useEffect(() => {
  if (!id || !activityExpanded) return;
  const interval = setInterval(loadActivityLog, 10000);
  return () => clearInterval(interval);
 }, [id, activityExpanded]);

 const loadMovie = async () => {
  try {
   const data = await api.getMovieById(id!);
   setMovie(data);
   // Load cast if we have tmdb_id
   if (data?.tmdb_id) {
    loadCast(data.tmdb_id);
   }
  } catch (error) {
   console.error('Failed to load movie:', error);
  } finally {
   setLoading(false);
  }
 };

 const loadCast = async (tmdbId: number) => {
  try {
   const details = await api.getMovieDetails(tmdbId);
   if (details?.credits?.cast) {
    // Get top 12 cast members
    setCast(details.credits.cast.slice(0, 12));
   }
  } catch (error) {
   console.error('Failed to load cast:', error);
  }
 };

 const loadMovieFiles = async () => {
  try {
   const files = await api.getMovieFiles(id!);
   setMovieFiles(files);
  } catch (error) {
   console.error('Failed to load movie files:', error);
  }
 };

 const loadProfiles = async () => {
  try {
   const data = await api.getQualityProfiles();
   setProfiles(data);
  } catch (error) {
   console.error('Failed to load profiles:', error);
  }
 };

 const loadActivityLog = async () => {
  try {
   const data = await api.getMovieActivity(id!, 20);
   setActivityLog(data);
  } catch (error) {
   console.error('Failed to load activity log:', error);
  }
 };

 const handleDeleteFile = async (fileId: string) => {
  setDeleteFileId(fileId);
 };

 const confirmDeleteFile = async () => {
  if (!deleteFileId) return;
  try {
   await api.deleteMovieFile(id!, deleteFileId);
   addToast({ type: 'success', message: 'File deleted successfully' });
   loadMovieFiles();
   loadMovie();
  } catch (error: any) {
   console.error('Failed to delete file:', error);
   addToast({ type: 'error', message: error?.response?.data?.error || 'Failed to delete file' });
  } finally {
   setDeleteFileId(null);
  }
 };

 const handleSearch = () => {
  setShowSearchModal(true);
 };

 const [scanning, setScanning] = useState(false);
 const handleScan = async () => {
  if (!id) return;
  setScanning(true);
  try {
   const result = await api.scanMovie(id);
   if (result.found > 0) {
    addToast({ type: 'success', message: `Found ${result.found} file(s)` });
   } else {
    addToast({ type: 'warning', message: 'No video files found in folder' });
   }
   // Reload movie data and files
   loadMovie();
   loadMovieFiles();
  } catch (error) {
   console.error('Failed to scan movie:', error);
   addToast({ type: 'error', message: 'Failed to scan movie folder' });
  } finally {
   setScanning(false);
  }
 };

 const handleDelete = async (deleteFiles: boolean, addExclusion: boolean) => {
  try {
   await api.deleteMovie(id!, deleteFiles, addExclusion);
   navigate('/movies');
  } catch (error) {
   console.error('Failed to delete movie:', error);
   addToast({ type: 'error', message: 'Failed to delete movie' });
  }
 };

 const toggleMonitor = async () => {
  if (!movie) return;
  try {
   await api.updateMovie(movie.id, { monitored: !movie.monitored });
   setMovie({ ...movie, monitored: !movie.monitored });
  } catch (error) {
   console.error('Failed to update movie:', error);
  }
 };

 const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'N/A';
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GiB`;
 };

 const formatRuntime = (minutes?: number) => {
  if (!minutes) return 'N/A';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
 };

 const getProfileName = (profileId?: string) => {
  const profile = profiles.find(p => p.id === profileId);
  return profile?.name || 'Unknown';
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

 if (!movie) {
  return (
   <Layout>
    <div className="text-center py-12">
     <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Movie not found</h2>
     <button onClick={() => navigate('/movies')} className="mt-4 text-primary-500 hover:underline">
      Back to Movies
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
     {/* Backdrop */}
     {movie.backdrop_path && (
      <div className="absolute inset-0">
       <img
        src={getCachedImageUrl(movie.backdrop_path, 'w1280') || ''}
        alt=""
        className="w-full h-full object-cover opacity-30"
       />
       <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/80 to-transparent"></div>
      </div>
     )}

     {/* Content */}
     <div className="relative flex gap-8 p-8 pr-12 lg:pr-20 max-w-[1800px] mx-auto">
      {/* Poster */}
      <div className="flex-shrink-0">
       {movie.poster_path ? (
        <img
         src={getCachedImageUrl(movie.poster_path, 'w300') || ''}
         alt={movie.title}
         className="w-48 h-72 object-cover shadow-2xl"
        />
       ) : (
        <div className="w-48 h-72 bg-gray-800 flex items-center justify-center">
         <svg className="w-16 h-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
         </svg>
        </div>
       )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 text-white">
       <div className="flex items-center gap-3 mb-2">
        <button onClick={toggleMonitor} className={movie.monitored ? 'text-primary-400' : 'text-gray-500'}>
         <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
         </svg>
        </button>
        <h1 className="text-4xl font-bold">{movie.title}</h1>
       </div>

       <div className="flex items-center gap-4 text-sm text-gray-300 mb-4">
        <span className="px-2 py-0.5 bg-gray-700 rounded">R</span>
        <span>{movie.year}</span>
        <span>{formatRuntime(movie.runtime)}</span>
       </div>

       {/* Ratings */}
       <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/80 rounded">
         <span className="text-xs font-medium text-green-400">TMDB</span>
         <span className="text-sm">{movie.vote_average ? movie.vote_average.toFixed(1) : '--'}</span>
        </div>
        {movie.vote_count !== undefined && movie.vote_count > 0 && (
         <span className="px-2 py-1 bg-gray-700/80 rounded text-xs">
          {movie.vote_count.toLocaleString()} votes
         </span>
        )}
       </div>

       {/* Meta badges */}
       <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${movie.monitored ? 'bg-green-600/80' : 'bg-gray-700/80'}`}>
         <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
         </svg>
         {movie.monitored ? 'Monitored' : 'Unmonitored'}
        </span>
        <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
         movie.has_file ? 'bg-green-600/80' : 
         movie.download_status === 'downloading' ? 'bg-blue-600/80' :
         movie.download_status === 'importing' ? 'bg-purple-600/80' :
         movie.download_status === 'queued' ? 'bg-gray-600/80' :
         'bg-yellow-600/80'
        }`}>
         <span className={`w-2 h-2 rounded-full ${
          movie.has_file ? 'bg-green-300' : 
          movie.download_status === 'downloading' ? 'bg-blue-300 animate-pulse' :
          movie.download_status === 'importing' ? 'bg-purple-300 animate-pulse' :
          movie.download_status === 'queued' ? 'bg-gray-300' :
          'bg-yellow-300'
         }`}></span>
         {movie.has_file ? 'Downloaded' : 
          movie.download_status === 'downloading' ? `Downloading ${Math.round(movie.download_progress || 0)}%` :
          movie.download_status === 'importing' ? 'Importing' :
          movie.download_status === 'queued' ? 'Queued' :
          'Missing'}
        </span>
        <span className="px-2 py-1 bg-blue-600/80 rounded text-xs">{getProfileName(movie.quality_profile_id)}</span>
        <span className="px-2 py-1 bg-gray-700/80 rounded text-xs">English</span>
        <span className="px-2 py-1 bg-gray-700/80 rounded text-xs">
         {movie.minimum_availability === 'announced' ? 'Announced' :
          movie.minimum_availability === 'inCinemas' || movie.minimum_availability === 'in_cinemas' ? 'In Cinemas' :
          movie.minimum_availability === 'released' ? 'Released' :
          'Released'}
        </span>
       </div>

       {/* Path */}
       <div className="mb-4">
        <div className="text-xs text-gray-400 mb-1">Path</div>
        <div className="text-sm font-mono text-gray-300 break-all">{movie.folder_path || 'Not set'}</div>
       </div>

       {/* Overview */}
       <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Overview</h3>
        <p className="text-gray-300 leading-relaxed">{movie.overview}</p>
       </div>

       {/* Cast - Inside Hero */}
       {(uiSettings.showCast ?? true) && cast.length > 0 && (
        <div className="mb-8 group/cast">
         <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Cast</h3>
         <div className="relative">
          {/* Left scroll button - overlayed, hidden until hover */}
          {cast.length >= 9 && (
           <button
            onClick={() => {
             const container = document.getElementById('movie-cast-scroll');
             if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
            }}
            className="absolute left-0 top-0 bottom-6 w-10 bg-gradient-to-r from-black/80 to-transparent text-white flex items-center justify-start pl-1 z-10 opacity-0 group-hover/cast:opacity-100 transition-opacity duration-200"
           >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
           </button>
          )}
          
          <div id="movie-cast-scroll" className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
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
             const container = document.getElementById('movie-cast-scroll');
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

    {/* Toolbar - Below hero, above files */}
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
      onClick={handleSearch}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span>Search Releases</span>
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
      onClick={() => setShowFixMatchModal(true)}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      title="Fix incorrect TMDB match"
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>Fix Match</span>
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

    {/* Files Section */}
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
     <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Files</h2>
      {movieFiles.length > 0 && (
       <span className="text-sm text-gray-500 dark:text-gray-400">
        {movieFiles.length} file{movieFiles.length !== 1 ? 's' : ''}
       </span>
      )}
     </div>

     {movieFiles.length > 0 ? (
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
       {movieFiles.map((file: any) => {
        // Format audio info (codec + channels)
        const audioInfo = [file.audio_codec, file.audio_channels].filter(Boolean).join(' ');
        // Flag for multiple audio tracks
        const hasMultipleAudio = (file.audio_track_count || 1) > 1;
        // Check if multiple audio languages - show "Multi" if more than one
        const audioLangs = file.audio_languages;
        const hasMultipleAudioLangs = audioLangs && audioLangs.includes(',');
        const displayAudioLangs = hasMultipleAudioLangs ? 'Multi' : audioLangs;
        // Check if multiple subtitle languages - show "Multi" if more than one
        const subtitleLangs = file.subtitle_languages;
        const hasMultipleSubs = subtitleLangs && subtitleLangs.includes(',');
        const displaySubtitles = hasMultipleSubs ? 'Multi' : subtitleLangs;
        
        return (
         <div key={file.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
          {/* Top row: filename and actions */}
          <div className="flex items-start justify-between gap-4">
           <div className="flex-1 min-w-0">
            {/* Filename */}
            <div className="text-sm text-gray-900 dark:text-white font-mono truncate" title={file.file_path}>
             {file.scene_name || getRelativePath(file.file_path, movie?.folder_path)}
            </div>
            
            {/* Info badges row */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
             {/* Quality badge */}
             <span className={`px-2 py-0.5 text-xs font-medium text-white rounded ${
              file.quality?.includes('2160p') || file.resolution === '2160p' ? 'bg-purple-500' : 
              file.quality?.includes('1080p') || file.resolution === '1080p' ? 'bg-blue-500' : 
              file.quality?.includes('720p') || file.resolution === '720p' ? 'bg-green-500' : 'bg-gray-500'
             }`}>
              {file.quality || 'Unknown'}
             </span>
             
             {/* Video codec */}
             {file.video_codec && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
               {file.video_codec}
              </span>
             )}
             
             {/* HDR badge */}
             {file.video_dynamic_range && file.video_dynamic_range !== 'SDR' && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
               file.video_dynamic_range === 'Dolby Vision' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' :
               file.video_dynamic_range?.includes('HDR10') ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
               'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
               {file.video_dynamic_range}
              </span>
             )}
             
             {/* Audio info badge */}
             {audioInfo && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded" title={hasMultipleAudio ? `${file.audio_track_count} audio tracks` : undefined}>
               {audioInfo}{hasMultipleAudio ? ` (+${(file.audio_track_count || 1) - 1})` : ''}
              </span>
             )}
             
             {/* Audio languages badge */}
             {displayAudioLangs && (
              <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded" title={audioLangs}>
               🔊 {displayAudioLangs}
              </span>
             )}
             
             {/* Subtitle languages badge */}
             {displaySubtitles && (
              <span className="px-2 py-0.5 text-xs bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 rounded" title={subtitleLangs}>
               💬 {displaySubtitles}
              </span>
             )}
             
             {/* Size badge */}
             <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
              {formatFileSize(file.file_size)}
             </span>
            </div>
           </div>
           
           {/* Right side: actions */}
           <div className="flex items-center flex-shrink-0">
            {/* Delete button */}
            <button 
             onClick={() => handleDeleteFile(file.id)}
             className="p-1.5 text-gray-400 hover:text-red-500"
             title="Delete file"
            >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
             </svg>
            </button>
           </div>
          </div>
         </div>
        );
       })}
      </div>
     ) : movie?.has_file && movie?.file_path ? (
      // Legacy: show file from movie record if no movie_files entries
      <div className="table-responsive">
      <table className="w-full">
       <thead className="bg-gray-50 dark:bg-gray-900">
        <tr>
         <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Path</th>
         <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
         <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quality</th>
        </tr>
       </thead>
       <tbody>
        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
         <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-mono" title={movie.file_path}>
          {getRelativePath(movie.file_path || '', movie.folder_path)}
         </td>
         <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{formatFileSize(movie.file_size)}</td>
         <td className="px-6 py-4">
          <span className={`px-2 py-1 text-xs font-medium text-white rounded ${
           movie.quality?.includes('2160p') ? 'bg-purple-500' : 
           movie.quality?.includes('1080p') ? 'bg-blue-500' :
           movie.quality?.includes('720p') ? 'bg-green-500' : 'bg-gray-500'
          }`}>
           {movie.quality || 'Unknown'}
          </span>
         </td>
        </tr>
       </tbody>
      </table></div>
     ) : (
      <div className="px-6 py-12 text-center">
       <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
       </svg>
       <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">No files</h3>
       <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">This movie hasn't been downloaded yet.</p>
       <button
        onClick={handleSearch}
        className="mt-4 px-4 py-2 bg-primary-500 text-white hover:bg-primary-600 transition-colors"
       >
        Search for Releases
       </button>
      </div>
     )}
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
         // Parse details if available
         let details: any = null;
         try {
          if (log.details) details = JSON.parse(log.details);
         } catch (e) {}
         
         // Format date using timezone context
         const formattedDate = formatDate(log.created_at);
         const formattedTime = formatTime(log.created_at);

         // Icon based on event type
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
   {movie && (
    <InteractiveSearchModal
     isOpen={showSearchModal}
     onClose={() => setShowSearchModal(false)}
     mediaType="movie"
     mediaId={movie.id}
     title={movie.title}
     year={movie.year}
     qualityProfileId={movie.quality_profile_id}
    />
   )}

   {/* Delete Confirm Modal */}
   {movie && (
    <DeleteConfirmModal
     isOpen={showDeleteModal}
     onClose={() => setShowDeleteModal(false)}
     onConfirm={handleDelete}
     title="Delete Movie"
     itemName={movie.title}
     hasFiles={movie.has_file}
    />
   )}

   {/* File Delete Confirm Modal */}
   {deleteFileId && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="bg-white dark:bg-gray-800 w-full max-w-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
       <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete File</h3>
      </div>
      <div className="p-6">
       <p className="text-gray-600 dark:text-gray-300">
        Are you sure you want to delete this file? This action cannot be undone.
       </p>
      </div>
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
       <button
        onClick={() => setDeleteFileId(null)}
        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 "
       >
        Cancel
       </button>
       <button
        onClick={confirmDeleteFile}
        className="px-4 py-2 text-sm bg-red-500 text-white hover:bg-red-600"
       >
        Delete File
       </button>
      </div>
     </div>
    </div>
   )}

   {/* Preview Rename Modal */}
   {showRenameModal && movie && (
    <PreviewRenameModal
     type="movie"
     id={movie.id}
     title={movie.title}
     onClose={() => setShowRenameModal(false)}
     onComplete={() => loadMovieFiles()}
    />
   )}

   {/* Edit Movie Modal */}
   {showEditModal && movie && (
    <EditMovieModal
     key={`edit-movie-${movie.id}`}
     movie={movie}
     onClose={() => setShowEditModal(false)}
     onSave={async () => {
      await Promise.all([loadMovie(), loadMovieFiles(), loadActivityLog()]);
      setShowEditModal(false);
     }}
     onDelete={() => {
      setShowEditModal(false);
      setShowDeleteModal(true);
     }}
    />
   )}

   {/* Fix Match Modal */}
   {showFixMatchModal && movie && (
    <FixMatchModal
     movie={movie}
     onClose={() => setShowFixMatchModal(false)}
     onSave={() => {
      setShowFixMatchModal(false);
      loadMovie();
      addToast({ type: 'success', message: 'Movie match updated successfully' });
     }}
    />
   )}
  </Layout>
 );
}
