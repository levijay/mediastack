import { useState } from 'react';

interface DeleteConfirmModalProps {
 isOpen: boolean;
 onClose: () => void;
 onConfirm: (deleteFiles: boolean, addExclusion: boolean) => void;
 title: string;
 itemName: string;
 hasFiles?: boolean;
 showExclusionOption?: boolean;
 isSeries?: boolean;
}

export function DeleteConfirmModal({
 isOpen,
 onClose,
 onConfirm,
 title,
 itemName,
 hasFiles = false,
 showExclusionOption = true,
 isSeries = false
}: DeleteConfirmModalProps) {
 const [deleteFiles, setDeleteFiles] = useState(false);
 const [addExclusion, setAddExclusion] = useState(false);
 const [deleting, setDeleting] = useState(false);

 if (!isOpen) return null;

 const handleConfirm = async () => {
  setDeleting(true);
  await onConfirm(deleteFiles, addExclusion);
  setDeleting(false);
  setDeleteFiles(false);
  setAddExclusion(false);
 };

 return (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
   <div className="bg-white dark:bg-gray-800 w-full max-w-md">
    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
     <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
    </div>

    <div className="p-4">
     <p className="text-gray-600 dark:text-gray-400 mb-4">
      Are you sure you want to remove <strong className="text-gray-900 dark:text-white">{itemName}</strong> from your library?
     </p>

     {hasFiles && (
      <div className="bg-gray-50 dark:bg-gray-900 p-3 mb-4">
       <label className="flex items-start gap-3 cursor-pointer">
        <input
         type="checkbox"
         checked={deleteFiles}
         onChange={(e) => setDeleteFiles(e.target.checked)}
         className="mt-1 rounded border-gray-300 dark:border-gray-600 text-red-500 focus:ring-red-500"
        />
        <div>
         <span className="font-medium text-gray-900 dark:text-white">{isSeries ? 'Delete all files and folder' : 'Also delete files'}</span>
         <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {isSeries 
           ? 'Permanently delete all episode files and the series folder from disk. This cannot be undone.'
           : 'Permanently delete all downloaded files from disk. This cannot be undone.'}
         </p>
        </div>
       </label>
      </div>
     )}

     {showExclusionOption && (
      <div className="bg-gray-50 dark:bg-gray-900 p-3 mb-4">
       <label className="flex items-start gap-3 cursor-pointer">
        <input
         type="checkbox"
         checked={addExclusion}
         onChange={(e) => setAddExclusion(e.target.checked)}
         className="mt-1 rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
        />
        <div>
         <span className="font-medium text-gray-900 dark:text-white">Add to exclusion list</span>
         <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Prevent this item from being re-added by import lists in the future.
         </p>
        </div>
       </label>
      </div>
     )}

     {deleteFiles && (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 mb-4">
       <div className="flex items-start gap-2">
        <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm text-red-700 dark:text-red-400">
         <strong>Warning:</strong> This will permanently delete all media files associated with this item.
        </p>
       </div>
      </div>
     )}
    </div>

    <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
     <button
      onClick={onClose}
      disabled={deleting}
      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
     >
      Cancel
     </button>
     <button
      onClick={handleConfirm}
      disabled={deleting}
      className="px-4 py-2 text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2"
      style={{ backgroundColor: 'var(--btn-danger-bg)' }}
     >
      {deleting ? (
       <>
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Deleting...
       </>
      ) : (
       <>
        {deleteFiles ? 'Delete with Files' : 'Remove from Library'}
       </>
      )}
     </button>
    </div>
   </div>
  </div>
 );
}
