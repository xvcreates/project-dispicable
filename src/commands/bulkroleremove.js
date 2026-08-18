const { SlashCommandBuilder } = require('discord.js');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bulkroleremove')
    .setDescription('Remove a role from every member who has it.')
    .addRoleOption(option => option.setName('role').setDescription('The role to remove from members').setRequired(true)),
  async execute(interaction) {
    if (!memberHasCmds(interaction.member)) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const role = interaction.options.getRole('role');

    try {
      await interaction.deferReply({ ephemeral: true });

      await interaction.guild.members.fetch();
      const membersToUpdate = interaction.guild.members.cache.filter(member => member.roles.cache.has(role.id));

      if (membersToUpdate.size === 0) {
        return interaction.editReply({ content: `No members found with the **${role.name}** role.` });
      }

      let successCount = 0;
      let failedCount = 0;

      for (const [, member] of membersToUpdate) {
        try {
          await member.roles.remove(role);
          successCount++;
        } catch (error) {
          failedCount++;
          console.error(`Failed to remove ${role.name} from ${member.user.tag}:`, error);
        }
      }

      await interaction.editReply({
        content: `✅ Removed **${role.name}** from **${successCount}** member(s).${failedCount ? ` **${failedCount}** failed.` : ''}`
      });
    } catch (error) {
      console.error('Bulk role remove error:', error);
      await interaction.editReply({ content: `❌ Failed to remove role: ${error.message}` });
    }
  }
};
