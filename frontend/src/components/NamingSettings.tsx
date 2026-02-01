import { useState } from 'react';
import { Input } from './common/Input';
import { Button } from './common/Button';

interface NamingConfig {
 rename_movies: boolean;
 rename_episodes: boolean;
 replace_illegal_characters: boolean;
 colon_replacement: string;
 standard_movie_format: string;
 movie_folder_format: string;
 standard_episode_format: string;
 daily_episode_format: string;
 anime_episode_format: string;
 series_folder_format: string;
 season_folder_format: string;
 specials_folder_format: string;
 multi_episode_style: string;
}

interface NamingSettingsProps {
 config: NamingConfig;
 onChange: (config: NamingConfig) => void;
 onSave: () => void;
 moviePreview?: string;
 episodePreview?: string;
}

// Token definitions for Movies
const movieTokens = {
 'File Names': [
  { token: '{Movie Title} ({Release Year}) - {Edition Tags }{[Custom Formats]}{[Quality Full]}{-Release Group}', example: 'The Movie - Title (2010) - Ultimate Extended Edition [Surround Sound x264][Bluray-1080p Proper]-EVOLVE' },
  { token: '{Movie CleanTitle} {Release Year} - {Edition Tags }{[Custom Formats]}{[Quality Full]}{-Release Group}', example: 'The Movie Title 2010 - Ultimate Extended Edition [Surround Sound x264][Bluray-1080p Proper]-EVOLVE' },
  { token: '{Movie.CleanTitle}.{Release.Year}.{Edition.Tags}.{Custom.Formats}.{Quality.Full}{-Release Group}', example: 'The.Movie.Title.2010.Ultimate.Extended.Edition.Surround.Sound.x264.Bluray-1080p.Proper-EVOLVE' },
 ],
 'Movie': [
  { token: '{Movie Title}', example: "Movie's Title" },
  { token: '{Movie CleanTitle}', example: 'Movies Title' },
  { token: '{Movie TitleThe}', example: "Movie's Title, The" },
  { token: '{Movie OriginalTitle}', example: 'Τίτλος ταινίας' },
  { token: '{Movie TitleFirstCharacter}', example: 'M' },
  { token: '{Movie Collection}', example: 'The Movie Collection' },
  { token: '{Movie CleanCollectionThe}', example: 'Movies Collection, The' },
  { token: '{Release Year}', example: '2009' },
  { token: '{Movie Certification}', example: 'R' },
 ],
 'Movie ID': [
  { token: '{ImdbId}', example: 'tt12345' },
  { token: '{TmdbId}', example: '123456' },
 ],
 'Quality': [
  { token: '{Quality Full}', example: 'HDTV-720p Proper' },
  { token: '{Quality Title}', example: 'HDTV-720p' },
 ],
 'Media Info': [
  { token: '{MediaInfo Simple}', example: 'x264 DTS' },
  { token: '{MediaInfo Full}', example: 'x264 DTS [EN+DE]' },
  { token: '{MediaInfo AudioCodec}', example: 'DTS' },
  { token: '{MediaInfo AudioChannels}', example: '5.1' },
  { token: '{MediaInfo AudioLanguages}', example: '[EN+DE]' },
  { token: '{MediaInfo SubtitleLanguages}', example: '[DE]' },
  { token: '{MediaInfo VideoCodec}', example: 'x264' },
  { token: '{MediaInfo VideoBitDepth}', example: '10' },
  { token: '{MediaInfo VideoDynamicRange}', example: 'HDR' },
  { token: '{MediaInfo VideoDynamicRangeType}', example: 'DV HDR10' },
 ],
 'Release Group': [
  { token: '{Release Group}', example: 'Rls Grp' },
 ],
 'Edition': [
  { token: '{Edition Tags}', example: 'IMAX' },
 ],
 'Custom Formats': [
  { token: '{Custom Formats}', example: 'Surround Sound x264' },
 ],
};

