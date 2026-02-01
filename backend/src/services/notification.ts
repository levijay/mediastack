import axios from 'axios';
import db from '../config/database';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

export interface NotificationTriggers {
  onGrab: boolean;
  onFileImport: boolean;
  onFileUpgrade: boolean;
  onImportComplete: boolean;
  onRename: boolean;
  onMovieAdd: boolean;
  onMovieDelete: boolean;
  onSeriesAdd: boolean;
  onSeriesDelete: boolean;
  onEpisodeFileDelete: boolean;
  onEpisodeFileDeleteForUpgrade: boolean;
}

export interface PushbulletConfig {
  accessToken: string;
  deviceIds?: string;
  channelTags?: string;
  senderId?: string;
}

export interface PushoverConfig {
  apiKey: string;
  userKey: string;
  devices?: string;
  priority: number;
  retry?: number;
  expire?: number;
  sound?: string;
}

export interface NotificationConnection {
  id: string;
  name: string;
  type: 'pushbullet' | 'pushover';
  enabled: boolean;
  triggers: NotificationTriggers;
  config: PushbulletConfig | PushoverConfig;
  created_at?: string;
  updated_at?: string;
}

export type NotificationEvent = keyof NotificationTriggers;

export interface NotificationPayload {
  event: NotificationEvent;
  title: string;
  message: string;
  mediaType?: 'movie' | 'series' | 'episode';
  mediaTitle?: string;
}

class NotificationService {
  async getAll(): Promise<NotificationConnection[]> {
    const rows = db.prepare('SELECT * FROM notifications ORDER BY name').all() as any[];
    return rows.map(this.parseRow);
  }

  async getById(id: string): Promise<NotificationConnection | null> {
    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any;
    return row ? this.parseRow(row) : null;
  }

  async getEnabled(): Promise<NotificationConnection[]> {
    const rows = db.prepare('SELECT * FROM notifications WHERE enabled = 1').all() as any[];
    return rows.map(this.parseRow);
  }

  async create(data: Omit<NotificationConnection, 'id' | 'created_at' | 'updated_at'>): Promise<NotificationConnection> {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO notifications (id, name, type, enabled, triggers, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.type,
      data.enabled ? 1 : 0,
      JSON.stringify(data.triggers),
      JSON.stringify(data.config),
      now,
      now
    );

    return this.getById(id) as Promise<NotificationConnection>;
  }

  async update(id: string, data: Partial<Omit<NotificationConnection, 'id' | 'created_at' | 'updated_at'>>): Promise<NotificationConnection | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.type !== undefined) {
      updates.push('type = ?');
      values.push(data.type);
    }
    if (data.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(data.enabled ? 1 : 0);
    }
    if (data.triggers !== undefined) {
      updates.push('triggers = ?');
      values.push(JSON.stringify(data.triggers));
    }
    if (data.config !== undefined) {
      updates.push('config = ?');
      values.push(JSON.stringify(data.config));
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE notifications SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private parseRow(row: any): NotificationConnection {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      enabled: row.enabled === 1,
      triggers: JSON.parse(row.triggers || '{}'),
      config: JSON.parse(row.config || '{}'),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // Send notification to all enabled connections for a specific event
  async notify(payload: NotificationPayload): Promise<void> {
    const connections = await this.getEnabled();
    
    for (const connection of connections) {
      // Check if this connection has the trigger enabled
      if (!connection.triggers[payload.event]) {
        continue;
      }

      try {
        await this.sendNotification(connection, payload);
        logger.info(`[NOTIFICATION] Sent ${payload.event} notification via ${connection.name}`);
      } catch (error: any) {
        logger.error(`[NOTIFICATION] Failed to send via ${connection.name}: ${error.message}`);
      }
    }
  }

  private async sendNotification(connection: NotificationConnection, payload: NotificationPayload): Promise<void> {
    switch (connection.type) {
      case 'pushbullet':
        await this.sendPushbullet(connection.config as PushbulletConfig, payload);
        break;
      case 'pushover':
        await this.sendPushover(connection.config as PushoverConfig, payload);
        break;
      default:
        throw new Error(`Unknown notification type: ${connection.type}`);
    }
  }

  private async sendPushbullet(config: PushbulletConfig, payload: NotificationPayload): Promise<void> {
    const data: any = {
      type: 'note',
      title: payload.title,
      body: payload.message
    };

    // If device IDs specified, send to each device
    if (config.deviceIds) {
      data.device_iden = config.deviceIds;
    }

    // If channel tag specified, send to channel
    if (config.channelTags) {
      data.channel_tag = config.channelTags;
    }

    // If sender ID specified
    if (config.senderId) {
      data.source_device_iden = config.senderId;
    }

    await axios.post('https://api.pushbullet.com/v2/pushes', data, {
      headers: {
        'Access-Token': config.accessToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  private async sendPushover(config: PushoverConfig, payload: NotificationPayload): Promise<void> {
    const data: any = {
      token: config.apiKey,
      user: config.userKey,
      title: payload.title,
      message: payload.message,
      priority: config.priority || 0
    };

    // If devices specified
    if (config.devices) {
      data.device = config.devices;
    }

    // For emergency priority (2), retry and expire are required
    if (config.priority === 2) {
      data.retry = config.retry || 60;
      data.expire = config.expire || 3600;
    }

    // Optional sound
    if (config.sound) {
      data.sound = config.sound;
    }

    await axios.post('https://api.pushover.net/1/messages.json', data, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  // Test a notification connection
  async test(connection: Omit<NotificationConnection, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; message: string }> {
    const payload: NotificationPayload = {
      event: 'onGrab',
      title: 'MediaStack Test Notification',
      message: 'This is a test notification from MediaStack. If you received this, your notification connection is working correctly!'
    };

    try {
      await this.sendNotification(connection as NotificationConnection, payload);
      return { success: true, message: 'Test notification sent successfully!' };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.errors?.[0] || error.message;
      return { success: false, message: `Failed to send test notification: ${errorMessage}` };
    }
  }

  // Get Pushbullet devices for the given access token
  async getPushbulletDevices(accessToken: string): Promise<{ devices: Array<{ iden: string; nickname: string }> }> {
    try {
      const response = await axios.get('https://api.pushbullet.com/v2/devices', {
        headers: {
          'Access-Token': accessToken
        },
        timeout: 10000
      });
      
      const devices = response.data.devices
        .filter((d: any) => d.active)
        .map((d: any) => ({
          iden: d.iden,
          nickname: d.nickname || d.model || 'Unknown Device'
        }));
      
      return { devices };
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Failed to fetch devices');
    }
  }
}

export const notificationService = new NotificationService();
