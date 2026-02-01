interface IndexerConfig {
    id: string;
    name: string;
    type: 'torznab' | 'newznab';
    url: string;
    apiKey: string;
    enabled: boolean;
    enableRss: boolean;
    enableAutomaticSearch: boolean;
    enableInteractiveSearch: boolean;
    priority?: number;
}
interface SearchResult {
    guid: string;
    title: string;
    size: number;
    seeders: number;
    leechers: number;
    grabs: number;
    downloadUrl: string;
    infoUrl: string;
    indexer: string;
    indexerType: 'torznab' | 'newznab';
    protocol: 'torrent' | 'usenet';
    quality: string;
    publishDate: string;
    categories: string[];
}
export declare class IndexerService {
    private mapIndexer;
    getIndexers(): Promise<IndexerConfig[]>;
    getIndexersForAutomaticSearch(): Promise<IndexerConfig[]>;
    getIndexersForInteractiveSearch(): Promise<IndexerConfig[]>;
    getIndexersForRss(): Promise<IndexerConfig[]>;
    getAllIndexers(): Promise<IndexerConfig[]>;
    addIndexer(data: Omit<IndexerConfig, 'id'>): Promise<IndexerConfig>;
    deleteIndexer(id: string): Promise<boolean>;
    updateIndexer(id: string, data: Partial<Omit<IndexerConfig, 'id'>>): Promise<IndexerConfig | null>;
    getIndexerById(id: string): Promise<IndexerConfig | null>;
    testIndexer(url: string, apiKey: string, type: 'torznab' | 'newznab'): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Fetch RSS feed from an indexer
     */
    fetchRss(indexer: IndexerConfig): Promise<SearchResult[]>;
    searchMovie(title: string, year?: number, searchType?: 'automatic' | 'interactive'): Promise<SearchResult[]>;
    searchTV(title: string, season?: number, episode?: number, searchType?: 'automatic' | 'interactive'): Promise<SearchResult[]>;
    /**
     * Filter search results to only include releases that match the title
     */
    private filterByTitleMatch;
    /**
     * Normalize a title for comparison (lowercase, remove punctuation)
     */
    private normalizeTitle;
    /**
     * Extract the title portion from a release name
     * e.g., "The.Tank.2025.1080p.WEB-DL" -> "The Tank"
     */
    private extractTitleFromRelease;
    private searchIndexer;
    private searchIndexerTV;
    private parseResults;
    private parseXmlItems;
    private getCategoryName;
    private parseJsonResults;
    private extractQuality;
}
export declare const indexerService: IndexerService;
export {};
//# sourceMappingURL=indexer.d.ts.map