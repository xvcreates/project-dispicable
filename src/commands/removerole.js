const { SlashCommandBuilder } = require('discord.js');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removerole')
    .setDescription('Remove a role from one user or everyone.')
    .addRoleOption(option => option.setName('role').setDescription('Role to remove').setRequired(true))
    .addStringOption(option => option
      .setName('target')
      .setDescription('Who to remove the role from')
      .setRequired(true)
      .addChoices(
        { name: 'User', value: 'user' },
        { name: 'Everyone', value: 'everyone' }
      ))
    .addUserOption(option => option.setName('user').setDescription('User to remove the role from')),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const role = interaction.options.getRole('role');
    const target = interaction.options.getString('target');
    const user = interaction.options.getUser('user');

    try {
      if (target === 'everyone') {
        await interaction.deferReply({ ephemeral: true });
        await interaction.guild.members.fetch();

        let removed = 0;
        for (const [, member] of interaction.guild.members.cache) {
          if (member.roles.cache.has(role.id)) {
            try {
              await member.roles.remove(role);
              removed++;
            } catch (err) {
              console.error(`Failed to remove ${role.name} from ${member.user.tag}:`, err);
            }
          }
        }

        return interaction.editReply({
          content: `✅ Removed **${role.name}** from **${removed}** members.`
        });
      } else if (target === 'user') {
        if (!user) {
          return interaction.reply({ content: 'Please specify a user to remove the role from.', ephemeral: true });
        }

        const member = await interaction.guild.members.fetch(user.id);
        await member.roles.remove(role);
        return interaction.reply({
          content: `✅ Removed **${role.name}** from ${user.tag}.`,
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Remove role error:', error);
      await interaction.reply({ content: `❌ Failed to remove role: ${error.message}`, ephemeral: true });
    }
  }
};
