const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infractions')
    .setDescription('View all infractions (warnings, mutes, kicks, bans) on a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to check').setRequired(true)),
  async execute(interaction) {
    try {
      const user = interaction.options.getUser('user');
      const infractions = await db.getInfractions(interaction.guild.id, user.id);

      if (!infractions || infractions.length === 0) {
        return interaction.reply({ content: `📋 No infractions found for ${user.tag}.`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Infractions for ${user.tag}`)
        .setColor(0xff0000)
        .setFooter({ text: `Total infractions: ${infractions.length}` })
        .setTimestamp();

      infractions.forEach((infr, index) => {
        const infrText = `**${infr.action.toUpperCase()}** by ${infr.executorTag}\nReason: ${infr.reason || 'N/A'}`;
        embed.addFields({ name: `#${index + 1}`, value: infrText, inline: false });
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('Infractions error:', error);
      await interaction.reply({ content: `❌ Failed to fetch infractions: ${error.message}`, ephemeral: true });
    }
  }
};
