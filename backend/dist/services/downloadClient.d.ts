import { DownloadClient } from '../models/DownloadClient';
interface AddDownloadResult {
    success: boolean;
    message: string;
    downloadId?: string;
    clientId?: string;
}
interface TestResult {
    success: boolean;
    message: string;
    version?: string;
}
export declare class DownloadClientService {
    /**
     * Get all enabled download clients
     */
    getEnabledClients(): DownloadClient[];
    /**
     * Get the primary download client (first enabled by priority)
     */
    getPrimaryClient(type?: 'qbittorrent' | 'sabnzbd'): DownloadClient | undefined;
    /**
     * Test connection to a download client
     */
    testClient(client: DownloadClient): Promise<TestResult>;
    /**
     * Test connection with raw parameters (for testing before saving)
     */
    testConnection(params: {
        type: 'qbittorrent' | 'sabnzbd';
        host: string;
        port: number;
        use_ssl?: boolean;
        url_base?: string;
        username?: string;
        password?: string;
        api_key?: string;
    }): Promise<TestResult>;
    /**
     * Add a download (torrent or NZB) to the appropriate client
     */
    addDownload(url: string, mediaType: 'movie' | 'tv', savePath: string, clientId?: string, protocol?: 'torrent' | 'usenet'): Promise<AddDownloadResult>;
    private getQBUrl;
    /**
     * Login to qBittorrent and get session cookie
     */
    private qbLogin;
    /**
     * Make an authenticated request to qBittorrent
     */
    private qbRequest;
    private testQBittorrent;
    private addToQBittorrent;
    getQBTorrents(clientId?: string, category?: string): Promise<any[]>;
    private getSABUrl;
    /**
     * Get SABnzbd categories and their folder paths
     */
    getSABCategories(client: DownloadClient): Promise<{
        name: string;
        dir: string;
    }[]>;
    private testSABnzbd;
    private addToSABnzbd;
    getSABQueue(clientId?: string): Promise<any>;
    getSABHistory(clientId?: string): Promise<any>;
    /**
     * Remove a torrent from qBittorrent
     */
    removeTorrent(clientId: string, hash: string, deleteFiles?: boolean): Promise<boolean>;
    /**
     * Remove an NZB from SABnzbd
     */
    removeNzb(clientId: string, nzoId: string, deleteFiles?: boolean): Promise<boolean>;
    /**
     * Pause a torrent in qBittorrent
     */
    pauseTorrent(clientId: string, hash: string): Promise<boolean>;
}
export declare const downloadClientService: DownloadClientService;
export {};
//# sourceMappingURL=downloadClient.d.ts.map