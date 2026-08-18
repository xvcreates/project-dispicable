const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverbanner')
    .setDescription('Get the server banner.'),
  async execute(interaction) {
    const guild = interaction.guild;

    if (!guild.bannerURL()) {
      return interaction.reply({ content: 'This server does not have a banner.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${guild.name} Banner`)
      .setImage(guild.bannerURL({ size: 2048 }))
      .setColor(0x00ff00);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
