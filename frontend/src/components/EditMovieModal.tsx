import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { FolderBrowser } from './FolderBrowser';

interface Movie {
 id: string;
 title: string;
 year: number;
 monitored: boolean;
 folder_path?: string;
 quality_profile_id?: string;
 minimum_availability?: string;
 tags?: string[];
}

interface QualityProfile {
 id: string;
 name: string;
 media_type?: 'movie' | 'series' | 'both';
}

interface Props {
 movie: Movie;
 onClose: () => void;
 onSave: () => void;
 onDelete: () => void;
}

const MINIMUM_AVAILABILITY_OPTIONS = [
 { value: 'announced', label: 'Announced' },
 { value: 'inCinemas', label: 'In Cinemas' },
 { value: 'released', label: 'Released' },
];

export function EditMovieModal({ movie, onClose, onSave, onDelete }: Props) {
 const [formData, setFormData] = useState({
  monitored: movie.monitored,
  minimum_availability: movie.minimum_availability || 'announced',
  quality_profile_id: movie.quality_profile_id || '',
  folder_path: movie.folder_path || ''
 });
 const [profiles, setProfiles] = useState<QualityProfile[]>([]);
 const [showFolderBrowser, setShowFolderBrowser] = useState(false);
 const [saving, setSaving] = useState(false);

 useEffect(() => {
  loadProfiles();
 }, []);

 // Reset form data when movie prop changes
 useEffect(() => {
  setFormData({
   monitored: movie.monitored,
   minimum_availability: movie.minimum_availability || 'announced',
   quality_profile_id: movie.quality_profile_id || '',
   folder_path: movie.folder_path || ''
  });
 }, [movie]);

 const loadProfiles = async () => {
  try {
   const data = await api.getQualityProfiles();
   // Filter profiles for movies (media_type = 'movie' or 'both')
   const filteredProfiles = data.filter((p: QualityProfile) => 
    !p.media_type || p.media_type === 'both' || p.media_type === 'movie'
   );
   setProfiles(filteredProfiles);
  } catch (error) {
   console.error('Failed to load profiles:', error);
  }
 };

 const handleSave = async () => {
  setSaving(true);
  try {
   const updateData = {
    monitored: formData.monitored,
    minimum_availability: formData.minimum_availability,
    quality_profile_id: formData.quality_profile_id || undefined,
    folder_path: formData.folder_path || undefined
   };
   
   await api.updateMovie(movie.id, updateData);
   
   // Always trigger a scan after saving to refresh file info
   try {
    console.log('Triggering scan for movie:', movie.id);
    await api.scanMovie(movie.id);
   } catch (scanError) {
    console.error('Scan after save failed:', scanError);
   }
   
   onSave();
  } catch (error) {
   console.error('Failed to save movie:', error);
   alert('Failed to save changes');
  } finally {
   setSaving(false);
  }
 };

 const handleDelete = () => {
  if (confirm('Are you sure you want to delete this movie?')) {
   onDelete();
  }
 };

 return (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
   <div className="bg-white dark:bg-gray-800 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
    {/* Header */}
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
     <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
      Edit - {movie.title}
     </h2>
     <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
     {/* Monitored */}
     <div className="flex items-center gap-4">
      <label className="w-48 text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
       Monitored
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
       <input
        type="checkbox"
        checked={formData.monitored}
        onChange={(e) => setFormData({ ...formData, monitored: e.target.checked })}
        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
       />
       <span className="text-sm text-gray-600 dark:text-gray-400">
        Download movie if available
       </span>
      </label>
     </div>

     {/* Minimum Availability */}
     <div className="flex items-center gap-4">
      <label className="w-48 text-sm font-medium text-gray-700 dark:text-gray-300 text-right flex items-center justify-end gap-1">
       Minimum Availability
       <span className="text-gray-400 cursor-help" title="When should the movie be available for download">ⓘ</span>
      </label>
      <select
       value={formData.minimum_availability}
       onChange={(e) => setFormData({ ...formData, minimum_availability: e.target.value })}
       className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
      >
       {MINIMUM_AVAILABILITY_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
       ))}
      </select>
     </div>

     {/* Quality Profile */}
     <div className="flex items-center gap-4">
      <label className="w-48 text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
       Quality Profile
      </label>
      <select
       value={formData.quality_profile_id}
       onChange={(e) => setFormData({ ...formData, quality_profile_id: e.target.value })}
       className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
      >
       <option value="">Select a profile...</option>
       {profiles.map(profile => (
        <option key={profile.id} value={profile.id}>{profile.name}</option>
       ))}
      </select>
     </div>

     {/* Path */}
     <div className="flex items-center gap-4">
      <label className="w-48 text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
       Path
      </label>
      <div className="flex-1 flex gap-2">
       <input
        type="text"
        value={formData.folder_path}
        onChange={(e) => setFormData({ ...formData, folder_path: e.target.value })}
        placeholder="/data/media/movies/Movie Name (Year)"
        className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
       />
       <button
        onClick={() => setShowFolderBrowser(true)}
        className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white "
        title="Browse folders"
       >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
       </button>
       <button
        onClick={() => {
         // Open folder in new tab (would need backend support)
         alert('Would open folder in file manager');
        }}
        className="px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 "
        title="Open folder"
       >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
       </button>
      </div>
     </div>
    </div>

    {/* Footer */}
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
     <button
      onClick={handleDelete}
      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium"
     >
      Delete
     </button>
     <div className="flex gap-2">
      <button
       onClick={onClose}
       className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium"
      >
       Cancel
      </button>
      <button
       onClick={handleSave}
       disabled={saving}
       className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium disabled:opacity-50"
      >
       {saving ? 'Saving...' : 'Save'}
      </button>
     </div>
    </div>
   </div>

   {/* Folder Browser Modal */}
   {showFolderBrowser && (
    <FolderBrowser
     currentPath={formData.folder_path || '/data/media/movies'}
     onSelect={(path) => {
      setFormData({ ...formData, folder_path: path });
      setShowFolderBrowser(false);
     }}
     onClose={() => setShowFolderBrowser(false)}
    />
   )}
  </div>
 );
}
