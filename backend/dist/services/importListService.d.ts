import { ImportList } from '../models/ImportList';
export interface ListItem {
    tmdb_id?: number;
    imdb_id?: string;
    title: string;
    year?: number;
    media_type: 'movie' | 'tv';
}
export declare class ImportListService {
    private static instance;
    static getInstance(): ImportListService;
    private getApiKey;
    fetchListItems(list: ImportList): Promise<ListItem[]>;
    private fetchIMDbList;
    private scrapeIMDbList;
    private searchIMDbListByName;
    private fetchTraktList;
    private fetchStevenLuList;
    private fetchYouTubeList;
    private scrapeYouTubeChannel;
    private fetchYouTubeRSS;
    private parseMovieTitleFromTrailer;
    private searchTMDbForMovie;
    private fetchTMDbList;
    private fetchTMDbPopular;
    private fetchTMDbTopRated;
    private fetchTMDbNowPlaying;
    private fetchTMDbUpcoming;
    private fetchTMDbCustomList;
    private getTmdbIdFromImdb;
    syncList(list: ImportList): Promise<{
        added: number;
        existing: number;
        failed: number;
    }>;
    syncDueLists(): Promise<void>;
    previewList(list: ImportList): Promise<{
        items: any[];
        newCount: number;
        existingCount: number;
    }>;
}
export declare const importListService: ImportListService;
//# sourceMappingURL=importListService.d.ts.map