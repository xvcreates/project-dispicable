const { EmbedBuilder } = require('discord.js');
const db = require('../services/database');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      const settings = await db.getGuildSettings(member.guild.id);
      if (!settings.welcomeEnabled || !settings.welcomeChannelId) return;

      const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const accountCreated = Math.floor(member.user.createdTimestamp / 1000);
      const joinedAt = Math.floor((member.joinedTimestamp || Date.now()) / 1000);
      const memberCount = member.guild.memberCount.toLocaleString();
      const color = parseInt(settings.logColor || '0x0099ff');

      const welcomeEmbed = new EmbedBuilder()
        .setColor(Number.isNaN(color) ? 0x0099ff : color)
        .setAuthor({
          name: `${member.user.tag} joined the server`,
          iconURL: member.user.displayAvatarURL({ size: 128 })
        })
        .setTitle(`Welcome to ${member.guild.name}!`)
        .setDescription(`Say hello to ${member}. We are now **${memberCount}** members strong.`)
        .setThumbnail(member.user.displayAvatarURL({ size: 256, extension: 'png' }))
        .addFields(
          { name: 'Username', value: `@${member.user.username}`, inline: true },
          { name: 'User ID', value: member.id, inline: true },
          { name: 'Account created', value: `<t:${accountCreated}:R>`, inline: true },
          { name: 'Joined', value: `<t:${joinedAt}:R>`, inline: true }
        )
        .setFooter({ text: `Member #${member.guild.memberCount}` })
        .setTimestamp();

      await channel.send({ content: `Welcome ${member}!`, embeds: [welcomeEmbed] });
    } catch (error) {
      console.error(`Failed to send welcome message in ${member.guild.name}:`, error);
    }
  }
};
