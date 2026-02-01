import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from './Toast';
import { useTimezone } from '../contexts/TimezoneContext';

interface Release {
 guid: string;
 title: string;
 indexer: string;
 indexerType?: 'torznab' | 'newznab';
 protocol?: 'torrent' | 'usenet';
 size: number;
 seeders: number;
 leechers: number;
 grabs?: number;
 quality: string;
 downloadUrl: string;
 publishDate: string;
 infoUrl?: string;
 categories?: string[];
 customFormatScore?: number;
}

interface QualityProfile {
 id: string;
 name: string;
}

interface DownloadClient {
 id: string;
 name: string;
 type: 'qbittorrent' | 'sabnzbd';
 priority: number;
}

interface IndexerStatus {
 configured: number;
 indexers: { name: string; type: string }[];
}

interface InteractiveSearchModalProps {
 isOpen: boolean;
 onClose: () => void;
 mediaType: 'movie' | 'tv';
 mediaId: string;
 title: string;
 year?: number;
 seasonNumber?: number;
 episodeNumber?: number;
 qualityProfileId?: string;
}

export function InteractiveSearchModal({
 isOpen,
 onClose,
 mediaType,
 mediaId,
 title,
 year,
 seasonNumber,
 episodeNumber,
 qualityProfileId
}: InteractiveSearchModalProps) {
 const [releases, setReleases] = useState<Release[]>([]);
 const [loading, setLoading] = useState(true);
 const [downloading, setDownloading] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [sortBy, setSortBy] = useState<string>('score');
 const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
 const [filterQuality, setFilterQuality] = useState<string>('all');
 const [filterProtocol, setFilterProtocol] = useState<string>('all');
 const [searchText, setSearchText] = useState('');
 const [downloadClients, setDownloadClients] = useState<DownloadClient[]>([]);
 const [selectedClientId, setSelectedClientId] = useState<string>('');
 const [indexerStatus, setIndexerStatus] = useState<IndexerStatus | null>(null);
 const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
 const [qualityProfiles, setQualityProfiles] = useState<QualityProfile[]>([]);
 const [selectedProfileId, setSelectedProfileId] = useState<string>(qualityProfileId || '');
 const { addToast } = useToast();
 const { formatRelativeTime } = useTimezone();

 // Load saved view mode preference
 useEffect(() => {
  const loadViewPreference = async () => {
   try {
    const { ui_settings } = await api.getUISettings();
    if (ui_settings?.searchReleasesViewMode) {
     setViewMode(ui_settings.searchReleasesViewMode);
    }
   } catch (err) {
    console.error('Failed to load view preference:', err);
   }
  };
  loadViewPreference();
 }, []);

 // Save view mode preference when changed
 const handleViewModeChange = async (mode: 'cards' | 'table') => {
  setViewMode(mode);
  try {
   const { ui_settings } = await api.getUISettings();
   await api.updateUISettings({
    ...ui_settings,
    searchReleasesViewMode: mode
   });
  } catch (err) {
   console.error('Failed to save view preference:', err);
  }
 };

 useEffect(() => {
  if (isOpen) {
   loadIndexerStatus();
   loadQualityProfiles();
   searchReleases();
   loadDownloadClients();
  }
 }, [isOpen]);

 // Re-fetch scores when profile changes
 useEffect(() => {
  if (selectedProfileId && releases.length > 0) {
   loadCustomFormatScores(releases, selectedProfileId);
  }
 }, [selectedProfileId]);

 // Initial score loading when releases first arrive
 useEffect(() => {
  if (selectedProfileId && releases.length > 0 && releases.every(r => r.customFormatScore === 0)) {
   loadCustomFormatScores(releases, selectedProfileId);
  }
 }, [releases.length]);

 const loadIndexerStatus = async () => {
  try {
   const status = await api.getIndexerStatus();
   setIndexerStatus(status);
  } catch (err) {
   console.error('Failed to load indexer status:', err);
  }
 };

 const loadDownloadClients = async () => {
  try {
   const clients = await api.getEnabledDownloadClients();
   setDownloadClients(clients);
   if (clients.length > 0 && !selectedClientId) {
    setSelectedClientId(clients[0].id);
   }
  } catch (err) {
   console.error('Failed to load download clients:', err);
  }
 };

 const loadQualityProfiles = async () => {
  try {
   const profiles = await api.getQualityProfiles();
   setQualityProfiles(profiles);
   if (profiles.length > 0 && !selectedProfileId) {
    setSelectedProfileId(qualityProfileId || profiles[0].id);
   }
  } catch (err) {
   console.error('Failed to load quality profiles:', err);
  }
 };

 const searchReleases = async () => {
  setLoading(true);
  setError(null);
  try {
   let results;
   if (mediaType === 'movie') {
    results = await api.searchMovieReleases(title, year);
   } else {
    results = await api.searchTVReleases(title, seasonNumber, episodeNumber);
   }
   
   const parsed = results.map((r: any) => ({
    ...r,
    quality: detectQuality(r.title),
    size: r.size || 0,
    seeders: r.seeders || 0,
    leechers: r.leechers || 0,
    customFormatScore: 0
   }));
   
   setReleases(parsed);
   
   // Fetch custom format scores if we have a profile (use prop as fallback)
   const profileToUse = selectedProfileId || qualityProfileId;
   if (profileToUse && parsed.length > 0) {
    loadCustomFormatScores(parsed, profileToUse);
   }
  } catch (err: any) {
   setError(err.response?.data?.error || 'Failed to search releases');
  } finally {
   setLoading(false);
  }
 };

 const loadCustomFormatScores = async (releaseList: Release[], profileId: string) => {
  try {
   const releaseData = releaseList.map(r => ({ title: r.title, size: r.size }));
   const result = await api.scoreReleases(releaseData, profileId);
   
   if (result.scores) {
    setReleases(prev => prev.map(r => ({
     ...r,
     customFormatScore: result.scores[r.title] || 0
    })));
   }
  } catch (err) {
   console.error('Failed to load custom format scores:', err);
  }
 };

 const detectQuality = (releaseTitle: string): string => {
  if (releaseTitle.match(/2160p|4K|UHD/i)) return '4K';
  if (releaseTitle.match(/1080p/i)) return '1080p';
  if (releaseTitle.match(/720p/i)) return '720p';
  if (releaseTitle.match(/480p/i)) return '480p';
  return 'Unknown';
 };

 const detectSource = (releaseTitle: string): string => {
  if (releaseTitle.match(/Remux/i)) return 'Remux';
  if (releaseTitle.match(/BluRay|BDRip/i)) return 'Bluray';
  if (releaseTitle.match(/WEB-DL|WEBDL/i)) return 'WEB-DL';
  if (releaseTitle.match(/WEBRip/i)) return 'WEBRip';
  if (releaseTitle.match(/HDTV/i)) return 'HDTV';
  return '';
 };

 const formatSize = (bytes: number): string => {
  if (bytes === 0) return 'N/A';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
 };

 const formatAge = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  return formatRelativeTime(dateStr);
 };

 const handleDownload = async (release: Release) => {
  if (downloadClients.length === 0) {
   addToast({ message: 'No download clients configured', type: 'error' });
   return;
  }

  setDownloading(release.guid);
  try {
   await api.startDownload({
    movieId: mediaType === 'movie' ? mediaId : undefined,
    seriesId: mediaType === 'tv' ? mediaId : undefined,
    seasonNumber,
    episodeNumber,
    downloadUrl: release.downloadUrl,
    title: release.title,
    quality: release.quality,
    size: release.size,
    seeders: release.seeders,
    indexer: release.indexer,
    protocol: release.protocol,
    downloadClientId: selectedClientId || undefined
   });
   addToast({ message: 'Download started!', type: 'success' });
   onClose();
  } catch (err: any) {
   addToast({ message: err.response?.data?.error || 'Failed to start download', type: 'error' });
  } finally {
   setDownloading(null);
  }
 };

 const getQualityColor = (quality: string): string => {
  switch (quality) {
   case '4K': case '2160p': return '#9333ea';
   case '1080p': return '#2563eb';
   case '720p': return '#16a34a';
   case '480p': return '#ca8a04';
   default: return '#6b7280';
  }
 };

 const qualityMatches = (releaseQuality: string, filter: string): boolean => {
  if (filter === 'all') return true;
  if (filter === '4K') return releaseQuality === '4K' || releaseQuality === '2160p';
  return releaseQuality === filter;
 };

 const filteredReleases = releases
  .filter(r => qualityMatches(r.quality, filterQuality))
  .filter(r => filterProtocol === 'all' || r.protocol === filterProtocol)
  .filter(r => !searchText || r.title.toLowerCase().includes(searchText.toLowerCase()))
  .sort((a, b) => {
   let comparison = 0;
   switch (sortBy) {
    case 'score':
     // Combined score: custom format score + seeders bonus (up to 50)
     const aScore = (a.customFormatScore || 0) + Math.min((a.seeders || 0) / 2, 50);
     const bScore = (b.customFormatScore || 0) + Math.min((b.seeders || 0) / 2, 50);
     comparison = bScore - aScore;
     break;
    case 'seeders': comparison = (b.seeders || 0) - (a.seeders || 0); break;
    case 'size': comparison = (b.size || 0) - (a.size || 0); break;
    case 'age': comparison = new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime(); break;
    case 'quality':
     const weights: Record<string, number> = { '4K': 4, '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
     comparison = (weights[b.quality] || 0) - (weights[a.quality] || 0);
     break;
   }
   return sortOrder === 'desc' ? comparison : -comparison;
  });

 if (!isOpen) return null;

 return (
  <div
   className="fixed inset-0 flex items-center justify-center z-[100] p-4"
   style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
   onClick={(e) => e.target === e.currentTarget && onClose()}
  >
   <div 
    className="w-full max-w-7xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
    style={{ backgroundColor: 'var(--card-bg, #1f2937)' }}
    onClick={(e) => e.stopPropagation()}
   >
    {/* Header */}
    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
     <div className="flex items-center justify-between">
      <div>
       <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Search Releases
       </h2>
       <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
        {title} {year && `(${year})`}
        {seasonNumber !== undefined && ` • Season ${seasonNumber}`}
        {episodeNumber !== undefined && `, Episode ${episodeNumber}`}
       </p>
      </div>
      <button
       onClick={onClose}
       className="p-2 hover:bg-white/10 transition-colors"
       style={{ color: 'var(--text-muted)' }}
      >
       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
       </svg>
      </button>
     </div>
    </div>

    {/* Filters Bar */}
    <div className="px-6 py-3 border-b flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--page-bg)' }}>
     {/* Search */}
     <div className="relative flex-1 min-w-[200px]">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
       type="text"
       placeholder="Filter results..."
       value={searchText}
       onChange={(e) => setSearchText(e.target.value)}
       className="w-full pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2"
       style={{ backgroundColor: 'var(--input-bg)', color: 'var(--input-text)', border: '1px solid var(--input-border)' }}
      />
     </div>

     {/* Protocol Filter */}
     <select
      value={filterProtocol}
      onChange={(e) => setFilterProtocol(e.target.value)}
      className="px-3 py-2 text-sm focus:outline-none"
      style={{ backgroundColor: 'var(--input-bg)', color: 'var(--input-text)', border: '1px solid var(--input-border)' }}
     >
      <option value="all">All Types</option>
      <option value="torrent">Torrents</option>
      <option value="usenet">Usenet</option>
     </select>

     {/* Quality Filter */}
     <select
      value={filterQuality}
      onChange={(e) => setFilterQuality(e.target.value)}
      className="px-3 py-2 text-sm focus:outline-none"
      style={{ backgroundColor: 'var(--input-bg)', color: 'var(--input-text)', border: '1px solid var(--input-border)' }}
     >
      <option value="all">All Quality</option>
      <option value="4K">4K / 2160p</option>
      <option value="1080p">1080p</option>
      <option value="720p">720p</option>
      <option value="480p">480p</option>
     </select>

     {/* Sort */}
     <select
      value={`${sortBy}-${sortOrder}`}
      onChange={(e) => {
       const [field, order] = e.target.value.split('-');
       setSortBy(field);
       setSortOrder(order as 'asc' | 'desc');
      }}
      className="px-3 py-2 text-sm focus:outline-none"
      style={{ backgroundColor: 'var(--input-bg)', color: 'var(--input-text)', border: '1px solid var(--input-border)' }}
     >
      <option value="score-desc">Best Score</option>
      <option value="seeders-desc">Most Seeders</option>
      <option value="seeders-asc">Least Seeders</option>
      <option value="size-desc">Largest</option>
      <option value="size-asc">Smallest</option>
      <option value="age-desc">Newest</option>
      <option value="age-asc">Oldest</option>
      <option value="quality-desc">Best Quality</option>
     </select>

     {/* Quality Profile for scoring */}
     {qualityProfiles.length > 0 && (
      <select
       value={selectedProfileId}
       onChange={(e) => setSelectedProfileId(e.target.value)}
       className="px-3 py-2 text-sm focus:outline-none"
       style={{ backgroundColor: 'var(--input-bg)', color: 'var(--input-text)', border: '1px solid var(--input-border)' }}
       title="Quality Profile for Custom Format scoring"
      >
       {qualityProfiles.map(p => (
        <option key={p.id} value={p.id}>{p.name}</option>
       ))}
      </select>
     )}

     {/* View Toggle */}
     <div className="flex overflow-hidden" style={{ border: '1px solid var(--input-border)' }}>
      <button
       onClick={() => handleViewModeChange('cards')}
       className={`px-3 py-2 text-sm ${viewMode === 'cards' ? 'bg-blue-500 text-white' : ''}`}
       style={viewMode !== 'cards' ? { backgroundColor: 'var(--input-bg)', color: 'var(--text-secondary)' } : {}}
      >
       Cards
      </button>
      <button
       onClick={() => handleViewModeChange('table')}
       className={`px-3 py-2 text-sm ${viewMode === 'table' ? 'bg-blue-500 text-white' : ''}`}
       style={viewMode !== 'table' ? { backgroundColor: 'var(--input-bg)', color: 'var(--text-secondary)' } : {}}
      >
       Table
      </button>
     </div>

     {/* Refresh */}
     <button
      onClick={searchReleases}
      disabled={loading}
      className="px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
      style={{ backgroundColor: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
     >
      <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {loading ? 'Searching...' : 'Refresh'}
     </button>
    </div>

    {/* Results Count */}
    <div className="px-6 py-2 flex items-center justify-between" style={{ backgroundColor: 'var(--page-bg)' }}>
     <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
      {filteredReleases.length} result{filteredReleases.length !== 1 ? 's' : ''}
      {releases.length !== filteredReleases.length && ` (${releases.length} total)`}
     </span>
     {indexerStatus && (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
       Searched {indexerStatus.configured} indexer{indexerStatus.configured !== 1 ? 's' : ''}
      </span>
     )}
    </div>

    {/* Content */}
    <div className="flex-1 overflow-auto p-4">
     {loading ? (
      <div className="flex flex-col items-center justify-center h-64">
       <div className="animate-spin rounded-full h-10 w-10 border-b-2 mb-4" style={{ borderColor: 'var(--navbar-bg)' }}></div>
       <p style={{ color: 'var(--text-secondary)' }}>Searching indexers...</p>
       {indexerStatus && indexerStatus.configured > 0 && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
         {indexerStatus.indexers.map(i => i.name).join(', ')}
        </p>
       )}
      </div>
     ) : error ? (
      <div className="flex flex-col items-center justify-center h-64">
       <svg className="w-12 h-12 mb-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
       </svg>
       <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
       <button onClick={searchReleases} className="mt-4 px-4 py-2 " style={{ backgroundColor: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}>
        Try Again
       </button>
      </div>
     ) : filteredReleases.length === 0 ? (
      <div className="flex flex-col items-center justify-center h-64">
       <svg className="w-12 h-12 mb-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
       </svg>
       <p style={{ color: 'var(--text-secondary)' }}>No releases found</p>
       {searchText && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Try adjusting your filters</p>}
      </div>
     ) : viewMode === 'cards' ? (
      // Card View
      <div className="grid gap-3">
       {filteredReleases.map((release) => (
        <div
         key={release.guid}
         className=" p-4 transition-all hover:scale-[1.01]"
         style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
        >
         <div className="flex items-start gap-4">
          {/* Left: Info */}
          <div className="flex-1 min-w-0">
           {/* Title */}
           <div className="flex items-center gap-2 mb-2">
            {release.infoUrl ? (
             <a
              href={release.infoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sm hover:underline truncate"
              style={{ color: 'var(--link-color, #60a5fa)' }}
              title={release.title}
             >
              {release.title}
             </a>
            ) : (
             <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }} title={release.title}>
              {release.title}
             </span>
            )}
           </div>
           
           {/* Badges Row */}
           <div className="flex flex-wrap items-center gap-2">
            {/* Protocol */}
            <span
             className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full"
             style={{ backgroundColor: release.protocol === 'usenet' ? '#3b82f6' : '#f97316', color: 'white' }}
            >
             {release.protocol === 'usenet' ? 'NZB' : 'Torrent'}
            </span>
            
            {/* Quality */}
            <span
             className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full"
             style={{ backgroundColor: getQualityColor(release.quality), color: 'white' }}
            >
             {release.quality}
            </span>
            
            {/* Custom Format Score - Always show when profile selected */}
            {selectedProfileId && (
             <span
              className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full"
              style={{ 
               backgroundColor: release.customFormatScore !== undefined && release.customFormatScore > 0 ? '#059669' : 
                               release.customFormatScore !== undefined && release.customFormatScore < 0 ? '#dc2626' : '#6b7280', 
               color: 'white' 
              }}
              title="Custom Format Score"
             >
              CF: {release.customFormatScore !== undefined ? (release.customFormatScore > 0 ? '+' : '') + release.customFormatScore : '0'}
             </span>
            )}
            
            {/* Source */}
            {detectSource(release.title) && (
             <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
              {detectSource(release.title)}
             </span>
            )}
            
            {/* Indexer */}
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
             {release.indexer}
            </span>
           </div>
          </div>

          {/* Right: Stats + Action */}
          <div className="flex items-center gap-4 flex-shrink-0">
           {/* Stats */}
           <div className="flex items-center gap-4 text-sm">
            {/* Size */}
            <div className="text-center">
             <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatSize(release.size)}</div>
             <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Size</div>
            </div>
            
            {/* Age */}
            <div className="text-center">
             <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatAge(release.publishDate)}</div>
             <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Age</div>
            </div>
            
            {/* Seeders/Grabs */}
            {release.protocol === 'torrent' ? (
             <div className="text-center">
              <div 
               className="font-medium"
               style={{ color: release.seeders >= 10 ? '#22c55e' : release.seeders >= 1 ? '#f97316' : '#ef4444' }}
              >
               {release.seeders} / {release.leechers}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Peers</div>
             </div>
            ) : release.grabs !== undefined ? (
             <div className="text-center">
              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{release.grabs}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Grabs</div>
             </div>
            ) : null}
           </div>

           {/* Download Button */}
           <button
            onClick={() => handleDownload(release)}
            disabled={downloading === release.guid}
            className="px-4 py-2 font-medium text-sm transition-all disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: '#22c55e', color: 'white' }}
           >
            {downloading === release.guid ? (
             <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Grabbing...
             </>
            ) : (
             <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Grab
             </>
            )}
           </button>
          </div>
         </div>
        </div>
       ))}
      </div>
     ) : (
      // Table View
      <div className="border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
       <div className="table-responsive">
       <table className="w-full" style={{ backgroundColor: 'var(--card-bg)' }}>
        <thead className="sticky top-0" style={{ backgroundColor: 'var(--table-header-bg)' }}>
         <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
          <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Type</th>
          <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Title</th>
          <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Quality</th>
          <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Size</th>
          <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Age</th>
          <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Peers</th>
          <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Score</th>
          <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}></th>
         </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
         {filteredReleases.map((release) => (
          <tr key={release.guid} className="hover:bg-white/5">
           <td className="px-3 py-2">
            <span
             className="inline-flex px-2 py-0.5 text-xs font-medium rounded"
             style={{ backgroundColor: release.protocol === 'usenet' ? '#3b82f6' : '#f97316', color: 'white' }}
            >
             {release.protocol === 'usenet' ? 'NZB' : 'Torrent'}
            </span>
           </td>
           <td className="px-3 py-2">
            <div className="max-w-md truncate text-sm" style={{ color: 'var(--text-primary)' }} title={release.title}>
             {release.title}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{release.indexer}</div>
           </td>
          <td className="px-3 py-2">
           <span
            className="inline-flex px-2 py-0.5 text-xs font-medium rounded"
            style={{ backgroundColor: getQualityColor(release.quality), color: 'white' }}
           >
            {release.quality}
           </span>
          </td>
          <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatSize(release.size)}</td>
          <td className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatAge(release.publishDate)}</td>
          <td className="px-3 py-2">
           {release.protocol === 'torrent' ? (
            <span style={{ color: release.seeders >= 10 ? '#22c55e' : release.seeders >= 1 ? '#f97316' : '#ef4444' }}>
             {release.seeders}/{release.leechers}
            </span>
           ) : (
            <span style={{ color: 'var(--text-muted)' }}>{release.grabs || '-'}</span>
           )}
          </td>
          <td className="px-3 py-2">
           {selectedProfileId ? (
            <span
             className="inline-flex px-2 py-0.5 text-xs font-medium"
             style={{ 
              backgroundColor: release.customFormatScore !== undefined && release.customFormatScore > 0 ? '#059669' : 
                              release.customFormatScore !== undefined && release.customFormatScore < 0 ? '#dc2626' : '#6b7280', 
              color: 'white' 
             }}
            >
             {release.customFormatScore !== undefined ? (release.customFormatScore > 0 ? '+' : '') + release.customFormatScore : '0'}
            </span>
           ) : (
            <span style={{ color: 'var(--text-muted)' }}>-</span>
           )}
          </td>
          <td className="px-3 py-2 text-right">
           <button
            onClick={() => handleDownload(release)}
            disabled={downloading === release.guid}
            className="p-2 rounded hover:bg-green-500/20 transition-colors disabled:opacity-50"
            style={{ color: '#22c55e' }}
            title="Grab release"
           >
            {downloading === release.guid ? (
             <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
            ) : (
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
             </svg>
            )}
           </button>
          </td>
         </tr>
        ))}
       </tbody>
      </table></div>
      </div>
     )}
    </div>
   </div>
  </div>
 );
}
