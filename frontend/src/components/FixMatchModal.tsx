import { useState } from 'react';
import { api } from '../services/api';
import { Button } from './common/Button';
import { Input } from './common/Input';

interface Movie {
 id: string;
 tmdb_id: number;
 title: string;
 year: number;
 poster_path?: string;
}

interface SearchResult {
 id: number;
 title: string;
 year: number;
 overview?: string;
 poster_path?: string;
 release_date?: string;
}

interface Props {
 movie: Movie;
 onClose: () => void;
 onSave: () => void;
}

export function FixMatchModal({ movie, onClose, onSave }: Props) {
 const [searchQuery, setSearchQuery] = useState(movie.title);
 const [searchYear, setSearchYear] = useState(movie.year?.toString() || '');
 const [searching, setSearching] = useState(false);
 const [results, setResults] = useState<SearchResult[]>([]);
 const [selectedMatch, setSelectedMatch] = useState<SearchResult | null>(null);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);

 // Check if query looks like a TMDB ID
 const isTmdbId = /^\d+$/.test(searchQuery.trim());

 const handleSearch = async () => {
  if (!searchQuery.trim()) return;
  
  setSearching(true);
  setError(null);
  try {
   // If it's a TMDB ID, don't use year filter
   const yearParam = isTmdbId ? undefined : (searchYear ? parseInt(searchYear) : undefined);
   const data = await api.searchMovies(searchQuery.trim(), yearParam);
   setResults(data.results || []);
   if (data.results?.length === 0) {
    setError(isTmdbId 
     ? 'No movie found with that TMDB ID.' 
     : 'No results found. Try different search terms or enter a TMDB ID.');
   }
  } catch (err) {
   console.error('Search failed:', err);
   setError('Search failed. Please try again.');
  } finally {
   setSearching(false);
  }
 };

 const handleSave = async () => {
  if (!selectedMatch) return;
  
  setSaving(true);
  setError(null);
  try {
   // Update the movie with new TMDB ID and metadata
   await api.fixMovieMatch(movie.id, selectedMatch.id);
   onSave();
  } catch (err) {
   console.error('Failed to fix match:', err);
   setError('Failed to update match. Please try again.');
  } finally {
   setSaving(false);
  }
 };

 const getYear = (result: SearchResult) => {
  if (result.year) return result.year;
  if (result.release_date) return new Date(result.release_date).getFullYear();
  return null;
 };

 return (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
   <div className="bg-white dark:bg-gray-800 shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
    {/* Header */}
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
     <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Fix Match</h2>
     <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
      Currently matched to: <span className="font-medium">{movie.title} ({movie.year})</span> - TMDB ID: {movie.tmdb_id}
     </p>
    </div>

    {/* Search Form */}
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
     <div className="flex gap-3">
      <div className="flex-1">
       <Input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Movie title or TMDB ID..."
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
       />
       {isTmdbId && (
        <p className="text-xs text-blue-500 mt-1">Searching by TMDB ID (year filter ignored)</p>
       )}
      </div>
      <div className="w-24">
       <Input
        value={searchYear}
        onChange={(e) => setSearchYear(e.target.value)}
        placeholder="Year"
        type="number"
        disabled={isTmdbId}
       />
      </div>
      <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
       {searching ? 'Searching...' : 'Search'}
      </Button>
     </div>
    </div>

    {/* Results */}
    <div className="flex-1 overflow-y-auto p-4">
     {error && (
      <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
       {error}
      </div>
     )}

     {results.length > 0 ? (
      <div className="space-y-2">
       {results.map((result) => (
        <div
         key={result.id}
         onClick={() => setSelectedMatch(result)}
         className={`flex gap-4 p-3 cursor-pointer transition-colors ${
          selectedMatch?.id === result.id
           ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
           : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
         }`}
        >
         <div className="w-16 h-24 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden flex-shrink-0">
          {result.poster_path ? (
           <img
            src={`https://image.tmdb.org/t/p/w154${result.poster_path}`}
            alt={result.title}
            className="w-full h-full object-cover"
           />
          ) : (
           <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
           </div>
          )}
         </div>
         <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
           <h3 className="font-medium text-gray-900 dark:text-white">
            {result.title}
            {getYear(result) && (
             <span className="ml-2 text-gray-500 dark:text-gray-400">({getYear(result)})</span>
            )}
           </h3>
           <span className="text-xs text-gray-400 flex-shrink-0">TMDB: {result.id}</span>
          </div>
          {result.overview && (
           <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {result.overview}
           </p>
          )}
          {selectedMatch?.id === result.id && (
           <span className="mt-2 inline-block px-2 py-0.5 bg-primary-500 text-white text-xs rounded">
            Selected
           </span>
          )}
         </div>
        </div>
       ))}
      </div>
     ) : !searching && !error && (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
       <p>Search for the correct movie above</p>
      </div>
     )}
    </div>

    {/* Footer */}
    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
     <Button variant="secondary" onClick={onClose} disabled={saving}>
      Cancel
     </Button>
     <Button onClick={handleSave} disabled={!selectedMatch || saving}>
      {saving ? 'Saving...' : 'Apply Match'}
     </Button>
    </div>
   </div>
  </div>
 );
}
