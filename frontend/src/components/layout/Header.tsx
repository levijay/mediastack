import { useAuth } from '../../hooks/useAuth';
import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import { APP_VERSION } from '../../version';

/**
 * Navbar/Header component using CSS theme variables
 * NO hardcoded colors - all styles come from theme
 */
export function Header() {
 const { user, logout, authDisabled } = useAuth();
 const location = useLocation();
 const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
 const [hoveredLink, setHoveredLink] = useState<string | null>(null);

 const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

 // All styles use CSS variables
 const navbarStyle: React.CSSProperties = {
  backgroundColor: 'var(--navbar-bg)',
  borderBottom: '1px solid var(--navbar-border)',
  position: 'sticky',
  top: 0,
  zIndex: 40,
 };

 const linkStyle = (path: string): React.CSSProperties => ({
  color: 'var(--navbar-text)',
  backgroundColor: isActive(path) || hoveredLink === path ? 'var(--navbar-hover)' : 'transparent',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  transition: 'background-color 0.15s',
  textDecoration: 'none',
  display: 'block',
 });

 const brandStyle: React.CSSProperties = {
  color: 'var(--navbar-brand)',
  fontSize: '1.5rem',
  fontWeight: 700,
 };

 const badgeStyle: React.CSSProperties = {
  backgroundColor: 'var(--navbar-hover)',
  color: 'var(--navbar-text)',
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
  marginLeft: '0.5rem',
 };

 const buttonStyle: React.CSSProperties = {
  backgroundColor: 'var(--navbar-hover)',
  color: 'var(--navbar-text)',
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  border: 'none',
  cursor: 'pointer',
 };

 const textStyle: React.CSSProperties = {
  color: 'var(--navbar-text)',
 };

 const navLinks = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/movies', label: 'Movies' },
  { path: '/series', label: 'Series' },
  { path: '/calendar', label: 'Calendar' },
  { path: '/discover', label: 'Discover' },
  { path: '/activity', label: 'Activity' },
 ];

 return (
  <header style={navbarStyle} className="shadow-sm">
   <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between items-center h-16">
     <div className="flex items-center space-x-8">
      <div className="flex items-center">
       <span style={brandStyle}>MediaStack</span>
       <span style={badgeStyle}>v{APP_VERSION}</span>
      </div>

      {user && (
       <nav className="hidden md:flex space-x-1">
        {navLinks.map(link => (
         <a
          key={link.path}
          href={link.path}
          style={linkStyle(link.path)}
          onMouseEnter={() => setHoveredLink(link.path)}
          onMouseLeave={() => setHoveredLink(null)}
         >
          {link.label}
         </a>
        ))}
        {user.role === 'admin' && (
         <a
          href="/settings"
          style={linkStyle('/settings')}
          onMouseEnter={() => setHoveredLink('/settings')}
          onMouseLeave={() => setHoveredLink(null)}
         >
          Settings
         </a>
        )}
       </nav>
      )}
     </div>

     {user && (
      <div className="flex items-center space-x-3">
       {!authDisabled && (
        <span className="hidden md:block text-sm" style={textStyle}>
         {user.username}
        </span>
       )}
       {!authDisabled && (
        <button onClick={logout} style={buttonStyle} className="hidden md:block">
         Logout
        </button>
       )}
       
       {/* Mobile menu button */}
       <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden p-2"
        style={textStyle}
       >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         {mobileMenuOpen ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
         ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
         )}
        </svg>
       </button>
      </div>
     )}
    </div>

    {/* Mobile menu */}
    {user && mobileMenuOpen && (
     <div className="md:hidden pb-4" style={{ borderTop: '1px solid var(--navbar-border)' }}>
      <div className="flex flex-col space-y-1 pt-2">
       {navLinks.map(link => (
        <a
         key={link.path}
         href={link.path}
         style={linkStyle(link.path)}
         onClick={() => setMobileMenuOpen(false)}
         onMouseEnter={() => setHoveredLink(link.path)}
         onMouseLeave={() => setHoveredLink(null)}
        >
         {link.label}
        </a>
       ))}
       {user.role === 'admin' && (
        <a
         href="/settings"
         style={linkStyle('/settings')}
         onClick={() => setMobileMenuOpen(false)}
         onMouseEnter={() => setHoveredLink('/settings')}
         onMouseLeave={() => setHoveredLink(null)}
        >
         Settings
        </a>
       )}
       {!authDisabled && (
        <div style={{ borderTop: '1px solid var(--navbar-border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
         <div className="px-3 py-2 text-sm" style={textStyle}>
          {user.username}
         </div>
         <button
          onClick={() => { setMobileMenuOpen(false); logout(); }}
          className="w-full text-left px-3 py-2 text-sm font-medium"
          style={linkStyle('/logout')}
          onMouseEnter={() => setHoveredLink('/logout')}
          onMouseLeave={() => setHoveredLink(null)}
         >
          Logout
         </button>
        </div>
       )}
      </div>
     </div>
    )}
   </div>
  </header>
 );
}
