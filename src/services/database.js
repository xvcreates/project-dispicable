const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'bot.sqlite');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function ensureGuildSettingsColumns() {
  const columns = await all('PRAGMA table_info(guild_settings)');
  const existingNames = new Set(columns.map(column => column.name));

  const columnDefinitions = [
    ['cmds_role_id', 'TEXT'],
    ['modlog_channel_id', 'TEXT'],
    ['general_log_channel_id', 'TEXT'],
    ['log_color', 'TEXT DEFAULT 0x0099ff'],
    ['ticket_ping_enabled', 'INTEGER DEFAULT 0'],
    ['ticket_ping_role_ids', 'TEXT'],
    ['ticket_view_role_ids', 'TEXT'],
    // Notification Settings
    ['notify_warn_enabled', 'INTEGER DEFAULT 0'],
    ['notify_mute_enabled', 'INTEGER DEFAULT 0'],
    ['notify_ban_enabled', 'INTEGER DEFAULT 0'],
    ['ping_mods_enabled', 'INTEGER DEFAULT 0'],
    // Punishment Escalation
    ['escalation_enabled', 'INTEGER DEFAULT 0'],
    ['escalation_warn_threshold', 'INTEGER DEFAULT 5'],
    // Auto-join Features
    ['auto_role_enabled', 'INTEGER DEFAULT 0'],
    ['auto_role_id', 'TEXT'],
    ['welcome_enabled', 'INTEGER DEFAULT 0'],
    ['welcome_channel_id', 'TEXT'],
    // Moderation Defaults
    ['default_mute_duration', 'INTEGER DEFAULT 60'],
    ['default_ban_appeal_link', 'TEXT'],
    // Moderation Logging
    ['log_warns_enabled', 'INTEGER DEFAULT 1'],
    ['log_mutes_enabled', 'INTEGER DEFAULT 1'],
    ['log_kicks_enabled', 'INTEGER DEFAULT 1'],
    ['log_bans_enabled', 'INTEGER DEFAULT 1'],
    ['audit_log_channel_id', 'TEXT']
  ];

  for (const [columnName, columnType] of columnDefinitions) {
    if (!existingNames.has(columnName)) {
      await run(`ALTER TABLE guild_settings ADD COLUMN ${columnName} ${columnType}`);
    }
  }
}

async function initialize() {
  await run(`CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    raid_mode INTEGER DEFAULT 0,
    automod_enabled INTEGER DEFAULT 1,
    spam_threshold INTEGER DEFAULT 5,
    spam_window_ms INTEGER DEFAULT 8000,
    max_mentions INTEGER DEFAULT 5,
    block_invites INTEGER DEFAULT 1,
    cmds_role_id TEXT,
    modlog_channel_id TEXT,
    general_log_channel_id TEXT,
    log_color TEXT DEFAULT '0x0099ff',
    ticket_ping_enabled INTEGER DEFAULT 0,
    ticket_ping_role_ids TEXT,
    ticket_view_role_ids TEXT
  )`);

  await ensureGuildSettingsColumns();

  await run(`CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS moderation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    target_tag TEXT,
    executor_id TEXT,
    executor_tag TEXT,
    reason TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT,
    creator_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_at TEXT NOT NULL,
    closed_at TEXT
  )`);
}

