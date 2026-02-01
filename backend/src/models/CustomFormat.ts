import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';

// Specification types supported by Radarr/Sonarr
export type SpecificationType = 
  | 'ReleaseTitleSpecification'
  | 'SourceSpecification'
  | 'ResolutionSpecification'
  | 'ReleaseGroupSpecification'
  | 'LanguageSpecification'
  | 'IndexerFlagSpecification'
  | 'SizeSpecification'
  | 'QualityModifierSpecification';

// Source type values (from Radarr)
export const SOURCE_VALUES: Record<number, string> = {
  0: 'Unknown',
  1: 'CAM',
  2: 'TeleCine',
  3: 'TeleSync',
  4: 'Workprint',
  5: 'DVD',
  6: 'TV',
  7: 'WEBDL',
  8: 'WEBRip',
  9: 'BluRay'
};

// Resolution values
export const RESOLUTION_VALUES: Record<number, string> = {
  0: 'Unknown',
  240: '240p',
  360: '360p',
  480: '480p',
  540: '540p',
  576: '576p',
  720: '720p',
  1080: '1080p',
  2160: '2160p'
};

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

export class CustomFormatModel {
  static create(data: Omit<CustomFormat, 'id' | 'created_at' | 'updated_at'>): CustomFormat {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO custom_formats (id, name, media_type, trash_id, include_when_renaming, specifications)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.name,
      data.media_type || 'both',
      data.trash_id || null,
      data.include_when_renaming ? 1 : 0,
      JSON.stringify(data.specifications)
    );
    return this.findById(id)!;
  }

  static findById(id: string): CustomFormat | undefined {
    const stmt = db.prepare('SELECT * FROM custom_formats WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  }

  static findByTrashId(trashId: string, mediaType?: 'movie' | 'series' | 'both'): CustomFormat | undefined {
    if (mediaType) {
      const stmt = db.prepare('SELECT * FROM custom_formats WHERE trash_id = ? AND media_type = ?');
      const row = stmt.get(trashId, mediaType) as any;
      if (row) return this.mapRow(row);
    }
    // Fall back to any media type
    const stmt = db.prepare('SELECT * FROM custom_formats WHERE trash_id = ?');
    const row = stmt.get(trashId) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  }

  static findByName(name: string, mediaType?: 'movie' | 'series' | 'both'): CustomFormat | undefined {
    if (mediaType) {
      const stmt = db.prepare('SELECT * FROM custom_formats WHERE name = ? AND media_type = ?');
      const row = stmt.get(name, mediaType) as any;
      if (row) return this.mapRow(row);
    }
    // Fall back to any media type
    const stmt = db.prepare('SELECT * FROM custom_formats WHERE name = ?');
    const row = stmt.get(name) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  }

  static findAll(): CustomFormat[] {
    const stmt = db.prepare('SELECT * FROM custom_formats ORDER BY name ASC');
    const rows = stmt.all() as any[];
    return rows.map(this.mapRow);
  }

  static findByMediaType(mediaType: 'movie' | 'series'): CustomFormat[] {
    const stmt = db.prepare('SELECT * FROM custom_formats WHERE media_type = ? OR media_type = ? ORDER BY name ASC');
    const rows = stmt.all(mediaType, 'both') as any[];
    return rows.map(this.mapRow);
  }

  static update(id: string, data: Partial<Omit<CustomFormat, 'id' | 'created_at' | 'updated_at'>>): CustomFormat | undefined {
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
    if (data.trash_id !== undefined) {
      updates.push('trash_id = ?');
      values.push(data.trash_id);
    }
    if (data.include_when_renaming !== undefined) {
      updates.push('include_when_renaming = ?');
      values.push(data.include_when_renaming ? 1 : 0);
    }
    if (data.specifications !== undefined) {
      updates.push('specifications = ?');
      values.push(JSON.stringify(data.specifications));
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      const stmt = db.prepare(`UPDATE custom_formats SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }

    return this.findById(id);
  }

  static delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM custom_formats WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  static count(): number {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM custom_formats');
    return (stmt.get() as any).count;
  }

  // Import from Trash Guides JSON format
  static importFromTrashGuides(json: TrashGuidesFormat, mediaType: 'movie' | 'series' | 'both' = 'both'): CustomFormat {
    // Check if already exists by trash_id for this media type
    const existing = this.findByTrashId(json.trash_id, mediaType);
    if (existing) {
      // Update existing
      return this.update(existing.id, {
        name: json.name,
        include_when_renaming: json.includeCustomFormatWhenRenaming,
        specifications: json.specifications as Specification[]
      })!;
    }

    // Check if exists by name for this media type
    const byName = this.findByName(json.name, mediaType);
    if (byName) {
      // Update existing
      return this.update(byName.id, {
        trash_id: json.trash_id,
        include_when_renaming: json.includeCustomFormatWhenRenaming,
        specifications: json.specifications as Specification[]
      })!;
    }

    // Create new with media type
    return this.create({
      name: json.name,
      media_type: mediaType,
      trash_id: json.trash_id,
      include_when_renaming: json.includeCustomFormatWhenRenaming,
      specifications: json.specifications as Specification[]
    });
  }

  // Get default score from Trash Guides format
  static getDefaultScore(json: TrashGuidesFormat): number {
    if (json.trash_scores?.default !== undefined) {
      return json.trash_scores.default;
    }
    return 0;
  }

  // Quality Profile Custom Format Score management
  static setProfileScore(profileId: string, customFormatId: string, score: number): void {
    const stmt = db.prepare(`
      INSERT INTO quality_profile_custom_formats (profile_id, custom_format_id, score)
      VALUES (?, ?, ?)
      ON CONFLICT(profile_id, custom_format_id) DO UPDATE SET score = ?
    `);
    stmt.run(profileId, customFormatId, score, score);
  }

  static getProfileScores(profileId: string): QualityProfileCustomFormat[] {
    const stmt = db.prepare(`
      SELECT * FROM quality_profile_custom_formats WHERE profile_id = ?
    `);
    return stmt.all(profileId) as QualityProfileCustomFormat[];
  }

  static getProfileScoresWithFormats(profileId: string): Array<QualityProfileCustomFormat & { format: CustomFormat }> {
    const stmt = db.prepare(`
      SELECT qpcf.*, cf.name as format_name, cf.media_type, cf.specifications, cf.trash_id, cf.include_when_renaming
      FROM quality_profile_custom_formats qpcf
      JOIN custom_formats cf ON qpcf.custom_format_id = cf.id
      WHERE qpcf.profile_id = ?
    `);
    const rows = stmt.all(profileId) as any[];
    return rows.map(row => ({
      profile_id: row.profile_id,
      custom_format_id: row.custom_format_id,
      score: row.score,
      format: {
        id: row.custom_format_id,
        name: row.format_name,
        media_type: row.media_type || 'both',
        trash_id: row.trash_id,
        include_when_renaming: row.include_when_renaming === 1,
        specifications: JSON.parse(row.specifications)
      }
    }));
  }

  static removeProfileScore(profileId: string, customFormatId: string): boolean {
    const stmt = db.prepare(`
      DELETE FROM quality_profile_custom_formats WHERE profile_id = ? AND custom_format_id = ?
    `);
    return stmt.run(profileId, customFormatId).changes > 0;
  }

  static clearProfileScores(profileId: string): number {
    const stmt = db.prepare('DELETE FROM quality_profile_custom_formats WHERE profile_id = ?');
    return stmt.run(profileId).changes;
  }

  // Calculate custom format score for a release
  static calculateReleaseScore(releaseTitle: string, profileId: string, releaseSize?: number): number {
    const profileScores = this.getProfileScoresWithFormats(profileId);
    let totalScore = 0;

    for (const { score, format } of profileScores) {
      if (this.matchesFormat(releaseTitle, format.specifications, releaseSize)) {
        totalScore += score;
      }
    }

    return totalScore;
  }

  // Check if a release matches a custom format
  static matchesFormat(releaseTitle: string, specifications: Specification[], releaseSize?: number): boolean {
    // All required specs must match (AND logic)
    // At least one non-required spec must match (OR logic) if there are non-required specs
    const requiredSpecs = specifications.filter(s => s.required);
    const optionalSpecs = specifications.filter(s => !s.required);

    // Check all required specs
    for (const spec of requiredSpecs) {
      const matches = this.matchesSpecification(releaseTitle, spec, releaseSize);
      const result = spec.negate ? !matches : matches;
      if (!result) return false;
    }

    // If no optional specs, we're done
    if (optionalSpecs.length === 0) return true;

    // At least one optional spec must match
    for (const spec of optionalSpecs) {
      const matches = this.matchesSpecification(releaseTitle, spec, releaseSize);
      const result = spec.negate ? !matches : matches;
      if (result) return true;
    }

    return false;
  }

  // Check if a release matches a single specification
  static matchesSpecification(releaseTitle: string, spec: Specification, releaseSize?: number): boolean {
    switch (spec.implementation) {
      case 'ReleaseTitleSpecification':
        try {
          const regex = new RegExp(spec.fields.value as string, 'i');
          return regex.test(releaseTitle);
        } catch {
          return false;
        }

      case 'ReleaseGroupSpecification':
        try {
          // Extract release group from title (typically at the end after a dash)
          const groupMatch = releaseTitle.match(/-([A-Za-z0-9]+)(?:\.[^.]+)?$/);
          if (!groupMatch) return false;
          const regex = new RegExp(spec.fields.value as string, 'i');
          return regex.test(groupMatch[1]);
        } catch {
          return false;
        }

      case 'SourceSpecification': {
        const sourceValue = spec.fields.value as number;
        const sourceName = SOURCE_VALUES[sourceValue]?.toLowerCase();
        if (!sourceName) return false;
        
        const titleLower = releaseTitle.toLowerCase();
        switch (sourceValue) {
          case 7: // WEBDL
            return /web-?dl/i.test(releaseTitle);
          case 8: // WEBRip
            return /webrip/i.test(releaseTitle) && !/web-?dl/i.test(releaseTitle);
          case 9: // BluRay
            return /blu-?ray|bdrip|brrip/i.test(releaseTitle);
          case 5: // DVD
            return /dvdrip|dvd-?r/i.test(releaseTitle);
          case 6: // TV
            return /hdtv|pdtv|dsr/i.test(releaseTitle);
          case 1: // CAM
            return /\bcam\b/i.test(releaseTitle);
          case 2: // TeleCine
            return /\btc\b|telecine/i.test(releaseTitle);
          case 3: // TeleSync
            return /\bts\b|telesync|hdts/i.test(releaseTitle);
          default:
            return titleLower.includes(sourceName);
        }
      }

      case 'ResolutionSpecification': {
        const resValue = spec.fields.value as number;
        const titleUpper = releaseTitle.toUpperCase();
        
        switch (resValue) {
          case 2160:
            return titleUpper.includes('2160P') || titleUpper.includes('4K') || titleUpper.includes('UHD');
          case 1080:
            return titleUpper.includes('1080P') || titleUpper.includes('1080I');
          case 720:
            return titleUpper.includes('720P');
          case 480:
            return titleUpper.includes('480P') || titleUpper.includes('SD');
          default:
            return titleUpper.includes(`${resValue}P`);
        }
      }

      case 'SizeSpecification': {
        if (releaseSize === undefined) return true; // Can't evaluate without size
        const minBytes = (spec.fields.min || 0) * 1024 * 1024 * 1024; // GB to bytes
        const maxBytes = (spec.fields.max || Infinity) * 1024 * 1024 * 1024;
        return releaseSize >= minBytes && releaseSize <= maxBytes;
      }

      case 'LanguageSpecification': {
        // Basic language detection from title
        const langValue = spec.fields.value as number;
        const titleLower = releaseTitle.toLowerCase();
        
        // Common language indicators
        switch (langValue) {
          case 1: // English
            return !titleLower.match(/german|deutsch|french|fran[cç]ais|spanish|espa[nñ]ol|italian|italiano|japanese|korean|chinese|mandarin|hindi|russian|portuguese/i);
          case 4: // German
            return /german|deutsch|ger\b/i.test(releaseTitle);
          case 3: // French
            return /french|fran[cç]ais|vff|vfi|vf2/i.test(releaseTitle);
          case 5: // Spanish
            return /spanish|espa[nñ]ol|latino/i.test(releaseTitle);
          case 6: // Italian
            return /italian|italiano/i.test(releaseTitle);
          case 8: // Japanese
            return /japanese|jpn/i.test(releaseTitle);
          default:
            return true;
        }
      }

      case 'IndexerFlagSpecification': {
        // This would require indexer information we don't have here
        // For now, check common title indicators
        const titleLower = releaseTitle.toLowerCase();
        const flagValue = spec.fields.value as number;
        
        // 1 = Freeleech, 2 = Halfleech, etc.
        if (flagValue === 1) {
          return /freeleech/i.test(releaseTitle);
        }
        return false;
      }

      case 'QualityModifierSpecification': {
        const modValue = spec.fields.value as number;
        const titleUpper = releaseTitle.toUpperCase();
        
        // Common modifiers
        switch (modValue) {
          case 1: // REMUX
            return titleUpper.includes('REMUX');
          case 2: // Proper
            return titleUpper.includes('PROPER');
          case 3: // Repack
            return titleUpper.includes('REPACK');
          case 4: // Real
            return titleUpper.includes('REAL');
          default:
            return false;
        }
      }

      default:
        return false;
    }
  }

  private static mapRow(row: any): CustomFormat {
    return {
      id: row.id,
      name: row.name,
      media_type: row.media_type || 'both',
      trash_id: row.trash_id,
      include_when_renaming: row.include_when_renaming === 1,
      specifications: JSON.parse(row.specifications),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
