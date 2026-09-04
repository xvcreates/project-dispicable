const { EmbedBuilder } = require('discord.js');
const db = require('./database');
const autoModCooldown = new Map();

function cooldownKey(guildId, userId, reason) {
  return `${guildId}:${userId}:${reason}`;
}

async function triggerAutoMod(message, reason) {
  const key = cooldownKey(message.guild.id, message.author.id, reason);
  const now = Date.now();
  const last = autoModCooldown.get(key) || 0;
  if (now - last < 60000) {
    return;
  }

  autoModCooldown.set(key, now);

  try {
    await message.delete();
  } catch (error) {
    console.error('AutoMod failed to delete message:', error);
  }

  await db.addWarning(message.guild.id, message.author.id, reason, 'auto-mod');

  try {
    await message.author.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('Auto-moderation notice')
          .setDescription(`Your message was removed because: ${reason}`)
          .setColor(0xff9900)
      ]
    });
  } catch (error) {
    // Ignore DM failures
  }
}

async function applyRaidMode(guild, enabled) {
  const settings = await db.getGuildSettings(guild.id);
  const commandRoleIds = settings.cmdsRoleIds || [];
  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  const textChannels = guild.channels.cache.filter(channel => channel.isTextBased() && channel.permissionOverwrites);

  for (const [, channel] of textChannels) {
    try {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: enabled ? false : null
      });

      if (enabled && botMember) {
        await channel.permissionOverwrites.edit(botMember, { SendMessages: true });
        for (const roleId of commandRoleIds) {
          const role = guild.roles.cache.get(roleId);
          if (role) await channel.permissionOverwrites.edit(role, { SendMessages: true });
        }
      }
    } catch (error) {
      console.error(`Could not update raid mode permissions for ${channel.name}:`, error);
    }
  }

  await db.setRaidMode(guild.id, enabled);
}

module.exports = { triggerAutoMod, applyRaidMode };
