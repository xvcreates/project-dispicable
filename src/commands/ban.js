const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');
const moderation = require('../services/moderation');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user permanently.')
    .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for banning').setRequired(false)),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      // check permissions
      if (!interaction.guild.members.me.permissions.has('BanMembers')) {
        return interaction.reply({ content: 'I do not have permission to ban members.', ephemeral: true });
      }

      await interaction.guild.members.ban(user, { reason });
      await moderation.sendModerationDM(user, 'You have been banned', reason);
      await moderation.logModerationAction(interaction.guild, 'ban', db, {
        targetId: user.id,
        targetTag: user.tag,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        reason,
        description: `Ban: ${user.tag} by ${interaction.user.tag} — ${reason}`
      });

      await interaction.reply({ content: `Banned ${user.tag} for: ${reason}`, ephemeral: true });
    } catch (error) {
      console.error('Ban error:', error);
      await interaction.reply({ content: `Failed to ban user: ${error.message}`, ephemeral: true });
    }
  }
};
