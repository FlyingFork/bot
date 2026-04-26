# Discord Translation Bot

A Discord bot that bridges multi-language channels within a server. Messages sent in any enrolled channel are automatically translated and forwarded to every other channel in the same translation group, with the original user's name and avatar preserved via Discord webhooks.

**Translation backend:** A self-hosted [LibreTranslate](https://libretranslate.com/) instance. Supported languages: English, Russian, German.

---

## Prerequisites

- Node.js ≥ 18
- A PostgreSQL database
- A self-hosted LibreTranslate instance
- A Discord application with a bot token

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

### 3. Apply the database schema

```bash
npx prisma db push
# or, if you prefer migration files:
npx prisma migrate dev --name init
```

### 4. Register slash commands with Discord

```bash
npm run deploy
```

Commands are registered per guild. Set `GUILD_IDS` (comma-separated) or `GUILD_ID` in `.env`.

### 5. Start the bot

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `CLIENT_ID` | Yes | Application (client) ID |
| `GUILD_ID` | Yes* | Server ID for command registration |
| `GUILD_IDS` | No | Comma-separated list of server IDs (overrides `GUILD_ID`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `LIBRETRANSLATE_URL` | Yes* | Full base URL, e.g. `http://192.168.1.10:5000` |
| `LIBRETRANSLATE_BASE_URL` | Yes* | Alias for `LIBRETRANSLATE_URL` (either works) |
| `LIBRETRANSLATE_IP` + `LIBRETRANSLATE_PORT` | Yes* | Alternative to `LIBRETRANSLATE_URL` |
| `LIBRETRANSLATE_PROTOCOL` | No | `http` or `https` (default: `http`) |
| `LIBRETRANSLATE_API_KEY` | No | API key if your instance requires one |
| `LIBRETRANSLATE_TIMEOUT_MS` | No | Request timeout in ms (default: 10000) |

\* One URL configuration method is required.

---

## Bot Permissions Required

The bot needs the following Discord permissions in every channel used for translation:

- **Read Messages / View Channels**
- **Send Messages**
- **Manage Webhooks** — for creating and managing translation webhooks
- **Manage Messages** — for deleting wrong-language messages and replacing them with corrected versions

The bot also requires these **Privileged Gateway Intents** (enable in Discord Developer Portal):
- **Message Content Intent**
- **Server Members Intent**

---

## Configuring Translation Groups

All management commands require the `R4` or `R5` role.

### Create a group

```
/tg create name:my-group
```

### Add channels to the group

```
/tg addchannel group:my-group channel:#english-chat language:English
/tg addchannel group:my-group channel:#russian-chat language:Russian
/tg addchannel group:my-group channel:#german-chat language:German
```

### List all groups

```
/tg list
```

### Remove a channel

```
/tg removechannel group:my-group channel:#german-chat
```

Groups with fewer than 2 channels are automatically dissolved.

### Delete a group

```
/tg delete group:my-group
```

---

## Other Commands

| Command | Roles | Description |
|---|---|---|
| `/ping` | R4, R5 | WebSocket latency + LibreTranslate health |
| `/stats` | R4, R5 | Translation counts, active channels, uptime, LibreTranslate status |
| `/set_status` | R5 | Configure rotating bot presence with language translation |
| `/reset_status` | R5 | Clear bot presence |

---

## How Translation Works

1. A user sends a message in an enrolled channel.
2. The bot detects if the message is in the wrong language for that channel. If so, it deletes the original and posts corrected versions (in each channel's language) via webhook.
3. For correctly-languaged messages, the bot translates the content to each sibling channel's language and forwards it via webhook, impersonating the original user.
4. Discord mentions, custom emoji, URLs, code blocks, inline code, and timestamps are extracted before translation and restored afterward — they are never sent to LibreTranslate.
5. Emoji-only or symbol-only messages are forwarded without translation.
6. Edited messages update their webhook copies; deleted messages remove their webhook copies.

---

## Known Limitations

- **Message sync does not persist across restarts.** The edit/delete sync mapping is stored in memory. If the bot restarts, previously forwarded messages cannot be updated or deleted.
- **Attachment re-upload is not supported.** Attachments are referenced by their Discord CDN URL. Files over 8 MB are linked as plain URLs instead.
- **Thread support is best-effort.** The bot attempts to find or create matching threads by name in sibling channels. If thread creation fails, the message is sent to the parent channel.
- **Stickers cannot be forwarded natively.** Sticker image URLs are embedded in the message content.
- **LibreTranslate must support all three languages** (en, ru, de). Use `/ping` to verify.
