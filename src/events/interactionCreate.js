const db = require('../services/database');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: 'Unknown command.', ephemeral: true });
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('Command execution error:', error);
        await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
      }
    }

    // Handle role select menus
    if (interaction.isRoleSelectMenu()) {
      const guild = interaction.guild;

      if (interaction.customId.startsWith('setup_cmds_role') || interaction.customId.startsWith('settings_cmds_role')) {
        const selectedRoles = interaction.values;
        try {
          await db.updateCmdsRole(guild.id, selectedRoles);
          const roleMentions = await Promise.all(selectedRoles.map(async (roleId) => {
            const role = await guild.roles.fetch(roleId);
            return role ? role.toString() : roleId;
          }));
          const embed = new EmbedBuilder()
            .setTitle('✅ Roles Updated')
            .setDescription(`Cmds roles have been set to ${roleMentions.join(', ')}`)
            .setColor(0x00ff00);
          await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update role: ${error.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('setup_ticket_ping_roles') || interaction.customId.startsWith('settings_ticket_ping_roles')) {
        try {
          await db.updateTicketPingRoles(guild.id, interaction.values);
          const roleMentions = await Promise.all(interaction.values.map(async (roleId) => {
            const role = await guild.roles.fetch(roleId);
            return role ? role.toString() : roleId;
          }));
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('✅ Ticket Ping Roles Updated').setDescription(`Ticket ping roles: ${roleMentions.join(', ') || 'None'}`).setColor(0x00ff00)],
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update ticket ping roles: ${error.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('setup_ticket_view_roles') || interaction.customId.startsWith('settings_ticket_view_roles')) {
        try {
          await db.updateTicketViewRoles(guild.id, interaction.values);
          const roleMentions = await Promise.all(interaction.values.map(async (roleId) => {
            const role = await guild.roles.fetch(roleId);
            return role ? role.toString() : roleId;
          }));
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('✅ Ticket View Roles Updated').setDescription(`Ticket view roles: ${roleMentions.join(', ') || 'None'}`).setColor(0x00ff00)],
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update ticket view roles: ${error.message}`, ephemeral: true });
        }
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('setup_ticket_ping_toggle') || interaction.customId.startsWith('settings_ticket_ping_toggle')) {
        const enabled = interaction.values[0] === 'true';
        try {
          await db.updateTicketPingEnabled(interaction.guild.id, enabled);
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('✅ Ticket Ping Updated').setDescription(enabled ? 'Ticket ping is enabled.' : 'Ticket ping is disabled.').setColor(0x00ff00)],
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update ticket ping setting: ${error.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('setup_log_color') || interaction.customId.startsWith('settings_log_color')) {
        const colorHex = interaction.values[0];
        try {
          await db.updateLogColor(interaction.guild.id, colorHex);
          const colorName = {
            '0xff0000': 'Red',
            '0xffa500': 'Orange',
            '0xffff00': 'Yellow',
            '0x00ff00': 'Green',
            '0x0000ff': 'Blue',
            '0x8000ff': 'Purple',
            '0x000000': 'Black',
            '0xffffff': 'White',
            '0x808080': 'Gray',
            '0x00ffff': 'Cyan'
          };
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('✅ Log Color Updated').setDescription(`Log embeds color set to **${colorName[colorHex] || colorHex}**`).setColor(parseInt(colorHex))],
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update log color: ${error.message}`, ephemeral: true });
        }
      }
    }

    // Handle channel select menus
    if (interaction.isChannelSelectMenu()) {
      const guild = interaction.guild;
      const selectedChannel = interaction.values[0];

      if (interaction.customId.startsWith('setup_modlog_channel') || interaction.customId.startsWith('settings_modlog_channel')) {
        try {
          await db.updateModlogChannel(guild.id, selectedChannel);
          const channel = await guild.channels.fetch(selectedChannel);
          const embed = new EmbedBuilder()
            .setTitle('✅ Channel Updated')
            .setDescription(`Moderation log channel has been set to ${channel}`)
            .setColor(0x00ff00);
          await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update channel: ${error.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('setup_general_log_channel') || interaction.customId.startsWith('settings_general_log_channel')) {
        try {
          if (interaction.values.length === 0) {
            await db.updateGeneralLogChannel(guild.id, null);
            const embed = new EmbedBuilder()
              .setTitle('✅ Channel Cleared')
              .setDescription('General log channel has been unset')
              .setColor(0x00ff00);
            await interaction.reply({ embeds: [embed], ephemeral: true });
          } else {
            await db.updateGeneralLogChannel(guild.id, selectedChannel);
            const channel = await guild.channels.fetch(selectedChannel);
            const embed = new EmbedBuilder()
              .setTitle('✅ Channel Updated')
              .setDescription(`General log channel has been set to ${channel}`)
              .setColor(0x00ff00);
            await interaction.reply({ embeds: [embed], ephemeral: true });
          }
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update channel: ${error.message}`, ephemeral: true });
        }
      }
    }
  }
};
