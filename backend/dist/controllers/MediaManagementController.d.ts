import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class MediaManagementController {
    static getQualityDefinitions(req: AuthRequest, res: Response): Promise<any>;
    static getQualityProfiles(req: AuthRequest, res: Response): Promise<any>;
    static getQualityProfile(req: AuthRequest, res: Response): Promise<any>;
    static createQualityProfile(req: AuthRequest, res: Response): Promise<any>;
    static updateQualityProfile(req: AuthRequest, res: Response): Promise<any>;
    static deleteQualityProfile(req: AuthRequest, res: Response): Promise<any>;
    static getNamingConfig(req: AuthRequest, res: Response): Promise<any>;
    static updateNamingConfig(req: AuthRequest, res: Response): Promise<any>;
    static getNamingTokens(req: AuthRequest, res: Response): Promise<any>;
    static previewNaming(req: AuthRequest, res: Response): Promise<any>;
    static getFileManagementSettings(req: AuthRequest, res: Response): Promise<any>;
    static updateFileManagementSettings(req: AuthRequest, res: Response): Promise<any>;
}
//# sourceMappingURL=MediaManagementController.d.ts.map