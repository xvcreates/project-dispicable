const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Get information about the bot.'),
  async execute(interaction) {
    const client = interaction.client;
    const embed = new EmbedBuilder()
      .setTitle('🤖 Bot Information')
      .setColor(0x00ff00)
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: 'Bot Name', value: client.user.username, inline: true },
        { name: 'Created', value: client.user.createdAt.toDateString(), inline: true },
        { name: 'Servers', value: client.guilds.cache.size.toString(), inline: true },
        { name: 'Users', value: client.users.cache.size.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
