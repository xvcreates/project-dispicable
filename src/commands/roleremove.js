const { SlashCommandBuilder } = require('discord.js');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleremove')
    .setDescription('Remove a role from a member.')
    .addUserOption(option => option.setName('user').setDescription('The user to remove role from').setRequired(true))
    .addRoleOption(option => option.setName('role').setDescription('The role to remove').setRequired(true)),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.roles.remove(role);
      await interaction.reply({ content: `✅ Removed role **${role.name}** from ${user.tag}.`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: `❌ Failed to remove role: ${error.message}`, ephemeral: true });
    }
  }
};
