require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATABASE_PATH = path.join(DATA_DIR, 'bot-data.json');

function loadDatabase() {
  if (!fs.existsSync(DATABASE_PATH)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const initialData = { guilds: {}, logs: [] };
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(initialData, null, 2));
    return initialData;
  }

  try {
    return JSON.parse(fs.readFileSync(DATABASE_PATH, 'utf8'));
  } catch (error) {
    console.error('Failed to read database, resetting it.', error);
    const freshData = { guilds: {}, logs: [] };
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(freshData, null, 2));
    return freshData;
  }
}

const db = loadDatabase();

function saveDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATABASE_PATH, JSON.stringify(db, null, 2));
}

function getGuildData(guildId) {
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = {
      warnings: {},
      settings: {
        autoMod: {
          enabled: true,
          spamThreshold: 5,
          spamWindowMs: 8000,
          maxMentions: 5,
          blockInvites: true,
          allowedChannels: ['bot-use', 'mod-logs', 'moderation', 'logs']
        }
      },
      raidMode: false
    };
  }
  return db.guilds[guildId];
}

function getWarningKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getUserWarnings(guildId, userId) {
  const guildData = getGuildData(guildId);
  if (!guildData.warnings[userId]) {
    guildData.warnings[userId] = [];
  }
  return guildData.warnings[userId];
}

function saveUserWarnings(guildId, userId, warningsList) {
  const guildData = getGuildData(guildId);
  guildData.warnings[userId] = warningsList;
  saveDatabase();
}

function getAutoModSettings(guildId) {
  const guildData = getGuildData(guildId);
  if (!guildData.settings.autoMod) {
    guildData.settings.autoMod = {
      enabled: true,
      spamThreshold: 5,
      spamWindowMs: 8000,
      maxMentions: 5,
      blockInvites: true,
      allowedChannels: ['bot-use', 'mod-logs', 'moderation', 'logs']
    };
  }
  return guildData.settings.autoMod;
}

// Validate environment variables
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1449775322580123648';
const GUILD_ID = '1497925433251856484';

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN not found in .env file');
  process.exit(1);
}

// HTTP server for Render / healthcheck
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
}).listen(process.env.PORT || 8080, () => {
  console.log(`📡 HTTP server listening on port ${process.env.PORT || 8080}`);
});

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

// Initialize ticket counter based on existing channels
function initializeTicketCounter(guild) {
  const ticketChannels = guild.channels.cache.filter(ch => ch.name.startsWith('ticket-'));
  if (ticketChannels.size === 0) {
    ticketCounter = 0;
    return;
  }
  
  const numbers = ticketChannels.map(ch => {
    const match = ch.name.match(/^ticket-(\d+)$/);
    return match ? parseInt(match[1]) : 0;
  });
  
  ticketCounter = Math.max(...numbers);
  console.log(`Initialized ticket counter for ${guild.name} to ${ticketCounter}`);
}

// Content filter
const bannedContent = [
  /nig/i, /fagg/i, /sand/i, /porn/i, /xxx/i, /nud/i, /horny/i,
  /nigger/i, /faggot/i, /sandnigger/i
];

// Runtime data storage
let startTime = Date.now();
const warnings = new Map();
const moderationLogs = [];
let ticketCounter = 0;
const raidMode = new Set();
const helpCommandUsed = new Set();
const autoModMessageHistory = new Map();
const autoModCooldowns = new Map();

for (const [guildId, guildData] of Object.entries(db.guilds || {})) {
  if (guildData?.raidMode) {
    raidMode.add(guildId);
  }
  for (const [userId, userWarnings] of Object.entries(guildData?.warnings || {})) {
    warnings.set(getWarningKey(guildId, userId), userWarnings);
  }
}

// Utility function to get bot-use channel
async function getBotUseChannel(guild) {
  try {
    const channels = guild.channels.cache;
    return channels.find(ch => ch.name === 'bot-use' && ch.isTextBased()) ||
           channels.find(ch => ch.name === 'mod-logs' && ch.isTextBased()) ||
           channels.find(ch => ch.name === 'moderation' && ch.isTextBased()) ||
           channels.find(ch => ch.name === 'logs' && ch.isTextBased()) ||
           null;
  } catch (error) {
    console.error('Error finding bot-use channel:', error);
    return null;
  }
}

// Utility function to send moderation DM
async function sendModerationDM(user, title, reason, duration = null) {
  try {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0xFF0000)
      .addFields({ name: 'Reason', value: reason || 'No reason provided' });
    if (duration) embed.addFields({ name: 'Duration', value: duration });
    await user.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.log(`Could not DM ${user.tag}`);
  }
}

// Log moderation action
function logModerationAction(action) {
  moderationLogs.push({
    ...action,
    timestamp: new Date()
  });
}

function isStaffMember(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions?.has(PermissionFlagsBits.ModerateMembers)) return true;
  const roleNames = member.roles.cache.map(role => role.name.toLowerCase());
  return roleNames.some(roleName => ['cmds', 'mod', 'staff', 'moderator', 'admin', 'owner'].includes(roleName));
}

async function triggerAutoMod(message, reason) {
  const { guild, author, channel } = message;
  const cooldownKey = `${guild.id}:${author.id}:${reason}`;
  const now = Date.now();
  const lastTrigger = autoModCooldowns.get(cooldownKey) || 0;
  if (now - lastTrigger < 60000) {
    return;
  }
  autoModCooldowns.set(cooldownKey, now);

  try {
    await message.delete();
  } catch (error) {
    console.error('Could not auto-delete message:', error);
  }

  const userWarnings = getUserWarnings(guild.id, author.id);
  userWarnings.push({
    reason,
    date: new Date().toISOString(),
    source: 'auto-mod'
  });
  saveUserWarnings(guild.id, author.id, userWarnings);

  await sendModerationDM(author, 'Auto-moderation notice', reason, 'Please keep your messages respectful.');
  const botUseChannel = await getBotUseChannel(guild);
  if (botUseChannel) {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Auto-moderation Triggered')
      .setDescription(`User: ${author.tag}\nChannel: ${channel.name}\nReason: ${reason}`)
      .setColor(0xffaa00)
      .setTimestamp();
    await botUseChannel.send({ embeds: [embed] }).catch(() => null);
  }
}

async function applyRaidMode(guild, enabled) {
  const textChannels = guild.channels.cache.filter(ch => ch.isTextBased());
  for (const [, channel] of textChannels) {
    try {
      await channel.permissionOverwrites.edit(guild.roles.everyone, enabled ? { SendMessages: false } : { SendMessages: null });
    } catch (error) {
      console.error(`Could not update permissions for ${channel.name}:`, error);
    }
  }

  if (enabled) {
    raidMode.add(guild.id);
  } else {
    raidMode.delete(guild.id);
  }

  const guildData = getGuildData(guild.id);
  guildData.raidMode = enabled;
  saveDatabase();
}

