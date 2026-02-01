import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { api } from '../services/api';

interface CastMember {
 id: number;
 name: string;
 character: string;
 profile_path: string | null;
 order: number;
}

interface CrewMember {
 id: number;
 name: string;
 job: string;
 department: string;
 profile_path: string | null;
}

interface Credits {
 cast: CastMember[];
 crew: CrewMember[];
}

function getCachedImageUrl(path: string | null, size: string = 'w185'): string | null {
 if (!path) return null;
 return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function CastCrewPage() {
 const { mediaType, id } = useParams<{ mediaType: string; id: string }>();
 const navigate = useNavigate();
 const location = useLocation();
 const [credits, setCredits] = useState<Credits | null>(null);
 const [loading, setLoading] = useState(true);
 const [mediaTitle, setMediaTitle] = useState('');
 const [tab, setTab] = useState<'cast' | 'crew'>('cast');

 // Check if we should show crew tab by default
 useEffect(() => {
  if (location.state?.showCrew) {
   setTab('crew');
  }
 }, [location.state]);

 useEffect(() => {
  const fetchCredits = async () => {
   if (!mediaType || !id) return;
   setLoading(true);
   try {
    const creditsData = mediaType === 'movie' 
     ? await api.getMovieCredits(Number(id))
     : await api.getTVCredits(Number(id));
    setCredits(creditsData);
    
    // Also get the media title
    const details = mediaType === 'movie'
     ? await api.getMovieDetails(Number(id))
     : await api.getTVDetails(Number(id));
    setMediaTitle(details.title || details.name || 'Unknown');
   } catch (error) {
    console.error('Failed to fetch credits:', error);
   } finally {
    setLoading(false);
   }
  };
  fetchCredits();
 }, [mediaType, id]);

 // Group crew by department
 const crewByDepartment = credits?.crew.reduce((acc, member) => {
  const dept = member.department || 'Other';
  if (!acc[dept]) acc[dept] = [];
  acc[dept].push(member);
  return acc;
 }, {} as Record<string, CrewMember[]>) || {};

 // Sort departments
 const departmentOrder = ['Directing', 'Writing', 'Production', 'Camera', 'Art', 'Sound', 'Editing', 'Costume & Make-Up', 'Visual Effects', 'Crew', 'Other'];
 const sortedDepartments = Object.keys(crewByDepartment).sort((a, b) => {
  const aIndex = departmentOrder.indexOf(a);
  const bIndex = departmentOrder.indexOf(b);
  if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
 });

 return (
  <Layout>
   <div className="max-w-6xl mx-auto">
    {/* Header */}
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
       {tab === 'cast' ? 'Cast' : 'Crew'}
      </h1>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{mediaTitle}</p>
     </div>
    </div>

    {/* Tabs */}
    <div className="flex gap-2 mb-6">
     <button
      onClick={() => setTab('cast')}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
       tab === 'cast' ? '' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
      style={tab === 'cast' ? { backgroundColor: 'var(--navbar-bg)', color: 'var(--navbar-text)' } : { color: 'var(--text-secondary)' }}
     >
      Cast ({credits?.cast.length || 0})
     </button>
     <button
      onClick={() => setTab('crew')}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
       tab === 'crew' ? '' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
      style={tab === 'crew' ? { backgroundColor: 'var(--navbar-bg)', color: 'var(--navbar-text)' } : { color: 'var(--text-secondary)' }}
     >
      Crew ({credits?.crew.length || 0})
     </button>
    </div>

    {loading ? (
     <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--navbar-bg)' }}></div>
     </div>
    ) : (
     <>
      {/* Cast Tab */}
      {tab === 'cast' && (
       <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {credits?.cast.map(member => (
         <div 
          key={`${member.id}-${member.character}`} 
          className="rounded-lg overflow-hidden cursor-pointer hover:ring-2 transition-all"
          style={{ backgroundColor: 'var(--card-bg)', '--tw-ring-color': 'var(--primary-color)' } as React.CSSProperties}
          onClick={() => navigate(`/person/${member.id}`)}
         >
          <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700">
           {member.profile_path ? (
            <img
             src={getCachedImageUrl(member.profile_path, 'w185') || ''}
             alt={member.name}
             className="w-full h-full object-cover"
             loading="lazy"
            />
           ) : (
            <div className="w-full h-full flex items-center justify-center">
             <span className="text-2xl font-medium" style={{ color: 'var(--text-muted)' }}>{member.name.charAt(0)}</span>
            </div>
           )}
          </div>
          <div className="p-2">
           <p className="font-medium text-xs truncate" style={{ color: 'var(--text-primary)' }}>{member.name}</p>
           <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{member.character}</p>
          </div>
         </div>
        ))}
       </div>
      )}

      {/* Crew Tab */}
      {tab === 'crew' && (
       <div className="space-y-6">
        {sortedDepartments.map(department => (
         <div key={department}>
          <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{department}</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
           {crewByDepartment[department].map((member, index) => (
            <div 
             key={`${member.id}-${member.job}-${index}`} 
             className="rounded-lg overflow-hidden cursor-pointer hover:ring-2 transition-all"
             style={{ backgroundColor: 'var(--card-bg)', '--tw-ring-color': 'var(--primary-color)' } as React.CSSProperties}
             onClick={() => navigate(`/person/${member.id}`)}
            >
             <div className="aspect-[2/3] bg-gray-200 dark:bg-gray-700">
              {member.profile_path ? (
               <img
                src={getCachedImageUrl(member.profile_path, 'w185') || ''}
                alt={member.name}
                className="w-full h-full object-cover"
                loading="lazy"
               />
              ) : (
               <div className="w-full h-full flex items-center justify-center">
                <span className="text-2xl font-medium" style={{ color: 'var(--text-muted)' }}>{member.name.charAt(0)}</span>
               </div>
              )}
             </div>
             <div className="p-2">
              <p className="font-medium text-xs truncate" style={{ color: 'var(--text-primary)' }}>{member.name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{member.job}</p>
             </div>
            </div>
           ))}
          </div>
         </div>
        ))}
       </div>
      )}
     </>
    )}
   </div>
  </Layout>
 );
}
