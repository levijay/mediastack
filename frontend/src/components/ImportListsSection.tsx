import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Button } from './common/Button';
import { Input } from './common/Input';
import { ConfirmModal } from './ConfirmModal';
import { useTimezone } from '../contexts/TimezoneContext';

interface ImportList {
 id: string;
 name: string;
 type: string;
 media_type: 'movie' | 'tv';
 enabled: boolean;
 enable_auto_add: boolean;
 search_on_add: boolean;
 quality_profile_id: string | null;
 root_folder: string | null;
 monitor: string;
 minimum_availability: string;
 list_id: string | null;
 url: string | null;
 refresh_interval: number;
 last_sync: string | null;
}

interface Exclusion {
 id: string;
 tmdb_id: number;
 media_type: 'movie' | 'tv';
 title: string;
 year?: number;
 reason?: string;
 created_at: string;
}

interface ListType {
 type: string;
 name: string;
 description: string;
 presets: { id: string; name: string; listId: string }[];
}

interface QualityProfile {
 id: string;
 name: string;
 media_type?: string;
}

interface PreviewItem {
 tmdb_id?: number;
 imdb_id?: string;
 title: string;
 year?: number;
 poster_path?: string;
 overview?: string;
 vote_average?: number;
 genres?: string[];
 network?: string;
 in_library?: boolean;
}

interface SyncResult {
 added: number;
 existing: number;
 failed: number;
 message?: string;
}

