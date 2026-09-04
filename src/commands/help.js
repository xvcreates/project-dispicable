const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display all available commands.'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🔧 Racing Nation Bot - Commands')
      .setDescription('Available commands for the Racing Nation community.')
      .setColor(0xff6600)
      .addFields(
        {
          name: '🛡️ MODERATION (cmds role required)',
          value: '`/kick` - Remove user\n`/ban` - Ban user\n`/unban` - Unban user\n`/tempban` - Temporary ban\n`/mute` - Timeout user\n`/unmute` - Remove timeout\n`/warn` - Warn user\n`/warnings` - Check warnings\n`/clearwarnings` - Clear all warnings\n`/softban` - Softban user\n`/purge` - Delete messages\n`/nick` - Change nickname\n`/roleadd` - Add role\n`/roleremove` - Remove role\n`/roletransfer` - Transfer role to members\n`/bulkroleremove` - Remove role from all\n`/removerole` - Remove role from user/everyone\n`/lock` - Lock channel\n`/unlock` - Unlock channel\n`/slowmode` - Set slowmode\n`/announce` - Send announcement\n`/logs` - View moderation logs\n`/infractions` - View user infractions\n`/raidmode` - Toggle raid mode\n`/disableping` - Block pings to selected roles\n`/autodelete` - Delete user messages in a selected channel\n`/cancelautodelete` - Stop channel auto-delete',
          inline: false
        },
        {
          name: '⚙️ ADMIN & CONFIGURATION',
          value: '`/setup` - Configure roles, channels, welcome messages, and log colors\n`/settings` - View server configuration\n`/test` - Send a safe command or welcome-message test\n`/editmessage` - Select and edit a bot message by date',
          inline: false
        },
        {
          name: '🔧 UTILITY',
          value: '`/ping` - Check bot latency\n`/uptime` - Bot uptime\n`/botinfo` - Bot information\n`/serverinfo` - Server information\n`/userinfo` - User information\n`/roles` - List all roles\n`/avatar` - Show user avatar\n`/channelinfo` - Channel information\n`/invite` - Create invite\n`/randommember` - Pick random member\n`/countroles` - Role member count\n`/say` - Make bot speak\n`/serverbanner` - Server banner\n`/help` - This command',
          inline: false
        }
      )
      .setFooter({ text: 'For more info, use Discord\'s built-in help: type / and see command descriptions' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
