export interface QualityDefinition {
    id: number;
    name: string;
    title: string;
    weight: number;
    min_size: number;
    max_size: number;
    preferred_size: number;
    source: string | null;
    resolution: string | null;
}
export interface QualityProfileItem {
    quality: string;
    allowed: boolean;
}
export interface QualityProfile {
    id: string;
    name: string;
    media_type: 'movie' | 'series' | 'both';
    cutoff_quality: string;
    upgrade_allowed: boolean;
    min_custom_format_score?: number;
    items: QualityProfileItem[];
    created_at: string;
    updated_at: string;
}
export declare class QualityProfileModel {
    static getAllDefinitions(): QualityDefinition[];
    static getDefinitionByName(name: string): QualityDefinition | undefined;
    static getQualityWeight(qualityName: string): number;
    static isQualityBetter(qualityA: string, qualityB: string): boolean;
    static getAll(): QualityProfile[];
    static findById(id: string): QualityProfile | undefined;
    static findByName(name: string): QualityProfile | undefined;
    static create(data: {
        name: string;
        media_type?: 'movie' | 'series' | 'both';
        cutoff_quality: string;
        upgrade_allowed: boolean;
        items: QualityProfileItem[];
    }): QualityProfile;
    static update(id: string, data: {
        name?: string;
        media_type?: 'movie' | 'series' | 'both';
        cutoff_quality?: string;
        upgrade_allowed?: boolean;
        items?: QualityProfileItem[];
    }): QualityProfile | undefined;
    static delete(id: string): boolean;
    static meetsProfile(profileId: string, quality: string): boolean;
    static normalizeQualityToGroup(quality: string): string;
    static shouldUpgrade(profileId: string, currentQuality: string, newQuality: string, options?: {
        currentIsProper?: boolean;
        currentIsRepack?: boolean;
        newIsProper?: boolean;
        newIsRepack?: boolean;
    }): boolean;
    /**
     * Get propers/repacks preference from settings
     */
    static getPropersRepacskPreference(): string;
    /**
     * Check if a release title is a proper or repack
     */
    static isProperOrRepack(title: string): {
        isProper: boolean;
        isRepack: boolean;
    };
    static parseQualityFromFilename(filename: string): string;
    /**
     * Check if a quality meets or exceeds the profile's cutoff
     * Returns true if the quality is at or above the cutoff
     */
    static meetsCutoff(profileId: string, quality: string): boolean;
}
//# sourceMappingURL=QualityProfile.d.ts.map