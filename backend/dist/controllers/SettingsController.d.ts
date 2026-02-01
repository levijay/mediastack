import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class SettingsController {
    static getSettings(req: AuthRequest, res: Response): Promise<any>;
    static updateSetting(req: AuthRequest, res: Response): Promise<any>;
    static testTmdbKey(req: AuthRequest, res: Response): Promise<any>;
    static testTvdbKey(req: AuthRequest, res: Response): Promise<any>;
    static testOmdbKey(req: AuthRequest, res: Response): Promise<any>;
    static getStats(req: AuthRequest, res: Response): Promise<any>;
    static getQualityProfiles(req: AuthRequest, res: Response): Promise<any>;
    static previewMovieFolderName(req: AuthRequest, res: Response): Promise<any>;
    static previewSeriesFolderName(req: AuthRequest, res: Response): Promise<any>;
    static getUserUISettings(req: AuthRequest, res: Response): Promise<any>;
    static updateUserUISettings(req: AuthRequest, res: Response): Promise<any>;
    static getExclusions(req: AuthRequest, res: Response): Promise<any>;
    static addExclusion(req: AuthRequest, res: Response): Promise<any>;
    static removeExclusion(req: AuthRequest, res: Response): Promise<any>;
    static clearExclusions(req: AuthRequest, res: Response): Promise<any>;
}
//# sourceMappingURL=SettingsController.d.ts.map