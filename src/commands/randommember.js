const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('randommember')
    .setDescription('Pick a random member from the server.'),
  async execute(interaction) {
    await interaction.guild.members.fetch();
    const members = interaction.guild.members.cache.filter(m => !m.user.bot);

    if (members.size === 0) {
      return interaction.reply({ content: 'No members found.', ephemeral: true });
    }

    const randomMember = members.random();
    const embed = new EmbedBuilder()
      .setTitle('🎲 Random Member')
      .setColor(0x00ff00)
      .setThumbnail(randomMember.user.displayAvatarURL())
      .addFields(
        { name: 'Username', value: randomMember.user.tag, inline: true },
        { name: 'ID', value: randomMember.user.id, inline: true },
        { name: 'Joined', value: randomMember.joinedAt?.toDateString() || 'Unknown', inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
