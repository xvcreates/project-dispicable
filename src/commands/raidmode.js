const { SlashCommandBuilder } = require('discord.js');
const db = require('../services/database');
const { memberHasCmds } = require('../utils/permissionUtils');
const { applyRaidMode } = require('../services/automod');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('raidmode')
    .setDescription('Toggle raid mode on or off.'),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) {
      return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });
    }

    const guildId = interaction.guild.id;
    const settings = await db.getGuildSettings(guildId);
    const enabled = !settings.raidMode;

    await applyRaidMode(interaction.guild, enabled);

    await interaction.reply({ content: enabled ? 'Raid mode enabled. Non-staff messages will be removed.' : 'Raid mode disabled.', ephemeral: true });
  }
};
