const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');
const moderation = require('../services/moderation');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server.')
    .addUserOption(option => option.setName('user').setDescription('The user to unban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for unbanning').setRequired(false)),
  async execute(interaction) {
    if (!memberHasCmds(interaction.member)) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      if (!interaction.guild.members.me.permissions.has('BanMembers')) {
        return interaction.reply({ content: 'I do not have permission to unban members.', ephemeral: true });
      }

      await interaction.guild.bans.remove(user.id, reason);
      await moderation.logModerationAction(interaction.guild, 'unban', db, {
        targetId: user.id,
        targetTag: user.tag,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        reason,
        description: `Unban: ${user.tag} by ${interaction.user.tag} — ${reason}`
      });

      await interaction.reply({ content: `✅ Unbanned ${user.tag}. Reason: ${reason}`, ephemeral: true });
    } catch (error) {
      console.error('Unban error:', error);
      await interaction.reply({ content: `❌ Failed to unban user: ${error.message}`, ephemeral: true });
    }
  }
};
