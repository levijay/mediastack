import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { api } from '../services/api';
import { useTimezone } from '../contexts/TimezoneContext';

export function SeriesDetailPage() {
 const { id } = useParams<{ id: string }>();
 const navigate = useNavigate();
 const { formatDate, formatTime } = useTimezone();
 const [series, setSeries] = useState<any>(null);
 const [seasons, setSeasons] = useState<any[]>([]);
 const [episodes, setEpisodes] = useState<any[]>([]);
 const [activityLog, setActivityLog] = useState<any[]>([]);
 const [activityExpanded, setActivityExpanded] = useState(false);
 const [selectedSeason, setSelectedSeason] = useState<number>(1);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
  if (id) {
   loadData();
   loadActivityLog();
  }
 }, [id]);

 useEffect(() => {
  if (id) {
   loadEpisodes(selectedSeason);
  }
 }, [selectedSeason, id]);

 const loadData = async () => {
  try {
   const [seriesData, seasonsData] = await Promise.all([
    api.getSeriesById(id!),
    api.getSeasons(id!)
   ]);
   setSeries(seriesData);
   setSeasons(seasonsData);
   
   if (seasonsData.length > 0) {
    setSelectedSeason(seasonsData[0].season_number);
   }
  } catch (error) {
   console.error('Failed to load series:', error);
  } finally {
   setLoading(false);
  }
 };

 const loadEpisodes = async (seasonNum: number) => {
  try {
   const data = await api.getEpisodes(id!, seasonNum);
   setEpisodes(data);
  } catch (error) {
   console.error('Failed to load episodes:', error);
  }
 };

 const loadActivityLog = async () => {
  try {
   const data = await api.getSeriesActivity(id!, 20);
   setActivityLog(data);
  } catch (error) {
   console.error('Failed to load activity log:', error);
  }
 };

 const toggleSeriesMonitored = async () => {
  try {
   await api.updateSeries(id!, { monitored: !series.monitored });
   loadData();
  } catch (error) {
   console.error('Failed to update series:', error);
  }
 };

 const toggleSeasonMonitored = async (seasonNum: number, monitored: boolean) => {
  try {
   await api.updateSeason(id!, seasonNum, { monitored: !monitored });
   loadData();
   loadEpisodes(selectedSeason);
  } catch (error) {
   console.error('Failed to update season:', error);
  }
 };

 const toggleEpisodeMonitored = async (episode: any) => {
  try {
   await api.updateEpisode(episode.id, { monitored: !episode.monitored });
   loadEpisodes(selectedSeason);
  } catch (error) {
   console.error('Failed to update episode:', error);
  }
 };

 if (loading) {
  return (
   <Layout>
    <div className="text-center py-12" style={{ color: 'var(--theme-text-muted)' }}>Loading...</div>
   </Layout>
  );
 }

 if (!series) {
  return (
   <Layout>
    <div className="text-center py-12">Series not found</div>
   </Layout>
  );
 }

 const currentSeason = seasons.find(s => s.season_number === selectedSeason);

 return (
  <Layout>
   <div className="space-y-6">
    {/* Header */}
    <div className="flex gap-6">
     <div className="flex-shrink-0">
      {series.poster_path ? (
       <img
        src={`https://image.tmdb.org/t/p/w500${series.poster_path}`}
        alt={series.title}
        className="w-48 shadow-lg"
       />
      ) : (
       <div className="w-48 h-72 bg-gray-200 flex items-center justify-center">
        <span className="text-gray-400">No Poster</span>
       </div>
      )}
     </div>

     <div className="flex-1">
      <div className="flex justify-between items-start">
       <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{series.title}</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
         {series.year} • {series.network} • {series.status}
        </p>
       </div>
       <button
        onClick={() => navigate('/series')}
        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
       >
        ← Back to Series
       </button>
      </div>

      {series.overview && (
       <p className="mt-4 text-gray-700 dark:text-gray-300">{series.overview}</p>
      )}

      <div className="mt-6 flex gap-3">
       <button
        onClick={toggleSeriesMonitored}
        className={`px-4 py-2 ${
         series.monitored
          ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
          : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
        }`}
       >
        {series.monitored ? '★ Monitored' : '☆ Unmonitored'}
       </button>
      </div>
     </div>
    </div>

    {/* Seasons & Episodes */}
    <div className="bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700">
     {/* Season tabs */}
     <div className="border-b border-gray-200 dark:border-gray-700">
      <div className="flex overflow-x-auto">
       {seasons.map((season) => (
        <button
         key={season.id}
         onClick={() => setSelectedSeason(season.season_number)}
         className={`px-6 py-3 font-medium whitespace-nowrap border-b-2 ${
          selectedSeason === season.season_number
           ? 'border-primary-600 text-primary-600'
           : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
         }`}
        >
         Season {season.season_number}
         {!season.monitored && <span className="ml-2 text-xs text-gray-400">(Not Monitored)</span>}
        </button>
       ))}
      </div>
     </div>

     {/* Season actions */}
     {currentSeason && (
      <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
       <button
        onClick={() => toggleSeasonMonitored(currentSeason.season_number, currentSeason.monitored)}
        className="text-sm text-primary-600 hover:text-primary-700"
       >
        {currentSeason.monitored ? 'Unmonitor' : 'Monitor'} Season {selectedSeason}
       </button>
      </div>
     )}

     {/* Episodes list */}
     <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {episodes.length === 0 ? (
       <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        No episodes found for this season
       </div>
      ) : (
       episodes.map((episode) => (
        <div key={episode.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50">
         <div className="flex justify-between items-start">
          <div className="flex-1">
           <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
             E{episode.episode_number}
            </span>
            <h3 className="font-medium text-gray-900 dark:text-white">{episode.title}</h3>
            {episode.has_file && (
             <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs rounded">
              Downloaded
             </span>
            )}
            {!episode.has_file && episode.monitored && (
             <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 text-xs rounded">
              Missing
             </span>
            )}
            {episode.quality && (
             <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs rounded">
              {episode.quality}
             </span>
            )}
           </div>
           {episode.overview && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{episode.overview}</p>
           )}
           <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {episode.air_date ? `Aired: ${formatDate(episode.air_date)}` : 'Air date unknown'}
           </p>
          </div>
          <button
           onClick={() => toggleEpisodeMonitored(episode)}
           className={`ml-4 px-3 py-1 text-sm rounded ${
            episode.monitored
             ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/60'
             : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
           }`}
          >
           {episode.monitored ? 'Monitored' : 'Unmonitored'}
          </button>
         </div>
        </div>
       ))
      )}
     </div>
    </div>

    {/* Activity Log Section - Collapsible */}
    <div className="bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
     <button
      onClick={() => setActivityExpanded(!activityExpanded)}
      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
     >
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Activity</h2>
      <div className="flex items-center gap-2">
       {activityLog.length > 0 && (
        <span className="text-sm text-gray-500 dark:text-gray-400">{activityLog.length} events</span>
       )}
       <svg 
        className={`w-5 h-5 text-gray-500 transition-transform ${activityExpanded ? 'rotate-180' : ''}`} 
        fill="none" viewBox="0 0 24 24" stroke="currentColor"
       >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
       </svg>
      </div>
     </button>
     {activityExpanded && (
      <>
       {activityLog.length > 0 ? (
        <div className="divide-y divide-gray-200 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-700">
         {activityLog.map((log) => {
          // Parse details if available
          let details: any = null;
          try {
           if (log.details) details = JSON.parse(log.details);
          } catch (e) {}
          
          // Format date using timezone context
          const formattedDate = formatDate(log.created_at);
          const formattedTime = formatTime(log.created_at);

          // Icon based on event type
          let icon = null;
          let iconBgColor = 'bg-gray-100 dark:bg-gray-700';
          if (log.event_type === 'grabbed') {
           iconBgColor = 'bg-blue-100 dark:bg-blue-900/40';
           icon = <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
          } else if (log.event_type === 'downloaded') {
           iconBgColor = 'bg-yellow-100 dark:bg-yellow-900/40';
           icon = <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
          } else if (log.event_type === 'imported') {
           iconBgColor = 'bg-green-100 dark:bg-green-900/40';
           icon = <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
          } else if (log.event_type === 'added') {
           iconBgColor = 'bg-purple-100 dark:bg-purple-900/40';
           icon = <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;
          } else if (log.event_type === 'renamed') {
           iconBgColor = 'bg-orange-100 dark:bg-orange-900/40';
           icon = <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
          } else {
           icon = <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
          }

          return (
           <div key={log.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
            <div className="flex items-start gap-4">
             <div className={`flex-shrink-0 w-8 h-8 rounded-full ${iconBgColor} flex items-center justify-center`}>
              {icon}
             </div>
             <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
               <p className="text-sm font-medium text-gray-900 dark:text-white">
                {log.event_label}
               </p>
               <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {formattedDate} at {formattedTime}
               </p>
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
               {log.message}
              </p>
              {details && (
               <div className="mt-2 flex flex-wrap gap-2">
                {details.source && (
                 <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded">
                  {details.source}
                 </span>
                )}
                {details.quality && (
                 <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">
                  {details.quality}
                 </span>
                )}
                {details.size && (
                 <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                  {details.size}
                 </span>
                )}
                {details.indexer && (
                 <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded">
                  {details.indexer}
                 </span>
                )}
                {details.releaseGroup && (
                 <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                  {details.releaseGroup}
                 </span>
                )}
                {details.season !== undefined && (
                 <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                  S{String(details.season).padStart(2, '0')}{details.episode !== undefined ? `E${String(details.episode).padStart(2, '0')}` : ''}
                 </span>
                )}
               </div>
              )}
             </div>
            </div>
           </div>
          );
         })}
        </div>
       ) : (
        <div className="px-6 py-12 text-center border-t border-gray-200 dark:border-gray-700">
         <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
         </svg>
         <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">No activity yet</h3>
         <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Activity will appear here when you search, download, or import files.</p>
        </div>
       )}
      </>
     )}
    </div>
   </div>
  </Layout>
 );
}
