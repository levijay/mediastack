import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';

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

export class QualityProfileModel {
  // Get all quality definitions
  static getAllDefinitions(): QualityDefinition[] {
    const stmt = db.prepare('SELECT * FROM quality_definitions ORDER BY weight ASC');
    return stmt.all() as QualityDefinition[];
  }

  // Get quality definition by name
  static getDefinitionByName(name: string): QualityDefinition | undefined {
    const stmt = db.prepare('SELECT * FROM quality_definitions WHERE name = ?');
    return stmt.get(name) as QualityDefinition | undefined;
  }

  // Get quality weight (for comparison)
  static getQualityWeight(qualityName: string): number {
    // First try direct match
    let def = this.getDefinitionByName(qualityName);
    if (def) return def.weight;
    
    // Try normalized group name
    const normalized = this.normalizeQualityToGroup(qualityName);
    if (normalized !== qualityName) {
      def = this.getDefinitionByName(normalized);
      if (def) return def.weight;
    }
    
    // Try to extract resolution and find a matching quality
    // This handles cases like "1080p", "2160p", "UHD Blu-ray 2160p", etc.
    const resolutionMatch = qualityName.match(/(480p|576p|720p|1080p|2160p|4K)/i);
    if (resolutionMatch) {
      let resolution = resolutionMatch[1].toLowerCase();
      if (resolution === '4k') resolution = '2160p';
      
      // Get all definitions and find the lowest weight for this resolution
      // This ensures we don't over-estimate quality
      const allDefs = this.getAllDefinitions();
      const matchingDefs = allDefs.filter(d => 
        d.resolution?.toLowerCase() === resolution
      );
      
      if (matchingDefs.length > 0) {
        // Return the minimum weight for this resolution (most conservative estimate)
        return Math.min(...matchingDefs.map(d => d.weight));
      }
    }
    
    return 0;
  }

  // Check if quality A is better than quality B
  static isQualityBetter(qualityA: string, qualityB: string): boolean {
    return this.getQualityWeight(qualityA) > this.getQualityWeight(qualityB);
  }

