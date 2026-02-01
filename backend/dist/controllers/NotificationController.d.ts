import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class NotificationController {
    static getAll(req: AuthRequest, res: Response): Promise<any>;
    static getById(req: AuthRequest, res: Response): Promise<any>;
    static create(req: AuthRequest, res: Response): Promise<any>;
    static update(req: AuthRequest, res: Response): Promise<any>;
    static delete(req: AuthRequest, res: Response): Promise<any>;
    static test(req: AuthRequest, res: Response): Promise<any>;
    static getPushbulletDevices(req: AuthRequest, res: Response): Promise<any>;
}
//# sourceMappingURL=NotificationController.d.ts.map