import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';

interface TimezoneContextType {
 timezone: string;
 setTimezone: (tz: string) => void;
 formatRelativeTime: (dateStr: string | null | undefined) => string;
 formatDate: (dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
 formatTime: (dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
 formatDateTime: (dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
 parseUTCDate: (dateStr: string | null | undefined) => Date | null;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

/**
 * Parse a date string from SQLite (UTC without timezone indicator)
 * and return a Date object
 */
function parseUTCDate(dateStr: string | null | undefined): Date | null {
 if (!dateStr) return null;
 
 // SQLite stores timestamps as UTC without timezone indicator
 // Append 'Z' to parse as UTC if not already present
 const utcDateStr = dateStr.includes('Z') || dateStr.includes('+') || dateStr.includes('T')
  ? dateStr
  : dateStr.replace(' ', 'T') + 'Z';
 
 return new Date(utcDateStr);
}

export function TimezoneProvider({ children }: { children: ReactNode }) {
 const [timezone, setTimezoneState] = useState<string>(() => {
  // Try to get from localStorage first for instant display
  const stored = localStorage.getItem('app_timezone');
  return stored || Intl.DateTimeFormat().resolvedOptions().timeZone;
 });

 // Load timezone from backend on mount (only if authenticated)
 useEffect(() => {
  let cancelled = false;
  
  const loadTimezone = async () => {
   try {
    // Check if we have an auth token before making the request
    const token = localStorage.getItem('auth_token');
    if (!token) {
     // Not authenticated yet, use localStorage/browser default
     return;
    }
    
    const settings = await api.getSettings();
    if (!cancelled && settings.timezone) {
     setTimezoneState(settings.timezone);
     localStorage.setItem('app_timezone', settings.timezone);
    }
   } catch (error: any) {
    // Silently ignore 401 errors (not authenticated yet)
    if (error?.response?.status !== 401) {
     console.error('Failed to load timezone setting:', error);
    }
   }
  };
  
  loadTimezone();
  
  return () => {
   cancelled = true;
  };
 }, []);

 const setTimezone = (tz: string) => {
  setTimezoneState(tz);
  localStorage.setItem('app_timezone', tz);
 };

 /**
  * Format a date as relative time (e.g., "5m ago", "2h ago")
  */
 const formatRelativeTime = (dateStr: string | null | undefined): string => {
  const date = parseUTCDate(dateStr);
  if (!date) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDate(dateStr);
 };

 /**
  * Format a date using the configured timezone
  */
 const formatDate = (dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions): string => {
  const date = parseUTCDate(dateStr);
  if (!date) return '';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
   month: 'short',
   day: 'numeric',
   year: 'numeric',
   timeZone: timezone
  };
  
  return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
 };

 /**
  * Format a time using the configured timezone
  */
 const formatTime = (dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions): string => {
  const date = parseUTCDate(dateStr);
  if (!date) return '';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
   hour: 'numeric',
   minute: '2-digit',
   timeZone: timezone
  };
  
  return date.toLocaleTimeString('en-US', { ...defaultOptions, ...options });
 };

 /**
  * Format a date and time using the configured timezone
  */
 const formatDateTime = (dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions): string => {
  const date = parseUTCDate(dateStr);
  if (!date) return '';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
   month: 'short',
   day: 'numeric',
   year: 'numeric',
   hour: 'numeric',
   minute: '2-digit',
   timeZone: timezone
  };
  
  return date.toLocaleString('en-US', { ...defaultOptions, ...options });
 };

 return (
  <TimezoneContext.Provider value={{
   timezone,
   setTimezone,
   formatRelativeTime,
   formatDate,
   formatTime,
   formatDateTime,
   parseUTCDate
  }}>
   {children}
  </TimezoneContext.Provider>
 );
}

export function useTimezone() {
 const context = useContext(TimezoneContext);
 if (!context) {
  throw new Error('useTimezone must be used within a TimezoneProvider');
 }
 return context;
}
