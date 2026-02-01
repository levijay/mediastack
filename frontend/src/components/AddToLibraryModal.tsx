import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface QualityProfile {
 id: string;
 name: string;
 media_type?: 'movie' | 'series' | 'both';
 cutoff_quality?: string;
 items?: { quality: string; allowed: boolean }[];
}

// Quality order from highest to lowest
const QUALITY_ORDER = [
 'Remux-2160p', '2160p', 'Bluray-2160p', 'WEBDL-2160p', 'WEBRip-2160p',
 'Remux-1080p', '1080p', 'Bluray-1080p', 'WEBDL-1080p', 'WEBRip-1080p',
 'Bluray-720p', '720p', 'WEBDL-720p', 'WEBRip-720p',
 'Bluray-576p', '576p', 'Bluray-480p', '480p',
 'HDTV-2160p', 'HDTV-1080p', 'HDTV-720p',
 'DVD', 'SDTV', 'Unknown'
];

function getQualityScore(profile: QualityProfile): number {
 // Higher score = higher quality profile
 // Based on cutoff quality and allowed qualities
 let maxScore = 0;
 
 if (profile.cutoff_quality) {
  const cutoffIndex = QUALITY_ORDER.indexOf(profile.cutoff_quality);
  if (cutoffIndex !== -1) {
   maxScore = QUALITY_ORDER.length - cutoffIndex;
  }
 }
 
 // Also consider allowed qualities
 if (profile.items) {
  for (const item of profile.items) {
   if (item.allowed) {
    const idx = QUALITY_ORDER.indexOf(item.quality);
    if (idx !== -1) {
     const score = QUALITY_ORDER.length - idx;
     if (score > maxScore) maxScore = score;
    }
   }
  }
 }
 
 return maxScore;
}

interface MediaItem {
 id: number;
 title?: string;
 name?: string;
 overview?: string;
 poster_path?: string;
 backdrop_path?: string;
 release_date?: string;
 first_air_date?: string;
 vote_average?: number;
 vote_count?: number;
 genre_ids?: number[];
 genres?: { id: number; name: string }[];
 networks?: { id: number; name: string; logo_path?: string }[];
 production_companies?: { id: number; name: string; logo_path?: string }[];
 origin_country?: string[];
 content_rating?: string;
 certification?: string;
 runtime?: number;
 number_of_seasons?: number;
 status?: string;
}

