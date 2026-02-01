import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { AddToLibraryModal } from '../components/AddToLibraryModal';
import { useToast } from '../components/Toast';
import { useUISettings } from '../contexts/UISettingsContext';
import { api, getTMDBImageUrl } from '../services/api';

interface CrewMember {
 id: number;
 name: string;
 job: string;
 department: string;
 profile_path: string | null;
}

interface CastMember {
 id: number;
 name: string;
 character: string;
 profile_path: string | null;
 order: number;
}

interface Genre {
 id: number;
 name: string;
}

interface ProductionCompany {
 id: number;
 name: string;
 logo_path: string | null;
}

interface MovieDetails {
 id: number;
 title: string;
 original_title: string;
 tagline: string;
 overview: string;
 release_date: string;
 runtime: number;
 vote_average: number;
 vote_count: number;
 poster_path: string | null;
 backdrop_path: string | null;
 genres: Genre[];
 production_companies: ProductionCompany[];
 budget: number;
 revenue: number;
 status: string;
 original_language: string;
 credits?: {
  cast: CastMember[];
  crew: CrewMember[];
 };
 release_dates?: {
  results: {
   iso_3166_1: string;
   release_dates: {
    certification: string;
    type: number;
   }[];
  }[];
 };
}

interface TVDetails {
 id: number;
 name: string;
 original_name: string;
 tagline: string;
 overview: string;
 first_air_date: string;
 last_air_date: string;
 episode_run_time: number[];
 vote_average: number;
 vote_count: number;
 poster_path: string | null;
 backdrop_path: string | null;
 genres: Genre[];
 production_companies: ProductionCompany[];
 status: string;
 original_language: string;
 number_of_seasons: number;
 number_of_episodes: number;
 networks: { id: number; name: string; logo_path: string | null }[];
 credits?: {
  cast: CastMember[];
  crew: CrewMember[];
 };
 content_ratings?: {
  results: {
   iso_3166_1: string;
   rating: string;
  }[];
 };
}

interface SimilarItem {
 id: number;
 title?: string;
 name?: string;
 poster_path: string | null;
 vote_average: number;
 release_date?: string;
 first_air_date?: string;
}