async function getGuildSettings(guildId) {
  const row = await get('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
  if (row) {
    const cmdRoleIds = (row.cmds_role_id || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    const ticketPingRoleIds = (row.ticket_ping_role_ids || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    const ticketViewRoleIds = (row.ticket_view_role_ids || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

    return {
      raidMode: Boolean(row.raid_mode),
      automodEnabled: Boolean(row.automod_enabled),
      spamThreshold: row.spam_threshold,
      spamWindowMs: row.spam_window_ms,
      maxMentions: row.max_mentions,
      blockInvites: Boolean(row.block_invites),
      cmdsRoleId: cmdRoleIds[0] || null,
      cmdsRoleIds: cmdRoleIds,
      modlogChannelId: row.modlog_channel_id,
      generalLogChannelId: row.general_log_channel_id,
      logColor: row.log_color || '0x0099ff',
      ticketPingEnabled: Boolean(row.ticket_ping_enabled),
      ticketPingRoleIds: ticketPingRoleIds,
      ticketViewRoleIds: ticketViewRoleIds,
      // Notification Settings
      notifyWarnEnabled: Boolean(row.notify_warn_enabled),
      notifyMuteEnabled: Boolean(row.notify_mute_enabled),
      notifyBanEnabled: Boolean(row.notify_ban_enabled),
      pingModsEnabled: Boolean(row.ping_mods_enabled),
      // Punishment Escalation
      escalationEnabled: Boolean(row.escalation_enabled),
      escalationWarnThreshold: row.escalation_warn_threshold || 5,
      // Auto-join Features
      autoRoleEnabled: Boolean(row.auto_role_enabled),
      autoRoleId: row.auto_role_id,
      welcomeEnabled: Boolean(row.welcome_enabled),
      welcomeChannelId: row.welcome_channel_id,
      // Moderation Defaults
      defaultMuteDuration: row.default_mute_duration || 60,
      defaultBanAppealLink: row.default_ban_appeal_link,
      // Moderation Logging
      logWarnsEnabled: Boolean(row.log_warns_enabled),
      logMutesEnabled: Boolean(row.log_mutes_enabled),
      logKicksEnabled: Boolean(row.log_kicks_enabled),
      logBansEnabled: Boolean(row.log_bans_enabled),
      auditLogChannelId: row.audit_log_channel_id
    };
  }
  await run(`INSERT INTO guild_settings (guild_id) VALUES (?)`, [guildId]);
  return getGuildSettings(guildId);
}

async function setRaidMode(guildId, enabled) {
  await run('INSERT INTO guild_settings (guild_id, raid_mode) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET raid_mode = excluded.raid_mode', [guildId, enabled ? 1 : 0]);
}

async function addWarning(guildId, userId, reason, source = 'auto-mod') {
  await run(
    'INSERT INTO warnings (guild_id, user_id, reason, source, created_at) VALUES (?, ?, ?, ?, ?)',
    [guildId, userId, reason, source, new Date().toISOString()]
  );
}

async function getWarnings(guildId, userId) {
  return all('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY id DESC', [guildId, userId]);
}

async function clearWarnings(guildId, userId) {
  await run('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
}

async function logAction(log) {
  await run(
    'INSERT INTO moderation_logs (guild_id, action, target_id, target_tag, executor_id, executor_tag, reason, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      log.guildId,
      log.action,
      log.targetId || null,
      log.targetTag || null,
      log.executorId || null,
      log.executorTag || null,
      log.reason || null,
      log.metadata ? JSON.stringify(log.metadata) : null,
      new Date().toISOString()
    ]
  );
}

module.exports = {
  initialize,
  getGuildSettings,
  setRaidMode,
  addWarning,
  getWarnings,
  clearWarnings,
  logAction,
  get,
  all,
  run,
  updateCmdsRole: async (guildId, roleIds) => {
    const normalized = Array.isArray(roleIds) ? roleIds : [roleIds].filter(Boolean);
    const value = normalized.length ? normalized.join(',') : null;
    await run('UPDATE guild_settings SET cmds_role_id = ? WHERE guild_id = ?', [value, guildId]);
  },
  updateModlogChannel: async (guildId, channelId) => {
    await run('UPDATE guild_settings SET modlog_channel_id = ? WHERE guild_id = ?', [channelId, guildId]);
  },
  updateGeneralLogChannel: async (guildId, channelId) => {
    await run('UPDATE guild_settings SET general_log_channel_id = ? WHERE guild_id = ?', [channelId, guildId]);
  },
  updateTicketPingEnabled: async (guildId, enabled) => {
    await run('UPDATE guild_settings SET ticket_ping_enabled = ? WHERE guild_id = ?', [enabled ? 1 : 0, guildId]);
  },
  updateTicketPingRoles: async (guildId, roleIds) => {
    const normalized = Array.isArray(roleIds) ? roleIds : [roleIds].filter(Boolean);
    const value = normalized.length ? normalized.join(',') : null;
    await run('UPDATE guild_settings SET ticket_ping_role_ids = ? WHERE guild_id = ?', [value, guildId]);
  },
  updateTicketViewRoles: async (guildId, roleIds) => {
    const normalized = Array.isArray(roleIds) ? roleIds : [roleIds].filter(Boolean);
    const value = normalized.length ? normalized.join(',') : null;
    await run('UPDATE guild_settings SET ticket_view_role_ids = ? WHERE guild_id = ?', [value, guildId]);
  },
  updateLogColor: async (guildId, colorHex) => {
    await run('UPDATE guild_settings SET log_color = ? WHERE guild_id = ?', [colorHex, guildId]);
  },
  // Notification Settings
  updateNotifyWarn: async (guildId, enabled) => {
    await run('UPDATE guild_settings SET notify_warn_enabled = ? WHERE guild_id = ?', [enabled ? 1 : 0, guildId]);
  },
  updateNotifyMute: async (guildId, enabled) => {
    await run('UPDATE guild_settings SET notify_mute_enabled = ? WHERE guild_id = ?', [enabled ? 1 : 0, guildId]);
  },
  updateNotifyBan: async (guildId, enabled) => {
    await run('UPDATE guild_settings SET notify_ban_enabled = ? WHERE guild_id = ?', [enabled ? 1 : 0, guildId]);
  },
  updatePingMods: async (guildId, enabled) => {
    await run('UPDATE guild_settings SET ping_mods_enabled = ? WHERE guild_id = ?', [enabled ? 1 : 0, guildId]);
  },
  // Punishment Escalation
  updateEscalationEnabled: async (guildId, enabled) => {
    await run('UPDATE guild_settings SET escalation_enabled = ? WHERE guild_id = ?', [enabled ? 1 : 0, guildId]);
  },
  updateEscalationThreshold: async (guildId, threshold) => {
    await run('UPDATE guild_settings SET escalation_warn_threshold = ? WHERE guild_id = ?', [threshold, guildId]);
  },
  // Auto-join Features
  updateAutoRoleEnabled: async (guildId, enabled) => {
    await run('UPDATE guild_settings SET auto_role_enabled = ? WHERE guild_id = ?', [enabled ? 1 : 0, guildId]);
  },
  updateAutoRoleId: async (guildId, roleId) => {
    await run('UPDATE guild_settings SET auto_role_id = ? WHERE guild_id = ?', [roleId, guildId]);
  },
  updateWelcomeEnabled: async (guildId, enabled) => {
    await run('UPDATE guild_settings SET welcome_enabled = ? WHERE guild_id = ?', [enabled ? 1 : 0, guildId]);
  },
  updateWelcomeChannelId: async (guildId, channelId) => {
    await run('UPDATE guild_settings SET welcome_channel_id = ? WHERE guild_id = ?', [channelId, guildId]);
  },
  // Moderation Defaults
  updateDefaultMuteDuration: async (guildId, minutes) => {
    await run('UPDATE guild_settings SET default_mute_duration = ? WHERE guild_id = ?', [minutes, guildId]);
  },
  updateDefaultBanAppealLink: async (guildId, link) => {
    await run('UPDATE guild_settings SET default_ban_appeal_link = ? WHERE guild_id = ?', [link, guildId]);
  },
  // Moderation Logging
  updateLogWarnsEnabled: async (guildId, enabled) => {
    await run('UPDATE guild_settings SET log_warns_enabled = ? WHERE guild_id = ?', [enabled ? 1 : 0, guildId]);
  },
  updateLogMutesEnabled: async (guildId, enabled) => {
    await run('UPDATE guild_settings SET log_mutes_enabled = ? WHERE guild_id = ?', [enabled ? 1 : 0, guildId]);
  },
  updateLogKicksEnabled: async (guildId, enabled) => {
    await run('UPDATE guild_settings SET log_kicks_enabled = ? WHERE guild_id = ?', [enabled ? 1 : 0, guildId]);
  },
  updateLogBansEnabled: async (guildId, enabled) => {
    await run('UPDATE guild_settings SET log_bans_enabled = ? WHERE guild_id = ?', [enabled ? 1 : 0, guildId]);
  },
  updateAuditLogChannel: async (guildId, channelId) => {
    await run('UPDATE guild_settings SET audit_log_channel_id = ? WHERE guild_id = ?', [channelId, guildId]);
  }
};


