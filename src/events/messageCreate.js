const { EmbedBuilder } = require('discord.js');
const db = require('../services/database');
const { triggerAutoMod } = require('../services/automod');
const { memberHasCmds, getCmdsRole } = require('../utils/permissionUtils');
const { takePendingEdit } = require('../services/messageEditor');

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
    const isStaff = await memberHasCmds(member);

    if (await db.isDeleteFutureEnabled(message.guild.id, message.channel.id)) {
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

    const disabledPingRoleIds = guildSettings.disabledPingRoleIds || [];
    if (disabledPingRoleIds.length && message.mentions.users.size) {
      const mentionedMembers = await Promise.all(
        [...message.mentions.users.values()].map(user => message.guild.members.fetch(user.id).catch(() => null))
      );
      const targetsDisabledPing = mentionedMembers.some(member =>
        member && disabledPingRoleIds.some(roleId => member.roles.cache.has(roleId))
      );
      if (targetsDisabledPing) {
        try {
          await message.delete();
        } catch (error) {
          console.error('Failed to delete disabled ping:', error);
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

    if (guildSettings.raidMode && !isStaff) {
      await triggerAutoMod(message, 'Raid mode active');
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
