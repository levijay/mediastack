import { Download } from '../models/Download';
interface SyncResult {
    synced: number;
    completed: number;
    failed: number;
}
declare class DownloadSyncService {
    private VIDEO_EXTENSIONS;
    /**
     * Check if redownload_failed is enabled
     */
    private isRedownloadEnabled;
    /**
     * Check if auto_import is enabled
     */
    private isAutoImportEnabled;
    /**
     * Handle a failed download - blacklist the release and attempt to find an alternative
     */
    private handleFailedDownload;
    /**
     * Sync all active downloads from all download clients
     */
    syncAllDownloads(): Promise<SyncResult>;
    /**
     * Sync a SABnzbd download
     */
    private syncSABDownload;
    /**
     * Handle a completed SABnzbd download - import files and update library
     */
    private handleCompletedSABDownload;
    /**
     * Find NZB by matching title
     */
    private findNzbByTitle;
    /**
     * Sync a single download with torrent client data
     */
    private syncDownload;
    /**
     * Find torrent by matching title
     */
    private findTorrentByTitle;
    /**
     * Handle a completed download - import files and update library
     */
    private handleCompletedDownload;
    /**
     * Find all video files in a path
     */
    private findVideoFiles;
    /**
     * Import a movie file - move/copy to destination folder
     */
    private importMovieFile;
    /**
     * Import TV episode files - move/copy to destination folder
     */
    private importTVFile;
    /**
     * Parse episode info from filename
     */
    private parseEpisodeFromFilename;
    /**
     * Parse quality from filename
     */
    private parseQuality;
    /**
     * Parse video codec from filename
     */
    private parseVideoCodec;
    /**
     * Parse audio codec from filename
     */
    private parseAudioCodec;
    /**
     * Parse release group from filename
     */
    private parseReleaseGroup;
    /**
     * Parse dynamic range (HDR) from filename
     */
    private parseDynamicRange;
    /**
     * Parse audio channels from filename
     */
    private parseAudioChannels;
    /**
     * Cancel a download - remove from client and delete from database
     */
    cancelDownload(downloadId: string, deleteFiles?: boolean): Promise<boolean>;
    /**
     * Get active downloads for a movie
     */
    getActiveDownloadsForMovie(movieId: string): Download | null;
    /**
     * Get active downloads for an episode
     */
    getActiveDownloadsForEpisode(seriesId: string, seasonNumber: number, episodeNumber: number): Download | null;
}
export declare const downloadSyncService: DownloadSyncService;
export {};
//# sourceMappingURL=downloadSync.d.ts.map