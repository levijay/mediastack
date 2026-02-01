import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface QualityProfile {
 id: string;
 name: string;
 media_type?: string;
}

interface Props {
 seriesIds: string[];
 onClose: () => void;
 onSave: () => void;
}

export function BulkEditSeriesModal({ seriesIds, onClose, onSave }: Props) {
 const [monitored, setMonitored] = useState<boolean | null>(null);
 const [qualityProfileId, setQualityProfileId] = useState<string>('');
 const [monitorNewSeasons, setMonitorNewSeasons] = useState<boolean | null>(null);
 const [profiles, setProfiles] = useState<QualityProfile[]>([]);
 const [saving, setSaving] = useState(false);

 useEffect(() => {
  loadProfiles();
 }, []);

 const loadProfiles = async () => {
  try {
   const data = await api.getQualityProfiles();
   // Filter profiles for series (media_type = 'series' or 'both')
   const filteredProfiles = data.filter((p: QualityProfile) => 
    !p.media_type || p.media_type === 'both' || p.media_type === 'series'
   );
   setProfiles(filteredProfiles);
  } catch (error) {
   console.error('Failed to load profiles:', error);
  }
 };

 const handleSave = async () => {
  setSaving(true);
  try {
   // Build update object with only changed fields
   const updates: any = {};
   if (monitored !== null) updates.monitored = monitored;
   if (qualityProfileId) updates.quality_profile_id = qualityProfileId;
   if (monitorNewSeasons !== null) updates.monitor_new_seasons = monitorNewSeasons;

   // Only proceed if there are changes
   if (Object.keys(updates).length === 0) {
    onClose();
    return;
   }

   // Update all selected series
   await Promise.all(
    seriesIds.map(id => api.updateSeries(id, updates))
   );
   
   onSave();
   onClose();
  } catch (error) {
   console.error('Failed to bulk update series:', error);
  } finally {
   setSaving(false);
  }
 };

 return (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
   <div className="bg-white dark:bg-gray-800 shadow-xl w-full max-w-lg mx-4">
    {/* Header */}
    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
     <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
      Edit {seriesIds.length} Series
     </h2>
     <button
      onClick={onClose}
      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
     >
      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    {/* Content */}
    <div className="p-4 space-y-4">
     <p className="text-sm text-gray-500 dark:text-gray-400">
      Only changed fields will be applied to all selected series.
     </p>

     {/* Monitored */}
     <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
       Monitored
      </label>
      <div className="flex gap-4">
       <label className="flex items-center gap-2 cursor-pointer">
        <input
         type="radio"
         name="monitored"
         checked={monitored === null}
         onChange={() => setMonitored(null)}
         className="w-4 h-4 text-primary-600"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">No Change</span>
       </label>
       <label className="flex items-center gap-2 cursor-pointer">
        <input
         type="radio"
         name="monitored"
         checked={monitored === true}
         onChange={() => setMonitored(true)}
         className="w-4 h-4 text-primary-600"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
       </label>
       <label className="flex items-center gap-2 cursor-pointer">
        <input
         type="radio"
         name="monitored"
         checked={monitored === false}
         onChange={() => setMonitored(false)}
         className="w-4 h-4 text-primary-600"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">No</span>
       </label>
      </div>
     </div>

     {/* Quality Profile */}
     <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
       Quality Profile
      </label>
      <select
       value={qualityProfileId}
       onChange={(e) => setQualityProfileId(e.target.value)}
       className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
      >
       <option value="">-- No Change --</option>
       {profiles.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
       ))}
      </select>
     </div>

     {/* Monitor New Seasons */}
     <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
       Monitor New Seasons
      </label>
      <div className="flex gap-4">
       <label className="flex items-center gap-2 cursor-pointer">
        <input
         type="radio"
         name="monitorNewSeasons"
         checked={monitorNewSeasons === null}
         onChange={() => setMonitorNewSeasons(null)}
         className="w-4 h-4 text-primary-600"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">No Change</span>
       </label>
       <label className="flex items-center gap-2 cursor-pointer">
        <input
         type="radio"
         name="monitorNewSeasons"
         checked={monitorNewSeasons === true}
         onChange={() => setMonitorNewSeasons(true)}
         className="w-4 h-4 text-primary-600"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">Yes</span>
       </label>
       <label className="flex items-center gap-2 cursor-pointer">
        <input
         type="radio"
         name="monitorNewSeasons"
         checked={monitorNewSeasons === false}
         onChange={() => setMonitorNewSeasons(false)}
         className="w-4 h-4 text-primary-600"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">No</span>
       </label>
      </div>
     </div>
    </div>

    {/* Footer */}
    <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
     <button
      onClick={onClose}
      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 "
     >
      Cancel
     </button>
     <button
      onClick={handleSave}
      disabled={saving}
      className="px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
     >
      {saving ? 'Saving...' : 'Apply Changes'}
     </button>
    </div>
   </div>
  </div>
 );
}
