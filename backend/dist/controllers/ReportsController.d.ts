import { Request, Response } from 'express';
interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
    };
}
export declare class ReportsController {
    /**
     * Get distinct values for filter combo boxes
     */
    static getFilterOptions(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Search movies with filters
     */
    static searchMovies(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Search episodes with filters
     */
    static searchEpisodes(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Get summary statistics
     */
    static getStats(req: AuthRequest, res: Response): Promise<any>;
}
export {};
//# sourceMappingURL=ReportsController.d.ts.map