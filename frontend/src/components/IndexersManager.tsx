import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Button } from './common/Button';
import { Input } from './common/Input';
import { ConfirmModal } from './ConfirmModal';

interface Indexer {
 id: string;
 name: string;
 type: 'torznab' | 'newznab';
 url: string;
 apiKey: string;
 enabled: boolean;
 enableRss: boolean;
 enableAutomaticSearch: boolean;
 enableInteractiveSearch: boolean;
 priority?: number;
}

interface Props {
 onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type IndexerType = 'torznab' | 'newznab';

const defaultTorznab: Partial<Indexer> = {
 name: 'Prowlarr',
 type: 'torznab',
 enabled: true,
 enableRss: true,
 enableAutomaticSearch: true,
 enableInteractiveSearch: true,
 priority: 50,
 url: '',
 apiKey: ''
};

const defaultNewznab: Partial<Indexer> = {
 name: 'NZBHydra',
 type: 'newznab',
 enabled: true,
 enableRss: true,
 enableAutomaticSearch: true,
 enableInteractiveSearch: true,
 priority: 50,
 url: '',
 apiKey: ''
};

export function IndexersManager({ onToast }: Props) {
 const [indexers, setIndexers] = useState<Indexer[]>([]);
 const [loading, setLoading] = useState(true);
 const [showAddModal, setShowAddModal] = useState(false);
 const [showTypeSelector, setShowTypeSelector] = useState(false);
 const [editingIndexer, setEditingIndexer] = useState<Indexer | null>(null);
 const [formData, setFormData] = useState<Partial<Indexer>>(defaultTorznab);
 const [testing, setTesting] = useState(false);
 const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
 const [saving, setSaving] = useState(false);
 const [deleteConfirm, setDeleteConfirm] = useState<Indexer | null>(null);
 const [rssPreview, setRssPreview] = useState<{ indexer: Indexer; loading: boolean; data: any } | null>(null);

 useEffect(() => {
  loadIndexers();
 }, []);

 const loadIndexers = async () => {
  try {
   const data = await api.getIndexers();
   setIndexers(data);
  } catch (error) {
   console.error('Failed to load indexers:', error);
  } finally {
   setLoading(false);
  }
 };

 const openAddModal = (type: IndexerType) => {
  setFormData(type === 'torznab' ? { ...defaultTorznab } : { ...defaultNewznab });
  setEditingIndexer(null);
  setTestResult(null);
  setShowTypeSelector(false);
  setShowAddModal(true);
 };

 const openEditModal = (indexer: Indexer) => {
  setFormData({ ...indexer });
  setEditingIndexer(indexer);
  setTestResult(null);
  setShowAddModal(true);
 };

 const closeModal = () => {
  setShowAddModal(false);
  setShowTypeSelector(false);
  setEditingIndexer(null);
  setFormData(defaultTorznab);
  setTestResult(null);
 };

 const handleTest = async () => {
  if (!formData.url || !formData.apiKey) {
   onToast('Please enter URL and API Key', 'error');
   return;
  }

  setTesting(true);
  setTestResult(null);
  try {
   const result = await api.testIndexer({
    type: formData.type as IndexerType,
    url: formData.url,
    apiKey: formData.apiKey
   });
   setTestResult(result);
  } catch (error: any) {
   setTestResult({ success: false, message: error.response?.data?.error || 'Test failed' });
  } finally {
   setTesting(false);
  }
 };

 const handleSave = async () => {
  if (!formData.name || !formData.url || !formData.apiKey) {
   onToast('Please fill in all required fields', 'error');
   return;
  }

  // For new indexers, require a successful test
  // For existing indexers, only require test if URL or API key changed
  const connectionChanged = editingIndexer && (
    formData.url !== editingIndexer.url || 
    formData.apiKey !== editingIndexer.apiKey
  );
  
  if (!editingIndexer || connectionChanged) {
    if (!testResult?.success) {
      onToast('Please test the connection first', 'error');
      return;
    }
  }

  setSaving(true);
  try {
   if (editingIndexer) {
    await api.updateIndexer(editingIndexer.id, {
     name: formData.name,
     type: formData.type,
     url: formData.url,
     apiKey: formData.apiKey,
     enabled: formData.enabled !== false,
     enableRss: formData.enableRss !== false,
     enableAutomaticSearch: formData.enableAutomaticSearch !== false,
     enableInteractiveSearch: formData.enableInteractiveSearch !== false
    });
    onToast('Indexer updated successfully', 'success');
   } else {
    await api.addIndexer({
     name: formData.name!,
     type: formData.type!,
     url: formData.url!,
     apiKey: formData.apiKey!,
     enabled: formData.enabled !== false,
     enableRss: formData.enableRss !== false,
     enableAutomaticSearch: formData.enableAutomaticSearch !== false,
     enableInteractiveSearch: formData.enableInteractiveSearch !== false
    });
    onToast('Indexer added successfully', 'success');
   }
   await loadIndexers();
   closeModal();
  } catch (error: any) {
   onToast(error.response?.data?.error || 'Failed to save indexer', 'error');
  } finally {
   setSaving(false);
  }
 };

 const handleDelete = async (indexer: Indexer) => {
  try {
   await api.deleteIndexer(indexer.id);
   onToast('Indexer deleted', 'success');
   await loadIndexers();
   closeModal();
  } catch (error) {
   onToast('Failed to delete indexer', 'error');
  }
  setDeleteConfirm(null);
 };

 const handlePreviewRss = async (indexer: Indexer) => {
  if (!indexer.enableRss) {
   onToast('RSS is not enabled for this indexer', 'error');
   return;
  }
  
  setRssPreview({ indexer, loading: true, data: null });
  try {
   const data = await api.previewIndexerRss(indexer.id);
   setRssPreview({ indexer, loading: false, data });
  } catch (error: any) {
   setRssPreview({ indexer, loading: false, data: { error: error.response?.data?.error || 'Failed to fetch RSS' } });
  }
 };

 const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
 };

