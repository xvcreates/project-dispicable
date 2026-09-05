const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../services/database');
const { getConfig, updateConfig } = require('../services/discordConfig');
const { memberHasCmds } = require('../utils/permissionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cancelautodelete')
    .setDescription('Stop auto-deleting user messages in a selected channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(option => option
      .setName('channel')
      .setDescription('Channel where auto-delete should be disabled')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    if (!(await memberHasCmds(interaction.member))) {
      return interaction.reply({ content: 'You need the cmds role to use this command.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    const config = await getConfig(interaction.guild);
    await updateConfig(interaction.guild, {
      autodeleteChannelIds: (config.autodeleteChannelIds || []).filter(channelId => channelId !== channel.id)
    });
    await interaction.reply({ content: `Auto-delete disabled in ${channel}.`, ephemeral: true });
  }
};