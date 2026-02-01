import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from '../utils/auth';
export interface AuthRequest extends Request {
    user?: JWTPayload;
}
export declare function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): any;
export declare function requireRole(roles: string[]): (req: AuthRequest, res: Response, next: NextFunction) => any;
export declare function authenticateApiKey(req: AuthRequest, res: Response, next: NextFunction): any;
export declare function isAuthenticationDisabled(): boolean;
//# sourceMappingURL=auth.d.ts.map