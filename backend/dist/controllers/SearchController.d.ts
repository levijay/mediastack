import { Request, Response } from 'express';
export declare class SearchController {
    static searchAll(req: Request, res: Response): Promise<any>;
    static searchMovies(req: Request, res: Response): Promise<any>;
    /**
     * Search TV shows - Uses TMDB for English names and working posters
     */
    static searchTV(req: Request, res: Response): Promise<any>;
    static getTrending(req: Request, res: Response): Promise<any>;
    static getPopular(req: Request, res: Response): Promise<any>;
    static getTopRated(req: Request, res: Response): Promise<any>;
    static getUpcoming(req: Request, res: Response): Promise<any>;
    static discover(req: Request, res: Response): Promise<any>;
    static getGenres(req: Request, res: Response): Promise<any>;
    static getLanguages(req: Request, res: Response): Promise<any>;
    static searchKeywords(req: Request, res: Response): Promise<any>;
    static searchCompanies(req: Request, res: Response): Promise<any>;
    static getMovieDetails(req: Request, res: Response): Promise<any>;
    static getTVDetails(req: Request, res: Response): Promise<any>;
    static getMovieCredits(req: Request, res: Response): Promise<any>;
    static getTVCredits(req: Request, res: Response): Promise<any>;
    static getSeasonDetails(req: Request, res: Response): Promise<any>;
    static getSimilarMovies(req: Request, res: Response): Promise<any>;
    static getSimilarTV(req: Request, res: Response): Promise<any>;
    /**
     * Lookup a TV show by TVDB ID - returns TMDB-formatted result for import
     * Prefers TMDB data (English names) over direct TVDB (original language)
     */
    static getTVDBLookup(req: Request, res: Response): Promise<any>;
    static searchMovieReleases(req: Request, res: Response): Promise<any>;
    static searchTVReleases(req: Request, res: Response): Promise<any>;
    static getPersonDetails(req: Request, res: Response): Promise<any>;
}
//# sourceMappingURL=SearchController.d.ts.map