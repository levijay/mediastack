import { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useUISettings } from '../contexts/UISettingsContext';
import { PosterSizeSelector, posterSizeConfig } from '../components/PosterSizeSelector';

interface RecentItem {
 id: string;
 type: 'movie' | 'series';
 title: string;
 name?: string;
 poster_path?: string;
 year?: number;
 first_air_date?: string;
 created_at?: string;
}

export function RecentlyAddedPage() {
 const navigate = useNavigate();
 const { settings, updateSettings } = useUISettings();
 const [items, setItems] = useState<RecentItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [filter, setFilter] = useState<'all' | 'movies' | 'series'>('all');
 
 const posterSize = settings.posterSize || 5;
 const posterConfig = posterSizeConfig[posterSize] || posterSizeConfig[5];
 const setPosterSize = (size: number) => updateSettings({ posterSize: size });

 useEffect(() => {
  loadRecentlyAdded();
 }, []);

 const loadRecentlyAdded = async () => {
  setLoading(true);
  try {
   const data = await api.getRecentlyAdded(100);
   setItems(data || []);
  } catch (error) {
   console.error('Failed to load recently added:', error);
  } finally {
   setLoading(false);
  }
 };

 const filteredItems = items.filter(item => {
  if (filter === 'all') return true;
  if (filter === 'movies') return item.type === 'movie';
  if (filter === 'series') return item.type === 'series';
  return true;
 });

 return (
  <Layout>
   <div className="space-y-4">
    {/* Header */}
    <div className="flex items-center justify-between">
     <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Recently Added</h1>
     <div className="flex items-center gap-4">
      {/* Filter */}
      <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface-bg)' }}>
       {[
        { key: 'all', label: 'All' },
        { key: 'movies', label: 'Movies' },
        { key: 'series', label: 'TV Series' },
       ].map((f) => (
        <button
         key={f.key}
         onClick={() => setFilter(f.key as typeof filter)}
         className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
         style={{
          backgroundColor: filter === f.key ? 'var(--navbar-bg)' : 'transparent',
          color: filter === f.key ? 'var(--navbar-text)' : 'var(--text-secondary)'
         }}
        >
         {f.label}
        </button>
       ))}
      </div>
      
      {/* Poster size selector */}
      <PosterSizeSelector value={posterSize} onChange={setPosterSize} />
     </div>
    </div>

    {/* Content */}
    {loading ? (
     <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--navbar-bg)' }}></div>
     </div>
    ) : filteredItems.length === 0 ? (
     <div className="text-center py-12" style={{ backgroundColor: 'var(--surface-bg)' }}>
      <svg className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <p style={{ color: 'var(--text-secondary)' }}>No recently added items</p>
      <button 
       onClick={() => navigate('/discover')}
       className="mt-3 text-sm font-medium hover:opacity-80"
       style={{ color: 'var(--navbar-bg)' }}
      >
       Start adding media →
      </button>
     </div>
    ) : (
     <div className={`grid ${posterConfig.grid} gap-4`}>
      {filteredItems.map((item) => (
       <div
        key={`${item.type}-${item.id}`}
        onClick={() => navigate(item.type === 'movie' ? `/movies/${item.id}` : `/series/${item.id}`)}
        className="group cursor-pointer"
       >
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden border transition-all duration-200 group-hover:border-2" 
         style={{ 
          borderColor: 'var(--border-color)',
          backgroundColor: 'var(--surface-bg)'
         }}
        >
         {item.poster_path ? (
          <img 
           src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
           alt={item.title || item.name}
           className="w-full h-full object-cover"
           loading="lazy"
          />
         ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--hover-bg)' }}>
           <svg className="w-12 h-12" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {item.type === 'movie' ? (
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            ) : (
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            )}
           </svg>
          </div>
         )}
         {/* Type badge */}
         <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-medium" 
          style={{ 
           backgroundColor: item.type === 'movie' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(139, 92, 246, 0.9)',
           color: 'white' 
          }}
         >
          {item.type === 'movie' ? 'Movie' : 'TV'}
         </div>
        </div>
        <div className="mt-2">
         <h3 className="text-sm font-medium truncate group-hover:opacity-80" style={{ color: 'var(--text-primary)' }}>
          {item.title || item.name}
         </h3>
         <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {item.year || (item.first_air_date ? new Date(item.first_air_date).getFullYear() : '')}
         </p>
        </div>
       </div>
      ))}
     </div>
    )}
   </div>
  </Layout>
 );
}
