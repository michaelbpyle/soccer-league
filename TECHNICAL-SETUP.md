# Soccer League Manager — Technical Setup Manual

> **Audience:** Claude (or any AI agent) tasked with recreating or extending this system.  
> **Purpose:** Step-by-step reproduction guide with every decision explained.

---

## Prerequisites

- **Node.js** v18+ (tested on v22.22.0)
- **npm** (comes with Node)
- **Linux server** with systemd (tested on Ubuntu 24.04)
- **Discord bot token** (see Discord Setup below)
- **~50MB disk** for the app + dependencies

---

## 1. Discord Bot Setup

### Create the bot application:
1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it (we used "Meola")
3. Go to **Bot** tab → **Reset Token** → copy the token
4. Enable all **Privileged Gateway Intents**:
   - Presence Intent ✅
   - Server Members Intent ✅
   - Message Content Intent ✅
5. Go to **OAuth2** → **URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Administrator`
   - Copy the generated URL → open it → select the target server → Authorize

### Key Discord IDs you need:
```
Guild (Server) ID — right-click server name → Copy Server ID
Channel IDs — right-click channels → Copy Channel ID
Category IDs — right-click category → Copy Category ID
```

You need IDs for:
- The guild itself
- Each division's category channel
- Each division's chat channel (for posting results/standings)
- Each team's private channel (optional, for team-specific posts)
- A general league-chat channel

---

## 2. Project Scaffolding

```bash
mkdir soccer-league && cd soccer-league
npm init -y
npm install express ejs better-sqlite3 discord.js dotenv
mkdir -p views data
```

### `.env`
```
DISCORD_BOT_TOKEN=<your-bot-token>
PORT=3000
DATABASE_PATH=./data/league.db
```

### `.gitignore`
```
.env
node_modules/
data/
```

---

## 3. Database Schema (SQLite via better-sqlite3)

### Why better-sqlite3 over sqlite3:
- Synchronous API — no callback hell, no async/await needed for DB calls
- Faster for single-process apps
- Simpler transaction handling
- `db.prepare().run()` / `.get()` / `.all()` — clean and predictable

### Tables:

```sql
CREATE TABLE seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,               -- "Spring 2026"
  start_date TEXT NOT NULL,         -- "2026-03-07" ISO format
  game_day TEXT DEFAULT 'Saturday', -- day of week for games
  active INTEGER DEFAULT 1,        -- only one active season at a time
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE divisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  name TEXT NOT NULL,                    -- "Sunday Coed Division 1"
  discord_category_id TEXT,              -- Discord category channel ID
  discord_chat_channel_id TEXT,          -- Discord text channel for posting
  FOREIGN KEY (season_id) REFERENCES seasons(id)
);

CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,              -- "Gooners"
  short_name TEXT,                 -- "GOO" (3-letter abbreviation)
  color_hex TEXT DEFAULT '#888888',-- "#FF0000" — shirt color
  color_name TEXT DEFAULT 'Gray',  -- "Red" — human-readable color
  season_id INTEGER,
  division_id INTEGER,
  discord_channel_id TEXT,         -- team's private Discord channel
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (season_id) REFERENCES seasons(id),
  FOREIGN KEY (division_id) REFERENCES divisions(id)
);

CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  division_id INTEGER,
  round INTEGER NOT NULL,           -- 1-14 for regular season, 100=semifinal, 101=final
  match_day TEXT NOT NULL,           -- "2026-03-07" ISO date
  home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL,
  home_score INTEGER,               -- NULL until played
  away_score INTEGER,
  played INTEGER DEFAULT 0,
  is_playoff INTEGER DEFAULT 0,     -- 0=regular season, 1=playoff
  playoff_round TEXT,               -- NULL, 'semifinal', or 'final'
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (season_id) REFERENCES seasons(id),
  FOREIGN KEY (division_id) REFERENCES divisions(id),
  FOREIGN KEY (home_team_id) REFERENCES teams(id),
  FOREIGN KEY (away_team_id) REFERENCES teams(id)
);

