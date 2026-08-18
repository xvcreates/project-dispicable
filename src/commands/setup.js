const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../services/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the bot for your server (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    // Check if user is admin
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Only administrators can use this command.', ephemeral: true });
    }

    const guild = interaction.guild;
    const settings = await db.getGuildSettings(guild.id);

    const setupEmbed = new EmbedBuilder()
      .setTitle('🔧 Bot Setup Wizard')
      .setDescription('Configure bot settings for your server. Click buttons to toggle features or use menus to set values.')
      .setColor(parseInt(settings.logColor || '0x0099ff'))
      .addFields(
        { name: '📋 Basic Configuration', value: 'Roles • Channels • Colors', inline: false },
        { name: '🔔 Notifications', value: 'DM on warn/mute/ban • Ping mods', inline: false },
        { name: '🎖️ Punishment Escalation', value: 'Auto-action at X warnings', inline: false },
        { name: '👋 Auto-join Features', value: 'Auto-role • Welcome messages', inline: false },
        { name: '⏱️ Moderation Defaults', value: 'Default durations & appeal links', inline: false },
        { name: '📊 Action Logging', value: 'Toggle logging for specific actions', inline: false }
      )
      .setFooter({ text: 'Use menus and buttons below to configure' });

    // Row 1: Basic Roles
    const rolesRow = new ActionRowBuilder()
      .addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId('setup_cmds_role')
          .setPlaceholder(settings.cmdsRoleIds && settings.cmdsRoleIds.length ? 'Change cmds roles' : 'Select cmds roles')
          .setMinValues(1)
          .setMaxValues(10)
      );

    // Row 2: Basic Channels
    const channelsRow = new ActionRowBuilder()
      .addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('setup_modlog_channel')
          .setPlaceholder('Select moderation log channel')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(1)
          .setMaxValues(1)
      );

    // Row 3: Log Color
    const logColorRow = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('setup_log_color')
          .setPlaceholder('Select log embed color')
          .addOptions(
            { label: '🔴 Red', value: '0xff0000', emoji: '🔴' },
            { label: '🟠 Orange', value: '0xffa500', emoji: '🟠' },
            { label: '🟡 Yellow', value: '0xffff00', emoji: '🟡' },
            { label: '🟢 Green', value: '0x00ff00', emoji: '🟢' },
            { label: '🔵 Blue', value: '0x0000ff', emoji: '🔵' },
            { label: '🟣 Purple', value: '0x8000ff', emoji: '🟣' },
            { label: '⚫ Black', value: '0x000000', emoji: '⚫' },
            { label: '⚪ White', value: '0xffffff', emoji: '⚪' },
            { label: '🟤 Gray', value: '0x808080', emoji: '🟤' },
            { label: '🩵 Cyan', value: '0x00ffff', emoji: '🩵' }
          )
          .setMinValues(1)
          .setMaxValues(1)
      );

    // Row 4: Notification Toggles
    const notificationTogglesRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`setup_notify_warn_${!settings.notifyWarnEnabled}`)
          .setLabel('DM on Warn')
          .setStyle(settings.notifyWarnEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`setup_notify_mute_${!settings.notifyMuteEnabled}`)
          .setLabel('DM on Mute')
          .setStyle(settings.notifyMuteEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`setup_notify_ban_${!settings.notifyBanEnabled}`)
          .setLabel('DM on Ban')
          .setStyle(settings.notifyBanEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`setup_ping_mods_${!settings.pingModsEnabled}`)
          .setLabel('Ping Mods')
          .setStyle(settings.pingModsEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
      );

    // Row 5: Escalation Toggle + Threshold
    const escalationRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`setup_escalation_${!settings.escalationEnabled}`)
          .setLabel('Auto-escalation')
          .setStyle(settings.escalationEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
        new StringSelectMenuBuilder()
          .setCustomId('setup_escalation_threshold')
          .setPlaceholder(`Threshold: ${settings.escalationWarnThreshold}`)
          .addOptions(
            { label: '3 Warnings', value: '3' },
            { label: '5 Warnings', value: '5' },
            { label: '7 Warnings', value: '7' },
            { label: '10 Warnings', value: '10' }
          )
          .setMinValues(1)
          .setMaxValues(1)
      );

    // Row 6: Auto-role + Selection
    const autoRoleRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`setup_auto_role_${!settings.autoRoleEnabled}`)
          .setLabel('Auto-role')
          .setStyle(settings.autoRoleEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
        new RoleSelectMenuBuilder()
          .setCustomId('setup_auto_role_id')
          .setPlaceholder('Select auto-join role')
          .setMinValues(0)
          .setMaxValues(1)
      );

    // Row 7: Welcome + Channel
    const welcomeRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`setup_welcome_${!settings.welcomeEnabled}`)
          .setLabel('Welcome')
          .setStyle(settings.welcomeEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
        new ChannelSelectMenuBuilder()
          .setCustomId('setup_welcome_channel')
          .setPlaceholder('Welcome channel (optional)')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(0)
          .setMaxValues(1)
      );

    // Row 8: Default Mute Duration
    const defaultsRow = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('setup_default_mute_duration')
          .setPlaceholder(`Mute duration: ${settings.defaultMuteDuration}m`)
          .addOptions(
            { label: '15 minutes', value: '15' },
            { label: '30 minutes', value: '30' },
            { label: '1 hour', value: '60' },
            { label: '1 day', value: '1440' },
            { label: '1 week', value: '10080' }
          )
          .setMinValues(1)
          .setMaxValues(1)
      );

    // Row 9: Action Logging Toggles
    const loggingTogglesRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`setup_log_warns_${!settings.logWarnsEnabled}`)
          .setLabel('Log Warns')
          .setStyle(settings.logWarnsEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`setup_log_mutes_${!settings.logMutesEnabled}`)
          .setLabel('Log Mutes')
          .setStyle(settings.logMutesEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`setup_log_kicks_${!settings.logKicksEnabled}`)
          .setLabel('Log Kicks')
          .setStyle(settings.logKicksEnabled ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`setup_log_bans_${!settings.logBansEnabled}`)
          .setLabel('Log Bans')
          .setStyle(settings.logBansEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
      );

    // Row 10: Audit Log Channel
    const auditLogRow = new ActionRowBuilder()
      .addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('setup_audit_log_channel')
          .setPlaceholder('Audit log channel (optional)')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(0)
          .setMaxValues(1)
      );

    await interaction.reply({
      embeds: [setupEmbed],
      components: [
        rolesRow,
        channelsRow,
        logColorRow,
        notificationTogglesRow,
        escalationRow,
        autoRoleRow,
        welcomeRow,
        defaultsRow,
        loggingTogglesRow,
        auditLogRow
      ],
      ephemeral: true
    });
  }
};
