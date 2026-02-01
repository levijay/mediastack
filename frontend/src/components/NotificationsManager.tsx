import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Button } from './common/Button';
import { Input } from './common/Input';
import { ConfirmModal } from './ConfirmModal';

interface NotificationTriggers {
  [key: string]: boolean;
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

interface NotificationConnection {
  id: string;
  name: string;
  type: 'pushbullet' | 'pushover';
  enabled: boolean;
  triggers: NotificationTriggers;
  config: Record<string, any>;
}

interface Props {
  onToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const defaultTriggers: NotificationTriggers = {
  onGrab: true,
  onFileImport: true,
  onFileUpgrade: true,
  onImportComplete: true,
  onRename: false,
  onMovieAdd: true,
  onMovieDelete: true,
  onSeriesAdd: true,
  onSeriesDelete: true,
  onEpisodeFileDelete: true,
  onEpisodeFileDeleteForUpgrade: true
};

const triggerLabels: Record<keyof NotificationTriggers, string> = {
  onGrab: 'On Grab',
  onFileImport: 'On File Import',
  onFileUpgrade: 'On File Upgrade',
  onImportComplete: 'On Import Complete',
  onRename: 'On Rename',
  onMovieAdd: 'On Movie Add',
  onMovieDelete: 'On Movie Delete',
  onSeriesAdd: 'On Series Add',
  onSeriesDelete: 'On Series Delete',
  onEpisodeFileDelete: 'On Episode File Delete',
  onEpisodeFileDeleteForUpgrade: 'On Episode File Delete For Upgrade'
};

export function NotificationsManager({ onToast }: Props) {
  const [connections, setConnections] = useState<NotificationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState<NotificationConnection | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<NotificationConnection | null>(null);

  // Form state
  const [formType, setFormType] = useState<'pushbullet' | 'pushover'>('pushbullet');
  const [formName, setFormName] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formTriggers, setFormTriggers] = useState<NotificationTriggers>(defaultTriggers);
  
