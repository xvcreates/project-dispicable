const db = require('../services/database');
const { EmbedBuilder } = require('discord.js');

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
        const selectedRole = interaction.values[0];
        try {
          await db.updateCmdsRole(guild.id, selectedRole);
          const role = await guild.roles.fetch(selectedRole);
          const embed = new EmbedBuilder()
            .setTitle('✅ Role Updated')
            .setDescription(`Cmds role has been set to ${role}`)
            .setColor(0x00ff00);
          await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update role: ${error.message}`, ephemeral: true });
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
