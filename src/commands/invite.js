const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Create an invite link for the server.'),
  async execute(interaction) {
    try {
      const invite = await interaction.channel.createInvite({ maxAge: 86400, maxUses: 1 });
      await interaction.reply({ content: `🔗 Here's a temporary invite: ${invite.url}`, ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: '❌ Could not create invite. Check bot permissions.', ephemeral: true });
    }
  }
};
