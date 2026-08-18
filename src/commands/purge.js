const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete the last X messages in a channel.')
    .addIntegerOption(option => option.setName('amount').setDescription('Number of messages to delete').setRequired(true).setMinValue(1).setMaxValue(100)),
  async execute(interaction) {
    if (!memberHasCmds(interaction.member)) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const amount = interaction.options.getInteger('amount');

    try {
      await interaction.channel.bulkDelete(amount);
      await interaction.reply({ content: `✅ Deleted ${amount} messages.`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: `❌ Failed to delete messages: ${error.message}`, ephemeral: true });
    }
  }
};
