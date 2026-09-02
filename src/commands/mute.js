const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');
const moderation = require('../services/moderation');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Temporarily mute a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to mute').setRequired(true))
    .addIntegerOption(option => option.setName('time').setDescription('Mute duration in minutes').setRequired(true)),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const time = interaction.options.getInteger('time');

    try {
      const member = await interaction.guild.members.fetch(user.id);
      const muteRole = interaction.guild.roles.cache.find(r => r.name === 'Muted');
      if (!muteRole) return interaction.reply({ content: 'Muted role not found. Please create a role named "Muted".', ephemeral: true });

      await member.roles.add(muteRole);
      await moderation.sendModerationDM(user, 'You have been muted', `Muted for ${time} minutes`);
      await moderation.logModerationAction(interaction.guild, 'mute', db, {
        targetId: user.id,
        targetTag: user.tag,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        reason: `Muted for ${time} minutes`,
        description: `Mute: ${user.tag} by ${interaction.user.tag} — ${time} minutes`,
        metadata: { durationMinutes: time }
      });

      setTimeout(async () => {
        try {
          await member.roles.remove(muteRole);
        } catch (err) {
          console.error('Failed to unmute after timeout:', err);
        }
      }, time * 60000);

      await interaction.reply({ content: `Muted ${user.tag} for ${time} minutes.`, ephemeral: true });
    } catch (error) {
      console.error('Mute error:', error);
      await interaction.reply({ content: `Failed to mute user: ${error.message}`, ephemeral: true });
    }
  }
};
