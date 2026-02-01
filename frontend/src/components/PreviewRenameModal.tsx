import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Button } from './common/Button';

interface RenamePreview {
 id: string;
 seasonNumber?: number;
 episodeNumber?: number;
 currentPath: string;
 currentFilename: string;
 newPath: string;
 newFilename: string;
 selected: boolean;
}

interface Props {
 type: 'movie' | 'series';
 id: string;
 title: string;
 onClose: () => void;
 onComplete: () => void;
}

export function PreviewRenameModal({ type, id, title: _title, onClose, onComplete }: Props) {
 const [loading, setLoading] = useState(true);
 const [executing, setExecuting] = useState(false);
 const [previews, setPreviews] = useState<RenamePreview[]>([]);
 const [namingPattern, setNamingPattern] = useState('');
 const [folderPath, setFolderPath] = useState('');
 const [tvdbId, setTvdbId] = useState<number | null>(null);
 const [selectAll, setSelectAll] = useState(true);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
  loadPreview();
 }, [id, type]);

 const loadPreview = async () => {
  try {
   setLoading(true);
   setError(null);
   
   const data = type === 'movie' 
    ? await api.previewMovieRename(id)
    : await api.previewSeriesRename(id);
   
   setPreviews(data.previews || []);
   setNamingPattern(data.namingPattern || '');
   setFolderPath(type === 'movie' ? data.movie?.folderPath : data.series?.folderPath);
   setTvdbId(type === 'series' ? data.series?.tvdbId : null);
  } catch (err: any) {
   setError(err.response?.data?.error || 'Failed to generate rename preview');
  } finally {
   setLoading(false);
  }
 };

 const toggleItem = (id: string) => {
  setPreviews(prev => prev.map(p => 
   p.id === id ? { ...p, selected: !p.selected } : p
  ));
 };

 const toggleAll = () => {
  const newValue = !selectAll;
  setSelectAll(newValue);
  setPreviews(prev => prev.map(p => ({ ...p, selected: newValue })));
 };

 const handleOrganize = async () => {
  const selectedFiles = previews.filter(p => p.selected);
  if (selectedFiles.length === 0) return;

  setExecuting(true);
  try {
   const files = selectedFiles.map(p => ({ id: p.id, newPath: p.newPath }));
   
   if (type === 'movie') {
    await api.executeMovieRename(id, files);
   } else {
    await api.executeSeriesRename(id, files);
   }
   
   onComplete();
   onClose();
  } catch (err: any) {
   setError(err.response?.data?.error || 'Failed to rename files');
  } finally {
   setExecuting(false);
  }
 };

 const selectedCount = previews.filter(p => p.selected).length;

 return (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
   <div className="bg-white dark:bg-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
    {/* Header */}
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
     <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Rename</h2>
     <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    {/* Info Banner */}
    <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 px-4 py-3">
     <p className="text-sm text-blue-800 dark:text-blue-300">
      All paths are relative to: <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">{folderPath}</code>
      {tvdbId && <span> {`{tvdb-${tvdbId}}`}</span>}
     </p>
     <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-mono">
      Naming pattern: {namingPattern}
     </p>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto p-4">
     {loading ? (
      <div className="flex items-center justify-center py-12">
       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
     ) : error ? (
      <div className="text-center py-12 text-red-500">{error}</div>
     ) : previews.length === 0 ? (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
       <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
       </svg>
       <p>All files are already named correctly</p>
      </div>
     ) : (
      <div className="space-y-2">
       {previews.map((preview) => (
        <div 
         key={preview.id}
         className={`border p-3 transition-colors ${
          preview.selected 
           ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/10' 
           : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'
         }`}
        >
         <div className="flex items-start gap-3">
          <label className="flex items-center mt-1">
           <input
            type="checkbox"
            checked={preview.selected}
            onChange={() => toggleItem(preview.id)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
           />
          </label>
          <div className="flex-1 min-w-0 space-y-1">
           {/* Current filename - with minus sign */}
           <div className="flex items-start gap-2">
            <span className="text-red-500 font-mono">−</span>
            <span className="text-sm text-gray-700 dark:text-gray-300 break-all font-mono">
             {preview.currentFilename}
            </span>
           </div>
           {/* New filename - with plus sign */}
           <div className="flex items-start gap-2">
            <span className="text-green-500 font-mono">+</span>
            <span className="text-sm text-gray-600 dark:text-gray-400 break-all font-mono">
             {type === 'series' && preview.seasonNumber !== undefined 
              ? `Season ${String(preview.seasonNumber).padStart(2, '0')}/${preview.newFilename}`
              : preview.newFilename
             }
            </span>
           </div>
          </div>
         </div>
        </div>
       ))}
      </div>
     )}
    </div>

    {/* Footer */}
    <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
     <label className="flex items-center gap-2">
      <input
       type="checkbox"
       checked={selectAll}
       onChange={toggleAll}
       className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
      />
      <span className="text-sm text-gray-600 dark:text-gray-400">
       Select All ({selectedCount} / {previews.length})
      </span>
     </label>
     <div className="flex gap-3">
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button 
       onClick={handleOrganize}
       disabled={executing || selectedCount === 0}
      >
       {executing ? 'Renaming...' : 'Rename'}
      </Button>
     </div>
    </div>
   </div>
  </div>
 );
}
