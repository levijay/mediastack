import { useState, createContext, useContext, useCallback, useEffect } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'progress';

export interface Toast {
 id: string;
 type: ToastType;
 message: string;
 progress?: {
  current: number;
  total: number;
 };
 duration?: number; // 0 = persistent until dismissed
 dismissible?: boolean;
}

interface ToastSettings {
 // Per-type settings: -1 = disabled (don't show), 0 = no auto-dismiss, >0 = duration in ms
 successDuration: number;
 infoDuration: number;
 warningDuration: number;
 errorDuration: number;
}

const DEFAULT_TOAST_SETTINGS: ToastSettings = {
 successDuration: 5000,
 infoDuration: 5000,
 warningDuration: 5000,
 errorDuration: 8000,
};

// Get toast settings from localStorage
const getToastSettings = (): ToastSettings => {
 try {
  const saved = localStorage.getItem('toast_settings');
  if (saved) {
   const parsed = JSON.parse(saved);
   // Migrate from old format (defaultDuration) to new format
   if (parsed.defaultDuration !== undefined && parsed.successDuration === undefined) {
    return {
     successDuration: parsed.defaultDuration,
     infoDuration: parsed.defaultDuration,
     warningDuration: parsed.defaultDuration,
     errorDuration: parsed.errorDuration || DEFAULT_TOAST_SETTINGS.errorDuration,
    };
   }
   return { ...DEFAULT_TOAST_SETTINGS, ...parsed };
  }
 } catch (e) {}
 return DEFAULT_TOAST_SETTINGS;
};

// Save toast settings to localStorage
export const saveToastSettings = (settings: Partial<ToastSettings>) => {
 const current = getToastSettings();
 const updated = { ...current, ...settings };
 localStorage.setItem('toast_settings', JSON.stringify(updated));
};

interface ToastContextType {
 toasts: Toast[];
 addToast: (toast: Omit<Toast, 'id'>) => string;
 removeToast: (id: string) => void;
 updateToast: (id: string, updates: Partial<Toast>) => void;
 clearAll: () => void;
 settings: ToastSettings;
 updateSettings: (settings: Partial<ToastSettings>) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
 const [toasts, setToasts] = useState<Toast[]>([]);
 const [settings, setSettings] = useState<ToastSettings>(DEFAULT_TOAST_SETTINGS);

 // Load settings on mount
 useEffect(() => {
  setSettings(getToastSettings());
 }, []);

 const updateSettings = useCallback((newSettings: Partial<ToastSettings>) => {
  setSettings(prev => {
   const updated = { ...prev, ...newSettings };
   saveToastSettings(updated);
   return updated;
  });
 }, []);

 const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Get duration for this toast type from settings
  const getTypeDuration = () => {
   switch (toast.type) {
    case 'success': return settings.successDuration;
    case 'info': return settings.infoDuration;
    case 'warning': return settings.warningDuration;
    case 'error': return settings.errorDuration;
    case 'progress': return 0; // Progress toasts never auto-dismiss
    default: return settings.infoDuration;
   }
  };

  // Determine duration - use provided duration or type-specific setting
  let duration = toast.duration;
  if (duration === undefined) {
   duration = getTypeDuration();
  }

  // If duration is -1, this toast type is disabled - don't show it
  if (duration === -1) {
   return id; // Return id but don't add toast
  }

  const newToast: Toast = {
   id,
   dismissible: true,
   ...toast,
   duration,
  };
  
  setToasts(prev => [...prev, newToast]);

  // Auto-dismiss after duration (if not 0)
  if (newToast.duration && newToast.duration > 0) {
   setTimeout(() => {
    setToasts(prev => prev.filter(t => t.id !== id));
   }, newToast.duration);
  }

  return id;
 }, [settings]);

 const removeToast = useCallback((id: string) => {
  setToasts(prev => prev.filter(t => t.id !== id));
 }, []);

 const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
  setToasts(prev => {
   const toast = prev.find(t => t.id === id);
   if (!toast) return prev;

   const updated = prev.map(t => 
    t.id === id ? { ...t, ...updates } : t
   );

   // If duration changed and it's > 0, set new timeout
   if (updates.duration && updates.duration > 0) {
    setTimeout(() => {
     setToasts(p => p.filter(t => t.id !== id));
    }, updates.duration);
   }

   return updated;
  });
 }, []);

 const clearAll = useCallback(() => {
  setToasts([]);
 }, []);

 return (
  <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast, clearAll, settings, updateSettings }}>
   {children}
   <ToastContainer toasts={toasts} onDismiss={removeToast} />
  </ToastContext.Provider>
 );
}

