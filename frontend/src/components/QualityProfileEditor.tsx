import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ConfirmModal } from './ConfirmModal';

interface QualityDefinition {
 id: number;
 name: string;
 title: string;
 weight: number;
 source: string | null;
 resolution: string | null;
}

interface QualityProfileItem {
 quality: string;
 allowed: boolean;
}

interface QualityProfile {
 id: string;
 name: string;
 media_type: 'movie' | 'series' | 'both';
 cutoff_quality: string;
 upgrade_allowed: boolean;
 items: QualityProfileItem[];
}

interface Props {
 profile: QualityProfile | null;
 onSave: (profile: QualityProfile) => void;
 onClose: () => void;
 isNew?: boolean;
}

export function QualityProfileEditor({ profile, onSave, onClose, isNew = false }: Props) {
 const [name, setName] = useState(profile?.name || '');
 const [mediaType, setMediaType] = useState<'movie' | 'series' | 'both'>(profile?.media_type || 'both');
 const [upgradeAllowed, setUpgradeAllowed] = useState(profile?.upgrade_allowed ?? true);
 const [cutoffQuality, setCutoffQuality] = useState(profile?.cutoff_quality || 'Bluray-1080p');
 const [items, setItems] = useState<QualityProfileItem[]>([]);
 const [definitions, setDefinitions] = useState<QualityDefinition[]>([]);
 const [saving, setSaving] = useState(false);
 const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
 const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

 useEffect(() => {
  loadDefinitions();
 }, [profile?.id]);

 const loadDefinitions = async () => {
  try {
   const defs = await api.getQualityDefinitions();
   // Sort by weight descending (highest quality first)
   const sorted = defs.sort((a: QualityDefinition, b: QualityDefinition) => b.weight - a.weight);
   setDefinitions(sorted);
   
   // If profile has existing items with order, use that order
   if (profile?.items && profile.items.length > 0) {
    // Start with profile's items in their order
    const profileItems = profile.items.map(i => ({
     quality: i.quality,
     allowed: true
    }));
    
    // Add remaining definitions that aren't in profile
    const profileQualities = new Set(profile.items.map(i => i.quality));
    const remainingItems = sorted
     .filter((d: QualityDefinition) => !profileQualities.has(d.name))
     .map((d: QualityDefinition) => ({
      quality: d.name,
      allowed: false
     }));
    
    setItems([...profileItems, ...remainingItems]);
   } else {
    // New profile - use default order from definitions
    const allItems = sorted.map((d: QualityDefinition) => ({
     quality: d.name,
     allowed: false
    }));
    setItems(allItems);
   }
  } catch (error) {
   console.error('Failed to load quality definitions:', error);
  }
 };

 const toggleQuality = (qualityName: string) => {
  setItems(prev => prev.map(item => 
   item.quality === qualityName 
    ? { ...item, allowed: !item.allowed }
    : item
  ));
 };

 const allowedQualities = items.filter(i => i.allowed).map(i => i.quality);

 // Auto-update cutoff to highest quality when allowed qualities change
 useEffect(() => {
  if (allowedQualities.length > 0) {
   // Find the highest weighted (best quality) among allowed ones
   // Items are already sorted by weight desc, so first allowed is highest
   const highestAllowed = items.find(item => item.allowed);
   if (highestAllowed && cutoffQuality !== highestAllowed.quality) {
    // Only auto-update if current cutoff isn't in allowed list
    if (!allowedQualities.includes(cutoffQuality)) {
     setCutoffQuality(highestAllowed.quality);
    }
   }
  }
 }, [allowedQualities.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

 // Drag and drop handlers
 const handleDragStart = (e: React.DragEvent, index: number) => {
  setDraggedIndex(index);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', '');
 };

 const handleDragOver = (e: React.DragEvent, index: number) => {
  e.preventDefault();
  if (draggedIndex === null || draggedIndex === index) return;
  
  // Reorder items
  const newItems = [...items];
  const draggedItem = newItems[draggedIndex];
  newItems.splice(draggedIndex, 1);
  newItems.splice(index, 0, draggedItem);
  
  setItems(newItems);
  setDraggedIndex(index);
 };

 const handleDragEnd = () => {
  setDraggedIndex(null);
 };

 const handleSave = async () => {
  if (!name.trim()) return;
  
  setSaving(true);
  try {
   const profileData = {
    name,
    media_type: mediaType,
    cutoff_quality: cutoffQuality,
    upgrade_allowed: upgradeAllowed,
    items: items.filter(i => i.allowed) // Only save allowed items in their order
   };

   let savedProfile;
   if (isNew) {
    savedProfile = await api.createQualityProfile(profileData);
   } else if (profile?.id) {
    savedProfile = await api.updateQualityProfile(profile.id, profileData);
   }
   
   if (savedProfile) {
    onSave(savedProfile);
   }
   onClose();
  } catch (error) {
   console.error('Failed to save profile:', error);
  } finally {
   setSaving(false);
  }
 };

 const handleDelete = async () => {
  if (!profile?.id) return;
  try {
   await api.deleteQualityProfile(profile.id);
   onSave(profile);
   onClose();
  } catch (error) {
   console.error('Failed to delete profile:', error);
  }
 };

 const getDefinition = (qualityName: string) => {
  return definitions.find(d => d.name === qualityName);
 };

 return (
  <>
   <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
    <div className="bg-gray-800 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
     {/* Header */}
     <div className="p-4 border-b border-gray-700 flex justify-between items-center">
      <h2 className="text-xl font-semibold text-white">
       {isNew ? 'Add Quality Profile' : 'Edit Quality Profile'}
      </h2>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-300">
       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
       </svg>
      </button>
     </div>

     {/* Content */}
     <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Name */}
      <div>
       <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
       <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        placeholder="Profile Name"
       />
      </div>

      {/* Media Type */}
      <div>
       <label className="block text-sm font-medium text-gray-300 mb-2">Media Type</label>
       <div className="flex gap-2">
        <button
         type="button"
         onClick={() => setMediaType('movie')}
         className="px-4 py-2 text-sm font-medium transition-colors"
         style={{
          backgroundColor: mediaType === 'movie' ? '#7fc8f8' : undefined,
          color: mediaType === 'movie' ? '#000' : undefined
         }}
        >
         Movies
        </button>
        <button
         type="button"
         onClick={() => setMediaType('series')}
         className="px-4 py-2 text-sm font-medium transition-colors"
         style={{
          backgroundColor: mediaType === 'series' ? '#ea9ab2' : undefined,
          color: mediaType === 'series' ? '#000' : undefined
         }}
        >
         Series
        </button>
        <button
         type="button"
         onClick={() => setMediaType('both')}
         className="px-4 py-2 text-sm font-medium transition-colors"
         style={{
          backgroundColor: mediaType === 'both' ? '#ffe45e' : undefined,
          color: mediaType === 'both' ? '#000' : undefined
         }}
        >
         Both
        </button>
       </div>
       <p className="mt-1 text-xs text-gray-500">
        Filter which media types this profile is available for
       </p>
      </div>

      {/* Upgrades Allowed */}
      <div className="flex items-center gap-3">
       <label className="flex items-center gap-2 cursor-pointer">
        <input
         type="checkbox"
         checked={upgradeAllowed}
         onChange={(e) => setUpgradeAllowed(e.target.checked)}
         className="w-4 h-4 rounded border-gray-600 text-primary-500 focus:ring-primary-500"
        />
        <span className="text-sm text-gray-300">Upgrades Allowed</span>
       </label>
       <span className="text-xs text-gray-500">If disabled qualities will not be upgraded</span>
      </div>

      {/* Upgrade Until */}
      {upgradeAllowed && (
       <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Upgrade Until</label>
        <select
         value={cutoffQuality}
         onChange={(e) => setCutoffQuality(e.target.value)}
         className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white focus:ring-2 focus:ring-primary-500"
        >
         {allowedQualities.length > 0 ? (
          allowedQualities.map(q => (
           <option key={q} value={q}>{q}</option>
          ))
         ) : (
          <option value="">Select qualities below first</option>
         )}
        </select>
        <p className="mt-1 text-xs text-gray-500">
         Once this quality is reached, no further upgrades will occur
        </p>
       </div>
      )}

      {/* Qualities - Drag and Drop */}
      <div>
       <label className="block text-sm font-medium text-gray-300 mb-2">
        Qualities <span className="text-xs text-gray-500">(drag to reorder priority)</span>
       </label>
       <div className="bg-gray-900 border border-gray-700 max-h-80 overflow-y-auto">
        {items.map((item, index) => {
         const def = getDefinition(item.quality);
         if (!def) return null;
         
         return (
          <div
           key={item.quality}
           draggable
           onDragStart={(e) => handleDragStart(e, index)}
           onDragOver={(e) => handleDragOver(e, index)}
           onDragEnd={handleDragEnd}
           className={`flex items-center justify-between px-3 py-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-800 transition-colors cursor-move ${
            draggedIndex === index ? 'bg-gray-700 opacity-50' : ''
           }`}
          >
           <div className="flex items-center gap-3 flex-1">
            {/* Drag Handle */}
            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
            
            {/* Checkbox */}
            <input
             type="checkbox"
             checked={item.allowed}
             onChange={() => toggleQuality(item.quality)}
             onClick={(e) => e.stopPropagation()}
             className="w-4 h-4 rounded border-gray-600 text-primary-500 focus:ring-primary-500"
            />
            
            {/* Label */}
            <span className={`${item.allowed ? 'text-white' : 'text-gray-500'}`}>
             {def.title}
            </span>
            
            {/* WEB variants */}
            {def.name.includes('WEB') && (
             <span className="flex gap-1">
              <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">WEBRip-{def.resolution}</span>
              <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">WEBDL-{def.resolution}</span>
             </span>
            )}
           </div>
           
           {/* Priority indicator */}
           {item.allowed && (
            <span className="text-xs text-gray-500">#{allowedQualities.indexOf(item.quality) + 1}</span>
           )}
          </div>
         );
        })}
       </div>
       <p className="mt-2 text-xs text-gray-500">
        Higher items have higher priority. Drag to change the order. Items at the top will be preferred.
       </p>
      </div>
     </div>

     {/* Footer */}
     <div className="p-4 border-t border-gray-700 flex justify-between">
      <div>
       {!isNew && profile && (
        <button
         onClick={() => setShowDeleteConfirm(true)}
         className="px-4 py-2 text-red-500 hover:text-red-400 transition-colors"
        >
         Delete
        </button>
       )}
      </div>
      <div className="flex gap-3">
       <button
        onClick={onClose}
        className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
       >
        Cancel
       </button>
       <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
       >
        {saving ? 'Saving...' : 'Save'}
       </button>
      </div>
     </div>
    </div>
   </div>

   {/* Delete Confirmation Modal */}
   <ConfirmModal
    isOpen={showDeleteConfirm}
    title="Delete Quality Profile"
    message={`Are you sure you want to delete "${profile?.name}"? This action cannot be undone.`}
    confirmText="Delete"
    onConfirm={handleDelete}
    onCancel={() => setShowDeleteConfirm(false)}
   />
  </>
 );
}
