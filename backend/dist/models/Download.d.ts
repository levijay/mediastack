export interface Download {
    id: string;
    movie_id: string | null;
    series_id: string | null;
    season_number: number | null;
    episode_number: number | null;
    media_type: 'movie' | 'tv';
    title: string;
    torrent_hash: string | null;
    status: 'queued' | 'downloading' | 'completed' | 'failed' | 'importing';
    progress: number;
    download_url: string | null;
    save_path: string | null;
    size: number | null;
    seeders: number | null;
    indexer: string | null;
    quality: string | null;
    download_client_id: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}
export declare class DownloadModel {
    static create(data: {
        movie_id?: string;
        series_id?: string;
        season_number?: number;
        episode_number?: number;
        media_type: 'movie' | 'tv';
        title: string;
        download_url: string;
        size?: number;
        seeders?: number;
        indexer?: string;
        quality?: string;
    }): Download;
    static findById(id: string): Download | undefined;
    static findByMovieId(movieId: string): Download[];
    static findBySeriesId(seriesId: string): Download[];
    static findAll(limit?: number, offset?: number): Download[];
    static findByStatus(status: string): Download[];
    static updateStatus(id: string, status: string, progress?: number, errorMessage?: string): Download | undefined;
    static updateTorrentHash(id: string, hash: string): Download | undefined;
    static updateProgress(id: string, progress: number): Download | undefined;
    static updateSavePath(id: string, savePath: string): Download | undefined;
    static updateDownloadClient(id: string, clientId: string): Download | undefined;
    static delete(id: string): boolean;
    static findActiveByMovieId(movieId: string): Download | undefined;
    static findActiveByEpisode(seriesId: string, seasonNumber: number, episodeNumber: number): Download | undefined;
    static findByDownloadUrl(downloadUrl: string): Download | undefined;
}
//# sourceMappingURL=Download.d.ts.map