import { Request, Response } from 'express';
import { QualityProfileModel } from '../models/QualityProfile';
import { NamingConfigModel } from '../models/NamingConfig';
import { fileNamingService } from '../services/fileNaming';
import { AuthRequest } from '../middleware/auth';
import db from '../config/database';
import logger from '../config/logger';

export class MediaManagementController {
  // ========== Quality Profiles ==========

  // Get all quality definitions
  static async getQualityDefinitions(req: AuthRequest, res: Response) {
    try {
      const definitions = QualityProfileModel.getAllDefinitions();
      return res.json(definitions);
    } catch (error) {
      logger.error('Get quality definitions error:', error);
      return res.status(500).json({ error: 'Failed to get quality definitions' });
    }
  }

  // Get all quality profiles
  static async getQualityProfiles(req: AuthRequest, res: Response) {
    try {
      const profiles = QualityProfileModel.getAll();
      return res.json(profiles);
    } catch (error) {
      logger.error('Get quality profiles error:', error);
      return res.status(500).json({ error: 'Failed to get quality profiles' });
    }
  }

  // Get quality profile by ID
  static async getQualityProfile(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const profile = QualityProfileModel.findById(id);
      
      if (!profile) {
        return res.status(404).json({ error: 'Quality profile not found' });
      }
      
      return res.json(profile);
    } catch (error) {
      logger.error('Get quality profile error:', error);
      return res.status(500).json({ error: 'Failed to get quality profile' });
    }
  }

  // Create quality profile
  static async createQualityProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { name, media_type, cutoff_quality, upgrade_allowed, items } = req.body;

      if (!name || !cutoff_quality || !items) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if name already exists
      const existing = QualityProfileModel.findByName(name);
      if (existing) {
        return res.status(409).json({ error: 'A profile with this name already exists' });
      }

      const profile = QualityProfileModel.create({
        name,
        media_type: media_type || 'both',
        cutoff_quality,
        upgrade_allowed: upgrade_allowed !== false,
        items
      });

      logger.info(`Quality profile created: ${name} by ${req.user.username}`);
      return res.status(201).json(profile);
    } catch (error) {
      logger.error('Create quality profile error:', error);
      return res.status(500).json({ error: 'Failed to create quality profile' });
    }
  }

  // Update quality profile
  static async updateQualityProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { name, media_type, cutoff_quality, upgrade_allowed, items } = req.body;

      const profile = QualityProfileModel.update(id, {
        name,
        media_type,
        cutoff_quality,
        upgrade_allowed,
        items
      });

      if (!profile) {
        return res.status(404).json({ error: 'Quality profile not found' });
      }

      logger.info(`Quality profile updated: ${profile.name} by ${req.user.username}`);
      return res.json(profile);
    } catch (error) {
      logger.error('Update quality profile error:', error);
      return res.status(500).json({ error: 'Failed to update quality profile' });
    }
  }

  // Delete quality profile
  static async deleteQualityProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      
      // Set quality_profile_id to null for all movies and series using this profile
      const updateMoviesStmt = db.prepare('UPDATE movies SET quality_profile_id = NULL WHERE quality_profile_id = ?');
      updateMoviesStmt.run(id);
      
      const updateSeriesStmt = db.prepare('UPDATE tv_series SET quality_profile_id = NULL WHERE quality_profile_id = ?');
      updateSeriesStmt.run(id);

      const deleted = QualityProfileModel.delete(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Quality profile not found' });
      }

      logger.info(`Quality profile deleted by ${req.user.username}, linked movies/series set to no profile`);
      return res.json({ success: true });
    } catch (error) {
      logger.error('Delete quality profile error:', error);
      return res.status(500).json({ error: 'Failed to delete quality profile' });
    }
  }

  // ========== Naming Configuration ==========

  // Get naming configuration
  static async getNamingConfig(req: AuthRequest, res: Response) {
    try {
      const config = NamingConfigModel.get();
      return res.json(config);
    } catch (error) {
      logger.error('Get naming config error:', error);
      return res.status(500).json({ error: 'Failed to get naming configuration' });
    }
  }

  // Update naming configuration
  static async updateNamingConfig(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const config = NamingConfigModel.update(req.body);
      
      // Refresh the file naming service config
      fileNamingService.refreshConfig();

      logger.info(`Naming config updated by ${req.user.username}`);
      return res.json(config);
    } catch (error) {
      logger.error('Update naming config error:', error);
      return res.status(500).json({ error: 'Failed to update naming configuration' });
    }
  }

  // Get naming tokens
  static async getNamingTokens(req: AuthRequest, res: Response) {
    try {
      return res.json({
        movie: NamingConfigModel.getMovieTokens(),
        episode: NamingConfigModel.getEpisodeTokens(),
        folder: NamingConfigModel.getFolderTokens()
      });
    } catch (error) {
      logger.error('Get naming tokens error:', error);
      return res.status(500).json({ error: 'Failed to get naming tokens' });
    }
  }

  // Preview naming format
  static async previewNaming(req: AuthRequest, res: Response) {
    try {
      const { type, format } = req.body;

      // Temporarily update the service config
      const originalConfig = NamingConfigModel.get();
      
      let preview = '';

      if (type === 'movie') {
        const sampleMovie = {
          title: 'The Movie Title',
          year: 2024,
          tmdbId: 12345,
          imdbId: 'tt1234567',
          quality: 'Bluray-1080p',
          videoCodec: 'x265',
          audioCodec: 'DTS',
          audioChannels: '5.1',
          dynamicRange: 'HDR',
          releaseGroup: 'SPARKS',
          proper: false
        };
        
        // Apply temporary format
        if (format) {
          NamingConfigModel.update({ standard_movie_format: format });
          fileNamingService.refreshConfig();
        }
        
        preview = fileNamingService.previewMovieFilename(sampleMovie);
        
        // Restore original
        if (format) {
          NamingConfigModel.update({ standard_movie_format: originalConfig.standard_movie_format });
          fileNamingService.refreshConfig();
        }
      } else if (type === 'episode') {
        const sampleEpisode = {
          seriesTitle: "The Series Title's!",
          seriesYear: 2020,
          seasonNumber: 1,
          episodeNumber: 1,
          episodeTitle: 'Episode Title 1',
          airDate: '2020-01-15',
          absoluteNumber: 1,
          tvdbId: 12345,
          tmdbId: 67890,
          quality: 'WEBDL-1080p',
          videoCodec: 'x264',
          audioCodec: 'AAC',
          audioChannels: '2.0',
          releaseGroup: 'LOL',
          proper: true
        };
        
        if (format) {
          NamingConfigModel.update({ standard_episode_format: format });
          fileNamingService.refreshConfig();
        }
        
        preview = fileNamingService.previewEpisodeFilename(sampleEpisode);
        
        if (format) {
          NamingConfigModel.update({ standard_episode_format: originalConfig.standard_episode_format });
          fileNamingService.refreshConfig();
        }
      } else if (type === 'movie_folder') {
        const sampleMovie = {
          title: 'The Movie Title',
          year: 2024,
          tmdbId: 12345,
          imdbId: 'tt1234567'
        };
        
        if (format) {
          NamingConfigModel.update({ movie_folder_format: format });
          fileNamingService.refreshConfig();
        }
        
        preview = fileNamingService.previewMovieFolderName(sampleMovie);
        
        if (format) {
          NamingConfigModel.update({ movie_folder_format: originalConfig.movie_folder_format });
          fileNamingService.refreshConfig();
        }
      } else if (type === 'series_folder') {
        const sampleSeries = {
          title: "The Series Title's!",
          year: 2020,
          tvdbId: 12345,
          tmdbId: 67890
        };
        
        if (format) {
          NamingConfigModel.update({ series_folder_format: format });
          fileNamingService.refreshConfig();
        }
        
        preview = fileNamingService.previewSeriesFolderName(sampleSeries);
        
        if (format) {
          NamingConfigModel.update({ series_folder_format: originalConfig.series_folder_format });
          fileNamingService.refreshConfig();
        }
      } else if (type === 'season_folder') {
        if (format) {
          NamingConfigModel.update({ season_folder_format: format });
          fileNamingService.refreshConfig();
        }
        
        preview = fileNamingService.previewSeasonFolderName(1);
        
        if (format) {
          NamingConfigModel.update({ season_folder_format: originalConfig.season_folder_format });
          fileNamingService.refreshConfig();
        }
      }

      return res.json({ preview });
    } catch (error) {
      logger.error('Preview naming error:', error);
      return res.status(500).json({ error: 'Failed to preview naming format' });
    }
  }

  // ========== File Management Settings ==========

  static async getFileManagementSettings(req: AuthRequest, res: Response) {
    try {
      // Default settings
      const defaults = {
        propers_repacks_preference: 'preferAndUpgrade',
        delete_empty_folders: true,
        unmonitor_deleted_media: true
      };

      // Get from database
      const settings: any = {};
      
      const propersResult = db.prepare("SELECT value FROM system_settings WHERE key = 'propers_repacks_preference'").get() as { value: string } | undefined;
      settings.propers_repacks_preference = propersResult?.value || defaults.propers_repacks_preference;
      
      const deleteEmptyResult = db.prepare("SELECT value FROM system_settings WHERE key = 'delete_empty_folders'").get() as { value: string } | undefined;
      settings.delete_empty_folders = deleteEmptyResult?.value !== 'false';

      const unmonitorResult = db.prepare("SELECT value FROM system_settings WHERE key = 'unmonitor_deleted_media'").get() as { value: string } | undefined;
      settings.unmonitor_deleted_media = unmonitorResult?.value !== 'false';

      return res.json(settings);
    } catch (error) {
      logger.error('Get file management settings error:', error);
      return res.status(500).json({ error: 'Failed to get file management settings' });
    }
  }

  static async updateFileManagementSettings(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { propers_repacks_preference, delete_empty_folders, unmonitor_deleted_media } = req.body;

      // Validate propers_repacks_preference
      const validPreferences = ['preferAndUpgrade', 'doNotUpgrade', 'doNotPrefer'];
      if (propers_repacks_preference && !validPreferences.includes(propers_repacks_preference)) {
        return res.status(400).json({ error: 'Invalid propers_repacks_preference value' });
      }

      // Update settings
      if (propers_repacks_preference !== undefined) {
        db.prepare(`
          INSERT INTO system_settings (key, value) VALUES ('propers_repacks_preference', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).run(propers_repacks_preference);
      }

      if (delete_empty_folders !== undefined) {
        db.prepare(`
          INSERT INTO system_settings (key, value) VALUES ('delete_empty_folders', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).run(delete_empty_folders ? 'true' : 'false');
      }

      if (unmonitor_deleted_media !== undefined) {
        db.prepare(`
          INSERT INTO system_settings (key, value) VALUES ('unmonitor_deleted_media', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).run(unmonitor_deleted_media ? 'true' : 'false');
      }

      logger.info(`File management settings updated by ${req.user.username}`);

      // Return updated settings
      return MediaManagementController.getFileManagementSettings(req, res);
    } catch (error) {
      logger.error('Update file management settings error:', error);
      return res.status(500).json({ error: 'Failed to update file management settings' });
    }
  }
}
