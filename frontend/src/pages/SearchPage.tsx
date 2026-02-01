import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { api } from '../services/api';

export function SearchPage() {
 const [query, setQuery] = useState('');
 const [results, setResults] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [category, setCategory] = useState<'movie' | 'tv'>('movie');
 
 const [libraryMovies, setLibraryMovies] = useState<Set<number>>(new Set());
 const [librarySeries, setLibrarySeries] = useState<Set<number>>(new Set());
 const [addingId, setAddingId] = useState<number | null>(null);
 const [qualityProfiles, setQualityProfiles] = useState<any[]>([]);

 const loadLibrary = async () => {
  try {
   const [movies, series, profiles] = await Promise.all([
    api.getMovies(),
    api.getSeries(),
    api.getQualityProfiles()
   ]);
   setLibraryMovies(new Set(movies.items.map((m: any) => m.tmdb_id)));
   setLibrarySeries(new Set(series.items.map((s: any) => s.tmdb_id)));
   setQualityProfiles(profiles);
  } catch (error) {
   console.error('Failed to load library:', error);
  }
 };

 const handleSearch = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!query.trim()) return;

  setLoading(true);
  try {
   await loadLibrary();
   const data = category === 'movie'
    ? await api.searchMovies(query)
    : await api.searchTV(query);
   setResults(data.results || []);
  } catch (error) {
   console.error('Search failed:', error);
   alert('Search failed');
  } finally {
   setLoading(false);
  }
 };

 const sanitizeTitle = (title: string) => {
  return title.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
 };

 const handleAddMovie = async (movie: any) => {
  setAddingId(movie.id);
  try {
   const defaultProfile = qualityProfiles[0];
   await api.addMovie({
    tmdb_id: movie.id,
    title: movie.title,
    year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
    overview: movie.overview,
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    folder_path: `/data/movies/${sanitizeTitle(movie.title)}`,
    quality_profile_id: defaultProfile?.id,
    monitored: true
   });
   setLibraryMovies(prev => new Set([...prev, movie.id]));
   alert(`${movie.title} added to your library!`);
  } catch (error: any) {
   if (error.response?.status === 409) {
    setLibraryMovies(prev => new Set([...prev, movie.id]));
   } else {
    alert(`Failed to add: ${error.response?.data?.error || error.message}`);
   }
  } finally {
   setAddingId(null);
  }
 };

 const handleAddSeries = async (show: any) => {
  setAddingId(show.id);
  try {
   const defaultProfile = qualityProfiles[0];
   await api.addSeries({
    tmdb_id: show.id,
    title: show.name,
    year: show.first_air_date ? new Date(show.first_air_date).getFullYear() : null,
    overview: show.overview,
    network: null,
    poster_path: show.poster_path,
    backdrop_path: show.backdrop_path,
    folder_path: `/data/tv/${sanitizeTitle(show.name)}`,
    quality_profile_id: defaultProfile?.id,
    monitored: true
   });
   setLibrarySeries(prev => new Set([...prev, show.id]));
   alert(`${show.name} added to your library!`);
  } catch (error: any) {
   if (error.response?.status === 409) {
    setLibrarySeries(prev => new Set([...prev, show.id]));
   } else {
    alert(`Failed to add: ${error.response?.data?.error || error.message}`);
   }
  } finally {
   setAddingId(null);
  }
 };

 return (
  <Layout>
   <div className="space-y-6">
    <div>
     <h1 className="text-3xl font-bold text-gray-900">Search</h1>
     <p className="mt-2 text-gray-600">Find movies and TV shows to add</p>
    </div>

    <form onSubmit={handleSearch} className="space-y-4">
     <div className="flex gap-2 mb-4">
      <button
       type="button"
       onClick={() => setCategory('movie')}
       className={`px-4 py-2 ${
        category === 'movie'
         ? 'bg-primary-600 text-white'
         : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
       }`}
      >
       Movies
      </button>
      <button
       type="button"
       onClick={() => setCategory('tv')}
       className={`px-4 py-2 ${
        category === 'tv'
         ? 'bg-primary-600 text-white'
         : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
       }`}
      >
       TV Shows
      </button>
     </div>

     <div className="flex gap-2">
      <input
       type="text"
       value={query}
       onChange={(e) => setQuery(e.target.value)}
       placeholder={`Search for ${category === 'movie' ? 'movies' : 'TV shows'}...`}
       className="flex-1 px-4 py-3 border border-gray-300 "
      />
      <button
       type="submit"
       disabled={loading}
       className="px-6 py-3 bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-400"
      >
       {loading ? 'Searching...' : 'Search'}
      </button>
     </div>
    </form>

    {results.length === 0 && !loading && (
     <div className="text-center py-12 bg-white shadow">
      <p className="text-gray-500">
       {query ? 'No results found' : 'Enter a search query to get started'}
      </p>
     </div>
    )}

    {results.length > 0 && (
     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {results.map((item: any) => {
       const inLibrary = category === 'movie' 
        ? libraryMovies.has(item.id)
        : librarySeries.has(item.id);
       const isAdding = addingId === item.id;
       const title = item.title || item.name;
       const date = item.release_date || item.first_air_date;

       return (
        <div key={item.id} className="bg-white shadow hover:shadow-lg transition-shadow overflow-hidden">
         <div className="relative aspect-[2/3]">
          {item.poster_path ? (
           <img
            src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
            alt={title}
            className="w-full h-full object-cover"
           />
          ) : (
           <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400">No Poster</span>
           </div>
          )}
          {inLibrary && (
           <div className="absolute top-2 left-2">
            <span className="px-2 py-1 bg-green-500 text-white text-xs rounded">
             In Library
            </span>
           </div>
          )}
         </div>
         <div className="p-3">
          <h3 className="font-medium text-sm text-gray-900 truncate" title={title}>
           {title}
          </h3>
          <p className="text-xs text-gray-500">
           {date ? new Date(date).getFullYear() : 'TBA'}
          </p>
          <button
           onClick={() => category === 'movie' ? handleAddMovie(item) : handleAddSeries(item)}
           disabled={inLibrary || isAdding}
           className={`mt-2 w-full py-2 rounded text-sm font-medium ${
            inLibrary
             ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
             : isAdding
             ? 'bg-gray-300 text-gray-600 cursor-wait'
             : 'bg-primary-600 text-white hover:bg-primary-700'
           }`}
          >
           {inLibrary ? '✓ In Library' : isAdding ? 'Adding...' : '+ Add'}
          </button>
         </div>
        </div>
       );
      })}
     </div>
    )}
   </div>
  </Layout>
 );
}
