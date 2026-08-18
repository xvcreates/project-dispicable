require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const db = require('./src/services/database');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('? Missing DISCORD_TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Load commands from src/commands directory
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log('Loading ' + commandFiles.length + ' commands...');
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log('  ? Loaded command: ' + command.data.name);
  }
}

// Load events from src/events directory
const eventsPath = path.join(__dirname, 'src', 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

console.log('Loading ' + eventFiles.length + ' events...');
for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.name) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    console.log('  ? Loaded event: ' + event.name);
  }
}

client.login(TOKEN).catch(error => {
  console.error('? Failed to log in:', error);
  process.exit(1);
});
