import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
  videoCount: number;
  isVideo: boolean;
}

interface BrowseResult {
  path: string;
  parent: string | null;
  items: FileEntry[];
}

interface ManualImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaType: 'movie' | 'tv';
  mediaId: string;
  mediaTitle: string;
  // For TV series
  seasons?: { season_number: number; episode_count: number }[];
  onSuccess?: () => void;
}

export function ManualImportModal({
  isOpen,
  onClose,
  mediaType,
  mediaId,
  mediaTitle,
  seasons = [],
  onSuccess
}: ManualImportModalProps) {
  const [currentPath, setCurrentPath] = useState('/data');
  const [browseResult, setBrowseResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleteSource, setDeleteSource] = useState(false);
  
  // For TV series
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDirectory('/data');
    }
  }, [isOpen]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    
    try {
      const result = await api.browseFiles(path);
      setBrowseResult(result);
      setCurrentPath(path);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to browse directory');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    
    if (mediaType === 'tv' && (selectedSeason === null || selectedEpisode === null)) {
      setError('Please select season and episode number');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      if (mediaType === 'movie') {
        await api.manualImportMovie(mediaId, selectedFile.path, deleteSource);
      } else {
        await api.manualImportEpisode(mediaId, selectedFile.path, selectedSeason!, selectedEpisode!, deleteSource);
      }
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-gray-800 shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Manual Import - {mediaTitle}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Browse and select a file to import
          </p>
        </div>

        {/* Breadcrumb */}
        <div className="px-6 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm">
          <button
            onClick={() => loadDirectory('/data')}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            /data
          </button>
          {currentPath !== '/data' && currentPath.replace('/data', '').split('/').filter(Boolean).map((part, i, arr) => {
            const fullPath = '/data/' + arr.slice(0, i + 1).join('/');
            return (
              <span key={fullPath} className="flex items-center gap-2">
                <span className="text-gray-400">/</span>
                <button
                  onClick={() => loadDirectory(fullPath)}
                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 truncate max-w-[150px]"
                  title={part}
                >
                  {part}
                </button>
              </span>
            );
          })}
        </div>

        {/* File Browser */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : browseResult ? (
            <div className="space-y-1">
              {/* Parent Directory */}
              {browseResult.parent && (
                <button
                  onClick={() => loadDirectory(browseResult.parent!)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-left"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                  </svg>
                  <span className="text-gray-600 dark:text-gray-400">..</span>
                </button>
              )}
              
              {/* Files and Folders */}
              {browseResult.items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    if (item.isDirectory) {
                      loadDirectory(item.path);
                    } else if (item.isVideo) {
                      setSelectedFile(item);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors ${
                    selectedFile?.path === item.path
                      ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
                      : item.isVideo || item.isDirectory
                        ? 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed'
                  }`}
                  disabled={!item.isDirectory && !item.isVideo}
                >
                  {/* Icon */}
                  {item.isDirectory ? (
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
                    </svg>
                  ) : item.isVideo ? (
                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                    </svg>
                  )}
                  
                  {/* Name */}
                  <span className={`flex-1 truncate ${
                    item.isVideo ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {item.name}
                  </span>
                  
                  {/* Size / Video Count */}
                  {item.isFile && item.size > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatSize(item.size)}
                    </span>
                  )}
                  {item.isDirectory && item.videoCount > 0 && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">
                      {item.videoCount} video{item.videoCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              ))}
              
              {browseResult.items.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No files found in this directory
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Selected File & Options */}
        {selectedFile && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Selected: {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {selectedFile.path}
              </p>
            </div>
            
            {/* TV Series: Season & Episode Selection */}
            {mediaType === 'tv' && (
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Season
                  </label>
                  <select
                    value={selectedSeason ?? ''}
                    onChange={(e) => setSelectedSeason(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                  >
                    <option value="">Select Season</option>
                    {seasons.map(s => (
                      <option key={s.season_number} value={s.season_number}>
                        Season {s.season_number}
                      </option>
                    ))}
                    {/* Allow custom season numbers */}
                    {[...Array(20)].map((_, i) => {
                      const num = i + 1;
                      if (!seasons.find(s => s.season_number === num)) {
                        return <option key={num} value={num}>Season {num}</option>;
                      }
                      return null;
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Episode
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={selectedEpisode ?? ''}
                    onChange={(e) => setSelectedEpisode(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Episode #"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
                  />
                </div>
              </div>
            )}
            
            {/* Delete Source Option */}
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={deleteSource}
                onChange={(e) => setDeleteSource(e.target.checked)}
                className="rounded border-gray-300 text-primary-600"
              />
              Move file (delete source after import)
            </label>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedFile || importing || (mediaType === 'tv' && (selectedSeason === null || selectedEpisode === null))}
            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {importing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Importing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