CREATE TABLE blackout_dates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  date TEXT NOT NULL,      -- "2026-04-05" — skip this week
  reason TEXT,             -- "Easter"
  FOREIGN KEY (season_id) REFERENCES seasons(id)
);

CREATE TABLE discord_channels (
  key TEXT PRIMARY KEY,       -- "schedule", "standings"
  channel_id TEXT NOT NULL    -- Discord channel ID
);
```

### Key design decisions:
- **Standings are computed, not stored.** A single SQL query with CASE/WHEN calculates W/D/L/GF/GA/GD/Pts from the games table. This means standings are always accurate and never stale.
- **Playoffs use the same games table** with `is_playoff=1` and `playoff_round` to distinguish them. Regular season standings queries filter with `AND g.is_playoff = 0`.
- **Colors are per-team, stored in the teams table.** The TEAM_COLORS constant in database.js provides defaults at seed time.
- **Division-based scheduling.** Each division generates its own round-robin independently. This means divisions can have different team counts if needed.

---

## 4. Round-Robin Schedule Algorithm

This is the core algorithm. It handles any number of teams, automatically adds a BYE for odd counts.

```javascript
function generateSchedule(seasonId, divisionId) {
  const teams = getTeamsForDivision(seasonId, divisionId);
  
  // Add BYE placeholder for odd team counts
  if (teams.length % 2 !== 0) teams.push({ id: null, name: 'BYE' });
  const n = teams.length;
  const rounds = [];

  // Classic round-robin rotation: fix first team, rotate the rest
  const rotating = [...teams];
  for (let round = 0; round < n - 1; round++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const home = rotating[i];
      const away = rotating[n - 1 - i];
      // Skip BYE games (where id is null)
      if (home.id && away.id) {
        matches.push({ home: home.id, away: away.id });
      }
    }
    rounds.push(matches);
    // Rotate: keep first fixed, cycle the rest
    const last = rotating.pop();
    rotating.splice(1, 0, last);
  }

  // Double round-robin: duplicate all rounds with home/away swapped
  const allRounds = [...rounds];
  for (const r of rounds) {
    allRounds.push(r.map(m => ({ home: m.away, away: m.home })));
  }

  // For 7 teams: 7 rounds single × 2 = 14 rounds double round-robin
  // Each round: 3 games + 1 team on BYE
  // Total: 42 games per division
}
```

### Date assignment:
- Start from season's `start_date`
- Advance 7 days per round
- Skip any dates in `blackout_dates` table

### Math for 7 teams:
- 7 teams → padded to 8 with BYE
- 7 rounds single round-robin × 2 = 14 rounds
- 3 games per round (1 team has BYE each round)
- 42 total regular season games per division
- 126 games across 3 divisions
- +2 playoff rounds (semifinals + final) per division = +6 games
- **132 total games per season**

---

## 5. Playoffs System

### Qualification:
Top 4 teams by points (3 for win, 1 for draw) after regular season. Tiebreaker: goal difference.

### Bracket:
```
Semifinal 1: #1 seed vs #4 seed (higher seed is home)
Semifinal 2: #2 seed vs #3 seed (higher seed is home)
Final:        Winner SF1 vs Winner SF2
```

### Implementation:
1. After all regular season games are played, call `createPlayoffGames(seasonId, divisionId, lastRegularDate)`
2. This creates 3 games: 2 semifinals + 1 final (with placeholder teams)
3. After semifinals are played, update the final game's `home_team_id` and `away_team_id` with the winners
4. Playoff games use `round=100` for semis, `round=101` for final, `is_playoff=1`

### No draws in playoffs:
In simulation, re-roll scores until one team wins. In production, you'd handle extra time/penalties via the UI.

---

## 6. Team Colors

### Requirements:
- Every team in a division must have a **distinct** color
- Colors must be immediately recognizable (these are shirt colors)
- Show prominently in both web UI and Discord

### Web implementation:
```css
.color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
  border: 1px solid rgba(255, 255, 255, 0.3); /* visibility on dark bg */
}
```
```html
<span class="color-dot" style="background: #FF0000"></span> Gooners
```

### Discord implementation:
Map hex codes to the closest emoji circle:
```javascript
const colorEmoji = {
  '#FF0000': '🔴', '#FFFFFF': '⚪', '#0066CC': '🔵',
  '#FFD700': '🟡', '#000000': '⚫', '#00CC66': '🟢', ...
};
```

### Color palette used:
Choose colors that are distinct even for colorblind users. Avoid similar shades in the same division. Each team stores both `color_hex` (for rendering) and `color_name` (for text display like "Red", "Navy", "Hot Pink").

---

## 7. Web App (Express + EJS)

### Template structure:
```
views/
├── header.ejs    — DOCTYPE, <head>, CSS, navbar, opens <div class="container">
├── footer.ejs    — closes </div>, </body>, </html>
├── dashboard.ejs — season stats, upcoming games, results, standings by division
├── schedule.ejs  — full schedule with division filter tabs
├── standings.ejs — standings by division with playoff qualification markers
├── teams.ejs     — team management with color swatches
├── results.ejs   — score entry form + recent results
└── admin.ejs     — season creation, schedule regeneration, blackout dates
```

### Template pattern:
Every page template starts with `<%- include('header') %>` and ends with `<%- include('footer') %>`. **Do not use a layout wrapper pattern** — EJS doesn't pass variables through `include()` cleanly. The header/footer partial approach is simpler and reliable.

### Routes pattern:
```javascript
app.get('/standings', (req, res) => {
  const season = db.getActiveSeason();
  const divisions = season ? db.getDivisions(season.id) : [];
  const standingsByDiv = {};
  if (season) for (const div of divisions) 
    standingsByDiv[div.id] = db.getStandings(season.id, div.id);
  res.render('standings', { divisions, standingsByDiv });
});
```

### Standings query (the complex one):
The standings are computed entirely in SQL. Key technique: use conditional COUNT/SUM with CASE WHEN to calculate wins, draws, losses, goals from the games table in a single query. Filter out playoff games with `AND g.is_playoff = 0`. Sort by points DESC then goal difference DESC.

### Design:
- Dark theme: background `#0f0f1a`, cards `#1a1a2e`, borders `#2a2a4a`
- Purple gradient accent: `#667eea` → `#764ba2`
- Division badges: Div 1 = green, Div 2 = orange/gold, Div 3 = red
- Mobile responsive via flexbox/grid and media queries

