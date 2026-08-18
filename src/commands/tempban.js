const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');
const moderation = require('../services/moderation');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Temporarily ban a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
    .addIntegerOption(option => option.setName('hours').setDescription('Ban duration in hours').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for ban').setRequired(false)),
  async execute(interaction) {
    if (!memberHasCmds(interaction.member)) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const hours = interaction.options.getInteger('hours');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      if (!interaction.guild.members.me.permissions.has('BanMembers')) {
        return interaction.reply({ content: 'I do not have permission to ban members.', ephemeral: true });
      }

      await interaction.guild.members.ban(user, { reason });
      await moderation.sendModerationDM(user, 'You have been temporarily banned', reason);
      await moderation.logModerationAction(interaction.guild, 'tempban', db, {
        targetId: user.id,
        targetTag: user.tag,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        reason,
        description: `Tempban: ${user.tag} by ${interaction.user.tag} for ${hours}h — ${reason}`
      });

      await interaction.reply({ content: `✅ Temporarily banned ${user.tag} for **${hours}** hours. Reason: ${reason}`, ephemeral: true });

      // Auto-unban after duration
      setTimeout(async () => {
        try {
          await interaction.guild.bans.remove(user.id, 'Temporary ban expired');
          console.log(`✅ Auto-unbanned ${user.tag} after ${hours} hours`);
        } catch (err) {
          console.error(`Failed to auto-unban ${user.tag}:`, err);
        }
      }, hours * 3600000);
    } catch (error) {
      console.error('Tempban error:', error);
      await interaction.reply({ content: `❌ Failed to ban user: ${error.message}`, ephemeral: true });
    }
  }
};
