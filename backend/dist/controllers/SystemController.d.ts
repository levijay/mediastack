import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
interface WorkerInfo {
    id: string;
    name: string;
    description: string;
    status: 'running' | 'stopped' | 'error';
    lastRun?: string;
    nextRun?: string;
    interval?: number;
    errorMessage?: string;
}
declare class WorkerRegistry {
    private workers;
    private intervals;
    private lastRunTimes;
    constructor();
    registerWorker(info: WorkerInfo): void;
    getAll(): WorkerInfo[];
    get(id: string): WorkerInfo | undefined;
    start(id: string, skipInitialRun?: boolean): boolean;
    stop(id: string): boolean;
    restart(id: string): boolean;
    setInterval(id: string, intervalMs: number): boolean;
    private checkAndRunScheduledBackup;
    startDefaults(): void;
}
export declare const workerRegistry: WorkerRegistry;
export declare class SystemController {
    static health(req: Request, res: Response): Promise<any>;
    static status(req: Request, res: Response): Promise<any>;
    static browseFolders(req: AuthRequest, res: Response): Promise<any>;
    static getWorkers(req: AuthRequest, res: Response): Promise<any>;
    static getWorker(req: AuthRequest, res: Response): Promise<any>;
    static startWorker(req: AuthRequest, res: Response): Promise<any>;
    static stopWorker(req: AuthRequest, res: Response): Promise<any>;
    static restartWorker(req: AuthRequest, res: Response): Promise<any>;
    static updateWorkerInterval(req: AuthRequest, res: Response): Promise<any>;
    static runWorkerNow(req: AuthRequest, res: Response): Promise<any>;
    static createBackup(req: AuthRequest, res: Response): Promise<any>;
    static restoreBackup(req: AuthRequest, res: Response): Promise<any>;
    /**
     * Preview backup file contents - returns what tables/items are in the backup
     */
    static previewBackup(req: AuthRequest, res: Response): Promise<any>;
    static getBackupInfo(req: AuthRequest, res: Response): Promise<any>;
    static getScheduledBackups(req: AuthRequest, res: Response): Promise<any>;
    static downloadScheduledBackup(req: AuthRequest, res: Response): Promise<any>;
    static deleteScheduledBackup(req: AuthRequest, res: Response): Promise<any>;
}
export {};
//# sourceMappingURL=SystemController.d.ts.map