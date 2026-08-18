const { SlashCommandBuilder } = require('discord.js');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleadd')
    .setDescription('Assign a role to a member.')
    .addUserOption(option => option.setName('user').setDescription('The user to assign role').setRequired(true))
    .addRoleOption(option => option.setName('role').setDescription('The role to assign').setRequired(true)),
  async execute(interaction) {
    if (!memberHasCmds(interaction.member)) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.roles.add(role);
      await interaction.reply({ content: `✅ Added role **${role.name}** to ${user.tag}.`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: `❌ Failed to add role: ${error.message}`, ephemeral: true });
    }
  }
};