  // Get all quality profiles
  static getAll(): QualityProfile[] {
    const stmt = db.prepare('SELECT * FROM quality_profiles ORDER BY name ASC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      ...row,
      media_type: row.media_type || 'both',
      upgrade_allowed: Boolean(row.upgrade_allowed),
      items: JSON.parse(row.items)
    }));
  }

  // Get quality profile by ID
  static findById(id: string): QualityProfile | undefined {
    const stmt = db.prepare('SELECT * FROM quality_profiles WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return undefined;
    
    return {
      ...row,
      media_type: row.media_type || 'both',
      upgrade_allowed: Boolean(row.upgrade_allowed),
      min_custom_format_score: row.min_custom_format_score || 0,
      items: JSON.parse(row.items)
    };
  }

  // Get quality profile by name
  static findByName(name: string): QualityProfile | undefined {
    const stmt = db.prepare('SELECT * FROM quality_profiles WHERE name = ?');
    const row = stmt.get(name) as any;
    
    if (!row) return undefined;
    
    return {
      ...row,
      media_type: row.media_type || 'both',
      upgrade_allowed: Boolean(row.upgrade_allowed),
      min_custom_format_score: row.min_custom_format_score || 0,
      items: JSON.parse(row.items)
    };
  }

  // Create a new quality profile
  static create(data: {
    name: string;
    media_type?: 'movie' | 'series' | 'both';
    cutoff_quality: string;
    upgrade_allowed: boolean;
    items: QualityProfileItem[];
  }): QualityProfile {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO quality_profiles (id, name, media_type, cutoff_quality, upgrade_allowed, items, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      data.name,
      data.media_type || 'both',
      data.cutoff_quality,
      data.upgrade_allowed ? 1 : 0,
      JSON.stringify(data.items),
      now,
      now
    );
    
    return this.findById(id)!;
  }

  // Update a quality profile
  static update(id: string, data: {
    name?: string;
    media_type?: 'movie' | 'series' | 'both';
    cutoff_quality?: string;
    upgrade_allowed?: boolean;
    items?: QualityProfileItem[];
  }): QualityProfile | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.media_type !== undefined) {
      updates.push('media_type = ?');
      values.push(data.media_type);
    }
    if (data.cutoff_quality !== undefined) {
      updates.push('cutoff_quality = ?');
      values.push(data.cutoff_quality);
    }
    if (data.upgrade_allowed !== undefined) {
      updates.push('upgrade_allowed = ?');
      values.push(data.upgrade_allowed ? 1 : 0);
    }
    if (data.items !== undefined) {
      updates.push('items = ?');
      values.push(JSON.stringify(data.items));
    }
    
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    
    const stmt = db.prepare(`
      UPDATE quality_profiles SET ${updates.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);
    
    return this.findById(id);
  }

  // Delete a quality profile
  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM quality_profiles WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Check if a quality meets the profile requirements
  static meetsProfile(profileId: string, quality: string): boolean {
    const profile = this.findById(profileId);
    if (!profile) return false;
    
    // Direct match
    const directItem = profile.items.find(i => i.quality === quality);
    if (directItem?.allowed) return true;
    
    // Check if quality belongs to a group (e.g., WEBRip-1080p belongs to WEB-1080p group)
    const normalizedQuality = this.normalizeQualityToGroup(quality);
    if (normalizedQuality !== quality) {
      const groupItem = profile.items.find(i => i.quality === normalizedQuality);
      if (groupItem?.allowed) return true;
    }
    
    return false;
  }

  // Normalize quality to its parent group (e.g., WEBRip-1080p -> WEB-1080p)
  static normalizeQualityToGroup(quality: string): string {
    // Map specific sub-qualities to their parent group
    const groupMappings: { [key: string]: string } = {
      'WEBDL-480p': 'WEB-480p',
      'WEBRip-480p': 'WEB-480p',
      'WEBDL-720p': 'WEB-720p',
      'WEBRip-720p': 'WEB-720p',
      'WEBDL-1080p': 'WEB-1080p',
      'WEBRip-1080p': 'WEB-1080p',
      'WEBDL-2160p': 'WEB-2160p',
      'WEBRip-2160p': 'WEB-2160p',
    };
    
    return groupMappings[quality] || quality;
  }

  // Check if an upgrade is needed/allowed
  static shouldUpgrade(profileId: string, currentQuality: string, newQuality: string, options?: { currentIsProper?: boolean; currentIsRepack?: boolean; newIsProper?: boolean; newIsRepack?: boolean }): boolean {
    const profile = this.findById(profileId);
    if (!profile) {
      console.log(`[shouldUpgrade] Profile not found: ${profileId}`);
      return false;
    }
    
    // If upgrades are not allowed, return false
    if (!profile.upgrade_allowed) {
      console.log(`[shouldUpgrade] Upgrades not allowed for profile: ${profile.name}`);
      return false;
    }
    
    // Normalize qualities for comparison
    const normalizedCurrent = this.normalizeQualityToGroup(currentQuality);
    const normalizedNew = this.normalizeQualityToGroup(newQuality);
    
    // Check if we've reached the cutoff
    const cutoffWeight = this.getQualityWeight(profile.cutoff_quality);
    const currentWeight = this.getQualityWeight(normalizedCurrent);
    const newWeight = this.getQualityWeight(normalizedNew);
    
    console.log(`[shouldUpgrade] Current: ${currentQuality} (${normalizedCurrent}, weight=${currentWeight}), New: ${newQuality} (${normalizedNew}, weight=${newWeight}), Cutoff: ${profile.cutoff_quality} (weight=${cutoffWeight})`);
    
    // Handle proper/repack at same quality level
    if (options && newWeight === currentWeight) {
      // If current is already a proper/repack, skip same-quality proper/repack releases
      if (options.currentIsProper || options.currentIsRepack) {
        // Don't allow another proper/repack to replace an existing proper/repack
        console.log(`[shouldUpgrade] Same quality, current already has proper/repack - no upgrade`);
        return false;
      }
      // If current is NOT proper/repack but new is, consider it an upgrade
      if (options.newIsProper || options.newIsRepack) {
        // Check propers_repacks_preference setting
        const pref = this.getPropersRepacskPreference();
        if (pref === 'preferAndUpgrade' || pref === 'doNotPrefer') {
          // Allow proper/repack as upgrade (doNotPrefer still allows it, just doesn't prefer)
          console.log(`[shouldUpgrade] Same quality, new is proper/repack - upgrade allowed`);
          return this.meetsProfile(profileId, newQuality);
        }
        // If preference is 'doNotUpgrade', don't upgrade for proper/repack
        console.log(`[shouldUpgrade] Same quality, propers_repacks_preference=${pref} - no upgrade`);
        return false;
      }
      // Same quality, neither is special - not an upgrade
      console.log(`[shouldUpgrade] Same quality (${currentWeight}), no proper/repack difference - no upgrade`);
      return false;
    }
    
    // If current quality is at or above cutoff, no upgrade needed
    if (currentWeight >= cutoffWeight) {
      console.log(`[shouldUpgrade] Already at/above cutoff (${currentWeight} >= ${cutoffWeight}) - no upgrade`);
      return false;
    }
    
    // Check if new quality is better
    if (newWeight <= currentWeight) {
      console.log(`[shouldUpgrade] New quality not better (${newWeight} <= ${currentWeight}) - no upgrade`);
      return false;
    }
    
    // Check if new quality is allowed in the profile
    const allowed = this.meetsProfile(profileId, newQuality);
    console.log(`[shouldUpgrade] Quality ${newQuality} allowed in profile: ${allowed}`);
    return allowed;
  }

  /**
   * Get propers/repacks preference from settings
   */
  static getPropersRepacskPreference(): string {
    try {
      const stmt = db.prepare("SELECT value FROM system_settings WHERE key = 'propers_repacks_preference'");
      const result = stmt.get() as { value: string } | undefined;
      return result?.value || 'preferAndUpgrade';
    } catch {
      return 'preferAndUpgrade';
    }
  }

  /**
   * Check if a release title is a proper or repack
   */
  static isProperOrRepack(title: string): { isProper: boolean; isRepack: boolean } {
    const upper = title.toUpperCase();
    return {
      isProper: /\bPROPER\b/.test(upper),
      isRepack: /\bREPACK\b|\bRERIP\b/.test(upper)
    };
  }

  // Parse quality from filename
  static parseQualityFromFilename(filename: string): string {
    const upper = filename.toUpperCase();
    
    // First check for low quality sources (standalone qualities)
    if (upper.includes('WORKPRINT')) {
      return 'WORKPRINT';
    }
    if (upper.includes('CAM') || upper.includes('CAMRIP')) {
      return 'CAM';
    }
    if (upper.includes('TELESYNC') || upper.includes('HDTS') || upper.includes('PDVD')) {
      return 'TELESYNC';
    }
    if (upper.includes('TELECINE')) {
      return 'TELECINE';
    }
    if (upper.includes('DVDSCR') || upper.includes('SCREENER')) {
      return 'DVDSCR';
    }
    
    // Check for resolution
    let resolution = '';
    if (upper.includes('2160P') || upper.includes('4K') || upper.includes('UHD')) {
      resolution = '2160p';
    } else if (upper.includes('1080P')) {
      resolution = '1080p';
    } else if (upper.includes('720P')) {
      resolution = '720p';
    } else if (upper.includes('480P') || upper.includes('SD')) {
      resolution = '480p';
    }
    
    // Check for source
    let source = '';
    if (upper.includes('REMUX')) {
      source = 'Remux';
    } else if (upper.includes('BLURAY') || upper.includes('BLU-RAY') || upper.includes('BDRIP')) {
      source = 'Bluray';
    } else if (upper.includes('WEBDL') || upper.includes('WEB-DL') || upper.includes('WEB DL')) {
      source = 'WEBDL';
    } else if (upper.includes('WEBRIP') || upper.includes('WEB-RIP')) {
      source = 'WEBRip';
    } else if (upper.includes('HDTV')) {
      source = 'HDTV';
    } else if (upper.includes('DVDRIP') || upper.includes('DVD')) {
      source = 'DVD';
    } else if (upper.includes('SDTV')) {
      source = 'SDTV';
    }
    
    // Combine source and resolution
    if (source && resolution) {
      return `${source}-${resolution}`;
    } else if (resolution) {
      return resolution;
    } else if (source) {
      return source;
    }
    
    return 'Unknown';
  }

  /**
   * Check if a quality meets or exceeds the profile's cutoff
   * Returns true if the quality is at or above the cutoff
   */
  static meetsCutoff(profileId: string, quality: string): boolean {
    const profile = this.findById(profileId);
    if (!profile) return false;
    
    // Normalize quality for comparison
    const normalizedQuality = this.normalizeQualityToGroup(quality);
    
    const cutoffWeight = this.getQualityWeight(profile.cutoff_quality);
    const currentWeight = this.getQualityWeight(normalizedQuality);
    
    // If we can't determine the cutoff weight, don't unmonitor (be conservative)
    if (cutoffWeight === 0) {
      return false;
    }
    
    // If we can't determine the current quality weight, don't unmonitor
    if (currentWeight === 0) {
      return false;
    }
    
    // Quality meets cutoff if it's at or above the cutoff weight
    return currentWeight >= cutoffWeight;
  }
}