// Token definitions for Series/Episodes
const episodeTokens = {
 'File Names': [
  { token: '{Series TitleYear} - S{season:00}E{episode:00} - {Episode CleanTitle} {Quality Full}', example: "The Series Title's! (2010) - S01E01 - Episode Title WEBDL-1080p Proper" },
  { token: '{Series TitleYear} - {season:0}x{episode:00} - {Episode CleanTitle} {Quality Full}', example: "The Series Title's! (2010) - 1x01 - Episode Title WEBDL-1080p Proper" },
  { token: '{Series.CleanTitleYear}.S{season:00}E{episode:00}.{Episode.CleanTitle}.{Quality.Full}', example: 'The.Series.Titles!.2010.S01E01.Episode.Title.WEBDL-1080p.Proper' },
 ],
 'Series': [
  { token: '{Series Title}', example: "The Series Title's!" },
  { token: '{Series CleanTitle}', example: "The Series Title's!" },
  { token: '{Series TitleYear}', example: "The Series Title's! (2010)" },
  { token: '{Series CleanTitleYear}', example: "The Series Title's! 2010" },
  { token: '{Series TitleWithoutYear}', example: "The Series Title's!" },
  { token: '{Series CleanTitleWithoutYear}', example: "The Series Title's!" },
  { token: '{Series TitleThe}', example: "Series Title's!, The" },
  { token: '{Series CleanTitleThe}', example: "Series Title's!, The" },
  { token: '{Series TitleTheYear}', example: "Series Title's!, The (2010)" },
  { token: '{Series CleanTitleTheYear}', example: "Series Title's!, The 2010" },
  { token: '{Series TitleTheWithoutYear}', example: "Series Title's!, The" },
  { token: '{Series CleanTitleTheWithoutYear}', example: "Series Title's!, The" },
  { token: '{Series TitleFirstCharacter}', example: 'S' },
  { token: '{Series Year}', example: '2010' },
 ],
 'Series ID': [
  { token: '{ImdbId}', example: 'tt12345' },
  { token: '{TmdbId}', example: '11223' },
  { token: '{TvdbId}', example: '12345' },
  { token: '{TvMazeId}', example: '54321' },
 ],
 'Season': [
  { token: '{season:0}', example: '1' },
  { token: '{season:00}', example: '01' },
 ],
 'Episode': [
  { token: '{episode:0}', example: '1' },
  { token: '{episode:00}', example: '01' },
 ],
 'Air Date': [
  { token: '{Air-Date}', example: '2016-03-20' },
  { token: '{Air Date}', example: '2016 03 20' },
 ],
 'Episode Title': [
  { token: '{Episode Title}', example: "Episode's Title" },
  { token: '{Episode CleanTitle}', example: 'Episodes Title' },
 ],
 'Quality': [
  { token: '{Quality Full}', example: 'WEBDL-1080p Proper' },
  { token: '{Quality Title}', example: 'WEBDL-1080p' },
 ],
 'Media Info': [
  { token: '{MediaInfo Simple}', example: 'x264 DTS' },
  { token: '{MediaInfo Full}', example: 'x264 DTS [EN+DE]' },
  { token: '{MediaInfo AudioCodec}', example: 'DTS' },
  { token: '{MediaInfo AudioChannels}', example: '5.1' },
  { token: '{MediaInfo AudioLanguages}', example: '[EN+DE]' },
  { token: '{MediaInfo SubtitleLanguages}', example: '[DE]' },
  { token: '{MediaInfo VideoCodec}', example: 'x264' },
  { token: '{MediaInfo VideoBitDepth}', example: '10' },
  { token: '{MediaInfo VideoDynamicRange}', example: 'HDR' },
  { token: '{MediaInfo VideoDynamicRangeType}', example: 'DV HDR10' },
 ],
 'Release Group': [
  { token: '{Release Group}', example: 'Rls Grp' },
 ],
 'Original Title': [
  { token: '{Original Title}', example: 'Τίτλος επεισοδίου' },
 ],
};

