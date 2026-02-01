import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { api } from '../services/api';

export interface Notification {
 id: number;
 type: 'info' | 'success' | 'warning' | 'error';
 title: string;
 message: string;
 timestamp: string;
 read: boolean;
 entity_type?: 'movie' | 'series' | 'episode' | 'system';
 entity_id?: string;
}

interface NotificationContextType {
 notifications: Notification[];
 unreadCount: number;
 addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
 markAsRead: (id: number) => void;
 markAllAsRead: () => void;
 clearNotification: (id: number) => void;
 clearAll: () => void;
 refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Events that should show as notifications
const NOTIFICATION_EVENTS = new Set([
 'grabbed', 'downloaded', 'imported', 'unmonitored', 
 'scan_completed', 'failed', 'deleted'
]);

// Map activity event types to notification types
const eventTypeToNotificationType = (eventType: string): 'info' | 'success' | 'warning' | 'error' => {
 switch (eventType) {
  case 'imported':
  case 'downloaded':
   return 'success';
  case 'failed':
  case 'deleted':
   return 'error';
  case 'unmonitored':
   return 'warning';
  case 'grabbed':
  case 'scan_completed':
   return 'info';
  default:
   return 'info';
 }
};

// Map event types to user-friendly titles
const eventTypeToTitle = (eventType: string, eventLabel?: string): string => {
 if (eventLabel) return eventLabel;
 switch (eventType) {
  case 'grabbed': return 'Release Grabbed';
  case 'downloaded': return 'Download Complete';
  case 'imported': return 'Download Imported';
  case 'scan_completed': return 'Library Scan Complete';
  case 'unmonitored': return 'Auto-Unmonitored';
  case 'failed': return 'Download Failed';
  case 'deleted': return 'Deleted';
  default: return eventType.replace(/_/g, ' ');
 }
};

export function NotificationProvider({ children }: { children: ReactNode }) {
 const [notifications, setNotifications] = useState<Notification[]>([]);
 const seenIdsRef = useRef<Set<number>>(new Set());
 const lastCheckRef = useRef<number>(0);
 const isInitializedRef = useRef(false);

 // Load stored notifications on mount
 useEffect(() => {
  try {
   const stored = localStorage.getItem('mediastack_notifications');
   if (stored) {
    const parsed = JSON.parse(stored);
    setNotifications(parsed);
    // Track seen IDs
    parsed.forEach((n: Notification) => seenIdsRef.current.add(n.id));
   }
  } catch (e) {
   console.error('Failed to load notifications:', e);
  }
  isInitializedRef.current = true;
 }, []);

 // Save notifications to localStorage when they change
 useEffect(() => {
  if (isInitializedRef.current) {
   localStorage.setItem('mediastack_notifications', JSON.stringify(notifications));
  }
 }, [notifications]);

 // Poll for new activity
 const pollActivity = useCallback(async () => {
  // Don't poll if not authenticated
  const token = localStorage.getItem('auth_token');
  if (!token) {
   return;
  }
  
  try {
   const activity = await api.getRecentActivity(30);
   if (!activity || activity.length === 0) {
    return;
   }

   // Get max ID from all activities
   const maxId = Math.max(...activity.map((a: any) => a.id));
   
   // On first poll, just initialize lastCheckRef and don't show old notifications
   if (lastCheckRef.current === 0) {
    lastCheckRef.current = maxId;
    return;
   }

   // Filter for notification-worthy events that we haven't seen
   const newActivity = activity.filter((a: any) => {
    const isNotificationEvent = NOTIFICATION_EVENTS.has(a.event_type);
    const isNew = a.id > lastCheckRef.current;
    const notSeen = !seenIdsRef.current.has(a.id);
    return isNotificationEvent && isNew && notSeen;
   });

   // Update last check to highest ID
   if (maxId > lastCheckRef.current) {
    lastCheckRef.current = maxId;
   }

   if (newActivity.length > 0) {
    // Convert to notifications and add
    const newNotifications: Notification[] = newActivity.map((a: any) => ({
     id: a.id,
     type: eventTypeToNotificationType(a.event_type),
     title: eventTypeToTitle(a.event_type, a.event_label),
     message: a.message,
     timestamp: a.created_at,
     read: false,
     entity_type: a.entity_type,
     entity_id: a.entity_id
    }));

    // Track as seen
    newActivity.forEach((a: any) => seenIdsRef.current.add(a.id));

    // Add to state (newest first)
    setNotifications(prev => [...newNotifications.reverse(), ...prev].slice(0, 50));
   }
  } catch (error: any) {
   // Silently ignore 401 errors (not authenticated)
   if (error?.response?.status !== 401) {
    console.error('[Notifications] Poll error:', error);
   }
  }
 }, []);

 // Initial fetch and polling
 useEffect(() => {
  // Check if authenticated before starting polling
  const token = localStorage.getItem('auth_token');
  if (!token) {
   return;
  }
  
  // Wait a bit for auth to stabilize
  const timeout = setTimeout(() => {
   pollActivity();
   
   // Poll every 5 seconds
   const interval = setInterval(pollActivity, 5000);
   return () => clearInterval(interval);
  }, 1000);
  
  return () => clearTimeout(timeout);
 }, [pollActivity]);

 // Manual refresh
 const refreshNotifications = useCallback(async () => {
  await pollActivity();
 }, [pollActivity]);

 const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
  const newNotification: Notification = {
   ...notification,
   id: Date.now(),
   timestamp: new Date().toISOString(),
   read: false
  };
  setNotifications(prev => [newNotification, ...prev].slice(0, 50));
 }, []);

 const markAsRead = useCallback((id: number) => {
  setNotifications(prev => prev.map(n => 
   n.id === id ? { ...n, read: true } : n
  ));
 }, []);

 const markAllAsRead = useCallback(() => {
  setNotifications(prev => prev.map(n => ({ ...n, read: true })));
 }, []);

 const clearNotification = useCallback((id: number) => {
  setNotifications(prev => prev.filter(n => n.id !== id));
 }, []);

 const clearAll = useCallback(() => {
  setNotifications([]);
  seenIdsRef.current.clear();
  lastCheckRef.current = 0;
  localStorage.removeItem('mediastack_notifications');
 }, []);

 const unreadCount = notifications.filter(n => !n.read).length;

 return (
  <NotificationContext.Provider value={{
   notifications,
   unreadCount,
   addNotification,
   markAsRead,
   markAllAsRead,
   clearNotification,
   clearAll,
   refreshNotifications
  }}>
   {children}
  </NotificationContext.Provider>
 );
}

export function useNotifications() {
 const context = useContext(NotificationContext);
 if (!context) {
  throw new Error('useNotifications must be used within NotificationProvider');
 }
 return context;
}
