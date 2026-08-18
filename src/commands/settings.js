const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
const db = require('../services/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('View and manage bot settings for your server (admin only)')
    .setDefaultMemberPermissions('0x8'), // ADMINISTRATOR
  async execute(interaction) {
    // Check if user is admin
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ Only administrators can use this command.', ephemeral: true });
    }

    const guild = interaction.guild;
    const settings = await db.getGuildSettings(guild.id);

    // Get role and channel objects for display
    let cmdsRoleName = 'Not set';
    let modlogChannelName = 'Not set';
    let generalLogChannelName = 'Not set';

    if (settings.cmdsRoleId) {
      try {
        const role = await guild.roles.fetch(settings.cmdsRoleId);
        cmdsRoleName = role ? `<@&${role.id}>` : 'Role not found';
      } catch (e) {
        cmdsRoleName = 'Role not found';
      }
    }

    if (settings.modlogChannelId) {
      try {
        const channel = await guild.channels.fetch(settings.modlogChannelId);
        modlogChannelName = channel ? `<#${channel.id}>` : 'Channel not found';
      } catch (e) {
        modlogChannelName = 'Channel not found';
      }
    }

    if (settings.generalLogChannelId) {
      try {
        const channel = await guild.channels.fetch(settings.generalLogChannelId);
        generalLogChannelName = channel ? `<#${channel.id}>` : 'Channel not found';
      } catch (e) {
        generalLogChannelName = 'Channel not found';
      }
    }

    const settingsEmbed = new EmbedBuilder()
      .setTitle('⚙️ Bot Settings')
      .setDescription(`Current configuration for **${guild.name}**`)
      .setColor(0x0099ff)
      .addFields(
        { name: '🛡️ Cmds Role', value: cmdsRoleName, inline: false },
        { name: '📋 Moderation Log Channel', value: modlogChannelName, inline: false },
        { name: '📊 General Log Channel', value: generalLogChannelName, inline: false },
        { name: '🤖 Automod', value: settings.automodEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
        { name: '📨 Block Invites', value: settings.blockInvites ? '✅ Yes' : '❌ No', inline: true },
        { name: '🔴 Raid Mode', value: settings.raidMode ? '✅ Active' : '❌ Inactive', inline: true }
      )
      .setFooter({ text: 'Use the menus below to update settings' })
      .setTimestamp();

    const rolesRow = new ActionRowBuilder()
      .addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId('settings_cmds_role')
          .setPlaceholder('Change cmds role')
          .setMinValues(1)
          .setMaxValues(1)
      );

    const modlogRow = new ActionRowBuilder()
      .addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('settings_modlog_channel')
          .setPlaceholder('Change moderation log channel')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(1)
          .setMaxValues(1)
      );

    const generalLogRow = new ActionRowBuilder()
      .addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('settings_general_log_channel')
          .setPlaceholder('Change general log channel')
          .addChannelTypes(ChannelType.GuildText)
          .setMinValues(0)
          .setMaxValues(1)
      );

    await interaction.reply({
      embeds: [settingsEmbed],
      components: [rolesRow, modlogRow, generalLogRow],
      ephemeral: true
    });
  }
};