// Folder token definitions for Movies
const movieFolderTokens = {
 'Movie': [
  { token: '{Movie Title}', example: "Movie's Title" },
  { token: '{Movie CleanTitle}', example: 'Movies Title' },
  { token: '{Movie TitleThe}', example: "Movie's Title, The" },
  { token: '{Movie TitleFirstCharacter}', example: 'M' },
  { token: '{Release Year}', example: '2009' },
 ],
 'Movie ID': [
  { token: '{ImdbId}', example: 'tt12345' },
  { token: '{TmdbId}', example: '123456' },
 ],
};

// Folder token definitions for Series
const seriesFolderTokens = {
 'Series': [
  { token: '{Series Title}', example: "The Series Title's!" },
  { token: '{Series CleanTitle}', example: "The Series Title's!" },
  { token: '{Series TitleYear}', example: "The Series Title's! (2010)" },
  { token: '{Series CleanTitleYear}', example: "The Series Title's! 2010" },
  { token: '{Series TitleThe}', example: "Series Title's!, The" },
  { token: '{Series TitleFirstCharacter}', example: 'S' },
  { token: '{Series Year}', example: '2010' },
 ],
 'Series ID': [
  { token: '{ImdbId}', example: 'tt12345' },
  { token: '{TmdbId}', example: '11223' },
  { token: '{TvdbId}', example: '12345' },
 ],
 'Season': [
  { token: '{season:0}', example: '1' },
  { token: '{season:00}', example: '01' },
 ],
};

function TokenModal({ 
 isOpen, 
 onClose, 
 title, 
 tokens 
}: { 
 isOpen: boolean; 
 onClose: () => void; 
 title: string; 
 tokens: Record<string, { token: string; example: string }[]> 
}) {
 const [separator, setSeparator] = useState('Space ( )');
 const [caseStyle, setCaseStyle] = useState('Default Case');

 if (!isOpen) return null;

 return (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
   <div className="bg-white dark:bg-gray-800 shadow-xl max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col">
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
     <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
     <button
      onClick={onClose}
      className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
     >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
     </button>
    </div>

    {/* Controls */}
    <div className="flex justify-end gap-4 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
     <select
      value={separator}
      onChange={(e) => setSeparator(e.target.value)}
      className="px-3 py-1.5 text-sm border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
     >
      <option>Space ( )</option>
      <option>Period (.)</option>
      <option>Underscore (_)</option>
      <option>Dash (-)</option>
     </select>
     <select
      value={caseStyle}
      onChange={(e) => setCaseStyle(e.target.value)}
      className="px-3 py-1.5 text-sm border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
     >
      <option>Default Case</option>
      <option>Lowercase</option>
      <option>Uppercase</option>
      <option>Title Case</option>
     </select>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
     {Object.entries(tokens).map(([section, items]) => (
      <div key={section}>
       <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{section}</h3>
       <div className="grid grid-cols-2 gap-2">
        {items.map(({ token, example }) => (
         <div key={token} className="flex">
          <div className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600">
           <code className="text-sm font-mono text-gray-800 dark:text-gray-200">{token}</code>
          </div>
          <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900">
           <span className="text-sm text-gray-600 dark:text-gray-400">{example}</span>
          </div>
         </div>
        ))}
       </div>
      </div>
     ))}
     
     <p className="text-sm text-gray-500 dark:text-gray-400 italic">
      * Optionally control truncation to a maximum number of bytes including ellipsis (...). 
      Truncating from the end (e.g. {'{Movie Title:30}'}) or the beginning (e.g. {'{Movie Title:-30}'}) are both supported.
     </p>
    </div>

    {/* Footer */}
    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
     <Button variant="secondary" onClick={onClose}>Close</Button>
    </div>
   </div>
  </div>
 );
}

