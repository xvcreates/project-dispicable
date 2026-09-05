const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { getConfig, updateConfig } = require('../services/discordConfig');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autodelete')
    .setDescription('Delete user messages in a selected channel; bot messages are kept.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(option => option
      .setName('channel')
      .setDescription('Channel where user messages should be deleted')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) {
      return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    const botMember = interaction.guild.members.me;
    if (!botMember || !channel.permissionsFor(botMember).has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: `I need Manage Messages permission in ${channel}.`, ephemeral: true });
    }

    const config = await getConfig(interaction.guild);
    await updateConfig(interaction.guild, {
      autodeleteChannelIds: [...new Set([...(config.autodeleteChannelIds || []), channel.id])]
    });
    await interaction.reply({ content: `Auto-delete enabled in ${channel}. Bot messages will not be deleted.`, ephemeral: true });
  }
};