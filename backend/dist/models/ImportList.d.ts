export interface ImportList {
    id: string;
    name: string;
    type: string;
    media_type: string;
    enabled: boolean;
    enable_auto_add: boolean;
    search_on_add: boolean;
    quality_profile_id: string | null;
    root_folder: string | null;
    monitor: string;
    minimum_availability: string;
    list_id: string | null;
    url: string | null;
    refresh_interval: number;
    last_sync: string | null;
    created_at: string;
    updated_at: string;
}
export declare const ImportListModel: {
    getAll(): ImportList[];
    getById(id: string): ImportList | null;
    getEnabled(): ImportList[];
    getByMediaType(mediaType: string): ImportList[];
    getDueForSync(): ImportList[];
    create(data: Partial<ImportList>): ImportList;
    update(id: string, data: Partial<ImportList>): ImportList | null;
    updateLastSync(id: string): void;
    delete(id: string): boolean;
    getListTypes(): {
        movie: {
            type: string;
            name: string;
            description: string;
            presets: {
                id: string;
                name: string;
                listId: string;
            }[];
        }[];
        tv: {
            type: string;
            name: string;
            description: string;
            presets: {
                id: string;
                name: string;
                listId: string;
            }[];
        }[];
    };
};
//# sourceMappingURL=ImportList.d.ts.map