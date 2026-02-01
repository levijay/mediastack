import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { api } from '../services/api';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { useToast } from '../components/Toast';
import { useUISettings, accentColors } from '../contexts/UISettingsContext';
import { useTimezone } from '../contexts/TimezoneContext';
import { FolderBrowser } from '../components/FolderBrowser';
import { QualityProfileEditor } from '../components/QualityProfileEditor';
import { DownloadClientsManager } from '../components/DownloadClientsManager';
import { IndexersManager } from '../components/IndexersManager';
import { NotificationsManager } from '../components/NotificationsManager';
import { ImportSection } from '../components/ImportSection';
import { ImportListsSection } from '../components/ImportListsSection';
import { ArrImportSection } from '../components/ArrImportSection';
import { ConfirmModal } from '../components/ConfirmModal';
import { NamingSettings } from '../components/NamingSettings';
import { PosterSizeSelector } from '../components/PosterSizeSelector';
import CustomFormatsSection from '../components/CustomFormatsSection';

interface QualityProfile {
 id: string;
 name: string;
 media_type: 'movie' | 'series' | 'both';
 cutoff_quality: string;
 upgrade_allowed: boolean;
 items: { quality: string; allowed: boolean }[];
}

interface NamingConfig {
 rename_movies: boolean;
 rename_episodes: boolean;
 replace_illegal_characters: boolean;
 colon_replacement: string;
 standard_movie_format: string;
 movie_folder_format: string;
 standard_episode_format: string;
 daily_episode_format: string;
 anime_episode_format: string;
 series_folder_format: string;
 season_folder_format: string;
 specials_folder_format: string;
 multi_episode_style: string;
}

interface Worker {
 id: string;
 name: string;
 description: string;
 status: 'running' | 'stopped' | 'error';
 lastRun?: string;
 interval?: number;
 errorMessage?: string;
}

interface MediaManagementTabProps {
 namingConfig: NamingConfig | null;
 setNamingConfig: (config: NamingConfig) => void;
 namingPreview: { movie?: string; episode?: string };
 setNamingPreview: (preview: { movie?: string; episode?: string }) => void;
 moviePath: string;
 setMoviePath: (path: string) => void;
 tvPath: string;
 setTvPath: (path: string) => void;
 browsingFor: 'movie' | 'tv' | null;
 setBrowsingFor: (type: 'movie' | 'tv' | null) => void;
 handleSavePaths: () => void;
 addToast: (toast: { type: 'info' | 'success' | 'warning' | 'error' | 'progress'; message: string }) => void;
}

function NamingTab(props: MediaManagementTabProps) {
 return (
  <div>
   {props.namingConfig && (
    <NamingSettings
     config={props.namingConfig}
     onChange={props.setNamingConfig}
     onSave={async () => {
      try {
       await api.updateNamingConfig(props.namingConfig!);
       props.addToast({ type: 'success', message: 'Naming configuration saved!' });
       const [moviePreview, episodePreview] = await Promise.all([
        api.previewNaming('movie'),
        api.previewNaming('episode')
       ]);
       props.setNamingPreview({
        movie: moviePreview.preview,
        episode: episodePreview.preview
       });
      } catch (error) {
       props.addToast({ type: 'error', message: 'Failed to save naming configuration' });
      }
     }}
     moviePreview={props.namingPreview.movie}
     episodePreview={props.namingPreview.episode}
    />
   )}
  </div>
 );
}

function LibraryPathsTab(props: MediaManagementTabProps) {
 return (
  <div className="p-6 space-y-6">
   <div>
    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Library Paths</h2>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure where your media files are stored</p>
   </div>

   {/* Root Folders Table */}
   <div className="border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
    <div className="table-responsive">
    <table className="w-full">
     <thead>
      <tr className="border-b" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Type</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Path</th>
       <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
       <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Actions</th>
      </tr>
     </thead>
     <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
      {/* Movies Row */}
      <tr style={{ backgroundColor: 'var(--card-bg)' }}>
       <td className="px-4 py-4">
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Movies</p>
       </td>
       <td className="px-4 py-4">
        <Input 
         type="text" 
         value={props.moviePath} 
         onChange={(e) => props.setMoviePath(e.target.value)} 
         placeholder="/data/media/movies" 
         className="dark:bg-gray-800/50 font-mono text-sm max-w-lg" 
        />
       </td>
       <td className="px-4 py-4">
        {props.moviePath ? (
         <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Configured</span>
        ) : (
         <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700" style={{ color: 'var(--text-muted)' }}>Not set</span>
        )}
       </td>
       <td className="px-4 py-4 text-right">
        <Button variant="secondary" size="sm" onClick={() => props.setBrowsingFor('movie')}>
         Browse
        </Button>
       </td>
      </tr>

      {/* TV Shows Row */}
      <tr style={{ backgroundColor: 'var(--card-bg)' }}>
       <td className="px-4 py-4">
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>TV Shows</p>
       </td>
       <td className="px-4 py-4">
        <Input 
         type="text" 
         value={props.tvPath} 
         onChange={(e) => props.setTvPath(e.target.value)} 
         placeholder="/data/media/tv" 
         className="dark:bg-gray-800/50 font-mono text-sm max-w-lg" 
        />
       </td>
       <td className="px-4 py-4">
        {props.tvPath ? (
         <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Configured</span>
        ) : (
         <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700" style={{ color: 'var(--text-muted)' }}>Not set</span>
        )}
       </td>
       <td className="px-4 py-4 text-right">
        <Button variant="secondary" size="sm" onClick={() => props.setBrowsingFor('tv')}>
         Browse
        </Button>
       </td>
      </tr>
     </tbody>
    </table></div>
   </div>

   <div className="flex justify-end">
    <Button onClick={props.handleSavePaths} className="px-6 h-10">
     Save Paths
    </Button>
   </div>

   {/* Folder Browser Modal */}
   {props.browsingFor && (
    <FolderBrowser
     currentPath={props.browsingFor === 'movie' ? props.moviePath : props.tvPath}
     onSelect={(path) => {
      if (props.browsingFor === 'movie') {
       props.setMoviePath(path);
      } else {
       props.setTvPath(path);
      }
     }}
     onClose={() => props.setBrowsingFor(null)}
    />
   )}
  </div>
 );
}