---

## 8. Discord Bot (discord.js v14)

### Setup:
```javascript
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
```
Only needs `Guilds` intent since we use slash commands, not message content.

### Slash commands registration:
Commands are registered globally via `REST.put(Routes.applicationCommands(clientId), ...)` on bot ready. Global commands can take up to 1 hour to propagate. For instant testing, use guild-specific commands instead:
```javascript
Routes.applicationGuildCommands(clientId, guildId)
```

### Key commands:
- `/standings` — builds an ASCII table in a code block for monospace alignment
- `/score` — requires ManageGuild permission (admin check)
- `/nextgame` — fuzzy match team name with SQL LIKE

### Auto-posting:
- On startup: posts schedule + standings to their respective channels
- On score entry (via web): calls `bot.postResult(game)` which posts to `#league-chat`
- Weekly: `setInterval` checks for Monday 9 AM to post weekly updates

### Channel management:
Bot creates `#schedule` and `#standings` channels if they don't exist, stores their IDs in the `discord_channels` table.

### Embed colors:
- Regular results: `0x667eea` (purple)
- Win result: `0x2ecc71` (green)
- Loss result: `0xe74c3c` (red)
- Draw result: `0xf39c12` (gold)
- Playoff/champion: `0xffd700` (gold)

---

## 9. Simulation Script

