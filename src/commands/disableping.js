const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
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
        .setMaxValues(10),
      new ButtonBuilder()
        .setCustomId('disableping_clear')
        .setLabel('Clear')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle('🔕 Disabled Ping Roles').setDescription(description).setColor(0xff9900)],
      components: [roleSelector],
      ephemeral: true
    });
  }
};