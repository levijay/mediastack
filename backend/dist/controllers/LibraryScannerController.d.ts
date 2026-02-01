import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class LibraryScannerController {
    private static VIDEO_EXTENSIONS;
    /**
     * Internal method to scan a series folder for video files and match to episodes
     * Can be called from both the API endpoint and from addSeries
     */
    static scanSeriesFiles(seriesId: string, refreshMetadata?: boolean): Promise<{
        matched: number;
        total: number;
    }>;
    /**
     * Internal method to scan a movie folder for video files and refresh metadata
     * Can be called from both the API endpoint and from addMovie
     */
    static scanMovieFiles(movieId: string, refreshMetadata?: boolean): Promise<{
        found: number;
    }>;
    /**
     * Scan a movie's folder for video files and update the database
     */
    static scanMovie(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Get all folder paths currently in the library - for checking if files are already imported
     */
    static getLibraryPaths(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Scan a directory for media files - returns files quickly without TMDB matching
     * TMDB matching is done on frontend in batches for better UX
     */
    static scanDirectory(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Scan episode files for an imported TV series and match them to episodes
     */
    static scanSeriesEpisodes(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Find all video files recursively
     */
    private static findAllVideoFiles;
    /**
     * Parse episode filename to extract season and episode numbers
     */
    private static parseEpisodeFilename;
    /**
     * Recursively find media files in a directory
     */
    private static findMediaFiles;
    /**
     * Parse a filename to extract title, year, and quality
     */
    private static parseFilename;
    /**
     * Get suggestions for unmatched files
     */
    static getSuggestions(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Manual import for a series - scans the series folder for video files
     * and imports any that match episodes but haven't been imported yet
     */
    static manualImportSeries(req: AuthRequest, res: Response): Promise<any>;
}
//# sourceMappingURL=LibraryScannerController.d.ts.map