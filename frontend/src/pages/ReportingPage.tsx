import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { useToast } from '../components/Toast';
import { api, getCachedImageUrl } from '../services/api';

type MediaTab = 'movies' | 'episodes';
type SortField = 'title' | 'file_size' | 'quality' | 'rating' | 'year' | 'runtime';
type SortDirection = 'asc' | 'desc';

interface FilterOptions {
 qualities: string[];
 resolutions: string[];
 videoCodecs: string[];
 audioCodecs: string[];
 hdrTypes: string[];
 audioChannels: string[];
 releaseGroups: string[];
 yearRange: { min: number; max: number };
 genres: string[];
}

interface MovieResult {
 id: string;
 tmdb_id: number;
 title: string;
 year: number;
 runtime: number | null;
 vote_average: number | null;
 poster_path: string | null;
 folder_path: string;
 monitored: boolean;
 has_file: boolean;
 file_count: number;
 total_size: number;
 files: {
  id: string;
  relative_path: string | null;
  quality: string | null;
  resolution: string | null;
  video_codec: string | null;
  video_dynamic_range: string | null;
  audio_codec: string | null;
  audio_channels: string | null;
  file_size: number;
  release_group: string | null;
  subtitle_languages: string | null;
 }[];
}

interface EpisodeResult {
 id: string;
 series_id: string;
 series_title: string;
 series_year: number;
 poster_path: string | null;
 season_number: number;
 episode_number: number;
 episode_title: string;
 file_path: string | null;
 file_size: number;
 quality: string | null;
 video_codec: string | null;
 audio_codec: string | null;
 monitored: boolean;
 has_file: boolean;
}

interface Stats {
 movies: {
  total: number;
  withFiles: number;
  missing: number;
  totalFiles: number;
  totalSize: number;
  multipleFiles: number;
 };
 series: {
  total: number;
  totalEpisodes: number;
  episodesWithFiles: number;
  episodesMissing: number;
  totalSize: number;
 };
}

