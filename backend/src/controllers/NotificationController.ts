import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { notificationService } from '../services/notification';
import logger from '../config/logger';

export class NotificationController {
  static async getAll(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const notifications = await notificationService.getAll();
      return res.json(notifications);
    } catch (error) {
      logger.error('Get notifications error:', error);
      return res.status(500).json({ error: 'Failed to get notifications' });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const notification = await notificationService.getById(id);
      
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      return res.json(notification);
    } catch (error) {
      logger.error('Get notification error:', error);
      return res.status(500).json({ error: 'Failed to get notification' });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { name, type, enabled, triggers, config } = req.body;

      if (!name || !type || !triggers || !config) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (!['pushbullet', 'pushover'].includes(type)) {
        return res.status(400).json({ error: 'Invalid notification type' });
      }

      const notification = await notificationService.create({
        name,
        type,
        enabled: enabled !== false,
        triggers,
        config
      });

      return res.status(201).json(notification);
    } catch (error) {
      logger.error('Create notification error:', error);
      return res.status(500).json({ error: 'Failed to create notification' });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { name, type, enabled, triggers, config } = req.body;

      const notification = await notificationService.update(id, {
        name,
        type,
        enabled,
        triggers,
        config
      });

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      return res.json(notification);
    } catch (error) {
      logger.error('Update notification error:', error);
      return res.status(500).json({ error: 'Failed to update notification' });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const deleted = await notificationService.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      return res.json({ success: true });
    } catch (error) {
      logger.error('Delete notification error:', error);
      return res.status(500).json({ error: 'Failed to delete notification' });
    }
  }

  static async test(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { name, type, triggers, config } = req.body;

      if (!type || !config) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await notificationService.test({
        name: name || 'Test',
        type,
        enabled: true,
        triggers: triggers || {},
        config
      });

      return res.json(result);
    } catch (error) {
      logger.error('Test notification error:', error);
      return res.status(500).json({ error: 'Failed to test notification' });
    }
  }

  static async getPushbulletDevices(req: AuthRequest, res: Response) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({ error: 'Access token required' });
      }

      const result = await notificationService.getPushbulletDevices(accessToken);
      return res.json(result);
    } catch (error: any) {
      logger.error('Get Pushbullet devices error:', error);
      return res.status(500).json({ error: error.message || 'Failed to get devices' });
    }
  }
}
