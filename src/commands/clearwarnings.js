const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a user.')
    .addUserOption(option => option.setName('user').setDescription('User to clear warnings for').setRequired(true)),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) {
      return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const warnings = await db.getWarnings(interaction.guild.id, target.id);
    await db.clearWarnings(interaction.guild.id, target.id);

    await interaction.reply({ content: `Cleared ${warnings.length} warnings for ${target.tag}.`, ephemeral: true });
  }
};
