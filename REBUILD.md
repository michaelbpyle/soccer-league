# Soccer League App + Meola Discord Bot — Full Rebuild Guide

**Owner:** Michael B Pyle (michael@michaelbpyle.com)
**Last updated:** 2026-02-18
**Deployed on:** DashDaddy VM (10.0.10.11) at `/opt/soccer-league/`
**Public URL:** https://michaelbpyle.com/soccer-league/

This document contains everything needed to rebuild the soccer league web app and its Discord bot "Meola" from scratch on a new machine. No prior context required.

---

## Overview

- **Web app:** Node.js + Express + SQLite + EJS — league management dashboard at port 3000
- **Discord bot:** "Meola" — slash commands for standings, schedule, results, etc.
- **Database:** SQLite via `better-sqlite3`, stored at `./data/league.db`
- **Season:** Spring 2026, 3 divisions × 7 teams = 21 teams, double round-robin + playoffs

---

## 1. Prerequisites

- Node.js v18+ (v22 preferred)
- npm
- Linux with systemd (for the service)
- A Discord bot token (see Section 3)

---

## 2. Discord Server Info

| Item | Value |
|------|-------|
| **Server (Guild) ID** | `1391648870278369350` |
| **Server name** | Soccer League |
| **Bot name** | Meola |
| **League chat channel ID** | `1391648870915637260` |

### Division Discord Structure

| Division | Category ID | Chat Channel ID |
|----------|------------|-----------------|
| Sunday Coed Division 1 | `1391650739197182143` | `1391651423766450209` |
| Sunday Coed Division 2 | `1391651774011674716` | `1391653124326035506` |
| Sunday Coed Division 3 | `1391654814915498016` | `1391654937032659044` |

### Team Channel IDs

**Division 1:**
| Team | Short | Channel ID |
|------|-------|------------|
| Gooners | GOO | `1391656689312464976` |
| Whistle Pigs | WHP | `1391656727316791317` |
| Uptowners | UPT | `1391656759151824956` |
| YBNG | YBN | `1391656787060457533` |
| Petty Bandits | PTB | `1391656821021741079` |
| Monstars | MON | `1391656845692764250` |
| FC Tchoupitoulas | FCT | _(none yet)_ |

**Division 2:**
| Team | Short | Channel ID |
|------|-------|------------|
| Ponchartrain FC | PFC | `1391656299690987600` |
| Back That Pass Up | BTP | `1391656344548933784` |
| Ballcelona | BAL | `1391656386374664204` |
| Dura Mater | DRM | `1391656438887219222` |
| After Hours FC | AHF | `1391656504523882566` |
| West Bridge FC | WBF | `1391656555698585611` |
| Krewe de Goal | KDG | _(none yet)_ |

**Division 3:**
| Team | Short | Channel ID |
|------|-------|------------|
| Transplants | TRP | `1391655069006696448` |
| Banana Republic | BNR | `1391655133682602045` |
| Couch Potatoes | CPC | `1391655180688429076` |
| Sloppy Seconds | SLS | `1391655210627104849` |
| NOLA United | NOU | `1391655250510741624` |
| Satsuma's Revenge | SAT | `1391655300846583919` |
| Bayou Brawlers | BBR | _(none yet)_ |

---

## 3. Discord Bot Setup

### If reusing the existing bot:

The bot token is:
```
<DISCORD_BOT_TOKEN - see .env on DashDaddy at /opt/soccer-league/.env>
```

**⚠️ If this token has been rotated, you'll need a new one from the Discord Developer Portal.**

### If creating a new bot:

1. Go to https://discord.com/developers/applications
2. Create a new application (name it "Meola")
3. Go to **Bot** tab → click **Reset Token** → copy the token
4. Enable these **Privileged Gateway Intents**: (none currently required — bot only uses `Guilds` intent)
5. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Manage Channels`, `Embed Links`, `Read Message History`, `Use Slash Commands`
6. Use the generated URL to invite the bot to the Soccer League server

---

## 4. Project Structure

```
soccer-league/
├── .env                  # Environment variables (token, port, db path)
├── package.json          # Dependencies
├── index.js              # Express web server + app startup
├── database.js           # SQLite schema, seed data, all queries
├── bot.js                # Discord bot (slash commands, channel posting)
├── register-commands.js  # Standalone command registration script
├── simulate.js           # Season simulation script (for testing)
├── data/
│   └── league.db         # SQLite database (auto-created on first run)
└── views/
    ├── header.ejs        # Layout header + all CSS
    ├── footer.ejs        # Layout footer
    ├── dashboard.ejs     # Main dashboard
    ├── schedule.ejs      # Schedule view (filterable by division)
    ├── standings.ejs     # Standings view
    ├── teams.ejs         # Team management
    ├── results.ejs       # Score entry + recent results
    └── admin.ejs         # Admin panel (seasons, blackouts, regenerate)
