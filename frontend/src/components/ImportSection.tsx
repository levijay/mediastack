import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { Button } from './common/Button';
import { Input } from './common/Input';
import { FolderBrowser } from './FolderBrowser';

interface ParsedFile {
 id: string;
 path: string;
 filename: string;
 parsedTitle: string;
 parsedYear?: number;
 parsedQuality?: string;
 parsedTvdbId?: number;
 size: number;
 match?: {
  id: number;
  title: string;
  year: number;
  poster_path: string | null;
  poster_url?: string; // Full URL for TVDB images
  confidence: number;
  source?: 'tmdb' | 'tvdb';
 };
 alternateMatches?: Array<{
  id: number;
  title: string;
  year: number;
  poster_path: string | null;
 }>;
 status: 'pending' | 'matched' | 'unmatched' | 'importing' | 'imported' | 'error' | 'in_library';
 libraryId?: string;
 selected: boolean;
 error?: string;
}

interface Props {
 onToast: (message: string, type: 'success' | 'error' | 'info') => void;
 initialMediaType?: 'movie' | 'tv';
}

const formatSize = (bytes: number) => {
 const gb = bytes / (1024 * 1024 * 1024);
 if (gb >= 1) return `${gb.toFixed(2)} GB`;
 const mb = bytes / (1024 * 1024);
 return `${mb.toFixed(1)} MB`;
};

// Helper to get poster URL - handles both TMDB paths and TVDB full URLs
const getPosterUrl = (posterPath: string | null | undefined, posterUrl?: string, size: string = 'w185'): string | null => {
 if (posterUrl) return posterUrl; // TVDB full URL
 if (posterPath) {
  // Check if it's already a full URL
  if (posterPath.startsWith('http')) return posterPath;
  // TMDB path
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
 }
 return null;
};