`simulate.js` runs a full season for testing:

1. Connects to Discord as the bot
2. Clears old bot messages from all channels
3. Resets all game results in the database
4. Loops through each round:
   - Generates random realistic soccer scores (weighted: 0-2 goals common, 4-5 rare)
   - Records scores in database
   - Posts results + updated standings to each division's chat channel
   - Posts round summary to league-chat
   - 1.5-2 second delays between posts (Discord rate limiting)
5. After regular season:
   - Creates playoff brackets (top 4 per division)
   - Simulates semifinals (no draws allowed)
   - Updates final matchups with semifinal winners
   - Simulates finals
   - Posts playoff results and crowns champions

### Running:
```bash
cd soccer-league
node simulate.js
```

### Rate limiting:
Discord rate limits are ~5 messages/5 seconds per channel. The simulation adds `setTimeout` pauses of 1500-2000ms between channel posts to stay safe.

---

## 10. Deployment

### Systemd service:
```ini
# /etc/systemd/system/soccer-league.service
[Unit]
Description=Soccer League Management System
After=network.target

[Service]
Type=simple
User=mbp03c
WorkingDirectory=/home/mbp03c/.openclaw/workspace/soccer-league
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Commands:
```bash
sudo cp soccer-league.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable soccer-league
sudo systemctl start soccer-league
sudo systemctl status soccer-league
```

### Database reset (fresh season):
```bash
sudo systemctl stop soccer-league
rm -rf data/
sudo systemctl start soccer-league
# Database auto-seeds on first run
```

### Logs:
```bash
sudo journalctl -u soccer-league -f
```

---

## 11. Common Modifications

### Adding a new team:
1. Add to the seed data in `database.js` (or via web UI at `/teams`)
2. Add color entry to `TEAM_COLORS` constant
3. Create Discord channel for the team (optional)
4. Regenerate schedule via `/admin` → Regenerate All Schedules

### Changing divisions from 7 to N teams:
No code changes needed. The round-robin algorithm handles any count:
- Even teams: `N-1` rounds single, `2(N-1)` rounds double
- Odd teams: adds BYE automatically, `N` rounds single, `2N` rounds double

### Adding a new season:
Via web UI at `/admin` → New Season. Old season is deactivated. Teams need to be re-added or a migration script written.

### Changing playoff format:
Modify `createPlayoffGames()` in `database.js`. Current: top 4 → semis → final. Could expand to top 6, add third-place match, etc.

---

## 12. Gotchas & Lessons Learned

1. **EJS layout pattern:** Do NOT use `<%- include('layout', { body: ... })%>` with template literals. Variables don't pass through. Use simple `header.ejs` / `footer.ejs` partials instead.

2. **better-sqlite3 is synchronous.** This means the Express request handler blocks during DB queries. For a small league app this is fine. For thousands of concurrent users, you'd need async sqlite3 or PostgreSQL.

3. **Discord slash commands take up to 1 hour to propagate globally.** Use guild-specific registration during development for instant updates.

4. **Discord rate limits.** When posting to multiple channels in sequence (like during simulation), add 1.5+ second delays between posts. `bulkDelete` has a 14-day message age limit.

5. **Playoff final team IDs.** The final game is created with placeholder team IDs (seeds #1 and #2) and must be UPDATE'd after semifinals are played. Don't forget this step.

6. **Date handling.** Always use `'T12:00:00'` when creating Date objects from ISO date strings to avoid timezone issues shifting the date by a day.

7. **SQLite WAL mode.** `db.pragma('journal_mode = WAL')` is essential for concurrent read/write (web server reading while bot might be writing).

---

*Manual written by Moneypenny — Feb 17, 2026*
*For questions, ask the agent or read the source at `/home/mbp03c/.openclaw/workspace/soccer-league/`*
