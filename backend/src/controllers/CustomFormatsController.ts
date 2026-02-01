import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CustomFormatModel, TrashGuidesFormat } from '../models/CustomFormat';
import logger from '../config/logger';

export class CustomFormatsController {
  // Get all custom formats
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const formats = CustomFormatModel.findAll();
      return res.json(formats);
    } catch (error: any) {
      logger.error('Get all custom formats error:', error);
      return res.status(500).json({ error: error.message || 'Failed to get custom formats' });
    }
  }

  // Get single custom format
  static async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const format = CustomFormatModel.findById(id);
      
      if (!format) {
        return res.status(404).json({ error: 'Custom format not found' });
      }
      
      return res.json(format);
    } catch (error: any) {
      logger.error('Get custom format error:', error);
      return res.status(500).json({ error: error.message || 'Failed to get custom format' });
    }
  }

  // Create custom format
  static async create(req: AuthRequest, res: Response) {
    try {
      const { name, media_type, specifications, include_when_renaming, trash_id } = req.body;

      if (!name || !specifications || !Array.isArray(specifications)) {
        return res.status(400).json({ error: 'Name and specifications array are required' });
      }

      // Check if name already exists for this media type
      const existing = CustomFormatModel.findByName(name, media_type || 'both');
      if (existing) {
        return res.status(409).json({ error: 'Custom format with this name already exists for this media type' });
      }

      const format = CustomFormatModel.create({
        name,
        media_type: media_type || 'both',
        specifications,
        include_when_renaming: include_when_renaming || false,
        trash_id
      });

      logger.info(`Created custom format: ${name} (${media_type || 'both'})`);
      return res.status(201).json(format);
    } catch (error: any) {
      logger.error('Create custom format error:', error);
      return res.status(500).json({ error: error.message || 'Failed to create custom format' });
    }
  }

  // Update custom format
  static async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, media_type, specifications, include_when_renaming, trash_id } = req.body;

      const existing = CustomFormatModel.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Custom format not found' });
      }

      // Check if name conflicts with another format of the same media type
      if (name && (name !== existing.name || media_type !== existing.media_type)) {
        const byName = CustomFormatModel.findByName(name, media_type || existing.media_type);
        if (byName && byName.id !== id) {
          return res.status(409).json({ error: 'Custom format with this name already exists for this media type' });
        }
      }

      const format = CustomFormatModel.update(id, {
        name,
        media_type,
        specifications,
        include_when_renaming,
        trash_id
      });

      logger.info(`Updated custom format: ${format?.name}`);
      return res.json(format);
    } catch (error: any) {
      logger.error('Update custom format error:', error);
      return res.status(500).json({ error: error.message || 'Failed to update custom format' });
    }
  }

  // Delete custom format
  static async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      
      const existing = CustomFormatModel.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Custom format not found' });
      }

      CustomFormatModel.delete(id);
      logger.info(`Deleted custom format: ${existing.name}`);
      
      return res.json({ message: 'Custom format deleted' });
    } catch (error: any) {
      logger.error('Delete custom format error:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete custom format' });
    }
  }

  // Import from Trash Guides JSON
  static async import(req: AuthRequest, res: Response) {
    try {
      const { json, profileId, score, mediaType } = req.body;

      if (!json) {
        return res.status(400).json({ error: 'JSON data is required' });
      }

      // Parse JSON if string
      let formatData: TrashGuidesFormat;
      try {
        formatData = typeof json === 'string' ? JSON.parse(json) : json;
      } catch (parseError) {
        return res.status(400).json({ error: 'Invalid JSON format' });
      }

      // Validate required fields
      if (!formatData.name || !formatData.specifications) {
        return res.status(400).json({ error: 'Invalid Trash Guides format: missing name or specifications' });
      }

      // Import the format with media type
      const format = CustomFormatModel.importFromTrashGuides(formatData, mediaType || 'both');
      
      // Optionally assign to profile with score
      if (profileId) {
        const useScore = score !== undefined ? score : CustomFormatModel.getDefaultScore(formatData);
        CustomFormatModel.setProfileScore(profileId, format.id, useScore);
      }

      logger.info(`Imported custom format: ${format.name} (trash_id: ${formatData.trash_id}, media_type: ${format.media_type})`);
      return res.json({
        format,
        defaultScore: CustomFormatModel.getDefaultScore(formatData)
      });
    } catch (error: any) {
      logger.error('Import custom format error:', error);
      return res.status(500).json({ error: error.message || 'Failed to import custom format' });
    }
  }

  // Bulk import multiple formats
  static async bulkImport(req: AuthRequest, res: Response) {
    try {
      const { formats, profileId, useDefaultScores, mediaType } = req.body;

      if (!formats || !Array.isArray(formats)) {
        return res.status(400).json({ error: 'Formats array is required' });
      }

      const results: Array<{ name: string; success: boolean; error?: string; score?: number }> = [];

      for (const formatJson of formats) {
        try {
          let formatData: TrashGuidesFormat;
          try {
            formatData = typeof formatJson === 'string' ? JSON.parse(formatJson) : formatJson;
          } catch {
            results.push({ name: 'Unknown', success: false, error: 'Invalid JSON' });
            continue;
          }

          const format = CustomFormatModel.importFromTrashGuides(formatData, mediaType || 'both');
          const defaultScore = CustomFormatModel.getDefaultScore(formatData);
          
          if (profileId) {
            const useScore = useDefaultScores ? defaultScore : 0;
            CustomFormatModel.setProfileScore(profileId, format.id, useScore);
          }

          results.push({ 
            name: format.name, 
            success: true,
            score: defaultScore
          });
        } catch (err: any) {
          results.push({ 
            name: formatJson?.name || 'Unknown', 
            success: false, 
            error: err.message 
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      logger.info(`Bulk imported ${successful}/${formats.length} custom formats`);

      return res.json({
        imported: successful,
        total: formats.length,
        results
      });
    } catch (error: any) {
      logger.error('Bulk import custom formats error:', error);
      return res.status(500).json({ error: error.message || 'Failed to bulk import custom formats' });
    }
  }

  // Get profile custom format scores
  static async getProfileScores(req: AuthRequest, res: Response) {
    try {
      const { profileId } = req.params;
      const scores = CustomFormatModel.getProfileScoresWithFormats(profileId);
      return res.json(scores);
    } catch (error: any) {
      logger.error('Get profile scores error:', error);
      return res.status(500).json({ error: error.message || 'Failed to get profile scores' });
    }
  }

  // Set profile custom format score
  static async setProfileScore(req: AuthRequest, res: Response) {
    try {
      const { profileId, formatId } = req.params;
      const { score } = req.body;

      if (score === undefined || typeof score !== 'number') {
        return res.status(400).json({ error: 'Score is required and must be a number' });
      }

      CustomFormatModel.setProfileScore(profileId, formatId, score);
      
      return res.json({ 
        profile_id: profileId, 
        custom_format_id: formatId, 
        score 
      });
    } catch (error: any) {
      logger.error('Set profile score error:', error);
      return res.status(500).json({ error: error.message || 'Failed to set profile score' });
    }
  }

  // Update multiple profile scores at once
  static async setProfileScores(req: AuthRequest, res: Response) {
    try {
      const { profileId } = req.params;
      const { scores } = req.body;

      if (!scores || !Array.isArray(scores)) {
        return res.status(400).json({ error: 'Scores array is required' });
      }

      for (const { customFormatId, score } of scores) {
        if (customFormatId && typeof score === 'number') {
          CustomFormatModel.setProfileScore(profileId, customFormatId, score);
        }
      }

      const updated = CustomFormatModel.getProfileScoresWithFormats(profileId);
      return res.json(updated);
    } catch (error: any) {
      logger.error('Set profile scores error:', error);
      return res.status(500).json({ error: error.message || 'Failed to set profile scores' });
    }
  }

  // Remove profile custom format score
  static async removeProfileScore(req: AuthRequest, res: Response) {
    try {
      const { profileId, formatId } = req.params;
      
      CustomFormatModel.removeProfileScore(profileId, formatId);
      return res.json({ message: 'Score removed' });
    } catch (error: any) {
      logger.error('Remove profile score error:', error);
      return res.status(500).json({ error: error.message || 'Failed to remove profile score' });
    }
  }

  // Test a release title against custom formats
  static async testRelease(req: AuthRequest, res: Response) {
    try {
      const { title, profileId, size } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Release title is required' });
      }

      // Get all formats and test each one
      const formats = CustomFormatModel.findAll();
      const matches: Array<{ format: string; matched: boolean; score?: number }> = [];

      let totalScore = 0;
      
      for (const format of formats) {
        const matched = CustomFormatModel.matchesFormat(title, format.specifications, size);
        let score: number | undefined;
        
        if (profileId) {
          const profileScores = CustomFormatModel.getProfileScores(profileId);
          const profileScore = profileScores.find(ps => ps.custom_format_id === format.id);
          if (profileScore) {
            score = profileScore.score;
            if (matched) {
              totalScore += score;
            }
          }
        }
        
        if (matched) {
          matches.push({ format: format.name, matched: true, score });
        }
      }

      return res.json({
        title,
        matchedFormats: matches,
        totalScore: profileId ? totalScore : undefined
      });
    } catch (error: any) {
      logger.error('Test release error:', error);
      return res.status(500).json({ error: error.message || 'Failed to test release' });
    }
  }

  // Calculate custom format scores for multiple releases at once
  static async scoreReleases(req: AuthRequest, res: Response) {
    try {
      const { releases, profileId } = req.body;

      if (!releases || !Array.isArray(releases)) {
        return res.status(400).json({ error: 'Releases array is required' });
      }

      if (!profileId) {
        return res.status(400).json({ error: 'Profile ID is required' });
      }

      const scores: Record<string, number> = {};
      
      for (const release of releases) {
        const title = typeof release === 'string' ? release : release.title;
        const size = typeof release === 'object' ? release.size : undefined;
        
        if (title) {
          scores[title] = CustomFormatModel.calculateReleaseScore(title, profileId, size);
        }
      }

      return res.json({ scores });
    } catch (error: any) {
      logger.error('Score releases error:', error);
      return res.status(500).json({ error: error.message || 'Failed to score releases' });
    }
  }
}
