const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const DISCORD_EPOCH = 1420070400000n;

function dateRange(dateText) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText);
  if (!match) return null;

  const [, day, month, year] = match;
  const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  if (Number.isNaN(start.getTime()) || start.getUTCDate() !== Number(day) || start.getUTCMonth() !== Number(month) - 1) return null;

  const toSnowflake = date => String((BigInt(date.getTime()) - DISCORD_EPOCH) << 22n);
  return { after: toSnowflake(start), before: toSnowflake(end) };
}

async function getBotMessages(channel, dateText, clientUserId) {
  const range = dateRange(dateText);
  if (!range) return null;

  const messages = await channel.messages.fetch({
    after: range.after,
    before: range.before,
    limit: 100
  });

  return messages
    .filter(message => message.author.id === clientUserId)
    .sort((first, second) => first.createdTimestamp - second.createdTimestamp);
}

module.exports = {
  dateRange,
  getBotMessages,
  data: new SlashCommandBuilder()
    .setName('editmessage')
    .setDescription('Edit one of the bot messages sent on a date.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel containing the bot message')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(option =>
      option
        .setName('date')
        .setDescription('Date in UTC, for example 03/09/2026')
        .setRequired(true)
    )
    ,

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Only administrators can edit bot messages.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    const dateText = interaction.options.getString('date');
    const messages = await getBotMessages(channel, dateText, interaction.client.user.id);

    if (!messages) {
      return interaction.reply({ content: 'Use a valid UTC date in DD/MM/YYYY format.', ephemeral: true });
    }

    if (!messages.size) {
      return interaction.reply({ content: `I could not find any messages sent by the bot in ${channel} on ${dateText}.`, ephemeral: true });
    }

    const messageOptions = [...messages.values()].slice(0, 25).map(message => ({
      label: (message.content || '[embed/empty message]').slice(0, 100),
      description: `${new Date(message.createdTimestamp).toISOString().slice(11, 19)} UTC`,
      value: message.id
    }));
    const messageSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`editmessage_select_${interaction.user.id}_${channel.id}`)
        .setPlaceholder('Select the bot message to edit')
        .addOptions(messageOptions)
    );

    await interaction.reply({
      content: `Bot messages found in ${channel} on **${dateText}**. Select one to edit it:`,
      components: [messageSelect],
      ephemeral: true
    });
  }
};
