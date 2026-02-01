import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { api } from '../services/api';
import { useTimezone } from '../contexts/TimezoneContext';
import { Pagination, usePagination } from '../components/Pagination';

interface ActivityLog {
 id: number;
 entity_type: 'movie' | 'series' | 'episode';
 entity_id: string;
 event_type: string;
 event_label?: string;
 message: string;
 details?: string;
 created_at: string;
}

export function RecentActivityPage() {
 const navigate = useNavigate();
 const { formatRelativeTime, formatDateTime } = useTimezone();
 const [activity, setActivity] = useState<ActivityLog[]>([]);
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState<string>('all');
 const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, paginateItems, resetPage } = usePagination(25);

 const loadActivity = useCallback(async () => {
  try {
   setLoading(true);
   const data = await api.getRecentActivity(500);
   setActivity(data || []);
  } catch (error) {
   console.error('Failed to load activity:', error);
  } finally {
   setLoading(false);
  }
 }, []);

 useEffect(() => {
  loadActivity();
 }, [loadActivity]);

 // Filter activity by event type
 const filteredActivity = filter === 'all' 
  ? activity 
  : activity.filter(a => a.event_type === filter);

 const paginatedActivity = paginateItems(filteredActivity);

 // Get unique event types for filter
 const eventTypes = [...new Set(activity.map(a => a.event_type))];

 // Get icon and color for activity event type
 const getActivityStyle = (eventType: string) => {
  const styles: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
   added: {
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100'
   },
   grabbed: {
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    color: 'text-violet-600',
    bg: 'bg-violet-100'
   },
   downloaded: {
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    color: 'text-blue-600',
    bg: 'bg-blue-100'
   },
   imported: {
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    color: 'text-green-600',
    bg: 'bg-green-100'
   },
   renamed: {
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100'
   },
   deleted: {
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    color: 'text-red-600',
    bg: 'bg-red-100'
   },
   scan_completed: {
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    color: 'text-amber-600',
    bg: 'bg-amber-100'
   },
   metadata_refreshed: {
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    color: 'text-cyan-600',
    bg: 'bg-cyan-100'
   },
   unmonitored: {
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>,
    color: 'text-gray-600',
    bg: 'bg-gray-100'
   }
  };
  return styles[eventType] || { icon: styles.added.icon, color: 'text-gray-600', bg: 'bg-gray-100' };
 };

 const handleRowClick = (item: ActivityLog) => {
  if (item.entity_type === 'movie') {
   navigate(`/movies/${item.entity_id}`);
  } else if (item.entity_type === 'series') {
   navigate(`/series/${item.entity_id}`);
  }
 };

 return (
  <Layout>
   <div className="space-y-6">
    {/* Page Header */}
    <div className="flex items-center justify-between">
     <div>
      <h1 className="text-2xl font-bold text-gray-900">Recent Activity</h1>
      <p className="text-sm text-gray-500 mt-1">Library events and changes</p>
     </div>
     <button
      onClick={loadActivity}
      className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
     >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Refresh
     </button>
    </div>

    {/* Filters - Downloads smartbar style */}
    <div className="flex flex-wrap items-center gap-3">
     <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 p-1">
      <button
       onClick={() => { setFilter('all'); resetPage(); }}
       className={`px-3 py-1 text-sm rounded transition-colors ${
        filter === 'all' 
         ? 'bg-primary-500 text-white' 
         : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
       }`}
      >
       All
      </button>
      {eventTypes.map(type => (
       <button
        key={type}
        onClick={() => { setFilter(type); resetPage(); }}
        className={`px-3 py-1 text-sm rounded transition-colors capitalize ${
         filter === type 
          ? 'bg-primary-500 text-white' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
       >
        {type.replace(/_/g, ' ')}
       </button>
      ))}
     </div>
    </div>

    {/* Activity Table */}
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
     {loading ? (
      <div className="p-8 text-center text-gray-400">
       <svg className="w-8 h-8 mx-auto mb-2 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
       </svg>
       Loading activity...
      </div>
     ) : paginatedActivity.length === 0 ? (
      <div className="p-8 text-center text-gray-400">
       <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
       </svg>
       <p>No activity found</p>
      </div>
     ) : (
      <div className="table-responsive">
      <table className="w-full">
       <thead>
        <tr className="border-b border-gray-100 bg-gray-50">
         <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
         <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
         <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Message</th>
         <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-gray-50">
        {paginatedActivity.map((item) => {
         const style = getActivityStyle(item.event_type);
         return (
          <tr 
           key={item.id} 
           onClick={() => handleRowClick(item)}
           className="hover:bg-gray-50 cursor-pointer transition-colors"
          >
           <td className="px-4 py-3">
            <div className="flex items-center gap-2">
             <div className={`w-8 h-8 rounded-lg ${style.bg} ${style.color} flex items-center justify-center`}>
              {style.icon}
             </div>
             <span className="text-sm font-medium text-gray-900">
              {item.event_label || item.event_type.replace(/_/g, ' ')}
             </span>
            </div>
           </td>
           <td className="px-4 py-3">
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${
             item.entity_type === 'movie' ? 'bg-blue-100 text-blue-700' :
             item.entity_type === 'series' ? 'bg-purple-100 text-purple-700' :
             'bg-gray-100 text-gray-700'
            }`}>
             {item.entity_type}
            </span>
           </td>
           <td className="px-4 py-3">
            <p className="text-sm text-gray-600 max-w-md truncate">{item.message}</p>
           </td>
           <td className="px-4 py-3">
            <span className="text-sm text-gray-500" title={formatDateTime(item.created_at)}>
             {formatRelativeTime(item.created_at)}
            </span>
           </td>
          </tr>
         );
        })}
       </tbody>
      </table></div>
     )}
    </div>

    {/* Pagination */}
    {filteredActivity.length > itemsPerPage && (
     <Pagination
      currentPage={currentPage}
      totalItems={filteredActivity.length}
      itemsPerPage={itemsPerPage}
      onPageChange={setCurrentPage}
      onItemsPerPageChange={(n) => { setItemsPerPage(n); resetPage(); }}
     />
    )}
   </div>
  </Layout>
 );
}