export function ReportingPage() {
 const { addToast } = useToast();
 const navigate = useNavigate();
 const [activeTab, setActiveTab] = useState<MediaTab>('movies');
 
 // Filter options from backend
 const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
 const [loadingFilters, setLoadingFilters] = useState(true);
 
 // Stats
 const [stats, setStats] = useState<Stats | null>(null);
 
 // Search results
 const [movieResults, setMovieResults] = useState<MovieResult[]>([]);
 const [episodeResults, setEpisodeResults] = useState<EpisodeResult[]>([]);
 const [searching, setSearching] = useState(false);
 const [hasSearched, setHasSearched] = useState(false);
 
 // Movie filters
 const [quality, setQuality] = useState('');
 const [resolution, setResolution] = useState('');
 const [videoCodec, setVideoCodec] = useState('');
 const [audioCodec, setAudioCodec] = useState('');
 const [hdrType, setHdrType] = useState('');
 const [audioChannels, setAudioChannels] = useState('');
 const [releaseGroup, setReleaseGroup] = useState('');
 const [genre, setGenre] = useState('');
 const [yearFrom, setYearFrom] = useState('');
 const [yearTo, setYearTo] = useState('');
 const [ratingFrom, setRatingFrom] = useState('');
 const [ratingTo, setRatingTo] = useState('');
 const [sizeFrom, setSizeFrom] = useState('');
 const [sizeTo, setSizeTo] = useState('');
 
 // Special filters
 const [titleMismatch, setTitleMismatch] = useState(false);
 const [multipleFiles, setMultipleFiles] = useState(false);
 const [missingFile, setMissingFile] = useState(false);
 const [noRating, setNoRating] = useState(false);
 
 // Sorting
 const [sortBy, setSortBy] = useState<SortField>('file_size');
 const [sortDir, setSortDir] = useState<SortDirection>('desc');
 
 // Expanded rows
 const [expandedMovies, setExpandedMovies] = useState<Set<string>>(new Set());
 
 // Delete confirmation
 const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'movie' | 'episode'; id: string; movieId?: string; title: string } | null>(null);

 // Load filter options and stats on mount
 useEffect(() => {
  loadFilterOptions();
  loadStats();
 }, []);

 const loadFilterOptions = async () => {
  setLoadingFilters(true);
  try {
   const options = await api.getReportFilterOptions();
   setFilterOptions(options);
  } catch (error) {
   console.error('Failed to load filter options:', error);
   addToast({ type: 'error', message: 'Failed to load filter options' });
  } finally {
   setLoadingFilters(false);
  }
 };

 const loadStats = async () => {
  try {
   const data = await api.getReportStats();
   setStats(data);
  } catch (error) {
   console.error('Failed to load stats:', error);
  }
 };

 const handleSearch = async () => {
  setSearching(true);
  setHasSearched(true);
  
  try {
   if (activeTab === 'movies') {
    const results = await api.searchReportMovies({
     quality: quality || undefined,
     resolution: resolution || undefined,
     videoCodec: videoCodec || undefined,
     audioCodec: audioCodec || undefined,
     hdrType: hdrType || undefined,
     audioChannels: audioChannels || undefined,
     releaseGroup: releaseGroup || undefined,
     genre: genre || undefined,
     yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
     yearTo: yearTo ? parseInt(yearTo) : undefined,
     ratingFrom: ratingFrom ? parseFloat(ratingFrom) : undefined,
     ratingTo: ratingTo ? parseFloat(ratingTo) : undefined,
     sizeFrom: sizeFrom ? parseFloat(sizeFrom) : undefined,
     sizeTo: sizeTo ? parseFloat(sizeTo) : undefined,
     titleMismatch: titleMismatch || undefined,
     multipleFiles: multipleFiles || undefined,
     missingFile: missingFile || undefined,
     noRating: noRating || undefined,
     sortBy,
     sortDir,
     limit: 500
    });
    setMovieResults(results.items);
   } else {
    const results = await api.searchReportEpisodes({
     quality: quality || undefined,
     videoCodec: videoCodec || undefined,
     audioCodec: audioCodec || undefined,
     sizeFrom: sizeFrom ? parseFloat(sizeFrom) : undefined,
     sizeTo: sizeTo ? parseFloat(sizeTo) : undefined,
     sortBy,
     sortDir,
     limit: 500
    });
    setEpisodeResults(results.items);
   }
  } catch (error) {
   console.error('Search failed:', error);
   addToast({ type: 'error', message: 'Search failed' });
  } finally {
   setSearching(false);
  }
 };

 const handleClearFilters = () => {
  setQuality('');
  setResolution('');
  setVideoCodec('');
  setAudioCodec('');
  setHdrType('');
  setAudioChannels('');
  setReleaseGroup('');
  setYearFrom('');
  setYearTo('');
  setRatingFrom('');
  setRatingTo('');
  setSizeFrom('');
  setSizeTo('');
  setTitleMismatch(false);
  setMultipleFiles(false);
  setMissingFile(false);
  setNoRating(false);
 };

 const formatSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '—';
  const tb = bytes / (1024 * 1024 * 1024 * 1024);
  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
 };

 const toggleMovieExpand = (id: string) => {
  setExpandedMovies(prev => {
   const next = new Set(prev);
   if (next.has(id)) next.delete(id);
   else next.add(id);
   return next;
  });
 };

 const handleDeleteFile = async () => {
  if (!deleteConfirm) return;
  try {
   if (deleteConfirm.type === 'movie' && deleteConfirm.movieId) {
    await api.deleteMovieFile(deleteConfirm.movieId, deleteConfirm.id);
    addToast({ type: 'success', message: 'File deleted' });
    // Re-run search to refresh results
    handleSearch();
    loadStats();
   } else if (deleteConfirm.type === 'episode') {
    await api.deleteEpisodeFile(deleteConfirm.id);
    addToast({ type: 'success', message: 'Episode file deleted' });
    handleSearch();
    loadStats();
   }
  } catch (error) {
   addToast({ type: 'error', message: 'Failed to delete file' });
  }
  setDeleteConfirm(null);
 };

 const handleSort = (field: SortField) => {
  if (sortBy === field) {
   setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
  } else {
   setSortBy(field);
   setSortDir('desc');
  }
 };

 const SortIcon = ({ field }: { field: SortField }) => (
  <span className="ml-1">
   {sortBy === field ? (
    sortDir === 'asc' ? '↑' : '↓'
   ) : (
    <span className="text-gray-300">↕</span>
   )}
  </span>
 );

 const selectClass = "w-full px-3 py-2 rounded-lg border text-sm";

 return (
  <Layout>
   <div className="space-y-6">
    {/* Header */}
    <div className="flex items-center justify-between">
     <div>
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Library Reports</h1>
      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
       Search and filter media files by metadata
      </p>
     </div>
    </div>

    {/* Stats Summary */}
    {stats && (
     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-bg)' }}>
       <p className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Movies</p>
       <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.movies.total}</p>
       <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatSize(stats.movies.totalSize)}</p>
      </div>
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-bg)' }}>
       <p className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>With Files</p>
       <p className="text-xl font-bold text-green-500">{stats.movies.withFiles}</p>
       <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{stats.movies.totalFiles} files</p>
      </div>
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-bg)' }}>
       <p className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Multiple Files</p>
       <p className="text-xl font-bold text-yellow-500">{stats.movies.multipleFiles}</p>
       <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>movies</p>
      </div>
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-bg)' }}>
       <p className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>TV Series</p>
       <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.series.total}</p>
       <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatSize(stats.series.totalSize)}</p>
      </div>
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-bg)' }}>
       <p className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Episodes</p>
       <p className="text-xl font-bold text-green-500">{stats.series.episodesWithFiles}</p>
       <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>of {stats.series.totalEpisodes}</p>
      </div>
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-bg)' }}>
       <p className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Total Size</p>
       <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatSize(stats.movies.totalSize + stats.series.totalSize)}</p>
      </div>
     </div>
    )}

    {/* Tabs */}
    <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
     <button
      onClick={() => { setActiveTab('movies'); setHasSearched(false); }}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
       activeTab === 'movies' ? 'border-current' : 'border-transparent hover:border-gray-300'
      }`}
      style={{ color: activeTab === 'movies' ? 'var(--navbar-bg)' : 'var(--text-secondary)' }}
     >
      Movies
     </button>
     <button
      onClick={() => { setActiveTab('episodes'); setHasSearched(false); }}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
       activeTab === 'episodes' ? 'border-current' : 'border-transparent hover:border-gray-300'
      }`}
      style={{ color: activeTab === 'episodes' ? 'var(--navbar-bg)' : 'var(--text-secondary)' }}
     >
      Episodes
     </button>
    </div>

    {/* Filters */}
    <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--card-bg)' }}>
     <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Filters</h3>
      <button
       onClick={handleClearFilters}
       className="text-sm px-3 py-1 rounded"
       style={{ color: 'var(--text-secondary)' }}
      >
       Clear All
      </button>
     </div>

     {loadingFilters ? (
      <div className="flex justify-center py-4">
       <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--navbar-bg)' }}></div>
      </div>
     ) : filterOptions && (
      <>
       {/* Metadata Filters */}
       <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
        <div>
         <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Quality</label>
         <select value={quality} onChange={e => setQuality(e.target.value)} className={selectClass}
          style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
          <option value="">Any</option>
          {filterOptions.qualities.map(q => <option key={q} value={q}>{q}</option>)}
         </select>
        </div>

        {activeTab === 'movies' && (
         <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Resolution</label>
          <select value={resolution} onChange={e => setResolution(e.target.value)} className={selectClass}
           style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
           <option value="">Any</option>
           {filterOptions.resolutions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
         </div>
        )}

        <div>
         <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Video Codec</label>
         <select value={videoCodec} onChange={e => setVideoCodec(e.target.value)} className={selectClass}
          style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
          <option value="">Any</option>
          {filterOptions.videoCodecs.map(v => <option key={v} value={v}>{v}</option>)}
         </select>
        </div>

        <div>
         <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Audio Codec</label>
         <select value={audioCodec} onChange={e => setAudioCodec(e.target.value)} className={selectClass}
          style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
          <option value="">Any</option>
          {filterOptions.audioCodecs.map(a => <option key={a} value={a}>{a}</option>)}
         </select>
        </div>

        {activeTab === 'movies' && (
         <>
          <div>
           <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>HDR Type</label>
           <select value={hdrType} onChange={e => setHdrType(e.target.value)} className={selectClass}
            style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Any</option>
            {filterOptions.hdrTypes.map(h => <option key={h} value={h}>{h}</option>)}
           </select>
          </div>

          <div>
           <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Audio Channels</label>
           <select value={audioChannels} onChange={e => setAudioChannels(e.target.value)} className={selectClass}
            style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Any</option>
            {filterOptions.audioChannels.map(c => <option key={c} value={c}>{c}</option>)}
           </select>
          </div>

          <div>
           <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Release Group</label>
           <select value={releaseGroup} onChange={e => setReleaseGroup(e.target.value)} className={selectClass}
            style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Any</option>
            {filterOptions.releaseGroups.map(r => <option key={r} value={r}>{r}</option>)}
           </select>
          </div>

          <div>
           <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Genre</label>
           <select value={genre} onChange={e => setGenre(e.target.value)} className={selectClass}
            style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Any</option>
            {Array.isArray(filterOptions.genres) && filterOptions.genres.map(g => (
              typeof g === 'string' ? <option key={g} value={g}>{g}</option> : null
            ))}
           </select>
          </div>
         </>
        )}
       </div>

       {/* Range Filters - Movies only */}
       {activeTab === 'movies' && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
         <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Year From</label>
          <input type="number" value={yearFrom} onChange={e => setYearFrom(e.target.value)}
           placeholder={String(filterOptions.yearRange.min)}
           className={selectClass}
           style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
         </div>
         <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Year To</label>
          <input type="number" value={yearTo} onChange={e => setYearTo(e.target.value)}
           placeholder={String(filterOptions.yearRange.max)}
           className={selectClass}
           style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
         </div>
         <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Rating From</label>
          <input type="number" step="0.1" min="0" max="10" value={ratingFrom} onChange={e => setRatingFrom(e.target.value)}
           placeholder="0"
           className={selectClass}
           style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
         </div>
         <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Rating To</label>
          <input type="number" step="0.1" min="0" max="10" value={ratingTo} onChange={e => setRatingTo(e.target.value)}
           placeholder="10"
           className={selectClass}
           style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
         </div>
         <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Size From (GB)</label>
          <input type="number" step="0.1" value={sizeFrom} onChange={e => setSizeFrom(e.target.value)}
           placeholder="0"
           className={selectClass}
           style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
         </div>
         <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Size To (GB)</label>
          <input type="number" step="0.1" value={sizeTo} onChange={e => setSizeTo(e.target.value)}
           placeholder="100"
           className={selectClass}
           style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
         </div>
        </div>
       )}

       {/* Special Filters - Movies only */}
       {activeTab === 'movies' && (
        <div className="flex flex-wrap gap-4 mb-4 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
         <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={multipleFiles} onChange={e => setMultipleFiles(e.target.checked)}
           className="rounded" style={{ accentColor: 'var(--navbar-bg)' }} />
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Multiple Files</span>
         </label>
         <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={titleMismatch} onChange={e => setTitleMismatch(e.target.checked)}
           className="rounded" style={{ accentColor: 'var(--navbar-bg)' }} />
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Title Mismatch</span>
         </label>
         <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={missingFile} onChange={e => setMissingFile(e.target.checked)}
           className="rounded" style={{ accentColor: 'var(--navbar-bg)' }} />
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Missing File</span>
         </label>
         <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={noRating} onChange={e => setNoRating(e.target.checked)}
           className="rounded" style={{ accentColor: 'var(--navbar-bg)' }} />
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>No Rating</span>
         </label>
        </div>
       )}

       {/* Search Button */}
       <div className="flex justify-end">
        <button
         onClick={handleSearch}
         disabled={searching}
         className="px-6 py-2 rounded-lg font-medium text-white disabled:opacity-50"
         style={{ backgroundColor: 'var(--navbar-bg)' }}
        >
         {searching ? 'Searching...' : 'Search'}
        </button>
       </div>
      </>
     )}
    </div>

    {/* Results */}
    {hasSearched && (
     <div className="rounded-lg overflow-hidden border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
      {searching ? (
       <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--navbar-bg)' }}></div>
       </div>
      ) : (
       <>
        {/* Movies Results */}
        {activeTab === 'movies' && (
         <div className="overflow-x-auto">
          <div className="table-responsive">
          <table className="w-full text-sm">
           <thead>
            <tr style={{ backgroundColor: 'var(--surface-bg)' }}>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>
              <button onClick={() => handleSort('title')} className="flex items-center hover:text-gray-900">
               Title <SortIcon field="title" />
              </button>
             </th>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>
              <button onClick={() => handleSort('year')} className="flex items-center hover:text-gray-900">
               Year <SortIcon field="year" />
              </button>
             </th>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Files</th>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>
              <button onClick={() => handleSort('file_size')} className="flex items-center hover:text-gray-900">
               Size <SortIcon field="file_size" />
              </button>
             </th>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>
              <button onClick={() => handleSort('quality')} className="flex items-center hover:text-gray-900">
               Quality <SortIcon field="quality" />
              </button>
             </th>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Video</th>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Audio</th>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>
              <button onClick={() => handleSort('rating')} className="flex items-center hover:text-gray-900">
               Rating <SortIcon field="rating" />
              </button>
             </th>
             <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
           </thead>
           <tbody>
            {movieResults.map(movie => (
             <>
              <tr key={movie.id}
               className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
               style={{ borderColor: 'var(--border-color)' }}
               onClick={() => movie.file_count > 0 && toggleMovieExpand(movie.id)}>
               <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                 {movie.file_count > 0 && (
                  <span className="text-gray-400 w-4">{expandedMovies.has(movie.id) ? '▼' : '▶'}</span>
                 )}
                 {movie.poster_path ? (
                  <img src={getCachedImageUrl(movie.poster_path, 'w92') || ''} alt="" className="w-8 h-12 object-cover rounded" />
                 ) : (
                  <div className="w-8 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400">?</div>
                 )}
                 <div>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{movie.title}</p>
                  <p className="text-xs truncate max-w-xs" style={{ color: 'var(--text-muted)' }}>{movie.folder_path}</p>
                 </div>
                </div>
               </td>
               <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{movie.year || '—'}</td>
               <td className="px-4 py-3">
                {movie.file_count > 1 ? (
                 <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                  {movie.file_count} files
                 </span>
                ) : movie.file_count === 1 ? (
                 <span className="text-gray-500">1</span>
                ) : (
                 <span className="text-red-500">—</span>
                )}
               </td>
               <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>{formatSize(movie.total_size)}</td>
               <td className="px-4 py-3">
                {movie.files[0]?.quality ? (
                 <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                  {movie.files[0].quality}
                 </span>
                ) : '—'}
               </td>
               <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {movie.files[0] ? (
                 <div>
                  <div>{movie.files[0].video_codec || '—'}</div>
                  {movie.files[0].video_dynamic_range && (
                   <div className="text-yellow-600 dark:text-yellow-400">{movie.files[0].video_dynamic_range}</div>
                  )}
                 </div>
                ) : '—'}
               </td>
               <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {movie.files[0] ? (
                 <div>
                  <div>{movie.files[0].audio_codec || '—'} {movie.files[0].audio_channels || ''}</div>
                 </div>
                ) : '—'}
               </td>
               <td className="px-4 py-3">
                {movie.vote_average ? (
                 <span className="text-yellow-500">★ {movie.vote_average.toFixed(1)}</span>
                ) : '—'}
               </td>
               <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                 <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/movies/${movie.id}`); }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="View details"
                 >
                  <svg className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                 </button>
                 {movie.files.length > 0 && (
                  <button
                   onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm({ type: 'movie', id: movie.files[0].id, movieId: movie.id, title: movie.title });
                   }}
                   className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                   title="Delete file"
                  >
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                   </svg>
                  </button>
                 )}
                </div>
               </td>
              </tr>
              {/* Expanded file details */}
              {expandedMovies.has(movie.id) && movie.files.map((file, idx) => (
               <tr key={`${movie.id}-${idx}`} className="bg-gray-50 dark:bg-gray-800/30 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <td colSpan={9} className="px-4 py-3 pl-16">
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                  <div>
                   <span className="text-gray-400">File:</span>
                   <p className="truncate" style={{ color: 'var(--text-primary)' }}>{file.relative_path || '—'}</p>
                  </div>
                  <div>
                   <span className="text-gray-400">Size:</span>
                   <p style={{ color: 'var(--text-primary)' }}>{formatSize(file.file_size)}</p>
                  </div>
                  <div>
                   <span className="text-gray-400">Resolution:</span>
                   <p style={{ color: 'var(--text-primary)' }}>{file.resolution || '—'}</p>
                  </div>
                  <div>
                   <span className="text-gray-400">Release Group:</span>
                   <p style={{ color: 'var(--text-primary)' }}>{file.release_group || '—'}</p>
                  </div>
                  <div>
                   <span className="text-gray-400">Subtitles:</span>
                   <p style={{ color: 'var(--text-primary)' }}>{file.subtitle_languages || '—'}</p>
                  </div>
                 </div>
                 {movie.files.length > 1 && (
                  <div className="mt-2 flex justify-end">
                   <button
                    onClick={(e) => {
                     e.stopPropagation();
                     setDeleteConfirm({ type: 'movie', id: file.id, movieId: movie.id, title: `${movie.title} - ${file.relative_path}` });
                    }}
                    className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                   >
                    Delete this file
                   </button>
                  </div>
                 )}
                </td>
               </tr>
              ))}
             </>
            ))}
            {movieResults.length === 0 && (
             <tr>
              <td colSpan={9} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
               No movies found matching filters
              </td>
             </tr>
            )}
           </tbody>
          </table></div>
          {movieResults.length > 0 && (
           <div className="px-4 py-2 border-t text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
            Found {movieResults.length} movies
           </div>
          )}
         </div>
        )}

        {/* Episodes Results */}
        {activeTab === 'episodes' && (
         <div className="overflow-x-auto">
          <div className="table-responsive">
          <table className="w-full text-sm">
           <thead>
            <tr style={{ backgroundColor: 'var(--surface-bg)' }}>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>
              <button onClick={() => handleSort('title')} className="flex items-center hover:text-gray-900">
               Episode <SortIcon field="title" />
              </button>
             </th>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>
              <button onClick={() => handleSort('file_size')} className="flex items-center hover:text-gray-900">
               Size <SortIcon field="file_size" />
              </button>
             </th>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>
              <button onClick={() => handleSort('quality')} className="flex items-center hover:text-gray-900">
               Quality <SortIcon field="quality" />
              </button>
             </th>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Video</th>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>Audio</th>
             <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>File</th>
             <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>Actions</th>
            </tr>
           </thead>
           <tbody>
            {episodeResults.map(ep => (
             <tr key={ep.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50" style={{ borderColor: 'var(--border-color)' }}>
              <td className="px-4 py-3">
               <div className="flex items-center gap-3">
                {ep.poster_path ? (
                 <img src={getCachedImageUrl(ep.poster_path, 'w92') || ''} alt="" className="w-8 h-12 object-cover rounded" />
                ) : (
                 <div className="w-8 h-12 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400">?</div>
                )}
                <div>
                 <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{ep.series_title}</p>
                 <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  S{String(ep.season_number).padStart(2, '0')}E{String(ep.episode_number).padStart(2, '0')} - {ep.episode_title}
                 </p>
                </div>
               </div>
              </td>
              <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>{formatSize(ep.file_size)}</td>
              <td className="px-4 py-3">
               {ep.quality ? (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                 {ep.quality}
                </span>
               ) : '—'}
              </td>
              <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{ep.video_codec || '—'}</td>
              <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{ep.audio_codec || '—'}</td>
              <td className="px-4 py-3 text-xs truncate max-w-xs" style={{ color: 'var(--text-muted)' }}>{ep.file_path || '—'}</td>
              <td className="px-4 py-3 text-center">
               <div className="flex items-center justify-center gap-1">
                <button
                 onClick={() => navigate(`/series/${ep.series_id}`)}
                 className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                 title="View series"
                >
                 <svg className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                 </svg>
                </button>
                <button
                 onClick={() => setDeleteConfirm({ type: 'episode', id: ep.id, title: `${ep.series_title} S${ep.season_number}E${ep.episode_number}` })}
                 className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                 title="Delete file"
                >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                 </svg>
                </button>
               </div>
              </td>
             </tr>
            ))}
            {episodeResults.length === 0 && (
             <tr>
              <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
               No episodes found matching filters
              </td>
             </tr>
            )}
           </tbody>
          </table></div>
          {episodeResults.length > 0 && (
           <div className="px-4 py-2 border-t text-sm" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
            Found {episodeResults.length} episodes
           </div>
          )}
         </div>
        )}
       </>
      )}
     </div>
    )}

    {/* Initial State - No search yet */}
    {!hasSearched && !loadingFilters && (
     <div className="rounded-lg p-12 text-center" style={{ backgroundColor: 'var(--card-bg)' }}>
      <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Search Your Library</h3>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
       Use the filters above to search for movies and episodes by quality, codec, size, and more.
      </p>
     </div>
    )}
   </div>

   {/* Delete Confirmation Modal */}
   {deleteConfirm && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
     <div className="rounded-lg p-6 max-w-md w-full mx-4 shadow-xl" style={{ backgroundColor: 'var(--card-bg)' }}>
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Delete File</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
       Are you sure you want to delete the file for <strong>{deleteConfirm.title}</strong>? This will permanently remove the file from disk.
      </p>
      <div className="flex justify-end gap-3">
       <button
        onClick={() => setDeleteConfirm(null)}
        className="px-4 py-2 text-sm rounded-lg"
        style={{ backgroundColor: 'var(--surface-bg)', color: 'var(--text-secondary)' }}
       >
        Cancel
       </button>
       <button
        onClick={handleDeleteFile}
        className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
       >
        Delete
       </button>
      </div>
     </div>
    </div>
   )}
  </Layout>
 );
}