 if (loading) {
  return <div className="p-4 text-center text-gray-500">Loading...</div>;
 }

 return (
  <div className="space-y-6">
   {/* Header */}
   <div className="flex justify-between items-start">
    <div>
     <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Indexers</h2>
     <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage Newznab/Torznab indexers for media searches</p>
    </div>
    <Button onClick={() => setShowTypeSelector(true)}>
     Add Indexer
    </Button>
   </div>

   {/* Indexers Table */}
   <div className="border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
    <div className="table-responsive">
    <table className="w-full">
     <thead>
      <tr className="border-b" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Type</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>URL</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
       <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Actions</th>
      </tr>
     </thead>
     <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
      {indexers.length === 0 ? (
       <tr style={{ backgroundColor: 'var(--card-bg)' }}>
        <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
         No indexers configured. Click "Add Indexer" to get started.
        </td>
       </tr>
      ) : indexers.map((indexer) => (
       <tr 
        key={indexer.id} 
        style={{ backgroundColor: 'var(--card-bg)' }}
        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
        onClick={() => openEditModal(indexer)}
       >
        <td className="px-4 py-4">
         <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{indexer.name}</p>
        </td>
        <td className="px-4 py-4">
         <span className={`px-2 py-0.5 text-xs font-medium ${
          indexer.type === 'torznab' 
           ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' 
           : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
         }`}>
          {indexer.type}
         </span>
        </td>
        <td className="px-4 py-4">
         <p className="text-sm truncate max-w-xs" style={{ color: 'var(--text-secondary)' }} title={indexer.url}>{indexer.url}</p>
        </td>
        <td className="px-4 py-4">
         <span className={`px-2 py-0.5 text-xs font-medium ${
          indexer.enabled 
           ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
           : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
         }`}>
          {indexer.enabled ? 'Enabled' : 'Disabled'}
         </span>
        </td>
        <td className="px-4 py-4 text-right">
         <div className="flex items-center justify-end gap-1">
          {indexer.enableRss && (
           <button 
            onClick={(e) => {
             e.stopPropagation();
             handlePreviewRss(indexer);
            }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded"
            style={{ color: 'var(--text-muted)' }}
            title="Preview RSS feed"
           >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
           </button>
          )}
          <button 
           onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirm(indexer);
           }}
           className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
           title="Delete indexer"
          >
           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
           </svg>
          </button>
         </div>
        </td>
       </tr>
      ))}
     </tbody>
    </table></div>
   </div>

