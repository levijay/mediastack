import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useUISettings } from '../../contexts/UISettingsContext';
import { APP_VERSION } from '../../version';

interface NavItem {
 id: string;
 label: string;
 icon: React.ReactNode;
 path?: string;
 children?: { id: string; label: string; path: string }[];
}

const navItems: NavItem[] = [
 {
  id: 'home',
  label: 'Home',
  icon: (
   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
   </svg>
  ),
  children: [
   { id: 'dashboard', label: 'Dashboard', path: '/' },
   { id: 'recent-activity', label: 'Recent Activity', path: '/recent-activity' },
  ]
 },
 {
  id: 'library',
  label: 'Library',
  icon: (
   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
   </svg>
  ),
  children: [
   { id: 'movies', label: 'Movies', path: '/movies' },
   { id: 'series', label: 'TV Series', path: '/series' },
  ]
 },
 {
  id: 'calendar',
  label: 'Calendar',
  icon: (
   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
   </svg>
  ),
  path: '/calendar'
 },
 {
  id: 'discover',
  label: 'Discover',
  icon: (
   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
   </svg>
  ),
  path: '/discover'
 },
 {
  id: 'downloads',
  label: 'Downloads',
  icon: (
   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
   </svg>
  ),
  path: '/downloads'
 },
];

const managementItems: NavItem[] = [
 {
  id: 'reports',
  label: 'Reports',
  icon: (
   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
   </svg>
  ),
  path: '/reports'
 },
 {
  id: 'settings',
  label: 'Settings',
  icon: (
   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
   </svg>
  ),
  path: '/settings'
 },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
 const location = useLocation();
 const { user, authDisabled } = useAuth();
 const { settings, updateSettings } = useUISettings();
 const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['home', 'library']));
 
 const collapsed = settings.sidebarCollapsed ?? false;
 const setCollapsed = (value: boolean) => updateSettings({ sidebarCollapsed: value });

 const toggleExpanded = (id: string) => {
  setExpandedItems(prev => {
   const next = new Set(prev);
   if (next.has(id)) {
    next.delete(id);
   } else {
    next.add(id);
   }
   return next;
  });
 };

 const isActive = (path: string) => {
  if (path === '/') return location.pathname === '/';
  return location.pathname.startsWith(path);
 };

 const renderNavItem = (item: NavItem) => {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  const active = item.path ? isActive(item.path) : item.children?.some(c => isActive(c.path));

  if (hasChildren) {
   return (
    <div key={item.id}>
     <button
      onClick={() => toggleExpanded(item.id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
       active ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
     >
      <span className={active ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'}>
       {item.icon}
      </span>
      {!collapsed && (
       <>
        <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
        <svg 
         className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
         fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
       </>
      )}
     </button>
     {!collapsed && isExpanded && (
      <div className="mt-1 ml-4 pl-4 border-l border-gray-200 space-y-1">
       {item.children?.map(child => (
        <NavLink
         key={child.id}
         to={child.path}
         onClick={onClose}
         className={({ isActive }) => `
          block px-3 py-2 rounded-lg text-sm transition-all duration-200
          ${isActive 
           ? 'text-emerald-600 font-medium bg-emerald-50' 
           : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }
         `}
        >
         {child.label}
        </NavLink>
       ))}
      </div>
     )}
    </div>
   );
  }

  return (
   <NavLink
    key={item.id}
    to={item.path || '/'}
    onClick={onClose}
    className={({ isActive }) => `
     flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
     ${isActive 
      ? 'bg-gray-100 text-gray-900' 
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
     }
    `}
   >
    {({ isActive }) => (
     <>
      <span className={isActive ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'}>
       {item.icon}
      </span>
      {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
     </>
    )}
   </NavLink>
  );
 };

 return (
  <aside 
   className={`h-screen bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
    collapsed ? 'w-16' : 'w-60'
   }`}
   style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
  >
   {/* Logo */}
   <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
    <div className="flex items-center gap-3">
     <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
     </div>
     {!collapsed && (
      <div>
       <h1 className="text-sm font-bold text-gray-900">MediaStack</h1>
       <p className="text-[10px] text-gray-400">v{APP_VERSION}</p>
      </div>
     )}
    </div>
    <div className="flex items-center gap-1">
     {/* Mobile close button */}
     {onClose && (
      <button 
       onClick={onClose}
       className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors lg:hidden"
      >
       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
       </svg>
      </button>
     )}
     {/* Collapse button - hidden on mobile */}
     <button 
      onClick={() => setCollapsed(!collapsed)}
      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors hidden lg:block"
     >
      <svg className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
      </svg>
     </button>
    </div>
   </div>

   {/* Navigation */}
   <nav className="flex-1 overflow-y-auto py-4 px-3">
    <div className="space-y-1">
     {navItems.map(renderNavItem)}
    </div>

    {!collapsed && (
     <p className="px-3 mt-6 mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
      Management
     </p>
    )}
    <div className="space-y-1 mt-2">
     {managementItems.map(renderNavItem)}
    </div>
   </nav>

   {/* User Profile */}
   {!authDisabled && user && (
    <div className="p-3 border-t border-gray-100">
     <div className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${collapsed ? 'justify-center' : ''}`}>
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-semibold">
       {user.username?.charAt(0).toUpperCase() || 'U'}
      </div>
      {!collapsed && (
       <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{user.username}</p>
        <p className="text-xs text-gray-500 truncate">{user.email || 'Administrator'}</p>
       </div>
      )}
      {!collapsed && (
       <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
       </svg>
      )}
     </div>
    </div>
   )}
  </aside>
 );
}
