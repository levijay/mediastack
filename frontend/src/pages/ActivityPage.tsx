import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { Pagination, usePagination } from '../components/Pagination';
import { useTimezone } from '../contexts/TimezoneContext';

interface Download {
 id: string;
 title: string;
 media_type: 'movie' | 'tv';
 movie_id: string | null;
 series_id: string | null;
 season_number: number | null;
 episode_number: number | null;
 poster_path: string | null;
 status: string;
 progress: number;
 quality: string | null;
 size: number | null;
 indexer: string | null;
 download_client_name: string | null;
 seeders: number | null;
 created_at: string;
 import_warning?: boolean;
 error_message?: string;
}

export function ActivityPage() {
 const navigate = useNavigate();
 const [downloads, setDownloads] = useState<Download[]>([]);
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState<string>('downloading');
 const [cancelConfirm, setCancelConfirm] = useState<Download | null>(null);
 const [cancelling, setCancelling] = useState<string | null>(null);
 const [clearConfirm, setClearConfirm] = useState<{ status: string; count: number } | null>(null);
 const { addToast } = useToast();
 const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, paginateItems, resetPage } = usePagination(25);
 const { formatRelativeTime } = useTimezone();

 useEffect(() => {
  loadDownloads();
  // Sync and refresh every 5 seconds
  const interval = setInterval(() => {
   syncAndLoad();
  }, 5000);
  return () => clearInterval(interval);
 }, [filter]);

 const syncAndLoad = async () => {
  try {
   // First sync with download clients
   await api.syncDownloads();
   // Then load updated data
   const status = filter === 'all' ? undefined : filter;
   const data = await api.getDownloads(status);
   setDownloads(data);
  } catch (error) {
   console.error('Failed to sync downloads:', error);
  }
 };

 const loadDownloads = async () => {
  try {
   // Sync first
   await api.syncDownloads();
   const status = filter === 'all' ? undefined : filter;
   const data = await api.getDownloads(status);
   setDownloads(data);
  } catch (error) {
   console.error('Failed to load downloads:', error);
  } finally {
   setLoading(false);
  }
 };

 const handleCancel = async (download: Download, deleteFiles: boolean = false) => {
  setCancelling(download.id);
  try {
   await api.cancelDownload(download.id, deleteFiles);
   addToast({ type: 'success', message: `Cancelled: ${download.title}` });
   loadDownloads();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to cancel download' });
  } finally {
   setCancelling(null);
   setCancelConfirm(null);
  }
 };

 const getStatusBadge = (status: string) => {
  const colors: Record<string, string> = {
   queued: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
   downloading: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
   completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
   failed: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
   importing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
  };
  return colors[status] || colors.queued;
 };

 const formatBytes = (bytes: number | null) => {
  if (!bytes) return 'Unknown';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
 };

 const activeCount = downloads.filter(d => d.status === 'downloading' || d.status === 'importing').length;
 const queuedCount = downloads.filter(d => d.status === 'queued').length;
 const completedCount = downloads.filter(d => d.status === 'completed').length;
 const failedCount = downloads.filter(d => d.status === 'failed').length;
 const importWarningCount = downloads.filter(d => d.import_warning).length;

 const handleClearCompleted = async () => {
  try {
   await api.clearDownloads('completed');
   addToast({ type: 'success', message: 'Cleared completed downloads' });
   loadDownloads();
   resetPage();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to clear completed downloads' });
  }
  setClearConfirm(null);
 };

 const handleClearFailed = async () => {
  try {
   await api.clearDownloads('failed');
   addToast({ type: 'success', message: 'Cleared failed downloads' });
   loadDownloads();
   resetPage();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to clear failed downloads' });
  }
  setClearConfirm(null);
 };

 const handleClearQueued = async () => {
  try {
   await api.clearDownloads('queued');
   addToast({ type: 'success', message: 'Cleared queued downloads' });
   loadDownloads();
   resetPage();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to clear queued downloads' });
  }
  setClearConfirm(null);
 };

 const handleClearAll = async () => {
  try {
   await api.clearDownloads('all');
   addToast({ type: 'success', message: 'Cleared all downloads' });
   loadDownloads();
   resetPage();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to clear downloads' });
  }
  setClearConfirm(null);
 };

 const filterButtons = [
  { id: 'all', label: 'All' },
  { id: 'downloading', label: 'Active', count: activeCount },
  { id: 'queued', label: 'Queued', count: queuedCount },
  { id: 'completed', label: 'Completed', count: completedCount },
  { id: 'failed', label: 'Failed', count: failedCount },
 ];

 if (loading) {
  return (
   <Layout>
    <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading...</div>
   </Layout>
  );
 }

 return (
  <Layout>
   <div className="space-y-6">
    {/* Header */}
    <div>
     <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Downloads</h1>
     <p className="text-sm text-gray-500 dark:text-gray-400">
      Monitor downloads and system activity
      {activeCount > 0 && (
       <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
        • {activeCount} active
       </span>
      )}
      {importWarningCount > 0 && (
       <span className="ml-2 text-yellow-600 dark:text-yellow-400 font-medium">
        • {importWarningCount} import warning{importWarningCount !== 1 ? 's' : ''}
       </span>
      )}
     </p>
    </div>

    {/* Filter Buttons - Calendar style */}
    <div className="flex flex-wrap items-center gap-3">
     <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 p-1">
      {filterButtons.map(btn => (
       <button
        key={btn.id}
        onClick={() => setFilter(btn.id)}
        className={`px-3 py-1 text-sm rounded transition-colors ${
         filter === btn.id
          ? 'bg-primary-500 text-white'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
       >
        {btn.label}
        {btn.count !== undefined && btn.count > 0 && ` (${btn.count})`}
       </button>
      ))}
     </div>
     
     {/* Spacer */}
     <div className="flex-1"></div>
     
     {/* Clear buttons */}
     {queuedCount > 0 && (
      <button
       onClick={() => setClearConfirm({ status: 'queued', count: queuedCount })}
       className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
       Clear Queued ({queuedCount})
      </button>
     )}
     {completedCount > 0 && (
      <button
       onClick={() => setClearConfirm({ status: 'completed', count: completedCount })}
       className="px-3 py-2 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
      >
       Clear Completed ({completedCount})
      </button>
     )}
     {failedCount > 0 && (
      <button
       onClick={() => setClearConfirm({ status: 'failed', count: failedCount })}
       className="px-3 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
      >
       Clear Failed ({failedCount})
      </button>
     )}
     {downloads.length > 0 && (
      <button
       onClick={() => setClearConfirm({ status: 'all', count: downloads.length })}
       className="px-3 py-2 text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
      >
       Clear All
      </button>
     )}
    </div>

    {/* Downloads List */}
    {downloads.length === 0 ? (
     <div className="text-center py-12 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
       {filter === 'all' ? 'No downloads yet' : `No ${filter} downloads`}
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
       Start downloads from the movie or series detail pages
      </p>
     </div>
    ) : (
     <div className="border overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
      <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
      {paginateItems(downloads).map((download) => {
       const canNavigate = download.media_type === 'movie' ? !!download.movie_id : !!download.series_id;
       const handleNavigate = () => {
        if (download.media_type === 'movie' && download.movie_id) {
         navigate(`/movies/${download.movie_id}`);
        } else if (download.media_type === 'tv' && download.series_id) {
         navigate(`/series/${download.series_id}`);
        }
       };
       
       return (
       <div 
        key={download.id}
        className={`p-4 ${
         download.status === 'downloading' ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
        }`}
       >
        <div className="flex items-start gap-4">
         {/* Poster */}
         <div 
          className={`flex-shrink-0 w-12 h-18 bg-gray-200 dark:bg-gray-700 overflow-hidden ${canNavigate ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
          onClick={canNavigate ? handleNavigate : undefined}
          style={{ aspectRatio: '2/3' }}
         >
          {download.poster_path ? (
           <img
            src={`https://image.tmdb.org/t/p/w92${download.poster_path}`}
            alt=""
            className="w-full h-full object-cover"
           />
          ) : (
           <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             {download.media_type === 'movie' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
             ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
             )}
            </svg>
           </div>
          )}
         </div>

         {/* Main Info */}
         <div className="flex-1 min-w-0">
          {/* Title - Clickable */}
          <h3 
           className={`font-medium text-gray-900 dark:text-white truncate mb-2 ${canNavigate ? 'cursor-pointer hover:text-primary-500 transition-colors' : ''}`}
           onClick={canNavigate ? handleNavigate : undefined}
          >
           {download.title}
          </h3>

          {/* Tags Row */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
           {/* Status Badge */}
           <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadge(download.status)}`}>
            {download.status}
           </span>

           {/* Import Warning */}
           {download.import_warning && (
            <span 
             className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 flex items-center gap-1 cursor-help"
             title={download.error_message || "Download completed but file was not imported to library. Check volume mappings and logs."}
            >
             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
             Import Failed
            </span>
           )}
           
           {/* Error Message (for failed status) */}
           {download.status === 'failed' && download.error_message && (
            <span 
             className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 flex items-center gap-1 cursor-help max-w-xs truncate"
             title={download.error_message}
            >
             <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
             <span className="truncate">{download.error_message}</span>
            </span>
           )}

           {/* Quality */}
           {download.quality && (
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
             {download.quality}
            </span>
           )}

           {/* Indexer */}
           {download.indexer && (
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
             {download.indexer}
            </span>
           )}

           {/* Download Client */}
           {download.download_client_name && (
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300">
             {download.download_client_name}
            </span>
           )}

           {/* Size */}
           <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatBytes(download.size)}
           </span>

           {/* Seeders */}
           {download.seeders !== null && download.seeders !== undefined && (
            <span className="text-xs text-green-600 dark:text-green-400">
             🌱 {download.seeders}
            </span>
           )}

           {/* Time */}
           <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatRelativeTime(download.created_at)}
           </span>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-3">
           <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
             className={`h-2 rounded-full transition-all duration-300 ${
              download.status === 'downloading' ? 'bg-blue-600' :
              download.status === 'importing' ? 'bg-yellow-500' :
              download.status === 'completed' ? 'bg-green-600' :
              download.status === 'failed' ? 'bg-red-600' :
              'bg-gray-400'
             }`}
             style={{ width: `${download.progress}%` }}
            />
           </div>
           <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-12 text-right">
            {Math.round(download.progress)}%
           </span>
          </div>
         </div>

         {/* Actions */}
         <div className="flex items-center gap-2">
          {(download.status === 'queued' || download.status === 'downloading') && (
           <button
            onClick={() => setCancelConfirm(download)}
            disabled={cancelling === download.id}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
            title="Cancel download"
           >
            {cancelling === download.id ? (
             <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
             </svg>
            ) : (
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
            )}
           </button>
          )}
         </div>
        </div>
       </div>
      );
      })}
      </div>
      
      {/* Pagination */}
      <Pagination
       currentPage={currentPage}
       totalItems={downloads.length}
       itemsPerPage={itemsPerPage}
       onPageChange={setCurrentPage}
       onItemsPerPageChange={setItemsPerPage}
      />
     </div>
    )}

    {/* Info Banner */}
    {activeCount > 0 && (
     <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
      <p className="text-sm text-blue-800 dark:text-blue-300">
       ℹ️ Progress syncs with download clients every 5 seconds. Completed downloads are automatically imported.
      </p>
     </div>
    )}
   </div>

   {/* Cancel Confirmation Modal */}
   <ConfirmModal
    isOpen={!!cancelConfirm}
    title="Cancel Download"
    message={`Cancel download of "${cancelConfirm?.title}"? This will remove it from the download client.`}
    confirmText="Cancel Download"
    onConfirm={() => cancelConfirm && handleCancel(cancelConfirm, false)}
    onCancel={() => setCancelConfirm(null)}
   />

   {/* Clear Confirmation Modal */}
   <ConfirmModal
    isOpen={!!clearConfirm}
    title={`Clear ${clearConfirm?.status === 'all' ? 'All' : clearConfirm?.status} Downloads`}
    message={`Are you sure you want to clear ${clearConfirm?.count} ${clearConfirm?.status === 'all' ? '' : clearConfirm?.status} download${clearConfirm?.count !== 1 ? 's' : ''}? This cannot be undone.`}
    confirmText="Clear"
    onConfirm={() => {
     if (clearConfirm?.status === 'completed') handleClearCompleted();
     else if (clearConfirm?.status === 'failed') handleClearFailed();
     else if (clearConfirm?.status === 'queued') handleClearQueued();
     else if (clearConfirm?.status === 'all') handleClearAll();
    }}
    onCancel={() => setClearConfirm(null)}
   />
  </Layout>
 );
}
