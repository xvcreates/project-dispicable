const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription('Get information about a channel.')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to get info about').setRequired(false)),
  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    const embed = new EmbedBuilder()
      .setTitle('📺 Channel Information')
      .setColor(0x00ff00)
      .addFields(
        { name: 'Name', value: channel.name, inline: true },
        { name: 'ID', value: channel.id, inline: true },
        { name: 'Type', value: channel.type.toString(), inline: true },
        { name: 'Created', value: channel.createdAt.toDateString(), inline: true },
        { name: 'NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
