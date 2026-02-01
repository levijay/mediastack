import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useUISettings } from '../../contexts/UISettingsContext';

interface LayoutProps {
 children: ReactNode;
 maxWidth?: 'default' | 'wide' | 'full';
}

export function Layout({ children }: LayoutProps) {
 const { settings } = useUISettings();
 const collapsed = settings.sidebarCollapsed ?? false;
 const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
 
 return (
  <div className="min-h-screen bg-gray-50">
   {/* Mobile Menu Button */}
   <button
    onClick={() => setMobileMenuOpen(true)}
    className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-gray-200 shadow-sm lg:hidden"
    style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
   >
    <svg className="w-6 h-6" style={{ color: 'var(--text-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
   </button>

   {/* Mobile Overlay */}
   {mobileMenuOpen && (
    <div 
     className="fixed inset-0 bg-black/50 z-40 lg:hidden"
     onClick={() => setMobileMenuOpen(false)}
    />
   )}

   {/* Sidebar - hidden on mobile unless menu is open */}
   <div className={`
    fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:transform-none
    ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
   `}>
    <Sidebar onClose={() => setMobileMenuOpen(false)} />
   </div>
   
   {/* Main Content Area - no margin on mobile, offset by sidebar width on desktop */}
   <div className={`min-h-screen transition-all duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-60'}`}>
    {/* Top Bar */}
    <TopBar />
    
    {/* Page Content */}
    <main className="p-6">
     {children}
    </main>
   </div>
  </div>
 );
}
