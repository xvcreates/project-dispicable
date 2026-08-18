const { PermissionFlagsBits } = require('discord.js');
const db = require('../services/database');

function getCmdsRole(guild) {
  return guild.roles.cache.find(role => role.name.toLowerCase() === 'cmds');
}

async function memberHasCmds(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions?.has(PermissionFlagsBits.ModerateMembers)) return true;

  const settings = await db.getGuildSettings(member.guild.id);
  const configuredRoleIds = settings.cmdsRoleIds || (settings.cmdsRoleId ? [settings.cmdsRoleId] : []);

  if (configuredRoleIds.length > 0) {
    return configuredRoleIds.some(roleId => member.roles.cache.has(roleId));
  }

  const cmdsRole = getCmdsRole(member.guild);
  return cmdsRole ? member.roles.cache.has(cmdsRole.id) : false;
}

module.exports = {
  getCmdsRole,
  memberHasCmds
};
