const { EmbedBuilder } = require('discord.js');
const db = require('../services/database');
const { triggerAutoMod } = require('../services/automod');
const { memberHasCmds, getCmdsRole } = require('../utils/permissionUtils');
const { takePendingEdit } = require('../services/messageEditor');
const { getConfig } = require('../services/discordConfig');

const spamHistory = new Map();
const protectedRoleNames = ['community director', 'owner', 'developer'];
const bannedContent = [/nig/i, /fagg/i, /sand/i, /porn/i, /xxx/i, /nud/i, /horny/i];

function isProtectedMention(message) {
  if (!message.mentions.roles.size) return false;
  return message.mentions.roles.some(role => protectedRoleNames.includes(role.name.toLowerCase()));
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const pendingEdit = takePendingEdit(message.author.id, message.channel.id);
    if (pendingEdit) {
      try {
        const target = await message.channel.messages.fetch(pendingEdit.messageId).catch(() => null);
        if (!target || target.author.id !== message.client.user.id) {
          await message.reply('That bot message could not be found or is no longer editable.');
          return;
        }

        await target.edit({
          content: message.content,
          allowedMentions: { parse: ['users', 'roles', 'everyone'] }
        });
        await message.delete().catch(() => null);
      } catch (error) {
        console.error('Normal-composer message edit failed:', error);
        await message.reply('I could not edit that bot message. Check my permissions in this channel.');
      }
      return;
    }

    const member = message.member;
    const guildSettings = await db.getGuildSettings(message.guild.id);
    const discordConfig = await getConfig(message.guild);
    const isStaff = await memberHasCmds(member);

    if ((discordConfig.autodeleteChannelIds || []).includes(message.channel.id)) {
      try {
        if (!message.deletable) {
          console.error(`[deletefuture] Message ${message.id} is not deletable in #${message.channel.name}. Check Manage Messages permission.`);
          return;
        }
        await message.delete();
      } catch (error) {
        console.error(`[deletefuture] Failed to delete message ${message.id} in #${message.channel.name}:`, error);
      }
      return;
    }

    if (guildSettings.raidMode && !isStaff) {
      try {
        await message.delete();
        await message.author.send(`Messages are temporarily disabled in **${message.guild.name}** because raid mode is active.`).catch(() => null);
      } catch (error) {
        console.error('Failed to enforce raid mode:', error);
      }
      return;
    }

    const disabledPingRoleIds = (discordConfig.disabledPingRoleIds || []).map(String);
    if (disabledPingRoleIds.length && message.mentions.users.size) {
      const mentionedMembers = await Promise.all(
        [...message.mentions.users.values()].map(async user => {
          const resolvedMember = message.mentions.members?.get(user.id);
          return resolvedMember || message.guild.members.cache.get(user.id) || message.guild.members.fetch(user.id).catch(() => null);
        })
      );
      const targetsDisabledPing = mentionedMembers.some(member =>
        member?.roles?.cache && disabledPingRoleIds.some(roleId => member.roles.cache.has(roleId))
      );
      if (targetsDisabledPing) {
        console.log(`[disableping] Blocked a ping to a member with a disabled-ping role in ${message.guild.name}`);
        const strikeCount = await db.addDisabledPingStrike(message.guild.id, message.author.id);
        try {
          await message.delete();
          await message.author.send(
            `Your message in **${message.guild.name}** was removed because it attempted to ping a role or member with disabled pings. Strike ${strikeCount}/3.`
          ).catch(() => null);
        } catch (error) {
          console.error('Failed to delete disabled ping:', error);
        }
        if (strikeCount >= 3) {
          const reason = `Automatic warning after ${strikeCount} disabled-ping violations`;
          try {
            await db.addWarning(message.guild.id, message.author.id, reason, 'disabled-ping');
            await db.logAction({
              guildId: message.guild.id,
              action: 'warn',
              targetId: message.author.id,
              targetTag: message.author.tag,
              reason,
              metadata: { disabledPingStrikeCount: strikeCount }
            });
            await message.author.send(
              `You have received a warning in **${message.guild.name}** for reaching ${strikeCount} disabled-ping violations.`
            ).catch(() => null);
            console.log(`[disableping] Warned ${message.author.tag} after ${strikeCount} violations in ${message.guild.name}`);
          } catch (error) {
            console.error('[disableping] Failed to record automatic warning:', error);
          } finally {
            await db.resetDisabledPingStrikes(message.guild.id, message.author.id).catch(error => {
              console.error('[disableping] Failed to reset strike count:', error);
            });
          }
        }
        return;
      }
    }

    if (message.channel.name === 'verify') {
      if (message.author.id !== message.client.user.id) {
        try {
          await message.delete();
        } catch (error) {
          console.error('Failed to delete verify message:', error);
        }
      }
      return;
    }

    if (message.channel.name === 'general' && message.author.id === '365975655037009931') {
      try {
        await message.delete();
      } catch (error) {
        console.error('Failed to delete Bloxlink message:', error);
      }
      return;
    }

    if (message.channel.name === 'partners' && !message.author.bot) {
      try {
        await message.delete();
      } catch (error) {
        console.error('Failed to delete partners message:', error);
      }
      return;
    }

    if (!isStaff && isProtectedMention(message)) {
      await triggerAutoMod(message, 'Protected role mention');
      return;
    }

    if (!guildSettings.automodEnabled || isStaff) return;

    const content = message.content || '';
    const now = Date.now();
    const key = `${message.guild.id}:${message.author.id}`;
    const history = (spamHistory.get(key) || []).filter(timestamp => now - timestamp < guildSettings.spamWindowMs);
    history.push(now);
    spamHistory.set(key, history);

    if (history.length >= guildSettings.spamThreshold) {
      await triggerAutoMod(message, 'Spamming repeated messages');
      return;
    }

    if (guildSettings.blockInvites && /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)/i.test(content)) {
      await triggerAutoMod(message, 'Invite link detected');
      return;
    }

    if (message.mentions.users.size >= guildSettings.maxMentions) {
      await triggerAutoMod(message, 'Mention spam');
      return;
    }

    if (bannedContent.some(regex => regex.test(content))) {
      await triggerAutoMod(message, 'Prohibited content detected');
    }
  }
};
