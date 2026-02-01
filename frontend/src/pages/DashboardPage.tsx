import { useEffect, useState, useCallback, useMemo } from 'react';
import { Layout } from '../components/layout/Layout';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useUISettings } from '../contexts/UISettingsContext';
import { useTimezone } from '../contexts/TimezoneContext';
import { useToast } from '../components/Toast';

// Stats Card Component
function StatsCard({ 
 title, 
 value, 
 onClick 
}: { 
 title: string;
 value: string | number;
 onClick?: () => void;
}) {
 return (
  <button
   onClick={onClick}
   className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200 text-left group w-full"
  >
   <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
   <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
  </button>
 );
}

// Quick Action Card
function QuickActionCard({ 
 title, 
 description, 
 icon, 
 color, 
 onClick 
}: { 
 title: string;
 description: string;
 icon: React.ReactNode;
 color: string;
 onClick: () => void;
}) {
 return (
  <button
   onClick={onClick}
   className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200 text-left group"
  >
   <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
    {icon}
   </div>
   <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
   <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
  </button>
 );
}

// Recent Activity Item
function ActivityItem({ title, subtitle, time, icon, color }: {
 title: string;
 subtitle: string;
 time: string;
 icon: React.ReactNode;
 color: string;
}) {
 return (
  <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
   <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
    {icon}
   </div>
   <div className="flex-1 min-w-0">
    <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
    <p className="text-xs text-gray-500 dark:text-gray-400 break-words">{subtitle}</p>
   </div>
   <span className="text-xs text-gray-400 flex-shrink-0">{time}</span>
  </div>
 );
}

// Media Poster Card
function MediaPosterCard({ item, onClick }: { 
 item: any; 
 onClick: () => void;
}) {
 const title = item.title || item.name || 'Unknown';
 const year = item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4) || item.year;
 
 return (
  <div onClick={onClick} className="cursor-pointer group flex-shrink-0" role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
   <div className="w-[130px] aspect-[2/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 relative shadow-sm group-hover:shadow-lg transition-all duration-200">
    {item.poster_path ? (
     <img
      src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
      alt={title}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      loading="lazy"
     />
    ) : (
     <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
      <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
     </div>
    )}
    {item.vote_average > 0 && (
     <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded-md text-white text-xs font-medium pointer-events-none">
      ★ {item.vote_average?.toFixed(1)}
     </div>
    )}
   </div>
   <p className="mt-2 text-sm font-medium truncate w-[130px]" style={{ color: 'var(--text-primary)' }}>{title}</p>
   {year && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{year}</p>}
  </div>
 );
}

