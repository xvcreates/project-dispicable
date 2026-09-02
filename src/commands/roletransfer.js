const { SlashCommandBuilder } = require('discord.js');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roletransfer')
    .setDescription('Move all members from one role to another.')
    .addRoleOption(option => option.setName('from_role').setDescription('The role to remove from members').setRequired(true))
    .addRoleOption(option => option.setName('to_role').setDescription('The role to add to those members').setRequired(true)),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const fromRole = interaction.options.getRole('from_role');
    const toRole = interaction.options.getRole('to_role');

    if (fromRole.id === toRole.id) {
      return interaction.reply({ content: 'Please choose two different roles.', ephemeral: true });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
      
      await interaction.guild.members.fetch();
      const membersToUpdate = interaction.guild.members.cache.filter(member => member.roles.cache.has(fromRole.id));

      if (membersToUpdate.size === 0) {
        return interaction.editReply({ content: `No members found with the **${fromRole.name}** role.` });
      }

      let successCount = 0;
      let failedCount = 0;

      for (const [, member] of membersToUpdate) {
        try {
          await member.roles.remove(fromRole);
          await member.roles.add(toRole);
          successCount++;
        } catch (error) {
          failedCount++;
          console.error(`Failed to transfer roles for ${member.user.tag}:`, error);
        }
      }

      await interaction.editReply({
        content: `✅ Processed **${membersToUpdate.size}** members. **${successCount}** updated, **${failedCount}** failed.`
      });
    } catch (error) {
      console.error('Role transfer error:', error);
      await interaction.editReply({ content: `❌ Failed to transfer roles: ${error.message}` });
    }
  }
};
