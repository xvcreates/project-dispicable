const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');
const moderation = require('../services/moderation');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Remove a user from the server.')
    .addUserOption(option => option.setName('user').setDescription('The user to kick').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for kicking').setRequired(false)),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'User not found in this server.', ephemeral: true });

      await member.kick(reason);
      await moderation.sendModerationDM(user, 'You have been kicked', reason);
      await moderation.logModerationAction(interaction.guild, 'kick', db, {
        targetId: user.id,
        targetTag: user.tag,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        reason,
        description: `Kick: ${user.tag} by ${interaction.user.tag} — ${reason}`
      });

      await interaction.reply({ content: `Kicked ${user.tag} for: ${reason}`, ephemeral: true });
    } catch (error) {
      console.error('Kick error:', error);
      await interaction.reply({ content: `Failed to kick user: ${error.message}`, ephemeral: true });
    }
  }
};