export function NamingSettings({ config, onChange, onSave, moviePreview, episodePreview }: NamingSettingsProps) {
 const [activeTab, setActiveTab] = useState<'movies' | 'episodes'>('movies');
 const [showTokenModal, setShowTokenModal] = useState<'movieFile' | 'movieFolder' | 'episodeFile' | 'seriesFolder' | null>(null);

 return (
  <div>
   {/* Tab Navigation */}
   <div className="border-b border-gray-200 dark:border-gray-700">
    <div className="flex">
     <button
      onClick={() => setActiveTab('movies')}
      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
       activeTab === 'movies'
        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
     >
      Movie Naming
     </button>
     <button
      onClick={() => setActiveTab('episodes')}
      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
       activeTab === 'episodes'
        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
     >
      Episode Naming
     </button>
    </div>
   </div>

   {/* Tab Content with Padding */}
   <div className="p-6 space-y-6">
   {/* Movies Tab */}
   {activeTab === 'movies' && (
    <div className="space-y-6">
     {/* Movie Naming Toggle */}
     <div className="flex items-center justify-between">
      <div>
       <h3 className="font-medium text-gray-900 dark:text-white">Rename Movies</h3>
       <p className="text-sm text-gray-500 dark:text-gray-400">Automatically rename movie files when importing</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
       <input
        type="checkbox"
        checked={config.rename_movies}
        onChange={(e) => onChange({ ...config, rename_movies: e.target.checked })}
        className="sr-only peer"
       />
       <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
      </label>
     </div>

     {/* Standard Movie Format */}
     <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Standard Movie Format</label>
       <button
        onClick={() => setShowTokenModal('movieFile')}
        className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
       >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        View Tokens
       </button>
      </div>
      <Input
       type="text"
       value={config.standard_movie_format}
       onChange={(e) => onChange({ ...config, standard_movie_format: e.target.value })}
       className="font-mono text-sm dark:bg-gray-800"
       disabled={!config.rename_movies}
      />
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded font-mono">
       {moviePreview || 'The Movie Title (2024) [Bluray-1080p].mkv'}
      </p>
     </div>

     {/* Movie Folder Format */}
     <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Movie Folder Format</label>
       <button
        onClick={() => setShowTokenModal('movieFolder')}
        className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
       >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        View Tokens
       </button>
      </div>
      <Input
       type="text"
       value={config.movie_folder_format}
       onChange={(e) => onChange({ ...config, movie_folder_format: e.target.value })}
       className="font-mono text-sm dark:bg-gray-800"
      />
     </div>
    </div>
   )}

   {/* Episodes Tab */}
   {activeTab === 'episodes' && (
    <div className="space-y-6">
     {/* Episode Naming Toggle */}
     <div className="flex items-center justify-between">
      <div>
       <h3 className="font-medium text-gray-900 dark:text-white">Rename Episodes</h3>
       <p className="text-sm text-gray-500 dark:text-gray-400">Automatically rename episode files when importing</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
       <input
        type="checkbox"
        checked={config.rename_episodes}
        onChange={(e) => onChange({ ...config, rename_episodes: e.target.checked })}
        className="sr-only peer"
       />
       <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
      </label>
     </div>

     {/* Standard Episode Format */}
     <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Standard Episode Format</label>
       <button
        onClick={() => setShowTokenModal('episodeFile')}
        className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
       >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        View Tokens
       </button>
      </div>
      <Input
       type="text"
       value={config.standard_episode_format}
       onChange={(e) => onChange({ ...config, standard_episode_format: e.target.value })}
       className="font-mono text-sm dark:bg-gray-800"
       disabled={!config.rename_episodes}
      />
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded font-mono">
       {episodePreview || 'The Series Title - S01E01 - Episode Title [WEBDL-1080p].mkv'}
      </p>
     </div>

     {/* Daily Episode Format */}
     <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Daily Episode Format</label>
      <Input
       type="text"
       value={config.daily_episode_format}
       onChange={(e) => onChange({ ...config, daily_episode_format: e.target.value })}
       className="font-mono text-sm dark:bg-gray-800"
       disabled={!config.rename_episodes}
      />
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">For daily shows that air by date</p>
     </div>

     {/* Anime Episode Format */}
     <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Anime Episode Format</label>
      <Input
       type="text"
       value={config.anime_episode_format}
       onChange={(e) => onChange({ ...config, anime_episode_format: e.target.value })}
       className="font-mono text-sm dark:bg-gray-800"
       disabled={!config.rename_episodes}
      />
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">For anime with absolute episode numbers</p>
     </div>

     {/* Series Folder Format */}
     <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
       <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Series Folder Format</label>
       <button
        onClick={() => setShowTokenModal('seriesFolder')}
        className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
       >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        View Tokens
       </button>
      </div>
      <Input
       type="text"
       value={config.series_folder_format}
       onChange={(e) => onChange({ ...config, series_folder_format: e.target.value })}
       className="font-mono text-sm dark:bg-gray-800"
      />
     </div>

     {/* Season Folder Format */}
     <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Season Folder Format</label>
      <Input
       type="text"
       value={config.season_folder_format}
       onChange={(e) => onChange({ ...config, season_folder_format: e.target.value })}
       className="font-mono text-sm dark:bg-gray-800"
      />
     </div>

     {/* Multi-Episode Style */}
     <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Multi-Episode Style</label>
      <select
       value={config.multi_episode_style}
       onChange={(e) => onChange({ ...config, multi_episode_style: e.target.value })}
       className="w-full px-3 py-2 border dark:bg-gray-800 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
      >
       <option value="extend">Extend (S01E01-02-03)</option>
       <option value="duplicate">Duplicate (S01E01, S01E02, S01E03)</option>
       <option value="prefixed_range">Prefixed Range (S01E01-E03)</option>
       <option value="range">Range (S01E01-03)</option>
       <option value="scene">Scene (S01E01E02E03)</option>
      </select>
     </div>
    </div>
   )}

   {/* Character Replacement (Common) */}
   <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
    <h3 className="font-medium text-gray-900 dark:text-white mb-4">Character Replacement</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
     <label className="flex items-center gap-3">
      <input
       type="checkbox"
       checked={config.replace_illegal_characters}
       onChange={(e) => onChange({ ...config, replace_illegal_characters: e.target.checked })}
       className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600"
      />
      <div>
       <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Replace Illegal Characters</span>
       <p className="text-xs text-gray-500 dark:text-gray-400">Remove characters not allowed in file names</p>
      </div>
     </label>
     <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Colon Replacement</label>
      <select
       value={config.colon_replacement}
       onChange={(e) => onChange({ ...config, colon_replacement: e.target.value })}
       className="w-full px-3 py-2 border dark:bg-gray-800 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
      >
       <option value=" - ">Space Dash Space ( - )</option>
       <option value=" ">Space</option>
       <option value="-">Dash (-)</option>
       <option value="">Delete</option>
      </select>
     </div>
    </div>
   </div>

   {/* Save Button */}
   <div className="flex justify-end">
    <Button onClick={onSave}>Save Naming Configuration</Button>
   </div>
   </div>

   {/* Token Modals */}
   <TokenModal
    isOpen={showTokenModal === 'movieFile'}
    onClose={() => setShowTokenModal(null)}
    title="File Name Tokens - Movies"
    tokens={movieTokens}
   />
   <TokenModal
    isOpen={showTokenModal === 'movieFolder'}
    onClose={() => setShowTokenModal(null)}
    title="Folder Name Tokens - Movies"
    tokens={movieFolderTokens}
   />
   <TokenModal
    isOpen={showTokenModal === 'episodeFile'}
    onClose={() => setShowTokenModal(null)}
    title="File Name Tokens - Episodes"
    tokens={episodeTokens}
   />
   <TokenModal
    isOpen={showTokenModal === 'seriesFolder'}
    onClose={() => setShowTokenModal(null)}
    title="Folder Name Tokens - Series"
    tokens={seriesFolderTokens}
   />
  </div>
 );
}