export function DiscoverDetailPage() {
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const location = useLocation();
 const { addToast } = useToast();
 const { settings: uiSettings } = useUISettings();
 const [details, setDetails] = useState<MovieDetails | TVDetails | null>(null);
 const [loading, setLoading] = useState(true);
 const [showAddModal, setShowAddModal] = useState(false);
 const [inLibrary, setInLibrary] = useState(false);
 const [libraryId, setLibraryId] = useState<string | null>(null);
 const [similarItems, setSimilarItems] = useState<SimilarItem[]>([]);
 const [libraryTmdbIds, setLibraryTmdbIds] = useState<Set<number>>(new Set());

 // Extract type from URL path (/discover/movie/:id or /discover/tv/:id)
 const type = location.pathname.includes('/discover/movie/') ? 'movie' : 'tv';
 const isMovie = type === 'movie';

 useEffect(() => {
  if (id) {
   loadDetails();
   checkInLibrary();
   loadSimilar();
  }
 }, [id, type]);

 const loadDetails = async () => {
  setLoading(true);
  try {
   const data = isMovie 
    ? await api.getMovieDetails(Number(id))
    : await api.getTVDetails(Number(id));
   setDetails(data);
  } catch (error) {
   console.error('Failed to load details:', error);
   addToast({ type: 'error', message: 'Failed to load details' });
  } finally {
   setLoading(false);
  }
 };

 const loadSimilar = async () => {
  try {
   // Uses TMDB recommendations endpoint (better quality than "similar")
   const data = isMovie 
    ? await api.getSimilarMovies(Number(id))
    : await api.getSimilarTV(Number(id));
   setSimilarItems(data.results?.slice(0, 12) || []);
  } catch (error) {
   console.error('Failed to load recommendations:', error);
  }
 };

 const checkInLibrary = async () => {
  try {
   if (isMovie) {
    const response = await api.getMovies();
    const movies = response.items || response;
    const tmdbIds = new Set<number>(movies.map((m: any) => m.tmdb_id));
    setLibraryTmdbIds(tmdbIds);
    const found = movies.find((m: any) => m.tmdb_id === Number(id));
    if (found) {
     setInLibrary(true);
     setLibraryId(found.id);
    }
   } else {
    const response = await api.getSeries();
    const series = response.items || response;
    const tmdbIds = new Set<number>(series.map((s: any) => s.tmdb_id));
    setLibraryTmdbIds(tmdbIds);
    const found = series.find((s: any) => s.tmdb_id === Number(id));
    if (found) {
     setInLibrary(true);
     setLibraryId(found.id);
    }
   }
  } catch (error) {
   console.error('Failed to check library:', error);
  }
 };

 const getCrewByJob = (jobs: string[]) => {
  if (!details?.credits?.crew) return [];
  return details.credits.crew.filter(c => jobs.includes(c.job));
 };

 const getCertification = (): string | null => {
  if (!details) return null;
  
  if (isMovie) {
   const movieDetails = details as MovieDetails;
   // Try to get US certification first, then fall back to first available
   const usRelease = movieDetails.release_dates?.results?.find(r => r.iso_3166_1 === 'US');
   if (usRelease?.release_dates?.length) {
    const cert = usRelease.release_dates.find(rd => rd.certification)?.certification;
    if (cert) return cert;
   }
   // Fallback to any certification
   for (const result of movieDetails.release_dates?.results || []) {
    const cert = result.release_dates?.find(rd => rd.certification)?.certification;
    if (cert) return cert;
   }
  } else {
   const tvDetails = details as TVDetails;
   // Try to get US rating first
   const usRating = tvDetails.content_ratings?.results?.find(r => r.iso_3166_1 === 'US');
   if (usRating?.rating) return usRating.rating;
   // Fallback to any rating
   const anyRating = tvDetails.content_ratings?.results?.find(r => r.rating);
   if (anyRating?.rating) return anyRating.rating;
  }
  
  return null;
 };

 const handleGoToLibrary = () => {
  if (libraryId) {
   navigate(isMovie ? `/movies/${libraryId}` : `/series/${libraryId}`);
  }
 };

 const handleAddComplete = (newLibraryId: string, autoSearch: boolean) => {
  setShowAddModal(false);
  setInLibrary(true);
  setLibraryId(newLibraryId);
  const searchMsg = autoSearch ? ' Searching for releases...' : '';
  addToast({ type: 'success', message: `Added to library!${searchMsg}` });
 };

 if (loading) {
  return (
   <Layout>
    <div className="flex items-center justify-center h-64">
     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
    </div>
   </Layout>
  );
 }

 if (!details) {
  return (
   <Layout>
    <div className="text-center py-12">
     <h2 className="text-xl font-semibold text-white mb-4">Not found</h2>
     <button onClick={() => navigate('/discover')} className="text-primary-500 hover:underline">
      Back to Discover
     </button>
    </div>
   </Layout>
  );
 }

 const title = isMovie ? (details as MovieDetails).title : (details as TVDetails).name;
 const releaseDate = isMovie ? (details as MovieDetails).release_date : (details as TVDetails).first_air_date;
 const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
 const runtime = isMovie 
  ? (details as MovieDetails).runtime 
  : (details as TVDetails).episode_run_time?.[0];

 const directors = getCrewByJob(['Director']);
 const creators = getCrewByJob(['Creator', 'Executive Producer']);
 const writers = getCrewByJob(['Writer', 'Screenplay', 'Story']);
 const producers = getCrewByJob(['Producer']);
 const editors = getCrewByJob(['Editor']);
 const cast = details.credits?.cast?.slice(0, 12) || [];

 return (
  <Layout>
   {/* Full Width Hero with Backdrop - Exact viewport height */}
   <div className="relative h-[calc(100vh-64px)] overflow-hidden -mt-6" style={{ marginLeft: 'calc(-50vw + 50%)', width: '100vw' }}>
    {/* Backdrop Image */}
    <div className="absolute inset-0">
     {details.backdrop_path ? (
      <img
       src={getTMDBImageUrl(details.backdrop_path, 'original') || ''}
       alt=""
       className="w-full h-full object-cover"
      />
     ) : details.poster_path ? (
      <img
       src={getTMDBImageUrl(details.poster_path, 'original') || ''}
       alt=""
       className="w-full h-full object-cover blur-sm"
      />
     ) : null}
     
     {/* Gradient Overlays */}
     <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/90 to-gray-900/40"></div>
     <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
    </div>

    {/* Content - scrollable within hero */}
    <div className="relative z-10 h-full overflow-y-auto">
     <div className="px-8 lg:px-16 py-8 flex gap-8 max-w-[1800px] mx-auto pr-12 lg:pr-20">
     {/* Poster */}
     <div className="flex-shrink-0 hidden sm:block">
      {details.poster_path ? (
       <img
        src={getTMDBImageUrl(details.poster_path, 'w300') || ''}
        alt={title}
        className="w-48 lg:w-56 shadow-2xl"
       />
      ) : (
       <div className="w-48 lg:w-56 aspect-[2/3] bg-gray-800 flex items-center justify-center">
        <svg className="w-16 h-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
       </div>
      )}
     </div>

     {/* Info */}
     <div className="flex-1 min-w-0">
      {/* Title with Year */}
      <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
       {title} {year && <span className="text-gray-400 font-normal">({year})</span>}
      </h1>

      {/* Rating */}
      {details.vote_average > 0 && (
       <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-0.5">
         {[1, 2, 3, 4, 5].map((star) => (
          <svg
           key={star}
           className={`w-4 h-4 ${star <= Math.round(details.vote_average / 2) ? 'text-yellow-400' : 'text-gray-600'}`}
           fill="currentColor"
           viewBox="0 0 20 20"
          >
           <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
         ))}
        </div>
        <span className="text-sm text-gray-400">{details.vote_average.toFixed(1)}</span>
        {details.vote_count > 0 && (
         <span className="text-xs text-gray-500">({details.vote_count.toLocaleString()} votes)</span>
        )}
       </div>
      )}

      {/* Meta Info: Certification | Runtime/Seasons | Genres */}
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-gray-300 mb-4 text-sm">
       {/* Certification */}
       {getCertification() && (
        <>
         <span className="px-1.5 py-0.5 border border-gray-400 text-gray-300 text-xs">{getCertification()}</span>
         <span className="text-gray-500">|</span>
        </>
       )}
       {/* Runtime for movies / Seasons for TV */}
       {isMovie && runtime && (
        <>
         <span>{runtime} minutes</span>
         {details.genres?.length > 0 && <span className="text-gray-500">|</span>}
        </>
       )}
       {!isMovie && (details as TVDetails).number_of_seasons && (
        <>
         <span>{(details as TVDetails).number_of_seasons} Season{(details as TVDetails).number_of_seasons !== 1 ? 's' : ''}</span>
         {details.genres?.length > 0 && <span className="text-gray-500">|</span>}
        </>
       )}
       {/* Genres */}
       {details.genres?.length > 0 && (
        <span>{details.genres.map(g => g.name).join(', ')}</span>
       )}
      </div>

      {/* Tagline */}
      {details.tagline && (
       <p className="text-lg italic text-gray-400 mb-5">"{details.tagline}"</p>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mb-6">
       {inLibrary ? (
        <button
         onClick={handleGoToLibrary}
         className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
        >
         <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
         </svg>
         In Library
        </button>
       ) : (
        <button
         onClick={() => setShowAddModal(true)}
         className="flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-medium hover:bg-gray-100 transition-colors"
        >
         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
         </svg>
         Add to Library
        </button>
       )}
       
       <a
        href={`https://www.themoviedb.org/${type}/${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-5 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
       >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        TMDB
       </a>
      </div>

      {/* Overview - Full Text */}
      <div className="mb-6">
       <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Overview</h3>
       <p className="text-gray-300 leading-relaxed">
        {details.overview || 'No overview available.'}
       </p>
      </div>

      {/* Director / Creator */}
      {directors.length > 0 && (
       <div className="text-gray-400 mb-2">
        <span className="text-gray-500">Director: </span>
        <span className="text-white">{directors.map(d => d.name).join(', ')}</span>
       </div>
      )}

      {/* Creator (for TV) */}
      {!isMovie && creators.length > 0 && (
       <div className="text-gray-400 mb-2">
        <span className="text-gray-500">Creator: </span>
        <span className="text-white">{creators.map(c => c.name).join(', ')}</span>
       </div>
      )}

      {/* Writers */}
      {writers.length > 0 && (
       <div className="text-gray-400 mb-2">
        <span className="text-gray-500">Writer: </span>
        <span className="text-white">{writers.slice(0, 3).map(w => w.name).join(', ')}</span>
       </div>
      )}

      {/* Producers */}
      {producers.length > 0 && (
       <div className="text-gray-400 mb-2">
        <span className="text-gray-500">Producer: </span>
        <span className="text-white">{producers.slice(0, 3).map(p => p.name).join(', ')}</span>
       </div>
      )}

      {/* Editors */}
      {editors.length > 0 && (
       <div className="text-gray-400 mb-4">
        <span className="text-gray-500">Editor: </span>
        <span className="text-white">{editors.slice(0, 2).map(e => e.name).join(', ')}</span>
       </div>
      )}

      {/* TV Season Info */}
      {!isMovie && (details as TVDetails).number_of_seasons && (
       <div className="text-gray-400 mb-4">
        <span className="text-gray-500">Seasons: </span>
        <span className="text-white">{(details as TVDetails).number_of_seasons}</span>
        <span className="text-gray-500 mx-2">•</span>
        <span className="text-gray-500">Episodes: </span>
        <span className="text-white">{(details as TVDetails).number_of_episodes}</span>
       </div>
      )}

      {/* Cast Section */}
      {(uiSettings.showCast ?? true) && cast.length > 0 && (
       <div className="mt-6 group/cast">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Cast</h3>
        <div className="relative">
         {/* Left scroll button - overlayed, hidden until hover */}
         {cast.length >= 9 && (
          <button
           onClick={() => {
            const container = document.getElementById('discover-cast-scroll');
            if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
           }}
           className="absolute left-0 top-0 bottom-6 w-10 bg-gradient-to-r from-black/80 to-transparent text-white flex items-center justify-start pl-1 z-10 opacity-0 group-hover/cast:opacity-100 transition-opacity duration-200"
          >
           <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
           </svg>
          </button>
         )}

         <div id="discover-cast-scroll" className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {cast.map((member) => (
           <div key={member.id} className="flex-shrink-0 w-[135px] text-center">
            <div className="w-[105px] h-[105px] mx-auto overflow-hidden bg-gray-700 rounded-full">
             {member.profile_path ? (
              <img
               src={getTMDBImageUrl(member.profile_path, 'w185') || ''}
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
            const container = document.getElementById('discover-cast-scroll');
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

      {/* Recommended Section */}
      {(uiSettings.showSimilar ?? true) && similarItems.length > 0 && (() => {
       // Poster width based on settings (1-10 scale)
       const posterWidths: Record<number, number> = {
        1: 80, 2: 90, 3: 100, 4: 110, 5: 120,
        6: 130, 7: 140, 8: 150, 9: 160, 10: 170
       };
       const posterWidth = posterWidths[uiSettings.posterSize || 3] || 100;
       
       return (
        <div className="mt-6 group/recommended">
         <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Recommended {isMovie ? 'Movies' : 'Shows'}
         </h3>
         <div className="relative">
          {/* Left scroll button - overlayed on first poster, hidden until hover */}
          {similarItems.length >= 6 && (
           <button
            onClick={() => {
             const container = document.getElementById('discover-similar-scroll');
             if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
            }}
            className="absolute left-0 top-0 bottom-8 w-10 bg-gradient-to-r from-black/80 to-transparent text-white flex items-center justify-start pl-1 z-10 opacity-0 group-hover/recommended:opacity-100 transition-opacity duration-200"
           >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
           </button>
          )}

          <div id="discover-similar-scroll" className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
           {similarItems.map((item) => {
            const itemInLibrary = libraryTmdbIds.has(item.id);
            return (
            <div
             key={item.id}
             className="flex-shrink-0 cursor-pointer group"
             style={{ width: posterWidth }}
             onClick={() => navigate(`/discover/${isMovie ? 'movie' : 'tv'}/${item.id}`)}
            >
             <div className="aspect-[2/3] bg-gray-700 overflow-hidden relative">
              {item.poster_path ? (
               <img
                src={getTMDBImageUrl(item.poster_path, 'w185') || ''}
                alt={item.title || item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
               />
              ) : (
               <div className="w-full h-full flex items-center justify-center text-gray-500">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
               </div>
              )}
              {/* In Library badge */}
              {itemInLibrary && (
               <div className="absolute top-1 left-1 bg-green-600 px-1.5 py-0.5 text-xs text-white font-medium">
                In Library
               </div>
              )}
              {/* Rating badge */}
              {item.vote_average > 0 && (
               <div className="absolute top-1 right-1 bg-black/70 px-1.5 py-0.5 text-xs text-yellow-400 flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                 <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {item.vote_average.toFixed(1)}
               </div>
              )}
             </div>
             <p className="mt-1.5 text-xs font-medium text-white leading-tight line-clamp-2 group-hover:text-primary-400 transition-colors">
              {item.title || item.name}
             </p>
             {(item.release_date || item.first_air_date) && (
              <p className="text-xs text-gray-500">
               {(item.release_date || item.first_air_date || '').substring(0, 4)}
              </p>
             )}
            </div>
           )})}
          </div>

          {/* Right scroll button - overlayed on last poster, hidden until hover */}
          {similarItems.length >= 6 && (
           <button
            onClick={() => {
             const container = document.getElementById('discover-similar-scroll');
             if (container) container.scrollBy({ left: 300, behavior: 'smooth' });
            }}
            className="absolute right-0 top-0 bottom-8 w-10 bg-gradient-to-l from-black/80 to-transparent text-white flex items-center justify-end pr-1 z-10 opacity-0 group-hover/recommended:opacity-100 transition-opacity duration-200"
           >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
           </button>
          )}
         </div>
        </div>
       );
      })()}
     </div>
    </div>
   </div>
  </div>

   {/* Add to Library Modal */}
   <AddToLibraryModal
    isOpen={showAddModal}
    onClose={() => setShowAddModal(false)}
    item={{
     id: details.id,
     title: isMovie ? (details as MovieDetails).title : undefined,
     name: !isMovie ? (details as TVDetails).name : undefined,
     poster_path: details.poster_path || undefined,
     overview: details.overview,
     release_date: isMovie ? (details as MovieDetails).release_date : undefined,
     first_air_date: !isMovie ? (details as TVDetails).first_air_date : undefined,
    }}
    mediaType={isMovie ? 'movie' : 'tv'}
    onSuccess={handleAddComplete}
    onError={(error) => addToast({ type: 'error', message: error })}
   />
  </Layout>
 );
}
