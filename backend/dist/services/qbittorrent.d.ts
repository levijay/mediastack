interface TorrentInfo {
    hash: string;
    name: string;
    size: number;
    progress: number;
    dlspeed: number;
    upspeed: number;
    eta: number;
    state: string;
    category: string;
    save_path: string;
}
export declare class QBittorrentService {
    private client;
    private cookie;
    private configUrl;
    private getConfig;
    isConfigured(): boolean;
    private getHeaders;
    private getClient;
    testConnection(): Promise<{
        success: boolean;
        message: string;
        version?: string;
    }>;
    addTorrent(url: string, category: string, savePath: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getTorrents(category?: string): Promise<TorrentInfo[]>;
    deleteTorrent(hash: string, deleteFiles?: boolean): Promise<boolean>;
    pauseTorrent(hash: string): Promise<boolean>;
    resumeTorrent(hash: string): Promise<boolean>;
}
export declare const qbittorrentService: QBittorrentService;
export {};
//# sourceMappingURL=qbittorrent.d.ts.map