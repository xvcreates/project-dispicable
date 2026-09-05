# MUSTARD Bot

MUSTARD is the new modular Discord bot for your community, built for advanced moderation, ticketing, and community utilities.

## What’s included

- **Persistent moderation** with warnings stored in SQLite
- **Auto-moderation** for spam, invite links, mention abuse, and prohibited content
- **Raid mode** with global channel lockdown support
- **Role-based protection** for high-value role mentions
- **Legacy compatibility**: old `bot.js` still works as `npm run legacy`
- **Modular command/event structure** for easy expansion

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with:
   ```env
   DISCORD_TOKEN=your_bot_token
   GUILD_ID=your_guild_id
   CLIENT_ID=your_bot_client_id
   ```

3. Start the new modular bot:
   ```bash
   npm start
   ```

4. To run the original legacy bot instead:
   ```bash
   npm run legacy
   ```

## Command categories

### Moderation
- `/warn` — warn a user and store the warning
- `/warnings` — view a user’s warnings
- `/clearwarnings` — clear all warnings for a user
- `/raidmode` — toggle raid mode on/off
- `/kick`, `/ban`, `/mute`, `/unmute`, `/purge`, `/nick`
- `/roleadd`, `/roleremove`, `/lock`, `/unlock`, `/slowmode`, `/announce`

### Utility
- `/ping` — check bot latency
- `/uptime` — see bot runtime
- `/botinfo` — bot details
- `/serverinfo` — server summary
- `/userinfo` — info for a user
- `/roles` — role list
- `/avatar` — show a user avatar
- `/channelinfo` — channel details
- `/invite` — create a temporary invite
- `/randommember` — select a random member
- `/countroles` — count members per role
- `/say` — relay a message through the bot
- `/serverbanner` — show the server banner

## Files and structure

- `bot.js` — legacy bot entrypoint
- `src/index.js` — new modular bot entrypoint
- `src/commands/` — slash command implementations
- `src/events/` — event handlers
- `src/services/` — database, automod, and moderation services
- `src/utils/` — shared helper utilities

## Notes

- Create a role called `cmds` for staff command access
- Create a `bot-use` or `mod-logs` channel for moderation logs
- The new build uses SQLite and creates `src/data/bot.sqlite`
- On Render, set `DATABASE_PATH` to a file on a mounted persistent disk, such as `/var/data/mustard.sqlite`, or settings will be lost when the service restarts
- The old bot remains available in case you need it
