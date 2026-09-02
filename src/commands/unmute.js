const { SlashCommandBuilder } = require('discord.js');
const moderation = require('../services/moderation');
const db = require('../services/database');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove mute role from a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to unmute').setRequired(true)),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');

    try {
      const member = await interaction.guild.members.fetch(user.id);
      const muteRole = interaction.guild.roles.cache.find(r => r.name === 'Muted');
      if (!muteRole) return interaction.reply({ content: 'Muted role not found.', ephemeral: true });

      await member.roles.remove(muteRole);
      await moderation.logModerationAction(interaction.guild, 'unmute', db, {
        targetId: user.id,
        targetTag: user.tag,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        reason: 'Manual unmute',
        description: `Unmute: ${user.tag} by ${interaction.user.tag}`
      });

      await interaction.reply({ content: `Unmuted ${user.tag}.`, ephemeral: true });
    } catch (error) {
      console.error('Unmute error:', error);
      await interaction.reply({ content: `Failed to unmute user: ${error.message}`, ephemeral: true });
    }
  }
};
