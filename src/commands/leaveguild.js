const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function isOwnerUser(user) {
  if (!user) return false;
  const ownerId = process.env.OWNER_ID;
  const username = user.username?.toLowerCase();

  return Boolean((ownerId && user.id === ownerId) || username === 'xvlmh');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaveguild')
    .setDescription('Force the bot to leave a guild. Owner only.')
    .addStringOption(option =>
      option
        .setName('guild_id')
        .setDescription('The server ID to leave')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('Optional reason for leaving')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!isOwnerUser(interaction.user)) {
      return interaction.reply({
        content: '❌ This command is owner-only.',
        ephemeral: true
      });
    }

    const guildId = interaction.options.getString('guild_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const guild = interaction.client.guilds.cache.get(guildId) || await interaction.client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      return interaction.reply({
        content: `❌ I am not in a guild with ID ${guildId}.`,
        ephemeral: true
      });
    }

    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Leave Guild Confirmation')
      .setDescription(`You are about to make the bot leave **${guild.name}**.\n\nReason: ${reason}`)
      .setColor(0xff9900);

    await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });

    try {
      await guild.leave();
      await interaction.followUp({
        content: `✅ Left guild **${guild.name}** (${guild.id}).`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.followUp({
        content: `❌ Failed to leave guild **${guild.name}**: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
