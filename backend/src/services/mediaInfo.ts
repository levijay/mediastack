import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../config/logger';
import path from 'path';

const execAsync = promisify(exec);

export interface MediaInfo {
  resolution?: string;
  qualitySource?: string; // WEBDL, WEBRip, Bluray, HDTV, DVD, etc.
  qualityFull?: string; // Full quality string: "Bluray-1080p", "WEBDL-2160p"
  videoCodec?: string;
  videoDynamicRange?: string;
  videoBitrate?: number; // in kbps
  audioCodec?: string;
  audioChannels?: string;
  audioLanguages?: string;
  audioTrackCount?: number;
  subtitleLanguages?: string;
  runtime?: number; // in minutes
}

interface FFProbeStream {
  codec_type: string;
  codec_name: string;
  codec_long_name?: string;
  width?: number;
  height?: number;
  channels?: number;
  channel_layout?: string;
  tags?: {
    language?: string;
    title?: string;
  };
  // HDR detection fields
  color_transfer?: string;
  color_primaries?: string;
  color_space?: string;
  side_data_list?: Array<{
    side_data_type: string;
    [key: string]: any;
  }>;
}

interface FFProbeFormat {
  duration?: string;
  bit_rate?: string;
  tags?: Record<string, string>;
}

interface FFProbeResult {
  streams: FFProbeStream[];
  format: FFProbeFormat;
}

class MediaInfoService {
  /**
   * Extract media info from a video file using ffprobe
   * Resolution/quality is ALWAYS parsed from filename first, then falls back to ffprobe
   */
  async getMediaInfo(filePath: string): Promise<MediaInfo> {
    const info: MediaInfo = {};
    const filename = path.basename(filePath);
    
    // ALWAYS parse resolution from filename first - this is more reliable
    // as release names define the quality (e.g. "Bluray-2160p" should be 2160p even if video is 2158p)
    const filenameInfo = this.parseFromFilename(filePath);
    info.resolution = filenameInfo.resolution;
    info.qualitySource = filenameInfo.qualitySource;
    info.qualityFull = filenameInfo.qualityFull;
    
    try {
      // Check if ffprobe is available
      const ffprobePath = await this.findFFprobe();
      if (!ffprobePath) {
        logger.warn('[MediaInfo] ffprobe not found, using filename parsing only');
        return filenameInfo;
      }

      const result = await this.runFFprobe(ffprobePath, filePath);
      if (!result) {
        return filenameInfo;
      }

      // Parse video streams
      const videoStreams = result.streams.filter(s => s.codec_type === 'video');
      if (videoStreams.length > 0) {
        const video = videoStreams[0];
        
        // Only use ffprobe resolution if not found in filename
        if (!info.resolution && video.height) {
          if (video.height >= 2000) info.resolution = '2160p';
          else if (video.height >= 1000) info.resolution = '1080p';
          else if (video.height >= 700) info.resolution = '720p';
          else if (video.height >= 400) info.resolution = '480p';
          else info.resolution = `${video.height}p`;
        }

        // Video codec - prefer filename if found, otherwise use ffprobe
        info.videoCodec = filenameInfo.videoCodec || this.normalizeVideoCodec(video.codec_name);

        // HDR detection - prefer filename if found, otherwise use ffprobe
        const ffprobeHDR = this.detectHDR(video);
        info.videoDynamicRange = filenameInfo.videoDynamicRange || ffprobeHDR;
      }

      // Extract video bitrate from format
      let videoBitrate = 0;
      if (result.format.bit_rate) {
        videoBitrate = Math.round(parseInt(result.format.bit_rate) / 1000); // Convert to kbps
        info.videoBitrate = videoBitrate;
      }

      // If quality source not found in filename, detect from bitrate
      if (!info.qualitySource && videoBitrate > 0 && info.resolution) {
        info.qualitySource = this.detectQualitySourceFromBitrate(videoBitrate, info.resolution);
        // Rebuild qualityFull now that we have a source
        if (info.qualitySource) {
          info.qualityFull = `${info.qualitySource}-${info.resolution}`;
        }
      }

      // Build qualityFull if we have the components but it wasn't set
      if (info.resolution && info.qualitySource && !info.qualityFull) {
        info.qualityFull = `${info.qualitySource}-${info.resolution}`;
      } else if (info.resolution && !info.qualityFull) {
        info.qualityFull = info.resolution;
      }

      // Parse audio streams
      const audioStreams = result.streams.filter(s => s.codec_type === 'audio');
      info.audioTrackCount = audioStreams.length;

      if (audioStreams.length > 0) {
        // Use primary audio track (first one)
        const primaryAudio = audioStreams[0];
        
        // Audio codec - prefer filename if found (e.g., "DTS-X" in filename is more specific than ffprobe)
        const ffprobeAudioCodec = this.normalizeAudioCodec(primaryAudio.codec_name, primaryAudio.codec_long_name);
        info.audioCodec = filenameInfo.audioCodec || ffprobeAudioCodec;

        // Audio channels - prefer filename if found, otherwise use ffprobe
        const ffprobeChannels = this.formatChannels(primaryAudio.channels, primaryAudio.channel_layout);
        info.audioChannels = filenameInfo.audioChannels || ffprobeChannels;

        // Collect all audio languages
        const languages = audioStreams
          .map(s => s.tags?.language)
          .filter((lang): lang is string => !!lang && lang !== 'und')
          .map(lang => this.normalizeLanguage(lang));
        
        // Remove duplicates and join
        info.audioLanguages = [...new Set(languages)].join(', ') || undefined;
      } else {
        // No audio streams found, use filename parsing
        info.audioCodec = filenameInfo.audioCodec;
        info.audioChannels = filenameInfo.audioChannels;
      }

      // Parse subtitle streams
      const subtitleStreams = result.streams.filter(s => s.codec_type === 'subtitle');
      if (subtitleStreams.length > 0) {
        const subLanguages = subtitleStreams
          .map(s => s.tags?.language)
          .filter((lang): lang is string => !!lang && lang !== 'und')
          .map(lang => this.normalizeLanguage(lang));
        
        info.subtitleLanguages = [...new Set(subLanguages)].join(', ') || undefined;
      }

      // Runtime
      if (result.format.duration) {
        info.runtime = Math.round(parseFloat(result.format.duration) / 60);
      }

      logger.debug(`[MediaInfo] Extracted info for ${path.basename(filePath)}:`, info);
      return info;

    } catch (error) {
      logger.error(`[MediaInfo] Error extracting info for ${filePath}:`, error);
      return this.parseFromFilename(filePath);
    }
  }