function WorkersTab() {
 const [workers, setWorkers] = useState<Worker[]>([]);
 const [loading, setLoading] = useState(true);
 const [actionLoading, setActionLoading] = useState<string | null>(null);
 const { addToast } = useToast();

 useEffect(() => {
  loadWorkers();
  // Refresh every 5 seconds
  const interval = setInterval(loadWorkers, 5000);
  return () => clearInterval(interval);
 }, []);

 const loadWorkers = async () => {
  try {
   const data = await api.getWorkers();
   setWorkers(data);
  } catch (error) {
   console.error('Failed to load workers:', error);
  } finally {
   setLoading(false);
  }
 };

 const handleStart = async (id: string) => {
  setActionLoading(id);
  try {
   await api.startWorker(id);
   addToast({ type: 'success', message: 'Task started' });
   await loadWorkers();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to start task' });
  } finally {
   setActionLoading(null);
  }
 };

 const handleStop = async (id: string) => {
  setActionLoading(id);
  try {
   await api.stopWorker(id);
   addToast({ type: 'success', message: 'Task stopped' });
   await loadWorkers();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to stop task' });
  } finally {
   setActionLoading(null);
  }
 };

 const handleRunNow = async (id: string) => {
  setActionLoading(id + '-run');
  try {
   await api.runWorkerNow(id);
   addToast({ type: 'success', message: 'Task triggered' });
   await loadWorkers();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to run task' });
  } finally {
   setActionLoading(null);
  }
 };

 const handleUpdateInterval = async (id: string, intervalMs: number) => {
  try {
   await api.updateWorkerInterval(id, intervalMs);
   addToast({ type: 'success', message: 'Interval updated' });
   await loadWorkers();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to update interval' });
  }
 };

 const formatLastRun = (lastRun?: string) => {
  if (!lastRun) return 'Never';
  const date = new Date(lastRun);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
 };

 const intervalOptions = [
  { label: '5 sec', value: 5000 },
  { label: '30 sec', value: 30000 },
  { label: '1 min', value: 60000 },
  { label: '5 min', value: 300000 },
  { label: '15 min', value: 900000 },
  { label: '30 min', value: 1800000 },
  { label: '1 hour', value: 3600000 },
  { label: '6 hours', value: 21600000 },
  { label: '12 hours', value: 43200000 },
  { label: '24 hours', value: 86400000 },
 ];

 // Group workers by category
 const workerCategories = [
  { 
   name: 'Media Management', 
   icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z',
   ids: ['download-sync', 'library-refresh', 'metadata-refresh'] 
  },
  { 
   name: 'Search & Indexers', 
   icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
   ids: ['rss-sync', 'missing-search', 'cutoff-search'] 
  },
  { 
   name: 'Lists & Import', 
   icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
   ids: ['import-list-sync'] 
  },
  { 
   name: 'Maintenance', 
   icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
   ids: ['activity-cleanup', 'database-backup'] 
  },
 ];

 if (loading) {
  return (
   <div className="p-6 text-center text-gray-500 dark:text-gray-400">
    Loading tasks...
   </div>
  );
 }

 const runningCount = workers.filter(w => w.status === 'running').length;
 const errorCount = workers.filter(w => w.status === 'error').length;

 return (
  <div className="p-6 space-y-6">
   {/* Header with stats */}
   <div className="flex items-center justify-between">
    <div>
     <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Scheduled Tasks</h2>
     <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage background tasks that run automatically</p>
    </div>
    <div className="flex items-center gap-3">
     <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30">
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
      <span className="text-sm font-medium text-green-700 dark:text-green-400">{runningCount} Running</span>
     </div>
     {errorCount > 0 && (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30">
       <span className="w-2 h-2 rounded-full bg-red-500"></span>
       <span className="text-sm font-medium text-red-700 dark:text-red-400">{errorCount} Error</span>
      </div>
     )}
    </div>
   </div>

   {/* Workers grouped by category */}
   {workerCategories.map((category) => {
    const categoryWorkers = workers.filter(w => category.ids.includes(w.id));
    if (categoryWorkers.length === 0) return null;
    
    return (
     <div key={category.name} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Category Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
       <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
         <path strokeLinecap="round" strokeLinejoin="round" d={category.icon} />
        </svg>
        <h3 className="font-medium text-gray-900 dark:text-white">{category.name}</h3>
       </div>
      </div>
      
      {/* Tasks Table */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
       {categoryWorkers.map((worker) => (
        <div key={worker.id} className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
         {/* Status indicator */}
         <div className="flex-shrink-0">
          {worker.status === 'running' ? (
           <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" title="Running"></div>
          ) : worker.status === 'error' ? (
           <div className="w-3 h-3 rounded-full bg-red-500" title="Error"></div>
          ) : (
           <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" title="Stopped"></div>
          )}
         </div>
         
         {/* Task info */}
         <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
           <span className="font-medium text-gray-900 dark:text-white">{worker.name}</span>
           {worker.errorMessage && (
            <span className="text-xs text-red-600 dark:text-red-400 truncate max-w-xs" title={worker.errorMessage}>
             ({worker.errorMessage})
            </span>
           )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{worker.description}</p>
         </div>
         
         {/* Last run */}
         <div className="hidden sm:block text-right flex-shrink-0 w-20">
          <span className="text-xs text-gray-500 dark:text-gray-400">Last run</span>
          <p className="text-sm text-gray-900 dark:text-white">{formatLastRun(worker.lastRun)}</p>
         </div>
         
         {/* Interval selector */}
         <div className="flex-shrink-0 w-24">
          <select
           value={worker.interval || 0}
           onChange={(e) => handleUpdateInterval(worker.id, parseInt(e.target.value))}
           className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
           {intervalOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
           ))}
          </select>
         </div>
         
         {/* Actions */}
         <div className="flex items-center gap-1 flex-shrink-0">
          {/* Run Now button */}
          <button
           onClick={() => handleRunNow(worker.id)}
           disabled={actionLoading === worker.id + '-run'}
           className="p-1.5 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
           title="Run Now"
          >
           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
           </svg>
          </button>
          
          {/* Toggle button */}
          {worker.status === 'running' ? (
           <button
            onClick={() => handleStop(worker.id)}
            disabled={actionLoading === worker.id}
            className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
            title="Stop Task"
           >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
           </button>
          ) : (
           <button
            onClick={() => handleStart(worker.id)}
            disabled={actionLoading === worker.id}
            className="p-1.5 text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
            title="Start Task"
           >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
             <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
           </button>
          )}
         </div>
        </div>
       ))}
      </div>
     </div>
    );
   })}

   {workers.length === 0 && (
    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
     <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
     </svg>
     <p>No scheduled tasks configured</p>
    </div>
   )}
  </div>
 );
}

interface BackupInfo {
 version: string;
 counts: Record<string, number>;
}

interface BackupPreview {
 meta: { version: string; created_at: string };
 preview: { group: string; tables: { key: string; label: string; count: number; available: boolean }[] }[];
}