export function DashboardPage() {
 const navigate = useNavigate();
 const { settings } = useUISettings();
 const { formatRelativeTime } = useTimezone();
 const { addToast } = useToast();
 
 const [stats, setStats] = useState<any>({ movies: { total: 0 }, series: { total: 0 } });
 const [recentItems, setRecentItems] = useState<any[]>([]);
 const [trending, setTrending] = useState<any[]>([]);
 const [downloads, setDownloads] = useState(0);
 const [activity, setActivity] = useState<any[]>([]);
 const [refreshing, setRefreshing] = useState(false);
 
 // New widget data
 const [popularMovies, setPopularMovies] = useState<any[]>([]);
 const [popularSeries, setPopularSeries] = useState<any[]>([]);
 const [upcomingMovies, setUpcomingMovies] = useState<any[]>([]);
 const [onTheAir, setOnTheAir] = useState<any[]>([]);
 const [movieGenres, setMovieGenres] = useState<any[]>([]);
 const [tvGenres, setTvGenres] = useState<any[]>([]);
 
 // Library lookup maps: TMDB ID -> Library ID
 const [movieTmdbMap, setMovieTmdbMap] = useState<Map<number, string>>(new Map());
 const [seriesTmdbMap, setSeriesTmdbMap] = useState<Map<number, string>>(new Map());
 
 // Get dashboard languages filter - memoize to prevent infinite re-renders
 const dashboardLanguages = useMemo(() => {
  return settings.dashboardLanguages || ['en'];
 }, [settings.dashboardLanguages]);

 // Helper to get the correct navigation path for a TMDB item
 const getMediaPath = (tmdbId: number, mediaType: 'movie' | 'tv') => {
  if (mediaType === 'movie') {
   const libraryId = movieTmdbMap.get(tmdbId);
   return libraryId ? `/movies/${libraryId}` : `/discover/movie/${tmdbId}`;
  } else {
   const libraryId = seriesTmdbMap.get(tmdbId);
   return libraryId ? `/series/${libraryId}` : `/discover/tv/${tmdbId}`;
  }
 };

 const loadData = useCallback(async () => {
  try {
   const [statsData, recentData, trendingData, downloadsData, activityData, moviesData, seriesData] = await Promise.all([
    api.getLibraryStats().catch(() => ({ movies: { total: 0 }, series: { total: 0 } })),
    api.getRecentlyAdded(8).catch(() => []),
    api.getTrending('all', 'week').catch(() => ({ results: [] })),
    api.getDownloads().catch(() => []),
    api.getRecentActivity(4).catch(() => []),
    api.getMovies().catch(() => ({ items: [] })),
    api.getSeries().catch(() => ({ items: [] }))
   ]);

   setStats(statsData);
   setRecentItems(recentData || []);
   
   // Build TMDB ID -> Library ID lookup maps
   const movieMap = new Map<number, string>();
   (moviesData?.items || []).forEach((m: any) => {
    if (m.tmdb_id) movieMap.set(m.tmdb_id, m.id);
   });
   setMovieTmdbMap(movieMap);
   
   const seriesMap = new Map<number, string>();
   (seriesData?.items || []).forEach((s: any) => {
    if (s.tmdb_id) seriesMap.set(s.tmdb_id, s.id);
   });
   setSeriesTmdbMap(seriesMap);
   
   // Filter trending by language
   const filteredTrending = (trendingData?.results || [])
    .filter((item: any) => dashboardLanguages.length === 0 || dashboardLanguages.includes(item.original_language))
    .slice(0, 10);
   setTrending(filteredTrending);
   
   setDownloads(downloadsData?.filter((d: any) => d.status === 'downloading')?.length || 0);
   setActivity(activityData || []);
   
   // Load additional widget data in parallel
   const [popularMoviesData, popularSeriesData, upcomingMoviesData, onTheAirData, movieGenresData, tvGenresData] = await Promise.all([
    api.discoverMoviesPopular(1).catch(() => ({ results: [] })),
    api.discoverTVPopular(1).catch(() => ({ results: [] })),
    api.discoverMoviesUpcoming(1).catch(() => ({ results: [] })),
    api.discoverTVUpcoming(1).catch(() => ({ results: [] })),
    api.getGenres('movie').catch(() => ({ genres: [] })),
    api.getGenres('tv').catch(() => ({ genres: [] })),
   ]);
   
   // Filter all results by language
   const filterByLanguage = (items: any[]) => {
    if (dashboardLanguages.length === 0) return items;
    return items.filter((item: any) => dashboardLanguages.includes(item.original_language));
   };
   
   setPopularMovies(filterByLanguage(popularMoviesData?.results || []).slice(0, 10));
   setPopularSeries(filterByLanguage(popularSeriesData?.results || []).slice(0, 10));
   setUpcomingMovies(filterByLanguage(upcomingMoviesData?.results || []).slice(0, 10));
   setOnTheAir(filterByLanguage(onTheAirData?.results || []).slice(0, 10));
   setMovieGenres(movieGenresData?.genres || []);
   setTvGenres(tvGenresData?.genres || []);
  } catch (error) {
   console.error('Failed to load dashboard data:', error);
  }
 }, [dashboardLanguages]);

 useEffect(() => {
  loadData();
 }, [loadData]);

 // Get icon and color for activity event type
 const getActivityStyle = (eventType: string) => {
  const styles: Record<string, { icon: React.ReactNode; color: string }> = {
   added: {
    icon: <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    color: 'bg-emerald-500'
   },
   grabbed: {
    icon: <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    color: 'bg-violet-500'
   },
   downloaded: {
    icon: <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    color: 'bg-blue-500'
   },
   imported: {
    icon: <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    color: 'bg-green-500'
   },
   renamed: {
    icon: <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    color: 'bg-indigo-500'
   },
   deleted: {
    icon: <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    color: 'bg-red-500'
   },
   scan_completed: {
    icon: <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    color: 'bg-amber-500'
   },
   metadata_refreshed: {
    icon: <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    color: 'bg-cyan-500'
   },
   unmonitored: {
    icon: <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>,
    color: 'bg-gray-500'
   }
  };
  return styles[eventType] || styles.added;
 };

 return (
  <Layout>
   <div className="space-y-6">
    {/* Page Header */}
    <div className="flex items-center justify-between">
     <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Overview of your media library</p>
     </div>
     <div className="flex items-center gap-3">
      <button
       onClick={async () => {
        setRefreshing(true);
        try {
         await api.runWorkerNow('library-refresh');
         addToast({ type: 'success', message: 'Library refresh started' });
         // Reload dashboard data after a short delay
         setTimeout(() => loadData(), 2000);
        } catch (error) {
         addToast({ type: 'error', message: 'Failed to start library refresh' });
        } finally {
         setRefreshing(false);
        }
       }}
       disabled={refreshing}
       className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
      >
       <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
       </svg>
       {refreshing ? 'Refreshing...' : 'Refresh Library'}
      </button>
     </div>
    </div>

    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
     <StatsCard
      title="Total Movies"
      value={stats?.movies?.total || 0}
      onClick={() => navigate('/movies')}
     />
     <StatsCard
      title="TV Series"
      value={stats?.series?.total || 0}
      onClick={() => navigate('/series')}
     />
     <StatsCard
      title="Active Downloads"
      value={downloads}
      onClick={() => navigate('/downloads')}
     />
     <StatsCard
      title="Missing"
      value={stats?.movies?.missing || 0}
      onClick={() => navigate('/movies?filter=missing')}
     />
    </div>

    {/* Quick Actions */}
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
     <QuickActionCard
      title="Add Movie"
      description="Search & add to library"
      icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
      color="bg-emerald-500"
      onClick={() => navigate('/discover?type=movie')}
     />
     <QuickActionCard
      title="Add TV Show"
      description="Search & add series"
      icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
      color="bg-violet-500"
      onClick={() => navigate('/discover?type=tv')}
     />
     <QuickActionCard
      title="Import Files"
      description="Scan existing media"
      icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
      color="bg-blue-500"
      onClick={() => navigate('/settings?tab=import')}
     />
     <QuickActionCard
      title="Manage Lists"
      description="Import lists & sources"
      icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
      color="bg-amber-500"
      onClick={() => navigate('/settings?tab=lists')}
     />
     <QuickActionCard
      title="Scheduled Tasks"
      description="Background jobs & automation"
      icon={<svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
      color="bg-indigo-500"
      onClick={() => navigate('/settings?tab=jobs')}
     />
    </div>

    {/* Content Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
     {/* Recently Added - Takes 2 columns */}
     {settings.showRecentlyAdded !== false && (
      <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
       <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recently Added</h2>
        <button 
         onClick={() => navigate('/recently-added')}
         className="text-sm font-medium" style={{ color: 'var(--navbar-bg)' }}
        >
         View all →
        </button>
       </div>
       {recentItems.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
         {recentItems.map((item) => (
          <MediaPosterCard
           key={`${item.type}-${item.id}`}
           item={item}
           onClick={() => navigate(item.type === 'movie' ? `/movies/${item.id}` : `/series/${item.id}`)}
          />
         ))}
        </div>
       ) : (
        <div className="text-center py-12 text-gray-400">
         <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
         </svg>
         <p className="text-sm">No items in library yet</p>
         <button 
          onClick={() => navigate('/discover')}
          className="mt-3 text-sm font-medium" style={{ color: 'var(--navbar-bg)' }}
         >
          Start adding media →
         </button>
        </div>
       )}
      </div>
     )}

     {/* Recent Activity */}
     <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 ${settings.showRecentlyAdded === false ? 'lg:col-span-3' : ''}`}>
      <div className="flex items-center justify-between mb-4">
       <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
       <button 
        onClick={() => navigate('/recent-activity')}
        className="text-sm font-medium" style={{ color: 'var(--navbar-bg)' }}
       >
        View all →
       </button>
      </div>
      <div className="space-y-1">
       {activity.length > 0 ? (
        activity.map((item) => {
         const style = getActivityStyle(item.event_type);
         return (
          <ActivityItem
           key={item.id}
           title={item.event_label || item.event_type}
           subtitle={item.message}
           time={formatRelativeTime(item.created_at)}
           icon={style.icon}
           color={style.color}
          />
         );
        })
       ) : (
        <div className="text-center py-8 text-gray-400">
         <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
         </svg>
         <p className="text-sm">No recent activity</p>
        </div>
       )}
      </div>
     </div>
    </div>

    {/* Trending Section */}
    {settings.dashboardWidgets?.trending !== false && trending.length > 0 && (
     <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
       <h2 className="text-lg font-semibold text-gray-900 dark:text-white">🔥 Trending This Week</h2>
       <button 
        onClick={() => navigate('/discover')}
        className="text-sm font-medium" style={{ color: 'var(--navbar-bg)' }}
       >
        Discover more →
       </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
       {trending.map((item) => (
        <MediaPosterCard
         key={`trending-${item.id}-${item.media_type}`}
         item={item}
         onClick={() => navigate(getMediaPath(item.id, item.media_type))}
        />
       ))}
      </div>
     </div>
    )}

    {/* Popular Movies */}
    {settings.dashboardWidgets?.popularMovies !== false && popularMovies.length > 0 && (
     <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
       <h2 className="text-lg font-semibold text-gray-900 dark:text-white">🎬 Popular Movies</h2>
       <button 
        onClick={() => navigate('/discover?type=movie')}
        className="text-sm font-medium" style={{ color: 'var(--navbar-bg)' }}
       >
        View all →
       </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
       {popularMovies.map((item) => (
        <MediaPosterCard
         key={`popular-movie-${item.id}`}
         item={item}
         onClick={() => navigate(getMediaPath(item.id, 'movie'))}
        />
       ))}
      </div>
     </div>
    )}

    {/* Upcoming Movies */}
    {settings.dashboardWidgets?.upcomingMovies !== false && upcomingMovies.length > 0 && (
     <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
       <h2 className="text-lg font-semibold text-gray-900 dark:text-white">🎥 Upcoming Movies</h2>
       <button 
        onClick={() => navigate('/discover?type=movie')}
        className="text-sm font-medium" style={{ color: 'var(--navbar-bg)' }}
       >
        View all →
       </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
       {upcomingMovies.map((item) => (
        <MediaPosterCard
         key={`upcoming-movie-${item.id}`}
         item={item}
         onClick={() => navigate(getMediaPath(item.id, 'movie'))}
        />
       ))}
      </div>
     </div>
    )}

    {/* Movie Genres */}
    {settings.dashboardWidgets?.movieGenres !== false && movieGenres.length > 0 && (
     <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
       <h2 className="text-lg font-semibold text-gray-900 dark:text-white">🎞️ Movie Genres</h2>
      </div>
      <div className="flex gap-2 flex-wrap">
       {movieGenres.map((genre: any) => (
        <button
         key={`movie-genre-${genre.id}`}
         onClick={() => navigate(`/discover?type=movie&genres=${genre.id}`)}
         className="px-3 py-1.5 text-sm rounded-full border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
        >
         {genre.name}
        </button>
       ))}
      </div>
     </div>
    )}

    {/* Popular Series */}
    {settings.dashboardWidgets?.popularSeries !== false && popularSeries.length > 0 && (
     <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
       <h2 className="text-lg font-semibold text-gray-900 dark:text-white">📺 Popular Series</h2>
       <button 
        onClick={() => navigate('/discover?type=tv')}
        className="text-sm font-medium" style={{ color: 'var(--navbar-bg)' }}
       >
        View all →
       </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
       {popularSeries.map((item) => (
        <MediaPosterCard
         key={`popular-series-${item.id}`}
         item={item}
         onClick={() => navigate(getMediaPath(item.id, 'tv'))}
        />
       ))}
      </div>
     </div>
    )}

    {/* On The Air */}
    {settings.dashboardWidgets?.upcomingSeries !== false && onTheAir.length > 0 && (
     <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
       <h2 className="text-lg font-semibold text-gray-900 dark:text-white">📡 On The Air</h2>
       <button 
        onClick={() => navigate('/discover?type=tv')}
        className="text-sm font-medium" style={{ color: 'var(--navbar-bg)' }}
       >
        View all →
       </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
       {onTheAir.map((item) => (
        <MediaPosterCard
         key={`on-the-air-${item.id}`}
         item={item}
         onClick={() => navigate(getMediaPath(item.id, 'tv'))}
        />
       ))}
      </div>
     </div>
    )}

    {/* TV Genres */}
    {settings.dashboardWidgets?.seriesGenres !== false && tvGenres.length > 0 && (
     <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
       <h2 className="text-lg font-semibold text-gray-900 dark:text-white">📺 TV Genres</h2>
      </div>
      <div className="flex gap-2 flex-wrap">
       {tvGenres.map((genre: any) => (
        <button
         key={`tv-genre-${genre.id}`}
         onClick={() => navigate(`/discover?type=tv&genres=${genre.id}`)}
         className="px-3 py-1.5 text-sm rounded-full border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
        >
         {genre.name}
        </button>
       ))}
      </div>
     </div>
    )}
   </div>
  </Layout>
 );
}