   {/* Type Selector Modal */}
   {showTypeSelector && (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
     <div className="w-full max-w-md shadow-xl" style={{ backgroundColor: 'var(--card-bg)' }}>
      <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
       <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Add Indexer</h3>
       <button onClick={() => setShowTypeSelector(false)} className="p-1 hover:bg-gray-700 rounded transition-colors" style={{ color: 'var(--text-muted)' }}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
       </button>
      </div>
      
      <div className="p-4 space-y-3">
       {/* Torznab Option */}
       <button
        onClick={() => openAddModal('torznab')}
        className="w-full p-4 border rounded-lg text-left hover:border-purple-500 hover:bg-purple-500/5 transition-all group"
        style={{ borderColor: 'var(--border-color)' }}
       >
        <div className="flex items-center gap-4">
         <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-purple-600 text-white font-bold text-lg shrink-0">
          TZ
         </div>
         <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
           <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Torznab</span>
           <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase bg-purple-600/20 text-purple-400 rounded">Torrents</span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Connect to Prowlarr, Jackett, or other Torznab-compatible indexers</p>
         </div>
         <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
         </svg>
        </div>
       </button>

       {/* Newznab Option */}
       <button
        onClick={() => openAddModal('newznab')}
        className="w-full p-4 border rounded-lg text-left hover:border-orange-500 hover:bg-orange-500/5 transition-all group"
        style={{ borderColor: 'var(--border-color)' }}
       >
        <div className="flex items-center gap-4">
         <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-orange-600 text-white font-bold text-lg shrink-0">
          NZ
         </div>
         <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
           <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Newznab</span>
           <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase bg-orange-600/20 text-orange-400 rounded">Usenet</span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Connect to NZBHydra, NZBGeek, or other Newznab-compatible indexers</p>
         </div>
         <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
         </svg>
        </div>
       </button>
      </div>
     </div>
    </div>
   )}

