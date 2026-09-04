const { REST, Routes, ActivityType } = require('discord.js');
const path = require('path');
const fs = require('fs');
const db = require('../services/database');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    console.log('Guild member join events enabled: GuildMembers intent requested.');
    client.user.setActivity('Eating Mustard 24/7', {
      type: ActivityType.Playing,
      start: new Date()
    });

    await db.initialize();
    console.log('Database initialized');

    const commands = [];
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if (command.data) commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
      console.log(`Refreshing ${commands.length} application commands globally...`);
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
      console.log('Successfully registered commands globally.');
    } catch (error) {
      console.error('Failed to register commands:', error);
    }
  }
};