interface Props {
 onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function ImportListsSection({ onToast }: Props) {
 const { formatDate } = useTimezone();
 const [lists, setLists] = useState<ImportList[]>([]);
 const [listTypes, setListTypes] = useState<{ movie: ListType[]; tv: ListType[] }>({ movie: [], tv: [] });
 const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([]);
 const [loading, setLoading] = useState(true);
 const [showModal, setShowModal] = useState(false);
 const [editingList, setEditingList] = useState<ImportList | null>(null);
 const [syncing, setSyncing] = useState<string | null>(null);
 const [showTypeSelector, setShowTypeSelector] = useState(false);
 const [selectedListType, setSelectedListType] = useState<ListType | null>(null);
 
 // Sync progress state
 const [showSyncModal, setShowSyncModal] = useState(false);
 const [syncProgress, setSyncProgress] = useState<{ 
  listName: string; 
  status: 'syncing' | 'complete' | 'error'; 
  currentItem?: string;
  processed: number;
  total: number;
  result?: SyncResult 
 }>({ listName: '', status: 'syncing', processed: 0, total: 0 });
 
 // Preview state
 const [showPreviewModal, setShowPreviewModal] = useState(false);
 const [previewList, setPreviewList] = useState<ImportList | null>(null);
 const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
 const [previewLoading, setPreviewLoading] = useState(false);
 
 // Delete confirmation state
 const [deleteConfirm, setDeleteConfirm] = useState<ImportList | null>(null);

 // Exclusion list state
 const [showExclusions, setShowExclusions] = useState(false);
 const [exclusions, setExclusions] = useState<Exclusion[]>([]);
 const [exclusionCount, setExclusionCount] = useState(0);
 const [exclusionFilter, setExclusionFilter] = useState<'all' | 'movie' | 'tv'>('all');
 const [exclusionsLoading, setExclusionsLoading] = useState(false);

 // Form state
 const [formData, setFormData] = useState({
  name: '',
  type: 'imdb',
  media_type: 'movie' as 'movie' | 'tv',
  enabled: true,
  enable_auto_add: true,
  search_on_add: false,
  quality_profile_id: '',
  root_folder: '',
  monitor: 'all',
  minimum_availability: 'released',
  list_id: '',
  url: '',
  refresh_interval: 720
 });

 useEffect(() => {
  loadData();
 }, []);

 const loadData = async () => {
  setLoading(true);
  try {
   const [listsData, typesData, profilesData, exclusionsData] = await Promise.all([
    api.getImportLists(),
    api.getImportListTypes(),
    api.getQualityProfiles(),
    api.getExclusions() // Load all exclusions for count
   ]);
   setLists(listsData);
   setListTypes(typesData);
   setQualityProfiles(profilesData);
   setExclusionCount(exclusionsData.items?.length || 0);
  } catch (error) {
   console.error('Failed to load import lists:', error);
   onToast('Failed to load import lists', 'error');
  } finally {
   setLoading(false);
  }
 };

 const loadExclusions = async () => {
  setExclusionsLoading(true);
  try {
   const mediaType = exclusionFilter === 'all' ? undefined : exclusionFilter;
   const data = await api.getExclusions(mediaType);
   setExclusions(data.items || []);
   // Update total count when loading all
   if (exclusionFilter === 'all') {
    setExclusionCount(data.items?.length || 0);
   }
  } catch (error) {
   console.error('Failed to load exclusions:', error);
   onToast('Failed to load exclusion list', 'error');
  } finally {
   setExclusionsLoading(false);
  }
 };

 const handleRemoveExclusion = async (id: string) => {
  try {
   await api.removeExclusion(id);
   setExclusions(prev => prev.filter(e => e.id !== id));
   setExclusionCount(prev => Math.max(0, prev - 1));
   onToast('Removed from exclusion list', 'success');
  } catch (error) {
   console.error('Failed to remove exclusion:', error);
   onToast('Failed to remove exclusion', 'error');
  }
 };

 const handleClearExclusions = async () => {
  try {
   const mediaType = exclusionFilter === 'all' ? undefined : exclusionFilter;
   const clearedCount = exclusions.length;
   await api.clearExclusions(mediaType);
   setExclusions([]);
   if (exclusionFilter === 'all') {
    setExclusionCount(0);
   } else {
    setExclusionCount(prev => Math.max(0, prev - clearedCount));
   }
   onToast(`Cleared ${exclusionFilter === 'all' ? 'all' : exclusionFilter} exclusions`, 'success');
  } catch (error) {
   console.error('Failed to clear exclusions:', error);
   onToast('Failed to clear exclusions', 'error');
  }
 };

 // Load exclusions when filter changes or when panel is shown
 useEffect(() => {
  if (showExclusions) {
   loadExclusions();
  }
 }, [showExclusions, exclusionFilter]);

 const resetForm = () => {
  setFormData({
   name: '',
   type: 'imdb',
   media_type: 'movie',
   enabled: true,
   enable_auto_add: true,
   search_on_add: false,
   quality_profile_id: qualityProfiles[0]?.id || '',
   root_folder: '',
   monitor: 'all',
   minimum_availability: 'released',
   list_id: '',
   url: '',
   refresh_interval: 720
  });
  setSelectedListType(null);
 };

 const openAddModal = (mediaType: 'movie' | 'tv', listType: ListType) => {
  resetForm();
  setFormData(prev => ({
   ...prev,
   media_type: mediaType,
   type: listType.type,
   name: listType.name,
   root_folder: mediaType === 'movie' ? '/data/media/movies' : '/data/media/tv'
  }));
  setSelectedListType(listType);
  setEditingList(null);
  setShowTypeSelector(false);
  setShowModal(true);
 };

 const openEditModal = (list: ImportList) => {
  setEditingList(list);
  const typeInfo = [...(listTypes.movie || []), ...(listTypes.tv || [])].find(t => t.type === list.type);
  setSelectedListType(typeInfo || null);
  setFormData({
   name: list.name,
   type: list.type,
   media_type: list.media_type,
   enabled: list.enabled,
   enable_auto_add: list.enable_auto_add,
   search_on_add: list.search_on_add,
   quality_profile_id: list.quality_profile_id || '',
   root_folder: list.root_folder || '',
   monitor: list.monitor,
   minimum_availability: list.minimum_availability,
   list_id: list.list_id || '',
   url: list.url || '',
   refresh_interval: list.refresh_interval
  });
  setShowModal(true);
 };

 const handleSave = async () => {
  try {
   if (editingList) {
    await api.updateImportList(editingList.id, formData);
    onToast('Import list updated successfully', 'success');
   } else {
    await api.addImportList(formData);
    onToast('Import list added successfully', 'success');
   }
   setShowModal(false);
   resetForm();
   setEditingList(null);
   loadData();
  } catch (error: any) {
   onToast(error.response?.data?.error || 'Failed to save import list', 'error');
  }
 };

 const handleDelete = async (id: string) => {
  try {
   await api.deleteImportList(id);
   onToast('Import list deleted successfully', 'success');
   setShowModal(false);
   setEditingList(null);
   loadData();
  } catch (error: any) {
   onToast(error.response?.data?.error || 'Failed to delete import list', 'error');
  }
 };

 const handleSync = async (list: ImportList) => {
  setSyncing(list.id);
  setSyncProgress({ listName: list.name, status: 'syncing', processed: 0, total: 0 });
  setShowSyncModal(true);
  
  try {
   // First get preview to know total count
   const previewResult = await api.previewImportList(list.id);
   const total = previewResult.items?.length || 0;
   setSyncProgress(prev => ({ ...prev, total }));
   
   // Simulate progress while sync is running
   let processed = 0;
   const progressInterval = setInterval(() => {
    processed = Math.min(processed + Math.ceil(total / 10), Math.floor(total * 0.9));
    setSyncProgress(prev => ({ 
     ...prev, 
     processed,
     currentItem: `Processing items...`
    }));
   }, 500);
   
   // Now do the actual sync
   const result = await api.syncImportList(list.id);
   
   // Clear interval and show complete
   clearInterval(progressInterval);
   setSyncProgress({ 
    listName: list.name, 
    status: 'complete', 
    processed: total,
    total,
    result 
   });
   loadData();
  } catch (error: any) {
   setSyncProgress({ 
    listName: list.name, 
    status: 'error', 
    processed: 0,
    total: 0,
    result: { added: 0, existing: 0, failed: 0, message: error.response?.data?.error || 'Sync failed' }
   });
  } finally {
   setSyncing(null);
  }
 };

 const handlePreview = async (list: ImportList) => {
  setPreviewList(list);
  setPreviewLoading(true);
  setShowPreviewModal(true);
  setPreviewItems([]);
  
  try {
   const result = await api.previewImportList(list.id);
   setPreviewItems(result.items || []);
  } catch (error: any) {
   onToast('Failed to preview list', 'error');
   setShowPreviewModal(false);
  } finally {
   setPreviewLoading(false);
  }
 };

 const getTypeDisplayName = (type: string) => {
  const typeInfo = [...(listTypes.movie || []), ...(listTypes.tv || [])].find(t => t.type === type);
  return typeInfo?.name || type;
 };

 const formatLastSync = (lastSync: string | null) => {
  if (!lastSync) return 'Never';
  const date = new Date(lastSync);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
 };

 const getCurrentPresets = () => {
  const types = formData.media_type === 'movie' ? listTypes.movie : listTypes.tv;
  const typeInfo = types?.find(t => t.type === formData.type);
  return typeInfo?.presets || [];
 };

 const getPosterUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/w92${path}`;
 };

 if (loading) {
  return (
   <div className="flex items-center justify-center h-32">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
   </div>
  );
 }

 return (
  <div className="space-y-6">
   {/* Header */}
   <div className="flex justify-between items-start">
    <div>
     <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Lists</h2>
     <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Automatically import media from external lists like IMDB or TMDB</p>
    </div>
    <Button onClick={() => setShowTypeSelector(true)}>
     Add List
    </Button>
   </div>

   {/* Lists Table */}
   <div className="border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
    <div className="table-responsive">
    <table className="w-full">
     <thead>
      <tr className="border-b" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Type</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Media</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Profile</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Last Sync</th>
       <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Actions</th>
      </tr>
     </thead>
     <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
      {lists.length === 0 ? (
       <tr style={{ backgroundColor: 'var(--card-bg)' }}>
        <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
         No lists configured. Click "Add List" to get started.
        </td>
       </tr>
      ) : lists.map(list => {
       const profile = qualityProfiles.find(p => p.id === list.quality_profile_id);
       return (
        <tr 
         key={list.id} 
         style={{ backgroundColor: 'var(--card-bg)' }}
         className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
         onClick={() => openEditModal(list)}
        >
         <td className="px-4 py-4">
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{list.name}</p>
          <div className="flex items-center gap-1.5 mt-1">
           <span className={`px-1.5 py-0.5 text-[10px] font-medium ${
            list.enabled 
             ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
             : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
           }`}>
            {list.enabled ? 'Enabled' : 'Disabled'}
           </span>
           {list.enable_auto_add && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
             Auto
            </span>
           )}
          </div>
         </td>
         <td className="px-4 py-4">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
           {getTypeDisplayName(list.type)}
          </span>
         </td>
         <td className="px-4 py-4">
          <span className={`px-2 py-0.5 text-xs font-medium ${
           list.media_type === 'movie' 
            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' 
            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
          }`}>
           {list.media_type === 'movie' ? 'Movies' : 'TV Shows'}
          </span>
         </td>
         <td className="px-4 py-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{profile?.name || '-'}</p>
         </td>
         <td className="px-4 py-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{formatLastSync(list.last_sync)}</p>
         </td>
         <td className="px-4 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
           <button
            onClick={(e) => {
             e.stopPropagation();
             handlePreview(list);
            }}
            className="px-3 py-1.5 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            style={{ backgroundColor: 'var(--surface-bg)', color: 'var(--text-secondary)' }}
           >
            Preview
           </button>
           <button
            onClick={(e) => {
             e.stopPropagation();
             handleSync(list);
            }}
            disabled={syncing === list.id}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors disabled:opacity-50"
           >
            {syncing === list.id ? 'Syncing...' : 'Sync'}
           </button>
           <button
            onClick={(e) => {
             e.stopPropagation();
             setDeleteConfirm(list);
            }}
            className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            title="Delete list"
           >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
           </button>
          </div>
         </td>
        </tr>
       );
      })}
     </tbody>
    </table></div>
   </div>

   {/* Exclusion List Section */}
   <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-4">
     <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Exclusion List</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">Items that won't be re-added from import lists</p>
     </div>
     <Button
      variant="secondary"
      onClick={() => setShowExclusions(!showExclusions)}
     >
      {showExclusions ? 'Hide' : 'Show'} ({exclusionCount})
     </Button>
    </div>

    {showExclusions && (
     <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Filter Tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
       <div className="flex gap-2">
        <button
         onClick={() => setExclusionFilter('all')}
         className={`px-3 py-1.5 text-sm transition-colors ${
          exclusionFilter === 'all'
           ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
           : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
         }`}
        >
         All
        </button>
        <button
         onClick={() => setExclusionFilter('movie')}
         className={`px-3 py-1.5 text-sm transition-colors ${
          exclusionFilter === 'movie'
           ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
           : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
         }`}
        >
         Movies
        </button>
        <button
         onClick={() => setExclusionFilter('tv')}
         className={`px-3 py-1.5 text-sm transition-colors ${
          exclusionFilter === 'tv'
           ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
           : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
         }`}
        >
         TV Shows
        </button>
       </div>
       {exclusions.length > 0 && (
        <button
         onClick={handleClearExclusions}
         className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
         title={`Clear ${exclusionFilter === 'all' ? 'all' : exclusionFilter} exclusions`}
        >
         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
         </svg>
        </button>
       )}
      </div>

      {/* Exclusion Items */}
      <div className="max-h-96 overflow-y-auto">
       {exclusionsLoading ? (
        <div className="p-8 text-center">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
         <p className="text-gray-500 dark:text-gray-400 mt-2">Loading...</p>
        </div>
       ) : exclusions.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
         <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
         </svg>
         <p>No exclusions</p>
         <p className="text-sm mt-1">Items deleted with "Add to exclusion list" will appear here</p>
        </div>
       ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
         {exclusions.map(exclusion => (
          <div key={exclusion.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/50">
           <div className="flex items-center gap-3 min-w-0">
            <div 
             className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
             style={{ backgroundColor: exclusion.media_type === 'movie' ? '#7fc8f8' : '#ea9ab2' }}
            >
             {exclusion.media_type === 'movie' ? (
              <svg className="w-4 h-4" style={{ color: '#000' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
             ) : (
              <svg className="w-4 h-4" style={{ color: '#000' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
             )}
            </div>
            <div className="min-w-0">
             <p className="font-medium text-gray-900 dark:text-white truncate">
              {exclusion.title} {exclusion.year && <span className="text-gray-500">({exclusion.year})</span>}
             </p>
             <p className="text-xs text-gray-500 dark:text-gray-400">
              TMDB: {exclusion.tmdb_id} • Added {formatDate(exclusion.created_at)}
             </p>
            </div>
           </div>
           <button
            onClick={() => handleRemoveExclusion(exclusion.id)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors flex-shrink-0"
            title="Remove from exclusion list"
           >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
           </button>
          </div>
         ))}
        </div>
       )}
      </div>
     </div>
    )}
   </div>

   {/* Delete Confirmation Modal */}
   <ConfirmModal
    isOpen={!!deleteConfirm}
    title="Delete List"
    message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
    confirmText="Delete"
    onConfirm={() => {
     if (deleteConfirm) {
      handleDelete(deleteConfirm.id);
      setDeleteConfirm(null);
     }
    }}
    onCancel={() => setDeleteConfirm(null)}
    danger
   />

   {/* Sync Progress Modal */}
   {showSyncModal && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="bg-white dark:bg-gray-800 shadow-2xl w-full max-w-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
       <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {syncProgress.status === 'syncing' ? 'Syncing...' : 'Sync Complete'}
       </h2>
      </div>
      <div className="p-6">
       <div className="text-center">
        {syncProgress.status === 'syncing' ? (
         <>
          <div className="mx-auto w-12 h-12 mb-4">
           <svg className="animate-spin w-12 h-12 text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
           </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
           Syncing <span className="font-medium text-gray-900 dark:text-white">{syncProgress.listName}</span>
          </p>
          {syncProgress.currentItem && (
           <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Importing: {syncProgress.currentItem}
           </p>
          )}
          {syncProgress.total > 0 && (
           <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
             <span>Progress</span>
             <span>{syncProgress.processed} / {syncProgress.total}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
             <div 
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(syncProgress.processed / syncProgress.total) * 100}%` }}
             />
            </div>
           </div>
          )}
         </>
        ) : syncProgress.status === 'complete' ? (
         <>
          <div className="mx-auto w-12 h-12 mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
           <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
           </svg>
          </div>
          <p className="text-gray-900 dark:text-white font-medium mb-4">
           {syncProgress.listName} synced successfully
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
           <div className="bg-green-50 dark:bg-green-900/20 p-3">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{syncProgress.result?.added || 0}</p>
            <p className="text-xs text-green-700 dark:text-green-300">Added</p>
           </div>
           <div className="bg-blue-50 dark:bg-blue-900/20 p-3">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{syncProgress.result?.existing || 0}</p>
            <p className="text-xs text-blue-700 dark:text-blue-300">Existing</p>
           </div>
           <div className="bg-red-50 dark:bg-red-900/20 p-3">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{syncProgress.result?.failed || 0}</p>
            <p className="text-xs text-red-700 dark:text-red-300">Failed</p>
           </div>
          </div>
         </>
        ) : (
         <>
          <div className="mx-auto w-12 h-12 mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
           <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
           </svg>
          </div>
          <p className="text-gray-900 dark:text-white font-medium">Sync Failed</p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">{syncProgress.result?.message}</p>
         </>
        )}
       </div>
      </div>
      {syncProgress.status !== 'syncing' && (
       <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
        <Button onClick={() => setShowSyncModal(false)}>Close</Button>
       </div>
      )}
     </div>
    </div>
   )}

   {/* Preview Modal with Poster/Synopsis */}
   {showPreviewModal && previewList && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="bg-white dark:bg-gray-800 shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
       <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preview: {previewList.name}</h2>
        {!previewLoading && (
         <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {previewItems.filter(i => !i.in_library).length} new, {previewItems.filter(i => i.in_library).length} already in library
         </p>
        )}
       </div>
       <button
        onClick={() => setShowPreviewModal(false)}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 "
       >
        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
       </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
       {previewLoading ? (
        <div className="flex items-center justify-center py-12">
         <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
         </svg>
        </div>
       ) : previewItems.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
         No items found in this list
        </div>
       ) : (
        <div className="space-y-3">
         {previewItems.map((item, idx) => (
          <div 
           key={idx} 
           className={`flex gap-4 p-3 border ${
            item.in_library 
             ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' 
             : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
           }`}
          >
           {/* Poster */}
           <div className="flex-shrink-0 w-16 h-24 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
            {item.poster_path ? (
             <img 
              src={getPosterUrl(item.poster_path) || ''} 
              alt={item.title}
              className="w-full h-full object-cover"
              onError={(e) => {
               (e.target as HTMLImageElement).style.display = 'none';
              }}
             />
            ) : (
             <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
             </div>
            )}
           </div>
           
           {/* Info */}
           <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
             <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white">
               {item.title}
               {item.year && <span className="text-gray-500 dark:text-gray-400 font-normal"> ({item.year})</span>}
              </p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
               {item.vote_average !== undefined && item.vote_average > 0 && (
                <span className="flex items-center gap-1 text-xs">
                 <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                 </svg>
                 <span className="text-gray-600 dark:text-gray-300">{item.vote_average.toFixed(1)}</span>
                </span>
               )}
               {item.network && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{item.network}</span>
               )}
              </div>
              {item.genres && item.genres.length > 0 && (
               <div className="flex flex-wrap gap-1 mt-1.5">
                {item.genres.slice(0, 3).map((genre, gidx) => (
                 <span key={gidx} className="px-1.5 py-0.5 text-[10px] rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                  {genre}
                 </span>
                ))}
               </div>
              )}
             </div>
             {item.in_library && (
              <span className="flex-shrink-0 px-2 py-1 text-xs font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
               In Library
              </span>
             )}
            </div>
            {item.overview && (
             <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
              {item.overview}
             </p>
            )}
           </div>
          </div>
         ))}
        </div>
       )}
      </div>
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
       <p className="text-sm text-gray-500 dark:text-gray-400">
        {previewItems.length} items total
       </p>
       <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>Close</Button>
        <Button onClick={() => { setShowPreviewModal(false); handleSync(previewList); }}>
         Sync Now
        </Button>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* List Type Selector Modal */}
   {showTypeSelector && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="bg-white dark:bg-gray-800 shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
       <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add List</h2>
       <button
        onClick={() => setShowTypeSelector(false)}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 "
       >
        <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
       </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
       {/* Movies Section */}
       <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Movies</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
         {(listTypes.movie || []).map(type => (
          <button
           key={type.type}
           onClick={() => openAddModal('movie', type)}
           className="p-4 text-left bg-gray-50 dark:bg-gray-700/50 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-700 transition-colors group"
          >
           <div className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
            {type.name}
           </div>
           <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{type.description}</div>
          </button>
         ))}
        </div>
       </div>

       {/* TV Section */}
       <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">TV Series</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
         {(listTypes.tv || []).map(type => (
          <button
           key={type.type}
           onClick={() => openAddModal('tv', type)}
           className="p-4 text-left bg-gray-50 dark:bg-gray-700/50 hover:bg-primary-50 dark:hover:bg-primary-900/20 border border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-700 transition-colors group"
          >
           <div className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
            {type.name}
           </div>
           <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{type.description}</div>
          </button>
         ))}
        </div>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* Add/Edit Form Modal */}
   {showModal && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="bg-white dark:bg-gray-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
      {/* Modal Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
       <div className="flex items-center justify-between">
        <div>
         <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {editingList ? 'Edit List' : 'Add List'} - {selectedListType?.name || formData.type}
         </h2>
         <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {formData.media_type === 'movie' ? 'Movies' : 'TV Series'}
         </p>
        </div>
        <button
         onClick={() => { setShowModal(false); setEditingList(null); resetForm(); }}
         className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 "
        >
         <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
         </svg>
        </button>
       </div>
      </div>

      {/* Modal Body */}
      <div className="flex-1 overflow-y-auto p-6">
       <div className="space-y-5">
        {/* Name */}
        <div className="grid grid-cols-3 gap-4 items-start">
         <label className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2 text-right">
          Name
         </label>
         <div className="col-span-2">
          <Input
           value={formData.name}
           onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
           placeholder="List name"
          />
         </div>
        </div>

        {/* Enable */}
        <div className="grid grid-cols-3 gap-4 items-start">
         <label className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2 text-right">
          Enable
         </label>
         <div className="col-span-2">
          <label className="flex items-start gap-3 cursor-pointer">
           <input
            type="checkbox"
            checked={formData.enabled}
            onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
            className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
           />
           <span className="text-sm text-gray-600 dark:text-gray-400">
            Enable this list
           </span>
          </label>
         </div>
        </div>

        {/* Enable Automatic Add */}
        <div className="grid grid-cols-3 gap-4 items-start">
         <label className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2 text-right">
          Auto Add
         </label>
         <div className="col-span-2">
          <label className="flex items-start gap-3 cursor-pointer">
           <input
            type="checkbox"
            checked={formData.enable_auto_add}
            onChange={(e) => setFormData(prev => ({ ...prev, enable_auto_add: e.target.checked }))}
            className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
           />
           <span className="text-sm text-gray-600 dark:text-gray-400">
            Automatically add items to library
           </span>
          </label>
         </div>
        </div>

        {/* Search on Add */}
        <div className="grid grid-cols-3 gap-4 items-start">
         <label className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2 text-right">
          Search on Add
         </label>
         <div className="col-span-2">
          <label className="flex items-start gap-3 cursor-pointer">
           <input
            type="checkbox"
            checked={formData.search_on_add}
            onChange={(e) => setFormData(prev => ({ ...prev, search_on_add: e.target.checked }))}
            className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
           />
           <span className="text-sm text-gray-600 dark:text-gray-400">
            Search for downloads when added
           </span>
          </label>
         </div>
        </div>

        {/* Monitor - TV Only */}
        {formData.media_type === 'tv' && (
         <div className="grid grid-cols-3 gap-4 items-start">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2 text-right">
           Monitor
          </label>
          <div className="col-span-2">
           <select
            value={formData.monitor}
            onChange={(e) => setFormData(prev => ({ ...prev, monitor: e.target.value }))}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
           >
            <option value="all">All Episodes</option>
            <option value="future">Future Episodes</option>
            <option value="missing">Missing Episodes</option>
            <option value="firstSeason">First Season</option>
            <option value="latestSeason">Latest Season</option>
            <option value="none">None</option>
           </select>
          </div>
         </div>
        )}

        {/* Root Folder */}
        <div className="grid grid-cols-3 gap-4 items-start">
         <label className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2 text-right">
          Root Folder
         </label>
         <div className="col-span-2">
          <Input
           value={formData.root_folder}
           onChange={(e) => setFormData(prev => ({ ...prev, root_folder: e.target.value }))}
           placeholder={formData.media_type === 'movie' ? '/data/media/movies' : '/data/media/tv'}
          />
         </div>
        </div>

        {/* Quality Profile */}
        <div className="grid grid-cols-3 gap-4 items-start">
         <label className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2 text-right">
          Quality Profile
         </label>
         <div className="col-span-2">
          <select
           value={formData.quality_profile_id}
           onChange={(e) => setFormData(prev => ({ ...prev, quality_profile_id: e.target.value }))}
           className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
          >
           <option value="">Select a profile</option>
           {qualityProfiles
            .filter((profile: any) => !profile.media_type || profile.media_type === 'both' || profile.media_type === (formData.media_type === 'tv' ? 'series' : 'movie'))
            .map(profile => (
             <option key={profile.id} value={profile.id}>{profile.name}</option>
           ))}
          </select>
         </div>
        </div>

        {/* Presets */}
        {getCurrentPresets().length > 0 && (
         <div className="grid grid-cols-3 gap-4 items-start">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2 text-right">
           Presets
          </label>
          <div className="col-span-2">
           <select
            value={formData.list_id}
            onChange={(e) => {
             const preset = getCurrentPresets().find(p => p.listId === e.target.value);
             setFormData(prev => ({
              ...prev,
              list_id: e.target.value,
              name: preset?.name || prev.name
             }));
            }}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
           >
            <option value="">Custom</option>
            {getCurrentPresets().map(preset => (
             <option key={preset.id} value={preset.listId}>{preset.name}</option>
            ))}
           </select>
          </div>
         </div>
        )}

        {/* List ID */}
        <div className="grid grid-cols-3 gap-4 items-start">
         <label className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2 text-right">
          List ID
         </label>
         <div className="col-span-2">
          <Input
           value={formData.list_id}
           onChange={(e) => setFormData(prev => ({ ...prev, list_id: e.target.value }))}
           placeholder="List identifier"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
           {formData.type === 'stevenlu' && "No configuration needed"}
           {formData.type === 'imdb' && "ls12345678 or top250, popular"}
           {formData.type === 'tmdb' && "popular, top_rated, now_playing, upcoming"}
           {formData.type === 'trakt' && "trending, popular, anticipated"}
          </p>
         </div>
        </div>

        {/* Refresh Interval */}
        <div className="grid grid-cols-3 gap-4 items-start">
         <label className="text-sm font-medium text-gray-700 dark:text-gray-300 pt-2 text-right">
          Refresh
         </label>
         <div className="col-span-2">
          <select
           value={formData.refresh_interval}
           onChange={(e) => setFormData(prev => ({ ...prev, refresh_interval: parseInt(e.target.value) }))}
           className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
          >
           <option value={360}>Every 6 hours</option>
           <option value={720}>Every 12 hours</option>
           <option value={1440}>Every 24 hours</option>
           <option value={10080}>Every 7 days</option>
          </select>
         </div>
        </div>
       </div>
      </div>

      {/* Modal Footer */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
       <div>
        {editingList && (
         <button
          onClick={() => {
           setShowModal(false);
           setDeleteConfirm(editingList);
          }}
          className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium"
         >
          Delete
         </button>
        )}
       </div>
       <div className="flex gap-3">
        <Button
         variant="secondary"
         onClick={() => { setShowModal(false); setEditingList(null); resetForm(); }}
        >
         Cancel
        </Button>
        <Button onClick={handleSave}>
         {editingList ? 'Save' : 'Add'}
        </Button>
       </div>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}
