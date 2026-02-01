import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface FolderBrowserProps {
 currentPath: string;
 onSelect: (path: string) => void;
 onClose: () => void;
}

interface Folder {
 name: string;
 path: string;
 type: string;
}

export function FolderBrowser({ currentPath, onSelect, onClose }: FolderBrowserProps) {
 const [browsePath, setBrowsePath] = useState(currentPath || '/');
 const [folders, setFolders] = useState<Folder[]>([]);
 const [parentPath, setParentPath] = useState<string | null>(null);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
  loadFolders(browsePath);
 }, [browsePath]);

 const loadFolders = async (path: string) => {
  setLoading(true);
  setError(null);
  try {
   const data = await api.browseFolders(path);
   setFolders(data.folders || []);
   setParentPath(data.parentPath);
   setBrowsePath(data.currentPath);
  } catch (err: any) {
   setError(err.response?.data?.error || 'Failed to load folders');
   setFolders([]);
  } finally {
   setLoading(false);
  }
 };

 const navigateTo = (path: string) => {
  setBrowsePath(path);
 };

 const handleSelect = () => {
  onSelect(browsePath);
  onClose();
 };

 return (
  <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'var(--modal-overlay)' }}>
   <div 
    className="w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col"
    style={{ backgroundColor: 'var(--card-bg)' }}
   >
    {/* Header */}
    <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
     <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Select Folder</h3>
     <button 
      onClick={onClose} 
      className="p-1 rounded transition-colors"
      style={{ color: 'var(--text-muted)' }}
      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
     >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    {/* Current Path */}
    <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--page-bg)' }}>
     <p className="text-sm font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{browsePath}</p>
    </div>

    {/* Folder List */}
    <div className="flex-1 overflow-y-auto p-2 min-h-[300px]" style={{ backgroundColor: 'var(--card-bg)' }}>
     {loading ? (
      <div className="flex items-center justify-center h-32">
       <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--navbar-bg)' }}></div>
      </div>
     ) : error ? (
      <div className="text-center py-8">
       <p className="text-red-400 text-sm">{error}</p>
       <button 
        onClick={() => loadFolders('/')} 
        className="mt-2 text-sm underline"
        style={{ color: 'var(--navbar-bg)' }}
       >
        Go to root
       </button>
      </div>
     ) : (
      <div className="space-y-1">
       {/* Parent folder */}
       {parentPath && (
        <button
         onClick={() => navigateTo(parentPath)}
         className="w-full flex items-center gap-3 px-3 py-2 transition-colors"
         style={{ color: 'var(--text-primary)' }}
         onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--row-hover-bg)'}
         onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
         <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
         </svg>
         <span>..</span>
        </button>
       )}

       {/* Folders */}
       {folders.map((folder) => (
        <button
         key={folder.path}
         onClick={() => navigateTo(folder.path)}
         className="w-full flex items-center gap-3 px-3 py-2 transition-colors"
         style={{ color: 'var(--text-primary)' }}
         onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--row-hover-bg)'}
         onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
         <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
         </svg>
         <span className="truncate">{folder.name}</span>
        </button>
       ))}

       {folders.length === 0 && !parentPath && (
        <p className="text-center py-4" style={{ color: 'var(--text-muted)' }}>No folders found</p>
       )}
      </div>
     )}
    </div>

    {/* Actions */}
    <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
     <button
      onClick={onClose}
      className="px-4 py-2 text-sm transition-colors"
      style={{ 
       color: 'var(--text-primary)',
       backgroundColor: 'var(--btn-secondary-bg)',
       border: '1px solid var(--btn-secondary-border)'
      }}
      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-secondary-hover)'}
      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-secondary-bg)'}
     >
      Cancel
     </button>
     <button
      onClick={handleSelect}
      className="px-4 py-2 text-sm transition-colors"
      style={{ 
       backgroundColor: 'var(--btn-primary-bg)',
       color: 'var(--btn-primary-text)'
      }}
      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-primary-hover)'}
      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--btn-primary-bg)'}
     >
      Select This Folder
     </button>
    </div>
   </div>
  </div>
 );
}
