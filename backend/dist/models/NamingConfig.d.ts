export interface NamingConfig {
    id: number;
    rename_movies: boolean;
    rename_episodes: boolean;
    replace_illegal_characters: boolean;
    colon_replacement: string;
    standard_movie_format: string;
    movie_folder_format: string;
    standard_episode_format: string;
    daily_episode_format: string;
    anime_episode_format: string;
    series_folder_format: string;
    season_folder_format: string;
    specials_folder_format: string;
    multi_episode_style: string;
    updated_at: string;
}
export type MultiEpisodeStyle = 'extend' | 'duplicate' | 'prefixed_range' | 'scene' | 'range';
export declare class NamingConfigModel {
    static get(): NamingConfig;
    static update(data: Partial<Omit<NamingConfig, 'id' | 'updated_at'>>): NamingConfig;
    static getMovieTokens(): {
        token: string;
        description: string;
        example: string;
    }[];
    static getEpisodeTokens(): {
        token: string;
        description: string;
        example: string;
    }[];
    static getFolderTokens(): {
        token: string;
        description: string;
        example: string;
    }[];
}
//# sourceMappingURL=NamingConfig.d.ts.map