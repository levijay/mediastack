import { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface Episode {
 id: string;
 type?: 'episode';
 series_id: string;
 series_title: string;
 series_poster?: string;
 season_number: number;
 episode_number: number;
 title: string;
 overview?: string;
 air_date: string;
 has_file: boolean;
 monitored: boolean;
}

interface Movie {
 id: string;
 type: 'movie';
 title: string;
 air_date: string;
 release_date?: string;
 poster_path?: string;
 has_file: boolean;
 monitored: boolean;
 year?: number;
 tmdb_id?: number;
}

type CalendarItem = Episode | Movie;

type ViewMode = 'calendar' | 'list';
type FilterMode = 'all' | 'upcoming' | 'missing';

export function CalendarPage() {
 const navigate = useNavigate();
 const [items, setItems] = useState<CalendarItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [viewMode, setViewMode] = useState<ViewMode>('calendar');
 const [filterMode, setFilterMode] = useState<FilterMode>('upcoming');
 const [currentMonth, setCurrentMonth] = useState(new Date());

 useEffect(() => {
  loadItems();
 }, [filterMode, currentMonth]);

 const loadItems = async () => {
  setLoading(true);
  try {
   if (filterMode === 'missing') {
    const data = await api.getMissingEpisodes();
    // Filter out specials (season 0) and add type
    setItems((data || [])
     .filter((ep: Episode) => ep.season_number !== 0)
     .map((ep: any) => ({ ...ep, type: 'episode' as const }))
    );
   } else {
    // Get episodes and movies for the current month view
    const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const data = await api.getUpcomingEpisodes(
     startDate.toISOString().split('T')[0],
     endDate.toISOString().split('T')[0]
    );
    // Filter out specials (season 0) for episodes, keep movies
    setItems((data || []).filter((item: any) => 
     item.type === 'movie' || item.season_number !== 0
    ));
   }
  } catch (error) {
   console.error('Failed to load calendar items:', error);
  } finally {
   setLoading(false);
  }
 };

 const getMonthDays = () => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const days: { date: Date; isCurrentMonth: boolean }[] = [];
  
  // Add days from previous month to fill the first week
  const startPadding = firstDay.getDay();
  for (let i = startPadding - 1; i >= 0; i--) {
   const date = new Date(year, month, -i);
   days.push({ date, isCurrentMonth: false });
  }
  
  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
   days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }
  
  // Add days from next month to complete 5 rows (35 cells)
  const endPadding = 35 - days.length;
  for (let i = 1; i <= Math.max(0, endPadding); i++) {
   const date = new Date(year, month + 1, i);
   days.push({ date, isCurrentMonth: false });
  }
  
  // If we have more than 35 days, truncate to 35
  return days.slice(0, 35);
 };

 const getItemsForDate = (date: Date) => {
  const dateStr = date.toISOString().split('T')[0];
  return items.filter(item => item.air_date === dateStr);
 };

 const isToday = (date: Date) => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
 };

 const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === 'Unknown') return 'TBA';
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
   return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
   return 'Tomorrow';
  } else {
   return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
   });
  }
 };

 const groupByDate = (calendarItems: CalendarItem[]) => {
  const grouped: Record<string, CalendarItem[]> = {};
  calendarItems.forEach(item => {
   const date = item.air_date || 'Unknown';
   if (!grouped[date]) {
    grouped[date] = [];
   }
   grouped[date].push(item);
  });
  return grouped;
 };

 const prevMonth = () => {
  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
 };

 const nextMonth = () => {
  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
 };

 const goToToday = () => {
  setCurrentMonth(new Date());
 };

 const monthDays = getMonthDays();
 const groupedItems = groupByDate(items);
 const sortedDates = Object.keys(groupedItems).sort();

 return (
  <Layout>
   <div className="space-y-4">
    {/* Header */}
    <div className="flex items-center justify-between">
     <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Calendar</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">Track upcoming movies and episodes</p>
     </div>

     <div className="flex items-center gap-2">
      {/* View Toggle */}
      <div className="flex items-center border border-gray-300 dark:border-gray-600 overflow-hidden">
       <button
        onClick={() => setViewMode('calendar')}
        className={`px-3 py-1.5 text-sm ${viewMode === 'calendar' ? 'bg-primary-500 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
       >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
       </button>
       <button
        onClick={() => setViewMode('list')}
        className={`px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
       >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
       </button>
      </div>
     </div>
    </div>

    {/* Filters */}
    <div className="flex items-center gap-3">
     <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 p-1">
      <button
       onClick={() => setFilterMode('upcoming')}
       className={`px-3 py-1 text-sm rounded ${filterMode === 'upcoming' ? 'bg-primary-500 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
      >
       Upcoming
      </button>
      <button
       onClick={() => setFilterMode('missing')}
       className={`px-3 py-1 text-sm rounded ${filterMode === 'missing' ? 'bg-primary-500 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
      >
       Missing
      </button>
     </div>

     {viewMode === 'calendar' && filterMode !== 'missing' && (
      <div className="flex items-center gap-2 ml-auto">
       <button
        onClick={goToToday}
        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 "
       >
        Today
       </button>
       <button
        onClick={prevMonth}
        className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 "
       >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
       </button>
       <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[140px] text-center">
        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
       </span>
       <button
        onClick={nextMonth}
        className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 "
       >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
       </button>
      </div>
     )}
    </div>

    {loading ? (
     <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--theme-primary)' }}></div>
     </div>
    ) : viewMode === 'calendar' && filterMode !== 'missing' ? (
     /* Calendar View - Full height */
     <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
       {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
        <div key={day} className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
         {day}
        </div>
       ))}
      </div>

      {/* Calendar Grid - Takes remaining height */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-hidden">
       {monthDays.map((day, idx) => {
        const dayItems = getItemsForDate(day.date);
        const today = isToday(day.date);
        // Limit to max 4 items per cell to prevent overflow
        const maxItems = 4;
        const visibleItems = dayItems.slice(0, maxItems);
        const hiddenCount = dayItems.length - maxItems;
        
        return (
         <div
          key={idx}
          className={`p-1 border-b border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden ${
           !day.isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900/50' : ''
          } ${today ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
         >
          <div className={`text-xs font-medium mb-0.5 flex-shrink-0 ${
           today ? 'text-primary-600 dark:text-primary-400' : 
           day.isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'
          }`}>
           {day.date.getDate()}
          </div>
          <div className="space-y-0.5 flex-1 overflow-hidden">
           {visibleItems.map(item => {
            const isMovie = item.type === 'movie';
            const episode = item as Episode;
            const movie = item as Movie;
            
            return (
             <div
              key={item.id}
              onClick={() => navigate(isMovie ? `/movies/${movie.id}` : `/series/${episode.series_id}`)}
              className={`text-xs px-1.5 py-1 rounded cursor-pointer leading-tight ${
               item.has_file 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                : item.monitored 
                 ? isMovie 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                 : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
              title={isMovie ? `${movie.title} (${movie.year})` : `${episode.series_title} S${episode.season_number}E${episode.episode_number}`}
             >
              {isMovie ? `🎬 ${movie.title}` : episode.series_title}
             </div>
            );
           })}
           {hiddenCount > 0 && (
            <div className="text-[9px] text-gray-400 dark:text-gray-500 px-1">
             +{hiddenCount} more
            </div>
           )}
          </div>
         </div>
        );
       })}
      </div>
     </div>
    ) : (
     /* List View */
     <div className="space-y-4">
      {sortedDates.length === 0 ? (
       <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
        <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="mt-3 text-sm font-medium text-gray-900 dark:text-white">No items</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
         {filterMode === 'missing' ? 'No missing episodes found' : 'No upcoming releases this month'}
        </p>
       </div>
      ) : (
       sortedDates.map(date => (
        <div key={date} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
         <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white">{formatDate(date)}</h3>
         </div>
         <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {groupedItems[date].map(item => {
           const isMovie = item.type === 'movie';
           const episode = item as Episode;
           const movie = item as Movie;
           
           return (
            <div
             key={item.id}
             onClick={() => navigate(isMovie ? `/movies/${movie.id}` : `/series/${episode.series_id}`)}
             className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
            >
             <div className="flex items-center gap-3">
              {isMovie ? (
               movie.poster_path && (
                <img
                 src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                 alt={movie.title}
                 className="w-10 h-14 object-cover rounded"
                />
               )
              ) : (
               episode.series_poster && (
                <img
                 src={`https://image.tmdb.org/t/p/w92${episode.series_poster}`}
                 alt={episode.series_title}
                 className="w-10 h-14 object-cover rounded"
                />
               )
              )}
              <div className="flex-1 min-w-0">
               <div className="font-medium text-gray-900 dark:text-white truncate flex items-center gap-2">
                {isMovie && <span className="text-xs">🎬</span>}
                {isMovie ? movie.title : episode.series_title}
               </div>
               <div className="text-sm text-gray-500 dark:text-gray-400">
                {isMovie 
                 ? `Movie Release${movie.year ? ` (${movie.year})` : ''}`
                 : `S${episode.season_number.toString().padStart(2, '0')}E${episode.episode_number.toString().padStart(2, '0')}: ${episode.title}`
                }
               </div>
              </div>
              <div>
               {item.has_file ? (
                <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                 Downloaded
                </span>
               ) : item.monitored ? (
                <span className={`px-2 py-1 text-xs rounded ${
                 isMovie 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                }`}>
                 {isMovie ? 'Awaiting Release' : 'Missing'}
                </span>
               ) : (
                <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                 Unmonitored
                </span>
               )}
              </div>
             </div>
            </div>
           );
          })}
         </div>
        </div>
       ))
      )}
     </div>
    )}
   </div>
  </Layout>
 );
}
