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
      .setDescription('Configure bot settings for your server')
      .setColor(0x00ff00)
      .addFields(
        { name: 'Step 1: Cmds Role', value: 'Select which role(s) can use moderation commands', inline: false },
        { name: 'Step 2: Moderation Logs Channel', value: 'Select where moderation logs are sent', inline: false },
        { name: 'Step 3: General Logs Channel', value: 'Select where general logs are sent (optional)', inline: false },
        { name: 'Step 4: Log Color', value: 'Choose a color for log embeds', inline: false },
        { name: 'Step 5: Ticket Ping Roles', value: 'Select role(s) to ping when tickets are created', inline: false },
        { name: 'Step 6: Ticket View Roles', value: 'Select role(s) allowed to view tickets', inline: false },
        { name: 'Step 7: Ticket Ping Toggle', value: settings.ticketPingEnabled ? 'Ping is enabled' : 'Ping is disabled', inline: false }
      )
      .setFooter({ text: 'Use the menus below to configure each setting' });

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
            { label: '🩶 Gray', value: '0x808080', emoji: '🩶' },
            { label: '🩵 Cyan', value: '0x00ffff', emoji: '🩵' }
          )
          .setMinValues(1)
          .setMaxValues(1)
      );

    const ticketPingRolesRow = new ActionRowBuilder()
      .addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId('setup_ticket_ping_roles')
          .setPlaceholder('Select ticket ping roles')
          .setMinValues(0)
          .setMaxValues(10)
      );

    const ticketViewRolesRow = new ActionRowBuilder()
      .addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId('setup_ticket_view_roles')
          .setPlaceholder('Select ticket view roles')
          .setMinValues(0)
          .setMaxValues(10)
      );

    const ticketPingToggleRow = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('setup_ticket_ping_toggle')
          .setPlaceholder('Choose ticket ping mode')
          .addOptions(
            { label: 'No ping', value: 'false', default: !settings.ticketPingEnabled },
            { label: 'Ping selected roles', value: 'true', default: settings.ticketPingEnabled }
          )
          .setMinValues(1)
          .setMaxValues(1)
      );

    await interaction.reply({
      embeds: [setupEmbed],
      components: [rolesRow, channelsRow, generalLogsRow, logColorRow, ticketPingRolesRow, ticketViewRolesRow, ticketPingToggleRow],
      ephemeral: true
    });
  }
};
