# Soccer League Manager — Project Log

## Overview
A full-stack soccer league management system with web dashboard and Discord bot integration, built for the Soccer League Discord server.

**Stack:** Node.js, Express, SQLite (better-sqlite3), discord.js v14, EJS templates
**Hosted on:** DashDaddy VM (10.0.10.11:3000)
**Public URL:** https://michaelbpyle.com/soccer-league/
**Discord Bot:** Meola#5752
**Repository:** `I:\Projects\Data\.future\soccer-league\` (source of truth)
**Server path:** `/opt/soccer-league/` (on DashDaddy)

---

## Build Log

### 2026-02-17 ~2:00 AM — Project Created (OpenClaw VM)
- Scaffolded from the `soccer-league` schedule generator HTML file in Nextcloud
- Original was a static HTML round-robin schedule generator built with ChatGPT (July 2025)
- Expanded into a full league management system on moneypenny VM (10.0.10.12)

### 2:07 AM — Discord Bot Setup
- Michael created the Discord bot application ("Meola") and invited it to the Soccer League server
- Bot token stored in `.env` (gitignored)
- Confirmed bot access to server with full admin permissions

### 2:09 AM — Server Structure Discovered
- **Guild ID:** 1391648870278369350
- **3 Divisions** with category channels and team channels already set up
- **18 team channels** across 3 divisions
- Roles: Referees, Player, Goalkeeper, Captains, Skill levels, Gender

### 2:13 AM — v1 Built
- Express web server with 6 pages (Dashboard, Schedule, Standings, Teams, Results, Admin)
- Discord bot with 6 slash commands
- SQLite database with seasons, divisions, teams, games tables

### 2:25 AM — Production Deployment (OpenClaw)
- Systemd service created on moneypenny VM
- All 18 real teams seeded across 3 divisions with correct Discord channel IDs

### 2:28 AM — Full Season Simulation v1
- Simulated double round-robin season with results posted to Discord

### 3:07 AM — Major Update: 7-Team Divisions + Playoffs + Colors
- **7 teams per division** (21 total) — added FC Tchoupitoulas, Krewe de Goal, Bayou Brawlers
- **BYE weeks** for odd team count
- **Team colors** with hex codes and color names
- **Post-season playoffs** — top 4 per division qualify

### 3:14 AM — Colors Added to Website
- Color dot indicators across all pages

### 2026-02-18 — Migration to DashDaddy VM (Claude Code, Session 1)
- Rebuilt entire application from documentation on DashDaddy VM (10.0.10.11)
- Installed Node.js v22.22.0 on DashDaddy
- Deployed to `/opt/soccer-league/` with systemd service
- Discord bot Meola reconnected and slash commands re-registered
- Auto-created `#schedule` and `#standings` channels in Discord
- Added Caddy reverse proxy route: `michaelbpyle.com/soccer-league/` → `dashdaddy:3000`
- Added to michaelbpyle.com Data Projects nav dropdown and card page
- Added navigation links in app header (Data Projects, MBP.COM)
- Restarted Caddy + Cloudflare Tunnel containers on TrueNAS

---

## Architecture

### Web App (port 3000)
| Page | Description |
|------|-------------|
| Dashboard | Season overview, stats, upcoming games, recent results, division standings |
| Schedule | Full season schedule with division filter, playoff games marked |
| Standings | Division-by-division standings with playoff qualifying indicator |
| Teams | Team management with color swatches, add/remove teams |
| Results | Score entry form, recent results with color indicators |
| Admin | Season management, schedule regeneration, blackout dates |

### Discord Bot (Meola)
| Command | Description |
|---------|-------------|
| `/standings [division]` | Current league standings |
| `/schedule` | Upcoming games (next 2 weeks) |
| `/results` | Recent match results |
| `/teams` | All teams by division |
| `/nextgame <team>` | A specific team's next match |
| `/score <home> <goals> <away> <goals>` | Record a result (admin only) |

**Auto-posting:**
- Weekly schedule to `#schedule` channel (Mondays 9 AM)
- Standings updates to `#standings` channel
- Match results to `#league-chat` when scores are entered

### Database (SQLite)
- **seasons** — name, start date, game day, active flag
- **divisions** — name, Discord category/chat channel IDs
- **teams** — name, short name, color (hex + name), division, Discord channel ID
- **games** — round, date, home/away teams, score, played flag, playoff flag/round
- **blackout_dates** — dates to skip in scheduling
- **discord_channels** — bot channel ID storage

### Division Structure

**Sunday Coed Division 1**
| Team | Color | Short |
|------|-------|-------|
| Gooners | Red | GOO |
| Whistle Pigs | White | WHP |
| Uptowners | Royal Blue | UPT |
| YBNG | Gold | YBN |
| Petty Bandits | Black | PTB |
| Monstars | Green | MON |
| FC Tchoupitoulas | Orange | FCT |

**Sunday Coed Division 2**
| Team | Color | Short |
|------|-------|-------|
| Ponchartrain FC | Navy | PFC |
| Back That Pass Up | Hot Pink | BTP |
| Ballcelona | Maroon | BAL |
| Dura Mater | Purple | DRM |
| After Hours FC | Scarlet | AHF |
| West Bridge FC | Teal | WBF |
| Krewe de Goal | Yellow | KDG |