```

No `public/` assets — all CSS is inline in `header.ejs`.

---

## 5. Build Steps

### 5.1. Create the project directory
```bash
mkdir -p soccer-league && cd soccer-league
```

### 5.2. Create `.env`
```bash
cat > .env << 'EOF'
DISCORD_BOT_TOKEN=<DISCORD_BOT_TOKEN - see .env on DashDaddy at /opt/soccer-league/.env>
PORT=3000
DATABASE_PATH=./data/league.db
EOF
```

### 5.3. Create `package.json`
```json
{
  "name": "soccer-league",
  "version": "1.0.0",
  "description": "Soccer League Management System",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "register": "node register-commands.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "discord.js": "^14.16.0",
    "dotenv": "^16.4.0",
    "ejs": "^3.1.10",
    "express": "^4.21.0"
  }
}
```

### 5.4. Install dependencies
```bash
npm install
```

### 5.5. Create all source files

Create each file from the **Source Code** section below.

### 5.6. Create views directory and templates
```bash
mkdir -p views
```
Create each `.ejs` file from the **View Templates** section below.

### 5.7. Start the app
```bash
node index.js
```

On first run, this will:
- Create the SQLite database at `./data/league.db`
- Seed 3 divisions, 21 teams, and generate a full double round-robin schedule
- Start the web server on port 3000
- Connect the Discord bot and register slash commands
- Create `#schedule` and `#standings` channels in the Discord server (if they don't exist)

---

## 6. Systemd Service

To run as a service that survives reboots:

```bash
sudo tee /etc/systemd/system/soccer-league.service << 'EOF'
[Unit]
Description=Soccer League Management System
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/path/to/soccer-league
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable soccer-league
sudo systemctl start soccer-league
```

Replace `YOUR_USERNAME` and `/path/to/soccer-league` with actual values.

---

## 7. Discord Bot Slash Commands

| Command | Description | Options |
|---------|-------------|---------|
| `/standings` | Show current league standings | `division` (optional) |
| `/schedule` | Show upcoming games | — |
| `/results` | Show recent results | — |
| `/teams` | List all teams by division | — |
| `/nextgame` | Show a team's next game | `team` (required) |
| `/score` | Record a match result (admin only) | `home_team`, `home_goals`, `away_team`, `away_goals` |

Commands are registered automatically when the bot starts. To register manually: `npm run register`

---

## 8. Web App Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/` | GET | Dashboard (stats, upcoming, results, standings) |
| `/schedule` | GET | Full schedule (filterable by division via `?div=ID`) |
| `/standings` | GET | Standings by division |
| `/teams` | GET | Team list |
| `/teams/add` | POST | Add a team |
| `/teams/delete/:id` | POST | Remove a team |
| `/results` | GET | Results + score entry |
| `/results/record` | POST | Record a score |
| `/admin` | GET | Admin panel |
| `/admin/season` | POST | Create new season |
| `/admin/regenerate` | POST | Regenerate all schedules |
| `/admin/blackout` | POST | Add blackout date |
| `/admin/blackout/delete/:id` | POST | Remove blackout date |
| `/api/standings` | GET | JSON API for standings |

---

## 9. Key Design Notes

- **7 teams per division** = odd number, so the schedule uses a BYE system (one team sits out each round)
- **Double round-robin** = each team plays every other team twice (home + away)
- **Playoffs:** Top 4 per division qualify. Semifinals (#1 vs #4, #2 vs #3) then final.
- **Weekly auto-posts:** Monday at 9 AM, the bot posts schedule + standings to `#schedule` and `#standings`
- **Score recording** from Discord requires `ManageGuild` permission
- **Team colors** are hardcoded in `database.js` (`TEAM_COLORS` object) and displayed as colored dots in the web UI and emoji circles in Discord

---

## 10. Source Code

All source files are included below. Create them exactly as shown.

### `database.js`

_(This is the largest file — contains schema, seed data with all team/division/channel IDs, schedule generation, playoff creation, and all query functions.)_

Key constants embedded in this file:
- Division names, Discord category IDs, and chat channel IDs
- Team names, short names, colors, and Discord channel IDs
- Season defaults (Spring 2026, starting March 7, Saturdays)

### `bot.js`

Key constants:
- `GUILD_ID = '1391648870278369350'`
- `LEAGUE_CHAT_ID = '1391648870915637260'`

### `simulate.js`

Key constants:
- `DIV_CHANNELS = { 1: '1391651423766450209', 2: '1391653124326035506', 3: '1391654937032659044' }`
- `LEAGUE_CHAT_ID = '1391648870915637260'`

---

## 11. Troubleshooting

- **Bot not responding to slash commands:** Run `npm run register` to re-register commands
- **"No active season":** The database seed didn't run — delete `data/league.db` and restart
- **Bot can't create channels:** Check bot has `Manage Channels` permission in the server
- **`better-sqlite3` build errors:** You may need `build-essential` and `python3`: `sudo apt install build-essential python3`

---

## 12. Migration Checklist

- [ ] Copy or recreate all source files
- [ ] Set the bot token in `.env` (rotate if needed)
- [ ] `npm install`
- [ ] Test with `node index.js`
- [ ] Verify web UI at `http://localhost:3000`
- [ ] Verify bot connects and slash commands work in Discord
- [ ] Set up systemd service
- [ ] If migrating existing data, copy `data/league.db` from the old machine
