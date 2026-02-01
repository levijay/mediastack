import { useEffect, useRef, ReactNode } from 'react';

interface ConfirmModalProps {
 isOpen: boolean;
 title: string;
 message: ReactNode;
 confirmText?: string;
 cancelText?: string;
 variant?: 'danger' | 'warning' | 'info';
 danger?: boolean;
 onConfirm: () => void;
 onCancel: () => void;
}

export function ConfirmModal({
 isOpen,
 title,
 message,
 confirmText = 'Delete',
 cancelText = 'Cancel',
 variant,
 danger,
 onConfirm,
 onCancel
}: ConfirmModalProps) {
 // Use danger prop to set variant for backwards compatibility
 const actualVariant = variant || (danger ? 'danger' : 'danger');
 const confirmRef = useRef<HTMLButtonElement>(null);

 useEffect(() => {
  if (isOpen && confirmRef.current) {
   confirmRef.current.focus();
  }
 }, [isOpen]);

 useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
   if (e.key === 'Escape' && isOpen) {
    onCancel();
   }
  };
  window.addEventListener('keydown', handleEscape);
  return () => window.removeEventListener('keydown', handleEscape);
 }, [isOpen, onCancel]);

 if (!isOpen) return null;

 const variantStyles = {
  danger: {
   icon: 'bg-red-100 dark:bg-red-900/30',
   iconColor: 'text-red-600 dark:text-red-400',
   button: 'bg-red-600 hover:bg-red-700'
  },
  warning: {
   icon: 'bg-yellow-100 dark:bg-yellow-900/30',
   iconColor: 'text-yellow-600 dark:text-yellow-400',
   button: 'bg-yellow-600 hover:bg-yellow-700'
  },
  info: {
   icon: 'bg-blue-100 dark:bg-blue-900/30',
   iconColor: 'text-blue-600 dark:text-blue-400',
   button: 'bg-blue-600 hover:bg-blue-700'
  }
 };

 const styles = variantStyles[actualVariant];

 return (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
   <div className="absolute inset-0 bg-black/50" />
   <div 
    className="relative bg-white dark:bg-gray-800 shadow-xl w-full max-w-md overflow-hidden"
    onClick={e => e.stopPropagation()}
   >
    <div className="p-6">
     <div className="flex items-start gap-4">
      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${styles.icon} flex items-center justify-center`}>
       {actualVariant === 'danger' ? (
        <svg className={`w-5 h-5 ${styles.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
       ) : actualVariant === 'warning' ? (
        <svg className={`w-5 h-5 ${styles.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
       ) : (
        <svg className={`w-5 h-5 ${styles.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
       )}
      </div>
      <div className="flex-1">
       <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
       <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</div>
      </div>
     </div>
    </div>
    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
     <button
      onClick={onCancel}
      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
     >
      {cancelText}
     </button>
     <button
      ref={confirmRef}
      onClick={onConfirm}
      className={`px-4 py-2 text-sm font-medium text-white ${styles.button} transition-colors`}
     >
      {confirmText}
     </button>
    </div>
   </div>
  </div>
 );
}
