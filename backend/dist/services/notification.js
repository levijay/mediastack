"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
const uuid_1 = require("uuid");
class NotificationService {
    async getAll() {
        const rows = database_1.default.prepare('SELECT * FROM notifications ORDER BY name').all();
        return rows.map(this.parseRow);
    }
    async getById(id) {
        const row = database_1.default.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
        return row ? this.parseRow(row) : null;
    }
    async getEnabled() {
        const rows = database_1.default.prepare('SELECT * FROM notifications WHERE enabled = 1').all();
        return rows.map(this.parseRow);
    }
    async create(data) {
        const id = (0, uuid_1.v4)();
        const now = new Date().toISOString();
        database_1.default.prepare(`
      INSERT INTO notifications (id, name, type, enabled, triggers, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.type, data.enabled ? 1 : 0, JSON.stringify(data.triggers), JSON.stringify(data.config), now, now);
        return this.getById(id);
    }
    async update(id, data) {
        const existing = await this.getById(id);
        if (!existing)
            return null;
        const updates = [];
        const values = [];
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
        database_1.default.prepare(`UPDATE notifications SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        return this.getById(id);
    }
    async delete(id) {
        const result = database_1.default.prepare('DELETE FROM notifications WHERE id = ?').run(id);
        return result.changes > 0;
    }
    parseRow(row) {
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
    async notify(payload) {
        const connections = await this.getEnabled();
        for (const connection of connections) {
            // Check if this connection has the trigger enabled
            if (!connection.triggers[payload.event]) {
                continue;
            }
            try {
                await this.sendNotification(connection, payload);
                logger_1.default.info(`[NOTIFICATION] Sent ${payload.event} notification via ${connection.name}`);
            }
            catch (error) {
                logger_1.default.error(`[NOTIFICATION] Failed to send via ${connection.name}: ${error.message}`);
            }
        }
    }
    async sendNotification(connection, payload) {
        switch (connection.type) {
            case 'pushbullet':
                await this.sendPushbullet(connection.config, payload);
                break;
            case 'pushover':
                await this.sendPushover(connection.config, payload);
                break;
            default:
                throw new Error(`Unknown notification type: ${connection.type}`);
        }
    }
    async sendPushbullet(config, payload) {
        const data = {
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
        await axios_1.default.post('https://api.pushbullet.com/v2/pushes', data, {
            headers: {
                'Access-Token': config.accessToken,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
    }
    async sendPushover(config, payload) {
        const data = {
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
        await axios_1.default.post('https://api.pushover.net/1/messages.json', data, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
    }
    // Test a notification connection
    async test(connection) {
        const payload = {
            event: 'onGrab',
            title: 'MediaStack Test Notification',
            message: 'This is a test notification from MediaStack. If you received this, your notification connection is working correctly!'
        };
        try {
            await this.sendNotification(connection, payload);
            return { success: true, message: 'Test notification sent successfully!' };
        }
        catch (error) {
            const errorMessage = error.response?.data?.error?.message || error.response?.data?.errors?.[0] || error.message;
            return { success: false, message: `Failed to send test notification: ${errorMessage}` };
        }
    }
    // Get Pushbullet devices for the given access token
    async getPushbulletDevices(accessToken) {
        try {
            const response = await axios_1.default.get('https://api.pushbullet.com/v2/devices', {
                headers: {
                    'Access-Token': accessToken
                },
                timeout: 10000
            });
            const devices = response.data.devices
                .filter((d) => d.active)
                .map((d) => ({
                iden: d.iden,
                nickname: d.nickname || d.model || 'Unknown Device'
            }));
            return { devices };
        }
        catch (error) {
            throw new Error(error.response?.data?.error?.message || 'Failed to fetch devices');
        }
    }
}
exports.notificationService = new NotificationService();
//# sourceMappingURL=notification.js.map