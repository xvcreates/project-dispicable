const { ChannelType, PermissionFlagsBits } = require('discord.js');

const CONFIG_CHANNEL_NAME = 'mustard-config';
const CONFIG_PREFIX = 'MUSTARD_CONFIG:';

async function getConfigChannel(guild, create = false) {
  let channel = guild.channels.cache.find(candidate => candidate.name === CONFIG_CHANNEL_NAME && candidate.type === ChannelType.GuildText);
  if (!channel) channel = await guild.channels.fetch().then(channels => channels.find(candidate => candidate.name === CONFIG_CHANNEL_NAME && candidate.type === ChannelType.GuildText)).catch(() => null);
  if (channel || !create) return channel;

  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!botMember) throw new Error('The bot member could not be resolved.');

  return guild.channels.create({
    name: CONFIG_CHANNEL_NAME,
    type: ChannelType.GuildText,
    topic: `${CONFIG_PREFIX}{}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] }
    ],
    reason: 'Store MUSTARD server settings persistently in Discord'
  });
}

function readConfig(channel) {
  if (!channel?.topic?.startsWith(CONFIG_PREFIX)) return {};
  try {
    return JSON.parse(channel.topic.slice(CONFIG_PREFIX.length));
  } catch (error) {
    return {};
  }
}

async function getConfig(guild) {
  return readConfig(await getConfigChannel(guild));
}

async function updateConfig(guild, changes) {
  const channel = await getConfigChannel(guild, true);
  const config = { ...readConfig(channel), ...changes };
  await channel.setTopic(`${CONFIG_PREFIX}${JSON.stringify(config)}`);
  return config;
}

module.exports = { getConfig, updateConfig };
