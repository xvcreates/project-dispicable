const db = require('../services/database');
const { createWelcomeEmbed } = require('../services/welcome');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      console.log(`[welcome] Join event received for ${member.user.tag} in ${member.guild.name} (${member.guild.id})`);
      const settings = await db.getGuildSettings(member.guild.id);
      // A selected channel is the source of truth, including settings saved by older versions.
      if (!settings.welcomeChannelId) {
        console.log(`[welcome] No welcome channel configured for ${member.guild.name} (${member.guild.id})`);
        return;
      }

      const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        console.error(`[welcome] Configured channel ${settings.welcomeChannelId} is unavailable in ${member.guild.name}`);
        return;
      }

      await channel.send({ content: `Welcome ${member}!`, embeds: [createWelcomeEmbed(member, settings.logColor)] });
    } catch (error) {
      console.error(`Failed to send welcome message in ${member.guild.name}:`, error);
    }
  }
};
