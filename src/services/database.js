const { MongoClient } = require('mongodb');

const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || 'mustard';
let client;
let database;

async function initialize() {
  if (!mongoUri) throw new Error('MONGODB_URI is required.');
  if (database) return;
  client = new MongoClient(mongoUri);
  await client.connect();
  database = client.db(databaseName);
  await Promise.all([
    database.collection('guild_settings').createIndex({ guild_id: 1 }, { unique: true }),
    database.collection('warnings').createIndex({ guild_id: 1, user_id: 1 }),
    database.collection('moderation_logs').createIndex({ guild_id: 1, created_at: -1 }),
    database.collection('delete_future_channels').createIndex({ guild_id: 1, channel_id: 1 }, { unique: true }),
    database.collection('disabled_ping_strikes').createIndex({ guild_id: 1, user_id: 1 }, { unique: true })
  ]);
}

function collection(name) {
  if (!database) throw new Error('Database has not been initialized.');
  return database.collection(name);
}

function defaultSettings(guildId) {
  return {
    guild_id: guildId, raid_mode: false, automod_enabled: true, spam_threshold: 5,
    spam_window_ms: 8000, max_mentions: 5, block_invites: true, cmds_role_id: [],
    disabled_ping_role_ids: [], modlog_channel_id: null, general_log_channel_id: null,
    log_color: '0x0099ff', ticket_ping_enabled: false, ticket_ping_role_ids: [],
    ticket_view_role_ids: [], welcome_enabled: false, welcome_channel_id: null,
    log_warns_enabled: true, log_mutes_enabled: true, log_kicks_enabled: true, log_bans_enabled: true
  };
}

function roles(value) {
  return Array.isArray(value) ? value : (value || '').split(',').map(item => item.trim()).filter(Boolean);
}

function mapSettings(row) {
  return {
    raidMode: Boolean(row.raid_mode), automodEnabled: row.automod_enabled !== false,
    spamThreshold: row.spam_threshold || 5, spamWindowMs: row.spam_window_ms || 8000,
    maxMentions: row.max_mentions || 5, blockInvites: row.block_invites !== false,
    cmdsRoleId: roles(row.cmds_role_id)[0] || null, cmdsRoleIds: roles(row.cmds_role_id),
    disabledPingRoleIds: roles(row.disabled_ping_role_ids), modlogChannelId: row.modlog_channel_id,
    generalLogChannelId: row.general_log_channel_id, logColor: row.log_color || '0x0099ff',
    ticketPingEnabled: Boolean(row.ticket_ping_enabled), ticketPingRoleIds: roles(row.ticket_ping_role_ids),
    ticketViewRoleIds: roles(row.ticket_view_role_ids), welcomeEnabled: Boolean(row.welcome_enabled),
    welcomeChannelId: row.welcome_channel_id, notifyWarnEnabled: Boolean(row.notify_warn_enabled),
    notifyMuteEnabled: Boolean(row.notify_mute_enabled), notifyBanEnabled: Boolean(row.notify_ban_enabled),
    pingModsEnabled: Boolean(row.ping_mods_enabled), escalationEnabled: Boolean(row.escalation_enabled),
    escalationWarnThreshold: row.escalation_warn_threshold || 5, autoRoleEnabled: Boolean(row.auto_role_enabled),
    autoRoleId: row.auto_role_id, defaultMuteDuration: row.default_mute_duration || 60,
    defaultBanAppealLink: row.default_ban_appeal_link, logWarnsEnabled: row.log_warns_enabled !== false,
    logMutesEnabled: row.log_mutes_enabled !== false, logKicksEnabled: row.log_kicks_enabled !== false,
    logBansEnabled: row.log_bans_enabled !== false, auditLogChannelId: row.audit_log_channel_id
  };
}

async function getGuildSettings(guildId) {
  await collection('guild_settings').updateOne({ guild_id: guildId }, { $setOnInsert: defaultSettings(guildId) }, { upsert: true });
  return mapSettings(await collection('guild_settings').findOne({ guild_id: guildId }));
}

async function updateGuild(guildId, changes) {
  await collection('guild_settings').updateOne({ guild_id: guildId }, { $set: changes }, { upsert: true });
}

