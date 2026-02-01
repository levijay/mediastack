export interface DownloadClient {
    id: string;
    name: string;
    type: 'qbittorrent' | 'sabnzbd';
    enabled: boolean;
    host: string;
    port: number;
    use_ssl: boolean;
    url_base: string | null;
    username: string | null;
    password: string | null;
    api_key: string | null;
    category: string | null;
    category_movies: string | null;
    category_tv: string | null;
    priority: number;
    remove_completed: boolean;
    remove_failed: boolean;
    tags: string | null;
    created_at: string;
    updated_at: string;
}
export declare class DownloadClientModel {
    static create(data: {
        name: string;
        type: 'qbittorrent' | 'sabnzbd';
        enabled?: boolean;
        host: string;
        port: number;
        use_ssl?: boolean;
        url_base?: string;
        username?: string;
        password?: string;
        api_key?: string;
        category?: string;
        category_movies?: string;
        category_tv?: string;
        priority?: number;
        remove_completed?: boolean;
        remove_failed?: boolean;
        tags?: string;
    }): DownloadClient;
    static findById(id: string): DownloadClient | undefined;
    static findAll(): DownloadClient[];
    static findByType(type: string): DownloadClient[];
    static findEnabled(): DownloadClient[];
    static update(id: string, data: Partial<{
        name: string;
        type: 'qbittorrent' | 'sabnzbd';
        enabled: boolean;
        host: string;
        port: number;
        use_ssl: boolean;
        url_base: string | null;
        username: string | null;
        password: string | null;
        api_key: string | null;
        category: string | null;
        category_movies: string | null;
        category_tv: string | null;
        priority: number;
        remove_completed: boolean;
        remove_failed: boolean;
        tags: string | null;
    }>): DownloadClient | undefined;
    static delete(id: string): boolean;
    static getClientUrl(client: DownloadClient): string;
}
//# sourceMappingURL=DownloadClient.d.ts.map