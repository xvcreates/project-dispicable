const db = require('../services/database');
const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

async function showEditModal(interaction, client, channelId, messageId, appendText = '') {
  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  const message = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;
  if (!message || message.author.id !== client.user.id) {
    return interaction.reply({ content: 'That bot message could not be found or is no longer editable.', ephemeral: true });
  }

  const currentContent = message.content || '';
  const defaultValue = `${currentContent}${appendText ? `${currentContent ? ' ' : ''}${appendText}` : ''}`.slice(0, 2000);
  const modal = new ModalBuilder()
    .setCustomId(`editmessage_modal_${interaction.user.id}_${channelId}_${messageId}`)
    .setTitle('Edit Bot Message');
  const messageInput = new TextInputBuilder()
    .setCustomId('new_message')
    .setLabel('Message (role/channel mentions supported)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000)
    .setValue(defaultValue || '');
  modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
  await interaction.showModal(modal);
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === 'editmessage') {
        const channel = interaction.options.getChannel('channel');
        const dateText = interaction.options.getString('date');
        const focused = interaction.options.getFocused().toLowerCase();
        const editCommand = client.commands.get('editmessage');

        if (!channel || !dateText || !editCommand) return interaction.respond([]);

        try {
          const messages = await editCommand.getBotMessages(channel, dateText, client.user.id);
          const choices = (messages || [])
            .filter(message => message.id.includes(focused) || message.content.toLowerCase().includes(focused))
            .slice(0, 25)
            .map(message => ({
              name: `${message.content.slice(0, 80) || '[embed/empty message]'} (${message.id})`,
              value: message.id
            }));
          return interaction.respond(choices);
        } catch (error) {
          console.error('Edit message autocomplete error:', error);
          return interaction.respond([]);
        }
      }

      if (interaction.commandName !== 'test') return;

      const query = interaction.options.getString('command')?.toLowerCase() || '';
      const choices = [...client.commands.keys()]
        .filter(commandName => commandName !== 'test' && commandName.includes(query))
        .slice(0, 25)
        .map(commandName => ({ name: `/${commandName}`, value: commandName }));

      await interaction.respond(choices);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('editmessage_modal_')) {
      const [, , ownerId, channelId, messageId] = interaction.customId.split('_');
      if (interaction.user.id !== ownerId) {
        return interaction.reply({ content: 'Only the administrator who selected this message can edit it.', ephemeral: true });
      }

      const newMessage = interaction.fields.getTextInputValue('new_message');
      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      const message = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;

      if (!message || message.author.id !== client.user.id) {
        return interaction.reply({ content: 'That bot message could not be found or is no longer editable.', ephemeral: true });
      }

      try {
        await message.edit({
          content: newMessage,
          allowedMentions: { parse: ['users', 'roles', 'everyone'] }
        });
        await interaction.reply({ content: `Bot message edited successfully in ${channel}.`, ephemeral: true });
      } catch (error) {
        console.error('Edit message modal error:', error);
        await interaction.reply({ content: 'I could not edit that message. Check my permissions in the channel.', ephemeral: true });
      }
      return;
    }

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: 'Unknown command.', ephemeral: true });
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error('Command execution error:', error);
        await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
      }
    }

    // Handle buttons
    if (interaction.isButton()) {
      const customId = interaction.customId;
      const guild = interaction.guild;

      if (customId.startsWith('editmessage_open_')) {
        const [, , ownerId, channelId, messageId] = customId.split('_');
        if (interaction.user.id !== ownerId) {
          return interaction.reply({ content: 'Only the administrator who opened this editor can use it.', ephemeral: true });
        }
        await showEditModal(interaction, client, channelId, messageId);
        return;
      }

      // Notification toggles
      if (customId.startsWith('setup_notify_warn_')) {
        const enabled = customId.endsWith('_true');
        await db.updateNotifyWarn(guild.id, enabled);
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('✅ Setting Updated').setDescription(`DM on warn ${enabled ? 'enabled' : 'disabled'}`).setColor(enabled ? 0x00ff00 : 0xff0000)],
          ephemeral: true
        });
      }

      if (customId.startsWith('setup_notify_mute_')) {
        const enabled = customId.endsWith('_true');
        await db.updateNotifyMute(guild.id, enabled);
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('✅ Setting Updated').setDescription(`DM on mute ${enabled ? 'enabled' : 'disabled'}`).setColor(enabled ? 0x00ff00 : 0xff0000)],
          ephemeral: true
        });
      }

      if (customId.startsWith('setup_notify_ban_')) {
        const enabled = customId.endsWith('_true');
        await db.updateNotifyBan(guild.id, enabled);
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('✅ Setting Updated').setDescription(`DM on ban ${enabled ? 'enabled' : 'disabled'}`).setColor(enabled ? 0x00ff00 : 0xff0000)],
          ephemeral: true
        });
      }

      if (customId.startsWith('setup_ping_mods_')) {
        const enabled = customId.endsWith('_true');
        await db.updatePingMods(guild.id, enabled);
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('✅ Setting Updated').setDescription(`Ping mods on action ${enabled ? 'enabled' : 'disabled'}`).setColor(enabled ? 0x00ff00 : 0xff0000)],
          ephemeral: true
        });
      }

      // Escalation toggle
      if (customId.startsWith('setup_escalation_')) {
        const enabled = customId.endsWith('_true');
        await db.updateEscalationEnabled(guild.id, enabled);
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('✅ Setting Updated').setDescription(`Auto-escalation ${enabled ? 'enabled' : 'disabled'}`).setColor(enabled ? 0x00ff00 : 0xff0000)],
          ephemeral: true
        });
      }

      // Auto-role toggle
      if (customId.startsWith('setup_auto_role_') && !customId.includes('id')) {
        const enabled = customId.endsWith('_true');
        await db.updateAutoRoleEnabled(guild.id, enabled);
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('✅ Setting Updated').setDescription(`Auto-role on join ${enabled ? 'enabled' : 'disabled'}`).setColor(enabled ? 0x00ff00 : 0xff0000)],
          ephemeral: true
        });
      }

      // Welcome toggle
      if (customId.startsWith('setup_welcome_')) {
        const enabled = customId.endsWith('_true');
        await db.updateWelcomeEnabled(guild.id, enabled);
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('✅ Setting Updated').setDescription(`Welcome messages ${enabled ? 'enabled' : 'disabled'}`).setColor(enabled ? 0x00ff00 : 0xff0000)],
          ephemeral: true
        });
      }

      // Logging toggles
      if (customId.startsWith('setup_log_warns_')) {
        const enabled = customId.endsWith('_true');
        await db.updateLogWarnsEnabled(guild.id, enabled);
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('✅ Setting Updated').setDescription(`Log warnings ${enabled ? 'enabled' : 'disabled'}`).setColor(enabled ? 0x00ff00 : 0xff0000)],
          ephemeral: true
        });
      }

      if (customId.startsWith('setup_log_mutes_')) {
        const enabled = customId.endsWith('_true');
        await db.updateLogMutesEnabled(guild.id, enabled);
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('✅ Setting Updated').setDescription(`Log mutes ${enabled ? 'enabled' : 'disabled'}`).setColor(enabled ? 0x00ff00 : 0xff0000)],
          ephemeral: true
        });
      }

      if (customId.startsWith('setup_log_kicks_')) {
        const enabled = customId.endsWith('_true');
        await db.updateLogKicksEnabled(guild.id, enabled);
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('✅ Setting Updated').setDescription(`Log kicks ${enabled ? 'enabled' : 'disabled'}`).setColor(enabled ? 0x00ff00 : 0xff0000)],
          ephemeral: true
        });
      }

      if (customId.startsWith('setup_log_bans_')) {
        const enabled = customId.endsWith('_true');
        await db.updateLogBansEnabled(guild.id, enabled);
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('✅ Setting Updated').setDescription(`Log bans ${enabled ? 'enabled' : 'disabled'}`).setColor(enabled ? 0x00ff00 : 0xff0000)],
          ephemeral: true
        });
      }
    }

    // Handle role select menus
    if (interaction.isRoleSelectMenu()) {
      const guild = interaction.guild;

      if (interaction.customId.startsWith('editmessage_role_')) {
        const [, , ownerId, channelId, messageId] = interaction.customId.split('_');
        if (interaction.user.id !== ownerId) {
          return interaction.reply({ content: 'Only the administrator who opened this editor can use it.', ephemeral: true });
        }
        await showEditModal(interaction, client, channelId, messageId, `<@&${interaction.values[0]}>`);
        return;
      }

      if (interaction.customId.startsWith('setup_cmds_role') || interaction.customId.startsWith('settings_cmds_role')) {
        const selectedRoles = interaction.values;
        try {
          await db.updateCmdsRole(guild.id, selectedRoles);
          const roleMentions = await Promise.all(selectedRoles.map(async (roleId) => {
            const role = await guild.roles.fetch(roleId);
            return role ? role.toString() : roleId;
          }));
          const embed = new EmbedBuilder()
            .setTitle('✅ Roles Updated')
            .setDescription(`Cmds roles have been set to ${roleMentions.join(', ')}`)
            .setColor(0x00ff00);
          await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update role: ${error.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('setup_auto_role_id') || interaction.customId.startsWith('settings_auto_role_id')) {
        try {
          if (interaction.values.length === 0) {
            await db.updateAutoRoleId(guild.id, null);
            await interaction.reply({
              embeds: [new EmbedBuilder().setTitle('✅ Auto-role Cleared').setDescription('Auto-role has been removed').setColor(0x00ff00)],
              ephemeral: true
            });
          } else {
            const roleId = interaction.values[0];
            await db.updateAutoRoleId(guild.id, roleId);
            const role = await guild.roles.fetch(roleId);
            await interaction.reply({
              embeds: [new EmbedBuilder().setTitle('✅ Auto-role Set').setDescription(`Auto-role set to ${role}`).setColor(0x00ff00)],
              ephemeral: true
            });
          }
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update auto-role: ${error.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('setup_ticket_ping_roles') || interaction.customId.startsWith('settings_ticket_ping_roles')) {
        try {
          await db.updateTicketPingRoles(guild.id, interaction.values);
          const roleMentions = await Promise.all(interaction.values.map(async (roleId) => {
            const role = await guild.roles.fetch(roleId);
            return role ? role.toString() : roleId;
          }));
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('✅ Ticket Ping Roles Updated').setDescription(`Ticket ping roles: ${roleMentions.join(', ') || 'None'}`).setColor(0x00ff00)],
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update ticket ping roles: ${error.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('setup_ticket_view_roles') || interaction.customId.startsWith('settings_ticket_view_roles')) {
        try {
          await db.updateTicketViewRoles(guild.id, interaction.values);
          const roleMentions = await Promise.all(interaction.values.map(async (roleId) => {
            const role = await guild.roles.fetch(roleId);
            return role ? role.toString() : roleId;
          }));
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('✅ Ticket View Roles Updated').setDescription(`Ticket view roles: ${roleMentions.join(', ') || 'None'}`).setColor(0x00ff00)],
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update ticket view roles: ${error.message}`, ephemeral: true });
        }
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('editmessage_select_')) {
        const [, , ownerId, channelId] = interaction.customId.split('_');
        if (interaction.user.id !== ownerId) {
          return interaction.reply({ content: 'Only the administrator who opened this editor can use it.', ephemeral: true });
        }

        const messageId = interaction.values[0];
        const controls = [
          new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
              .setCustomId(`editmessage_role_${ownerId}_${channelId}_${messageId}`)
              .setPlaceholder('Select a role to insert as a ping')
              .setMinValues(1)
              .setMaxValues(1)
          ),
          new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId(`editmessage_channel_${ownerId}_${channelId}_${messageId}`)
              .setPlaceholder('Select a channel to insert as a mention')
              .addChannelTypes(ChannelType.GuildText)
              .setMinValues(1)
              .setMaxValues(1)
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`editmessage_open_${ownerId}_${channelId}_${messageId}`)
              .setLabel('Edit message')
              .setStyle(ButtonStyle.Primary)
          )
        ];
        await interaction.reply({ content: 'Choose a role or channel to insert, or open the editor directly:', components: controls, ephemeral: true });
        return;
      }

      if (interaction.customId.startsWith('setup_ticket_ping_toggle') || interaction.customId.startsWith('settings_ticket_ping_toggle')) {
        const enabled = interaction.values[0] === 'true';
        try {
          await db.updateTicketPingEnabled(interaction.guild.id, enabled);
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('✅ Ticket Ping Updated').setDescription(enabled ? 'Ticket ping is enabled.' : 'Ticket ping is disabled.').setColor(0x00ff00)],
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update ticket ping setting: ${error.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('setup_log_color') || interaction.customId.startsWith('settings_log_color')) {
        const colorHex = interaction.values[0];
        try {
          await db.updateLogColor(interaction.guild.id, colorHex);
          const colorName = {
            '0xff0000': 'Red',
            '0xffa500': 'Orange',
            '0xffff00': 'Yellow',
            '0x00ff00': 'Green',
            '0x0000ff': 'Blue',
            '0x8000ff': 'Purple',
            '0x000000': 'Black',
            '0xffffff': 'White',
            '0x808080': 'Gray',
            '0x00ffff': 'Cyan'
          };
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('✅ Log Color Updated').setDescription(`Log embeds color set to **${colorName[colorHex] || colorHex}**`).setColor(parseInt(colorHex))],
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update log color: ${error.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('setup_escalation_threshold') || interaction.customId.startsWith('settings_escalation_threshold')) {
        const threshold = parseInt(interaction.values[0]);
        try {
          await db.updateEscalationThreshold(interaction.guild.id, threshold);
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('✅ Escalation Threshold Updated').setDescription(`Auto-escalation threshold set to ${threshold} warnings`).setColor(0x00ff00)],
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update escalation threshold: ${error.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('setup_default_mute_duration') || interaction.customId.startsWith('settings_default_mute_duration')) {
        const minutes = parseInt(interaction.values[0]);
        const timeLabel = minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
        try {
          await db.updateDefaultMuteDuration(interaction.guild.id, minutes);
          await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('✅ Default Mute Duration Updated').setDescription(`Default mute duration set to ${timeLabel}`).setColor(0x00ff00)],
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update mute duration: ${error.message}`, ephemeral: true });
        }
      }
    }

    // Handle channel select menus
    if (interaction.isChannelSelectMenu()) {
      const guild = interaction.guild;
      const selectedChannel = interaction.values.length > 0 ? interaction.values[0] : null;

      if (interaction.customId.startsWith('editmessage_channel_')) {
        const [, , ownerId, channelId, messageId] = interaction.customId.split('_');
        if (interaction.user.id !== ownerId) {
          return interaction.reply({ content: 'Only the administrator who opened this editor can use it.', ephemeral: true });
        }
        await showEditModal(interaction, client, channelId, messageId, `<#${selectedChannel}>`);
        return;
      }

      if (interaction.customId.startsWith('setup_modlog_channel') || interaction.customId.startsWith('settings_modlog_channel')) {
        try {
          await db.updateModlogChannel(guild.id, selectedChannel);
          const channel = await guild.channels.fetch(selectedChannel);
          const embed = new EmbedBuilder()
            .setTitle('✅ Channel Updated')
            .setDescription(`Moderation log channel has been set to ${channel}`)
            .setColor(0x00ff00);
          await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update channel: ${error.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('setup_welcome_channel') || interaction.customId.startsWith('settings_welcome_channel')) {
        try {
          if (!selectedChannel) {
            await db.updateWelcomeChannel(guild.id, null);
            await interaction.reply({
              embeds: [new EmbedBuilder().setTitle('✅ Welcome Channel Cleared').setDescription('Welcome channel has been unset').setColor(0x00ff00)],
              ephemeral: true
            });
          } else {
            await db.updateWelcomeChannel(guild.id, selectedChannel);
            const channel = await guild.channels.fetch(selectedChannel);
            await interaction.reply({
              embeds: [new EmbedBuilder().setTitle('✅ Welcome Channel Set').setDescription(`Welcome messages are now enabled in ${channel}`).setColor(0x00ff00)],
              ephemeral: true
            });
          }
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update welcome channel: ${error.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('setup_audit_log_channel') || interaction.customId.startsWith('settings_audit_log_channel')) {
        try {
          if (!selectedChannel) {
            await db.updateAuditLogChannel(guild.id, null);
            await interaction.reply({
              embeds: [new EmbedBuilder().setTitle('✅ Audit Log Channel Cleared').setDescription('Audit log channel has been unset').setColor(0x00ff00)],
              ephemeral: true
            });
          } else {
            await db.updateAuditLogChannel(guild.id, selectedChannel);
            const channel = await guild.channels.fetch(selectedChannel);
            await interaction.reply({
              embeds: [new EmbedBuilder().setTitle('✅ Audit Log Channel Set').setDescription(`Audit log channel set to ${channel}`).setColor(0x00ff00)],
              ephemeral: true
            });
          }
        } catch (error) {
          await interaction.reply({ content: `❌ Failed to update audit log channel: ${error.message}`, ephemeral: true });
        }
      }
    }
  }
};
