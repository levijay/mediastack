export interface MediaInfo {
    resolution?: string;
    qualitySource?: string;
    qualityFull?: string;
    videoCodec?: string;
    videoDynamicRange?: string;
    videoBitrate?: number;
    audioCodec?: string;
    audioChannels?: string;
    audioLanguages?: string;
    audioTrackCount?: number;
    subtitleLanguages?: string;
    runtime?: number;
}
declare class MediaInfoService {
    /**
     * Extract media info from a video file using ffprobe
     * Resolution/quality is ALWAYS parsed from filename first, then falls back to ffprobe
     */
    getMediaInfo(filePath: string): Promise<MediaInfo>;
    /**
     * Find ffprobe executable
     */
    private findFFprobe;
    /**
     * Run ffprobe and parse JSON output
     */
    private runFFprobe;
    /**
     * Detect HDR format from video stream metadata
     */
    private detectHDR;
    /**
     * Normalize video codec name
     */
    private normalizeVideoCodec;
    /**
     * Normalize audio codec name
     */
    private normalizeAudioCodec;
    /**
     * Format channel count to standard notation
     */
    private formatChannels;
    /**
     * Normalize language code to full name
     */
    private normalizeLanguage;
    /**
     * Fallback: Parse info from filename when ffprobe is unavailable
     */
    private parseFromFilename;
    /**
     * Detect quality source from bitrate when not available in filename
     * Returns WEBDL, Bluray, HDTV, etc. based on bitrate ranges
     */
    private detectQualitySourceFromBitrate;
}
export declare const mediaInfoService: MediaInfoService;
export {};
//# sourceMappingURL=mediaInfo.d.ts.map