**Sunday Coed Division 3**
| Team | Color | Short |
|------|-------|-------|
| Transplants | Forest Green | TRP |
| Banana Republic | Banana Yellow | BNR |
| Couch Potatoes | Brown | CPC |
| Sloppy Seconds | Pink | SLS |
| NOLA United | Deep Purple | NOU |
| Satsuma's Revenge | Satsuma Orange | SAT |
| Bayou Brawlers | Sky Blue | BBR |

---

## Infrastructure

### Deployment
- **Server:** DashDaddy VM (10.0.10.11), Ubuntu 24.04
- **App path:** `/opt/soccer-league/`
- **Service:** `soccer-league.service` (systemd, Restart=always)
- **Database:** `/opt/soccer-league/data/league.db` (SQLite)
- **Public access:** `https://michaelbpyle.com/soccer-league/`

### Routing
- TrueNAS Caddy container proxies `/soccer-league/*` → `dashdaddy:3000`
- Caddy config: `W:\site\docker\Caddyfile`
- docker-compose already has `dashdaddy` in `extra_hosts`

### Deployment Commands
```bash
# Check status
ssh dashdaddy "sudo systemctl status soccer-league"

# View logs
ssh dashdaddy "sudo journalctl -u soccer-league -f"

# Restart
ssh dashdaddy "sudo systemctl restart soccer-league"

# Database reset (fresh season)
ssh dashdaddy "sudo systemctl stop soccer-league && rm -rf /opt/soccer-league/data/ && sudo systemctl start soccer-league"
```

### Updating Files
```bash
# Copy updated files from local
scp index.js database.js bot.js dashdaddy:/opt/soccer-league/
scp views/*.ejs dashdaddy:/opt/soccer-league/views/
ssh dashdaddy "sudo systemctl restart soccer-league"
```

---

## Schedule Format
- **Regular season:** Double round-robin (14 rounds for 7 teams)
- **Each week:** 3 games + 1 BYE per division
- **Playoffs:** Top 4 qualify → Semifinals (Week 15) → Final (Week 16)
- **Game day:** Configurable (default: Saturday)
- **Blackout dates:** Skip specified weeks (holidays, weather)
- **Total games:** 132 per season (42 per division regular + 6 playoff)

---

## Files
```
soccer-league/
├── .env                    # Bot token, port, DB path (gitignored)
├── .gitignore
├── package.json
├── index.js                # Express server + bot launcher
├── database.js             # SQLite schema, seeding, queries
├── bot.js                  # Discord bot + slash commands
├── simulate.js             # Full season simulation script
├── register-commands.js    # Standalone command registration
├── cleanup.js              # Discord message cleanup utility
├── setup-discord.js        # One-time channel setup script
├── deploy.sh               # Deployment script for DashDaddy
├── soccer-league.service   # Systemd service file
├── index.html              # Original static schedule generator
├── public/favicon.png      # Site favicon (PiL.png)
├── data/league.db          # SQLite database (gitignored)
├── data/snapshots/         # Auto-backups before destructive ops (gitignored)
└── views/
    ├── header.ejs
    ├── footer.ejs
    ├── dashboard.ejs
    ├── schedule.ejs
    ├── standings.ejs
    ├── teams.ejs
    ├── results.ejs
    └── admin.ejs
```

### 2026-02-20 — Discord Enhancements & Safeguards (Claude Code, Session 2)
- Fixed BASE_PATH routing for reverse proxy (all nav links, form actions, redirects)
- Added new-member onboarding: Meola greets joiners with interactive role selection
  - Gender (Male/Female), Experience (5 levels), Position (GK/DEF/MID/FW), Team (all 21)
  - Team selection posts welcome in that team's channel
- Created Discord roles for all onboarding options + all 21 teams
- Fixed duplicate #schedule and #standings channels (deleted relics from OpenClaw)
- Posted pinned welcome message in #league-chat
- Posted full schedule + standings in each division chat
- Populated global #schedule and #standings channels
- Added database snapshot system: auto-backup before season creation or schedule regeneration
  - Snapshots saved to `data/snapshots/` as timestamped `.db` files
- Added favicon (PiL.png)
- Added cleanup.js and setup-discord.js utility scripts

---

## TODO
- [ ] **Pierluigi referee bot** — Second Discord bot ("Pierluigi") for the referee channel. Responsible for referee assignment to games, score workflow, and referee management. Needs: create bot application in Discord Developer Portal, get token, write bot code, deploy alongside Meola.
- [ ] Create Discord channels for new teams (FC Tchoupitoulas, Krewe de Goal, Bayou Brawlers)
- [ ] Player registration / roster management
- [ ] Game times and field locations
- [ ] Email/notification system for schedule distribution
- [ ] Print-friendly schedule export (PDF)
- [ ] Season history / archive
- [ ] Mobile app or PWA
- [ ] Sub request integration (connect to #sub-avails / #sub-needs channels)

---

*Originally built by Moneypenny (OpenClaw) — Feb 17, 2026*
*Migrated to DashDaddy by Claude Code — Feb 18, 2026*
*Enhanced by Claude Code — Feb 20, 2026*
