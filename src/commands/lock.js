const { SlashCommandBuilder } = require('discord.js');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel (no sending messages).')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to lock').setRequired(true)),
  async execute(interaction) {
    if (!memberHasCmds(interaction.member)) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const channel = interaction.options.getChannel('channel');

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
      await interaction.reply({ content: `🔒 Locked **${channel.name}**.`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: `❌ Failed to lock channel: ${error.message}`, ephemeral: true });
    }
  }
};
