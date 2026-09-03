const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../services/database');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('canceldeletefuture')
    .setDescription('Stop deleting future messages in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) {
      return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });
    }

    await db.disableDeleteFuture(interaction.guild.id, interaction.channel.id);
    await interaction.reply({ content: 'Future message deletion has been disabled in this channel.', ephemeral: true });
  }
};