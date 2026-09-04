const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../services/database');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deletefuture')
    .setDescription('Delete future messages in this channel while leaving bot messages.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) {
      return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });
    }

    const botMember = interaction.guild.members.me;
    if (!botMember || !interaction.channel.permissionsFor(botMember).has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: 'I need the **Manage Messages** permission in this channel before I can delete future messages.', ephemeral: true });
    }

    await db.enableDeleteFuture(interaction.guild.id, interaction.channel.id);
    console.log(`[deletefuture] Enabled in ${interaction.guild.name} / #${interaction.channel.name}`);
    await interaction.reply({ content: 'Future messages in this channel will now be deleted. Bot messages are exempt.', ephemeral: true });
  }
};