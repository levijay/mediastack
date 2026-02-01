import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class CustomFormatsController {
    static getAll(req: AuthRequest, res: Response): Promise<any>;
    static getById(req: AuthRequest, res: Response): Promise<any>;
    static create(req: AuthRequest, res: Response): Promise<any>;
    static update(req: AuthRequest, res: Response): Promise<any>;
    static delete(req: AuthRequest, res: Response): Promise<any>;
    static import(req: AuthRequest, res: Response): Promise<any>;
    static bulkImport(req: AuthRequest, res: Response): Promise<any>;
    static getProfileScores(req: AuthRequest, res: Response): Promise<any>;
    static setProfileScore(req: AuthRequest, res: Response): Promise<any>;
    static setProfileScores(req: AuthRequest, res: Response): Promise<any>;
    static removeProfileScore(req: AuthRequest, res: Response): Promise<any>;
    static testRelease(req: AuthRequest, res: Response): Promise<any>;
    static scoreReleases(req: AuthRequest, res: Response): Promise<any>;
}
//# sourceMappingURL=CustomFormatsController.d.ts.map