import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

/**
 * MEDIASTACK SIMPLIFIED THEME SYSTEM
 * ==================================
 * 
 * Two base themes: Dark and Light
 * 8 accent colors to customize the look
 * 
 * The accent color controls:
 * - navbarBg (sidebar, buttons, selected items)
 * - hoverBg (derived from accent)
 * - rowHoverBg (derived from accent)
 */

export interface Theme {
 id: string;
 name: string;
 isDark: boolean;
 background: string;
 cardBg: string;
 navbarBg: string;
 hoverBg: string;
 rowHoverBg: string;
}

// Accent colors - new palette
export const accentColors = [
 { id: 'coral', name: 'Coral', color: '#FF595E' },
 { id: 'orange', name: 'Orange', color: '#FF924C' },
 { id: 'yellow', name: 'Yellow', color: '#FFCA3A' },
 { id: 'lime', name: 'Lime', color: '#C5CA30' },
 { id: 'green', name: 'Green', color: '#8AC926' },
 { id: 'teal', name: 'Teal', color: '#36949D' },
 { id: 'blue', name: 'Blue', color: '#1982C4' },
 { id: 'indigo', name: 'Indigo', color: '#4267AC' },
 { id: 'purple', name: 'Purple', color: '#565AA0' },
 { id: 'violet', name: 'Violet', color: '#6A4C93' },
 { id: 'cyan', name: 'Cyan', color: '#55DDE0' },
 { id: 'emerald', name: 'Emerald', color: '#06D6A0' },
 { id: 'lavender', name: 'Lavender', color: '#9067C6' },
];

// Base themes - accent color will be applied on top
export const themes: Theme[] = [
 {
  id: 'dark',
  name: 'Dark',
  isDark: true,
  background: 'oklch(0.21 0.01 285.89)',
  cardBg: 'oklch(0.27 0.01 286.03)',
  navbarBg: '#565AA0', // Default purple, will be overwritten by accent
  hoverBg: 'oklch(0.37 0.01 285.81)',
  rowHoverBg: 'oklch(0.37 0.03 259.73)',
 },
 {
  id: 'light',
  name: 'Light',
  isDark: false,
  background: 'oklch(0.97 0 0)',
  cardBg: 'oklch(1 0 0)',
  navbarBg: '#565AA0', // Default purple, will be overwritten by accent
  hoverBg: 'oklch(0.92 0.02 250)',
  rowHoverBg: 'oklch(0.95 0.01 250)',
 },
];

interface UISettings {
 theme: 'dark' | 'light' | 'system';
 accentColor: string; // Accent color ID
 posterSize: number;
 showRecentlyAdded: boolean;
 viewMode: 'poster' | 'table';
 sidebarCollapsed?: boolean;
 episodeColumns?: {
  filename: boolean;
  format: boolean;
  size: boolean;
 };
 movieFileColumns?: {
  path: boolean;
  videoInfo: boolean;
  audioInfo: boolean;
  audioLanguages: boolean;
  size: boolean;
  languages: boolean;
  quality: boolean;
 };
 movieTableColumns?: {
  year: boolean;
  quality: boolean;
  size: boolean;
  monitored: boolean;
  availability: boolean;
  qualityProfile: boolean;
  runtime: boolean;
  rating: boolean;
  added: boolean;
 };
 dashboardWidgets?: {
  trending: boolean;
  popularMovies: boolean;
  movieGenres: boolean;
  upcomingMovies: boolean;
  popularSeries: boolean;
  seriesGenres: boolean;
  upcomingSeries: boolean;
 };
 dashboardLanguages?: string[]; // ISO language codes for filtering dashboard widgets
 showCast?: boolean;
 showSimilar?: boolean;
}

interface UISettingsContextType {
 settings: UISettings;
 updateSettings: (updates: Partial<UISettings>) => void;
 currentTheme: Theme;
 getAccentColor: () => string;
}