// Genre ID to name mapping (from TMDB)
const genreMap: Record<number, string> = {
 28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
 99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
 // TV genres
 10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
 10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

interface Props {
 isOpen: boolean;
 item: MediaItem | null;
 mediaType: 'movie' | 'tv';
 onClose: () => void;
 onSuccess: (libraryId: string, autoSearch: boolean) => void;
 onError: (error: string) => void;
}

export function AddToLibraryModal({ isOpen, item, mediaType, onClose, onSuccess, onError }: Props) {
 const [profiles, setProfiles] = useState<QualityProfile[]>([]);
 const [selectedProfileId, setSelectedProfileId] = useState<string>('');
 const [minimumAvailability, setMinimumAvailability] = useState<string>('released');
 const [autoSearch, setAutoSearch] = useState<boolean>(false);
 const [monitored, setMonitored] = useState<boolean>(true);
 const [seasonMonitoring, setSeasonMonitoring] = useState<'all' | 'future' | 'current' | 'none'>('all');
 const [loading, setLoading] = useState(false);
 const [adding, setAdding] = useState(false);

 useEffect(() => {
  if (isOpen) {
   loadProfiles();
   loadDefaults();
  }
 }, [isOpen, mediaType]);

 const loadDefaults = async () => {
  try {
   const settings = await api.getSettings();
   // Load default minimum availability from settings
   if (settings.minimum_availability) {
    setMinimumAvailability(settings.minimum_availability);
   }
  } catch (error) {
   console.error('Failed to load settings:', error);
  }
 };

 const loadProfiles = async () => {
  setLoading(true);
  try {
   const profileList = await api.getQualityProfiles();
   // Filter by media type - show profiles that match this media type or 'both'
   const targetType = mediaType === 'movie' ? 'movie' : 'series';
   const filteredProfiles = profileList.filter((p: QualityProfile) => 
    !p.media_type || p.media_type === 'both' || p.media_type === targetType
   );
   // Sort by highest quality first
   const sortedProfiles = [...filteredProfiles].sort((a, b) => getQualityScore(b) - getQualityScore(a));
   setProfiles(sortedProfiles);
   if (sortedProfiles.length > 0) {
    setSelectedProfileId(sortedProfiles[0].id);
   }
  } catch (error) {
   console.error('Failed to load profiles:', error);
  } finally {
   setLoading(false);
  }
 };

 const handleAdd = async () => {
  if (!item || !selectedProfileId) return;
  
  setAdding(true);
  try {
   const settings = await api.getSettings();
   const title = mediaType === 'movie' ? item.title : item.name;
   const dateStr = mediaType === 'movie' ? item.release_date : item.first_air_date;
   const year = dateStr ? new Date(dateStr).getFullYear() : null;
   
   let result;
   if (mediaType === 'movie') {
    const basePath = settings.movie_path || '/data/media/movies';
    const folderName = await api.getMovieFolderName(title || 'Unknown', year || undefined, item.id);
    
    result = await api.addMovie({
     tmdb_id: item.id,
     title: title,
     year: year,
     overview: item.overview,
     poster_path: item.poster_path,
     backdrop_path: item.backdrop_path,
     folder_path: `${basePath}/${folderName}`,
     quality_profile_id: selectedProfileId,
     minimum_availability: minimumAvailability,
     monitored: monitored,
     auto_search: autoSearch
    });
   } else {
    const basePath = settings.tv_path || '/data/media/tv';
    const folderName = await api.getSeriesFolderName(title || 'Unknown', year || undefined, item.id);
    
    // For series, monitored is determined by seasonMonitoring selection
    const seriesMonitored = seasonMonitoring !== 'none';
    
    result = await api.addSeries({
     tmdb_id: item.id,
     title: title,
     year: year,
     overview: item.overview,
     network: null,
     poster_path: item.poster_path,
     backdrop_path: item.backdrop_path,
     folder_path: `${basePath}/${folderName}`,
     quality_profile_id: selectedProfileId,
     monitored: seriesMonitored,
     season_monitoring: seasonMonitoring,
     auto_search: autoSearch
    });
   }
   
   onSuccess(result.id, autoSearch);
   onClose();
  } catch (error: any) {
   if (error.response?.status === 409) {
    onError('Already in library');
   } else {
    onError(error.response?.data?.error || error.message);
   }
  } finally {
   setAdding(false);
  }
 };

 if (!isOpen || !item) return null;

 const title = mediaType === 'movie' ? item.title : item.name;
 const dateStr = mediaType === 'movie' ? item.release_date : item.first_air_date;
 const year = dateStr ? new Date(dateStr).getFullYear() : null;
 
 // Get genres from either genres array or genre_ids
 const genres = item.genres?.map(g => g.name) || 
  item.genre_ids?.map(id => genreMap[id]).filter(Boolean) || [];
 
 // Get network for TV shows or studio for movies
 const network = item.networks?.[0]?.name;
 const studio = item.production_companies?.[0]?.name;
 
 // Get content rating
 const contentRating = item.content_rating || item.certification;

 return (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
   <div className="bg-white dark:bg-gray-800 shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
    {/* Header */}
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
     <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
      Add {mediaType === 'movie' ? 'Movie' : 'Series'} to Library
     </h2>
    </div>

    {/* Content */}
    <div className="p-6 overflow-y-auto flex-1">
     {/* Media Info */}
     <div className="flex gap-4 mb-4">
      {item.poster_path ? (
       <img
        src={`https://image.tmdb.org/t/p/w154${item.poster_path}`}
        alt={title || ''}
        className="w-24 h-36 rounded object-cover flex-shrink-0"
       />
      ) : (
       <div className="w-24 h-36 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
       </div>
      )}
      <div className="flex-1 min-w-0">
       <h3 className="font-semibold text-gray-900 dark:text-white text-lg leading-tight">{title}</h3>
       
       {/* Year, Rating, Content Rating row */}
       <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {year && <span className="text-sm text-gray-500 dark:text-gray-400">{year}</span>}
        {item.vote_average !== undefined && item.vote_average > 0 && (
         <span className="flex items-center gap-1 text-sm">
          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
           <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-gray-700 dark:text-gray-300 font-medium">{item.vote_average.toFixed(1)}</span>
         </span>
        )}
        {contentRating && (
         <span className="px-1.5 py-0.5 text-xs font-medium rounded border border-gray-400 dark:border-gray-500 text-gray-600 dark:text-gray-300">
          {contentRating}
         </span>
        )}
        {item.runtime && item.runtime > 0 && (
         <span className="text-sm text-gray-500 dark:text-gray-400">
          {Math.floor(item.runtime / 60)}h {item.runtime % 60}m
         </span>
        )}
        {item.number_of_seasons && (
         <span className="text-sm text-gray-500 dark:text-gray-400">
          {item.number_of_seasons} Season{item.number_of_seasons !== 1 ? 's' : ''}
         </span>
        )}
       </div>
       
       {/* Studio/Network */}
       {(studio || network) && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
         <span className="font-medium">{mediaType === 'movie' ? 'Studio:' : 'Network:'}</span>{' '}
         {mediaType === 'movie' ? studio : network}
        </p>
       )}
       
       {/* Genre Badges */}
       {genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
         {genres.slice(0, 4).map((genre, idx) => (
          <span 
           key={idx} 
           className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
          >
           {genre}
          </span>
         ))}
         {genres.length > 4 && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
           +{genres.length - 4}
          </span>
         )}
        </div>
       )}
      </div>
     </div>
     
     {/* Synopsis */}
     {item.overview && (
      <div className="mb-6">
       <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
        {item.overview}
       </p>
      </div>
     )}

     {/* Quality Profile Selection */}
     {loading ? (
      <div className="text-center py-4 text-gray-500">Loading profiles...</div>
     ) : profiles.length === 0 ? (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
       <div className="flex items-center gap-3">
        <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
         <p className="font-medium text-yellow-800 dark:text-yellow-200">No Quality Profiles</p>
         <p className="text-sm text-yellow-600 dark:text-yellow-300">
          Please create a quality profile in Settings before adding media.
         </p>
        </div>
       </div>
       <a
        href="/settings?tab=profiles"
        className="mt-3 inline-block text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
       >
        Go to Settings →
       </a>
      </div>
     ) : (
      <div className="space-y-4">
       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
         Quality Profile
        </label>
        <select
         value={selectedProfileId}
         onChange={(e) => setSelectedProfileId(e.target.value)}
         className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
        >
         {profiles.map(profile => (
          <option key={profile.id} value={profile.id}>{profile.name}</option>
         ))}
        </select>
       </div>

       {/* Minimum Availability - Movies Only */}
       {mediaType === 'movie' && (
        <div>
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Minimum Availability
         </label>
         <select
          value={minimumAvailability}
          onChange={(e) => setMinimumAvailability(e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
         >
          <option value="announced">Announced</option>
          <option value="inCinemas">In Cinemas</option>
          <option value="released">Released</option>
         </select>
         <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          When should the movie be considered available for download
         </p>
        </div>
       )}

       {/* Season Monitoring - TV Only */}
       {mediaType === 'tv' && (
        <div>
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Monitor
         </label>
         <select
          value={seasonMonitoring}
          onChange={(e) => setSeasonMonitoring(e.target.value as typeof seasonMonitoring)}
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
         >
          <option value="all">All Seasons</option>
          <option value="current">Current Season Only</option>
          <option value="future">Future Seasons Only</option>
          <option value="none">None</option>
         </select>
         <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Which seasons should be monitored for downloads
         </p>
        </div>
       )}

       {/* Monitored Checkbox - Movies Only */}
       {mediaType === 'movie' && (
        <label className="flex items-center gap-3 cursor-pointer">
         <input
          type="checkbox"
          checked={monitored}
          onChange={(e) => setMonitored(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
         />
         <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
           Monitored
          </span>
          <p className="text-xs text-gray-500 dark:text-gray-400">
           Track this movie for new releases and upgrades
          </p>
         </div>
        </label>
       )}

       {/* Auto Search Checkbox */}
       <label className="flex items-center gap-3 cursor-pointer">
        <input
         type="checkbox"
         checked={autoSearch}
         onChange={(e) => setAutoSearch(e.target.checked)}
         className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
        />
        <div>
         <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Search for missing {mediaType === 'movie' ? 'movie' : 'episodes'} or upgrades
         </span>
         <p className="text-xs text-gray-500 dark:text-gray-400">
          Start searching indexers immediately after adding (includes quality upgrades if profile allows)
         </p>
        </div>
       </label>
      </div>
     )}
    </div>

    {/* Footer */}
    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
     <button
      onClick={onClose}
      disabled={adding}
      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
     >
      Cancel
     </button>
     <button
      onClick={handleAdd}
      disabled={adding || profiles.length === 0 || !selectedProfileId}
      className="px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
     >
      {adding ? 'Adding...' : 'Add to Library'}
     </button>
    </div>
   </div>
  </div>
 );
}
