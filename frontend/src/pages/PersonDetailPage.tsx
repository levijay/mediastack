import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { api } from '../services/api';

interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  also_known_as: string[];
  combined_credits: {
    cast: CreditItem[];
    crew: CreditItem[];
  };
  external_ids: {
    imdb_id?: string;
    instagram_id?: string;
    twitter_id?: string;
  };
}

interface CreditItem {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv';
  character?: string;
  job?: string;
  department?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  episode_count?: number;
}

interface LibraryItem {
  tmdb_id: number;
  id: string;
}

function getImageUrl(path: string | null, size: string = 'w185'): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function calculateAge(birthday: string, deathday?: string | null): number {
  const birth = new Date(birthday);
  const end = deathday ? new Date(deathday) : new Date();
  let age = end.getFullYear() - birth.getFullYear();
  const m = end.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'movies' | 'tv'>('movies');
  const [sortBy, setSortBy] = useState<'date' | 'rating' | 'title'>('date');
  const [libraryMovies, setLibraryMovies] = useState<Map<number, string>>(new Map());
  const [librarySeries, setLibrarySeries] = useState<Map<number, string>>(new Map());
  const [showFullBio, setShowFullBio] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [personData, moviesData, seriesData] = await Promise.all([
          api.getPersonDetails(Number(id)),
          api.getMovies().catch(() => ({ items: [], total: 0 })),
          api.getSeries().catch(() => ({ items: [], total: 0 }))
        ]);
        setPerson(personData);
        
        // Update document title
        if (personData?.name) {
          document.title = `${personData.name} - MediaStack`;
        }
        
        // Build maps of tmdb_id -> library_id
        const movieMap = new Map<number, string>();
        (moviesData.items || []).forEach((m: LibraryItem) => movieMap.set(m.tmdb_id, m.id));
        setLibraryMovies(movieMap);
        
        const seriesMap = new Map<number, string>();
        (seriesData.items || []).forEach((s: LibraryItem) => seriesMap.set(s.tmdb_id, s.id));
        setLibrarySeries(seriesMap);
      } catch (error) {
        console.error('Failed to fetch person details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    
    // Reset title on unmount
    return () => {
      document.title = 'MediaStack';
    };
  }, [id]);

  // Get unique and sorted credits
  const getCredits = (type: 'movie' | 'tv') => {
    if (!person?.combined_credits) return [];
    
    const credits = person.combined_credits.cast
      .filter(c => c.media_type === type)
      .reduce((acc, credit) => {
        // Dedupe by id, combine characters
        const existing = acc.find(c => c.id === credit.id);
        if (existing) {
          if (credit.character && !existing.character?.includes(credit.character)) {
            existing.character = existing.character 
              ? `${existing.character}, ${credit.character}`
              : credit.character;
          }
        } else {
          acc.push({ ...credit });
        }
        return acc;
      }, [] as CreditItem[]);

    // Sort
    return credits.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = a.release_date || a.first_air_date || '';
        const dateB = b.release_date || b.first_air_date || '';
        return dateB.localeCompare(dateA); // Newest first
      } else if (sortBy === 'rating') {
        return b.vote_average - a.vote_average;
      } else {
        const titleA = a.title || a.name || '';
        const titleB = b.title || b.name || '';
        return titleA.localeCompare(titleB);
      }
    });
  };

  const movieCredits = getCredits('movie');
  const tvCredits = getCredits('tv');

  const handleMediaClick = (credit: CreditItem) => {
    const mediaType = credit.media_type;
    // Check if item is in library
    const libraryId = mediaType === 'movie' 
      ? libraryMovies.get(credit.id)
      : librarySeries.get(credit.id);
    
    if (libraryId) {
      // In library - navigate to library item using library ID
      // Routes are /movies/:id and /series/:id (plural)
      const libraryPath = mediaType === 'movie' ? 'movies' : 'series';
      navigate(`/${libraryPath}/${libraryId}`);
    } else {
      // Not in library - navigate to discover page with TMDB ID
      // Routes are /discover/movie/:id and /discover/tv/:id
      navigate(`/discover/${mediaType}/${credit.id}`);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--primary-color)' }}></div>
        </div>
      </Layout>
    );
  }

  if (!person) {
    return (
      <Layout>
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          Person not found
        </div>
      </Layout>
    );
  }

  const age = person.birthday ? calculateAge(person.birthday, person.deathday) : null;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header with breadcrumb */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            style={{ backgroundColor: 'var(--card-bg)' }}
          >
            <svg className="w-5 h-5" style={{ color: 'var(--text-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {person.name}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{person.known_for_department}</p>
          </div>
        </div>

        {/* Person Details */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {/* Photo */}
          <div className="w-48 md:w-64 shrink-0 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--card-bg)' }}>
              {person.profile_path ? (
                <img
                  src={getImageUrl(person.profile_path, 'w342') || ''}
                  alt={person.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-6xl font-medium" style={{ color: 'var(--text-muted)' }}>
                    {person.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            {/* Personal Info */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4 text-sm">
              {person.birthday && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Born: </span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {formatDate(person.birthday)}
                    {!person.deathday && age !== null && ` (${age} years old)`}
                  </span>
                </div>
              )}
              {person.deathday && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Died: </span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {formatDate(person.deathday)}
                    {age !== null && ` (aged ${age})`}
                  </span>
                </div>
              )}
              {person.place_of_birth && (
                <div className="col-span-2">
                  <span style={{ color: 'var(--text-muted)' }}>Birthplace: </span>
                  <span style={{ color: 'var(--text-primary)' }}>{person.place_of_birth}</span>
                </div>
              )}
            </div>

            {/* Biography */}
            {person.biography && (
              <div className="mb-4">
                <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Biography</h2>
                <p 
                  className={`text-sm leading-relaxed ${!showFullBio && person.biography.length > 500 ? 'line-clamp-4' : ''}`}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {person.biography}
                </p>
                {person.biography.length > 500 && (
                  <button
                    onClick={() => setShowFullBio(!showFullBio)}
                    className="text-sm mt-1"
                    style={{ color: 'var(--primary-color)' }}
                  >
                    {showFullBio ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}

            {/* External Links */}
            <div className="flex gap-3">
              {person.external_ids?.imdb_id && (
                <a
                  href={`https://www.imdb.com/name/${person.external_ids.imdb_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}
                >
                  IMDb
                </a>
              )}
              {person.external_ids?.instagram_id && (
                <a
                  href={`https://www.instagram.com/${person.external_ids.instagram_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}
                >
                  Instagram
                </a>
              )}
              {person.external_ids?.twitter_id && (
                <a
                  href={`https://www.twitter.com/${person.external_ids.twitter_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}
                >
                  Twitter
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Filmography */}
        <div>
          {/* Tabs and Sort */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setTab('movies')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors`}
                style={tab === 'movies' 
                  ? { backgroundColor: 'var(--primary-color)', color: 'white' } 
                  : { backgroundColor: 'var(--card-bg)', color: 'var(--text-secondary)' }}
              >
                Movies ({movieCredits.length})
              </button>
              <button
                onClick={() => setTab('tv')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors`}
                style={tab === 'tv' 
                  ? { backgroundColor: 'var(--primary-color)', color: 'white' } 
                  : { backgroundColor: 'var(--card-bg)', color: 'var(--text-secondary)' }}
              >
                TV Shows ({tvCredits.length})
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'rating' | 'title')}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
            >
              <option value="date">Sort by Date</option>
              <option value="rating">Sort by Rating</option>
              <option value="title">Sort by Title</option>
            </select>
          </div>

          {/* Credits Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {(tab === 'movies' ? movieCredits : tvCredits).map((credit, index) => {
              const isInLibrary = tab === 'movies' 
                ? libraryMovies.has(credit.id)
                : librarySeries.has(credit.id);
              const year = (credit.release_date || credit.first_air_date || '').substring(0, 4);
              
              return (
                <div
                  key={`${credit.id}-${index}`}
                  onClick={() => handleMediaClick(credit)}
                  className="rounded-lg overflow-hidden cursor-pointer hover:ring-2 transition-all relative group"
                  style={{ backgroundColor: 'var(--card-bg)', '--tw-ring-color': 'var(--primary-color)' } as React.CSSProperties}
                >
                  {/* In Library Badge */}
                  {isInLibrary && (
                    <div 
                      className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--primary-color)' }}
                    >
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  
                  <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700 relative">
                    {credit.poster_path ? (
                      <img
                        src={getImageUrl(credit.poster_path, 'w185') || ''}
                        alt={credit.title || credit.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl font-medium" style={{ color: 'var(--text-muted)' }}>
                          {(credit.title || credit.name || '?').charAt(0)}
                        </span>
                      </div>
                    )}
                    
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-medium px-2 text-center">
                        {isInLibrary ? 'View in Library' : 'Add to Library'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-2">
                    <p className="font-medium text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                      {credit.title || credit.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {credit.character || year || '—'}
                    </p>
                    {year && credit.character && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{year}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {((tab === 'movies' && movieCredits.length === 0) || (tab === 'tv' && tvCredits.length === 0)) && (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              No {tab === 'movies' ? 'movie' : 'TV'} credits found
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
