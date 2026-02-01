import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class LibraryController {
    static getMovies(req: AuthRequest, res: Response): Promise<any>;
    static getRecentlyAdded(req: AuthRequest, res: Response): Promise<any>;
    static getMovieById(req: AuthRequest, res: Response): Promise<any>;
    static addMovie(req: AuthRequest, res: Response): Promise<any>;
    static updateMovie(req: AuthRequest, res: Response): Promise<any>;
    static deleteMovie(req: AuthRequest, res: Response): Promise<any>;
    static getMovieFiles(req: AuthRequest, res: Response): Promise<any>;
    static addMovieFile(req: AuthRequest, res: Response): Promise<any>;
    static deleteMovieFile(req: AuthRequest, res: Response): Promise<any>;
    static getSeries(req: AuthRequest, res: Response): Promise<any>;
    static getSeriesById(req: AuthRequest, res: Response): Promise<any>;
    static addSeries(req: AuthRequest, res: Response): Promise<any>;
    static updateSeries(req: AuthRequest, res: Response): Promise<any>;
    static deleteSeries(req: AuthRequest, res: Response): Promise<any>;
    static getSeasons(req: AuthRequest, res: Response): Promise<any>;
    static getEpisodes(req: AuthRequest, res: Response): Promise<any>;
    static updateSeason(req: AuthRequest, res: Response): Promise<any>;
    static updateEpisode(req: AuthRequest, res: Response): Promise<any>;
    static getStats(req: AuthRequest, res: Response): Promise<any>;
    static deleteEpisodeFile(req: AuthRequest, res: Response): Promise<any>;
    static deleteSeasonFiles(req: AuthRequest, res: Response): Promise<any>;
    static previewMovieRename(req: AuthRequest, res: Response): Promise<any>;
    static executeMovieRename(req: AuthRequest, res: Response): Promise<any>;
    static fixMovieMatch(req: AuthRequest, res: Response): Promise<any>;
    static previewSeriesRename(req: AuthRequest, res: Response): Promise<any>;
    static executeSeriesRename(req: AuthRequest, res: Response): Promise<any>;
    static bulkUpdateMovies(req: AuthRequest, res: Response): Promise<any>;
    static bulkDeleteMovies(req: AuthRequest, res: Response): Promise<any>;
    static bulkUpdateSeries(req: AuthRequest, res: Response): Promise<any>;
    static bulkDeleteSeries(req: AuthRequest, res: Response): Promise<any>;
    static getMovieActivityLog(req: AuthRequest, res: Response): Promise<any>;
    static getSeriesActivityLog(req: AuthRequest, res: Response): Promise<any>;
    static getRecentActivity(req: AuthRequest, res: Response): Promise<any>;
    static streamActivity(req: AuthRequest, res: Response): Promise<any>;
    private static getSettingSync;
    private static deleteEmptyFolder;
    /**
     * Trigger auto search for a single movie
     */
    static searchMovie(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Trigger auto search for multiple movies
     */
    static bulkSearchMovies(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Trigger auto search for a single series (all missing episodes)
     */
    static searchSeries(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Trigger auto search for multiple series
     */
    static bulkSearchSeries(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Preview movie folder rename based on current naming settings
     */
    static previewMovieFolderRename(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Execute movie folder rename
     */
    static executeMovieFolderRename(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Preview all movie folders that need renaming
     */
    static previewAllMovieFolderRenames(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Execute all movie folder renames
     */
    static executeAllMovieFolderRenames(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Browse files/folders for manual import
     */
    static browseFiles(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Manual import for a movie
     */
    static manualImportMovie(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Manual import for a series episode
     */
    static manualImportEpisode(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Get related movies based on collection, cast, crew, genres, and title similarity
     */
    static getRelatedMovies(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Get related series based on cast, crew, genres, network, and title similarity
     */
    static getRelatedSeries(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Refresh media metadata (cast, crew, genres, collection) for a movie
     */
    static refreshMovieMetadata(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Refresh media metadata (cast, crew, genres, certification) for a series
     */
    static refreshSeriesMetadata(req: AuthRequest, res: Response): Promise<any>;
}
//# sourceMappingURL=LibraryController.d.ts.map