const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');
const moderation = require('../services/moderation');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Kick user and delete their last 7 days of messages.')
    .addUserOption(option => option.setName('user').setDescription('The user to softban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for softban').setRequired(false)),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      const member = await interaction.guild.members.fetch(user.id);
      // delete last 7 days of messages in current channel
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(m => m.author.id === user.id && (Date.now() - m.createdTimestamp) < 7 * 24 * 60 * 60 * 1000);
      for (const [, msg] of userMessages) {
        try { await msg.delete(); } catch (e) { /* ignore */ }
      }

      await member.kick(reason);
      await moderation.sendModerationDM(user, 'You have been softbanned', reason);
      await moderation.logModerationAction(interaction.guild, 'softban', db, {
        targetId: user.id,
        targetTag: user.tag,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        reason,
        description: `Softban: ${user.tag} by ${interaction.user.tag} — ${reason}`
      });

      await interaction.reply({ content: `Softbanned ${user.tag} and deleted recent messages.`, ephemeral: true });
    } catch (error) {
      console.error('Softban error:', error);
      await interaction.reply({ content: `Failed to softban user: ${error.message}`, ephemeral: true });
    }
  }
};