function BackupTab({ addToast }: { addToast: (toast: { type: 'info' | 'success' | 'warning' | 'error' | 'progress'; message: string }) => void }) {
 const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
 const [loading, setLoading] = useState(true);
 const [creating, setCreating] = useState(false);
 const [restoring, setRestoring] = useState(false);
 const [restoreStatus, setRestoreStatus] = useState<string>('');
 const [restoreComplete, setRestoreComplete] = useState(false);
 const [restoreError, setRestoreError] = useState<string | null>(null);
 const [restoreFile, setRestoreFile] = useState<File | null>(null);
 const [backupData, setBackupData] = useState<any>(null);
 const [showRestoreModal, setShowRestoreModal] = useState(false);
 const [preview, setPreview] = useState<BackupPreview | null>(null);
 const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
 const [previewing, setPreviewing] = useState(false);
 
 // Scheduled backup state
 const [scheduleFrequency, setScheduleFrequency] = useState('daily');
 const [scheduleTime, setScheduleTime] = useState('03:00');
 const [lastScheduledBackup, setLastScheduledBackup] = useState<string | null>(null);
 const [scheduledBackups, setScheduledBackups] = useState<string[]>([]);
 const [savingSchedule, setSavingSchedule] = useState(false);
 const [backupWorker, setBackupWorker] = useState<any>(null);
 const [workerLoading, setWorkerLoading] = useState(false);

 useEffect(() => {
  loadAll();
 }, []);

 const loadAll = async () => {
  await Promise.all([
   loadBackupInfo(),
   loadScheduleSettings(),
   loadScheduledBackups(),
   loadBackupWorker()
  ]);
 };

 const loadBackupInfo = async () => {
  try {
   const info = await api.getBackupInfo();
   setBackupInfo(info);
  } catch (error) {
   console.error('Failed to load backup info:', error);
  } finally {
   setLoading(false);
  }
 };
 
 const loadScheduleSettings = async () => {
  try {
   const settings = await api.getSettings();
   setScheduleFrequency(settings.backup_schedule_frequency || 'daily');
   setScheduleTime(settings.backup_schedule_time || '03:00');
   setLastScheduledBackup(settings.backup_last_scheduled || null);
  } catch (error) {
   console.error('Failed to load schedule settings:', error);
  }
 };
 
 const loadScheduledBackups = async () => {
  try {
   const backups = await api.getScheduledBackups();
   setScheduledBackups(backups);
  } catch (error) {
   console.error('Failed to load scheduled backups:', error);
  }
 };
 
 const loadBackupWorker = async () => {
  try {
   const workers = await api.getWorkers();
   const worker = workers.find((w: any) => w.id === 'database-backup');
   setBackupWorker(worker);
  } catch (error) {
   console.error('Failed to load backup worker:', error);
  }
 };
 
 const handleToggleWorker = async () => {
  setWorkerLoading(true);
  try {
   if (backupWorker?.status === 'running') {
    await api.stopWorker('database-backup');
    addToast({ type: 'info', message: 'Scheduled backups disabled' });
   } else {
    await api.startWorker('database-backup');
    addToast({ type: 'success', message: 'Scheduled backups enabled' });
   }
   await loadBackupWorker();
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to toggle backup schedule' });
  } finally {
   setWorkerLoading(false);
  }
 };
 
 const handleSaveSchedule = async () => {
  setSavingSchedule(true);
  try {
   await api.updateSettings({
    backup_schedule_frequency: scheduleFrequency,
    backup_schedule_time: scheduleTime
   });
   addToast({ type: 'success', message: 'Schedule saved' });
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to save schedule' });
  } finally {
   setSavingSchedule(false);
  }
 };
 
 const handleDeleteScheduledBackup = async (filename: string) => {
  try {
   await api.deleteScheduledBackup(filename);
   setScheduledBackups(prev => prev.filter(f => f !== filename));
   addToast({ type: 'success', message: 'Backup deleted' });
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to delete backup' });
  }
 };
 
 const handleDownloadScheduledBackup = async (filename: string) => {
  try {
   const blob = await api.downloadScheduledBackup(filename);
   const url = window.URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = filename;
   document.body.appendChild(a);
   a.click();
   window.URL.revokeObjectURL(url);
   document.body.removeChild(a);
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to download backup' });
  }
 };

 const handleCreateBackup = async () => {
  setCreating(true);
  try {
   const blob = await api.createBackup();
   const url = window.URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = `mediastack-backup-${new Date().toISOString().split('T')[0]}.json`;
   document.body.appendChild(a);
   a.click();
   window.URL.revokeObjectURL(url);
   document.body.removeChild(a);
   addToast({ type: 'success', message: 'Backup downloaded' });
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to create backup' });
  } finally {
   setCreating(false);
  }
 };

 const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  setRestoreFile(file);
  setPreviewing(true);
  
  try {
   const text = await file.text();
   const data = JSON.parse(text);
   setBackupData(data);
   
   const previewResult = await api.previewBackup(data);
   setPreview(previewResult);
   
   const allTables = new Set<string>();
   previewResult.preview.forEach(group => {
    group.tables.forEach(table => {
     if (table.available) allTables.add(table.key);
    });
   });
   setSelectedTables(allTables);
   setShowRestoreModal(true);
  } catch (error: any) {
   addToast({ type: 'error', message: 'Invalid backup file format' });
   setRestoreFile(null);
  } finally {
   setPreviewing(false);
   e.target.value = '';
  }
 };

 const toggleTable = (key: string) => {
  setSelectedTables(prev => {
   const next = new Set(prev);
   if (next.has(key)) next.delete(key);
   else next.add(key);
   return next;
  });
 };

 const toggleGroup = (group: { tables: { key: string; available: boolean }[] }) => {
  const availableTables = group.tables.filter(t => t.available).map(t => t.key);
  const allSelected = availableTables.every(key => selectedTables.has(key));
  
  setSelectedTables(prev => {
   const next = new Set(prev);
   if (allSelected) availableTables.forEach(key => next.delete(key));
   else availableTables.forEach(key => next.add(key));
   return next;
  });
 };

 const selectAll = () => {
  if (!preview) return;
  const all = new Set<string>();
  preview.preview.forEach(group => {
   group.tables.forEach(table => {
    if (table.available) all.add(table.key);
   });
  });
  setSelectedTables(all);
 };

 const deselectAll = () => setSelectedTables(new Set());

 const handleRestore = async () => {
  if (!backupData || selectedTables.size === 0) return;
  
  setShowRestoreModal(false);
  setRestoring(true);
  setRestoreStatus('Starting restore...');
  
  try {
   const result = await api.restoreBackup(backupData, Array.from(selectedTables));
   setRestoreStatus(result.message || 'Restore completed successfully');
   setRestoreComplete(true);
   setTimeout(() => window.location.reload(), 2000);
  } catch (error: any) {
   setRestoreError(error.response?.data?.error || error.message || 'Restore failed');
  }
 };

 const closeModal = () => {
  setShowRestoreModal(false);
  setRestoreFile(null);
  setBackupData(null);
  setPreview(null);
  setSelectedTables(new Set());
 };
 
 const formatBackupDate = (filename: string) => {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})/);
  if (match) {
   const date = new Date(`${match[1]}T${match[2]}:${match[3]}:00`);
   return date.toLocaleString();
  }
  return filename;
 };

 if (loading) {
  return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading...</div>;
 }

 const isWorkerRunning = backupWorker?.status === 'running';

 return (
  <div className="p-6 space-y-6">
   {/* Header */}
   <div>
    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Backup & Restore</h2>
    <p className="text-sm text-gray-500 dark:text-gray-400">Manage database backups and restore from previous snapshots</p>
   </div>

   {/* Manual Backup */}
   <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-start justify-between">
     <div className="flex-1">
      <div className="flex items-center gap-3">
       <h3 className="text-lg font-medium text-gray-900 dark:text-white">Manual Backup</h3>
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Download a JSON backup of your database (movies, series, profiles, settings)</p>
      {backupInfo && (
       <div className="mt-2 flex flex-wrap items-center gap-2">
        {Object.entries(backupInfo.counts).map(([label, count]) => (
         <span key={label} className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {label}: {count}
         </span>
        ))}
       </div>
      )}
     </div>
     <button
      onClick={handleCreateBackup}
      disabled={creating}
      className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
     >
      {creating ? (
       <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
       </svg>
      ) : (
       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
       </svg>
      )}
      {creating ? 'Creating...' : 'Download'}
     </button>
    </div>
   </div>

   {/* Scheduled Backup */}
   <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-start justify-between">
     <div className="flex-1">
      <div className="flex items-center gap-3">
       <h3 className="text-lg font-medium text-gray-900 dark:text-white">Scheduled Backup</h3>
       <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
        isWorkerRunning 
         ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
         : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
       }`}>
        {isWorkerRunning && <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>}
        {isWorkerRunning ? 'Running' : 'Stopped'}
       </span>
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Automatically backup the database to /backup directory</p>
      
      {/* Schedule settings */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
       <span className="text-xs text-gray-500 dark:text-gray-400">Schedule:</span>
       <select
        value={scheduleFrequency}
        onChange={(e) => setScheduleFrequency(e.target.value)}
        className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-0 focus:ring-2 focus:ring-blue-500 cursor-pointer"
       >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
       </select>
       <span className="text-xs text-gray-500 dark:text-gray-400">at</span>
       <input
        type="time"
        value={scheduleTime}
        onChange={(e) => setScheduleTime(e.target.value)}
        className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-0"
       />
       <button
        onClick={handleSaveSchedule}
        disabled={savingSchedule}
        className="text-xs px-2 py-1 text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
       >
        {savingSchedule ? 'Saving...' : 'Save'}
       </button>
       {lastScheduledBackup && (
        <span className="px-2.5 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
         Last: {new Date(lastScheduledBackup).toLocaleString()}
        </span>
       )}
      </div>
     </div>
     
     {/* Action buttons */}
     <div className="flex items-center gap-2 ml-4">
      {isWorkerRunning ? (
       <button
        onClick={handleToggleWorker}
        disabled={workerLoading}
        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors"
        title="Stop"
       >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
       </button>
      ) : (
       <button
        onClick={handleToggleWorker}
        disabled={workerLoading}
        className="p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-50 transition-colors"
        title="Start"
       >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
       </button>
      )}
     </div>
    </div>
   </div>

   {/* Scheduled Backups List */}
   {scheduledBackups.length > 0 && (
    <div className="border border-gray-200 dark:border-gray-700 overflow-hidden">
     <div className="table-responsive">
     <table className="w-full">
      <thead>
       <tr className="border-b border-gray-200 dark:border-gray-700" style={{ backgroundColor: 'var(--surface-bg)' }}>
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Backup File</th>
        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-24">Actions</th>
       </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
       {scheduledBackups.map(filename => (
        <tr key={filename} className="hover:bg-gray-50 dark:hover:bg-gray-800/50" style={{ backgroundColor: 'var(--card-bg)' }}>
         <td className="px-4 py-3">
          <div className="flex items-center gap-2">
           <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
           </svg>
           <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">{filename}</span>
          </div>
         </td>
         <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatBackupDate(filename)}</td>
         <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
           <button
            onClick={() => handleDownloadScheduledBackup(filename)}
            className="p-1.5 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
            title="Download"
           >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
           </button>
           <button
            onClick={() => handleDeleteScheduledBackup(filename)}
            className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
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
   )}

   {/* Restore Backup */}
   <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-start justify-between">
     <div className="flex-1">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Restore from Backup</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Restore your database from a JSON backup file</p>
      <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">⚠️ This will replace existing data and cannot be undone</p>
     </div>
     <div>
      <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" id="backup-file-input" />
      <label
       htmlFor="backup-file-input"
       className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${restoring || previewing ? 'opacity-50 pointer-events-none' : ''}`}
      >
       {previewing ? (
        <>
         <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
         </svg>
         Reading...
        </>
       ) : (
        <>
         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
         </svg>
         Select File
        </>
       )}
      </label>
     </div>
    </div>
   </div>

   {/* Restore Progress Modal */}
   {restoring && (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[110]">
     <div className="bg-white dark:bg-gray-800 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
      <div className="p-8 text-center">
       {!restoreComplete && !restoreError && (
        <>
         <div className="flex justify-center mb-6">
          <svg className="animate-spin h-12 w-12 text-primary-500" fill="none" viewBox="0 0 24 24">
           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
         </div>
         <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Restoring Backup</h3>
         <p className="text-gray-500 dark:text-gray-400 mb-4">{restoreStatus}</p>
         <p className="text-sm text-gray-400 dark:text-gray-500">Please do not close this page...</p>
        </>
       )}
       {restoreComplete && (
        <>
         <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
           <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
           </svg>
          </div>
         </div>
         <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Restore Complete</h3>
         <p className="text-gray-500 dark:text-gray-400 mb-4">{restoreStatus}</p>
         <p className="text-sm text-gray-400 dark:text-gray-500">Reloading page...</p>
        </>
       )}
       {restoreError && (
        <>
         <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
           <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
           </svg>
          </div>
         </div>
         <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Restore Failed</h3>
         <p className="text-red-500 dark:text-red-400 mb-6">{restoreError}</p>
         <button
          onClick={() => { setRestoring(false); setRestoreError(null); setRestoreStatus(''); setRestoreFile(null); setBackupData(null); setPreview(null); }}
          className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium transition-colors"
         >
          Close
         </button>
        </>
       )}
      </div>
      {!restoreComplete && !restoreError && (
       <div className="h-1 bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className="h-full bg-primary-500 animate-pulse" style={{ width: '100%' }}></div>
       </div>
      )}
     </div>
    </div>
   )}

   {/* Restore Preview Modal */}
   {showRestoreModal && preview && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="bg-white dark:bg-gray-800 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
       <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Restore Backup</h3>
       <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        <span className="font-medium">{restoreFile?.name}</span>
        <span className="mx-2">•</span>
        <span>Version: {preview.meta.version}</span>
        <span className="mx-2">•</span>
        <span>Created: {new Date(preview.meta.created_at).toLocaleString()}</span>
       </div>
      </div>
      
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
       <button onClick={selectAll} className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">Select All</button>
       <span className="text-gray-300 dark:text-gray-600">|</span>
       <button onClick={deselectAll} className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">Deselect All</button>
       <div className="flex-1" />
       <span className="text-sm text-gray-500 dark:text-gray-400">{selectedTables.size} table{selectedTables.size !== 1 ? 's' : ''} selected</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
       {preview.preview.map((group) => {
        const availableTables = group.tables.filter(t => t.available);
        const allGroupSelected = availableTables.every(t => selectedTables.has(t.key));
        const someGroupSelected = availableTables.some(t => selectedTables.has(t.key));
        
        return (
         <div key={group.group}>
          <div className="flex items-center gap-3 mb-3">
           <input
            type="checkbox"
            checked={allGroupSelected}
            ref={(el) => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
            onChange={() => toggleGroup(group)}
            className="rounded border-gray-300 dark:border-gray-600 text-primary-600"
            disabled={availableTables.length === 0}
           />
           <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{group.group}</h4>
          </div>
          <div className="ml-6 space-y-2">
           {group.tables.map((table) => (
            <label key={table.key} className={`flex items-center gap-3 ${!table.available ? 'opacity-50' : 'cursor-pointer'}`}>
             <input
              type="checkbox"
              checked={selectedTables.has(table.key)}
              onChange={() => toggleTable(table.key)}
              disabled={!table.available}
              className="rounded border-gray-300 dark:border-gray-600 text-primary-600"
             />
             <span className="text-sm text-gray-700 dark:text-gray-300">{table.label}</span>
             <span className={`text-sm ${table.count > 0 ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-400'}`}>({table.count})</span>
            </label>
           ))}
          </div>
         </div>
        );
       })}
      </div>
      
      <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-900/30">
       <p className="text-sm text-red-600 dark:text-red-400">⚠️ Restoring will replace selected data and cannot be undone.</p>
      </div>
      
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
       <button onClick={closeModal} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
       <button
        onClick={handleRestore}
        disabled={selectedTables.size === 0}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
       >
        Restore {selectedTables.size > 0 && `(${selectedTables.size} tables)`}
       </button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}


// Import Tab with Sub-tabs
function ImportTabContent({ 
 addToast, 
 initialMediaType, 
 initialSubTab 
}: { 
 addToast: (toast: { type: 'info' | 'success' | 'warning' | 'error' | 'progress'; message: string }) => void;
 initialMediaType?: 'movie' | 'tv';
 initialSubTab?: 'scan' | 'arr';
}) {
 const [subTab, setSubTab] = useState<'scan' | 'arr'>(initialSubTab || 'scan');

 return (
  <div>
   {/* Sub-tab Navigation */}
   <div className="border-b border-gray-200 dark:border-gray-700">
    <div className="flex">
     <button
      onClick={() => setSubTab('scan')}
      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
       subTab === 'scan'
        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
     >
      Import Media
     </button>
     <button
      onClick={() => setSubTab('arr')}
      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
       subTab === 'arr'
        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
     >
      Import from Radarr/Sonarr
     </button>
    </div>
   </div>

   {/* Sub-tab Content */}
   <div className="p-6">
    {subTab === 'scan' && (
     <ImportSection 
      onToast={(message, type) => addToast({ type, message })}
      initialMediaType={initialMediaType}
     />
    )}
    {subTab === 'arr' && (
     <ArrImportSection 
      onToast={(message, type) => addToast({ type, message })}
     />
    )}
   </div>
  </div>
 );
}

export function SettingsPage() {
 const { addToast, settings: toastSettings, updateSettings: updateToastSettings } = useToast();
 const { settings: uiSettings, updateSettings: updateUISettings } = useUISettings();
 const { timezone, setTimezone } = useTimezone();
 const [searchParams] = useSearchParams();
 const [loading, setLoading] = useState(true);
 
 // Read tab from URL parameter, default to 'ui'
 const urlTab = searchParams.get('tab') as 'ui' | 'naming' | 'paths' | 'quality' | 'customformats' | 'indexers' | 'downloads' | 'notifications' | 'lists' | 'import' | 'api' | 'jobs' | 'backup' | null;
 const [activeTab, setActiveTab] = useState<'ui' | 'naming' | 'filemanagement' | 'paths' | 'quality' | 'customformats' | 'indexers' | 'downloads' | 'notifications' | 'lists' | 'import' | 'api' | 'jobs' | 'backup'>(urlTab || 'ui');

 // Update tab when URL changes
 useEffect(() => {
  if (urlTab && ['ui', 'naming', 'paths', 'quality', 'customformats', 'indexers', 'downloads', 'notifications', 'lists', 'import', 'api', 'jobs', 'backup'].includes(urlTab)) {
   setActiveTab(urlTab);
  }
 }, [urlTab]);

 // API Keys
 const [tmdbApiKey, setTmdbApiKey] = useState('');
 const [tvdbApiKey, setTvdbApiKey] = useState('');
 const [omdbApiKey, setOmdbApiKey] = useState('');
 const [tmdbKeyConfigured, setTmdbKeyConfigured] = useState(false);
 const [tvdbKeyConfigured, setTvdbKeyConfigured] = useState(false);
 const [omdbKeyConfigured, setOmdbKeyConfigured] = useState(false);
 const [tmdbEditing, setTmdbEditing] = useState(false);
 const [tvdbEditing, setTvdbEditing] = useState(false);
 const [omdbEditing, setOmdbEditing] = useState(false);
 const [testingTmdb, setTestingTmdb] = useState(false);
 const [testingTvdb, setTestingTvdb] = useState(false);
 const [testingOmdb, setTestingOmdb] = useState(false);
 const [tmdbTestResult, setTmdbTestResult] = useState<{ valid: boolean; message: string } | null>(null);
 const [tvdbTestResult, setTvdbTestResult] = useState<{ valid: boolean; message: string } | null>(null);
 const [omdbTestResult, setOmdbTestResult] = useState<{ valid: boolean; message: string } | null>(null);
 const [concurrentRequests, setConcurrentRequests] = useState(5);

 // Media Paths
 const [moviePath, setMoviePath] = useState('/data');
 const [tvPath, setTvPath] = useState('/data');
 const [browsingFor, setBrowsingFor] = useState<'movie' | 'tv' | null>(null);

 // Quality Profiles
 const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([]);
 const [editingProfile, setEditingProfile] = useState<QualityProfile | null>(null);
 const [showAddProfile, setShowAddProfile] = useState(false);
 const [deleteProfileConfirm, setDeleteProfileConfirm] = useState<QualityProfile | null>(null);

 // Naming Configuration
 const [namingConfig, setNamingConfig] = useState<NamingConfig | null>(null);
 const [namingPreview, setNamingPreview] = useState<{ movie?: string; episode?: string }>({});
 
 // File Management Settings
 const [fileManagementSettings, setFileManagementSettings] = useState({
  propers_repacks_preference: 'preferAndUpgrade',
  delete_empty_folders: true,
  unmonitor_deleted_media: true
 });
 const [fileManagementLoading, setFileManagementLoading] = useState(false);

 useEffect(() => {
  loadData();
 }, []);

 const loadData = async () => {
  try {
   const [settingsData, profilesData, namingData, fileManagementData] = await Promise.all([
    api.getSettings(),
    api.getQualityProfiles().catch(() => []),
    api.getNamingConfig().catch(() => null),
    api.getFileManagementSettings().catch(() => ({ propers_repacks_preference: 'preferAndUpgrade', delete_empty_folders: true, unmonitor_deleted_media: true }))
   ]);
   setQualityProfiles(profilesData || []);
   setNamingConfig(namingData);
   setFileManagementSettings(fileManagementData);
   
   if (settingsData) {
    // Don't store actual API keys - just track if they're configured
    setTmdbKeyConfigured(!!settingsData.tmdb_api_key);
    setTvdbKeyConfigured(!!settingsData.tvdb_api_key);
    setOmdbKeyConfigured(!!settingsData.omdb_api_key);
    setTmdbApiKey(''); // Don't expose actual key
    setTvdbApiKey(''); // Don't expose actual key
    setOmdbApiKey(''); // Don't expose actual key
    setMoviePath(settingsData.movie_path || '/data/media/movies');
    setTvPath(settingsData.tv_path || '/data/media/tv');
    setConcurrentRequests(settingsData.concurrent_requests || 5);
    setTimezone(settingsData.timezone || 'Australia/Sydney');
    
    // Set API status as configured if keys exist (they were tested before saving)
    if (settingsData.tmdb_api_key) {
     setTmdbTestResult({ valid: true, message: 'API key configured' });
    }
    if (settingsData.tvdb_api_key) {
     setTvdbTestResult({ valid: true, message: 'API key configured' });
    }
    if (settingsData.omdb_api_key) {
     setOmdbTestResult({ valid: true, message: 'API key configured' });
    }
   }

   // Load naming preview
   if (namingData) {
    const [moviePreview, episodePreview] = await Promise.all([
     api.previewNaming('movie').catch(() => ({ preview: '' })),
     api.previewNaming('episode').catch(() => ({ preview: '' }))
    ]);
    setNamingPreview({
     movie: moviePreview.preview,
     episode: episodePreview.preview
    });
   }
  } catch (error) {
   console.error('Failed to load data:', error);
  } finally {
   setLoading(false);
  }
 };

 const handleSaveTmdb = async () => {
  if (!tmdbApiKey.trim()) {
   addToast({ type: 'warning', message: 'Please enter an API key' });
   return;
  }
  
  setTestingTmdb(true);
  setTmdbTestResult(null);
  
  try {
   // Test the API key first
   const result = await api.testTmdbKey(tmdbApiKey);
   setTmdbTestResult(result);
   
   if (!result.valid) {
    addToast({ type: 'error', message: result.message || 'Invalid API key - please check and try again' });
    return;
   }
   
   // If valid, save it
   await api.updateSetting('tmdb_api_key', tmdbApiKey);
   addToast({ type: 'success', message: 'TMDB API key verified and saved!' });
   setTmdbKeyConfigured(true);
   setTmdbEditing(false);
   setTmdbApiKey(''); // Clear from memory
  } catch (error: any) {
   setTmdbTestResult({ valid: false, message: error.response?.data?.message || 'Test failed' });
   addToast({ type: 'error', message: 'Failed to verify API key' });
  } finally {
   setTestingTmdb(false);
  }
 };

 const handleSaveTvdb = async () => {
  if (!tvdbApiKey.trim()) {
   addToast({ type: 'warning', message: 'Please enter an API key' });
   return;
  }
  
  setTestingTvdb(true);
  setTvdbTestResult(null);
  
  try {
   // Test the API key first
   const result = await api.testTvdbKey(tvdbApiKey);
   setTvdbTestResult(result);
   
   if (!result.valid) {
    addToast({ type: 'error', message: result.message || 'Invalid API key - please check and try again' });
    return;
   }
   
   // If valid, save it
   await api.updateSetting('tvdb_api_key', tvdbApiKey);
   addToast({ type: 'success', message: 'TVDB API key verified and saved!' });
   setTvdbKeyConfigured(true);
   setTvdbEditing(false);
   setTvdbApiKey(''); // Clear from memory
  } catch (error: any) {
   setTvdbTestResult({ valid: false, message: error.response?.data?.message || 'Test failed' });
   addToast({ type: 'error', message: 'Failed to verify API key' });
  } finally {
   setTestingTvdb(false);
  }
 };

 const handleSaveOmdb = async () => {
  if (!omdbApiKey.trim()) {
   addToast({ type: 'warning', message: 'Please enter an API key' });
   return;
  }
  
  setTestingOmdb(true);
  setOmdbTestResult(null);
  
  try {
   // Test the API key first
   const result = await api.testOmdbKey(omdbApiKey);
   setOmdbTestResult(result);
   
   if (!result.valid) {
    addToast({ type: 'error', message: result.message || 'Invalid API key - please check and try again' });
    return;
   }
   
   // If valid, save it
   await api.updateSetting('omdb_api_key', omdbApiKey);
   addToast({ type: 'success', message: 'OMDB API key verified and saved!' });
   setOmdbKeyConfigured(true);
   setOmdbEditing(false);
   setOmdbApiKey(''); // Clear from memory
  } catch (error: any) {
   setOmdbTestResult({ valid: false, message: error.response?.data?.message || 'Test failed' });
   addToast({ type: 'error', message: 'Failed to verify API key' });
  } finally {
   setTestingOmdb(false);
  }
 };

 const handleSaveConcurrentRequests = async (value: number) => {
  try {
   await api.updateSetting('concurrent_requests', value.toString());
   setConcurrentRequests(value);
   addToast({ type: 'success', message: `Concurrent requests set to ${value}` });
  } catch (error: any) {
   addToast({ type: 'error', message: 'Failed to save setting' });
  }
 };

 const handleSavePaths = async () => {
  try {
   await api.updateSetting('movie_path', moviePath);
   await api.updateSetting('tv_path', tvPath);
   addToast({ type: 'success', message: 'Media paths saved!' });
  } catch (error: any) {
   addToast({ type: 'error', message: error.response?.data?.error || 'Failed to save paths' });
  }
 };

 const handleSaveFileManagement = async () => {
  setFileManagementLoading(true);
  try {
   await api.updateFileManagementSettings(fileManagementSettings);
   addToast({ type: 'success', message: 'File management settings saved!' });
  } catch (error: any) {
   addToast({ type: 'error', message: error.response?.data?.error || 'Failed to save settings' });
  } finally {
   setFileManagementLoading(false);
  }
 };

 if (loading) {
  return (
   <Layout maxWidth="default">
    <div className="flex items-center justify-center h-64">
     <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--theme-primary)' }}></div>
    </div>
   </Layout>
  );
 }

 // Sidebar navigation groups
 const navGroups = [
  {
   label: 'General',
   items: [
    { id: 'ui', label: 'UI Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'api', label: 'API Keys', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
   ]
  },
  {
   label: 'Library',
   items: [
    { id: 'naming', label: 'File Naming', icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { id: 'filemanagement', label: 'File Management', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { id: 'paths', label: 'Library Paths', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
    { id: 'import', label: 'Import', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
    { id: 'lists', label: 'Lists', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
   ]
  },
  {
   label: 'Quality',
   items: [
    { id: 'quality', label: 'Quality Profiles', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'customformats', label: 'Custom Formats', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
   ]
  },
  {
   label: 'Integrations',
   items: [
    { id: 'indexers', label: 'Indexers', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { id: 'downloads', label: 'Download Clients', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
    { id: 'notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
   ]
  },
  {
   label: 'System',
   items: [
    { id: 'jobs', label: 'Tasks', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'backup', label: 'Backup', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
   ]
  },
 ];

 return (
  <Layout maxWidth="default">
   <div className="flex flex-col lg:flex-row gap-6">
    {/* Sidebar Navigation */}
    <div className="lg:w-64 flex-shrink-0">
     <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden sticky top-4">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
       <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h1>
      </div>
      <nav className="p-2">
       {navGroups.map((group, groupIdx) => (
        <div key={group.label} className={groupIdx > 0 ? 'mt-4' : ''}>
         <p className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {group.label}
         </p>
         {group.items.map((item) => (
          <button
           key={item.id}
           onClick={() => setActiveTab(item.id as any)}
           className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
            activeTab === item.id
             ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
             : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
           }`}
          >
           <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
           </svg>
           {item.label}
          </button>
         ))}
        </div>
       ))}
      </nav>
     </div>
    </div>

    {/* Main Content */}
    <div className="flex-1 min-w-0">
     <div className="bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700">
     
     {/* Quality Profiles Tab */}
     {activeTab === 'quality' && (
      <div className="p-6 space-y-6">
       {/* Header */}
       <div className="flex justify-between items-start">
        <div>
         <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Quality Profiles</h2>
         <p className="text-sm text-gray-500 dark:text-gray-400">Define quality preferences for downloads</p>
        </div>
        <Button onClick={() => setShowAddProfile(true)}>
         Add Profile
        </Button>
       </div>

       {/* Profiles Table */}
       <div className="border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
        <div className="table-responsive">
        <table className="w-full">
         <thead>
          <tr className="border-b" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
           <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Name</th>
           <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Type</th>
           <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Cutoff</th>
           <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Upgrades</th>
           <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Allowed Qualities</th>
           <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Actions</th>
          </tr>
         </thead>
         <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
          {qualityProfiles.length === 0 ? (
           <tr style={{ backgroundColor: 'var(--card-bg)' }}>
            <td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
             No quality profiles configured. Click "Add Profile" to get started.
            </td>
           </tr>
          ) : qualityProfiles.map((profile) => (
           <tr 
            key={profile.id} 
            style={{ backgroundColor: 'var(--card-bg)' }}
            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
            onClick={() => setEditingProfile(profile)}
           >
            <td className="px-4 py-4 whitespace-nowrap">
             <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{profile.name}</p>
            </td>
            <td className="px-4 py-4 whitespace-nowrap">
             <span 
              className="px-2 py-0.5 text-xs font-medium rounded"
              style={{
               backgroundColor: profile.media_type === 'movie' ? '#7fc8f8' :
                profile.media_type === 'series' ? '#ea9ab2' : '#ffe45e',
               color: '#000'
              }}
             >
              {profile.media_type === 'movie' ? 'Movies' : profile.media_type === 'series' ? 'Series' : 'Both'}
             </span>
            </td>
            <td className="px-4 py-4 whitespace-nowrap">
             <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              {profile.cutoff_quality}
             </span>
            </td>
            <td className="px-4 py-4 whitespace-nowrap">
             <span className={`px-2 py-0.5 text-xs font-medium ${
              profile.upgrade_allowed 
               ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
               : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
             }`}>
              {profile.upgrade_allowed ? 'Yes' : 'No'}
             </span>
            </td>
            <td className="px-4 py-4">
             <div className="flex flex-wrap gap-1">
              {profile.items.filter(i => i.allowed).map((item, idx) => (
               <span key={idx} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {item.quality}
               </span>
              ))}
             </div>
            </td>
            <td className="px-4 py-4 text-right">
             <div className="flex items-center justify-end gap-1">
              <button 
               onClick={(e) => {
                e.stopPropagation();
                // Create a copy of the profile
                const copiedProfile: QualityProfile = {
                 ...profile,
                 id: '',
                 name: `${profile.name} (Copy)`
                };
                setEditingProfile(copiedProfile);
                setShowAddProfile(true);
               }}
               className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
               title="Copy profile"
              >
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
               </svg>
              </button>
              <button 
               onClick={(e) => {
                e.stopPropagation();
                setDeleteProfileConfirm(profile);
               }}
               className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
               title="Delete profile"
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
      </div>
     )}

     {/* Quality Profile Editor Modal */}
     {(editingProfile || showAddProfile) && (
      <QualityProfileEditor
       profile={editingProfile}
       isNew={showAddProfile}
       onSave={() => loadData()}
       onClose={() => {
        setEditingProfile(null);
        setShowAddProfile(false);
       }}
      />
     )}

     {/* Quality Profile Delete Confirmation */}
     <ConfirmModal
      isOpen={!!deleteProfileConfirm}
      title="Delete Quality Profile"
      message={`Are you sure you want to delete "${deleteProfileConfirm?.name}"? This action cannot be undone.`}
      confirmText="Delete"
      onConfirm={async () => {
       if (deleteProfileConfirm) {
        try {
         await api.deleteQualityProfile(deleteProfileConfirm.id);
         addToast({ message: 'Quality profile deleted', type: 'success' });
         loadData();
        } catch (error) {
         addToast({ message: 'Failed to delete profile', type: 'error' });
        }
       }
       setDeleteProfileConfirm(null);
      }}
      onCancel={() => setDeleteProfileConfirm(null)}
     />

     {/* Custom Formats Tab */}
     {activeTab === 'customformats' && (
      <div className="p-6">
       <CustomFormatsSection />
      </div>
     )}

     {/* File Naming Tab */}
     {activeTab === 'naming' && (
      <NamingTab 
       namingConfig={namingConfig}
       setNamingConfig={setNamingConfig}
       namingPreview={namingPreview}
       setNamingPreview={setNamingPreview}
       moviePath={moviePath}
       setMoviePath={setMoviePath}
       tvPath={tvPath}
       setTvPath={setTvPath}
       browsingFor={browsingFor}
       setBrowsingFor={setBrowsingFor}
       handleSavePaths={handleSavePaths}
       addToast={addToast}
      />
     )}

     {/* File Management Tab */}
     {activeTab === 'filemanagement' && (
      <div className="p-6 space-y-6">
       <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">File Management</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure file handling behavior for your library</p>
       </div>

       {/* Settings Table */}
       <div className="border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
        <div className="table-responsive">
        <table className="w-full">
         <thead>
          <tr className="border-b" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
           <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Setting</th>
           <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Description</th>
           <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Value</th>
          </tr>
         </thead>
         <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
          {/* Propers and Repacks */}
          <tr style={{ backgroundColor: 'var(--card-bg)' }}>
           <td className="px-4 py-4">
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Propers and Repacks</p>
           </td>
           <td className="px-4 py-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
             Whether to automatically upgrade to Propers/Repacks when available
            </p>
           </td>
           <td className="px-4 py-4 text-right">
            <select
             value={fileManagementSettings.propers_repacks_preference}
             onChange={(e) => setFileManagementSettings(prev => ({ ...prev, propers_repacks_preference: e.target.value }))}
             className="px-3 py-2 text-sm border bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
             style={{ borderColor: 'var(--input-border)' }}
            >
             <option value="preferAndUpgrade">Prefer and Upgrade</option>
             <option value="doNotUpgrade">Do not Upgrade Automatically</option>
             <option value="doNotPrefer">Do not Prefer</option>
            </select>
           </td>
          </tr>

          {/* Unmonitor Deleted Media */}
          <tr style={{ backgroundColor: 'var(--card-bg)' }}>
           <td className="px-4 py-4">
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Unmonitor Deleted Media</p>
           </td>
           <td className="px-4 py-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
             Movies and series deleted from disk are automatically unmonitored
            </p>
           </td>
           <td className="px-4 py-4 text-right">
            <label className="relative inline-flex items-center cursor-pointer">
             <input
              type="checkbox"
              checked={fileManagementSettings.unmonitor_deleted_media}
              onChange={(e) => setFileManagementSettings(prev => ({ ...prev, unmonitor_deleted_media: e.target.checked }))}
              className="sr-only peer"
             />
             <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
           </td>
          </tr>

          {/* Delete Empty Folders */}
          <tr style={{ backgroundColor: 'var(--card-bg)' }}>
           <td className="px-4 py-4">
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Delete Empty Folders</p>
           </td>
           <td className="px-4 py-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
             Delete empty movie/series and season folders during disk scan
            </p>
           </td>
           <td className="px-4 py-4 text-right">
            <label className="relative inline-flex items-center cursor-pointer">
             <input
              type="checkbox"
              checked={fileManagementSettings.delete_empty_folders}
              onChange={(e) => setFileManagementSettings(prev => ({ ...prev, delete_empty_folders: e.target.checked }))}
              className="sr-only peer"
             />
             <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
           </td>
          </tr>
         </tbody>
        </table></div>
       </div>

       <div className="flex justify-end">
        <Button onClick={handleSaveFileManagement} disabled={fileManagementLoading}>
         {fileManagementLoading ? 'Saving...' : 'Save Settings'}
        </Button>
       </div>
      </div>
     )}

     {/* Library Paths Tab */}
     {activeTab === 'paths' && (
      <LibraryPathsTab 
       namingConfig={namingConfig}
       setNamingConfig={setNamingConfig}
       namingPreview={namingPreview}
       setNamingPreview={setNamingPreview}
       moviePath={moviePath}
       setMoviePath={setMoviePath}
       tvPath={tvPath}
       setTvPath={setTvPath}
       browsingFor={browsingFor}
       setBrowsingFor={setBrowsingFor}
       handleSavePaths={handleSavePaths}
       addToast={addToast}
      />
     )}

     {/* Indexers Tab */}
     {activeTab === 'indexers' && (
      <div className="p-6">
       <IndexersManager 
        onToast={(message, type) => addToast({ type, message })}
       />
      </div>
     )}

     {/* Download Clients Tab */}
     {activeTab === 'downloads' && (
      <div className="p-6">
       <DownloadClientsManager 
        onToast={(message, type) => addToast({ type, message })}
       />
      </div>
     )}

     {/* Notifications Tab */}
     {activeTab === 'notifications' && (
      <div className="p-6">
       <NotificationsManager 
        onToast={(message, type) => addToast({ type, message })}
       />
      </div>
     )}

     {/* Import Lists Tab */}
     {activeTab === 'lists' && (
      <div className="p-6">
       <ImportListsSection 
        onToast={(message, type) => addToast({ type, message })}
       />
      </div>
     )}

     {/* Import Tab with Sub-tabs */}
     {activeTab === 'import' && (
      <ImportTabContent 
       addToast={addToast}
       initialMediaType={searchParams.get('type') === 'tv' ? 'tv' : searchParams.get('type') === 'movie' ? 'movie' : undefined}
       initialSubTab={searchParams.get('source') === 'arr' ? 'arr' : 'scan'}
      />
     )}

     {/* API Keys Tab */}
     {activeTab === 'api' && (
      <div className="p-6 space-y-6">
       <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">API Keys</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
         Configure API keys for media metadata services
        </p>
       </div>

       {/* API Keys Table */}
       <div className="border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
        <div className="table-responsive">
        <table className="w-full">
         <thead>
          <tr className="border-b" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
           <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Service</th>
           <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>API Key</th>
           <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
           <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Actions</th>
          </tr>
         </thead>
         <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
          {/* TMDB Row */}
          <tr style={{ backgroundColor: 'var(--card-bg)' }}>
           <td className="px-4 py-4">
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>TMDB</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Movies & TV Search</p>
           </td>
           <td className="px-4 py-4">
            <div className="max-w-sm">
             {tmdbKeyConfigured && !tmdbEditing ? (
              <div className="flex items-center gap-2">
               <span className="font-mono text-sm px-3 py-2 border flex-1" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                ••••••••••••••••
               </span>
               <button
                onClick={() => {
                 setTmdbEditing(true);
                 setTmdbApiKey('');
                 setTmdbTestResult(null);
                }}
                className="px-3 py-2 text-sm border hover:bg-gray-100 dark:hover:bg-gray-700"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
               >
                Change
               </button>
              </div>
             ) : (
              <Input 
               type="password" 
               value={tmdbApiKey} 
               onChange={(e) => {
                setTmdbApiKey(e.target.value);
                setTmdbTestResult(null);
               }} 
               placeholder="Enter TMDB API key" 
               className="dark:bg-gray-800/50 font-mono text-sm" 
               autoComplete="off"
              />
             )}
             <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 dark:text-sky-400 hover:underline mt-1 inline-block">
              Get API key →
             </a>
            </div>
           </td>
           <td className="px-4 py-4">
            {tmdbTestResult ? (
             <span className={`px-2.5 py-1 text-xs font-medium ${
              tmdbTestResult.valid 
               ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
               : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
             }`}>
              {tmdbTestResult.valid ? 'Connected' : 'Failed'}
             </span>
            ) : (
             <span className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-700" style={{ color: 'var(--text-muted)' }}>
              Not tested
             </span>
            )}
           </td>
           <td className="px-4 py-4 text-right">
            <Button 
             onClick={handleSaveTmdb} 
             disabled={testingTmdb || !tmdbApiKey.trim()}
             size="sm"
            >
             {testingTmdb ? 'Testing...' : 'Test & Save'}
            </Button>
           </td>
          </tr>

          {/* TVDB Row */}
          <tr style={{ backgroundColor: 'var(--card-bg)' }}>
           <td className="px-4 py-4">
            <div className="flex items-center gap-2">
             <p className="font-medium" style={{ color: 'var(--text-primary)' }}>TVDB</p>
             <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700" style={{ color: 'var(--text-muted)' }}>Optional</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Episode data for series</p>
           </td>
           <td className="px-4 py-4">
            <div className="max-w-sm">
             {tvdbKeyConfigured && !tvdbEditing ? (
              <div className="flex items-center gap-2">
               <span className="font-mono text-sm px-3 py-2 border flex-1" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                ••••••••••••••••
               </span>
               <button
                onClick={() => {
                 setTvdbEditing(true);
                 setTvdbApiKey('');
                 setTvdbTestResult(null);
                }}
                className="px-3 py-2 text-sm border hover:bg-gray-100 dark:hover:bg-gray-700"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
               >
                Change
               </button>
              </div>
             ) : (
              <Input 
               type="password" 
               value={tvdbApiKey} 
               onChange={(e) => {
                setTvdbApiKey(e.target.value);
                setTvdbTestResult(null);
               }} 
               placeholder="Enter TVDB API key" 
               className="dark:bg-gray-800/50 font-mono text-sm" 
               autoComplete="off"
              />
             )}
             <a href="https://thetvdb.com/api-information" target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-1 inline-block">
              Get API key →
             </a>
            </div>
           </td>
           <td className="px-4 py-4">
            {tvdbTestResult ? (
             <span className={`px-2.5 py-1 text-xs font-medium ${
              tvdbTestResult.valid 
               ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
               : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
             }`}>
              {tvdbTestResult.valid ? 'Connected' : 'Failed'}
             </span>
            ) : (
             <span className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-700" style={{ color: 'var(--text-muted)' }}>
              Not tested
             </span>
            )}
           </td>
           <td className="px-4 py-4 text-right">
            <Button 
             onClick={handleSaveTvdb} 
             disabled={testingTvdb || !tvdbApiKey.trim()}
             size="sm"
            >
             {testingTvdb ? 'Testing...' : 'Test & Save'}
            </Button>
           </td>
          </tr>

          {/* OMDB Row */}
          <tr style={{ backgroundColor: 'var(--card-bg)' }}>
           <td className="px-4 py-4">
            <div className="flex items-center gap-2">
             <p className="font-medium" style={{ color: 'var(--text-primary)' }}>OMDB</p>
             <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700" style={{ color: 'var(--text-muted)' }}>Optional</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>IMDB ratings for movies</p>
           </td>
           <td className="px-4 py-4">
            <div className="max-w-sm">
             {omdbKeyConfigured && !omdbEditing ? (
              <div className="flex items-center gap-2">
               <span className="font-mono text-sm px-3 py-2 border flex-1" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                ••••••••••••••••
               </span>
               <button
                onClick={() => {
                 setOmdbEditing(true);
                 setOmdbApiKey('');
                 setOmdbTestResult(null);
                }}
                className="px-3 py-2 text-sm border hover:bg-gray-100 dark:hover:bg-gray-700"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
               >
                Change
               </button>
              </div>
             ) : (
              <Input 
               type="password" 
               value={omdbApiKey} 
               onChange={(e) => {
                setOmdbApiKey(e.target.value);
                setOmdbTestResult(null);
               }} 
               placeholder="Enter OMDB API key" 
               className="dark:bg-gray-800/50 font-mono text-sm" 
               autoComplete="off"
              />
             )}
             <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noopener noreferrer" className="text-xs text-yellow-600 dark:text-yellow-400 hover:underline mt-1 inline-block">
              Get API key (free tier: 1000/day) →
             </a>
            </div>
           </td>
           <td className="px-4 py-4">
            {omdbTestResult ? (
             <span className={`px-2.5 py-1 text-xs font-medium ${
              omdbTestResult.valid 
               ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
               : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
             }`}>
              {omdbTestResult.valid ? 'Connected' : 'Failed'}
             </span>
            ) : (
             <span className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-700" style={{ color: 'var(--text-muted)' }}>
              Not tested
             </span>
            )}
           </td>
           <td className="px-4 py-4 text-right">
            <Button 
             onClick={handleSaveOmdb} 
             disabled={testingOmdb || !omdbApiKey.trim()}
             size="sm"
            >
             {testingOmdb ? 'Testing...' : 'Test & Save'}
            </Button>
           </td>
          </tr>
         </tbody>
        </table></div>
       </div>

       {/* Concurrent Requests Setting */}
       <div className="border p-4" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between">
         <div>
          <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Concurrent API Requests</h4>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
           Higher values speed up matching and refreshing but may hit API rate limits
          </p>
         </div>
         <div className="flex items-center gap-4">
          <input
           type="range"
           min="1"
           max="20"
           value={concurrentRequests}
           onChange={(e) => setConcurrentRequests(parseInt(e.target.value))}
           onMouseUp={(e) => handleSaveConcurrentRequests(parseInt((e.target as HTMLInputElement).value))}
           onTouchEnd={(e) => handleSaveConcurrentRequests(parseInt((e.target as HTMLInputElement).value))}
           className="w-32"
          />
          <span className="text-lg font-bold w-8 text-center" style={{ color: 'var(--text-primary)' }}>
           {concurrentRequests}
          </span>
         </div>
        </div>
       </div>

       {/* Info Box */}
       <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Note</p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
         TMDB is required for all media lookups. TVDB is optional and provides additional episode metadata for TV series.
        </p>
       </div>
      </div>
     )}

     {/* UI Settings Tab */}
     {activeTab === 'ui' && (
      <div className="p-6 space-y-6">
       <div>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>UI Settings</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Customize your interface appearance and behavior</p>
       </div>
       
       {/* Appearance Section */}
       <div className="border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-bg)' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
         <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Appearance</h3>
        </div>
        <div className="p-4 space-y-6">
         {/* Theme Selector */}
         <div>
          <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Theme</label>
          <div className="flex gap-3">
           {[
            { id: 'dark', label: 'Dark', icon: (
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
             </svg>
            )},
            { id: 'light', label: 'Light', icon: (
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
             </svg>
            )},
            { id: 'system', label: 'System', icon: (
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
             </svg>
            )},
           ].map((theme) => (
            <button
             key={theme.id}
             onClick={() => updateUISettings({ theme: theme.id as 'dark' | 'light' | 'system' })}
             className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all min-w-[80px]"
             style={{
              borderColor: uiSettings.theme === theme.id ? 'var(--navbar-bg)' : 'var(--border-color)',
              backgroundColor: uiSettings.theme === theme.id ? 'var(--hover-bg)' : 'transparent',
              color: uiSettings.theme === theme.id ? 'var(--text-primary)' : 'var(--text-secondary)',
             }}
            >
             {theme.icon}
             <span className="text-xs font-medium">{theme.label}</span>
            </button>
           ))}
          </div>
         </div>
         
         {/* Accent Color */}
         <div>
          <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Accent Color</label>
          <div className="flex gap-3 flex-wrap">
           {accentColors.map((accent) => (
            <button
             key={accent.id}
             onClick={() => updateUISettings({ accentColor: accent.id })}
             className="w-8 h-8 rounded-full transition-all"
             style={{
              backgroundColor: accent.color,
              boxShadow: uiSettings.accentColor === accent.id ? '0 0 0 3px var(--card-bg), 0 0 0 5px ' + accent.color : 'none',
             }}
             title={accent.name}
            />
           ))}
          </div>
         </div>
        </div>
       </div>

       {/* General Section */}
       <div className="border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-bg)' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
         <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>General</h3>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
         {/* Timezone */}
         <div className="p-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-8">
          <div className="md:w-48 flex-shrink-0">
           <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Timezone</label>
           <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>For dates and times display</p>
          </div>
          <select
           value={timezone}
           onChange={async (e) => {
            const newTz = e.target.value;
            setTimezone(newTz);
            try {
             await api.updateSetting('timezone', newTz);
             addToast({ type: 'success', message: 'Timezone updated' });
            } catch (error) {
             addToast({ type: 'error', message: 'Failed to save timezone' });
            }
           }}
           className="flex-1 max-w-xs px-3 py-2 text-sm border"
           style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
           <optgroup label="Australia">
            <option value="Australia/Sydney">Australia/Sydney</option>
            <option value="Australia/Melbourne">Australia/Melbourne</option>
            <option value="Australia/Brisbane">Australia/Brisbane</option>
            <option value="Australia/Perth">Australia/Perth</option>
            <option value="Australia/Adelaide">Australia/Adelaide</option>
            <option value="Australia/Darwin">Australia/Darwin</option>
            <option value="Australia/Hobart">Australia/Hobart</option>
           </optgroup>
           <optgroup label="Americas">
            <option value="America/New_York">America/New_York (Eastern)</option>
            <option value="America/Chicago">America/Chicago (Central)</option>
            <option value="America/Denver">America/Denver (Mountain)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
            <option value="America/Toronto">America/Toronto</option>
            <option value="America/Vancouver">America/Vancouver</option>
            <option value="America/Sao_Paulo">America/Sao_Paulo</option>
            <option value="America/Mexico_City">America/Mexico_City</option>
           </optgroup>
           <optgroup label="Europe">
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Paris">Europe/Paris</option>
            <option value="Europe/Berlin">Europe/Berlin</option>
            <option value="Europe/Rome">Europe/Rome</option>
            <option value="Europe/Madrid">Europe/Madrid</option>
            <option value="Europe/Amsterdam">Europe/Amsterdam</option>
            <option value="Europe/Stockholm">Europe/Stockholm</option>
            <option value="Europe/Moscow">Europe/Moscow</option>
           </optgroup>
           <optgroup label="Asia">
            <option value="Asia/Tokyo">Asia/Tokyo</option>
            <option value="Asia/Seoul">Asia/Seoul</option>
            <option value="Asia/Shanghai">Asia/Shanghai</option>
            <option value="Asia/Hong_Kong">Asia/Hong_Kong</option>
            <option value="Asia/Singapore">Asia/Singapore</option>
            <option value="Asia/Bangkok">Asia/Bangkok</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
           </optgroup>
           <optgroup label="Pacific">
            <option value="Pacific/Auckland">Pacific/Auckland</option>
            <option value="Pacific/Fiji">Pacific/Fiji</option>
            <option value="Pacific/Honolulu">Pacific/Honolulu</option>
           </optgroup>
           <optgroup label="Other">
            <option value="UTC">UTC</option>
           </optgroup>
          </select>
         </div>

         {/* Poster Size */}
         <div className="p-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-8">
          <div className="md:w-48 flex-shrink-0">
           <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Poster Size</label>
           <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Size on library pages</p>
          </div>
          <div>
           <PosterSizeSelector 
            value={uiSettings.posterSize} 
            onChange={(size) => updateUISettings({ posterSize: size })} 
           />
          </div>
         </div>
        </div>
       </div>

       {/* Dashboard Widgets Section */}
       <div className="border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-bg)' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
         <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dashboard Widgets</h3>
         <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Toggle widgets shown on the Dashboard</p>
        </div>
        <div className="p-4 space-y-4">
         {/* Language Filter */}
         <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
           Widget Languages
          </label>
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
           Filter discover widgets to show only content in these languages
          </p>
          <div className="flex flex-wrap gap-2">
           {[
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Spanish' },
            { code: 'fr', name: 'French' },
            { code: 'de', name: 'German' },
            { code: 'it', name: 'Italian' },
            { code: 'pt', name: 'Portuguese' },
            { code: 'ja', name: 'Japanese' },
            { code: 'ko', name: 'Korean' },
            { code: 'zh', name: 'Chinese' },
            { code: 'hi', name: 'Hindi' },
            { code: 'ru', name: 'Russian' },
            { code: 'ar', name: 'Arabic' },
           ].map((lang) => {
            const isSelected = (uiSettings.dashboardLanguages || ['en']).includes(lang.code);
            return (
             <button
              key={lang.code}
              onClick={() => {
               const current = uiSettings.dashboardLanguages || ['en'];
               const updated = isSelected
                ? current.filter(c => c !== lang.code)
                : [...current, lang.code];
               updateUISettings({ dashboardLanguages: updated });
              }}
              className="px-3 py-1.5 text-sm rounded-full border transition-colors"
              style={{
               backgroundColor: isSelected ? 'var(--navbar-bg)' : 'transparent',
               borderColor: isSelected ? 'var(--navbar-bg)' : 'var(--border-color)',
               color: isSelected ? 'var(--navbar-text)' : 'var(--text-secondary)',
              }}
             >
              {lang.name}
             </button>
            );
           })}
          </div>
          {(uiSettings.dashboardLanguages || ['en']).length === 0 && (
           <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            No languages selected - all content will be shown
           </p>
          )}
         </div>
         
         {/* Widget Toggles */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
           { key: 'showRecentlyAdded', label: 'Recently Added', desc: 'New library items', isRoot: true },
           { key: 'trending', label: 'Trending', desc: 'Trending this week' },
           { key: 'popularMovies', label: 'Popular Movies', desc: 'Currently popular' },
           { key: 'upcomingMovies', label: 'Upcoming Movies', desc: 'Coming soon' },
           { key: 'movieGenres', label: 'Movie Genres', desc: 'Browse by genre' },
           { key: 'popularSeries', label: 'Popular Series', desc: 'Currently popular' },
           { key: 'upcomingSeries', label: 'On The Air', desc: 'Currently airing' },
           { key: 'seriesGenres', label: 'TV Genres', desc: 'Browse by genre' },
          ].map((widget) => {
           const isChecked = widget.isRoot 
            ? uiSettings.showRecentlyAdded 
            : (uiSettings.dashboardWidgets?.[widget.key as keyof typeof uiSettings.dashboardWidgets] ?? true);
           return (
            <label 
             key={widget.key}
             className="flex items-start gap-2 p-2 cursor-pointer border transition-colors"
             style={{ 
              borderColor: isChecked ? 'var(--primary-color)' : 'var(--border-color)',
              backgroundColor: isChecked ? 'var(--primary-color-alpha)' : 'transparent'
             }}
            >
             <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
               if (widget.isRoot) {
                updateUISettings({ showRecentlyAdded: e.target.checked });
               } else {
                const defaultWidgets = { trending: true, popularMovies: true, movieGenres: true, upcomingMovies: true, popularSeries: true, seriesGenres: true, upcomingSeries: true };
                const current = uiSettings.dashboardWidgets || defaultWidgets;
                updateUISettings({ 
                 dashboardWidgets: { ...current, [widget.key]: e.target.checked } 
                });
               }
              }}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
             />
             <div className="min-w-0">
              <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>{widget.label}</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{widget.desc}</span>
             </div>
            </label>
           );
          })}
         </div>
        </div>
       </div>

       {/* Detail Pages Section */}
       <div className="border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-bg)' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
         <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Detail Pages</h3>
         <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Configure movie and TV show detail page options</p>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
         <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-opacity-50" style={{ backgroundColor: 'transparent' }}>
          <div>
           <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Show Cast</span>
           <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Display cast members section</p>
          </div>
          <input
           type="checkbox"
           checked={uiSettings.showCast ?? true}
           onChange={(e) => updateUISettings({ showCast: e.target.checked })}
           className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
          />
         </label>
         <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-opacity-50" style={{ backgroundColor: 'transparent' }}>
          <div>
           <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Show Recommended</span>
           <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Display similar/recommended content on discover pages</p>
          </div>
          <input
           type="checkbox"
           checked={uiSettings.showSimilar ?? true}
           onChange={(e) => updateUISettings({ showSimilar: e.target.checked })}
           className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
          />
         </label>
        </div>
       </div>

       {/* Notifications Section */}
       <div className="border" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-bg)' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--hover-bg)' }}>
         <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
         <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Configure toast notification duration by type</p>
        </div>
        <div className="p-4">
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
           <label className="block text-xs mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-2 h-2 bg-green-500 rounded-full"></span> Success
           </label>
           <select 
            value={toastSettings.successDuration < 0 ? -1 : toastSettings.successDuration / 1000} 
            onChange={(e) => updateToastSettings({ successDuration: Number(e.target.value) === -1 ? -1 : Number(e.target.value) * 1000 })} 
            className="w-full px-2 py-1.5 text-sm border"
            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
           >
            <option value={-1}>Disabled</option>
            <option value={3}>3 sec</option>
            <option value={5}>5 sec</option>
            <option value={8}>8 sec</option>
            <option value={10}>10 sec</option>
           </select>
          </div>
          <div>
           <label className="block text-xs mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Info
           </label>
           <select 
            value={toastSettings.infoDuration < 0 ? -1 : toastSettings.infoDuration / 1000} 
            onChange={(e) => updateToastSettings({ infoDuration: Number(e.target.value) === -1 ? -1 : Number(e.target.value) * 1000 })} 
            className="w-full px-2 py-1.5 text-sm border"
            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
           >
            <option value={-1}>Disabled</option>
            <option value={3}>3 sec</option>
            <option value={5}>5 sec</option>
            <option value={8}>8 sec</option>
            <option value={10}>10 sec</option>
           </select>
          </div>
          <div>
           <label className="block text-xs mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span> Warning
           </label>
           <select 
            value={toastSettings.warningDuration < 0 ? -1 : toastSettings.warningDuration / 1000} 
            onChange={(e) => updateToastSettings({ warningDuration: Number(e.target.value) === -1 ? -1 : Number(e.target.value) * 1000 })} 
            className="w-full px-2 py-1.5 text-sm border"
            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
           >
            <option value={-1}>Disabled</option>
            <option value={3}>3 sec</option>
            <option value={5}>5 sec</option>
            <option value={8}>8 sec</option>
            <option value={10}>10 sec</option>
           </select>
          </div>
          <div>
           <label className="block text-xs mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-2 h-2 bg-red-500 rounded-full"></span> Error
           </label>
           <select 
            value={toastSettings.errorDuration < 0 ? -1 : toastSettings.errorDuration / 1000} 
            onChange={(e) => updateToastSettings({ errorDuration: Number(e.target.value) === -1 ? -1 : Number(e.target.value) * 1000 })} 
            className="w-full px-2 py-1.5 text-sm border"
            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
           >
            <option value={-1}>Disabled</option>
            <option value={5}>5 sec</option>
            <option value={8}>8 sec</option>
            <option value={10}>10 sec</option>
            <option value={15}>15 sec</option>
           </select>
          </div>
         </div>
        </div>
       </div>
      </div>
     )}

     {/* Workers Tab */}
     {activeTab === 'jobs' && (
      <WorkersTab />
     )}

     {/* Backup Tab */}
     {activeTab === 'backup' && (
      <BackupTab addToast={addToast} />
     )}
    </div>
    </div>
   </div>
  </Layout>
 );
}
