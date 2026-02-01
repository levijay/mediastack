export interface Exclusion {
    id: string;
    tmdb_id: number;
    media_type: 'movie' | 'tv';
    title: string;
    year?: number;
    reason?: string;
    created_at: string;
}
export declare class ExclusionModel {
    static getAll(mediaType?: string): Exclusion[];
    static getByTmdbId(tmdbId: number, mediaType: string): Exclusion | undefined;
    static isExcluded(tmdbId: number, mediaType: string): boolean;
    static add(data: {
        tmdb_id: number;
        media_type: 'movie' | 'tv';
        title: string;
        year?: number;
        reason?: string;
    }): Exclusion;
    static remove(id: string): boolean;
    static removeByTmdbId(tmdbId: number, mediaType: string): boolean;
    static clear(mediaType?: string): number;
    static count(mediaType?: string): number;
}
//# sourceMappingURL=Exclusion.d.ts.map