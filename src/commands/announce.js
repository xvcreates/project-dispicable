const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement message to a channel.')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to announce in').setRequired(true))
    .addStringOption(option => option.setName('message').setDescription('The announcement message').setRequired(true)),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    try {
      await channel.send(message);
      await interaction.reply({ content: `✅ Announcement sent to **${channel.name}**.`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: `❌ Failed to send announcement: ${error.message}`, ephemeral: true });
    }
  }
};
