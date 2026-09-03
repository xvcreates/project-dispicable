const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

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
    .addStringOption(option =>
      option
        .setName('message_id')
        .setDescription('Choose a bot message found on that date')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('new_message')
        .setDescription('The replacement message text')
        .setRequired(true)
        .setMaxLength(2000)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Only administrators can edit bot messages.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    const dateText = interaction.options.getString('date');
    const messageId = interaction.options.getString('message_id');
    const newMessage = interaction.options.getString('new_message');
    const messages = await getBotMessages(channel, dateText, interaction.client.user.id);

    if (!messages) {
      return interaction.reply({ content: 'Use a valid UTC date in YYYY-MM-DD format.', ephemeral: true });
    }

    const message = messages.get(messageId);
    if (!message) {
      return interaction.reply({ content: 'That bot message was not found on the selected date. Reopen autocomplete and choose a message from the list.', ephemeral: true });
    }

    try {
      await message.edit(newMessage);
      await interaction.reply({ content: `Edited the bot message in ${channel}.`, ephemeral: true });
    } catch (error) {
      console.error('Edit message error:', error);
      await interaction.reply({ content: 'I could not edit that message. Check that I have permission to manage my messages in the channel.', ephemeral: true });
    }
  }
};
