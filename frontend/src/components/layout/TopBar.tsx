import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUISettings } from '../../contexts/UISettingsContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useTimezone } from '../../contexts/TimezoneContext';
import { api } from '../../services/api';

interface Breadcrumb {
 label: string;
 path?: string;
}

const routeLabels: Record<string, string> = {
 '/': 'Home',
 '/movies': 'Movies',
 '/series': 'TV Series',
 '/discover': 'Discover',
 '/discover/movie': 'Movie',
 '/discover/tv': 'TV',
 '/calendar': 'Calendar',
 '/downloads': 'Downloads',
 '/recent-activity': 'Recent Activity',
 '/recently-added': 'Recently Added',
 '/settings': 'Settings',
};

export function TopBar() {
 const location = useLocation();
 const navigate = useNavigate();
 const { updateSettings, currentTheme } = useUISettings();
 const { notifications, unreadCount, markAllAsRead, clearAll, clearNotification } = useNotifications();
 const { formatRelativeTime } = useTimezone();
 const [showSearch, setShowSearch] = useState(false);
 const [showNotifications, setShowNotifications] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 const [searchResults, setSearchResults] = useState<{
  library: { movies: any[]; series: any[]; episodes: any[] };
  tmdb: any[];
 }>({ library: { movies: [], series: [], episodes: [] }, tmdb: [] });
 const [searching, setSearching] = useState(false);
 const searchRef = useRef<HTMLInputElement>(null);
 const notificationRef = useRef<HTMLDivElement>(null);
 const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 // Close notifications dropdown when clicking outside
 useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
   if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
    setShowNotifications(false);
   }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 // State for entity title (movie/series name)
 const [entityTitle, setEntityTitle] = useState<string | null>(null);
 const [entityLoading, setEntityLoading] = useState(false);

 // Fetch entity title when on detail pages
 useEffect(() => {
  const fetchEntityTitle = async () => {
   // Match any ID pattern (alphanumeric)
   const movieMatch = location.pathname.match(/^\/movies\/([^/]+)$/);
   const seriesMatch = location.pathname.match(/^\/series\/([^/]+)$/);
   const discoverMovieMatch = location.pathname.match(/^\/discover\/movie\/(\d+)$/);
   const discoverTvMatch = location.pathname.match(/^\/discover\/tv\/(\d+)$/);
   const castCrewMatch = location.pathname.match(/^\/(movie|tv)\/(\d+)\/cast-crew$/);
   
   if (movieMatch) {
    setEntityLoading(true);
    try {
     const movie = await api.getMovieById(movieMatch[1]);
     if (movie?.title) {
      setEntityTitle(movie.title);
     } else {
      setEntityTitle(null);
     }
    } catch (err) {
     console.error('Failed to fetch movie title:', err);
     setEntityTitle(null);
    } finally {
     setEntityLoading(false);
    }
   } else if (seriesMatch) {
    setEntityLoading(true);
    try {
     const series = await api.getSeriesById(seriesMatch[1]);
     if (series?.name || series?.title) {
      setEntityTitle(series.name || series.title);
     } else {
      setEntityTitle(null);
     }
    } catch (err) {
     console.error('Failed to fetch series title:', err);
     setEntityTitle(null);
    } finally {
     setEntityLoading(false);
    }
   } else if (discoverMovieMatch) {
    setEntityLoading(true);
    try {
     const movie = await api.getMovieDetails(parseInt(discoverMovieMatch[1]));
     if (movie?.title) {
      setEntityTitle(movie.title);
     } else {
      setEntityTitle(null);
     }
    } catch (err) {
     console.error('Failed to fetch movie title:', err);
     setEntityTitle(null);
    } finally {
     setEntityLoading(false);
    }
   } else if (discoverTvMatch) {
    setEntityLoading(true);
    try {
     const series = await api.getTVDetails(parseInt(discoverTvMatch[1]));
     if (series?.name || series?.title) {
      setEntityTitle(series.name || series.title);
     } else {
      setEntityTitle(null);
     }
    } catch (err) {
     console.error('Failed to fetch series title:', err);
     setEntityTitle(null);
    } finally {
     setEntityLoading(false);
    }
   } else if (castCrewMatch) {
    setEntityLoading(true);
    try {
     const mediaType = castCrewMatch[1];
     const id = parseInt(castCrewMatch[2]);
     if (mediaType === 'movie') {
      const movie = await api.getMovieDetails(id);
      setEntityTitle(movie?.title || null);
     } else {
      const series = await api.getTVDetails(id);
      setEntityTitle(series?.name || series?.title || null);
     }
    } catch (err) {
     console.error('Failed to fetch title for cast/crew page:', err);
     setEntityTitle(null);
    } finally {
     setEntityLoading(false);
    }
   } else {
    // Check for person page
    const personMatch = location.pathname.match(/^\/person\/(\d+)$/);
    if (personMatch) {
     setEntityLoading(true);
     try {
      const person = await api.getPersonDetails(parseInt(personMatch[1]));
      setEntityTitle(person?.name || null);
     } catch (err) {
      console.error('Failed to fetch person name:', err);
      setEntityTitle(null);
     } finally {
      setEntityLoading(false);
     }
    } else {
     setEntityTitle(null);
     setEntityLoading(false);
    }
   }
  };
  fetchEntityTitle();
 }, [location.pathname]);

 // Generate breadcrumbs from path
 const getBreadcrumbs = (): Breadcrumb[] => {
  // If on home page, just show "Home"
  if (location.pathname === '/') {
   return [{ label: 'Home' }];
  }
  
  const crumbs: Breadcrumb[] = [{ label: 'Home', path: '/' }];
  const pathParts = location.pathname.split('/').filter(Boolean);
  
  // Handle cast-crew pages specially
  const castCrewMatch = location.pathname.match(/^\/(movie|tv)\/(\d+)\/cast-crew$/);
  if (castCrewMatch) {
   const mediaType = castCrewMatch[1];
   const id = castCrewMatch[2];
   crumbs.push({ label: mediaType === 'movie' ? 'Movies' : 'TV Series', path: mediaType === 'movie' ? '/movies' : '/series' });
   crumbs.push({ label: entityLoading ? '...' : (entityTitle || '...'), path: `/discover/${mediaType}/${id}` });
   crumbs.push({ label: 'Cast & Crew' });
   return crumbs;
  }
  
  // Handle person pages specially
  const personMatch = location.pathname.match(/^\/person\/(\d+)$/);
  if (personMatch) {
   crumbs.push({ label: entityLoading ? '...' : (entityTitle || '...') });
   return crumbs;
  }
  
  let currentPath = '';
  pathParts.forEach((part, index) => {
   currentPath += `/${part}`;
   
   // Check if this is the last part and we have an entity title
   const isLastPart = index === pathParts.length - 1;
   const isMovieDetail = currentPath.match(/^\/movies\/[^/]+$/) && isLastPart;
   const isSeriesDetail = currentPath.match(/^\/series\/[^/]+$/) && isLastPart;
   const isDiscoverMovieDetail = currentPath.match(/^\/discover\/movie\/\d+$/) && isLastPart;
   const isDiscoverTvDetail = currentPath.match(/^\/discover\/tv\/\d+$/) && isLastPart;
   const isPersonDetail = currentPath.match(/^\/person\/\d+$/) && isLastPart;
   
   let label: string;
   let path: string | undefined;
   
   if (isMovieDetail || isSeriesDetail || isDiscoverMovieDetail || isDiscoverTvDetail || isPersonDetail) {
    // For detail pages, show title or loading placeholder (never show ID)
    if (entityLoading) {
     label = '...';
    } else if (entityTitle) {
     label = entityTitle;
    } else {
     label = '...'; // Fallback while loading
    }
    path = undefined; // Last part is not clickable
   } else if (currentPath === '/discover/movie') {
    label = 'Movie';
    path = '/discover?type=movie';
   } else if (currentPath === '/discover/tv') {
    label = 'TV';
    path = '/discover?type=tv';
   } else {
    label = routeLabels[currentPath] || part.charAt(0).toUpperCase() + part.slice(1);
    path = index < pathParts.length - 1 ? currentPath : undefined;
   }
   
   crumbs.push({ label, path });
  });

  return crumbs;
 };

 const breadcrumbs = getBreadcrumbs();

 // Keyboard shortcut for search
 useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
   if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    setShowSearch(true);
    setTimeout(() => searchRef.current?.focus(), 100);
   }
   if (e.key === 'Escape') {
    setShowSearch(false);
    setSearchQuery('');
   }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
 }, []);

 const handleSearch = (e: React.FormEvent) => {
  e.preventDefault();
  if (searchQuery.trim()) {
   navigate(`/discover?search=${encodeURIComponent(searchQuery.trim())}`);
   setShowSearch(false);
   setSearchQuery('');
   setSearchResults({ library: { movies: [], series: [], episodes: [] }, tmdb: [] });
  }
 };

 // Live search as user types
 const performSearch = async (query: string) => {
  if (query.length < 2) {
   setSearchResults({ library: { movies: [], series: [], episodes: [] }, tmdb: [] });
   return;
  }
  
  setSearching(true);
  try {
   // Search library and TMDB in parallel
   const [libraryMovies, librarySeries, tmdbResults] = await Promise.all([
    api.searchLibraryMovies(query).catch(() => []),
    api.searchLibrarySeries(query).catch(() => []),
    api.searchAll(query).catch(() => ({ results: [] }))
   ]);
   
   setSearchResults({
    library: {
     movies: libraryMovies?.slice(0, 5) || [],
     series: librarySeries?.slice(0, 5) || [],
     episodes: [] // Could add episode search later
    },
    tmdb: tmdbResults?.results?.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')?.slice(0, 5) || []
   });
  } catch (error) {
   console.error('Search failed:', error);
  } finally {
   setSearching(false);
  }
 };

 // Debounced search
 useEffect(() => {
  if (searchTimeoutRef.current) {
   clearTimeout(searchTimeoutRef.current);
  }
  searchTimeoutRef.current = setTimeout(() => {
   if (searchQuery.trim()) {
    performSearch(searchQuery.trim());
   } else {
    setSearchResults({ library: { movies: [], series: [], episodes: [] }, tmdb: [] });
   }
  }, 300);
  return () => {
   if (searchTimeoutRef.current) {
    clearTimeout(searchTimeoutRef.current);
   }
  };
 }, [searchQuery]);

 const hasResults = searchResults.library.movies.length > 0 || 
                    searchResults.library.series.length > 0 || 
                    searchResults.tmdb.length > 0;

 const toggleTheme = () => {
  const newTheme = currentTheme.isDark ? 'light' : 'dark';
  updateSettings({ theme: newTheme });
 };

 return (
  <>
   <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 pl-16 lg:pl-6">
    {/* Breadcrumbs */}
    <div className="flex items-center gap-2">
     <svg className="w-4 h-4 text-gray-400 hidden lg:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
     </svg>
     <nav className="flex items-center gap-1 text-sm">
      {breadcrumbs.map((crumb, index) => (
       <div key={index} className="flex items-center gap-1">
        {index > 0 && (
         <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
         </svg>
        )}
        {crumb.path ? (
         <button 
          onClick={() => navigate(crumb.path!)}
          className="text-gray-500 hover:text-gray-900 transition-colors"
         >
          {crumb.label}
         </button>
        ) : (
         <span className="text-gray-900 font-medium">{crumb.label}</span>
        )}
       </div>
      ))}
     </nav>
    </div>

    {/* Right Actions */}
    <div className="flex items-center gap-3">
     {/* Search Button */}
     <button
      onClick={() => {
       setShowSearch(true);
       setTimeout(() => searchRef.current?.focus(), 100);
      }}
      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-500 hover:bg-gray-200 transition-colors"
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span>Search</span>
      <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-white rounded border border-gray-200 text-gray-400">
       ⌘K
      </kbd>
     </button>

     {/* Quick Add */}
     <button
      onClick={() => navigate('/discover')}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
      style={{ backgroundColor: 'var(--navbar-bg)', color: 'var(--navbar-text)' }}
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      <span className="hidden sm:inline">Add Media</span>
     </button>

     {/* Divider */}
     <div className="w-px h-6 bg-gray-200" />

     {/* Theme Toggle */}
     <button
      onClick={toggleTheme}
      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      title={currentTheme.isDark ? 'Light mode' : 'Dark mode'}
     >
      {currentTheme.isDark ? (
       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
       </svg>
      ) : (
       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
       </svg>
      )}
     </button>

     {/* Notifications */}
     <div className="relative" ref={notificationRef}>
      <button 
       onClick={() => setShowNotifications(!showNotifications)}
       className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors relative"
      >
       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
       </svg>
       {unreadCount > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
       )}
      </button>

      {/* Notification Dropdown */}
      {showNotifications && (
       <div className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-xl border overflow-hidden z-50" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
         <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
         <div className="flex items-center gap-2">
          {unreadCount > 0 && (
           <button
            onClick={markAllAsRead}
            className="text-xs hover:opacity-80"
            style={{ color: 'var(--navbar-bg)' }}
           >
            Mark all read
           </button>
          )}
          {notifications.length > 0 && (
           <button
            onClick={clearAll}
            className="text-xs hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
           >
            Clear all
           </button>
          )}
         </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
         {notifications.length === 0 ? (
          <div className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>
           <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
           </svg>
           <p className="text-sm">No notifications</p>
          </div>
         ) : (
          notifications.slice(0, 10).map((notification) => (
           <div 
            key={notification.id}
            className="px-4 py-3 border-b cursor-pointer"
            style={{ 
             borderColor: 'var(--border-color)', 
             backgroundColor: !notification.read ? 'var(--hover-bg)' : 'transparent'
            }}
            onClick={() => {
             if (notification.entity_type === 'movie' && notification.entity_id) {
              navigate(`/movies/${notification.entity_id}`);
             } else if (notification.entity_type === 'series' && notification.entity_id) {
              navigate(`/series/${notification.entity_id}`);
             }
             setShowNotifications(false);
            }}
           >
            <div className="flex items-start gap-3">
             <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              notification.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
              notification.type === 'error' ? 'bg-red-100 text-red-600' :
              notification.type === 'warning' ? 'bg-amber-100 text-amber-600' :
              'bg-blue-100 text-blue-600'
             }`}>
              {notification.type === 'success' ? (
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : notification.type === 'error' ? (
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
             </div>
             <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{notification.title}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{notification.message}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatRelativeTime(notification.timestamp)}</p>
             </div>
             <button
              onClick={(e) => {
               e.stopPropagation();
               clearNotification(notification.id);
              }}
              className="p-1 rounded hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
             >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
             </button>
            </div>
           </div>
          ))
         )}
        </div>
        {notifications.length > 10 && (
         <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <button
           onClick={() => {
            navigate('/recent-activity');
            setShowNotifications(false);
           }}
           className="text-sm font-medium hover:opacity-80"
           style={{ color: 'var(--navbar-bg)' }}
          >
           View all activity →
          </button>
         </div>
        )}
       </div>
      )}
     </div>
    </div>
   </header>

   {/* Search Modal */}
   {showSearch && (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
     <div 
      className="absolute inset-0 bg-black/20 backdrop-blur-sm"
      onClick={() => {
       setShowSearch(false);
       setSearchQuery('');
       setSearchResults({ library: { movies: [], series: [], episodes: [] }, tmdb: [] });
      }}
     />
     <div className="relative w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden max-h-[70vh] flex flex-col">
      <form onSubmit={handleSearch}>
       <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        {searching ? (
         <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
         </svg>
        ) : (
         <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
         </svg>
        )}
        <input
         ref={searchRef}
         type="text"
         value={searchQuery}
         onChange={(e) => setSearchQuery(e.target.value)}
         placeholder="Search library and discover..."
         className="flex-1 text-base outline-none text-gray-900 placeholder-gray-400"
        />
        <kbd className="px-2 py-1 text-xs bg-gray-100 rounded text-gray-400 border border-gray-200">
         ESC
        </kbd>
       </div>
      </form>
      
      <div className="overflow-y-auto flex-1">
       {/* Library Results */}
       {searchResults.library.movies.length > 0 && (
        <div className="border-b border-gray-100">
         <div className="px-4 py-2 bg-gray-50">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Movies in Library</h3>
         </div>
         {searchResults.library.movies.map((movie: any) => (
          <button
           key={`lib-movie-${movie.id}`}
           onClick={() => {
            navigate(`/movies/${movie.id}`);
            setShowSearch(false);
            setSearchQuery('');
            setSearchResults({ library: { movies: [], series: [], episodes: [] }, tmdb: [] });
           }}
           className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 text-left"
          >
           {movie.poster_path ? (
            <img src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`} alt="" className="w-10 h-14 rounded object-cover" />
           ) : (
            <div className="w-10 h-14 rounded bg-gray-200 flex items-center justify-center">
             <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
            </div>
           )}
           <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{movie.title}</p>
            <p className="text-xs text-gray-500">{movie.year || 'Unknown year'}</p>
           </div>
           <span className="px-2 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700">In Library</span>
          </button>
         ))}
        </div>
       )}

       {searchResults.library.series.length > 0 && (
        <div className="border-b border-gray-100">
         <div className="px-4 py-2 bg-gray-50">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">TV Series in Library</h3>
         </div>
         {searchResults.library.series.map((series: any) => (
          <button
           key={`lib-series-${series.id}`}
           onClick={() => {
            navigate(`/series/${series.id}`);
            setShowSearch(false);
            setSearchQuery('');
            setSearchResults({ library: { movies: [], series: [], episodes: [] }, tmdb: [] });
           }}
           className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 text-left"
          >
           {series.poster_path ? (
            <img src={`https://image.tmdb.org/t/p/w92${series.poster_path}`} alt="" className="w-10 h-14 rounded object-cover" />
           ) : (
            <div className="w-10 h-14 rounded bg-gray-200 flex items-center justify-center">
             <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
           )}
           <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{series.name || series.title}</p>
            <p className="text-xs text-gray-500">{series.first_air_date?.slice(0, 4) || series.year || 'Unknown year'}</p>
           </div>
           <span className="px-2 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700">In Library</span>
          </button>
         ))}
        </div>
       )}

       {/* TMDB Results */}
       {searchResults.tmdb.length > 0 && (
        <div>
         <div className="px-4 py-2 bg-gray-50">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Discover on TMDB</h3>
         </div>
         {searchResults.tmdb.map((item: any) => (
          <button
           key={`tmdb-${item.media_type}-${item.id}`}
           onClick={() => {
            navigate(`/discover/${item.media_type}/${item.id}`);
            setShowSearch(false);
            setSearchQuery('');
            setSearchResults({ library: { movies: [], series: [], episodes: [] }, tmdb: [] });
           }}
           className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 text-left"
          >
           {item.poster_path ? (
            <img src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} alt="" className="w-10 h-14 rounded object-cover" />
           ) : (
            <div className="w-10 h-14 rounded bg-gray-200 flex items-center justify-center">
             <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
           )}
           <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{item.title || item.name}</p>
            <p className="text-xs text-gray-500">
             {item.media_type === 'movie' ? 'Movie' : 'TV Series'} • {(item.release_date || item.first_air_date)?.slice(0, 4) || 'Unknown year'}
            </p>
           </div>
           <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">TMDB</span>
          </button>
         ))}
        </div>
       )}

       {/* No results */}
       {searchQuery.length >= 2 && !searching && !hasResults && (
        <div className="p-6 text-center text-gray-400">
         <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
         </svg>
         <p className="text-sm">No results found for "{searchQuery}"</p>
         <p className="text-xs mt-1">Press Enter to search in Discover</p>
        </div>
       )}

       {/* Initial state */}
       {searchQuery.length < 2 && (
        <div className="p-4 text-sm text-gray-500">
         <p>Type at least 2 characters to search...</p>
         <p className="text-xs mt-2 text-gray-400">Press Enter to search in Discover</p>
        </div>
       )}
      </div>
     </div>
    </div>
   )}
  </>
 );
}
