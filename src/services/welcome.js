const { EmbedBuilder } = require('discord.js');

function createWelcomeEmbed(member, colorValue = '0x0099ff') {
  const color = parseInt(colorValue);
  const safeColor = Number.isNaN(color) ? 0x0099ff : color;
  const accountCreated = Math.floor(member.user.createdTimestamp / 1000);
  const joinedAt = Math.floor((member.joinedTimestamp || Date.now()) / 1000);
  const memberCount = member.guild.memberCount.toLocaleString();
  const avatar = member.user.displayAvatarURL({ size: 256, extension: 'png' });

  return new EmbedBuilder()
    .setColor(safeColor)
    .setAuthor({ name: `${member.user.tag} joined the server`, iconURL: avatar })
    .setTitle(`Welcome to ${member.guild.name}!`)
    .setDescription(`Say hello to ${member}. We are now **${memberCount}** members strong.`)
    .setThumbnail(avatar)
    .addFields(
      { name: 'Username', value: `@${member.user.username}`, inline: true },
      { name: 'User ID', value: member.id, inline: true },
      { name: 'Account created', value: `<t:${accountCreated}:R>`, inline: true },
      { name: 'Joined', value: `<t:${joinedAt}:R>`, inline: true }
    )
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();
}

module.exports = { createWelcomeEmbed };
