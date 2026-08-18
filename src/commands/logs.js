const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('View moderation logs.')
    .addIntegerOption(option => option.setName('limit').setDescription('Number of logs to show (default 10)').setRequired(false)),
  async execute(interaction) {
    try {
      const limit = interaction.options.getInteger('limit') || 10;
      const logs = await db.getLogs(interaction.guild.id, limit);

      if (!logs || logs.length === 0) {
        return interaction.reply({ content: '📋 No moderation logs found.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Last ${logs.length} Moderation Actions`)
        .setColor(0x0000ff)
        .setTimestamp();

      logs.slice(0, limit).forEach((log, index) => {
        const logText = `**${log.action.toUpperCase()}** by ${log.executorTag} on ${log.targetTag}\n${log.reason ? `Reason: ${log.reason}` : ''}`;
        embed.addFields({ name: `#${logs.length - index}`, value: logText, inline: false });
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('Logs error:', error);
      await interaction.reply({ content: `❌ Failed to fetch logs: ${error.message}`, ephemeral: true });
    }
  }
};
