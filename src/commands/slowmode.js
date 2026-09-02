const { SlashCommandBuilder } = require('discord.js');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode duration in a channel.')
    .addChannelOption(option => option.setName('channel').setDescription('The channel to set slowmode').setRequired(true))
    .addIntegerOption(option => option.setName('time').setDescription('Slowmode time in seconds').setRequired(true).setMinValue(0).setMaxValue(21600)),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    const time = interaction.options.getInteger('time');

    try {
      await channel.setRateLimitPerUser(time);
      await interaction.reply({ content: `✅ Set slowmode in **${channel.name}** to **${time}** seconds.`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: `❌ Failed to set slowmode: ${error.message}`, ephemeral: true });
    }
  }
};