  /**
   * Find ffprobe executable
   */
  private async findFFprobe(): Promise<string | null> {
    const possiblePaths = [
      'ffprobe',
      '/usr/bin/ffprobe',
      '/usr/local/bin/ffprobe',
      '/opt/homebrew/bin/ffprobe'
    ];

    for (const ffprobePath of possiblePaths) {
      try {
        await execAsync(`${ffprobePath} -version`);
        return ffprobePath;
      } catch {
        // Not found at this path
      }
    }
    return null;
  }

  /**
   * Run ffprobe and parse JSON output
   */
  private async runFFprobe(ffprobePath: string, filePath: string): Promise<FFProbeResult | null> {
    try {
      const { stdout } = await execAsync(
        `${ffprobePath} -v quiet -print_format json -show_format -show_streams "${filePath}"`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
      );
      return JSON.parse(stdout);
    } catch (error) {
      logger.error(`[MediaInfo] FFprobe failed for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Detect HDR format from video stream metadata
   */
  private detectHDR(video: FFProbeStream): string {
    // Check for Dolby Vision
    if (video.side_data_list?.some(sd => 
      sd.side_data_type === 'DOVI configuration record' ||
      sd.side_data_type?.includes('Dolby Vision')
    )) {
      // Check if also HDR10+ (hybrid)
      if (video.side_data_list?.some(sd => sd.side_data_type?.includes('HDR10+'))) {
        return 'DV HDR10+';
      }
      return 'Dolby Vision';
    }

    // Check for HDR10+ (dynamic metadata)
    if (video.side_data_list?.some(sd => 
      sd.side_data_type?.includes('HDR10+') ||
      sd.side_data_type?.includes('Dynamic HDR')
    )) {
      return 'HDR10+';
    }

    // Check for HDR10 (static metadata with PQ transfer)
    const isPQ = video.color_transfer === 'smpte2084' || video.color_transfer === 'bt2020-10';
    const isBT2020 = video.color_primaries === 'bt2020' || video.color_space === 'bt2020nc';
    
    if (isPQ && isBT2020) {
      // Check for Mastering Display metadata (HDR10)
      if (video.side_data_list?.some(sd => 
        sd.side_data_type === 'Mastering display metadata' ||
        sd.side_data_type === 'Content light level metadata'
      )) {
        return 'HDR10';
      }
      return 'HDR10';
    }

    // Check for HLG
    if (video.color_transfer === 'arib-std-b67') {
      return 'HLG';
    }

    return 'SDR';
  }

  /**
   * Normalize video codec name
   */
  private normalizeVideoCodec(codec: string): string {
    const codecMap: Record<string, string> = {
      'hevc': 'x265',
      'h265': 'x265',
      'h264': 'x264',
      'avc': 'x264',
      'avc1': 'x264',
      'mpeg4': 'MPEG-4',
      'vp9': 'VP9',
      'av1': 'AV1',
      'vc1': 'VC-1',
    };
    return codecMap[codec.toLowerCase()] || codec.toUpperCase();
  }

  /**
   * Normalize audio codec name
   */
  private normalizeAudioCodec(codec: string, longName?: string): string {
    const codecLower = codec.toLowerCase();
    const longNameLower = (longName || '').toLowerCase();

    // DTS variants
    if (longNameLower.includes('dts-hd ma') || longNameLower.includes('dts-hd master')) return 'DTS-HD MA';
    if (longNameLower.includes('dts:x') || longNameLower.includes('dts-x')) return 'DTS-X';
    if (longNameLower.includes('dts-hd')) return 'DTS-HD';
    if (codecLower === 'dts' || codecLower === 'dca') return 'DTS';

    // Dolby variants
    if (longNameLower.includes('truehd') || codecLower === 'truehd') {
      if (longNameLower.includes('atmos')) return 'TrueHD Atmos';
      return 'TrueHD';
    }
    if (codecLower === 'eac3' || codecLower === 'ec-3') {
      if (longNameLower.includes('atmos')) return 'DD+ Atmos';
      return 'DD+';
    }
    if (codecLower === 'ac3' || codecLower === 'a_ac3') return 'DD';

    // Other common codecs
    if (codecLower === 'aac') return 'AAC';
    if (codecLower === 'flac') return 'FLAC';
    if (codecLower === 'opus') return 'Opus';
    if (codecLower === 'mp3' || codecLower === 'mp3float') return 'MP3';
    if (codecLower === 'pcm_s16le' || codecLower === 'pcm_s24le') return 'PCM';

    return codec.toUpperCase();
  }

  /**
   * Format channel count to standard notation
   */
  private formatChannels(channels?: number, layout?: string): string {
    if (!channels) return '';

    // Try to parse from layout first (more accurate)
    if (layout) {
      if (layout.includes('7.1')) return '7.1';
      if (layout.includes('5.1')) return '5.1';
      if (layout.includes('stereo')) return '2.0';
      if (layout.includes('mono')) return '1.0';
    }

    // Fall back to channel count
    switch (channels) {
      case 8: return '7.1';
      case 6: return '5.1';
      case 2: return '2.0';
      case 1: return '1.0';
      default: return `${channels}.0`;
    }
  }

  /**
   * Normalize language code to full name
   */
  private normalizeLanguage(lang: string): string {
    const langMap: Record<string, string> = {
      'eng': 'English',
      'en': 'English',
      'spa': 'Spanish',
      'es': 'Spanish',
      'fre': 'French',
      'fra': 'French',
      'fr': 'French',
      'ger': 'German',
      'deu': 'German',
      'de': 'German',
      'ita': 'Italian',
      'it': 'Italian',
      'por': 'Portuguese',
      'pt': 'Portuguese',
      'rus': 'Russian',
      'ru': 'Russian',
      'jpn': 'Japanese',
      'ja': 'Japanese',
      'kor': 'Korean',
      'ko': 'Korean',
      'chi': 'Chinese',
      'zho': 'Chinese',
      'zh': 'Chinese',
      'ara': 'Arabic',
      'ar': 'Arabic',
      'hin': 'Hindi',
      'hi': 'Hindi',
      'pol': 'Polish',
      'pl': 'Polish',
      'tur': 'Turkish',
      'tr': 'Turkish',
      'dut': 'Dutch',
      'nld': 'Dutch',
      'nl': 'Dutch',
      'swe': 'Swedish',
      'sv': 'Swedish',
      'nor': 'Norwegian',
      'no': 'Norwegian',
      'dan': 'Danish',
      'da': 'Danish',
      'fin': 'Finnish',
      'fi': 'Finnish',
      'und': 'Unknown',
    };
    return langMap[lang.toLowerCase()] || lang;
  }

  /**
   * Fallback: Parse info from filename when ffprobe is unavailable
   */
  private parseFromFilename(filePath: string): MediaInfo {
    const filename = path.basename(filePath);
    const upper = filename.toUpperCase();
    const info: MediaInfo = {};

    // First check for low quality sources (these are standalone qualities)
    if (upper.match(/\bWORKPRINT\b/)) {
      info.qualitySource = 'WORKPRINT';
      info.qualityFull = 'WORKPRINT';
      return info;
    }
    if (upper.match(/\bCAM\b|\bCAMRIP\b|\bCAM-RIP\b|\bHDCAM\b/)) {
      info.qualitySource = 'CAM';
      info.qualityFull = 'CAM';
      return info;
    }
    if (upper.match(/\bTELESYNC\b|\bHDTS\b|\bPDVD\b/) || upper.match(/\bTS\b(?!C)/)) {
      info.qualitySource = 'TELESYNC';
      info.qualityFull = 'TELESYNC';
      return info;
    }
    if (upper.match(/\bTELECINE\b|\bTC\b/)) {
      info.qualitySource = 'TELECINE';
      info.qualityFull = 'TELECINE';
      return info;
    }
    if (upper.match(/\bDVDSCR\b|\bDVD-SCR\b|\bSCREENER\b/)) {
      info.qualitySource = 'DVDSCR';
      info.qualityFull = 'DVDSCR';
      return info;
    }
    if (upper.match(/\bR5\b/)) {
      info.qualitySource = 'R5';
      info.qualityFull = 'R5';
      return info;
    }

    // Resolution (including non-standard resolutions)
    if (filename.match(/2160p|4K|UHD/i)) info.resolution = '2160p';
    else if (filename.match(/1080p/i)) info.resolution = '1080p';
    else if (filename.match(/720p/i)) info.resolution = '720p';
    else if (filename.match(/576p/i)) info.resolution = '576p';
    else if (filename.match(/480p/i)) info.resolution = '480p';
    else if (filename.match(/\b\d{3,4}p\b/i)) {
      // Handle non-standard resolutions like 800p, 360p etc
      const match = filename.match(/\b(\d{3,4})p\b/i);
      if (match) {
        const height = parseInt(match[1]);
        if (height >= 1000) info.resolution = '1080p';
        else if (height >= 600) info.resolution = '720p';
        else info.resolution = '480p';
      }
    }

    // Quality source (WEBDL, WEBRip, Bluray, HDTV, etc.)
    if (filename.match(/\bRemux\b/i)) {
      info.qualitySource = 'Remux';
    } else if (filename.match(/\bBluray\b|\bBlu-?Ray\b|\bBDRip\b|\bBRRip\b/i)) {
      info.qualitySource = 'Bluray';
    } else if (filename.match(/\bWEB[-\.]?DL\b|\bWEBDL\b/i)) {
      info.qualitySource = 'WEBDL';
    } else if (filename.match(/\bWEB[-\.]?Rip\b|\bWEBRip\b/i)) {
      info.qualitySource = 'WEBRip';
    } else if (filename.match(/\bHDTV\b/i)) {
      info.qualitySource = 'HDTV';
    } else if (filename.match(/\bDVD\b|\bDVDRip\b|\bDVDR\b/i)) {
      info.qualitySource = 'DVD';
    } else if (filename.match(/\bSDTV\b/i)) {
      info.qualitySource = 'SDTV';
    } else if (filename.match(/\bWEB\b/i)) {
      // Generic WEB - could be WEBDL or WEBRip
      info.qualitySource = 'WEB';
    }

    // Build full quality string (e.g., "Bluray-1080p")
    if (info.resolution && info.qualitySource) {
      info.qualityFull = `${info.qualitySource}-${info.resolution}`;
    } else if (info.resolution) {
      info.qualityFull = info.resolution;
    }

    // Video codec
    if (filename.match(/x265|HEVC|H\.?265/i)) info.videoCodec = 'x265';
    else if (filename.match(/x264|AVC|H\.?264/i)) info.videoCodec = 'x264';
    else if (filename.match(/AV1/i)) info.videoCodec = 'AV1';
    else if (filename.match(/VP9/i)) info.videoCodec = 'VP9';

    // HDR
    if (filename.match(/DoVi|DV|Dolby\.?Vision/i)) {
      info.videoDynamicRange = 'Dolby Vision';
    } else if (filename.match(/HDR10\+|HDR10Plus/i)) {
      info.videoDynamicRange = 'HDR10+';
    } else if (filename.match(/HDR10|HDR/i)) {
      info.videoDynamicRange = 'HDR10';
    } else if (filename.match(/HLG/i)) {
      info.videoDynamicRange = 'HLG';
    } else {
      info.videoDynamicRange = 'SDR';
    }

    // Audio codec
    if (filename.match(/DTS[-\.]?X/i)) info.audioCodec = 'DTS-X';
    else if (filename.match(/DTS[-\.]?HD[-\.]?MA/i)) info.audioCodec = 'DTS-HD MA';
    else if (filename.match(/TrueHD[-\.]?Atmos|Atmos/i)) info.audioCodec = 'TrueHD Atmos';
    else if (filename.match(/TrueHD/i)) info.audioCodec = 'TrueHD';
    else if (filename.match(/DD\+|DDP|EAC3/i)) info.audioCodec = 'DD+';
    else if (filename.match(/DD5\.1|AC3/i)) info.audioCodec = 'DD';
    else if (filename.match(/DTS/i)) info.audioCodec = 'DTS';
    else if (filename.match(/FLAC/i)) info.audioCodec = 'FLAC';
    else if (filename.match(/AAC/i)) info.audioCodec = 'AAC';

    // Audio channels
    if (filename.match(/7\.1/i)) info.audioChannels = '7.1';
    else if (filename.match(/5\.1/i)) info.audioChannels = '5.1';
    else if (filename.match(/2\.0/i)) info.audioChannels = '2.0';

    return info;
  }

  /**
   * Detect quality source from bitrate when not available in filename
   * Returns WEBDL, Bluray, HDTV, etc. based on bitrate ranges
   */
  private detectQualitySourceFromBitrate(bitrate: number, resolution?: string): string {
    // Bitrate in kbps
    // Reference bitrate ranges (approximate):
    // Bluray/Remux: Very high bitrate
    // WEBDL: Medium-high bitrate (streaming services)
    // WEBRip: Medium bitrate (re-encoded web content)
    // HDTV: Lower bitrate (broadcast)

    if (resolution === '2160p') {
      if (bitrate > 50000) return 'Remux';
      if (bitrate > 15000) return 'Bluray';
      if (bitrate > 8000) return 'WEBDL';
      if (bitrate > 4000) return 'WEBRip';
      return 'HDTV';
    } else if (resolution === '1080p') {
      if (bitrate > 25000) return 'Remux';
      if (bitrate > 10000) return 'Bluray';
      if (bitrate > 5000) return 'WEBDL';
      if (bitrate > 2500) return 'WEBRip';
      return 'HDTV';
    } else if (resolution === '720p') {
      if (bitrate > 8000) return 'Bluray';
      if (bitrate > 3000) return 'WEBDL';
      if (bitrate > 1500) return 'WEBRip';
      return 'HDTV';
    } else {
      // 480p or lower
      if (bitrate > 3000) return 'DVD';
      if (bitrate > 1500) return 'WEBDL';
      return 'SDTV';
    }
  }
}

export const mediaInfoService = new MediaInfoService();
