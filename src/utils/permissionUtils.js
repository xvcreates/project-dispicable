const { PermissionFlagsBits } = require('discord.js');
const db = require('../services/database');

function getCmdsRole(guild) {
  return guild.roles.cache.find(role => role.name.toLowerCase() === 'cmds');
}

async function memberHasCmds(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions?.has(PermissionFlagsBits.ModerateMembers)) return true;

  // Check database for configured cmds role
  const settings = await db.getGuildSettings(member.guild.id);
  if (settings.cmdsRoleId) {
    return member.roles.cache.has(settings.cmdsRoleId);
  }

  // Fallback to checking for 'cmds' role name
  const cmdsRole = getCmdsRole(member.guild);
  return cmdsRole ? member.roles.cache.has(cmdsRole.id) : false;
}

module.exports = {
  getCmdsRole,
  memberHasCmds
};
