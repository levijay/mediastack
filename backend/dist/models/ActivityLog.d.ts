export interface ActivityLog {
    id: number;
    entity_type: 'movie' | 'series' | 'episode';
    entity_id: string;
    event_type: string;
    message: string;
    details?: string;
    created_at: string;
}
export interface ActivityLogInput {
    entity_type: 'movie' | 'series' | 'episode';
    entity_id: string;
    event_type: string;
    message: string;
    details?: string;
}
export declare const EVENT_TYPES: {
    readonly GRABBED: "grabbed";
    readonly DOWNLOADED: "downloaded";
    readonly IMPORTED: "imported";
    readonly RENAMED: "renamed";
    readonly DELETED: "deleted";
    readonly ADDED: "added";
    readonly SCAN_COMPLETED: "scan_completed";
    readonly METADATA_REFRESHED: "metadata_refreshed";
    readonly UNMONITORED: "unmonitored";
};
export declare const EVENT_LABELS: Record<string, string>;
export declare class ActivityLogModel {
    static initialize(): void;
    static create(input: ActivityLogInput): ActivityLog;
    static findById(id: number): ActivityLog | undefined;
    static findByEntity(entityType: string, entityId: string, limit?: number): ActivityLog[];
    static findRecent(limit?: number): ActivityLog[];
    static findByEventType(eventType: string, limit?: number): ActivityLog[];
    static deleteOlderThan(days: number): number;
    static deleteByEntity(entityType: string, entityId: string): number;
    static logMovieEvent(movieId: string, eventType: string, message: string, details?: string): ActivityLog;
    static logSeriesEvent(seriesId: string, eventType: string, message: string, details?: string): ActivityLog;
    static logEpisodeEvent(episodeId: string, eventType: string, message: string, details?: string): ActivityLog;
}
//# sourceMappingURL=ActivityLog.d.ts.map