export function useToast() {
 const context = useContext(ToastContext);
 if (!context) {
  throw new Error('useToast must be used within a ToastProvider');
 }
 return context;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
 if (toasts.length === 0) return null;

 return (
  <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
   {toasts.map(toast => (
    <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
   ))}
  </div>
 );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
 // Use inline styles with CSS variables for theme-consistent appearance
 const getToastStyle = (): React.CSSProperties => {
  // Use type-specific backgrounds if set in theme
  switch (toast.type) {
   case 'success':
    return {
     backgroundColor: 'var(--toast-success-bg)',
     color: 'var(--toast-text)',
     borderColor: 'var(--toast-border)',
    };
   case 'error':
    return {
     backgroundColor: 'var(--toast-error-bg)',
     color: 'var(--toast-text)',
     borderColor: 'var(--toast-border)',
    };
   case 'warning':
    return {
     backgroundColor: 'var(--toast-warning-bg)',
     color: 'var(--toast-text)',
     borderColor: 'var(--toast-border)',
    };
   default:
    return {
     backgroundColor: 'var(--toast-bg)',
     color: 'var(--toast-text)',
     borderColor: 'var(--toast-border)',
    };
  }
 };

 const getIconColor = () => {
  // Icons use white/light color to contrast with colored backgrounds
  return 'currentColor';
 };

 const progressColor = 'bg-white/30';

 // Countdown bar color
 const countdownColor = 'rgba(255,255,255,0.5)';

 const Icon = () => {
  const iconColor = getIconColor();
  switch (toast.type) {
   case 'success':
    return (
     <svg className="w-5 h-5" fill={iconColor} viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
     </svg>
    );
   case 'error':
    return (
     <svg className="w-5 h-5" fill={iconColor} viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
     </svg>
    );
   case 'warning':
    return (
     <svg className="w-5 h-5" fill={iconColor} viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
     </svg>
    );
   case 'info':
    return (
     <svg className="w-5 h-5" fill={iconColor} viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
     </svg>
    );
   case 'progress':
    return (
     <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: iconColor }}></div>
    );
  }
 };

 // Only show countdown for non-progress toasts with valid duration
 const showCountdown = toast.type !== 'progress' && toast.duration && toast.duration > 0;
 
 // Only show progress bar for progress type with valid total AND when work has started (current > 0)
 const showProgress = toast.type === 'progress' && toast.progress && toast.progress.total > 0 && toast.progress.current > 0;

 return (
  <div 
   className="shadow-lg border min-w-[300px] animate-slide-in overflow-hidden"
   style={getToastStyle()}
  >
   <div className="p-4">
    <div className="flex items-start gap-3">
     <Icon />
     <div className="flex-1 min-w-0">
      <p className="font-medium text-sm" style={{ color: 'var(--navbar-text)' }}>{toast.message}</p>
      {showProgress && (
       <div className="mt-2">
        <div className="w-full rounded-full h-1.5" style={{ backgroundColor: 'var(--navbar-hover)' }}>
         <div 
          className={`h-1.5 rounded-full transition-all duration-300 ${progressColor}`}
          style={{ width: `${(toast.progress!.current / toast.progress!.total) * 100}%` }}
         />
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--navbar-text)', opacity: 0.7 }}>
         {toast.progress!.current} / {toast.progress!.total}
        </p>
       </div>
      )}
     </div>
     {toast.dismissible !== false && (
      <button
       onClick={() => onDismiss(toast.id)}
       className="p-1 -m-1 opacity-60 hover:opacity-100 transition-opacity"
       style={{ color: 'var(--navbar-text)' }}
      >
       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
       </svg>
      </button>
     )}
    </div>
   </div>
   {/* Countdown bar - only for non-progress toasts */}
   {showCountdown && (
    <div className="h-1 w-full" style={{ backgroundColor: 'var(--navbar-hover)' }}>
     <div 
      className="h-full"
      style={{ 
       backgroundColor: countdownColor,
       width: '100%',
       animation: `countdown ${toast.duration}ms linear forwards`
      }}
     />
    </div>
   )}
   <style>{`
    @keyframes countdown {
     from { width: 100%; }
     to { width: 0%; }
    }
   `}</style>
  </div>
 );
}

// Convenience functions for common toast types
export function toast(toastContext: ToastContextType) {
 return {
  info: (message: string, duration?: number) => 
   toastContext.addToast({ type: 'info', message, duration }),
  success: (message: string, duration?: number) => 
   toastContext.addToast({ type: 'success', message, duration }),
  warning: (message: string, duration?: number) => 
   toastContext.addToast({ type: 'warning', message, duration }),
  error: (message: string, duration?: number) => 
   toastContext.addToast({ type: 'error', message, duration: duration || 8000 }),
  progress: (message: string, current: number, total: number) => 
   toastContext.addToast({ type: 'progress', message, progress: { current, total }, duration: 0 }),
 };
}
