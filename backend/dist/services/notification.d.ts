export interface NotificationTriggers {
    onGrab: boolean;
    onFileImport: boolean;
    onFileUpgrade: boolean;
    onImportComplete: boolean;
    onRename: boolean;
    onMovieAdd: boolean;
    onMovieDelete: boolean;
    onSeriesAdd: boolean;
    onSeriesDelete: boolean;
    onEpisodeFileDelete: boolean;
    onEpisodeFileDeleteForUpgrade: boolean;
}
export interface PushbulletConfig {
    accessToken: string;
    deviceIds?: string;
    channelTags?: string;
    senderId?: string;
}
export interface PushoverConfig {
    apiKey: string;
    userKey: string;
    devices?: string;
    priority: number;
    retry?: number;
    expire?: number;
    sound?: string;
}
export interface NotificationConnection {
    id: string;
    name: string;
    type: 'pushbullet' | 'pushover';
    enabled: boolean;
    triggers: NotificationTriggers;
    config: PushbulletConfig | PushoverConfig;
    created_at?: string;
    updated_at?: string;
}
export type NotificationEvent = keyof NotificationTriggers;
export interface NotificationPayload {
    event: NotificationEvent;
    title: string;
    message: string;
    mediaType?: 'movie' | 'series' | 'episode';
    mediaTitle?: string;
}
declare class NotificationService {
    getAll(): Promise<NotificationConnection[]>;
    getById(id: string): Promise<NotificationConnection | null>;
    getEnabled(): Promise<NotificationConnection[]>;
    create(data: Omit<NotificationConnection, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationConnection>;
    update(id: string, data: Partial<Omit<NotificationConnection, 'id' | 'created_at' | 'updated_at'>>): Promise<NotificationConnection | null>;
    delete(id: string): Promise<boolean>;
    private parseRow;
    notify(payload: NotificationPayload): Promise<void>;
    private sendNotification;
    private sendPushbullet;
    private sendPushover;
    test(connection: Omit<NotificationConnection, 'id' | 'created_at' | 'updated_at'>): Promise<{
        success: boolean;
        message: string;
    }>;
    getPushbulletDevices(accessToken: string): Promise<{
        devices: Array<{
            iden: string;
            nickname: string;
        }>;
    }>;
}
export declare const notificationService: NotificationService;
export {};
//# sourceMappingURL=notification.d.ts.map