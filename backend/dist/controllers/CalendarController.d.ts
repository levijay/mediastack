import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class CalendarController {
    static getUpcoming(req: AuthRequest, res: Response): Promise<any>;
    static getMissing(req: AuthRequest, res: Response): Promise<any>;
}
//# sourceMappingURL=CalendarController.d.ts.map