  // Pushbullet config
  const [pbAccessToken, setPbAccessToken] = useState('');
  const [pbDeviceIds, setPbDeviceIds] = useState('');
  const [pbChannelTags, setPbChannelTags] = useState('');
  const [pbSenderId, setPbSenderId] = useState('');
  const [pbDevices, setPbDevices] = useState<Array<{ iden: string; nickname: string }>>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  
  // Pushover config
  const [poApiKey, setPoApiKey] = useState('');
  const [poUserKey, setPoUserKey] = useState('');
  const [poDevices, setPoDevices] = useState('');
  const [poPriority, setPoPriority] = useState(0);
  const [poRetry, setPoRetry] = useState(60);
  const [poExpire, setPoExpire] = useState(3600);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const data = await api.getNotifications();
      setConnections(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = (type: 'pushbullet' | 'pushover') => {
    setFormType(type);
    setFormName(type === 'pushbullet' ? 'Pushbullet' : 'Pushover');
    setFormEnabled(true);
    setFormTriggers({ ...defaultTriggers });
    setPbAccessToken('');
    setPbDeviceIds('');
    setPbChannelTags('');
    setPbSenderId('');
    setPbDevices([]);
    setPoApiKey('');
    setPoUserKey('');
    setPoDevices('');
    setPoPriority(0);
    setPoRetry(60);
    setPoExpire(3600);
    setTestResult(null);
    setEditingConnection(null);
    setShowTypeSelector(false);
    setShowModal(true);
  };

  const openEditModal = (connection: NotificationConnection) => {
    setFormType(connection.type);
    setFormName(connection.name);
    setFormEnabled(connection.enabled);
    setFormTriggers({ ...defaultTriggers, ...connection.triggers });
    
    if (connection.type === 'pushbullet') {
      setPbAccessToken(connection.config.accessToken || '');
      setPbDeviceIds(connection.config.deviceIds || '');
      setPbChannelTags(connection.config.channelTags || '');
      setPbSenderId(connection.config.senderId || '');
    } else {
      setPoApiKey(connection.config.apiKey || '');
      setPoUserKey(connection.config.userKey || '');
      setPoDevices(connection.config.devices || '');
      setPoPriority(connection.config.priority || 0);
      setPoRetry(connection.config.retry || 60);
      setPoExpire(connection.config.expire || 3600);
    }
    
    setTestResult(null);
    setEditingConnection(connection);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setShowTypeSelector(false);
    setEditingConnection(null);
    setTestResult(null);
  };

  const getConfig = () => {
    if (formType === 'pushbullet') {
      return {
        accessToken: pbAccessToken,
        deviceIds: pbDeviceIds || undefined,
        channelTags: pbChannelTags || undefined,
        senderId: pbSenderId || undefined
      };
    } else {
      return {
        apiKey: poApiKey,
        userKey: poUserKey,
        devices: poDevices || undefined,
        priority: poPriority,
        retry: poRetry,
        expire: poExpire
      };
    }
  };

  const handleTest = async () => {
    const config = getConfig();
    
    if (formType === 'pushbullet' && !pbAccessToken) {
      onToast('Access Token is required', 'error');
      return;
    }
    if (formType === 'pushover' && (!poApiKey || !poUserKey)) {
      onToast('API Key and User Key are required', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testNotification({
        name: formName,
        type: formType,
        triggers: formTriggers as Record<string, boolean>,
        config
      });
      setTestResult(result);
    } catch (error: any) {
      setTestResult({ success: false, message: error.response?.data?.error || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!formName) {
      onToast('Name is required', 'error');
      return;
    }
    
    const config = getConfig();
    
    if (formType === 'pushbullet' && !pbAccessToken) {
      onToast('Access Token is required', 'error');
      return;
    }
    if (formType === 'pushover' && (!poApiKey || !poUserKey)) {
      onToast('API Key and User Key are required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingConnection) {
        await api.updateNotification(editingConnection.id, {
          name: formName,
          type: formType,
          enabled: formEnabled,
          triggers: formTriggers as Record<string, boolean>,
          config
        });
        onToast('Notification updated successfully', 'success');
      } else {
        await api.createNotification({
          name: formName,
          type: formType,
          enabled: formEnabled,
          triggers: formTriggers as Record<string, boolean>,
          config
        });
        onToast('Notification added successfully', 'success');
      }
      await loadConnections();
      closeModal();
    } catch (error: any) {
      onToast(error.response?.data?.error || 'Failed to save notification', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (connection: NotificationConnection) => {
    try {
      await api.deleteNotification(connection.id);
      onToast('Notification deleted', 'success');
      await loadConnections();
    } catch (error) {
      onToast('Failed to delete notification', 'error');
    }
    setDeleteConfirm(null);
  };

  const loadPushbulletDevices = async () => {
    if (!pbAccessToken) {
      onToast('Enter access token first', 'error');
      return;
    }
    
    setLoadingDevices(true);
    try {
      const result = await api.getPushbulletDevices(pbAccessToken);
      setPbDevices(result.devices || []);
      if (result.devices?.length === 0) {
        onToast('No devices found', 'info');
      }
    } catch (error: any) {
      onToast(error.response?.data?.error || 'Failed to load devices', 'error');
    } finally {
      setLoadingDevices(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Notifications</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure notification connections for alerts and updates</p>
        </div>
        <Button onClick={() => setShowTypeSelector(true)}>
          Add Connection
        </Button>
      </div>

      {/* Connections Table */}
      <div className="border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
        <div className="table-responsive">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {connections.length === 0 ? (
                <tr style={{ backgroundColor: 'var(--card-bg)' }}>
                  <td colSpan={4} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    No notification connections configured. Click "Add Connection" to get started.
                  </td>
                </tr>
              ) : connections.map((connection) => (
                <tr
                  key={connection.id}
                  style={{ backgroundColor: 'var(--card-bg)' }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  onClick={() => openEditModal(connection)}
                >
                  <td className="px-4 py-4">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{connection.name}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      connection.type === 'pushbullet'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400'
                    }`}>
                      {connection.type === 'pushbullet' ? 'Pushbullet' : 'Pushover'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      connection.enabled
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {connection.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(connection);
                      }}
                      className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Type Selector Modal */}
      {showTypeSelector && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="w-full max-w-md shadow-xl" style={{ backgroundColor: 'var(--card-bg)' }}>
            <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Add Connection</h3>
              <button onClick={() => setShowTypeSelector(false)} className="p-1 hover:bg-gray-700 rounded transition-colors" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              {/* Pushbullet */}
              <button
                onClick={() => openAddModal('pushbullet')}
                className="w-full p-4 border rounded-lg text-left hover:border-green-500 hover:bg-green-500/5 transition-all group"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-green-600 text-white font-bold text-lg shrink-0">
                    PB
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Pushbullet</span>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Send notifications to your devices via Pushbullet</p>
                  </div>
                  <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Pushover */}
              <button
                onClick={() => openAddModal('pushover')}
                className="w-full p-4 border rounded-lg text-left hover:border-cyan-500 hover:bg-cyan-500/5 transition-all group"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-cyan-600 text-white font-bold text-lg shrink-0">
                    PO
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Pushover</span>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Send notifications via Pushover with priority support</p>
                  </div>
                  <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-800 shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingConnection ? 'Edit' : 'Add'} Connection - {formType === 'pushbullet' ? 'Pushbullet' : 'Pushover'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Notification name"
                  className="dark:bg-gray-700"
                />
              </div>

              {/* Notification Triggers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notification Triggers
                  <a href="https://wiki.servarr.com/sonarr/settings#connections" target="_blank" rel="noopener noreferrer" className="ml-2 text-sky-500 hover:text-sky-600">
                    <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select which events should trigger this notification</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded p-2" style={{ borderColor: 'var(--border-color)' }}>
                  {(Object.keys(triggerLabels) as Array<keyof NotificationTriggers>).map((key) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={formTriggers[key]}
                        onChange={(e) => setFormTriggers({ ...formTriggers, [key]: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{triggerLabels[key]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Type-specific config */}
              {formType === 'pushbullet' ? (
                <>
                  {/* Access Token */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Access Token</label>
                    <Input
                      type="password"
                      value={pbAccessToken}
                      onChange={(e) => setPbAccessToken(e.target.value)}
                      placeholder="Your Pushbullet access token"
                      className="dark:bg-gray-700"
                    />
                    <a href="https://www.pushbullet.com/#settings/account" target="_blank" rel="noopener noreferrer" className="text-xs text-sky-500 hover:text-sky-600 mt-1 inline-block">
                      More Info
                    </a>
                  </div>

                  {/* Device IDs */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Device IDs</label>
                    <div className="flex gap-2">
                      <Input
                        value={pbDeviceIds}
                        onChange={(e) => setPbDeviceIds(e.target.value)}
                        placeholder="Leave blank for all devices"
                        className="dark:bg-gray-700 flex-1"
                      />
                      <Button variant="secondary" onClick={loadPushbulletDevices} disabled={loadingDevices || !pbAccessToken}>
                        {loadingDevices ? '...' : '↻'}
                      </Button>
                    </div>
                    {pbDevices.length > 0 && (
                      <div className="mt-2 text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                        <p>Available devices:</p>
                        {pbDevices.map(d => (
                          <p key={d.iden} className="pl-2 cursor-pointer hover:text-sky-500" onClick={() => setPbDeviceIds(d.iden)}>
                            • {d.nickname} ({d.iden})
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">List of device IDs (leave blank to send to all devices)</p>
                  </div>

                  {/* Channel Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel Tags</label>
                    <Input
                      value={pbChannelTags}
                      onChange={(e) => setPbChannelTags(e.target.value)}
                      placeholder="Optional channel tag"
                      className="dark:bg-gray-700"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">List of Channel Tags to send notifications to</p>
                  </div>

                  {/* Sender ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sender ID</label>
                    <Input
                      value={pbSenderId}
                      onChange={(e) => setPbSenderId(e.target.value)}
                      placeholder="Optional sender device ID"
                      className="dark:bg-gray-700"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The device ID to send notifications from (leave blank to send from yourself)</p>
                  </div>
                </>
              ) : (
                <>
                  {/* API Key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                    <Input
                      type="password"
                      value={poApiKey}
                      onChange={(e) => setPoApiKey(e.target.value)}
                      placeholder="Your Pushover API key"
                      className="dark:bg-gray-700"
                    />
                    <a href="https://pushover.net/apps/build" target="_blank" rel="noopener noreferrer" className="text-xs text-sky-500 hover:text-sky-600 mt-1 inline-block">
                      More Info
                    </a>
                  </div>

                  {/* User Key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User Key</label>
                    <Input
                      type="password"
                      value={poUserKey}
                      onChange={(e) => setPoUserKey(e.target.value)}
                      placeholder="Your Pushover user key"
                      className="dark:bg-gray-700"
                    />
                    <a href="https://pushover.net/" target="_blank" rel="noopener noreferrer" className="text-xs text-sky-500 hover:text-sky-600 mt-1 inline-block">
                      More Info
                    </a>
                  </div>

                  {/* Devices */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Devices</label>
                    <Input
                      value={poDevices}
                      onChange={(e) => setPoDevices(e.target.value)}
                      placeholder="Leave blank for all devices"
                      className="dark:bg-gray-700"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">List of device names (leave blank to send to all devices)</p>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                    <select
                      value={poPriority}
                      onChange={(e) => setPoPriority(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', backgroundColor: 'var(--card-bg)' }}
                    >
                      <option value={-2}>Lowest</option>
                      <option value={-1}>Low</option>
                      <option value={0}>Normal</option>
                      <option value={1}>High</option>
                      <option value={2}>Emergency</option>
                    </select>
                  </div>

                  {/* Retry (for emergency) */}
                  {poPriority === 2 && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Retry</label>
                        <Input
                          type="number"
                          value={poRetry}
                          onChange={(e) => setPoRetry(Number(e.target.value))}
                          placeholder="60"
                          className="dark:bg-gray-700"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Interval to retry Emergency alerts, minimum 30 seconds</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expire</label>
                        <Input
                          type="number"
                          value={poExpire}
                          onChange={(e) => setPoExpire(Number(e.target.value))}
                          placeholder="3600"
                          className="dark:bg-gray-700"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How long to retry Emergency alerts, maximum 86400 seconds</p>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Test Result */}
              {testResult && (
                <div className={`p-3 rounded ${testResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                  {testResult.message}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between shrink-0">
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleTest} disabled={testing}>
                  {testing ? 'Testing...' : 'Test'}
                </Button>
                {editingConnection && (
                  <Button
                    variant="secondary"
                    onClick={() => setDeleteConfirm(editingConnection)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={closeModal}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Delete Connection"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
