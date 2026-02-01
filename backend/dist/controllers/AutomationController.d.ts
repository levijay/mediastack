import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class AutomationController {
    static getIndexers(req: AuthRequest, res: Response): Promise<any>;
    static getIndexerStatus(req: AuthRequest, res: Response): Promise<any>;
    static addIndexer(req: AuthRequest, res: Response): Promise<any>;
    static updateIndexer(req: AuthRequest, res: Response): Promise<any>;
    static deleteIndexer(req: AuthRequest, res: Response): Promise<any>;
    static testIndexer(req: AuthRequest, res: Response): Promise<any>;
    static previewRss(req: AuthRequest, res: Response): Promise<any>;
    static testQBittorrent(req: AuthRequest, res: Response): Promise<any>;
    static testQBittorrentWithParams(req: AuthRequest, res: Response): Promise<any>;
    static testSabnzbd(req: AuthRequest, res: Response): Promise<any>;
    static searchReleases(req: AuthRequest, res: Response): Promise<any>;
    static startDownload(req: AuthRequest, res: Response): Promise<any>;
    static getDownloads(req: AuthRequest, res: Response): Promise<any>;
    static syncDownloads(req: AuthRequest, res: Response): Promise<any>;
    static cancelDownload(req: AuthRequest, res: Response): Promise<any>;
    static clearDownloads(req: AuthRequest, res: Response): Promise<any>;
    static getDownloadClients(req: AuthRequest, res: Response): Promise<any>;
    static addDownloadClient(req: AuthRequest, res: Response): Promise<any>;
    static updateDownloadClient(req: AuthRequest, res: Response): Promise<any>;
    static deleteDownloadClient(req: AuthRequest, res: Response): Promise<any>;
    static testDownloadClient(req: AuthRequest, res: Response): Promise<any>;
    static getEnabledDownloadClients(req: AuthRequest, res: Response): Promise<any>;
    static getBlacklist(req: AuthRequest, res: Response): Promise<any>;
    static removeFromBlacklist(req: AuthRequest, res: Response): Promise<any>;
    static clearMovieBlacklist(req: AuthRequest, res: Response): Promise<any>;
    static clearSeriesBlacklist(req: AuthRequest, res: Response): Promise<any>;
}
//# sourceMappingURL=AutomationController.d.ts.map