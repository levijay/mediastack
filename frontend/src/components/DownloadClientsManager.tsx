import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Button } from './common/Button';
import { Input } from './common/Input';
import { ConfirmModal } from './ConfirmModal';

interface DownloadClient {
 id: string;
 name: string;
 type: 'qbittorrent' | 'sabnzbd';
 enabled: boolean;
 host: string;
 port: number;
 use_ssl: boolean;
 url_base: string | null;
 username: string | null;
 password: string | null;
 api_key: string | null;
 category: string | null;
 category_movies: string | null;
 category_tv: string | null;
 priority: number;
 remove_completed: boolean;
 remove_failed: boolean;
 tags: string | null;
}

interface Props {
 onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type ClientType = 'qbittorrent' | 'sabnzbd';

const defaultQbittorrent: Partial<DownloadClient> = {
 name: 'qBittorrent',
 type: 'qbittorrent',
 enabled: true,
 host: 'localhost',
 port: 8080,
 use_ssl: false,
 url_base: '',
 username: '',
 password: '',
 category: 'mediastack',
 category_movies: '',
 category_tv: '',
 priority: 1,
 remove_completed: true,
 remove_failed: true,
 tags: ''
};

const defaultSabnzbd: Partial<DownloadClient> = {
 name: 'SABnzbd',
 type: 'sabnzbd',
 enabled: true,
 host: 'localhost',
 port: 8080,
 use_ssl: false,
 url_base: '',
 api_key: '',
 category: '',
 category_movies: 'movies',
 category_tv: 'tv',
 priority: 1,
 remove_completed: true,
 remove_failed: true,
 tags: ''
};

interface BlacklistItem {
 id: string;
 movie_id?: string;
 series_id?: string;
 season_number?: number;
 episode_number?: number;
 release_title: string;
 indexer?: string;
 reason?: string;
 created_at: string;
 movie_title?: string;
 series_title?: string;
}

export function DownloadClientsManager({ onToast }: Props) {
 const [clients, setClients] = useState<DownloadClient[]>([]);
 const [loading, setLoading] = useState(true);
 const [showAddModal, setShowAddModal] = useState(false);
 const [showTypeSelector, setShowTypeSelector] = useState(false);
 const [editingClient, setEditingClient] = useState<DownloadClient | null>(null);
 const [formData, setFormData] = useState<Partial<DownloadClient>>(defaultQbittorrent);
 const [testing, setTesting] = useState(false);
 const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
 const [saving, setSaving] = useState(false);
 const [deleteConfirm, setDeleteConfirm] = useState<DownloadClient | null>(null);
 const [redownloadFailed, setRedownloadFailed] = useState(true);
 const [savingRedownload, setSavingRedownload] = useState(false);
 const [autoImportEnabled, setAutoImportEnabled] = useState(true);
 const [savingAutoImport, setSavingAutoImport] = useState(false);
 const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
 const [loadingBlacklist, setLoadingBlacklist] = useState(false);
 const [showBlacklist, setShowBlacklist] = useState(false);

 useEffect(() => {
  loadClients();
  loadRedownloadSetting();
  loadAutoImportSetting();
 }, []);

 const loadRedownloadSetting = async () => {
  try {
   const settings = await api.getSettings();
   setRedownloadFailed(settings.redownload_failed !== 'false' && settings.redownload_failed !== false);
  } catch (error) {
   console.error('Failed to load redownload setting:', error);
  }
 };

 const loadAutoImportSetting = async () => {
  try {
   const settings = await api.getSettings();
   setAutoImportEnabled(settings.auto_import_enabled !== 'false' && settings.auto_import_enabled !== false);
  } catch (error) {
   console.error('Failed to load auto-import setting:', error);
  }
 };

 const toggleRedownloadFailed = async () => {
  setSavingRedownload(true);
  try {
   const newValue = !redownloadFailed;
   await api.updateSetting('redownload_failed', String(newValue));
   setRedownloadFailed(newValue);
   onToast(`Redownload failed ${newValue ? 'enabled' : 'disabled'}`, 'success');
  } catch (error) {
   console.error('Failed to update redownload setting:', error);
   onToast('Failed to update setting', 'error');
  } finally {
   setSavingRedownload(false);
  }
 };

 const toggleAutoImport = async () => {
  setSavingAutoImport(true);
  try {
   const newValue = !autoImportEnabled;
   await api.updateSetting('auto_import_enabled', String(newValue));
   setAutoImportEnabled(newValue);
   onToast(`Auto-import ${newValue ? 'enabled' : 'disabled'}`, 'success');
  } catch (error) {
   console.error('Failed to update auto-import setting:', error);
   onToast('Failed to update setting', 'error');
  } finally {
   setSavingAutoImport(false);
  }
 };

 const loadBlacklist = async () => {
  setLoadingBlacklist(true);
  try {
   const data = await api.getBlacklist();
   setBlacklist(data);
  } catch (error) {
   console.error('Failed to load blacklist:', error);
  } finally {
   setLoadingBlacklist(false);
  }
 };

 const removeFromBlacklist = async (id: string) => {
  try {
   await api.removeFromBlacklist(id);
   setBlacklist(prev => prev.filter(item => item.id !== id));
   onToast('Release removed from blacklist', 'success');
  } catch (error) {
   console.error('Failed to remove from blacklist:', error);
   onToast('Failed to remove from blacklist', 'error');
  }
 };

 const loadClients = async () => {
  try {
   const data = await api.getDownloadClients();
   setClients(data);
  } catch (error) {
   console.error('Failed to load download clients:', error);
  } finally {
   setLoading(false);
  }
 };

 const openAddModal = (type: ClientType) => {
  setFormData(type === 'qbittorrent' ? { ...defaultQbittorrent } : { ...defaultSabnzbd });
  setEditingClient(null);
  setTestResult(null);
  setShowTypeSelector(false);
  setShowAddModal(true);
 };

 const openEditModal = (client: DownloadClient) => {
  setFormData({ ...client });
  setEditingClient(client);
  setTestResult(null);
  setShowAddModal(true);
 };

 const closeModal = () => {
  setShowAddModal(false);
  setShowTypeSelector(false);
  setEditingClient(null);
  setFormData(defaultQbittorrent);
  setTestResult(null);
 };

 const handleTest = async () => {
  setTesting(true);
  setTestResult(null);
  try {
   const result = await api.testDownloadClient({
    type: formData.type as ClientType,
    host: formData.host || '',
    port: formData.port || 8080,
    use_ssl: formData.use_ssl,
    url_base: formData.url_base || undefined,
    username: formData.username || undefined,
    password: formData.password || undefined,
    api_key: formData.api_key || undefined
   });
   setTestResult(result);
  } catch (error: any) {
   setTestResult({ success: false, message: error.response?.data?.error || 'Test failed' });
  } finally {
   setTesting(false);
  }
 };

 const handleSave = async () => {
  if (!formData.name || !formData.host || !formData.port) {
   onToast('Please fill in all required fields', 'error');
   return;
  }

  // Require successful test before saving
  if (!testResult?.success) {
   onToast('Please test the connection first', 'error');
   return;
  }

  setSaving(true);
  try {
   if (editingClient) {
    await api.updateDownloadClient(editingClient.id, formData);
    onToast('Download client updated successfully', 'success');
   } else {
    await api.addDownloadClient(formData as any);
    onToast('Download client added successfully', 'success');
   }
   await loadClients();
   closeModal();
  } catch (error: any) {
   onToast(error.response?.data?.error || 'Failed to save download client', 'error');
  } finally {
   setSaving(false);
  }
 };

 const handleDelete = async (client: DownloadClient) => {
  try {
   await api.deleteDownloadClient(client.id);
   onToast('Download client deleted', 'success');
   await loadClients();
   closeModal();
  } catch (error) {
   onToast('Failed to delete download client', 'error');
  }
  setDeleteConfirm(null);
 };

 if (loading) {
  return <div className="p-4 text-center text-gray-500">Loading...</div>;
 }

 return (
  <div className="space-y-6">
   {/* Header */}
   <div className="flex justify-between items-start">
    <div>
     <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Download Clients</h2>
     <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure your torrent and usenet download clients</p>
    </div>
    <Button onClick={() => setShowTypeSelector(true)}>
     Add Client
    </Button>
   </div>

   {/* Clients Table */}
   <div className="border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
    <div className="table-responsive">
    <table className="w-full">
     <thead>
      <tr className="border-b" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Type</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Host</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Priority</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
       <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Actions</th>
      </tr>
     </thead>
     <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
      {clients.length === 0 ? (
       <tr style={{ backgroundColor: 'var(--card-bg)' }}>
        <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
         No download clients configured. Click "Add Client" to get started.
        </td>
       </tr>
      ) : clients.map((client) => (
       <tr 
        key={client.id} 
        style={{ backgroundColor: 'var(--card-bg)' }}
        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
        onClick={() => openEditModal(client)}
       >
        <td className="px-4 py-4">
         <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{client.name}</p>
        </td>
        <td className="px-4 py-4">
         <span className={`px-2 py-0.5 text-xs font-medium ${
          client.type === 'qbittorrent' 
           ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' 
           : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
         }`}>
          {client.type}
         </span>
        </td>
        <td className="px-4 py-4">
         <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{client.host}:{client.port}</p>
        </td>
        <td className="px-4 py-4">
         {client.priority === 1 ? (
          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
           Primary
          </span>
         ) : (
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{client.priority}</span>
         )}
        </td>
        <td className="px-4 py-4">
         <span className={`px-2 py-0.5 text-xs font-medium ${
          client.enabled 
           ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
           : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
         }`}>
          {client.enabled ? 'Enabled' : 'Disabled'}
         </span>
        </td>
        <td className="px-4 py-4 text-right">
         <button 
          onClick={(e) => {
           e.stopPropagation();
           setDeleteConfirm(client);
          }}
          className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          title="Delete download client"
         >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
           <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
         </button>
        </td>
       </tr>
      ))}
     </tbody>
    </table></div>
   </div>

   {/* Completed Download Handling */}
   <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 mt-6">
    <h3 className="font-medium text-gray-900 dark:text-white mb-4">Completed Download Handling</h3>
    <div className="space-y-3">
     <label className="flex items-center gap-3 cursor-pointer">
      <button
       onClick={toggleAutoImport}
       disabled={savingAutoImport}
       className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
        autoImportEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
       } ${savingAutoImport ? 'opacity-50 cursor-wait' : ''}`}
      >
       <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
         autoImportEnabled ? 'translate-x-4' : 'translate-x-0.5'
        }`}
       />
      </button>
      <div>
       <span className={`text-sm font-medium ${autoImportEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
        Auto-Import
       </span>
       <p className="text-xs text-gray-500 dark:text-gray-400">
        {autoImportEnabled 
         ? 'Completed downloads are automatically imported'
         : 'Downloads must be manually imported'}
       </p>
      </div>
     </label>
     <label className="flex items-center gap-3 cursor-pointer">
      <button
       onClick={toggleRedownloadFailed}
       disabled={savingRedownload}
       className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
        redownloadFailed ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
       } ${savingRedownload ? 'opacity-50 cursor-wait' : ''}`}
      >
       <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
         redownloadFailed ? 'translate-x-4' : 'translate-x-0.5'
        }`}
       />
      </button>
      <div>
       <span className={`text-sm font-medium ${redownloadFailed ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
        Redownload Failed
       </span>
       <p className="text-xs text-gray-500 dark:text-gray-400">
        {redownloadFailed 
         ? 'Failed downloads are blacklisted and alternative releases are automatically searched'
         : 'Failed downloads must be manually re-searched'}
       </p>
      </div>
     </label>
    </div>
   </div>

   {/* Blacklist Section */}
   <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-4">
     <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Blacklisted Releases</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">Failed releases that won't be grabbed again</p>
     </div>
     <button
      onClick={() => {
       setShowBlacklist(!showBlacklist);
       if (!showBlacklist && blacklist.length === 0) {
        loadBlacklist();
       }
      }}
      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      style={{ color: 'var(--text-primary)' }}
     >
      {showBlacklist ? 'Hide' : 'Show'} ({blacklist.length})
     </button>
    </div>
    
    {showBlacklist && (
     <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Blacklist Items */}
      <div className="max-h-96 overflow-y-auto">
       {loadingBlacklist ? (
        <div className="p-8 text-center">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: 'var(--navbar-bg)' }}></div>
         <p className="text-gray-500 dark:text-gray-400 mt-2">Loading...</p>
        </div>
       ) : blacklist.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
         <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
         </svg>
         <p>No blacklisted releases</p>
         <p className="text-sm mt-1">Failed downloads will appear here when "Redownload Failed" is enabled</p>
        </div>
       ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
         {blacklist.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/50">
           <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
             item.movie_id ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
            }`}>
             {item.movie_id ? (
              <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
             ) : (
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
             )}
            </div>
            <div className="min-w-0">
             <p className="font-medium text-gray-900 dark:text-white truncate">
              {item.movie_title || item.series_title || 'Unknown'}
              {item.series_id && item.season_number !== undefined && (
               <span className="text-gray-500 ml-1">
                S{String(item.season_number).padStart(2, '0')}
                {item.episode_number !== undefined && `E${String(item.episode_number).padStart(2, '0')}`}
               </span>
              )}
             </p>
             <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={item.release_title}>
              {item.release_title}
             </p>
             <p className="text-xs text-gray-400 dark:text-gray-500">
              {item.indexer && <span>{item.indexer} • </span>}
              {item.reason || 'Download failed'}
             </p>
            </div>
           </div>
           <button
            onClick={() => removeFromBlacklist(item.id)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors flex-shrink-0"
            title="Remove from blacklist"
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

   {/* Type Selector Modal */}
   {showTypeSelector && (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
     <div className="w-full max-w-md shadow-xl" style={{ backgroundColor: 'var(--card-bg)' }}>
      <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
       <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Add Download Client</h3>
       <button onClick={() => setShowTypeSelector(false)} className="p-1 hover:bg-gray-700 rounded transition-colors" style={{ color: 'var(--text-muted)' }}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
       </button>
      </div>
      
      <div className="p-4 space-y-3">
       {/* SABnzbd Option */}
       <button
        onClick={() => openAddModal('sabnzbd')}
        className="w-full p-4 border rounded-lg text-left hover:border-amber-500 hover:bg-amber-500/5 transition-all group"
        style={{ borderColor: 'var(--border-color)' }}
       >
        <div className="flex items-center gap-4">
         <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-amber-500 text-white font-bold text-lg shrink-0">
          S
         </div>
         <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
           <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>SABnzbd</span>
           <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase bg-amber-600/20 text-amber-400 rounded">Usenet</span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Open source usenet downloader with web interface</p>
         </div>
         <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
         </svg>
        </div>
       </button>

       {/* qBittorrent Option */}
       <button
        onClick={() => openAddModal('qbittorrent')}
        className="w-full p-4 border rounded-lg text-left hover:border-blue-500 hover:bg-blue-500/5 transition-all group"
        style={{ borderColor: 'var(--border-color)' }}
       >
        <div className="flex items-center gap-4">
         <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-600 text-white font-bold text-lg shrink-0">
          qB
         </div>
         <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
           <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>qBittorrent</span>
           <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase bg-blue-600/20 text-blue-400 rounded">Torrent</span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Free and reliable BitTorrent client with web UI</p>
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
     <div className="bg-white dark:bg-gray-800 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
       <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {editingClient ? `Edit ${formData.type === 'qbittorrent' ? 'qBittorrent' : 'SABnzbd'}` : `Add ${formData.type === 'qbittorrent' ? 'qBittorrent' : 'SABnzbd'}`}
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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
        <Input
         value={formData.name || ''}
         onChange={(e) => setFormData({ ...formData, name: e.target.value })}
         placeholder="My Download Client"
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

       {/* Host & Port */}
       <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Host</label>
         <Input
          value={formData.host || ''}
          onChange={(e) => setFormData({ ...formData, host: e.target.value })}
          placeholder="localhost"
          className="dark:bg-gray-700"
         />
        </div>
        <div>
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
         <Input
          type="number"
          value={formData.port || ''}
          onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 0 })}
          placeholder="8080"
          className="dark:bg-gray-700"
         />
        </div>
       </div>

       {/* Use SSL */}
       <label className="flex items-center gap-2">
        <input
         type="checkbox"
         checked={formData.use_ssl || false}
         onChange={(e) => setFormData({ ...formData, use_ssl: e.target.checked })}
         className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">Use SSL (HTTPS)</span>
       </label>

       {/* URL Base */}
       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL Base</label>
        <Input
         value={formData.url_base || ''}
         onChange={(e) => setFormData({ ...formData, url_base: e.target.value })}
         placeholder="/api (optional)"
         className="dark:bg-gray-700"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
         Adds a prefix to the URL, such as http://[host]:[port]/[urlBase]/api
        </p>
       </div>

       {/* Auth - conditional based on type */}
       {formData.type === 'qbittorrent' ? (
        <>
         <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
          <Input
           value={formData.username || ''}
           onChange={(e) => setFormData({ ...formData, username: e.target.value })}
           placeholder="admin"
           className="dark:bg-gray-700"
          />
         </div>
         <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
          <Input
           type="password"
           value={formData.password || ''}
           onChange={(e) => setFormData({ ...formData, password: e.target.value })}
           placeholder="••••••••"
           className="dark:bg-gray-700"
          />
         </div>
        </>
       ) : (
        <div>
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
         <Input
          type="password"
          value={formData.api_key || ''}
          onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
          placeholder="Your SABnzbd API Key"
          className="dark:bg-gray-700"
         />
        </div>
       )}

       {/* Category - different for qBittorrent vs SABnzbd */}
       {formData.type === 'qbittorrent' ? (
        <div>
         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
         <Input
          value={formData.category || ''}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="mediastack"
          className="dark:bg-gray-700"
         />
         <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Adding a category specific to MediaStack avoids conflicts with other downloads
         </p>
        </div>
       ) : (
        <div className="space-y-4">
         <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Movies Category</label>
          <Input
           value={formData.category_movies || ''}
           onChange={(e) => setFormData({ ...formData, category_movies: e.target.value })}
           placeholder="movies"
           className="dark:bg-gray-700"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
           SABnzbd category for movie downloads
          </p>
         </div>
         <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">TV Category</label>
          <Input
           value={formData.category_tv || ''}
           onChange={(e) => setFormData({ ...formData, category_tv: e.target.value })}
           placeholder="tv"
           className="dark:bg-gray-700"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
           SABnzbd category for TV show downloads
          </p>
         </div>
        </div>
       )}

       {/* Priority */}
       <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client Priority</label>
        <Input
         type="number"
         value={formData.priority || 1}
         onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
         min={1}
         max={50}
         className="dark:bg-gray-700"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
         Download Client Priority from 1 (Highest) to 50 (Lowest). Default: 1
        </p>
       </div>

       {/* Remove options */}
       <div className="space-y-2">
        <label className="flex items-center gap-2">
         <input
          type="checkbox"
          checked={formData.remove_completed !== false}
          onChange={(e) => setFormData({ ...formData, remove_completed: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
         />
         <span className="text-sm text-gray-600 dark:text-gray-400">Remove Completed</span>
        </label>
        <label className="flex items-center gap-2">
         <input
          type="checkbox"
          checked={formData.remove_failed !== false}
          onChange={(e) => setFormData({ ...formData, remove_failed: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
         />
         <span className="text-sm text-gray-600 dark:text-gray-400">Remove Failed</span>
        </label>
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
        <Button variant="secondary" onClick={handleTest} disabled={testing || !formData.host}>
         {testing ? 'Testing...' : 'Test'}
        </Button>
        {editingClient && (
         <Button 
          variant="secondary" 
          onClick={() => setDeleteConfirm(editingClient)}
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
         disabled={saving || (!testResult?.success && formData.enabled !== false)}
         title={!testResult?.success && formData.enabled !== false ? 'Test connection first' : ''}
        >
         {saving ? 'Saving...' : (testResult?.success || formData.enabled === false) ? 'Save' : 'Test First'}
        </Button>
       </div>
      </div>
     </div>
    </div>
   )}

   {/* Delete Confirmation Modal */}
   <ConfirmModal
    isOpen={!!deleteConfirm}
    title="Delete Download Client"
    message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
    confirmText="Delete"
    onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
    onCancel={() => setDeleteConfirm(null)}
   />
  </div>
 );
}
