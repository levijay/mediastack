import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class AuthController {
    static login(req: Request, res: Response): Promise<any>;
    static register(req: Request, res: Response): Promise<any>;
    static me(req: AuthRequest, res: Response): Promise<any>;
    static generateApiKey(req: AuthRequest, res: Response): Promise<any>;
}
//# sourceMappingURL=AuthController.d.ts.map