   {/* Add/Edit Modal */}
   {showAddModal && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="bg-white dark:bg-gray-800 shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
       <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {editingIndexer ? 'Edit Indexer' : `Add ${formData.type === 'torznab' ? 'Torznab' : 'Newznab'} Indexer`}
       </h3>
       <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
       </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
       {/* Name */}
       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
        <Input
         value={formData.name || ''}
         onChange={(e) => setFormData({ ...formData, name: e.target.value })}
         placeholder="My Indexer"
         className="dark:bg-gray-700"
        />
       </div>

       {/* Enable */}
       <label className="flex items-center gap-2">
        <input
         type="checkbox"
         checked={formData.enabled !== false}
         onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
         className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable</span>
       </label>

       {/* RSS Settings */}
       <div className="space-y-2 border-l-2 border-gray-200 dark:border-gray-600 pl-4 ml-2">
        <label className="flex items-start gap-2">
         <input
          type="checkbox"
          checked={formData.enableRss !== false}
          onChange={(e) => setFormData({ ...formData, enableRss: e.target.checked })}
          className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
         />
         <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable RSS</span>
          <p className="text-xs text-gray-500 dark:text-gray-400">Will be used when periodically looking for releases via RSS Sync</p>
         </div>
        </label>

        <label className="flex items-start gap-2">
         <input
          type="checkbox"
          checked={formData.enableAutomaticSearch !== false}
          onChange={(e) => setFormData({ ...formData, enableAutomaticSearch: e.target.checked })}
          className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
         />
         <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Automatic Search</span>
          <p className="text-xs text-gray-500 dark:text-gray-400">Will be used when automatic searches are performed via the UI or by scheduled tasks</p>
         </div>
        </label>

        <label className="flex items-start gap-2">
         <input
          type="checkbox"
          checked={formData.enableInteractiveSearch !== false}
          onChange={(e) => setFormData({ ...formData, enableInteractiveSearch: e.target.checked })}
          className="w-4 h-4 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
         />
         <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Interactive Search</span>
          <p className="text-xs text-gray-500 dark:text-gray-400">Will be used when interactive (manual) search is used</p>
         </div>
        </label>
       </div>

       {/* URL */}
       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL *</label>
        <Input
         value={formData.url || ''}
         onChange={(e) => setFormData({ ...formData, url: e.target.value })}
         placeholder={formData.type === 'torznab' ? 'http://prowlarr:9696/1/api' : 'http://nzbhydra:5076'}
         className="dark:bg-gray-700"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
         {formData.type === 'torznab' 
          ? 'For Prowlarr: Go to Settings → Apps → Add Application → Copy the Torznab Feed URL (ends with /api). For all indexers use the "multi" indexer URL like http://host:9696/1/api'
          : 'Use the Newznab API URL from your usenet indexer'}
        </p>
       </div>

       {/* API Key */}
       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key *</label>
        <Input
         type="password"
         value={formData.apiKey || ''}
         onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
         placeholder="Your API Key"
         className="dark:bg-gray-700"
        />
       </div>

       {/* Test Result */}
       {testResult && (
        <div className={`p-3 ${testResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
         {testResult.message}
        </div>
       )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
       <div className="flex gap-2">
        <Button variant="secondary" onClick={handleTest} disabled={testing || !formData.url || !formData.apiKey}>
         {testing ? 'Testing...' : 'Test'}
        </Button>
        {editingIndexer && (
         <Button 
          variant="secondary" 
          onClick={() => setDeleteConfirm(editingIndexer)}
          className="text-red-600 hover:text-red-700"
         >
          Delete
         </Button>
        )}
       </div>
       <div className="flex gap-2">
        <Button variant="secondary" onClick={closeModal}>Cancel</Button>
        <Button 
         onClick={handleSave} 
         disabled={saving || (
          !editingIndexer 
            ? !testResult?.success 
            : (formData.url !== editingIndexer.url || formData.apiKey !== editingIndexer.apiKey) && !testResult?.success
         )}
         title={(!editingIndexer && !testResult?.success) ? 'Test connection first' : undefined}
        >
         {saving ? 'Saving...' : 'Save'}
        </Button>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* Delete Confirmation Modal */}
   <ConfirmModal
    isOpen={!!deleteConfirm}
    title="Delete Indexer"
    message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
    confirmText="Delete"
    onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
    onCancel={() => setDeleteConfirm(null)}
   />

   {/* RSS Preview Modal */}
   {rssPreview && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="bg-white dark:bg-gray-800 shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
       <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
         RSS Preview - {rssPreview.indexer.name}
        </h3>
        {rssPreview.data && !rssPreview.data.error && (
         <p className="text-sm text-gray-500 dark:text-gray-400">
          Found {rssPreview.data.count} releases (showing first 25)
         </p>
        )}
       </div>
       <button onClick={() => setRssPreview(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
       </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
       {rssPreview.loading ? (
        <div className="flex items-center justify-center py-12">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
         <span className="ml-3 text-gray-600 dark:text-gray-400">Fetching RSS feed...</span>
        </div>
       ) : rssPreview.data?.error ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded">
         {rssPreview.data.error}
        </div>
       ) : rssPreview.data?.preview?.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
         No releases found in RSS feed
        </div>
       ) : (
        <div className="border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
         <table className="w-full text-sm">
          <thead>
           <tr className="border-b" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Title</th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Quality</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Size</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Seeds</th>
           </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
           {rssPreview.data?.preview?.map((release: any, idx: number) => (
            <tr key={idx} style={{ backgroundColor: 'var(--card-bg)' }} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
             <td className="px-3 py-2">
              <p className="font-medium truncate max-w-md" style={{ color: 'var(--text-primary)' }} title={release.title}>
               {release.title}
              </p>
             </td>
             <td className="px-3 py-2">
              <div className="flex gap-1 flex-wrap">
               {release.resolution && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                 {release.resolution}
                </span>
               )}
               {release.quality && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded">
                 {release.quality}
                </span>
               )}
               {release.codec && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                 {release.codec}
                </span>
               )}
              </div>
             </td>
             <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
              {formatBytes(release.size)}
             </td>
             <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
              {release.seeders > 0 ? (
               <span className="text-green-600 dark:text-green-400">{release.seeders}</span>
              ) : (
               <span className="text-gray-400">-</span>
              )}
             </td>
            </tr>
           ))}
          </tbody>
         </table>
        </div>
       )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end shrink-0">
       <Button variant="secondary" onClick={() => setRssPreview(null)}>Close</Button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}
