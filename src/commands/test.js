const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../services/database');
const { createWelcomeEmbed } = require('../services/welcome');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('Send a safe test message for a bot command.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('Command to test, or welcome for the join message')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Text channel where the test message should be sent')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Only administrators can use this command.', ephemeral: true });
    }

    const commandName = interaction.options.getString('command').toLowerCase().replace(/^\//, '');
    const channel = interaction.options.getChannel('channel');
    const command = interaction.client.commands.get(commandName);

    if (!command && commandName !== 'welcome') {
      return interaction.reply({ content: `I could not find a registered command named "/${commandName}".`, ephemeral: true });
    }

    try {
      if (commandName === 'welcome') {
        const settings = await db.getGuildSettings(interaction.guild.id);
        const testMember = {
          id: interaction.user.id,
          guild: interaction.guild,
          user: interaction.user,
          joinedTimestamp: Date.now(),
          toString: () => `${interaction.user}`
        };
        await channel.send({ content: `Welcome ${interaction.user}!`, embeds: [createWelcomeEmbed(testMember, settings.logColor)] });
        return interaction.reply({ content: `Welcome test sent to ${channel}.`, ephemeral: true });
      }

      const testEmbed = new EmbedBuilder()
        .setTitle('Bot Test')
        .setDescription(`The **/${commandName}** command is registered and ready to respond.`)
        .addFields(
          { name: 'Tested by', value: `${interaction.user}`, inline: true },
          { name: 'Target channel', value: `${channel}`, inline: true },
          { name: 'Safety', value: 'This test did not execute the command or affect any members.', inline: false }
        )
        .setColor(0x00b894)
        .setTimestamp()
        .setFooter({ text: `Command test • ${interaction.guild.name}` });

      await channel.send({ embeds: [testEmbed] });
      await interaction.reply({
        content: `Test message for **/${commandName}** sent to ${channel}.`,
        ephemeral: true
      });
    } catch (error) {
      console.error(`Test command failed for /${commandName}:`, error);
      await interaction.reply({
        content: `I could not send the test message to ${channel}. Check that I can view and send messages there.`,
        ephemeral: true
      });
    }
  }
};
