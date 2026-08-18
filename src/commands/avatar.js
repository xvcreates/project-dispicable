const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Get a user\'s avatar.')
    .addUserOption(option => option.setName('user').setDescription('The user to get avatar for').setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;

    const embed = new EmbedBuilder()
      .setTitle(`${user.tag}'s Avatar`)
      .setImage(user.displayAvatarURL({ size: 512 }))
      .setColor(0x00ff00);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