export function ImportSection({ onToast, initialMediaType }: Props) {
 const [scanPath, setScanPath] = useState('');
 const [mediaType, setMediaType] = useState<'movie' | 'tv'>(initialMediaType || 'movie');
 const [scanning, setScanning] = useState(false);
 const [importing, setImporting] = useState(false);
 const [files, setFiles] = useState<ParsedFile[]>([]);
 const [currentPage, setCurrentPage] = useState(0);
 const [showFolderBrowser, setShowFolderBrowser] = useState(false);
 const [libraryItems, setLibraryItems] = useState<Set<number>>(new Set());
 const [showMatchModal, setShowMatchModal] = useState<number | null>(null);
 const [searchQuery, setSearchQuery] = useState('');
 const [searchYear, setSearchYear] = useState('');
 const [searchResults, setSearchResults] = useState<any[]>([]);
 const [searching, setSearching] = useState(false);
 const [selectedMatchResult, setSelectedMatchResult] = useState<any | null>(null);
 const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);
 const [qualityProfiles, setQualityProfiles] = useState<{ id: string; name: string; media_type?: string }[]>([]);
 const [selectedProfileId, setSelectedProfileId] = useState<string>('');
 const [minimumAvailability, setMinimumAvailability] = useState<string>('released');
 const [autoSearchMissing, setAutoSearchMissing] = useState<boolean>(false);
 const [hideInLibrary, setHideInLibrary] = useState<boolean>(true);

 const ITEMS_PER_PAGE = 50;
 const CONFIDENCE_THRESHOLD = 100; // High confidence = 100% match only

 useEffect(() => {
  loadSettings();
  loadQualityProfiles();
  loadImportSettings();
 }, []);

 // Reload quality profiles when media type changes
 useEffect(() => {
  loadQualityProfiles();
 }, [mediaType]);

 const loadQualityProfiles = async () => {
  try {
   const profiles = await api.getQualityProfiles();
   // Filter profiles by media type
   const targetType = mediaType === 'movie' ? 'movie' : 'series';
   const filteredProfiles = profiles.filter((p: any) => 
    !p.media_type || p.media_type === 'both' || p.media_type === targetType
   );
   setQualityProfiles(filteredProfiles);
   if (filteredProfiles.length > 0 && !filteredProfiles.find((p: any) => p.id === selectedProfileId)) {
    setSelectedProfileId(filteredProfiles[0].id);
   }
  } catch (error) {
   console.error('Failed to load quality profiles:', error);
  }
 };

 const loadImportSettings = async () => {
  try {
   const settings = await api.getSettings();
   // Don't auto-select quality profile - user must manually choose each time
   // if (settings.import_quality_profile_id) {
   //  setSelectedProfileId(settings.import_quality_profile_id);
   // }
   if (settings.import_auto_search !== undefined) {
    setAutoSearchMissing(settings.import_auto_search === true || settings.import_auto_search === 'true');
   }
  } catch (error) {
   console.error('Failed to load import settings:', error);
  }
 };

 const saveImportSettings = async (profileId: string, autoSearch: boolean) => {
  try {
   await api.updateSetting('import_quality_profile_id', profileId);
   await api.updateSetting('import_auto_search', autoSearch);
  } catch (error) {
   console.error('Failed to save import settings:', error);
  }
 };

 const handleQualityProfileChange = (profileId: string) => {
  setSelectedProfileId(profileId);
  saveImportSettings(profileId, autoSearchMissing);
 };

 const handleAutoSearchChange = (enabled: boolean) => {
  setAutoSearchMissing(enabled);
  saveImportSettings(selectedProfileId, enabled);
 };

 useEffect(() => {
  loadLibraryItems();
 }, [mediaType]);

 const loadSettings = async () => {
  try {
   const settings = await api.getSettings();
   // Use the correct path based on initialMediaType or current mediaType
   const type = initialMediaType || mediaType;
   if (type === 'tv') {
    setScanPath(settings.tv_path || '/data/tv');
   } else {
    setScanPath(settings.movie_path || '/data/movies');
   }
   
   // Check if TMDB API key is set
   if (!settings.tmdb_api_key) {
    onToast('TMDB API key not set. Please configure it in Settings > API Keys to enable media matching.', 'error');
   }
  } catch (error) {
   console.error('Failed to load settings:', error);
  }
 };

 const loadLibraryItems = async () => {
  try {
   const result = mediaType === 'movie' ? await api.getMovies() : await api.getSeries();
   const tmdbIds = new Set<number>(result.items.map((item: any) => item.tmdb_id as number));
   setLibraryItems(tmdbIds);
  } catch (error) {
   console.error('Failed to load library:', error);
  }
 };

 // Parse filename/folder to extract title, year, quality, and TVDB ID
 const parseFilename = useCallback((filename: string, forTV: boolean = false): { 
  title: string; 
  year?: number; 
  quality?: string;
  tvdbId?: number;
 } => {
  let name = filename;
  
  // For TV shows, the "filename" is actually the folder name
  // Remove any file extension just in case
  name = name.replace(/\.(mkv|mp4|avi|m4v|wmv|mov|ts|m2ts)$/i, '');
  
  // Extract TVDB ID from patterns like {tvdb-12345}, [tvdb-12345], {tvdbid-12345}, tvdbid-12345
  let tvdbId: number | undefined;
  const tvdbPatterns = [
   /\{tvdb-?id?[-:]?\s*(\d+)\}/i,  // {tvdb-12345} or {tvdbid-12345} or {tvdb:12345}
   /\[tvdb-?id?[-:]?\s*(\d+)\]/i,  // [tvdb-12345]
   /tvdb-?id?[-:]?\s*(\d+)/i,    // tvdbid-12345 or tvdb-12345
   /\{(\d{5,})\}/,          // {12345} - just ID in braces (5+ digits to avoid years)
  ];
  
  for (const pattern of tvdbPatterns) {
   const tvdbMatch = name.match(pattern);
   if (tvdbMatch) {
    tvdbId = parseInt(tvdbMatch[1]);
    // Remove the TVDB ID part from name for cleaner title parsing
    name = name.replace(pattern, '').trim();
    break;
   }
  }
  
  // Extract year - be more flexible with patterns
  const yearPatterns = [
   /[(\[]((?:19|20)\d{2})[)\]]/,   // (2020) or [2020]
   /[.\s]((?:19|20)\d{2})[.\s]/,   // .2020. or space 2020 space
   /[.\s]((?:19|20)\d{2})$/,     // ends with .2020 or space 2020
  ];
  
  let year: number | undefined;
  for (const pattern of yearPatterns) {
   const yearMatch = name.match(pattern);
   if (yearMatch) {
    year = parseInt(yearMatch[1]);
    break;
   }
  }
  
  // Extract quality
  const qualityMatch = name.match(/(2160p|4K|UHD|1080p|720p|480p)/i);
  const quality = qualityMatch ? qualityMatch[1].toUpperCase().replace('4K', '2160p').replace('UHD', '2160p') : undefined;
  
  // Clean title
  let title = name
   // Remove year and everything after for movies, but be careful with TV
   .replace(/[(\[]((?:19|20)\d{2})[)\]].*$/i, '')
   .replace(/[.\s]((?:19|20)\d{2})[.\s].*$/i, ' ')
   // Remove common release info (use word boundaries to avoid matching parts of words)
   .replace(/\b(BluRay|BRRip|BDRip|DVDRip|WEB-DL|WEBRip|HDTV|PDTV|HDRip|AMZN|DSNP|HMAX|ATVP|PCOK|MA)\b/gi, '')
   // NF needs special handling - only match when surrounded by dots, spaces, or string boundaries
   .replace(/(?:^|[.\s-])NF(?:[.\s-]|$)/gi, ' ')
   // Replace dots and underscores with spaces
   .replace(/\./g, ' ')
   .replace(/_/g, ' ')
   // Remove brackets and their contents (release groups, etc)
   .replace(/\[.*?\]/g, '')
   .replace(/\(.*?\)/g, '')
   // Remove quality indicators
   .replace(/2160p|4K|UHD|1080p|720p|480p|x264|x265|HEVC|H\.?264|H\.?265|10bit|HDR/gi, '')
   // Remove audio indicators
   .replace(/DTS|AC3|AAC|FLAC|TrueHD|Atmos|EAC3|DD5\.1|DDP|5\.1|7\.1/gi, '')
   // Clean up dashes at end (release group)
   .replace(/-[A-Za-z0-9]+$/, '')
   // Clean up whitespace
   .replace(/\s+/g, ' ')
   .trim();
  
  // For TV, also try to clean up season/episode info from title
  if (forTV) {
   title = title
    .replace(/S\d+E\d+/gi, '')
    .replace(/Season\s*\d+/gi, '')
    .replace(/Complete\s*Series/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  }
  
  return { title, year, quality, tvdbId };
 }, []);

 const handleMediaTypeChange = async (type: 'movie' | 'tv') => {
  setMediaType(type);
  setFiles([]);
  setCurrentPage(0);
  
  try {
   const settings = await api.getSettings();
   setScanPath(type === 'movie' ? (settings.movie_path || '/data/movies') : (settings.tv_path || '/data/tv'));
  } catch (error) {
   console.error('Failed to load settings:', error);
  }
 };

 const handleScan = async (pathOverride?: string) => {
  const pathToScan = pathOverride || scanPath;
  if (!pathToScan) {
   onToast('Please enter a path to scan', 'error');
   return;
  }

  setScanning(true);
  setFiles([]);
  setCurrentPage(0);
  setScanProgress(null);

  try {
   // Step 1: Quick file scan
   onToast('Scanning directory...', 'info');
   const response = await api.scanLibrary(pathToScan, mediaType);
   const scannedFiles = response.files || [];
   
   if (scannedFiles.length === 0) {
    onToast('No media files found', 'info');
    setScanning(false);
    return;
   }

   // Step 1.5: Get existing library paths to skip already imported files
   let existingPaths: Set<string> = new Set();
   try {
    const pathsResponse = await api.getLibraryPaths(mediaType);
    // Normalize paths - remove trailing slashes and normalize
    const normalizedPaths = (pathsResponse.paths || []).map((p: string) => 
     p.replace(/\/+$/, '').toLowerCase()
    );
    existingPaths = new Set(normalizedPaths);
    console.log(`[Import] Loaded ${existingPaths.size} existing library paths`);
   } catch (e) {
    console.warn('Could not load existing library paths');
   }

   // Helper to normalize a path for comparison
   const normalizePath = (p: string): string => p.replace(/\/+$/, '').toLowerCase();

   // Helper to check if a file path matches an existing library path
   const isAlreadyImported = (filePath: string): boolean => {
    // For movies, check if the file's parent folder matches
    // For TV, check if the file's root folder matches
    if (mediaType === 'movie') {
     const parentFolder = normalizePath(filePath.substring(0, filePath.lastIndexOf('/')));
     return existingPaths.has(parentFolder);
    } else {
     // For TV series, the path IS the folder
     const normalizedPath = normalizePath(filePath);
     return existingPaths.has(normalizedPath);
    }
   };

   // Step 2: Show all files immediately with pending or in_library status
   const initialFiles: ParsedFile[] = scannedFiles.map((file: any, idx: number) => {
    const parsed = parseFilename(file.filename, mediaType === 'tv');
    const alreadyImported = isAlreadyImported(file.path);
    return {
     id: `file-${idx}-${Date.now()}`,
     path: file.path,
     filename: file.filename,
     parsedTitle: parsed.title,
     parsedYear: parsed.year,
     parsedQuality: parsed.quality,
     parsedTvdbId: parsed.tvdbId,
     size: file.size || 0,
     match: undefined,
     alternateMatches: [],
     status: alreadyImported ? 'in_library' as const : 'pending' as const,
     libraryId: undefined,
     selected: false
    };
   });
   
   // Count already imported
   const alreadyImportedCount = initialFiles.filter(f => f.status === 'in_library').length;
   if (alreadyImportedCount > 0) {
    onToast(`Found ${alreadyImportedCount} already imported items`, 'info');
   }
   
   setFiles(initialFiles);
   
   // Only show progress for files that need matching
   const filesToMatch = initialFiles.filter(f => f.status !== 'in_library');
   setScanProgress({ current: 0, total: filesToMatch.length });

   // Load fresh library items
   await loadLibraryItems();

   // Get concurrent requests setting
   let concurrentRequests = 5;
   try {
    const settings = await api.getSettings();
    concurrentRequests = settings.concurrent_requests || 5;
   } catch (e) {
    console.warn('Could not load concurrent requests setting, using default');
   }
   
   // If all files are already imported, we're done
   if (filesToMatch.length === 0) {
    setScanning(false);
    onToast('All files already imported', 'success');
    return;
   }
   
   // Step 3: Matching in background batches - only for files not already imported
   const MATCH_BATCH_SIZE = Math.min(Math.max(concurrentRequests, 1), 20);
   
   // Get indices of files that need matching
   const indicesToMatch = initialFiles
    .map((f, idx) => ({ file: f, idx }))
    .filter(item => item.file.status !== 'in_library')
    .map(item => item.idx);
   
   // Helper to get year from date string safely
   const getYearFromDate = (dateStr: string | null | undefined): number | undefined => {
    if (!dateStr) return undefined;
    const year = new Date(dateStr).getFullYear();
    return isNaN(year) ? undefined : year;
   };

   // Helper to normalize title for comparison
   const normalizeTitle = (title: string): string => {
    return title
     .toLowerCase()
     .replace(/[''`]/g, "'")
     // Normalize slashes to spaces (titles like "Good/Bad")
     .replace(/\//g, ' ')
     // Normalize "and" / "&" to the same form
     .replace(/\s+&\s+/g, ' and ')
     .replace(/\s+and\s+/g, ' and ')
     // Keep alphanumeric, spaces, and apostrophes only
     .replace(/[^\w\s']/g, ' ')
     .replace(/\s+/g, ' ')
     .trim();
   };
   
   // Helper to check if titles match with flexible comparison
   const titlesMatch = (title1: string, title2: string): { exact: boolean; partial: boolean; score: number } => {
    const norm1 = normalizeTitle(title1);
    const norm2 = normalizeTitle(title2);
    
    // Exact match
    if (norm1 === norm2) {
     return { exact: true, partial: true, score: 100 };
    }
    
    // One contains the other
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
     const longer = norm1.length > norm2.length ? norm1 : norm2;
     const shorter = norm1.length > norm2.length ? norm2 : norm1;
     const score = Math.round((shorter.length / longer.length) * 100);
     return { exact: false, partial: true, score: Math.max(score, 75) };
    }
    
    // Word-based matching
    const words1 = norm1.split(' ').filter(w => w.length > 1);
    const words2 = norm2.split(' ').filter(w => w.length > 1);
    const shorterWords = words1.length < words2.length ? words1 : words2;
    const longerWords = words1.length < words2.length ? words2 : words1;
    
    const matchedCount = shorterWords.filter(w => longerWords.includes(w)).length;
    const score = shorterWords.length > 0 ? Math.round((matchedCount / shorterWords.length) * 100) : 0;
    
    return { exact: false, partial: score >= 70, score };
   };
   
   // Track match counts
   let matchedCount = 0;
   let inLibraryCount = alreadyImportedCount;
   
   for (let i = 0; i < indicesToMatch.length; i += MATCH_BATCH_SIZE) {
    const batchIndices = indicesToMatch.slice(i, i + MATCH_BATCH_SIZE);
    
    const batchResults = await Promise.all(
     batchIndices.map(async (globalIdx: number) => {
      const file = scannedFiles[globalIdx];
      const parsed = parseFilename(file.filename, mediaType === 'tv');
      
      let match: any = undefined;
      let alternateMatches: any[] = [];
      let status: ParsedFile['status'] = 'unmatched';
      
      try {
       // Search by title using TMDB (works for both movies and TV)
       if (parsed.title) {
        const searchResults = mediaType === 'movie'
         ? await api.searchMovies(parsed.title, parsed.year)
         : await api.searchTV(parsed.title);
        
        if (searchResults.results && searchResults.results.length > 0) {
         let bestMatch = searchResults.results[0];
         let confidence = 70;
         
         // For TV shows, also check original_name for non-English shows
         const getTitleVariants = (r: any): string[] => {
          if (mediaType === 'movie') {
           return [r.title, r.original_title].filter(Boolean);
          } else {
           return [r.name, r.original_name].filter(Boolean);
          }
         };

         // Find best match considering year and title
         for (const result of searchResults.results) {
          const resultYear = getYearFromDate(mediaType === 'movie' ? result.release_date : result.first_air_date);
          const titleVariants = getTitleVariants(result);
          
          let matchScore = 70;
          
          // Check if any title variant matches using improved matching
          for (const variant of titleVariants) {
           const matchResult = titlesMatch(parsed.title, variant);
           
           if (matchResult.exact) {
            matchScore = Math.max(matchScore, 85);
            
            // If year also matches, perfect confidence
            if (parsed.year && resultYear === parsed.year) {
             matchScore = 100;
             bestMatch = result;
             confidence = matchScore;
             break;
            }
           } else if (matchResult.partial) {
            matchScore = Math.max(matchScore, matchResult.score);
           }
          }
          
          // Year match without exact title match
          if (parsed.year && resultYear === parsed.year && matchScore < 90) {
           matchScore = Math.max(matchScore, 90);
          }
          
          if (matchScore > confidence) {
           bestMatch = result;
           confidence = matchScore;
          }
          
          // If we found a perfect match, stop searching
          if (confidence === 100) break;
         }
         
         // Get the year safely
         const matchYear = getYearFromDate(
          mediaType === 'movie' ? bestMatch.release_date : bestMatch.first_air_date
         );
         
         // For TV, prefer original_name if name seems to be translated
         let displayTitle = mediaType === 'movie' ? bestMatch.title : bestMatch.name;
         const normalizedParsedForDisplay = normalizeTitle(parsed.title);
         if (mediaType === 'tv' && bestMatch.original_name && 
           bestMatch.original_language !== 'en' &&
           normalizeTitle(bestMatch.original_name).includes(normalizedParsedForDisplay.substring(0, 5))) {
          displayTitle = bestMatch.original_name;
         }
         
         match = {
          id: bestMatch.id,
          title: displayTitle,
          year: matchYear || 0,
          poster_path: bestMatch.poster_path,
          confidence,
          source: 'tmdb'
         };
         
         // Get alternate matches
         alternateMatches = searchResults.results.slice(0, 5)
          .filter((r: any) => r.id !== bestMatch.id)
          .slice(0, 4)
          .map((r: any) => {
           const altYear = getYearFromDate(mediaType === 'movie' ? r.release_date : r.first_air_date);
           return {
            id: r.id,
            title: mediaType === 'movie' ? r.title : (r.original_name || r.name),
            year: altYear || 0,
            poster_path: r.poster_path
           };
          });
         
         // Check if already in library
         if (libraryItems.has(match.id)) {
          status = 'in_library';
         } else {
          status = 'matched';
         }
        }
       }
      } catch (e) {
       console.error('Search failed for:', parsed.title, e);
      }

      return { globalIdx, match, alternateMatches, status };
     })
    );

    // Update files with match results
    setFiles(prev => {
     const updated = [...prev];
     for (const result of batchResults) {
      if (updated[result.globalIdx]) {
       // Auto-select if matched AND confidence >= threshold
       const shouldAutoSelect = result.status === 'matched' && 
        result.match?.confidence && result.match.confidence >= CONFIDENCE_THRESHOLD;
       
       updated[result.globalIdx] = {
        ...updated[result.globalIdx],
        match: result.match,
        alternateMatches: result.alternateMatches,
        status: result.status,
        selected: shouldAutoSelect
       };
      }
     }
     return updated;
    });
    
    // Track counts from batch results
    for (const result of batchResults) {
     if (result.status === 'matched') matchedCount++;
     if (result.status === 'in_library') inLibraryCount++;
    }
    
    setScanProgress({ current: Math.min(i + MATCH_BATCH_SIZE, indicesToMatch.length), total: indicesToMatch.length });
    
    // Small delay between batches to avoid rate limiting
    if (i + MATCH_BATCH_SIZE < indicesToMatch.length) {
     await new Promise(resolve => setTimeout(resolve, 100));
    }
   }

   onToast(`Scan complete! ${matchedCount} matched, ${inLibraryCount} already in library`, 'success');
  } catch (error: any) {
   onToast(error.response?.data?.error || 'Scan failed', 'error');
  } finally {
   setScanning(false);
   setScanProgress(null);
  }
 };

 const handleImport = async () => {
  const selectedFiles = files.filter(f => f.selected && f.match && f.status !== 'in_library');
  
  if (selectedFiles.length === 0) {
   onToast('No files selected for import', 'error');
   return;
  }

  if (!selectedProfileId) {
   onToast('Please select a quality profile before importing', 'error');
   return;
  }

  setImporting(true);
  let imported = 0;
  let failed = 0;

  for (const file of selectedFiles) {
   try {
    setFiles(prev => prev.map(f => 
     f.id === file.id ? { ...f, status: 'importing' } : f
    ));

    // For movies, extract folder path from file path
    // For TV shows, the path is already the folder
    const folderPath = mediaType === 'movie' 
     ? file.path.substring(0, file.path.lastIndexOf('/'))
     : file.path;

    if (mediaType === 'movie') {
     await api.addMovie({
      tmdb_id: file.match!.id,
      title: file.match!.title,
      year: file.match!.year,
      poster_path: file.match!.poster_path,
      folder_path: folderPath,
      quality_profile_id: selectedProfileId,
      minimum_availability: minimumAvailability,
      monitored: true,
      has_file: true
     });
    } else {
     await api.addSeries({
      tmdb_id: file.match!.id,
      title: file.match!.title,
      year: file.match!.year,
      poster_path: file.match!.poster_path,
      folder_path: file.path,
      quality_profile_id: selectedProfileId,
      monitored: true
     });
    }

    setFiles(prev => prev.map(f => 
     f.id === file.id ? { ...f, status: 'imported', selected: false } : f
    ));
    imported++;
    
    // Update library items
    setLibraryItems(prev => new Set([...prev, file.match!.id]));
   } catch (error: any) {
    setFiles(prev => prev.map(f => 
     f.id === file.id ? { ...f, status: 'error', error: error.response?.data?.error || 'Import failed' } : f
    ));
    failed++;
   }
  }

  setImporting(false);
  onToast(`Imported ${imported} items${failed > 0 ? `, ${failed} failed` : ''}`, imported > 0 ? 'success' : 'error');
 };

 const handleSelectAll = (selected: boolean) => {
  setFiles(prev => prev.map(f => ({
   ...f,
   selected: f.status === 'matched' ? selected : f.selected
  })));
 };

 const handleSelectHighConfidence = () => {
  setFiles(prev => prev.map(f => ({
   ...f,
   selected: f.status === 'matched' && f.match?.confidence !== undefined && f.match.confidence >= CONFIDENCE_THRESHOLD
  })));
 };

 const handleManualMatch = async (fileIndex: number) => {
  const file = files[fileIndex];
  setSearchQuery(file.parsedTitle);
  setSearchYear(file.parsedYear?.toString() || '');
  setShowMatchModal(fileIndex);
  setSearchResults([]);
  setSelectedMatchResult(null);
  
  // Auto-search
  setTimeout(() => handleSearchForModal(file.parsedTitle), 100);
 };

 const handleSearchForModal = async (query?: string) => {
  const searchTerm = query || searchQuery;
  if (!searchTerm.trim()) return;
  
  setSearching(true);
  try {
   const results = mediaType === 'movie' 
    ? await api.searchMovies(searchTerm)
    : await api.searchTV(searchTerm);
   setSearchResults(results.results || []);
  } catch (error) {
   console.error('Search failed:', error);
  } finally {
   setSearching(false);
  }
 };

 const handleSearch = async () => {
  handleSearchForModal();
 };

 const handleSelectMatchResult = (result: any) => {
  setSelectedMatchResult(result);
 };

 const applySelectedMatch = () => {
  if (showMatchModal === null || !selectedMatchResult) return;
  
  const isInLibrary = libraryItems.has(selectedMatchResult.id);
  
  setFiles(prev => prev.map((f, i) => 
   i === showMatchModal ? {
    ...f,
    match: {
     id: selectedMatchResult.id,
     title: selectedMatchResult.title || selectedMatchResult.name,
     year: parseInt((selectedMatchResult.release_date || selectedMatchResult.first_air_date || '').split('-')[0]) || 0,
     poster_path: selectedMatchResult.poster_path,
     confidence: 100, // Manual match = 100% confidence
     overview: selectedMatchResult.overview
    },
    status: isInLibrary ? 'in_library' : 'matched',
    selected: !isInLibrary
   } : f
  ));
  setShowMatchModal(null);
  setSearchResults([]);
  setSelectedMatchResult(null);
 };

 // Pagination
 // Filter files based on hideInLibrary setting (hides both in_library and imported)
 // Include original index to properly reference files array when items are hidden
 const displayFiles = useMemo(() => {
  const withIndex = files.map((f, i) => ({ ...f, originalIndex: i }));
  if (hideInLibrary) {
   return withIndex.filter(f => f.status !== 'in_library' && f.status !== 'imported');
  }
  return withIndex;
 }, [files, hideInLibrary]);

 const paginatedFiles = useMemo(() => {
  const start = currentPage * ITEMS_PER_PAGE;
  return displayFiles.slice(start, start + ITEMS_PER_PAGE);
 }, [displayFiles, currentPage]);

 const totalPages = Math.ceil(displayFiles.length / ITEMS_PER_PAGE);

 // Stats
 const stats = useMemo(() => ({
  total: files.length,
  matched: files.filter(f => f.status === 'matched').length,
  unmatched: files.filter(f => f.status === 'unmatched').length,
  pending: files.filter(f => f.status === 'pending').length,
  inLibrary: files.filter(f => f.status === 'in_library').length,
  imported: files.filter(f => f.status === 'imported').length,
  selected: files.filter(f => f.selected && f.status === 'matched').length,
  highConfidence: files.filter(f => f.status === 'matched' && f.match?.confidence && f.match.confidence >= CONFIDENCE_THRESHOLD).length
 }), [files]);

 return (
  <div className="space-y-6">
   {/* Header */}
   <div>
    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Import Media</h2>
    <p className="text-sm text-gray-500 dark:text-gray-400">Scan your existing media library and import files into MediaStack</p>
   </div>

   {/* Import Settings Card - Always Visible */}
   <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Import Settings</h3>
    <div className="flex flex-wrap items-center gap-6">
     {/* Quality Profile */}
     <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600 dark:text-gray-400">Quality Profile:</label>
      {qualityProfiles.length === 0 ? (
       <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-sm">No profiles - </span>
        <a href="/settings?tab=profiles" className="text-primary-600 hover:text-primary-700 text-sm underline">Create one</a>
       </div>
      ) : (
       <select
        value={selectedProfileId}
        onChange={(e) => handleQualityProfileChange(e.target.value)}
        className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
       >
        <option value="">-- Select Profile --</option>
        {qualityProfiles.map(profile => (
         <option key={profile.id} value={profile.id}>{profile.name}</option>
        ))}
       </select>
      )}
     </div>

     {/* Minimum Availability - Movies Only */}
     {mediaType === 'movie' && (
      <div className="flex items-center gap-2">
       <label className="text-sm text-gray-600 dark:text-gray-400">Availability:</label>
       <select
        value={minimumAvailability}
        onChange={(e) => setMinimumAvailability(e.target.value)}
        className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
       >
        <option value="announced">Announced</option>
        <option value="inCinemas">In Cinemas</option>
        <option value="released">Released</option>
       </select>
      </div>
     )}

     {/* Auto-search Toggle */}
     <label className="flex items-center gap-2 cursor-pointer">
      <input
       type="checkbox"
       checked={autoSearchMissing}
       onChange={(e) => handleAutoSearchChange(e.target.checked)}
       className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 bg-white dark:bg-gray-700"
      />
      <span className="text-sm text-gray-600 dark:text-gray-300">Search for missing {mediaType === 'movie' ? 'movies' : 'episodes'} after import</span>
     </label>
    </div>
   </div>

   {/* Scan Controls */}
   <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-stretch gap-3">
     {/* Media Type Toggle */}
     <div className="flex overflow-hidden border border-gray-300 dark:border-gray-600 flex-shrink-0 self-stretch">
      <button
       onClick={() => handleMediaTypeChange('movie')}
       className={`px-5 h-full text-sm font-medium transition-colors ${
        mediaType === 'movie'
         ? 'bg-primary-600 text-white'
         : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
       }`}
      >
       Movies
      </button>
      <button
       onClick={() => handleMediaTypeChange('tv')}
       className={`px-5 h-full text-sm font-medium transition-colors ${
        mediaType === 'tv'
         ? 'bg-primary-600 text-white'
         : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
       }`}
      >
       TV Series
      </button>
     </div>

     {/* Scan Path */}
     <div className="flex-1">
      <input
       value={scanPath}
       onChange={(e) => setScanPath(e.target.value)}
       placeholder="/data/media/movies"
       className="w-full h-full px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border-gray-300 dark:border-gray-600"
      />
     </div>

     {/* Browse Button */}
     <button
      onClick={() => setShowFolderBrowser(true)}
      className="px-4 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed self-stretch"
      style={{
       backgroundColor: 'var(--btn-secondary-bg)',
       color: 'var(--btn-secondary-text)',
       borderWidth: '1px',
       borderStyle: 'solid',
       borderColor: 'var(--btn-secondary-border)'
      }}
     >
      Browse
     </button>

     {/* Scan Button */}
     <button
      onClick={() => handleScan()}
      disabled={scanning || !scanPath}
      className="px-4 min-w-[80px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed self-stretch flex items-center justify-center"
      style={{
       backgroundColor: 'var(--btn-primary-bg)',
       color: 'var(--btn-primary-text)',
       borderWidth: '1px',
       borderStyle: 'solid',
       borderColor: 'var(--btn-primary-border)'
      }}
     >
      {scanning ? (
       <>
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        ...
       </>
      ) : (
       <>
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Scan
       </>
      )}
     </button>
    </div>

    {/* Progress */}
    {scanProgress && (
     <div className="space-y-2 mt-4">
      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
       <span>Matching files with TMDB...</span>
       <span>{scanProgress.current} / {scanProgress.total}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
       <div 
        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
        style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
       />
      </div>
     </div>
    )}
   </div>

   {/* Stats & Actions */}
   {files.length > 0 && (
    <div className="flex flex-wrap items-center justify-between gap-4">
     <div className="flex flex-wrap items-center gap-4 text-sm">
      <span className="text-gray-600 dark:text-gray-400">Total: <strong className="text-gray-900 dark:text-white">{stats.total}</strong></span>
      {stats.pending > 0 && <span className="text-gray-500">Pending: <strong>{stats.pending}</strong></span>}
      <span className="text-emerald-600 dark:text-emerald-400">Matched: <strong>{stats.matched}</strong></span>
      <span className="text-amber-600 dark:text-amber-400">Unmatched: <strong>{stats.unmatched}</strong></span>
      {stats.inLibrary > 0 && <span className="text-sky-600">In Library: <strong>{stats.inLibrary}</strong></span>}
      {stats.imported > 0 && <span className="text-green-600">Imported: <strong>{stats.imported}</strong></span>}
      {(stats.inLibrary > 0 || stats.imported > 0) && (
       <label className="flex items-center gap-1 cursor-pointer">
        <input
         type="checkbox"
         checked={hideInLibrary}
         onChange={(e) => { setHideInLibrary(e.target.checked); setCurrentPage(0); }}
         className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">Hide done</span>
       </label>
      )}
      <span className="text-purple-600">Selected: <strong>{stats.selected}</strong></span>
     </div>
     <div className="flex gap-2">
      <Button variant="secondary" onClick={handleSelectHighConfidence} disabled={stats.highConfidence === 0}>
       Select High Confidence ({stats.highConfidence})
      </Button>
      <Button variant="secondary" onClick={() => handleSelectAll(true)} disabled={stats.matched === 0}>
       Select All Matched
      </Button>
      <Button variant="secondary" onClick={() => handleSelectAll(false)}>
       Deselect All
      </Button>
      <Button onClick={handleImport} disabled={importing || stats.selected === 0}>
       {importing ? 'Importing...' : `Import ${stats.selected} Selected`}
      </Button>
     </div>
    </div>
   )}

   {/* File List */}
   {files.length > 0 && (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
     <div className="overflow-x-hidden">
      <div className="table-responsive">
      <table className="w-full table-fixed">
       <thead className="bg-gray-50 dark:bg-gray-900">
        <tr>
         <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-16">Select</th>
         <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-1/4">File</th>
         <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-1/4">Match</th>
         <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-24">Confidence</th>
         <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-24">Status</th>
         <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-32">Actions</th>
        </tr>
       </thead>
       <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        {paginatedFiles.map((file) => {
         const fileIdx = file.originalIndex;
         return (
          <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
           <td className="px-4 py-3">
            <input
             type="checkbox"
             checked={file.selected}
             disabled={file.status === 'in_library' || file.status === 'imported' || file.status === 'pending' || !file.match}
             onChange={(e) => setFiles(prev => prev.map((f, i) => 
              i === fileIdx ? { ...f, selected: e.target.checked } : f
             ))}
             className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
           </td>
           <td className="px-4 py-3 overflow-hidden">
            <div className="truncate">
             <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.parsedTitle}</p>
             <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={file.filename}>{file.filename}</p>
             <div className="flex items-center gap-2 mt-0.5">
              {file.parsedYear && <span className="text-xs text-gray-400">({file.parsedYear})</span>}
              {file.parsedTvdbId && (
               <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">
                TVDB: {file.parsedTvdbId}
               </span>
              )}
             </div>
            </div>
           </td>
           <td className="px-4 py-3 overflow-hidden">
            {file.status === 'pending' ? (
             <span className="text-sm text-gray-400 animate-pulse">Matching...</span>
            ) : file.match ? (
             <div className="flex items-center gap-2">
              {(file.match.poster_path || file.match.poster_url) && (
               <img 
                src={getPosterUrl(file.match.poster_path, file.match.poster_url, 'w92') || ''}
                alt=""
                className="w-8 h-12 rounded object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
               />
              )}
              <div>
               <p className="text-sm font-medium text-gray-900 dark:text-white">{file.match.title}</p>
               <p className="text-xs text-gray-500">
                {file.match.year > 0 ? file.match.year : 'Unknown year'}
                {' · '}
                {formatSize(file.size)}
                {file.match.source === 'tvdb' && <span className="ml-1 text-purple-500">(TVDB)</span>}
               </p>
              </div>
             </div>
            ) : (
             <span className="text-sm text-gray-400">No match</span>
            )}
           </td>
           <td className="px-4 py-3">
            {file.match?.confidence && (
             <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              file.match.confidence >= 95 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
              file.match.confidence >= CONFIDENCE_THRESHOLD ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
             }`}>
              {file.match.confidence}%
             </span>
            )}
           </td>
           <td className="px-4 py-3">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
             file.status === 'matched' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
             file.status === 'unmatched' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
             file.status === 'in_library' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' :
             file.status === 'imported' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' :
             file.status === 'importing' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
             file.status === 'pending' ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' :
             'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
             {file.status === 'in_library' ? 'In Library' : file.status}
            </span>
           </td>
           <td className="px-4 py-3">
            {file.status !== 'imported' && file.status !== 'in_library' && file.status !== 'pending' && (
             <button
              onClick={() => handleManualMatch(fileIdx)}
              className="text-sm text-primary-600 hover:text-primary-700"
             >
              {file.match ? 'Change' : 'Search'}
             </button>
            )}
           </td>
          </tr>
         );
        })}
       </tbody>
      </table></div>
     </div>

     {/* Pagination */}
     {totalPages > 1 && (
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
       <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing {currentPage * ITEMS_PER_PAGE + 1} to {Math.min((currentPage + 1) * ITEMS_PER_PAGE, displayFiles.length)} of {displayFiles.length}
        {hideInLibrary && (stats.inLibrary + stats.imported) > 0 && (
         <span className="text-gray-400 ml-1">({stats.inLibrary + stats.imported} hidden)</span>
        )}
       </p>
       <div className="flex gap-2">
        <Button
         variant="secondary"
         onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
         disabled={currentPage === 0}
        >
         Previous
        </Button>
        <Button
         variant="secondary"
         onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
         disabled={currentPage >= totalPages - 1}
        >
         Next
        </Button>
       </div>
      </div>
     )}
    </div>
   )}

   {/* Empty State */}
   {files.length === 0 && !scanning && (
    <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
     <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
     </svg>
     <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No files scanned</h3>
     <p className="text-gray-500 dark:text-gray-400">Enter a path and click Scan to find media files</p>
    </div>
   )}

   {/* Folder Browser Modal */}
   {showFolderBrowser && (
    <FolderBrowser
     currentPath={scanPath}
     onSelect={(path) => {
      setScanPath(path);
      setShowFolderBrowser(false);
      // Auto-scan after selecting folder
      if (path) {
       handleScan(path);
      }
     }}
     onClose={() => setShowFolderBrowser(false)}
    />
   )}

   {/* Manual Match Modal - Consistent with FixMatchModal */}
   {showMatchModal !== null && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
     <div className="bg-white dark:bg-gray-800 shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
       <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        {files[showMatchModal]?.status === 'unmatched' ? 'Find Match' : 'Change Match'}
       </h2>
       <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        File: <span className="font-medium">{files[showMatchModal]?.filename}</span>
       </p>
       {files[showMatchModal]?.match && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
         Currently matched to: <span className="font-medium">{files[showMatchModal]?.match.title} ({files[showMatchModal]?.match.year})</span>
        </p>
       )}
      </div>

      {/* Search Form */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
       <div className="flex gap-3">
        <div className="flex-1">
         <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`${mediaType === 'movie' ? 'Movie' : 'Series'} title or TMDB ID...`}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="dark:bg-gray-700"
         />
         {/^\d+$/.test(searchQuery.trim()) && searchQuery.trim() && (
          <p className="text-xs text-blue-500 mt-1">Searching by TMDB ID (year filter ignored)</p>
         )}
        </div>
        <div className="w-24">
         <Input
          value={searchYear}
          onChange={(e) => setSearchYear(e.target.value)}
          placeholder="Year"
          type="number"
          className="dark:bg-gray-700"
          disabled={/^\d+$/.test(searchQuery.trim()) && !!searchQuery.trim()}
         />
        </div>
        <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
         {searching ? 'Searching...' : 'Search'}
        </Button>
       </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
       {searchResults.length > 0 ? (
        <div className="space-y-3">
         {searchResults.slice(0, 10).map((result) => {
          const title = result.title || result.name || '';
          const year = (result.release_date || result.first_air_date || '').split('-')[0];
          const isInLib = libraryItems.has(result.id);
          const rating = result.vote_average;
          const genres = result.genre_ids || [];
          const genreMap: Record<number, string> = {
           28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
           99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
           27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
           10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
           10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News', 10764: 'Reality',
           10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
          };
          const genreNames = genres.slice(0, 3).map((id: number) => genreMap[id]).filter(Boolean);
          
          return (
           <div
            key={result.id}
            onClick={() => handleSelectMatchResult(result)}
            className={`flex gap-4 p-3 cursor-pointer transition-colors border ${
             selectedMatchResult?.id === result.id
              ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 ring-2 ring-primary-500'
              : isInLib
               ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
               : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
           >
            <div className="w-16 h-24 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden flex-shrink-0">
             {result.poster_path ? (
              <img
               src={`https://image.tmdb.org/t/p/w154${result.poster_path}`}
               alt={title}
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
              <div className="min-w-0">
               <p className="font-medium text-gray-900 dark:text-white">
                {title}
                {year && <span className="text-gray-500 dark:text-gray-400 font-normal"> ({year})</span>}
               </p>
               <div className="flex items-center gap-3 mt-1 flex-wrap">
                {rating !== undefined && rating > 0 && (
                 <span className="flex items-center gap-1 text-xs">
                  <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                   <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-300">{rating.toFixed(1)}</span>
                 </span>
                )}
                <span className="text-xs text-gray-400">TMDB: {result.id}</span>
               </div>
               {genreNames.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                 {genreNames.map((genre: string, gidx: number) => (
                  <span key={gidx} className="px-1.5 py-0.5 text-[10px] rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                   {genre}
                  </span>
                 ))}
                </div>
               )}
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
               {selectedMatchResult?.id === result.id && (
                <span className="px-2 py-1 bg-primary-500 text-white text-xs font-medium rounded">
                 Selected
                </span>
               )}
               {isInLib && (
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium rounded">
                 In Library
                </span>
               )}
              </div>
             </div>
             {result.overview && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
               {result.overview}
              </p>
             )}
            </div>
           </div>
          );
         })}
        </div>
       ) : !searching ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
         <p>Search for the correct {mediaType === 'movie' ? 'movie' : 'series'} above</p>
        </div>
       ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
         <svg className="animate-spin h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
         </svg>
         <p>Searching...</p>
        </div>
       )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
       <Button variant="secondary" onClick={() => { setShowMatchModal(null); setSelectedMatchResult(null); setSearchResults([]); }}>
        Cancel
       </Button>
       <Button onClick={applySelectedMatch} disabled={!selectedMatchResult}>
        Apply Match
       </Button>
      </div>
     </div>
    </div>
   )}
  </div>
 );
}
