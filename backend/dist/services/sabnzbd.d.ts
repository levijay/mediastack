interface AddNzbResult {
    success: boolean;
    nzoId?: string;
    message?: string;
}
interface QueueItem {
    nzo_id: string;
    filename: string;
    status: string;
    percentage: string;
    mb: string;
    mbleft: string;
    timeleft: string;
    cat: string;
}
interface HistoryItem {
    nzo_id: string;
    name: string;
    status: string;
    storage: string;
    bytes: number;
    completed: number;
    category: string;
}
declare class SABnzbdService {
    private getConfig;
    isConfigured(): boolean;
    testConnection(): Promise<{
        success: boolean;
        message: string;
        version?: string;
    }>;
    addNzb(downloadUrl: string, category: 'movie' | 'tv', name?: string): Promise<AddNzbResult>;
    getQueue(): Promise<QueueItem[]>;
    getHistory(limit?: number): Promise<HistoryItem[]>;
    getCategories(): Promise<string[]>;
    deleteItem(nzoId: string): Promise<boolean>;
    pauseItem(nzoId: string): Promise<boolean>;
    resumeItem(nzoId: string): Promise<boolean>;
}
export declare const sabnzbdService: SABnzbdService;
export {};
//# sourceMappingURL=sabnzbd.d.ts.map