const commands = [
  // Moderation Commands
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Remove a user from the server.')
    .addUserOption(option => option.setName('user').setDescription('The user to kick').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for kicking').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user permanently.')
    .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for banning').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('banid')
    .setDescription('Ban a user by ID (works for users who left).')
    .addStringOption(option => option.setName('user_id').setDescription('The user ID to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for banning').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Temporarily mute a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to mute').setRequired(true))
    .addIntegerOption(option => option.setName('time').setDescription('Mute duration in minutes').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove mute role from a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to unmute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Record a warning for a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to warn').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for warning').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

new SlashCommandBuilder()
    .setName('removerole')
    .setDescription('Remove a role from one user or everyone.')
    .addRoleOption(option =>
        option
            .setName('role')
            .setDescription('Role to remove')
            .setRequired(true))
    .addStringOption(option =>
        option
            .setName('target')
            .setDescription('Who to remove the role from')
            .setRequired(true)
            .addChoices(
                { name: 'User', value: 'user' },
                { name: 'Everyone', value: 'everyone' }
            ))
    .addUserOption(option =>
        option
            .setName('user')
            .setDescription('User to remove the role from'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Check the number of warnings a user has.')
    .addUserOption(option => option.setName('user').setDescription('The user to check').setRequired(true)),

  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete the last X messages in a channel.')
    .addIntegerOption(option => option.setName('amount').setDescription('Number of messages to delete').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Change a member’s nickname.')
    .addUserOption(option => option.setName('user').setDescription('The user to nickname').setRequired(true))
    .addStringOption(option => option.setName('nickname').setDescription('New nickname').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  new SlashCommandBuilder()
    .setName('roleadd')
    .setDescription('Assign a role to a member.')
    .addUserOption(option => option.setName('user').setDescription('The user to assign role').setRequired(true))
    .addRoleOption(option => option.setName('role').setDescription('The role to assign').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('roleremove')
    .setDescription('Remove a role from a member.')
    .addUserOption(option => option.setName('user').setDescription('The user to remove role from').setRequired(true))
    .addRoleOption(option => option.setName('role').setDescription('The role to remove').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('roletransfer')
    .setDescription('Move all members from one role to another.')
    .addRoleOption(option => option.setName('from_role').setDescription('The role to remove from members').setRequired(true))
    .addRoleOption(option => option.setName('to_role').setDescription('The role to add to those members').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('bulkroleremove')
    .setDescription('Remove a role from every member who has it.')
    .addRoleOption(option => option.setName('role').setDescription('The role to remove from members').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel (no sending messages).')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to lock').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a previously locked channel.')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to unlock').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode duration in a channel.')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to set slowmode').setRequired(true))
    .addIntegerOption(option => option.setName('time').setDescription('Slowmode time in seconds').setRequired(true).setMinValue(0).setMaxValue(21600))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement message to a channel.')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to announce in').setRequired(true))
    .addStringOption(option => option.setName('message').setDescription('The announcement message').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Temporarily ban a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
    .addIntegerOption(option => option.setName('hours').setDescription('Ban duration in hours').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for ban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to clear warnings for').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server.')
    .addUserOption(option => option.setName('user').setDescription('The user to unban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for unbanning').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('logs')
    .setDescription('View moderation logs.')
    .addIntegerOption(option => option.setName('limit').setDescription('Number of logs to show (default 10)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('raidmode')
    .setDescription('Toggle raid mode - locks all channels.'),

  new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Kick user and delete their last 7 days of messages.')
    .addUserOption(option => option.setName('user').setDescription('The user to softban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for softban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('infractions')
    .setDescription('View all infractions (warnings, mutes, kicks, bans) on a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to check').setRequired(true)),

  // Utility Commands
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency.'),

  new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Check how long the bot has been running.'),

  new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Get information about the bot.'),

  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Get information about the server.'),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Get information about a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to get info about').setRequired(false)),

  new SlashCommandBuilder()
    .setName('roles')
    .setDescription('List all roles in the server.'),

  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Get a user\'s avatar.')
    .addUserOption(option => option.setName('user').setDescription('The user to get avatar for').setRequired(false)),

  new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription('Get information about a channel.')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to get info about').setRequired(false)),

  new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Create an invite link for the server.'),

  new SlashCommandBuilder()
    .setName('randommember')
    .setDescription('Pick a random member from the server.'),

  new SlashCommandBuilder()
    .setName('countroles')
    .setDescription('Count members in each role.'),

  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something.')
    .addStringOption(option => option.setName('message').setDescription('The message to send').setRequired(true)),

  new SlashCommandBuilder()
    .setName('serverbanner')
    .setDescription('Get the server banner.'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display all available moderation commands for cmds role.'),

  // Ticket System
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create a support ticket.')
    .addStringOption(option => option.setName('title').setDescription('Ticket title').setRequired(true)),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`Bot is in ${client.guilds.cache.size} servers`);

  // Initialize ticket counter and persisted raid mode for each guild
  for (const [, guild] of client.guilds.cache) {
    initializeTicketCounter(guild);
    if (raidMode.has(guild.id)) {
      await applyRaidMode(guild, true);
    }
  }
  console.log(`Initialized ticket counter to ${ticketCounter}`);

  try {
    console.log('Started refreshing application (/) commands...');

    const commandData = commands.map(cmd => cmd.toJSON());
    console.log(`Registering ${commandData.length} commands...`);

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commandData },
    );

    console.log('✅ Successfully registered application (/) commands!');
    console.log('Commands should appear in Discord within 1-2 minutes.');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    console.error('Make sure the bot has the "applications.commands" scope and proper permissions.');
  }
});

// Message content filter and auto-moderation
client.on('messageCreate', async message => {
  if (!message.guild || !client.user) return;

  if (message.channel && message.channel.name === 'verify') {
    if (message.author.id === client.user.id) {
      return;
    }

    try {
      await message.delete();
    } catch (err) {
      console.error(`Could not delete message in verify channel: ${err}`);
    }
    return;
  }

  if (message.channel.name === 'general' && message.author.id === '365975655037009931') {
    try {
      await message.delete();
    } catch (err) {
      console.error(`Could not delete Bloxlink message in general channel: ${err}`);
    }
    return;
  }

  if (message.author.bot) return;

  if (raidMode.has(message.guild.id) && !isStaffMember(message.member) && message.author.id !== client.user.id) {
    try {
      await message.delete();
    } catch (err) {
      console.error(`Could not delete message during raid mode: ${err}`);
    }
    await triggerAutoMod(message, 'Raid mode active');
    return;
  }

  const protectedRoleNames = ['community director', 'owner', 'developer'];
  const cmdsRole = message.guild.roles.cache.find(role => role.name.toLowerCase() === 'cmds');
  const mentionedProtectedRoles = message.mentions.roles.filter(role => protectedRoleNames.includes(role.name.toLowerCase()));
  if (mentionedProtectedRoles.size > 0 && (!cmdsRole || !message.member.roles.cache.has(cmdsRole.id))) {
    await triggerAutoMod(message, 'Mentioned protected role');
    return;
  }

  const settings = getAutoModSettings(message.guild.id);
  if (!settings.enabled) return;
  if (settings.allowedChannels.includes(message.channel.name.toLowerCase())) return;
  if (isStaffMember(message.member)) return;

  const content = message.content.toLowerCase();
  const now = Date.now();
  const spamKey = `${message.guild.id}:${message.author.id}`;
  const recentMessages = (autoModMessageHistory.get(spamKey) || []).filter(ts => now - ts < settings.spamWindowMs);
  recentMessages.push(now);
  autoModMessageHistory.set(spamKey, recentMessages);

  if (recentMessages.length >= settings.spamThreshold) {
    await triggerAutoMod(message, 'Spamming / repeated messages');
    return;
  }

  if (settings.maxMentions && message.mentions.users.size >= settings.maxMentions) {
    await triggerAutoMod(message, `Mention spam (${message.mentions.users.size} mentions)`);
    return;
  }

  if (settings.blockInvites && /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i.test(content)) {
    await triggerAutoMod(message, 'Invite link posted');
    return;
  }

  for (const regex of bannedContent) {
    if (regex.test(message.content)) {
      await triggerAutoMod(message, 'Matched banned content filter');
      return;
    }
  }

  if (message.channel.name === 'lap-times' && !message.content.startsWith('/')) {
    try {
      await message.delete();
    } catch (err) {
      console.error(`Could not delete message from lap-times: ${err}`);
    }
  }
});

// Member milestone tracking
client.on('guildMemberAdd', async member => {
  const guild = member.guild;
  const memberCount = guild.memberCount;
  
  if (memberCount % 50 === 0 || memberCount % 100 === 0) {
    const announceChannel = guild.channels.cache.find(c => c.name === 'announcements' || c.name === 'general');
    if (announceChannel && announceChannel.isTextBased()) {
      const milestoneEmbed = new EmbedBuilder()
        .setTitle('🎉 Milestone Reached!')
        .setDescription(`Welcome to our ${memberCount}th member!`)
        .setColor(0x00ff00);
      await announceChannel.send({ embeds: [milestoneEmbed] });
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const member = interaction.member;
  const guild = interaction.guild;

  // Commands that require cmds role
  const moderationCommands = ['kick', 'ban', 'banid', 'mute', 'unmute', 'warn', 'warnings', 'purge', 'nick', 'roleadd', 'roleremove', 'roletransfer', 'bulkroleremove', 'lock', 'unlock', 'slowmode', 'announce', 'tempban', 'clearwarnings', 'unban', 'logs', 'raidmode', 'softban', 'infractions'];

  if (moderationCommands.includes(commandName)) {
    const cmdsRole = guild.roles.cache.find(role => role.name.toLowerCase() === 'cmds');
    if (!cmdsRole || !member.roles.cache.has(cmdsRole.id)) {
      return interaction.reply({ content: 'You need the cmds role to use moderation commands.', ephemeral: true });
    }
  }

  try {
    switch (commandName) {
      case 'kick': {
        const kickUser = interaction.options.getUser('user');
        const kickReason = interaction.options.getString('reason') || 'No reason provided';
        const kickMember = await guild.members.fetch(kickUser.id);
        await kickMember.kick(kickReason);
        await sendModerationDM(kickUser, 'You have been kicked', kickReason);
        logModerationAction({ action: 'kick', executor: interaction.user.tag, target: kickUser.tag, reason: kickReason });
        await interaction.reply({ content: `Kicked ${kickUser.tag} for: ${kickReason}`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Kick Command Used**\nUser: ${interaction.user.tag}\nTarget: ${kickUser.tag}\nReason: ${kickReason}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        } else {
          console.log(`Warning: Could not find bot-use channel in guild ${guild.name}`);
        }
        break;
      }

      case 'banid': {
        const userId = interaction.options.getString('user_id');
        const banReason = interaction.options.getString('reason') || 'No reason provided';

        // Permission check
        if (!guild.members.me.permissions.has('BanMembers')) {
          return interaction.reply({ content: '❌ I don\'t have permission to ban members.', ephemeral: true });
        }

        if (userId === interaction.user.id) {
          return interaction.reply({ content: '❌ You cannot ban yourself.', ephemeral: true });
        }

        if (userId === client.user.id) {
          return interaction.reply({ content: '❌ You cannot ban me.', ephemeral: true });
        }

        if (userId === guild.ownerId) {
          return interaction.reply({ content: '❌ You cannot ban the server owner.', ephemeral: true });
        }

        try {
          await guild.members.ban(userId, { reason: banReason });
          // Try to DM the user if resolvable
          try {
            const fetched = await client.users.fetch(userId).catch(() => null);
            if (fetched) await sendModerationDM(fetched, 'You have been banned', banReason);
            logModerationAction({ action: 'ban', executor: interaction.user.tag, target: fetched ? fetched.tag : userId, reason: banReason });
          } catch (err) {
            logModerationAction({ action: 'ban', executor: interaction.user.tag, target: userId, reason: banReason });
          }

          await interaction.reply({ content: `✅ Banned user ID ${userId}. DM attempted.`, ephemeral: true });
          const botUseChannel = await getBotUseChannel(guild);
          if (botUseChannel) {
            const embed = new EmbedBuilder()
              .setTitle('Moderation Action')
              .setDescription(`**Ban by ID Used**\nUser: ${interaction.user.tag}\nTarget ID: ${userId}\nReason: ${banReason}`)
              .setColor(0xff0000)
              .setTimestamp();
            await botUseChannel.send({ embeds: [embed] });
          }
        } catch (error) {
          console.error('BanID error:', error);
          await interaction.reply({ content: `❌ Failed to ban ID ${userId}: ${error.message}`, ephemeral: true });
        }
        break;
      }

      case 'ban': {
        const banUser = interaction.options.getUser('user');
        const banReason = interaction.options.getString('reason') || 'No reason provided';
        
        // Check if bot has ban permissions
        if (!guild.members.me.permissions.has('BanMembers')) {
          return interaction.reply({ content: '❌ I don\'t have permission to ban members.', ephemeral: true });
        }
        
        // Check if user is trying to ban themselves
        if (banUser.id === interaction.user.id) {
          return interaction.reply({ content: '❌ You cannot ban yourself.', ephemeral: true });
        }
        
        // Check if user is trying to ban the bot
        if (banUser.id === client.user.id) {
          return interaction.reply({ content: '❌ You cannot ban me.', ephemeral: true });
        }
        
        // Check if user is trying to ban the server owner
        if (banUser.id === guild.ownerId) {
          return interaction.reply({ content: '❌ You cannot ban the server owner.', ephemeral: true });
        }
        
        try {
          // Try to fetch the member (they might not be in the server)
          const targetMember = await guild.members.fetch(banUser.id).catch(() => null);
          
          // If they're in the server, check role hierarchy
          if (targetMember) {
            if (targetMember.roles.highest.position >= guild.members.me.roles.highest.position) {
              return interaction.reply({ content: '❌ I cannot ban this user due to role hierarchy.', ephemeral: true });
            }
            if (targetMember.roles.highest.position >= member.roles.highest.position) {
              return interaction.reply({ content: '❌ You cannot ban users with equal or higher roles than you.', ephemeral: true });
            }
          }
          
          await guild.members.ban(banUser, { reason: banReason });
          await sendModerationDM(banUser, 'You have been banned', banReason);
          logModerationAction({ action: 'ban', executor: interaction.user.tag, target: banUser.tag, reason: banReason });
          await interaction.reply({ content: `✅ Banned ${banUser.tag} for: ${banReason}`, ephemeral: true });
          
          const botUseChannel = await getBotUseChannel(guild);
          if (botUseChannel && botUseChannel.permissionsFor(guild.members.me).has('SendMessages')) {
            const embed = new EmbedBuilder()
              .setTitle('Moderation Action')
              .setDescription(`**Ban Command Used**\nUser: ${interaction.user.tag}\nTarget: ${banUser.tag}\nReason: ${banReason}`)
              .setColor(0xff0000)
              .setTimestamp();
            await botUseChannel.send({ embeds: [embed] });
          } else {
            console.log(`Warning: Could not find bot-use channel or missing permissions in guild ${guild.name}`);
          }
        } catch (error) {
          console.error('Ban error:', error);
          
          // Provide specific error messages based on the error
          let errorMessage = '❌ Failed to ban user.';
          if (error.code === 50013) {
            errorMessage = '❌ I don\'t have permission to ban this user.';
          } else if (error.code === 50035) {
            errorMessage = '❌ Invalid ban reason.';
          } else if (error.message.includes('Missing Permissions')) {
            errorMessage = '❌ Missing permissions to ban this user.';
          } else {
            errorMessage = `❌ Failed to ban user: ${error.message}`;
          }
          
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
        break;
      }

      case 'mute': {
        const muteUser = interaction.options.getUser('user');
        const muteTime = interaction.options.getInteger('time');
        const muteMember = await guild.members.fetch(muteUser.id);
        const muteRole = guild.roles.cache.find(role => role.name === 'Muted');
        if (!muteRole) return interaction.reply('Muted role not found. Please create a role named "Muted".');
        await muteMember.roles.add(muteRole);
        await sendModerationDM(muteUser, 'You have been muted', 'Check channel for reason', `${muteTime} minutes`);
        logModerationAction({ action: 'mute', executor: interaction.user.tag, target: muteUser.tag, duration: `${muteTime} minutes` });
        setTimeout(async () => {
          await muteMember.roles.remove(muteRole);
        }, muteTime * 60000);
        await interaction.reply({ content: `Muted ${muteUser.tag} for ${muteTime} minutes.`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Mute Command Used**\nUser: ${interaction.user.tag}\nTarget: ${muteUser.tag}\nDuration: ${muteTime} minutes`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'unmute': {
        const unmuteUser = interaction.options.getUser('user');
        const unmuteMember = await guild.members.fetch(unmuteUser.id);
        const unmuteRole = guild.roles.cache.find(role => role.name === 'Muted');
        if (!unmuteRole) return interaction.reply('Muted role not found.');
        await unmuteMember.roles.remove(unmuteRole);
        await interaction.reply({ content: `Unmuted ${unmuteUser.tag}.`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Unmute Command Used**\nUser: ${interaction.user.tag}\nTarget: ${unmuteUser.tag}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'warn': {
        const warnUser = interaction.options.getUser('user');
        const warnReason = interaction.options.getString('reason') || 'No reason provided';
        const userWarnings = getUserWarnings(guild.id, warnUser.id);
        userWarnings.push({ reason: warnReason, date: new Date().toISOString(), source: 'command' });
        saveUserWarnings(guild.id, warnUser.id, userWarnings);
        warnings.set(getWarningKey(guild.id, warnUser.id), userWarnings);
        const warnCount = userWarnings.length;
        
        await sendModerationDM(warnUser, 'You have been warned', warnReason);
        logModerationAction({ action: 'warn', executor: interaction.user.tag, target: warnUser.tag, reason: warnReason, warningCount: warnCount });
        
        let autoAction = '';
        // Auto-actions for warn limits
        if (warnCount === 3) {
          try {
            const warnMember = await guild.members.fetch(warnUser.id);
            await warnMember.kick('Auto-kicked: 3 warnings reached');
            autoAction = '\n⚠️ **Auto-Action: User kicked (3 warnings)**';
            logModerationAction({ action: 'kick', executor: 'Auto-System', target: warnUser.tag, reason: '3 warnings auto-kick' });
          } catch (err) {
            autoAction = '\n❌ Could not auto-kick user';
          }
        } else if (warnCount === 5) {
          try {
            await guild.members.ban(warnUser, { reason: 'Auto-banned: 5 warnings reached' });
            autoAction = '\n⚠️ **Auto-Action: User banned (5 warnings)**';
            logModerationAction({ action: 'ban', executor: 'Auto-System', target: warnUser.tag, reason: '5 warnings auto-ban' });
          } catch (err) {
            autoAction = '\n❌ Could not auto-ban user';
          }
        }
        
        await interaction.reply({ content: `Warned ${warnUser.tag} for: ${warnReason} (Total warnings: ${warnCount})${autoAction}`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Warn Command Used**\nUser: ${interaction.user.tag}\nTarget: ${warnUser.tag}\nReason: ${warnReason}\nTotal Warnings: ${warnCount}${autoAction}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'warnings': {
        const warningsUser = interaction.options.getUser('user');
        const userWarns = getUserWarnings(guild.id, warningsUser.id);
        const embed = new EmbedBuilder()
          .setTitle(`Warnings for ${warningsUser.tag}`)
          .setDescription(userWarns.length ? userWarns.map((w, i) => `${i+1}. ${w.reason} (${new Date(w.date).toDateString()})`).join('\n') : 'No warnings.')
          .setColor(0xff0000);
        await interaction.reply({ embeds: [embed], ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Warnings Command Used**\nUser: ${interaction.user.tag}\nTarget: ${warningsUser.tag}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'purge': {
        const amount = interaction.options.getInteger('amount');
        await interaction.channel.bulkDelete(amount);
        await interaction.reply({ content: `Deleted ${amount} messages.`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Purge Command Used**\nUser: ${interaction.user.tag}\nChannel: ${interaction.channel.name}\nAmount: ${amount}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'nick': {
        const nickUser = interaction.options.getUser('user');
        const nickname = interaction.options.getString('nickname');
        const nickMember = await guild.members.fetch(nickUser.id);
        await nickMember.setNickname(nickname);
        await interaction.reply({ content: `Changed ${nickUser.tag}'s nickname to ${nickname}.`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Nick Command Used**\nUser: ${interaction.user.tag}\nTarget: ${nickUser.tag}\nNew Nickname: ${nickname}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'roleadd': {
        const roleAddUser = interaction.options.getUser('user');
        const roleAdd = interaction.options.getRole('role');
        const roleAddMember = await guild.members.fetch(roleAddUser.id);
        await roleAddMember.roles.add(roleAdd);
        await interaction.reply({ content: `Added role ${roleAdd.name} to ${roleAddUser.tag}.`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Roleadd Command Used**\nUser: ${interaction.user.tag}\nTarget: ${roleAddUser.tag}\nRole: ${roleAdd.name}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'roleremove': {
        const roleRemoveUser = interaction.options.getUser('user');
        const roleRemove = interaction.options.getRole('role');
        const roleRemoveMember = await guild.members.fetch(roleRemoveUser.id);
        await roleRemoveMember.roles.remove(roleRemove);
        await interaction.reply({ content: `Removed role ${roleRemove.name} from ${roleRemoveUser.tag}.`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Roleremove Command Used**\nUser: ${interaction.user.tag}\nTarget: ${roleRemoveUser.tag}\nRole: ${roleRemove.name}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'roletransfer': {
        const fromRole = interaction.options.getRole('from_role');
        const toRole = interaction.options.getRole('to_role');
        if (fromRole.id === toRole.id) {
          return interaction.reply({ content: 'Please choose two different roles.', ephemeral: true });
        }

        await guild.members.fetch();
        const membersToUpdate = guild.members.cache.filter(member => member.roles.cache.has(fromRole.id));
        if (membersToUpdate.size === 0) {
          return interaction.reply({ content: `No members found with the ${fromRole.name} role.`, ephemeral: true });
        }

        let successCount = 0;
        let failedCount = 0;

        for (const [, memberToUpdate] of membersToUpdate) {
          try {
            await memberToUpdate.roles.remove(fromRole);
            await memberToUpdate.roles.add(toRole);
            successCount++;
          } catch (error) {
            failedCount++;
            console.error(`Failed to transfer roles for ${memberToUpdate.user.tag}:`, error);
          }
        }

        await interaction.reply({ content: `Processed ${membersToUpdate.size} members. ${successCount} updated, ${failedCount} failed.`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Roletransfer Command Used**\nUser: ${interaction.user.tag}\nFrom Role: ${fromRole.name}\nTo Role: ${toRole.name}\nProcessed: ${membersToUpdate.size}\nSuccess: ${successCount}\nFailed: ${failedCount}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'bulkroleremove': {
    await interaction.deferReply({ ephemeral: true });

    const bulkRole = interaction.options.getRole('role');
    await guild.members.fetch();

    const membersToRemove = guild.members.cache.filter(member =>
        member.roles.cache.has(bulkRole.id)
    );

    if (membersToRemove.size === 0) {
        return interaction.editReply({
            content: `No members currently have the ${bulkRole.name} role.`
        });
    }

    let successCount = 0;
    let failedCount = 0;

    for (const [, memberToRemove] of membersToRemove) {
        try {
            await memberToRemove.roles.remove(bulkRole);
            successCount++;
        } catch (error) {
            failedCount++;
            console.error(`Failed to remove ${bulkRole.name} from ${memberToRemove.user.tag}:`, error);
        }
    }

    await interaction.editReply({
        content: `✅ Removed **${bulkRole.name}** from **${successCount}** member(s).${failedCount ? ` ${failedCount} failed.` : ''}`
    });

    break;
}
        await interaction.reply({ content: `Removed ${bulkRole.name} from ${successCount} members. ${failedCount} failures.`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Bulkroleremove Command Used**\nUser: ${interaction.user.tag}\nRole: ${bulkRole.name}\nRemoved From: ${successCount} members\nFailed: ${failedCount}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'lock': {
        const lockChannel = interaction.options.getChannel('channel');
        await lockChannel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        await interaction.reply({ content: `Locked ${lockChannel.name}.`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Lock Command Used**\nUser: ${interaction.user.tag}\nChannel: ${lockChannel.name}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'unlock': {
        const unlockChannel = interaction.options.getChannel('channel');
        await unlockChannel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
        await interaction.reply({ content: `Unlocked ${unlockChannel.name}.`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Unlock Command Used**\nUser: ${interaction.user.tag}\nChannel: ${unlockChannel.name}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'slowmode': {
        const slowChannel = interaction.options.getChannel('channel');
        const slowTime = interaction.options.getInteger('time');
        await slowChannel.setRateLimitPerUser(slowTime);
        await interaction.reply({ content: `Set slowmode in ${slowChannel.name} to ${slowTime} seconds.`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Slowmode Command Used**\nUser: ${interaction.user.tag}\nChannel: ${slowChannel.name}\nDuration: ${slowTime} seconds`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'announce': {
        const announceChannel = interaction.options.getChannel('channel');
        const announceMessage = interaction.options.getString('message');
        await announceChannel.send(announceMessage);
        await interaction.reply({ content: 'Announcement sent.', ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Announce Command Used**\nUser: ${interaction.user.tag}\nChannel: ${announceChannel.name}\nMessage: ${announceMessage}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'tempban': {
        const tempbanUser = interaction.options.getUser('user');
        const tempbanHours = interaction.options.getInteger('hours');
        const tempbanReason = interaction.options.getString('reason') || 'No reason provided';
        await guild.members.ban(tempbanUser, { reason: tempbanReason });
        await sendModerationDM(tempbanUser, 'You have been temporarily banned', tempbanReason, `${tempbanHours} hours`);
        logModerationAction({ action: 'tempban', executor: interaction.user.tag, target: tempbanUser.tag, duration: `${tempbanHours} hours`, reason: tempbanReason });
        await interaction.reply({ content: `Temporarily banned ${tempbanUser.tag} for ${tempbanHours} hours. Reason: ${tempbanReason}`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          await botUseChannel.send(`**Tempban Command Used**\nUser: ${interaction.user.tag}\nTarget: ${tempbanUser.tag}\nDuration: ${tempbanHours} hours\nReason: ${tempbanReason}\nTimestamp: ${new Date().toISOString()}`);
        }
        setTimeout(async () => {
          try {
            await guild.bans.remove(tempbanUser.id, 'Temporary ban expired');
          } catch (err) {
            console.error(`Failed to unban ${tempbanUser.tag}: ${err}`);
          }
        }, tempbanHours * 3600000);
        break;
      }

      case 'clearwarnings': {
        const clearUser = interaction.options.getUser('user');
        const clearedCount = getUserWarnings(guild.id, clearUser.id).length;
        warnings.delete(getWarningKey(guild.id, clearUser.id));
        saveUserWarnings(guild.id, clearUser.id, []);
        logModerationAction({ action: 'clearwarnings', executor: interaction.user.tag, target: clearUser.tag, clearedCount: clearedCount });
        await interaction.reply({ content: `Cleared all ${clearedCount} warnings for ${clearUser.tag}.`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Clearwarnings Command Used**\nUser: ${interaction.user.tag}\nTarget: ${clearUser.tag}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'unban': {
        const unbanUser = interaction.options.getUser('user');
        const unbanReason = interaction.options.getString('reason') || 'No reason provided';
        await guild.bans.remove(unbanUser.id, unbanReason);
        logModerationAction({ action: 'unban', executor: interaction.user.tag, target: unbanUser.tag, reason: unbanReason });
        await interaction.reply({ content: `Unbanned ${unbanUser.tag}. Reason: ${unbanReason}`, ephemeral: true });
        const botUseChannel = await getBotUseChannel(guild);
        if (botUseChannel) {
          const embed = new EmbedBuilder()
            .setTitle('Moderation Action')
            .setDescription(`**Unban Command Used**\nUser: ${interaction.user.tag}\nTarget: ${unbanUser.tag}\nReason: ${unbanReason}`)
            .setColor(0xff0000)
            .setTimestamp();
          await botUseChannel.send({ embeds: [embed] });
        }
        break;
      }

      case 'logs':
        const logLimit = interaction.options.getInteger('limit') || 10;
        const recentLogs = moderationLogs.slice(-logLimit);
        if (recentLogs.length === 0) {
          return interaction.reply({ content: 'No moderation logs found.', ephemeral: true });
        }
        const logsEmbed = new EmbedBuilder()
          .setTitle(`Last ${recentLogs.length} Moderation Actions`)
          .setColor(0x0000ff);
        recentLogs.forEach((log, index) => {
          const logText = `**${log.action.toUpperCase()}** by ${log.executor} on ${log.target}${log.reason ? ` - Reason: ${log.reason}` : ''}${log.duration ? ` - Duration: ${log.duration}` : ''}${log.warningCount ? ` - Warnings: ${log.warningCount}` : ''}${log.clearedCount !== undefined ? ` - Cleared: ${log.clearedCount}` : ''}`;
          logsEmbed.addFields({ name: `#${recentLogs.length - index}`, value: logText, inline: false });
        });
        await interaction.reply({ embeds: [logsEmbed], ephemeral: true });
        break;





















      case 'help':
        if (helpCommandUsed.has(guild.id)) {
          return interaction.reply({ content: 'This command has already been used in this server! The help message is pinned above.', ephemeral: true });
        }
        
        helpCommandUsed.add(guild.id);
        
        const helpEmbed = new EmbedBuilder()
          .setTitle('🔧 Racing Nation Bot - Commands')
          .setDescription('Available commands for the Racing Nation community.')
          .addFields(
            { name: '🛡️ MODERATION (cmds role)', value: '`/kick` - Remove user\n`/ban` - Ban user\n`/unban` - Unban user\n`/tempban` - Temp ban (hours)\n`/mute` - Timeout user\n`/unmute` - Remove timeout\n`/warn` - Warn user\n`/warnings` - Check warnings\n`/clearwarnings` - Clear all warnings\n`/purge` - Delete messages\n`/nick` - Change nickname\n`/roleadd` - Add role\n`/roleremove` - Remove role\n`/roletransfer` - Move members from one role to another\n`/bulkroleremove` - Remove a role from all members who have it\n`/lock` - Lock channel\n`/unlock` - Unlock channel\n`/slowmode` - Set slowmode\n`/announce` - Send announcement\n`/logs` - View moderation logs\n`/softban` - Softban user\n`/infractions` - View user infractions\n`/raidmode` - Toggle raid mode', inline: false },
            { name: '🔧 UTILITY', value: '`/ping` - Check latency\n`/uptime` - Bot uptime\n`/botinfo` - Bot information\n`/serverinfo` - Server information\n`/userinfo` - User information\n`/roles` - List roles\n`/avatar` - Show avatar\n`/channelinfo` - Channel information\n`/invite` - Create invite\n`/randommember` - Random member\n`/countroles` - Role counts\n`/vote` - Create poll\n`/say` - Make bot speak\n`/serverbanner` - Server banner', inline: false }
          )
          .setFooter({ text: 'This command can only be used once per server.' })
          .setColor(0xff6600);
        
        const msg = await interaction.reply({ embeds: [helpEmbed] });
        await msg.pin();
        break;

      case 'raidmode':
        const isRaidMode = raidMode.has(guild.id);
        if (isRaidMode) {
          await applyRaidMode(guild, false);
          await interaction.reply({ content: '🟢 **Raid mode DISABLED** - All channels unlocked.', ephemeral: false });
          logModerationAction({ action: 'raidmode-disable', executor: interaction.user.tag, target: 'Guild', reason: 'Raid mode disabled' });
          const botUseChannel = await getBotUseChannel(guild);
          if (botUseChannel) {
            const embed = new EmbedBuilder()
              .setTitle('Moderation Action')
              .setDescription(`**Raidmode Disabled**\nUser: ${interaction.user.tag}`)
              .setColor(0xff0000)
              .setTimestamp();
            await botUseChannel.send({ embeds: [embed] });
          }
        } else {
          await applyRaidMode(guild, true);
          await interaction.reply({ content: '🔴 **RAID MODE ACTIVATED** - All channels locked. Use `/raidmode` to disable.', ephemeral: false });
          logModerationAction({ action: 'raidmode-enable', executor: interaction.user.tag, target: 'Guild', reason: 'Raid mode activated' });
          const botUseChannel = await getBotUseChannel(guild);
          if (botUseChannel) {
            const embed = new EmbedBuilder()
              .setTitle('Moderation Action')
              .setDescription(`**Raidmode Enabled**\nUser: ${interaction.user.tag}`)
              .setColor(0xff0000)
              .setTimestamp();
            await botUseChannel.send({ embeds: [embed] });
          }
        }
        break;

      case 'softban':
        const softbanUser = interaction.options.getUser('user');
        const softbanReason = interaction.options.getString('reason') || 'No reason provided';
        try {
          const softbanMember = await guild.members.fetch(softbanUser.id);
          // Delete 7 days of messages
          const messages = await interaction.channel.messages.fetch({ limit: 100 });
          const userMessages = messages.filter(m => m.author.id === softbanUser.id && (Date.now() - m.createdTimestamp) < 7 * 24 * 60 * 60 * 1000);
          for (const [, msg] of userMessages) {
            try {
              await msg.delete();
            } catch (err) {
              console.error(`Could not delete message: ${err}`);
            }
          }
          // Kick user
          await softbanMember.kick(softbanReason);
          await sendModerationDM(softbanUser, 'You have been softbanned', softbanReason);
          logModerationAction({ action: 'softban', executor: interaction.user.tag, target: softbanUser.tag, reason: softbanReason });
          await interaction.reply({ content: `✅ Softbanned ${softbanUser.tag} and deleted last 7 days of messages. Reason: ${softbanReason}`, ephemeral: true });
          const botUseChannel = await getBotUseChannel(guild);
          if (botUseChannel) {
            const embed = new EmbedBuilder()
              .setTitle('Moderation Action')
              .setDescription(`**Softban Command Used**\nUser: ${interaction.user.tag}\nTarget: ${softbanUser.tag}\nReason: ${softbanReason}`)
              .setColor(0xff0000)
              .setTimestamp();
            await botUseChannel.send({ embeds: [embed] });
          }
        } catch (err) {
          await interaction.reply({ content: `❌ Failed to softban user: ${err.message}`, ephemeral: true });
        }
        break;

      case 'infractions':
        const infractionUser = interaction.options.getUser('user');
        const userInfractions = moderationLogs.filter(log => log.target === infractionUser.tag);
        
        if (userInfractions.length === 0) {
          return interaction.reply({ content: `No infractions found for ${infractionUser.tag}.`, ephemeral: true });
        }
        
        const infractionEmbed = new EmbedBuilder()
          .setTitle(`📋 Infractions for ${infractionUser.tag}`)
          .setColor(0xff0000);
        
        userInfractions.forEach((infr, index) => {
          const infrText = `**${infr.action.toUpperCase()}** by ${infr.executor}\nReason: ${infr.reason || 'N/A'}\nDate: ${infr.timestamp.toDateString()}`;
          infractionEmbed.addFields({ name: `#${index + 1}`, value: infrText, inline: false });
        });
        
        infractionEmbed.setFooter({ text: `Total infractions: ${userInfractions.length}` });
        await interaction.reply({ embeds: [infractionEmbed], ephemeral: true });
        break;

      // Utility Commands
      case 'ping':
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        await interaction.editReply({ content: `🏓 Pong! Bot latency: ${latency}ms | API latency: ${apiLatency}ms` });
        break;

      case 'uptime':
        const uptime = Date.now() - startTime;
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
        await interaction.reply({ content: `⏱️ Bot uptime: ${days}d ${hours}h ${minutes}m ${seconds}s`, ephemeral: true });
        break;

      case 'botinfo':
        const botInfoEmbed = new EmbedBuilder()
          .setTitle('🤖 Bot Information')
          .addFields(
            { name: 'Bot Name', value: client.user.username, inline: true },
            { name: 'Created', value: client.user.createdAt.toDateString(), inline: true },
            { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
            { name: 'Users', value: client.users.cache.size.toString(), inline: true },
            { name: 'Commands', value: commands.length.toString(), inline: true },
            { name: 'Uptime', value: `${Math.floor((Date.now() - startTime) / (1000 * 60 * 60))}h ${Math.floor(((Date.now() - startTime) % (1000 * 60 * 60)) / (1000 * 60))}m`, inline: true }
          )
          .setColor(0x00ff00)
          .setThumbnail(client.user.displayAvatarURL());
        await interaction.reply({ embeds: [botInfoEmbed], ephemeral: true });
        break;

      case 'serverinfo':
        const serverInfoEmbed = new EmbedBuilder()
          .setTitle('🏠 Server Information')
          .addFields(
            { name: 'Server Name', value: guild.name, inline: true },
            { name: 'Owner', value: (await guild.fetchOwner()).user.tag, inline: true },
            { name: 'Members', value: guild.memberCount.toString(), inline: true },
            { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
            { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
            { name: 'Created', value: guild.createdAt.toDateString(), inline: true },
            { name: 'Boost Level', value: guild.premiumTier.toString(), inline: true },
            { name: 'Boosts', value: guild.premiumSubscriptionCount?.toString() || '0', inline: true }
          )
          .setColor(0x00ff00)
          .setThumbnail(guild.iconURL());
        await interaction.reply({ embeds: [serverInfoEmbed], ephemeral: true });
        break;

      case 'userinfo':
        const userInfoUser = interaction.options.getUser('user') || interaction.user;
        const userInfoMember = await guild.members.fetch(userInfoUser.id);
        const userInfoEmbed = new EmbedBuilder()
          .setTitle('👤 User Information')
          .addFields(
            { name: 'Username', value: userInfoUser.tag, inline: true },
            { name: 'ID', value: userInfoUser.id, inline: true },
            { name: 'Joined Server', value: userInfoMember.joinedAt?.toDateString() || 'Unknown', inline: true },
            { name: 'Account Created', value: userInfoUser.createdAt.toDateString(), inline: true },
            { name: 'Roles', value: userInfoMember.roles.cache.map(r => r.name).join(', ') || 'None', inline: false }
          )
          .setColor(0x00ff00)
          .setThumbnail(userInfoUser.displayAvatarURL());
        await interaction.reply({ embeds: [userInfoEmbed], ephemeral: true });
        break;

      case 'roles':
        const rolesList = guild.roles.cache
          .filter(role => role.name !== '@everyone')
          .sort((a, b) => b.position - a.position)
          .map(role => `${role.name} (${role.members.size} members)`)
          .join('\n');
        const rolesEmbed = new EmbedBuilder()
          .setTitle('📋 Server Roles')
          .setDescription(rolesList || 'No roles found.')
          .setColor(0x00ff00);
        await interaction.reply({ embeds: [rolesEmbed], ephemeral: true });
        break;

      case 'avatar':
        const avatarUser = interaction.options.getUser('user') || interaction.user;
        const avatarEmbed = new EmbedBuilder()
          .setTitle(`${avatarUser.tag}'s Avatar`)
          .setImage(avatarUser.displayAvatarURL({ size: 512 }))
          .setColor(0x00ff00);
        await interaction.reply({ embeds: [avatarEmbed], ephemeral: true });
        break;

      case 'channelinfo':
        const channelInfoChannel = interaction.options.getChannel('channel') || interaction.channel;
        const channelInfoEmbed = new EmbedBuilder()
          .setTitle('📺 Channel Information')
          .addFields(
            { name: 'Name', value: channelInfoChannel.name, inline: true },
            { name: 'ID', value: channelInfoChannel.id, inline: true },
            { name: 'Type', value: channelInfoChannel.type.toString(), inline: true },
            { name: 'Created', value: channelInfoChannel.createdAt.toDateString(), inline: true },
            { name: 'NSFW', value: channelInfoChannel.nsfw ? 'Yes' : 'No', inline: true }
          )
          .setColor(0x00ff00);
        await interaction.reply({ embeds: [channelInfoEmbed], ephemeral: true });
        break;

      case 'invite':
        try {
          const invite = await interaction.channel.createInvite({ maxAge: 86400, maxUses: 1 });
          await interaction.reply({ content: `Here's a temporary invite: ${invite.url}`, ephemeral: true });
        } catch (error) {
          await interaction.reply({ content: 'Could not create invite. Check bot permissions.', ephemeral: true });
        }
        break;

case 'removerole': {
    const role = interaction.options.getRole('role');
    const target = interaction.options.getString('target');
    const user = interaction.options.getUser('user');

    if (target === 'everyone') {
        await guild.members.fetch();

        let removed = 0;
        for (const [, member] of guild.members.cache) {
            if (member.roles.cache.has(role.id)) {
                try {
                    await member.roles.remove(role);
                    removed++;
                } catch {}
            }
        }

        return interaction.reply({
            content: `✅ Removed **${role.name}** from **${removed}** members.`,
            ephemeral: true
        });
    }

    if (!user) {
        return interaction.reply({
            content: '❌ You must choose a user.',
            ephemeral: true
        });
    }

    const member = await guild.members.fetch(user.id);
    await member.roles.remove(role);

    return interaction.reply({
        content: `✅ Removed **${role.name}** from ${user.tag}.`,
        ephemeral: true
    });
}

      case 'randommember':
        const members = await guild.members.fetch();
        const randomMember = members.random();
        await interaction.reply({ content: `🎲 Random member: ${randomMember.user.tag}`, ephemeral: true });
        break;

      case 'countroles':
        const roleCounts = guild.roles.cache
          .filter(role => role.name !== '@everyone')
          .map(role => `${role.name}: ${role.members.size} members`)
          .join('\n');
        const countRolesEmbed = new EmbedBuilder()
          .setTitle('📊 Role Member Counts')
          .setDescription(roleCounts || 'No roles found.')
          .setColor(0x00ff00);
        await interaction.reply({ embeds: [countRolesEmbed], ephemeral: true });
        break;

      case 'say':
        const sayMessage = interaction.options.getString('message');
        await interaction.reply({ content: sayMessage });
        break;

      case 'serverbanner':
        if (guild.bannerURL()) {
          const bannerEmbed = new EmbedBuilder()
            .setTitle(`${guild.name}'s Banner`)
            .setImage(guild.bannerURL({ size: 1024 }))
            .setColor(0x00ff00);
          await interaction.reply({ embeds: [bannerEmbed], ephemeral: true });
        } else {
          await interaction.reply({ content: 'This server does not have a banner.', ephemeral: true });
        }
        break;

      case 'ticket': {
        const title = interaction.options.getString('title');
        console.log(`Creating ticket with title: ${title}`);
        
        // Find the next available ticket number
        let ticketNumber = ticketCounter + 1;
        let channelName = `ticket-${ticketNumber}`;
        
        // Make sure the channel name is unique
        while (guild.channels.cache.some(ch => ch.name === channelName)) {
          ticketNumber++;
          channelName = `ticket-${ticketNumber}`;
        }
        
        ticketCounter = ticketNumber;
        console.log(`Creating ticket channel: ${channelName} (number: ${ticketNumber})`);

        try {
          // Get the cmds role
          const cmdsRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'cmds');
          if (!cmdsRole) {
            return interaction.reply({ content: '❌ "cmds" role not found. Please create it first.', ephemeral: true });
          }

          // Create the ticket channel
          const ticketChannel = await guild.channels.create({
            name: channelName,
            type: 0, // Text channel
            permissionOverwrites: [
              {
                id: guild.id, // @everyone
                deny: ['ViewChannel'],
              },
              {
                id: interaction.user.id, // Ticket creator
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
              },
              {
                id: cmdsRole.id, // cmds role
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
              },
              {
                id: client.user.id, // Bot
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
              },
            ],
          });
          
          console.log(`Successfully created ticket channel: ${ticketChannel.name}`);

          // Create claim button
          const claimButton = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`claim_ticket_${ticketNumber}`)
                .setLabel('Claim Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
            );

          // Send initial message in ticket channel
          const ticketEmbed = new EmbedBuilder()
            .setTitle(`🎫 Ticket #${ticketNumber}`)
            .setDescription(`**Title:** ${title}\n**Created by:** ${interaction.user.tag}\n**Status:** Open`)
            .setColor(0x00FF00)
            .setTimestamp();

          await ticketChannel.send({
            content: `${interaction.user} created this ticket.`,
            embeds: [ticketEmbed],
            components: [claimButton]
          });

          await interaction.reply({ content: `✅ Ticket created! Check ${ticketChannel}`, ephemeral: true });

          // Log to bot-use channel
          const botUseChannel = await getBotUseChannel(guild);
          if (botUseChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🎫 New Ticket Created')
              .setDescription(`**Ticket:** #${ticketNumber}\n**Title:** ${title}\n**Created by:** ${interaction.user.tag}\n**Channel:** ${ticketChannel}`)
              .setColor(0x00FF00)
              .setTimestamp();
            await botUseChannel.send({ embeds: [logEmbed] }).catch(() => null);
          }

        } catch (error) {
          console.error('Error creating ticket:', error);
          await interaction.reply({ content: '❌ Failed to create ticket.', ephemeral: true });
        }
        break;
      }

      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const { customId, guild, member, user } = interaction;

  if (customId.startsWith('claim_ticket_')) {
    const ticketNumber = customId.split('_')[2];

    // Check if user has cmds role
    const cmdsRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'cmds');
    if (!cmdsRole || !member.roles.cache.has(cmdsRole.id)) {
      return interaction.reply({ content: '❌ You need the cmds role to claim tickets.', ephemeral: true });
    }

    try {
      // Delete the ticket channel
      await interaction.channel.delete();

      // Log to bot-use channel
      const botUseChannel = await getBotUseChannel(guild);
      if (botUseChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('✅ Ticket Closed')
          .setDescription(`**Ticket:** #${ticketNumber}\n**Closed by:** ${user.tag}`)
          .setColor(0xFF0000)
          .setTimestamp();
        await botUseChannel.send({ embeds: [logEmbed] }).catch(() => null);
      }

    } catch (error) {
      console.error('Error closing ticket:', error);
      await interaction.reply({ content: '❌ Failed to close ticket.', ephemeral: true });
    }
  }
});

client.on('messageCreate', message => {
    if (message.channel.name === 'partners' && !message.author.bot) {
        message.delete();
    }
});

client.login(TOKEN);
