const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
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
        { name: 'Step 1: Cmds Role', value: 'Select which role can use moderation commands', inline: false },
        { name: 'Step 2: Moderation Logs Channel', value: 'Select where moderation logs are sent', inline: false },
        { name: 'Step 3: General Logs Channel', value: 'Select where general logs are sent (optional)', inline: false }
      )
      .setFooter({ text: 'Use the menus below to configure each setting' });

    const rolesRow = new ActionRowBuilder()
      .addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId('setup_cmds_role')
          .setPlaceholder(settings.cmdsRoleId ? 'Change cmds role' : 'Select cmds role')
          .setMinValues(1)
          .setMaxValues(1)
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

    await interaction.reply({
      embeds: [setupEmbed],
      components: [rolesRow, channelsRow, generalLogsRow],
      ephemeral: true
    });
  }
};
