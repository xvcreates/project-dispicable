const { SlashCommandBuilder } = require('discord.js');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Change a member\'s nickname.')
    .addUserOption(option => option.setName('user').setDescription('The user to nickname').setRequired(true))
    .addStringOption(option => option.setName('nickname').setDescription('New nickname').setRequired(true)),
  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });

    const user = interaction.options.getUser('user');
    const nickname = interaction.options.getString('nickname');

    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.setNickname(nickname);
      await interaction.reply({ content: `✅ Changed ${user.tag}'s nickname to **${nickname}**.`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: `❌ Failed to change nickname: ${error.message}`, ephemeral: true });
    }
  }
};