const defaultSettings: UISettings = {
 theme: 'dark',
 accentColor: 'purple',
 posterSize: 5,
 showRecentlyAdded: true,
 showCast: true,
 showSimilar: true,
 viewMode: 'poster',
 sidebarCollapsed: false,
 episodeColumns: {
  filename: false,
  format: true,
  size: true,
 },
 movieFileColumns: {
  path: true,
  videoInfo: true,
  audioInfo: true,
  audioLanguages: true,
  size: true,
  languages: true,
  quality: true,
 },
 movieTableColumns: {
  year: true,
  quality: true,
  size: true,
  monitored: true,
  availability: false,
  qualityProfile: false,
  runtime: false,
  rating: false,
  added: false,
 },
 dashboardWidgets: {
  trending: true,
  popularMovies: true,
  movieGenres: true,
  upcomingMovies: true,
  popularSeries: true,
  seriesGenres: true,
  upcomingSeries: true,
 },
 dashboardLanguages: ['en'], // Default to English only
};

const UISettingsContext = createContext<UISettingsContextType | undefined>(undefined);

/**
 * Apply ALL theme CSS variables to DOM
 * This function sets EVERY variable used in the system
 */
export function applyThemeToDOM(theme: Theme, accentColorValue: string) {
 const root = document.documentElement;
 const isDark = theme.isDark;
 
 // Use accent color for navbarBg
 const navbarBg = accentColorValue;
 
 // Derive hover colors from accent
 const accentHoverBg = isDark 
  ? 'oklch(0.35 0.02 260)' // Subtle dark hover
  : 'oklch(0.92 0.02 260)'; // Subtle light hover
  
 const accentRowHoverBg = isDark
  ? 'oklch(0.32 0.04 260)' // Subtle dark row hover with slight tint
  : 'oklch(0.96 0.02 260)'; // Subtle light row hover
 
 // Text colors
 const textPrimary = isDark ? 'oklch(0.95 0 0)' : 'oklch(0.15 0 0)';
 const textSecondary = isDark ? 'oklch(0.7 0 0)' : 'oklch(0.4 0 0)';
 const textMuted = isDark ? 'oklch(0.55 0 0)' : 'oklch(0.5 0 0)';
 
 // Navbar text - always light on accent colors for visibility
 const navbarText = 'oklch(0.98 0 0)';
 
 // Button text - always light on accent colored buttons
 const btnPrimaryText = 'oklch(0.98 0 0)';
 
 // Danger button
 const btnDangerBg = 'oklch(0.55 0.2 25)';
 
 // Border color
 const borderColor = isDark ? 'oklch(0.35 0.01 260)' : 'oklch(0.85 0.01 260)';
 
 // Card shadow
 const cardShadow = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)';
 
 // Input background
 const inputBg = theme.background;
 
 // Modal overlay
 const modalOverlay = isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.5)';
 
 // Tooltip colors
 const tooltipBg = isDark ? 'oklch(0.9 0 0)' : 'oklch(0.2 0 0)';
 const tooltipText = isDark ? 'oklch(0.1 0 0)' : 'oklch(0.95 0 0)';
 
 // ============================================
 // BASE COLORS (from theme)
 // ============================================
 root.style.setProperty('--page-bg', theme.background);
 root.style.setProperty('--card-bg', theme.cardBg);
 root.style.setProperty('--navbar-bg', navbarBg);
 root.style.setProperty('--hover-bg', accentHoverBg);
 root.style.setProperty('--row-hover-bg', accentRowHoverBg);
 
 // ============================================
 // NAVBAR
 // ============================================
 root.style.setProperty('--navbar-text', navbarText);
 root.style.setProperty('--navbar-hover', accentHoverBg);
 root.style.setProperty('--navbar-active', accentHoverBg);
 root.style.setProperty('--navbar-border', borderColor);
 root.style.setProperty('--navbar-brand', navbarText);
 
 // ============================================
 // BUTTONS - PRIMARY
 // ============================================
 root.style.setProperty('--btn-primary-bg', navbarBg);
 root.style.setProperty('--btn-primary-text', btnPrimaryText);
 root.style.setProperty('--btn-primary-hover', accentHoverBg);
 root.style.setProperty('--btn-primary-border', navbarBg);
 root.style.setProperty('--btn-primary-focus', navbarBg);
 
 // ============================================
 // BUTTONS - SECONDARY
 // ============================================
 root.style.setProperty('--btn-secondary-bg', theme.cardBg);
 root.style.setProperty('--btn-secondary-text', textPrimary);
 root.style.setProperty('--btn-secondary-hover', accentRowHoverBg);
 root.style.setProperty('--btn-secondary-border', borderColor);
 root.style.setProperty('--btn-secondary-focus', borderColor);
 
 // ============================================
 // BUTTONS - DANGER
 // ============================================
 root.style.setProperty('--btn-danger-bg', btnDangerBg);
 root.style.setProperty('--btn-danger-text', 'oklch(0.95 0 0)');
 root.style.setProperty('--btn-danger-hover', 'oklch(0.45 0.2 25)');
 root.style.setProperty('--btn-danger-border', btnDangerBg);
 root.style.setProperty('--btn-danger-focus', btnDangerBg);
 
 // ============================================
 // TEXT
 // ============================================
 root.style.setProperty('--text-primary', textPrimary);
 root.style.setProperty('--text-secondary', textSecondary);
 root.style.setProperty('--text-muted', textMuted);
 root.style.setProperty('--text-link', navbarBg);
 root.style.setProperty('--text-link-hover', accentHoverBg);
 
 // ============================================
 // HEADINGS
 // ============================================
 root.style.setProperty('--heading-text', textPrimary);
 root.style.setProperty('--card-title', textPrimary);
 
 // ============================================
 // BORDERS
 // ============================================
 root.style.setProperty('--border-color', borderColor);
 root.style.setProperty('--border-light', isDark ? 'oklch(0.35 0 0)' : 'oklch(0.85 0 0)');
 root.style.setProperty('--border-focus', navbarBg);
 
 // ============================================
 // CARDS & SURFACES
 // ============================================
 root.style.setProperty('--surface-bg', theme.cardBg);
 root.style.setProperty('--surface-hover', accentRowHoverBg);
 root.style.setProperty('--surface-border', borderColor);
 root.style.setProperty('--card-border', borderColor);
 root.style.setProperty('--card-border-width', '1px');
 root.style.setProperty('--card-selected-border-width', '2px');
 root.style.setProperty('--card-selected-border', navbarBg);
 root.style.setProperty('--card-shadow', cardShadow);
 
 // ============================================
 // INPUTS & FORMS
 // ============================================
 root.style.setProperty('--input-bg', inputBg);
 root.style.setProperty('--input-text', textPrimary);
 root.style.setProperty('--input-placeholder', textMuted);
 root.style.setProperty('--input-border', borderColor);
 root.style.setProperty('--input-focus-border', navbarBg);
 root.style.setProperty('--input-focus-ring', navbarBg);
 
 // ============================================
 // TABLES
 // ============================================
 root.style.setProperty('--table-bg', theme.cardBg);
 root.style.setProperty('--table-header-bg', theme.background);
 root.style.setProperty('--table-row-hover', accentRowHoverBg);
 root.style.setProperty('--table-border', borderColor);
 root.style.setProperty('--table-text', textPrimary);
 
 // ============================================
 // MODALS & DIALOGS
 // ============================================
 root.style.setProperty('--modal-bg', theme.cardBg);
 root.style.setProperty('--modal-overlay', modalOverlay);
 root.style.setProperty('--modal-border', borderColor);
 
 // ============================================
 // DROPDOWNS & MENUS
 // ============================================
 root.style.setProperty('--dropdown-bg', theme.cardBg);
 root.style.setProperty('--dropdown-hover', accentRowHoverBg);
 root.style.setProperty('--dropdown-border', borderColor);
 root.style.setProperty('--dropdown-text', textPrimary);
 
 // ============================================
 // SELECTION & ACTIVE STATES
 // ============================================
 root.style.setProperty('--selected-bg', navbarBg);
 root.style.setProperty('--selected-text', btnPrimaryText);
 root.style.setProperty('--active-bg', accentHoverBg);
 root.style.setProperty('--focus-ring', navbarBg);
 
 // ============================================
 // SCROLLBAR
 // ============================================
 root.style.setProperty('--scrollbar-track', theme.background);
 root.style.setProperty('--scrollbar-thumb', accentHoverBg);
 root.style.setProperty('--scrollbar-thumb-hover', accentRowHoverBg);
 
 // ============================================
 // BADGES & TAGS
 // ============================================
 root.style.setProperty('--badge-bg', accentHoverBg);
 root.style.setProperty('--badge-text', navbarText);
 
 // ============================================
 // TOOLTIPS
 // ============================================
 root.style.setProperty('--tooltip-bg', tooltipBg);
 root.style.setProperty('--tooltip-text', tooltipText);
 
 // ============================================
 // TOASTS / NOTIFICATIONS
 // ============================================
 const toastBg = navbarBg;
 const toastBorder = accentHoverBg;
 const toastTextColor = navbarText;
 const toastSuccessBg = 'oklch(0.45 0.15 145)';
 const toastErrorBg = 'oklch(0.45 0.2 25)';
 const toastWarningBg = 'oklch(0.55 0.18 85)';
 
 root.style.setProperty('--toast-bg', toastBg);
 root.style.setProperty('--toast-border', toastBorder);
 root.style.setProperty('--toast-text', toastTextColor);
 root.style.setProperty('--toast-success-bg', toastSuccessBg);
 root.style.setProperty('--toast-error-bg', toastErrorBg);
 root.style.setProperty('--toast-warning-bg', toastWarningBg);
 
 // ============================================
 // LOADING & SPINNERS
 // ============================================
 root.style.setProperty('--spinner-color', navbarBg);
 root.style.setProperty('--skeleton-bg', accentHoverBg);
 
 // ============================================
 // PROGRESS BARS
 // ============================================
 root.style.setProperty('--progress-bg', accentHoverBg);
 root.style.setProperty('--progress-fill', navbarBg);
 
 // ============================================
 // TABS
 // ============================================
 root.style.setProperty('--tab-bg', theme.cardBg);
 root.style.setProperty('--tab-active-bg', navbarBg);
 root.style.setProperty('--tab-active-text', btnPrimaryText);
 root.style.setProperty('--tab-hover', accentRowHoverBg);
 root.style.setProperty('--tab-text', textPrimary);
 root.style.setProperty('--tab-border', borderColor);
 
 // ============================================
 // TOGGLE / SWITCH
 // ============================================
 root.style.setProperty('--toggle-bg', accentHoverBg);
 root.style.setProperty('--toggle-active-bg', navbarBg);
 root.style.setProperty('--toggle-thumb', 'oklch(0.95 0 0)');
 
 // ============================================
 // PRIMARY COLOR (for accent)
 // ============================================
 root.style.setProperty('--primary-color', navbarBg);
 root.style.setProperty('--primary-color-alpha', isDark ? 'rgba(100, 100, 200, 0.1)' : 'rgba(100, 100, 200, 0.1)');
 
 // ============================================
 // DARK/LIGHT MODE CLASS
 // ============================================
 if (isDark) {
  root.classList.add('dark');
  root.classList.remove('light');
 } else {
  root.classList.add('light');
  root.classList.remove('dark');
 }
 
 // Mark as loaded
 root.classList.add('theme-ready');
}

