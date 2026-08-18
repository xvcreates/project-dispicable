const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('countroles')
    .setDescription('Count members in each role.'),
  async execute(interaction) {
    await interaction.guild.members.fetch();

    const roleData = interaction.guild.roles.cache
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(role => `**${role.name}**: ${role.members.size} members`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('📊 Role Member Count')
      .setDescription(roleData || 'No roles found.')
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
