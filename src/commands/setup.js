const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
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
      .setDescription('Choose the roles allowed to use commands, log channels, log color, and the welcome channel.')
      .setColor(parseInt(settings.logColor || '0x0099ff'))
      .addFields(
        { name: 'Command roles', value: settings.cmdsRoleIds?.length ? settings.cmdsRoleIds.map(roleId => `<@&${roleId}>`).join(', ') : 'Not set', inline: false },
        { name: 'Moderation logs', value: settings.modlogChannelId ? `<#${settings.modlogChannelId}>` : 'Not set', inline: true },
        { name: 'General logs', value: settings.generalLogChannelId ? `<#${settings.generalLogChannelId}>` : 'Not set', inline: true },
        { name: 'Welcome messages', value: settings.welcomeEnabled && settings.welcomeChannelId ? `Enabled in <#${settings.welcomeChannelId}>` : 'Disabled', inline: false }
      )
      .setFooter({ text: 'You can reopen /setup at any time to change these settings.' });

    // Discord permits at most five component rows per message.
    const rolesRow = new ActionRowBuilder()
      .addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId('setup_cmds_role')
          .setPlaceholder(settings.cmdsRoleIds && settings.cmdsRoleIds.length ? 'Change cmds roles' : 'Select cmds roles')
          .setMinValues(1)
          .setMaxValues(10)
      );

    const channelsRow = new ActionRowBuilder()
      .addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('setup_modlog_channel')
          .setPlaceholder('Select moderation log channel')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(1)
          .setMaxValues(1)
      );

    const generalLogsRow = new ActionRowBuilder()
      .addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('setup_general_log_channel')
          .setPlaceholder('Select general log channel (optional)')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(0)
          .setMaxValues(1)
      );

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

    const welcomeRow = new ActionRowBuilder()
      .addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('setup_welcome_channel')
          .setPlaceholder('Select welcome channel (enables welcome messages)')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(0)
          .setMaxValues(1)
      );

    await interaction.reply({
      embeds: [setupEmbed],
      components: [
        rolesRow,
        channelsRow,
        generalLogsRow,
        logColorRow,
        welcomeRow
      ],
      ephemeral: true
    });
  }
};
