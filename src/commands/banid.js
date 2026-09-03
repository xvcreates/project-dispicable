const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../services/database');
const moderation = require('../services/moderation');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banid')
    .setDescription('Ban a user by ID (works for users who left).')
    .addStringOption(option => option.setName('user_id').setDescription('The user ID to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for the ban').setRequired(false)),

  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) {
      return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });
    }

    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.guild.bans.create(userId, { reason: `${reason} — banned by ${interaction.user.tag}` });
    } catch (error) {
      return interaction.reply({ content: `Failed to ban user ID ${userId}: ${error.message}`, ephemeral: true });
    }

    // Attempt to DM the user
    let fetchedUser = null;
    try {
      fetchedUser = await interaction.client.users.fetch(userId);
      const embed = new EmbedBuilder()
        .setTitle('You have been banned')
        .setDescription(`You were banned from **${interaction.guild.name}** for: ${reason}`)
        .setColor(parseInt((await db.getGuildSettings(interaction.guild.id)).logColor || '0x0099ff'))
        .setTimestamp();
      await fetchedUser.send({ embeds: [embed] }).catch(() => null);
    } catch (err) {
      // ignore fetch/DM failures
    }

    await moderation.logModerationAction(interaction.guild, 'ban', db, {
      targetId: userId,
      targetTag: fetchedUser ? fetchedUser.tag : `User ID ${userId}`,
      executorId: interaction.user.id,
      executorTag: interaction.user.tag,
      reason,
      description: `Ban: User ID ${userId} by ${interaction.user.tag} — ${reason}`
    });

    await interaction.reply({ content: `Banned user ID ${userId}. DM attempted.`, ephemeral: true });
  }
};