export function UISettingsProvider({ children }: { children: ReactNode }) {
 // Helper function to deep merge settings with proper defaults
 const mergeSettings = (base: UISettings, override: Partial<UISettings>): UISettings => {
  return {
   ...base,
   ...override,
   // Deep merge nested objects - ensure all required properties exist
   episodeColumns: {
    filename: override.episodeColumns?.filename ?? base.episodeColumns?.filename ?? false,
    format: override.episodeColumns?.format ?? base.episodeColumns?.format ?? true,
    size: override.episodeColumns?.size ?? base.episodeColumns?.size ?? true,
   },
   movieFileColumns: {
    path: override.movieFileColumns?.path ?? base.movieFileColumns?.path ?? true,
    videoInfo: override.movieFileColumns?.videoInfo ?? base.movieFileColumns?.videoInfo ?? true,
    audioInfo: override.movieFileColumns?.audioInfo ?? base.movieFileColumns?.audioInfo ?? true,
    audioLanguages: override.movieFileColumns?.audioLanguages ?? base.movieFileColumns?.audioLanguages ?? true,
    size: override.movieFileColumns?.size ?? base.movieFileColumns?.size ?? true,
    languages: override.movieFileColumns?.languages ?? base.movieFileColumns?.languages ?? true,
    quality: override.movieFileColumns?.quality ?? base.movieFileColumns?.quality ?? true,
   },
   movieTableColumns: {
    year: override.movieTableColumns?.year ?? base.movieTableColumns?.year ?? true,
    quality: override.movieTableColumns?.quality ?? base.movieTableColumns?.quality ?? true,
    size: override.movieTableColumns?.size ?? base.movieTableColumns?.size ?? true,
    monitored: override.movieTableColumns?.monitored ?? base.movieTableColumns?.monitored ?? true,
    availability: override.movieTableColumns?.availability ?? base.movieTableColumns?.availability ?? false,
    qualityProfile: override.movieTableColumns?.qualityProfile ?? base.movieTableColumns?.qualityProfile ?? false,
    runtime: override.movieTableColumns?.runtime ?? base.movieTableColumns?.runtime ?? false,
    rating: override.movieTableColumns?.rating ?? base.movieTableColumns?.rating ?? false,
    added: override.movieTableColumns?.added ?? base.movieTableColumns?.added ?? false,
   },
   dashboardWidgets: {
    trending: override.dashboardWidgets?.trending ?? base.dashboardWidgets?.trending ?? true,
    popularMovies: override.dashboardWidgets?.popularMovies ?? base.dashboardWidgets?.popularMovies ?? true,
    movieGenres: override.dashboardWidgets?.movieGenres ?? base.dashboardWidgets?.movieGenres ?? true,
    upcomingMovies: override.dashboardWidgets?.upcomingMovies ?? base.dashboardWidgets?.upcomingMovies ?? true,
    popularSeries: override.dashboardWidgets?.popularSeries ?? base.dashboardWidgets?.popularSeries ?? true,
    seriesGenres: override.dashboardWidgets?.seriesGenres ?? base.dashboardWidgets?.seriesGenres ?? true,
    upcomingSeries: override.dashboardWidgets?.upcomingSeries ?? base.dashboardWidgets?.upcomingSeries ?? true,
   },
  };
 };

 // Start with defaults, localStorage is just a cache for quick initial render
 const [settings, setSettings] = useState<UISettings>(() => {
  try {
   const stored = localStorage.getItem('ui_settings');
   if (stored) {
    return mergeSettings(defaultSettings, JSON.parse(stored));
   }
  } catch (e) {
   console.error('Failed to parse stored settings:', e);
  }
  return defaultSettings;
 });
 
 const [initialized, setInitialized] = useState(false);
 const [dbLoaded, setDbLoaded] = useState(false);
 const [systemPrefersDark, setSystemPrefersDark] = useState(() => 
  window.matchMedia('(prefers-color-scheme: dark)').matches
 );
 
 // Listen for system theme changes
 useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
 }, []);
 
 // Get the effective theme (resolving 'system' preference)
 const getEffectiveTheme = (): 'dark' | 'light' => {
  if (settings.theme === 'system') {
   return systemPrefersDark ? 'dark' : 'light';
  }
  return settings.theme === 'light' ? 'light' : 'dark';
 };
 
 // Get current theme object
 const currentTheme = themes.find(t => t.id === getEffectiveTheme()) || themes[0];
 
 // Get accent color value
 const getAccentColor = () => {
  const accent = accentColors.find(c => c.id === settings.accentColor);
  return accent?.color || accentColors[0].color;
 };

 // Apply theme immediately on mount and when theme/accent changes
 useEffect(() => {
  applyThemeToDOM(currentTheme, getAccentColor());
 }, [currentTheme, settings.accentColor, systemPrefersDark]);

 // Load from database - DATABASE IS THE SOURCE OF TRUTH
 useEffect(() => {
  let cancelled = false;
  
  const loadSettings = async () => {
   try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
     // No token, use defaults (not localStorage)
     if (!cancelled) {
      setSettings(defaultSettings);
      localStorage.setItem('ui_settings', JSON.stringify(defaultSettings));
      setInitialized(true);
      setDbLoaded(true);
     }
     return;
    }
    const response = await fetch('/api/settings/ui', {
     headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (cancelled) return;
    
    if (response.ok) {
     const data = await response.json();
     // Server returns { ui_settings: {...} }
     if (data?.ui_settings && Object.keys(data.ui_settings).length > 0) {
      // Database has settings - use them with deep merge
      const newSettings = mergeSettings(defaultSettings, data.ui_settings);
      setSettings(newSettings);
      localStorage.setItem('ui_settings', JSON.stringify(newSettings));
     } else {
      // Database is empty - use defaults and clear any stale localStorage
      setSettings(defaultSettings);
      localStorage.setItem('ui_settings', JSON.stringify(defaultSettings));
     }
    } else if (response.status === 401 || response.status === 403) {
     // Not authenticated - use defaults
     setSettings(defaultSettings);
     localStorage.setItem('ui_settings', JSON.stringify(defaultSettings));
    }
    setDbLoaded(true);
   } catch (error) {
    // Network error - keep using localStorage cache but don't mark as db loaded
    console.log('Could not load settings from database, using local cache');
   } finally {
    if (!cancelled) {
     setInitialized(true);
    }
   }
  };
  
  loadSettings();
  
  return () => {
   cancelled = true;
  };
 }, []);

 // Save to database when settings change (only after db has been loaded)
 const prevSettingsRef = useRef<string>('');
 useEffect(() => {
  const settingsStr = JSON.stringify(settings);
  
  // Always update localStorage as cache
  localStorage.setItem('ui_settings', settingsStr);
  
  // Only save to server if:
  // 1. Settings have changed
  // 2. Component is initialized
  // 3. Database has been loaded (to avoid overwriting db with stale localStorage)
  if (initialized && dbLoaded && settingsStr !== prevSettingsRef.current) {
   prevSettingsRef.current = settingsStr;
   const timeout = setTimeout(async () => {
    try {
     const token = localStorage.getItem('auth_token');
     if (!token) return; // Skip save if not logged in
     
     await fetch('/api/settings/ui', {
      method: 'PUT',
      headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${token}`
      },
      // Server expects { value: {...} }
      body: JSON.stringify({ value: settings })
     });
    } catch (error) {
     // Network error - settings saved to localStorage anyway
     console.log('Could not save settings to database');
    }
   }, 500);
   return () => clearTimeout(timeout);
  }
 }, [settings, initialized, dbLoaded]);

 const updateSettings = (updates: Partial<UISettings>) => {
  setSettings(prev => ({ ...prev, ...updates }));
 };

 return (
  <UISettingsContext.Provider value={{ settings, updateSettings, currentTheme, getAccentColor }}>
   {children}
  </UISettingsContext.Provider>
 );
}

export function useUISettings() {
 const context = useContext(UISettingsContext);
 if (!context) {
  throw new Error('useUISettings must be used within UISettingsProvider');
 }
 return context;
}

export function useTheme() {
 const context = useContext(UISettingsContext);
 if (!context) {
  throw new Error('useTheme must be used within UISettingsProvider');
 }
 return context.currentTheme;
}
