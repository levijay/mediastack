import { Request, Response } from 'express';
import { ImportListModel } from '../models/ImportList';
import { importListService } from '../services/importListService';
import logger from '../config/logger';

export const ImportListController = {
  // Get all import lists
  async getAll(req: Request, res: Response) {
    try {
      const lists = ImportListModel.getAll();
      res.json(lists);
    } catch (error: any) {
      logger.error(`Error getting import lists: ${error.message}`);
      res.status(500).json({ error: 'Failed to get import lists' });
    }
  },

  // Get import list by ID
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const list = ImportListModel.getById(id);
      
      if (!list) {
        return res.status(404).json({ error: 'Import list not found' });
      }

      res.json(list);
    } catch (error: any) {
      logger.error(`Error getting import list: ${error.message}`);
      res.status(500).json({ error: 'Failed to get import list' });
    }
  },

  // Create new import list
  async create(req: Request, res: Response) {
    try {
      const list = ImportListModel.create(req.body);
      logger.info(`Created import list: ${list.name}`);
      res.status(201).json(list);
    } catch (error: any) {
      logger.error(`Error creating import list: ${error.message}`);
      res.status(500).json({ error: 'Failed to create import list' });
    }
  },

  // Update import list
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const list = ImportListModel.update(id, req.body);
      
      if (!list) {
        return res.status(404).json({ error: 'Import list not found' });
      }

      logger.info(`Updated import list: ${list.name}`);
      res.json(list);
    } catch (error: any) {
      logger.error(`Error updating import list: ${error.message}`);
      res.status(500).json({ error: 'Failed to update import list' });
    }
  },

  // Delete import list
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const success = ImportListModel.delete(id);
      
      if (!success) {
        return res.status(404).json({ error: 'Import list not found' });
      }

      logger.info(`Deleted import list: ${id}`);
      res.json({ message: 'Import list deleted successfully' });
    } catch (error: any) {
      logger.error(`Error deleting import list: ${error.message}`);
      res.status(500).json({ error: 'Failed to delete import list' });
    }
  },

  // Get available list types and presets
  async getListTypes(req: Request, res: Response) {
    try {
      const types = ImportListModel.getListTypes();
      res.json(types);
    } catch (error: any) {
      logger.error(`Error getting list types: ${error.message}`);
      res.status(500).json({ error: 'Failed to get list types' });
    }
  },

  // Sync a specific list
  async syncList(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const list = ImportListModel.getById(id);
      
      if (!list) {
        return res.status(404).json({ error: 'Import list not found' });
      }

      const results = await importListService.syncList(list);
      res.json({ 
        message: `Sync complete for ${list.name}`,
        ...results 
      });
    } catch (error: any) {
      logger.error(`Error syncing import list: ${error.message}`);
      res.status(500).json({ error: 'Failed to sync import list' });
    }
  },

  // Preview what a list would import
  async previewList(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const list = ImportListModel.getById(id);
      
      if (!list) {
        return res.status(404).json({ error: 'Import list not found' });
      }

      const preview = await importListService.previewList(list);
      res.json(preview);
    } catch (error: any) {
      logger.error(`Error previewing import list: ${error.message}`);
      res.status(500).json({ error: 'Failed to preview import list' });
    }
  },

  // Sync all due lists
  async syncAll(req: Request, res: Response) {
    try {
      await importListService.syncDueLists();
      res.json({ message: 'All due lists synced' });
    } catch (error: any) {
      logger.error(`Error syncing all lists: ${error.message}`);
      res.status(500).json({ error: 'Failed to sync all lists' });
    }
  }
};
