const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

let startTime = Date.now();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Check how long the bot has been running.'),
  async execute(interaction) {
    const uptime = Date.now() - startTime;
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptime % (1000 * 60)) / 1000);

    await interaction.reply({
      content: `⏱️ Bot uptime: **${days}d ${hours}h ${minutes}m ${seconds}s**`,
      ephemeral: true
    });
  }
};
