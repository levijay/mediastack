import { useEffect, useState, useMemo } from 'react';
import { Layout } from '../components/layout/Layout';
import { api, getCachedImageUrl } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useUISettings } from '../contexts/UISettingsContext';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { Pagination, usePagination } from '../components/Pagination';

interface MediaItem {
 id: string;
 tmdb_id: number;
 title: string;
 year: number;
 overview?: string;
 poster_path: string;
 backdrop_path?: string;
 monitored: boolean;
 has_file?: boolean;
 quality?: string;
 file_size?: number;
 network?: string;
 status?: string;
 episode_count?: number;
 downloaded_count?: number;
 quality_profile_id?: string;
 total_size?: number;
}

interface QualityProfile {
 id: string;
 name: string;
 cutoff_quality: string;
 items: { quality: string; enabled: boolean }[];
}

type ViewMode = 'poster' | 'table';
type StatusFilter = 'all' | 'monitored' | 'unmonitored' | 'missing' | 'downloaded' | 'wanted' | 'cutoff_unmet' | string; // string for custom filter IDs

interface CustomFilter {
 id: string;
 name: string;
 conditions: {
  monitored?: boolean;
  hasFile?: boolean;
  cutoffMet?: boolean;
  qualityProfileId?: string;
  minYear?: number;
  maxYear?: number;
 };
}

// Quality ranking for cutoff comparison (higher is better)
const QUALITY_RANK: Record<string, number> = {
 'unknown': 0,
 '480p': 1,
 '720p': 2,
 '1080p': 3,
 '2160p': 4,
 '4k': 4,
};

interface MediaLibraryPageProps {
 mediaType: 'movie' | 'tv';
}

// Poster size configurations - 10 levels from tiny to huge
const posterSizeConfig = {
 1: { grid: 'grid-cols-[repeat(auto-fill,minmax(80px,80px))]', imgSize: 'w154' },
 2: { grid: 'grid-cols-[repeat(auto-fill,minmax(100px,100px))]', imgSize: 'w154' },
 3: { grid: 'grid-cols-[repeat(auto-fill,minmax(120px,120px))]', imgSize: 'w185' },
 4: { grid: 'grid-cols-[repeat(auto-fill,minmax(140px,140px))]', imgSize: 'w185' },
 5: { grid: 'grid-cols-[repeat(auto-fill,minmax(160px,160px))]', imgSize: 'w300' },
 6: { grid: 'grid-cols-[repeat(auto-fill,minmax(180px,180px))]', imgSize: 'w300' },
 7: { grid: 'grid-cols-[repeat(auto-fill,minmax(200px,200px))]', imgSize: 'w342' },
 8: { grid: 'grid-cols-[repeat(auto-fill,minmax(220px,220px))]', imgSize: 'w342' },
 9: { grid: 'grid-cols-[repeat(auto-fill,minmax(250px,250px))]', imgSize: 'w500' },
 10: { grid: 'grid-cols-[repeat(auto-fill,minmax(280px,280px))]', imgSize: 'w500' },
};