const boolUpdate = field => (guildId, value) => updateGuild(guildId, { [field]: Boolean(value) });
const valueUpdate = field => (guildId, value) => updateGuild(guildId, { [field]: value });
const rolesUpdate = field => (guildId, value) => updateGuild(guildId, { [field]: Array.isArray(value) ? value : [value].filter(Boolean) });

async function setRaidMode(guildId, enabled) { return updateGuild(guildId, { raid_mode: Boolean(enabled) }); }
async function addWarning(guildId, userId, reason, source = 'auto-mod') { return collection('warnings').insertOne({ guild_id: guildId, user_id: userId, reason, source, created_at: new Date().toISOString() }); }
async function getWarnings(guildId, userId) { return collection('warnings').find({ guild_id: guildId, user_id: userId }).sort({ created_at: -1 }).toArray(); }
async function clearWarnings(guildId, userId) { return collection('warnings').deleteMany({ guild_id: guildId, user_id: userId }); }
async function logAction(log) { return collection('moderation_logs').insertOne({ guild_id: log.guildId, action: log.action, target_id: log.targetId || null, target_tag: log.targetTag || null, executor_id: log.executorId || null, executor_tag: log.executorTag || null, reason: log.reason || null, metadata: log.metadata || {}, created_at: new Date().toISOString() }); }

module.exports = {
  initialize, getGuildSettings, setRaidMode, addWarning, getWarnings, clearWarnings, logAction,
  updateCmdsRole: rolesUpdate('cmds_role_id'), updateDisabledPingRoles: rolesUpdate('disabled_ping_role_ids'),
  updateModlogChannel: valueUpdate('modlog_channel_id'), updateGeneralLogChannel: valueUpdate('general_log_channel_id'),
  updateTicketPingEnabled: boolUpdate('ticket_ping_enabled'), updateTicketPingRoles: rolesUpdate('ticket_ping_role_ids'),
  updateTicketViewRoles: rolesUpdate('ticket_view_role_ids'), updateLogColor: valueUpdate('log_color'),
  updateNotifyWarn: boolUpdate('notify_warn_enabled'), updateNotifyMute: boolUpdate('notify_mute_enabled'),
  updateNotifyBan: boolUpdate('notify_ban_enabled'), updatePingMods: boolUpdate('ping_mods_enabled'),
  updateEscalationEnabled: boolUpdate('escalation_enabled'), updateEscalationThreshold: valueUpdate('escalation_warn_threshold'),
  updateAutoRoleEnabled: boolUpdate('auto_role_enabled'), updateAutoRoleId: valueUpdate('auto_role_id'),
  updateWelcomeEnabled: boolUpdate('welcome_enabled'), updateWelcomeChannelId: valueUpdate('welcome_channel_id'),
  updateWelcomeChannel: async (guildId, channelId) => updateGuild(guildId, { welcome_channel_id: channelId, welcome_enabled: Boolean(channelId) }),
  updateDefaultMuteDuration: valueUpdate('default_mute_duration'), updateDefaultBanAppealLink: valueUpdate('default_ban_appeal_link'),
  updateLogWarnsEnabled: boolUpdate('log_warns_enabled'), updateLogMutesEnabled: boolUpdate('log_mutes_enabled'),
  updateLogKicksEnabled: boolUpdate('log_kicks_enabled'), updateLogBansEnabled: boolUpdate('log_bans_enabled'), updateAuditLogChannel: valueUpdate('audit_log_channel_id'),
  enableDeleteFuture: async (guildId, channelId) => collection('delete_future_channels').updateOne({ guild_id: guildId, channel_id: channelId }, { $set: { guild_id: guildId, channel_id: channelId } }, { upsert: true }),
  disableDeleteFuture: async (guildId, channelId) => collection('delete_future_channels').deleteOne({ guild_id: guildId, channel_id: channelId }),
  isDeleteFutureEnabled: async (guildId, channelId) => Boolean(await collection('delete_future_channels').findOne({ guild_id: guildId, channel_id: channelId })),
  addDisabledPingStrike: async (guildId, userId) => { await collection('disabled_ping_strikes').updateOne({ guild_id: guildId, user_id: userId }, { $inc: { strike_count: 1 } }, { upsert: true }); const row = await collection('disabled_ping_strikes').findOne({ guild_id: guildId, user_id: userId }); return row.strike_count; },
  resetDisabledPingStrikes: async (guildId, userId) => collection('disabled_ping_strikes').deleteOne({ guild_id: guildId, user_id: userId })
};
