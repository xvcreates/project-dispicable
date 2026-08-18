const { SlashCommandBuilder } = require('discord.js');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a previously locked channel.')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to unlock').setRequired(true)),
  async execute(interaction) {
    if (!memberHasCmds(interaction.member)) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const channel = interaction.options.getChannel('channel');

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
      await interaction.reply({ content: `🔓 Unlocked **${channel.name}**.`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: `❌ Failed to unlock channel: ${error.message}`, ephemeral: true });
    }
  }
};
