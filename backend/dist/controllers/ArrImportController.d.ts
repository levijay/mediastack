import { Request, Response } from 'express';
interface AuthRequest extends Request {
    user?: {
        userId: string;
        username: string;
        role: string;
    };
}
export declare class ArrImportController {
    /**
     * Test Radarr connection
     */
    static testRadarr(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Test Sonarr connection
     */
    static testSonarr(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Get movies from Radarr
     */
    static getRadarrMovies(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Get series from Sonarr
     */
    static getSonarrSeries(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Get quality profiles from Radarr
     */
    static getRadarrProfiles(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Get quality profiles from Sonarr
     */
    static getSonarrProfiles(req: AuthRequest, res: Response): Promise<any>;
}
export {};
//# sourceMappingURL=ArrImportController.d.ts.map