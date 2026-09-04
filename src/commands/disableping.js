const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../services/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disableping')
    .setDescription('Choose roles whose members cannot be directly pinged.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option => option.setName('role').setDescription('Add one role that cannot be pinged').setRequired(false))
    .addBooleanOption(option => option.setName('clear').setDescription('Clear all disabled-ping roles').setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Only administrators can configure disabled-ping roles.', ephemeral: true });
    }

    const selectedRole = interaction.options.getRole('role');
    const clear = interaction.options.getBoolean('clear') || false;
    if (selectedRole || clear) {
      const currentRoles = (await db.getGuildSettings(interaction.guild.id)).disabledPingRoleIds || [];
      const updatedRoles = clear
        ? []
        : [...new Set([...currentRoles, selectedRole.id])];
      await db.updateDisabledPingRoles(interaction.guild.id, updatedRoles);
      return interaction.reply({
        content: clear
          ? 'Disabled-ping roles cleared.'
          : `Added ${selectedRole} to the disabled-ping roles.`,
        ephemeral: true
      });
    }

    const settings = await db.getGuildSettings(interaction.guild.id);
    const roles = settings.disabledPingRoleIds || [];
    const description = roles.length
      ? `Members with these roles cannot be directly pinged:\n${roles.map(roleId => `<@&${roleId}>`).join(', ')}`
      : 'No disabled-ping roles are configured.';

    const roleOptions = interaction.guild.roles.cache
      .filter(role => role.id !== interaction.guild.id && !role.managed)
      .sort((first, second) => second.position - first.position)
      .first(25)
      .map(role => ({
        label: role.name.slice(0, 100),
        value: role.id,
        description: `Block pings for members with ${role.name}`.slice(0, 100)
      }));

    if (!roleOptions.length) {
      return interaction.reply({ content: 'This server has no selectable roles. Create a normal role first.', ephemeral: true });
    }

    const roleSelector = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('disableping_roles')
        .setPlaceholder('Select roles that cannot be pinged')
        .addOptions(roleOptions)
        .setMinValues(1)
        .setMaxValues(Math.min(roleOptions.length, 10))
    );
    const clearRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('disableping_clear')
        .setLabel('Clear')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle('🔕 Disabled Ping Roles').setDescription(description).setColor(0xff9900)],
      components: [roleSelector, clearRow],
      ephemeral: true
    });
  }
};