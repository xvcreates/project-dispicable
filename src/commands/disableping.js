const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, RoleSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../services/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disableping')
    .setDescription('Choose roles whose members cannot be directly pinged.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Only administrators can configure disabled-ping roles.', ephemeral: true });
    }

    const settings = await db.getGuildSettings(interaction.guild.id);
    const roles = settings.disabledPingRoleIds || [];
    const description = roles.length
      ? `Members with these roles cannot be directly pinged:\n${roles.map(roleId => `<@&${roleId}>`).join(', ')}`
      : 'No disabled-ping roles are configured.';

    const roleSelector = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('disableping_roles')
        .setPlaceholder('Select roles that cannot be pinged')
        .setMinValues(0)
        .setMaxValues(10)
    );

    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle('🔕 Disabled Ping Roles').setDescription(description).setColor(0xff9900)],
      components: [roleSelector],
      ephemeral: true
    });
  }
};