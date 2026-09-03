const { EmbedBuilder } = require('discord.js');
const db = require('./database');

async function getBotUseChannel(guild) {
  const settings = await db.getGuildSettings(guild.id);
  if (settings.modlogChannelId) {
    try {
      return guild.channels.cache.get(settings.modlogChannelId) || await guild.channels.fetch(settings.modlogChannelId).catch(() => null);
    } catch (error) {
      // fall through to name-based fallback
    }
  }

  return guild.channels.cache.find(ch => ['bot-use', 'mod-logs', 'moderation', 'logs'].includes(ch.name.toLowerCase()) && ch.isTextBased()) || null;
}

async function sendModerationDM(user, title, reason) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0xff0000)
    .addFields({ name: 'Reason', value: reason || 'No reason provided' });

  try {
    await user.send({ embeds: [embed] });
  } catch (error) {
    // ignore DM failures
  }
}

async function logModerationAction(guild, action, logService, details) {
  const botUseChannel = await getBotUseChannel(guild);
  const settings = await db.getGuildSettings(guild.id);
  await logService.logAction({
    guildId: guild.id,
    action,
    targetId: details.targetId,
    targetTag: details.targetTag,
    executorId: details.executorId,
    executorTag: details.executorTag,
    reason: details.reason,
    metadata: details.metadata || {}
  });

  if (!botUseChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('Moderation Action')
    .setDescription(details.description)
    .setColor(Number.isNaN(parseInt(settings.logColor || '0x0099ff')) ? 0x0099ff : parseInt(settings.logColor || '0x0099ff'))
    .setTimestamp();

  await botUseChannel.send({ embeds: [embed] }).catch(() => null);
}

async function logCommandUse(guild, commandName, executor, logService) {
  const channel = await getBotUseChannel(guild);
  if (!channel) return;

  const settings = await db.getGuildSettings(guild.id);
  const color = parseInt(settings.logColor || '0x0099ff');
  const embed = new EmbedBuilder()
    .setTitle('Command Used')
    .setDescription(`${executor} used **/${commandName}**.`)
    .setColor(Number.isNaN(color) ? 0x0099ff : color)
    .setTimestamp();

  await logService.logAction({
    guildId: guild.id,
    action: `command:${commandName}`,
    executorId: executor.id,
    executorTag: executor.tag,
    reason: 'Command used'
  });
  await channel.send({ embeds: [embed] }).catch(() => null);
}

async function checkAndEscalateWarnings(guild, targetId, warningCount, logService, executor) {
  // Simple escalation policy: 3 -> mute, 5 -> kick, 7 -> ban
  try {
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) return;

    if (warningCount >= 7) {
      await member.ban({ days: 1, reason: 'Reached warning threshold for ban' }).catch(() => null);
      await logService.logAction({ guildId: guild.id, action: 'ban', targetId, targetTag: member.user.tag, executorId: executor?.id, executorTag: executor?.tag, reason: 'Auto-escalation: ban', metadata: { warningCount } });
      return;
    }

    if (warningCount >= 5) {
      await member.kick('Auto-escalation: reached kick threshold').catch(() => null);
      await logService.logAction({ guildId: guild.id, action: 'kick', targetId, targetTag: member.user.tag, executorId: executor?.id, executorTag: executor?.tag, reason: 'Auto-escalation: kick', metadata: { warningCount } });
      return;
    }

    if (warningCount >= 3) {
      // Apply Muted role
      let muteRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
      if (!muteRole) {
        try {
          muteRole = await guild.roles.create({ name: 'Muted', reason: 'Create muted role for auto-moderation', permissions: [] });
        } catch (e) {
          // ignore role creation failures in constrained environments
        }
      }
      if (muteRole) {
        await member.roles.add(muteRole).catch(() => null);
        await logService.logAction({ guildId: guild.id, action: 'mute', targetId, targetTag: member.user.tag, executorId: executor?.id, executorTag: executor?.tag, reason: 'Auto-escalation: mute', metadata: { warningCount } });
      }
    }
  } catch (error) {
    console.error('Escalation failed:', error);
  }
}

module.exports = {
  getBotUseChannel,
  sendModerationDM,
  logModerationAction
  , checkAndEscalateWarnings,
  logCommandUse
};

