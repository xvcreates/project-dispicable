const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('List all roles in the server.'),
  async execute(interaction) {
    const roles = interaction.guild.roles.cache
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(role => `**${role.name}** (${role.members.size} members)`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('📋 Server Roles')
      .setDescription(roles || 'No roles found.')
      .setColor(0x00ff00);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
