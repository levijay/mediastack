export type SpecificationType = 'ReleaseTitleSpecification' | 'SourceSpecification' | 'ResolutionSpecification' | 'ReleaseGroupSpecification' | 'LanguageSpecification' | 'IndexerFlagSpecification' | 'SizeSpecification' | 'QualityModifierSpecification';
export declare const SOURCE_VALUES: Record<number, string>;
export declare const RESOLUTION_VALUES: Record<number, string>;
export interface Specification {
    name: string;
    implementation: SpecificationType;
    negate: boolean;
    required: boolean;
    fields: {
        value: string | number;
        min?: number;
        max?: number;
    };
}
export interface CustomFormat {
    id: string;
    name: string;
    media_type: 'movie' | 'series' | 'both';
    trash_id?: string;
    include_when_renaming: boolean;
    specifications: Specification[];
    created_at?: string;
    updated_at?: string;
}
export interface TrashGuidesFormat {
    trash_id: string;
    trash_scores?: Record<string, number>;
    name: string;
    includeCustomFormatWhenRenaming: boolean;
    specifications: Array<{
        name: string;
        implementation: string;
        negate: boolean;
        required: boolean;
        fields: {
            value: string | number;
            min?: number;
            max?: number;
        };
    }>;
}
export interface QualityProfileCustomFormat {
    profile_id: string;
    custom_format_id: string;
    score: number;
}
export declare class CustomFormatModel {
    static create(data: Omit<CustomFormat, 'id' | 'created_at' | 'updated_at'>): CustomFormat;
    static findById(id: string): CustomFormat | undefined;
    static findByTrashId(trashId: string, mediaType?: 'movie' | 'series' | 'both'): CustomFormat | undefined;
    static findByName(name: string, mediaType?: 'movie' | 'series' | 'both'): CustomFormat | undefined;
    static findAll(): CustomFormat[];
    static findByMediaType(mediaType: 'movie' | 'series'): CustomFormat[];
    static update(id: string, data: Partial<Omit<CustomFormat, 'id' | 'created_at' | 'updated_at'>>): CustomFormat | undefined;
    static delete(id: string): boolean;
    static count(): number;
    static importFromTrashGuides(json: TrashGuidesFormat, mediaType?: 'movie' | 'series' | 'both'): CustomFormat;
    static getDefaultScore(json: TrashGuidesFormat): number;
    static setProfileScore(profileId: string, customFormatId: string, score: number): void;
    static getProfileScores(profileId: string): QualityProfileCustomFormat[];
    static getProfileScoresWithFormats(profileId: string): Array<QualityProfileCustomFormat & {
        format: CustomFormat;
    }>;
    static removeProfileScore(profileId: string, customFormatId: string): boolean;
    static clearProfileScores(profileId: string): number;
    static calculateReleaseScore(releaseTitle: string, profileId: string, releaseSize?: number): number;
    static matchesFormat(releaseTitle: string, specifications: Specification[], releaseSize?: number): boolean;
    static matchesSpecification(releaseTitle: string, spec: Specification, releaseSize?: number): boolean;
    private static mapRow;
}
//# sourceMappingURL=CustomFormat.d.ts.map