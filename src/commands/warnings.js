const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../services/database');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Display warnings for a user.')
    .addUserOption(option => option.setName('user').setDescription('User to inspect').setRequired(true)),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) {
      return interaction.reply({ content: 'You need the cmds role to view warnings.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const warnings = await db.getWarnings(interaction.guild.id, target.id);

    const embed = new EmbedBuilder()
      .setTitle(`Warnings for ${target.tag}`)
      .setColor(0xff9900)
      .setDescription(warnings.length ? warnings.map((warning, index) => `${index + 1}. ${warning.reason} — ${new Date(warning.created_at).toLocaleString()}`).join('\n') : 'No warnings found.');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