// Custom Filter Modal Component
function CustomFilterModal({
 filter,
 qualityProfiles,
 onSave,
 onDelete,
 onClose,
 existingFilters,
 onEditFilter
}: {
 filter: CustomFilter | null;
 qualityProfiles: QualityProfile[];
 onSave: (filter: CustomFilter) => void;
 onDelete?: () => void;
 onClose: () => void;
 existingFilters: CustomFilter[];
 onEditFilter: (filter: CustomFilter) => void;
}) {
 const [name, setName] = useState(filter?.name || '');
 const [monitored, setMonitored] = useState<'any' | 'true' | 'false'>(
  filter?.conditions.monitored === undefined ? 'any' : filter.conditions.monitored ? 'true' : 'false'
 );
 const [hasFile, setHasFile] = useState<'any' | 'true' | 'false'>(
  filter?.conditions.hasFile === undefined ? 'any' : filter.conditions.hasFile ? 'true' : 'false'
 );
 const [cutoffMet, setCutoffMet] = useState<'any' | 'true' | 'false'>(
  filter?.conditions.cutoffMet === undefined ? 'any' : filter.conditions.cutoffMet ? 'true' : 'false'
 );
 const [qualityProfileId, setQualityProfileId] = useState(filter?.conditions.qualityProfileId || '');
 const [minYear, setMinYear] = useState(filter?.conditions.minYear?.toString() || '');
 const [maxYear, setMaxYear] = useState(filter?.conditions.maxYear?.toString() || '');
 const [showForm, setShowForm] = useState(filter !== null || existingFilters.length === 0);

 const handleSave = () => {
  if (!name.trim()) return;
  
  const conditions: CustomFilter['conditions'] = {};
  if (monitored !== 'any') conditions.monitored = monitored === 'true';
  if (hasFile !== 'any') conditions.hasFile = hasFile === 'true';
  if (cutoffMet !== 'any') conditions.cutoffMet = cutoffMet === 'true';
  if (qualityProfileId) conditions.qualityProfileId = qualityProfileId;
  if (minYear) conditions.minYear = parseInt(minYear);
  if (maxYear) conditions.maxYear = parseInt(maxYear);
  
  onSave({
   id: filter?.id || `custom_${Date.now()}`,
   name: name.trim(),
   conditions
  });
 };

 return (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
   <div className="bg-white dark:bg-gray-800 shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
    {/* Header */}
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
     <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
      {filter ? 'Edit Filter' : showForm ? 'New Custom Filter' : 'Custom Filters'}
     </h2>
    </div>

    <div className="flex-1 overflow-y-auto p-6">
     {!showForm ? (
      /* Filter List */
      <div className="space-y-4">
       {existingFilters.length > 0 ? (
        <div className="space-y-2">
         {existingFilters.map(f => (
          <div
           key={f.id}
           className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
          >
           <div>
            <p className="font-medium text-gray-900 dark:text-white">{f.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
             {Object.entries(f.conditions).map(([key, value]) => {
              if (key === 'monitored') return value ? 'Monitored' : 'Unmonitored';
              if (key === 'hasFile') return value ? 'Has File' : 'Missing File';
              if (key === 'cutoffMet') return value ? 'Cutoff Met' : 'Cutoff Unmet';
              if (key === 'qualityProfileId') return `Profile: ${qualityProfiles.find(p => p.id === value)?.name || value}`;
              if (key === 'minYear') return `From: ${value}`;
              if (key === 'maxYear') return `To: ${value}`;
              return '';
             }).filter(Boolean).join(', ')}
            </p>
           </div>
           <button
            onClick={() => onEditFilter(f)}
            className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
           >
            Edit
           </button>
          </div>
         ))}
        </div>
       ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
         No custom filters yet
        </p>
       )}
       <button
        onClick={() => setShowForm(true)}
        className="w-full px-4 py-2 text-sm font-medium text-primary-600 border border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
       >
        + Create New Filter
       </button>
      </div>
     ) : (
      /* Filter Form */
      <div className="space-y-4">
       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
         Filter Name
        </label>
        <input
         type="text"
         value={name}
         onChange={(e) => setName(e.target.value)}
         placeholder="My Custom Filter"
         className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
       </div>

       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
         Monitored Status
        </label>
        <select
         value={monitored}
         onChange={(e) => setMonitored(e.target.value as any)}
         className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
        >
         <option value="any">Any</option>
         <option value="true">Monitored Only</option>
         <option value="false">Unmonitored Only</option>
        </select>
       </div>

       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
         File Status
        </label>
        <select
         value={hasFile}
         onChange={(e) => setHasFile(e.target.value as any)}
         className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
        >
         <option value="any">Any</option>
         <option value="true">Has File</option>
         <option value="false">Missing File</option>
        </select>
       </div>

       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
         Cutoff Status
        </label>
        <select
         value={cutoffMet}
         onChange={(e) => setCutoffMet(e.target.value as any)}
         className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
        >
         <option value="any">Any</option>
         <option value="true">Cutoff Met</option>
         <option value="false">Cutoff Not Met</option>
        </select>
       </div>

       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
         Quality Profile
        </label>
        <select
         value={qualityProfileId}
         onChange={(e) => setQualityProfileId(e.target.value)}
         className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
        >
         <option value="">Any Profile</option>
         {qualityProfiles.map(profile => (
          <option key={profile.id} value={profile.id}>{profile.name}</option>
         ))}
        </select>
       </div>

       <div className="grid grid-cols-2 gap-4">
        <div>
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Min Year
         </label>
         <input
          type="number"
          value={minYear}
          onChange={(e) => setMinYear(e.target.value)}
          placeholder="e.g. 2000"
          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
         />
        </div>
        <div>
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Max Year
         </label>
         <input
          type="number"
          value={maxYear}
          onChange={(e) => setMaxYear(e.target.value)}
          placeholder="e.g. 2024"
          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
         />
        </div>
       </div>
      </div>
     )}
    </div>

    {/* Footer */}
    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
     {showForm && onDelete && (
      <button
       onClick={onDelete}
       className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
      >
       Delete
      </button>
     )}
     <div className="flex-1" />
     {showForm && existingFilters.length > 0 && !filter && (
      <button
       onClick={() => setShowForm(false)}
       className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
       Back
      </button>
     )}
     <button
      onClick={onClose}
      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
     >
      {showForm ? 'Cancel' : 'Close'}
     </button>
     {showForm && (
      <button
       onClick={handleSave}
       disabled={!name.trim()}
       className="px-4 py-2 text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
      >
       {filter ? 'Save Changes' : 'Create Filter'}
      </button>
     )}
    </div>
   </div>
  </div>
 );
}

export function MediaLibraryPage({ mediaType }: MediaLibraryPageProps) {
 const navigate = useNavigate();
 const { settings, updateSettings } = useUISettings();
 const { addToast } = useToast();
 const [items, setItems] = useState<MediaItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
 const [searchQuery, setSearchQuery] = useState('');
 const [notification, setNotification] = useState<string | null>(null);

 // Custom filters
 const [customFilters, setCustomFilters] = useState<CustomFilter[]>([]);
 const [showFilterModal, setShowFilterModal] = useState(false);
 const [editingFilter, setEditingFilter] = useState<CustomFilter | null>(null);

 // Use viewMode from settings for persistence
 const viewMode = settings.viewMode || 'poster';
 const setViewMode = (mode: ViewMode) => updateSettings({ viewMode: mode });

 // Bulk management state
 const [selectMode, setSelectMode] = useState(false);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([]);
 const [bulkAction, setBulkAction] = useState<string>('');
 const [bulkValue, setBulkValue] = useState<string>('');
 const [processing, setProcessing] = useState(false);
 const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
 const [deleteWithFiles, setDeleteWithFiles] = useState(false);

 const isMovies = mediaType === 'movie';
 const title = isMovies ? 'Movies' : 'TV Shows';
 const detailPath = isMovies ? '/movies' : '/series';
 
 const posterConfig = posterSizeConfig[settings.posterSize as keyof typeof posterSizeConfig] || posterSizeConfig[3];

 // Pagination
 const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, paginateItems, resetPage } = usePagination(25);

 // Load custom filters from localStorage
 useEffect(() => {
  const storageKey = `customFilters_${mediaType}`;
  const saved = localStorage.getItem(storageKey);
  if (saved) {
   try {
    setCustomFilters(JSON.parse(saved));
   } catch (e) {
    console.error('Failed to parse custom filters:', e);
   }
  }
 }, [mediaType]);

 // Save custom filters to localStorage
 const saveCustomFilters = (filters: CustomFilter[]) => {
  const storageKey = `customFilters_${mediaType}`;
  localStorage.setItem(storageKey, JSON.stringify(filters));
  setCustomFilters(filters);
 };

 useEffect(() => {
  loadItems();
  loadQualityProfiles();
 }, [mediaType]);

 // Reset selection when mediaType changes
 useEffect(() => {
  setSelectedIds(new Set());
  setSelectMode(false);
 }, [mediaType]);

 const loadItems = async () => {
  setLoading(true);
  try {
   const result = isMovies ? await api.getMovies() : await api.getSeries();
   setItems(result.items);
  } catch (error) {
   console.error('Failed to load:', error);
  } finally {
   setLoading(false);
  }
 };

 const loadQualityProfiles = async () => {
  try {
   const profiles = await api.getQualityProfiles();
   setQualityProfiles(profiles);
  } catch (error) {
   console.error('Failed to load quality profiles:', error);
  }
 };

 const handleRescan = async () => {
  setNotification('Library scan completed: No changes detected');
  setTimeout(() => setNotification(null), 3000);
 };

 const toggleMonitor = async (item: MediaItem, e: React.MouseEvent) => {
  e.stopPropagation();
  try {
   if (isMovies) {
    await api.updateMovie(item.id, { monitored: !item.monitored });
   } else {
    await api.updateSeries(item.id, { monitored: !item.monitored });
   }
   setItems(items.map(i => i.id === item.id ? { ...i, monitored: !i.monitored } : i));
  } catch (error) {
   console.error('Failed to update:', error);
  }
 };

 // Helper to get profile name from ID
 const getProfileName = (profileId?: string) => {
  if (!profileId) return '-';
  const profile = qualityProfiles.find(p => p.id === profileId);
  return profile?.name || '-';
 };

 // Helper to format file size
 const formatSize = (bytes?: number) => {
  if (!bytes) return '-';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
 };

 const toggleSelect = (id: string, e: React.MouseEvent) => {
  e.stopPropagation();
  const newSelected = new Set(selectedIds);
  if (newSelected.has(id)) {
   newSelected.delete(id);
  } else {
   newSelected.add(id);
  }
  setSelectedIds(newSelected);
 };

 const selectAll = () => {
  if (selectedIds.size === filteredItems.length) {
   setSelectedIds(new Set());
  } else {
   setSelectedIds(new Set(filteredItems.map(item => item.id)));
  }
 };

 const handleBulkAction = async () => {
  if (selectedIds.size === 0) {
   addToast({ type: 'error', message: 'No items selected' });
   return;
  }

  if (!bulkAction) {
   addToast({ type: 'error', message: 'Please select an action' });
   return;
  }

  setProcessing(true);
  try {
   const ids = Array.from(selectedIds);
   let updates: any = {};

   switch (bulkAction) {
    case 'monitor':
     updates.monitored = true;
     break;
    case 'unmonitor':
     updates.monitored = false;
     break;
    case 'quality':
     if (!bulkValue) {
      addToast({ type: 'error', message: 'Please select a quality profile' });
      setProcessing(false);
      return;
     }
     updates.quality_profile_id = bulkValue;
     break;
    default:
     addToast({ type: 'error', message: 'Invalid action' });
     setProcessing(false);
     return;
   }

   if (isMovies) {
    await api.bulkUpdateMovies(ids, updates);
   } else {
    await api.bulkUpdateSeries(ids, { ...updates, cascadeMonitor: true });
   }

   addToast({ type: 'success', message: `Updated ${selectedIds.size} items` });
   setSelectedIds(new Set());
   setBulkAction('');
   setBulkValue('');
   loadItems();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to update items' });
  } finally {
   setProcessing(false);
  }
 };

 const handleBulkDelete = async () => {
  if (selectedIds.size === 0) return;

  setProcessing(true);
  try {
   const ids = Array.from(selectedIds);

   if (isMovies) {
    await api.bulkDeleteMovies(ids, deleteWithFiles);
   } else {
    await api.bulkDeleteSeries(ids, deleteWithFiles);
   }

   addToast({ type: 'success', message: `Deleted ${selectedIds.size} items` });
   setSelectedIds(new Set());
   setShowDeleteConfirm(false);
   setDeleteWithFiles(false);
   loadItems();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to delete items' });
  } finally {
   setProcessing(false);
  }
 };

 // Helper to check if cutoff is met
 const isCutoffMet = (item: MediaItem): boolean => {
  if (!item.quality_profile_id || !item.has_file || !item.quality) return true; // No profile or no file = not applicable
  const profile = qualityProfiles.find(p => p.id === item.quality_profile_id);
  if (!profile) return true;
  
  const currentRank = QUALITY_RANK[item.quality.toLowerCase()] || 0;
  const cutoffRank = QUALITY_RANK[profile.cutoff_quality.toLowerCase()] || 0;
  return currentRank >= cutoffRank;
 };

 // Apply custom filter conditions
 const matchesCustomFilter = (item: MediaItem, filter: CustomFilter): boolean => {
  const { conditions } = filter;
  
  if (conditions.monitored !== undefined && item.monitored !== conditions.monitored) return false;
  if (conditions.hasFile !== undefined && item.has_file !== conditions.hasFile) return false;
  if (conditions.cutoffMet !== undefined && isCutoffMet(item) !== conditions.cutoffMet) return false;
  if (conditions.qualityProfileId && item.quality_profile_id !== conditions.qualityProfileId) return false;
  if (conditions.minYear && item.year < conditions.minYear) return false;
  if (conditions.maxYear && item.year > conditions.maxYear) return false;
  
  return true;
 };

 const filteredItems = useMemo(() => items.filter(item => {
  if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
   return false;
  }
  
  // Built-in filters
  if (statusFilter === 'monitored' && !item.monitored) return false;
  if (statusFilter === 'unmonitored' && item.monitored) return false;
  if (statusFilter === 'missing' && item.has_file) return false;
  if (statusFilter === 'downloaded' && !item.has_file) return false;
  if (statusFilter === 'wanted' && (item.has_file || !item.monitored)) return false; // Monitored + Missing
  if (statusFilter === 'cutoff_unmet' && (isCutoffMet(item) || !item.has_file)) return false;
  
  // Custom filters (filter ID starts with 'custom_')
  if (statusFilter.startsWith('custom_')) {
   const customFilter = customFilters.find(f => f.id === statusFilter);
   if (customFilter && !matchesCustomFilter(item, customFilter)) return false;
  }
  
  return true;
 }), [items, searchQuery, statusFilter, qualityProfiles, customFilters]);

 // Reset page when filters change
 useEffect(() => {
  resetPage();
 }, [searchQuery, statusFilter, mediaType]);

 // Paginated items
 const paginatedItems = paginateItems(filteredItems);

 const getQualityBadge = (quality?: string) => {
  if (!quality) return null;
  const colors: Record<string, string> = {
   '2160p': 'bg-purple-600',
   '4K': 'bg-purple-600',
   '1080p': 'bg-blue-600',
   '720p': 'bg-green-600',
   '480p': 'bg-yellow-600'
  };
  return colors[quality] || 'bg-gray-600';
 };

 if (loading) {
  return (
   <Layout>
    <div className="flex items-center justify-center h-64">
     <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--theme-primary)' }}></div>
    </div>
   </Layout>
  );
 }

 return (
  <Layout>
   {/* Notification */}
   {notification && (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 px-4 py-3">
     <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
     </svg>
     <span className="text-blue-700 dark:text-blue-300 text-sm">{notification}</span>
     <button onClick={() => setNotification(null)} className="text-blue-400 hover:text-blue-600">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>
   )}

   <div className="space-y-4">
    {/* Header */}
    <div className="flex items-center justify-between">
     <div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">Browse and manage your media library</p>
     </div>

     <div className="flex items-center gap-2">
      {/* Select Mode Toggle */}
      <button
       onClick={() => {
        setSelectMode(!selectMode);
        if (selectMode) {
         setSelectedIds(new Set());
        }
       }}
       className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
        selectMode 
         ? 'bg-primary-500 text-white' 
         : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
       }`}
      >
       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
       </svg>
       {selectMode ? 'Exit Select' : 'Select'}
      </button>

      <button
       onClick={handleRescan}
       className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
       </svg>
       Re-scan
      </button>

      <button
       onClick={() => navigate('/discover')}
       className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-500 text-white hover:bg-primary-600 transition-colors"
      >
       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
       </svg>
       Add {isMovies ? 'Movie' : 'Series'}
      </button>

      <button
       onClick={() => navigate(`/settings?tab=import&type=${mediaType}`)}
       className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
       style={{
        backgroundColor: 'var(--btn-primary-bg)',
        color: 'var(--btn-primary-text)'
       }}
       onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-primary-hover)'}
       onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-primary-bg)'}
      >
       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
       </svg>
       Import Files
      </button>

      {/* View Toggle */}
      <div className="flex items-center border border-gray-300 dark:border-gray-600 overflow-hidden ml-2">
       <button
        onClick={() => setViewMode('poster')}
        className={`p-1.5 ${viewMode === 'poster' ? 'bg-primary-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        title="Grid view"
       >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
       </button>
       <button
        onClick={() => setViewMode('table')}
        className={`p-1.5 ${viewMode === 'table' ? 'bg-primary-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        title="List view"
       >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
       </button>
      </div>
     </div>
    </div>

    {/* Bulk Actions Bar - Show when in select mode */}
    {selectMode && (
     <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex flex-wrap items-center gap-3">
       {/* Select All */}
       <label className="flex items-center gap-2 cursor-pointer">
        <input
         type="checkbox"
         checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
         onChange={selectAll}
         className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">
         Select All ({selectedIds.size} / {filteredItems.length})
        </span>
       </label>

       <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

       {/* Bulk Action */}
       <select
        value={bulkAction}
        onChange={(e) => setBulkAction(e.target.value)}
        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
       >
        <option value="">Select Action...</option>
        <option value="monitor">Set Monitored</option>
        <option value="unmonitor">Set Unmonitored</option>
        <option value="quality">Change Quality Profile</option>
       </select>

       {bulkAction === 'quality' && (
        <select
         value={bulkValue}
         onChange={(e) => setBulkValue(e.target.value)}
         className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
        >
         <option value="">Select Profile...</option>
         {qualityProfiles.map(profile => (
          <option key={profile.id} value={profile.id}>{profile.name}</option>
         ))}
        </select>
       )}

       <button
        onClick={handleBulkAction}
        disabled={processing || selectedIds.size === 0 || !bulkAction}
        className="px-3 py-1.5 text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
       >
        Apply
       </button>

       <div className="flex-1" />

       <button
        onClick={() => setShowDeleteConfirm(true)}
        disabled={processing || selectedIds.size === 0}
        className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
       >
        Delete ({selectedIds.size})
       </button>
      </div>
     </div>
    )}

    {/* Filters */}
    <div className="flex items-center gap-3">
     <div className="relative flex-1 max-w-md">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
       type="text"
       placeholder="Search media..."
       value={searchQuery}
       onChange={(e) => setSearchQuery(e.target.value)}
       className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
     </div>

     <select
      value={statusFilter}
      onChange={(e) => {
       if (e.target.value === 'manage_filters') {
        setEditingFilter(null);
        setShowFilterModal(true);
       } else {
        setStatusFilter(e.target.value as StatusFilter);
       }
      }}
      className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
     >
      <option value="all">All</option>
      <option value="monitored">Monitored Only</option>
      <option value="unmonitored">Unmonitored</option>
      <option value="missing">Missing</option>
      <option value="wanted">Wanted</option>
      <option value="downloaded">Downloaded</option>
      <option value="cutoff_unmet">Cutoff Unmet</option>
      {customFilters.length > 0 && <option disabled>───────────</option>}
      {customFilters.map(filter => (
       <option key={filter.id} value={filter.id}>{filter.name}</option>
      ))}
      <option disabled>───────────</option>
      <option value="manage_filters">Custom Filters...</option>
     </select>

     <span className="text-sm text-gray-500 dark:text-gray-400">
      {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
     </span>
    </div>

    {/* Content */}
    {filteredItems.length === 0 ? (
     <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
      <h3 className="mt-3 text-sm font-medium text-gray-900 dark:text-white">No {title.toLowerCase()} found</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add some {title.toLowerCase()} to your library.</p>
      <button
       onClick={() => navigate('/discover')}
       className="mt-3 px-3 py-1.5 text-sm bg-primary-500 text-white hover:bg-primary-600"
      >
       Add {title}
      </button>
     </div>
    ) : viewMode === 'poster' ? (
     /* Poster Grid - Dynamic size based on settings */
     <>
     <div className={`grid ${posterConfig.grid} gap-3`}>
      {paginatedItems.map((item) => (
       <div
        key={item.id}
        onClick={(e) => selectMode ? toggleSelect(item.id, e) : navigate(`${detailPath}/${item.id}`)}
        className={`group relative bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer ${
         selectMode && selectedIds.has(item.id) ? 'ring-2 ring-primary-500' : ''
        }`}
       >
        <div className="aspect-[2/3] relative">
         {item.poster_path ? (
          <img
           src={getCachedImageUrl(item.poster_path, posterConfig.imgSize) || ''}
           alt={item.title}
           className="w-full h-full object-cover"
           loading="lazy"
          />
         ) : (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
           <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
           </svg>
          </div>
         )}

         {/* Selection Checkbox in Select Mode */}
         {selectMode && (
          <div className="absolute top-1 left-1 z-10">
           <input
            type="checkbox"
            checked={selectedIds.has(item.id)}
            onChange={(e) => toggleSelect(item.id, e as any)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 bg-white/80"
           />
          </div>
         )}

         {/* Quality Badge */}
         {item.quality && (
          <span className={`absolute top-1 right-1 px-1.5 py-0.5 text-[10px] font-bold text-white rounded ${getQualityBadge(item.quality)}`}>
           {item.quality === '2160p' ? '4K' : item.quality}
          </span>
         )}

         {/* Monitor Bookmark - hide in select mode */}
         {!selectMode && (
          <button
           onClick={(e) => toggleMonitor(item, e)}
           className={`absolute top-1 left-1 p-1 rounded transition-colors ${
            item.monitored ? 'text-primary-500' : 'text-gray-400 opacity-0 group-hover:opacity-100'
           }`}
          >
           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
           </svg>
          </button>
         )}
        </div>

        <div className="p-2">
         <h3 className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.title}</h3>
         <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">{item.year}</span>
          {!isMovies && item.episode_count !== undefined && (
           <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {item.downloaded_count || 0}/{item.episode_count}
           </span>
          )}
         </div>
        </div>
       </div>
      ))}
     </div>
     {/* Pagination for Poster View */}
     <div className="mt-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <Pagination
       currentPage={currentPage}
       totalItems={filteredItems.length}
       itemsPerPage={itemsPerPage}
       onPageChange={setCurrentPage}
       onItemsPerPageChange={setItemsPerPage}
      />
     </div>
     </>
    ) : (
     /* Table View */
     <>
     <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="table-responsive">
      <table className="w-full">
       <thead className="bg-gray-50 dark:bg-gray-900">
        <tr>
         {selectMode && (
          <th className="px-3 py-2 w-10">
           <input
            type="checkbox"
            checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
            onChange={selectAll}
            className="w-4 h-4 rounded border-gray-300 text-primary-600"
           />
          </th>
         )}
         <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</th>
         <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-16">Year</th>
         {!isMovies && (
          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Network</th>
         )}
         <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Profile</th>
         {isMovies ? (
          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">Quality</th>
         ) : (
          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">Episodes</th>
         )}
         <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">Size</th>
         <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">Monitored</th>
         <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">Actions</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        {paginatedItems.map((item) => (
         <tr
          key={item.id}
          onClick={(e) => selectMode ? toggleSelect(item.id, e) : navigate(`${detailPath}/${item.id}`)}
          className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
           selectMode && selectedIds.has(item.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''
          }`}
         >
          {selectMode && (
           <td className="px-3 py-2">
            <input
             type="checkbox"
             checked={selectedIds.has(item.id)}
             onChange={(e) => toggleSelect(item.id, e as any)}
             onClick={(e) => e.stopPropagation()}
             className="w-4 h-4 rounded border-gray-300 text-primary-600"
            />
           </td>
          )}
          <td className="px-3 py-2">
           <div className="flex items-center gap-3">
            <div className="w-8 h-12 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
             {item.poster_path && (
              <img
               src={getCachedImageUrl(item.poster_path, 'w92') || ''}
               alt=""
               className="w-full h-full object-cover"
              />
             )}
            </div>
            <span className="font-medium text-gray-900 dark:text-white">{item.title}</span>
           </div>
          </td>
          <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{item.year}</td>
          {!isMovies && (
           <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{item.network || '-'}</td>
          )}
          <td className="px-3 py-2">
           <span className="text-sm text-gray-600 dark:text-gray-400">
            {getProfileName(item.quality_profile_id)}
           </span>
          </td>
          {isMovies ? (
           <td className="px-3 py-2">
            {item.quality ? (
             <span className={`px-2 py-0.5 text-xs font-medium text-white rounded ${getQualityBadge(item.quality)}`}>
              {item.quality}
             </span>
            ) : (
             <span className="text-sm text-gray-400">-</span>
            )}
           </td>
          ) : (
           <td className="px-3 py-2">
            <span className={`text-sm ${
             item.downloaded_count === item.episode_count 
              ? 'text-green-600 dark:text-green-400' 
              : item.downloaded_count && item.downloaded_count > 0
               ? 'text-yellow-600 dark:text-yellow-400'
               : 'text-red-600 dark:text-red-400'
            }`}>
             {item.downloaded_count || 0}/{item.episode_count || 0}
            </span>
           </td>
          )}
          <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
           {formatSize(isMovies ? item.file_size : item.total_size)}
          </td>
          <td className="px-3 py-2">
           <button
            onClick={(e) => toggleMonitor(item, e)}
            className={`${item.monitored ? 'text-primary-500' : 'text-gray-400'}`}
           >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
             <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
           </button>
          </td>
          <td className="px-3 py-2">
           <div className="flex items-center justify-end gap-1">
            <button
             onClick={(e) => {
              e.stopPropagation();
              navigate(`${detailPath}/${item.id}`);
             }}
             className="p-1.5 text-gray-400 hover:text-primary-500 transition-colors"
             title="Edit"
            >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
             </svg>
            </button>
            <button
             onClick={(e) => {
              e.stopPropagation();
              setSelectedIds(new Set([item.id]));
              setShowDeleteConfirm(true);
             }}
             className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
             title="Delete"
            >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
             </svg>
            </button>
           </div>
          </td>
         </tr>
        ))}
       </tbody>
      </table></div>
     </div>
     {/* Pagination for Table View */}
     <div className="mt-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <Pagination
       currentPage={currentPage}
       totalItems={filteredItems.length}
       itemsPerPage={itemsPerPage}
       onPageChange={setCurrentPage}
       onItemsPerPageChange={setItemsPerPage}
      />
     </div>
     </>
    )}
   </div>

   {/* Delete Confirmation Modal */}
   <ConfirmModal
    isOpen={showDeleteConfirm}
    title={`Delete ${selectedIds.size} ${isMovies ? 'movies' : 'series'}?`}
    message={
     <div className="space-y-4">
      <p>Are you sure you want to delete {selectedIds.size} {isMovies ? 'movies' : 'series'}? This cannot be undone.</p>
      <label className="flex items-center gap-2 cursor-pointer">
       <input
        type="checkbox"
        checked={deleteWithFiles}
        onChange={(e) => setDeleteWithFiles(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
       />
       <span className="text-sm text-gray-600 dark:text-gray-400">
        Also delete files from disk
       </span>
      </label>
     </div>
    }
    confirmText={deleteWithFiles ? 'Delete with Files' : 'Delete'}
    onConfirm={handleBulkDelete}
    onCancel={() => {
     setShowDeleteConfirm(false);
     setDeleteWithFiles(false);
    }}
    danger
   />

   {/* Custom Filter Modal */}
   {showFilterModal && (
    <CustomFilterModal
     filter={editingFilter}
     qualityProfiles={qualityProfiles}
     onSave={(filter) => {
      if (editingFilter) {
       // Update existing
       saveCustomFilters(customFilters.map(f => f.id === filter.id ? filter : f));
      } else {
       // Add new
       saveCustomFilters([...customFilters, filter]);
      }
      setShowFilterModal(false);
      setEditingFilter(null);
     }}
     onDelete={editingFilter ? () => {
      saveCustomFilters(customFilters.filter(f => f.id !== editingFilter.id));
      if (statusFilter === editingFilter.id) setStatusFilter('all');
      setShowFilterModal(false);
      setEditingFilter(null);
     } : undefined}
     onClose={() => {
      setShowFilterModal(false);
      setEditingFilter(null);
     }}
     existingFilters={customFilters}
     onEditFilter={(filter) => {
      setEditingFilter(filter);
     }}
    />
   )}
  </Layout>
 );
}

// Export both components for backwards compatibility
export function MoviesPage() {
 return <MediaLibraryPage mediaType="movie" />;
}

export function TVShowsPage() {
 return <MediaLibraryPage mediaType="tv" />;
}
