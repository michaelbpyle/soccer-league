const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || './data/league.db';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────
function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      game_day TEXT DEFAULT 'Saturday',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS divisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      discord_category_id TEXT,
      discord_chat_channel_id TEXT,
      FOREIGN KEY (season_id) REFERENCES seasons(id)
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      short_name TEXT,
      color_hex TEXT DEFAULT '#888888',
      color_name TEXT DEFAULT 'Gray',
      season_id INTEGER,
      division_id INTEGER,
      discord_channel_id TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (season_id) REFERENCES seasons(id),
      FOREIGN KEY (division_id) REFERENCES divisions(id)
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL,
      division_id INTEGER,
      round INTEGER NOT NULL,
      match_day TEXT NOT NULL,
      home_team_id INTEGER NOT NULL,
      away_team_id INTEGER NOT NULL,
      home_score INTEGER,
      away_score INTEGER,
      played INTEGER DEFAULT 0,
      is_playoff INTEGER DEFAULT 0,
      playoff_round TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (season_id) REFERENCES seasons(id),
      FOREIGN KEY (division_id) REFERENCES divisions(id),
      FOREIGN KEY (home_team_id) REFERENCES teams(id),
      FOREIGN KEY (away_team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS blackout_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      reason TEXT,
      FOREIGN KEY (season_id) REFERENCES seasons(id)
    );

    CREATE TABLE IF NOT EXISTS discord_channels (
      key TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL
    );
  `);
}

// ─── Team Color Palette ──────────────────────────────────
const TEAM_COLORS = {
  // Division 1
  'Gooners':            { hex: '#FF0000', name: 'Red' },
  'Whistle Pigs':       { hex: '#FFFFFF', name: 'White' },
  'Uptowners':          { hex: '#0066CC', name: 'Royal Blue' },
  'YBNG':               { hex: '#FFD700', name: 'Gold' },
  'Petty Bandits':      { hex: '#000000', name: 'Black' },
  'Monstars':           { hex: '#00CC66', name: 'Green' },
  'FC Tchoupitoulas':   { hex: '#FF8C00', name: 'Orange' },
  // Division 2
  'Ponchartrain FC':    { hex: '#003366', name: 'Navy' },
  'Back That Pass Up':  { hex: '#FF69B4', name: 'Hot Pink' },
  'Ballcelona':         { hex: '#800000', name: 'Maroon' },
  'Dura Mater':         { hex: '#8B00FF', name: 'Purple' },
  'After Hours FC':     { hex: '#CC0000', name: 'Scarlet' },
  'West Bridge FC':     { hex: '#008080', name: 'Teal' },
  'Krewe de Goal':      { hex: '#FFFF00', name: 'Yellow' },
  // Division 3
  'Transplants':        { hex: '#228B22', name: 'Forest Green' },
  'Banana Republic':    { hex: '#FFE135', name: 'Banana Yellow' },
  'Couch Potatoes':     { hex: '#8B4513', name: 'Brown' },
  'Sloppy Seconds':     { hex: '#FFB6C1', name: 'Pink' },
  'NOLA United':        { hex: '#4B0082', name: 'Deep Purple' },
  "Satsuma's Revenge":  { hex: '#FF6600', name: 'Satsuma Orange' },
  'Bayou Brawlers':     { hex: '#87CEEB', name: 'Sky Blue' },
};

// ─── Seed Data ───────────────────────────────────────────
const SEED_DIVISIONS = [
  {
    name: 'Sunday Coed Division 1',
    discord_category_id: '1391650739197182143',
    discord_chat_channel_id: '1391651423766450209',
    teams: [
      { name: 'Gooners',          short: 'GOO', channel: '1391656689312464976' },
      { name: 'Whistle Pigs',     short: 'WHP', channel: '1391656727316791317' },
      { name: 'Uptowners',        short: 'UPT', channel: '1391656759151824956' },
      { name: 'YBNG',             short: 'YBN', channel: '1391656787060457533' },
      { name: 'Petty Bandits',    short: 'PTB', channel: '1391656821021741079' },
      { name: 'Monstars',         short: 'MON', channel: '1391656845692764250' },
      { name: 'FC Tchoupitoulas', short: 'FCT', channel: null },
    ]
  },
  {
    name: 'Sunday Coed Division 2',
    discord_category_id: '1391651774011674716',
    discord_chat_channel_id: '1391653124326035506',
    teams: [
      { name: 'Ponchartrain FC',   short: 'PFC', channel: '1391656299690987600' },
      { name: 'Back That Pass Up', short: 'BTP', channel: '1391656344548933784' },
      { name: 'Ballcelona',        short: 'BAL', channel: '1391656386374664204' },
      { name: 'Dura Mater',        short: 'DRM', channel: '1391656438887219222' },
      { name: 'After Hours FC',    short: 'AHF', channel: '1391656504523882566' },
      { name: 'West Bridge FC',    short: 'WBF', channel: '1391656555698585611' },
      { name: 'Krewe de Goal',     short: 'KDG', channel: null },
    ]
  },
  {
    name: 'Sunday Coed Division 3',
    discord_category_id: '1391654814915498016',
    discord_chat_channel_id: '1391654937032659044',
    teams: [
      { name: 'Transplants',       short: 'TRP', channel: '1391655069006696448' },
      { name: 'Banana Republic',   short: 'BNR', channel: '1391655133682602045' },
      { name: 'Couch Potatoes',    short: 'CPC', channel: '1391655180688429076' },
      { name: 'Sloppy Seconds',    short: 'SLS', channel: '1391655210627104849' },
      { name: 'NOLA United',       short: 'NOU', channel: '1391655250510741624' },
      { name: "Satsuma's Revenge", short: 'SAT', channel: '1391655300846583919' },
      { name: 'Bayou Brawlers',    short: 'BBR', channel: null },
    ]
  }
];

function seedDatabase() {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM seasons').get();
  if (existing.cnt > 0) return false;

  console.log('Seeding database...');

  const insertSeason = db.prepare(
    'INSERT INTO seasons (name, start_date, game_day) VALUES (?, ?, ?)'
  );
  const insertDiv = db.prepare(
    'INSERT INTO divisions (season_id, name, discord_category_id, discord_chat_channel_id) VALUES (?, ?, ?, ?)'
  );
  const insertTeam = db.prepare(
    'INSERT INTO teams (name, short_name, color_hex, color_name, season_id, division_id, discord_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const seasonInfo = insertSeason.run('Spring 2026', '2026-03-07', 'Saturday');
  const seasonId = seasonInfo.lastInsertRowid;

  for (const div of SEED_DIVISIONS) {
    const divInfo = insertDiv.run(
      seasonId, div.name, div.discord_category_id, div.discord_chat_channel_id
    );
    const divId = divInfo.lastInsertRowid;

    for (const team of div.teams) {
      const colors = TEAM_COLORS[team.name] || { hex: '#888888', name: 'Gray' };
      insertTeam.run(
        team.name, team.short, colors.hex, colors.name,
        seasonId, divId, team.channel
      );
    }
  }

  // Generate schedule for each division
  const divisions = getDivisions(seasonId);
  for (const div of divisions) {
    generateSchedule(seasonId, div.id);
  }

  console.log(`Seeded: 1 season, ${divisions.length} divisions, 21 teams, schedule generated`);
  return true;
}

// ─── Schedule Generation ─────────────────────────────────
function generateSchedule(seasonId, divisionId) {
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(seasonId);
  const teams = getTeamsForDivision(seasonId, divisionId);

  // Delete existing games for this division
  db.prepare('DELETE FROM games WHERE season_id = ? AND division_id = ?').run(seasonId, divisionId);

  // Add BYE placeholder for odd team counts
  const roster = [...teams];
  if (roster.length % 2 !== 0) roster.push({ id: null, name: 'BYE' });
  const n = roster.length;

  // Classic round-robin rotation: fix first team, rotate rest
  const rounds = [];
  const rotating = [...roster];
  for (let round = 0; round < n - 1; round++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const home = rotating[i];
      const away = rotating[n - 1 - i];
      if (home.id && away.id) {
        matches.push({ home: home.id, away: away.id });
      }
    }
    rounds.push(matches);
    // Rotate: keep first fixed, cycle rest
    const last = rotating.pop();
    rotating.splice(1, 0, last);
  }

  // Double round-robin: reverse home/away for second half
  const allRounds = [...rounds];
  for (const r of rounds) {
    allRounds.push(r.map(m => ({ home: m.away, away: m.home })));
  }

  // Generate match dates
  const blackouts = db.prepare(
    'SELECT date FROM blackout_dates WHERE season_id = ?'
  ).all(seasonId).map(b => b.date);

  const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  const targetDay = dayMap[season.game_day] ?? 6;

  let currentDate = new Date(season.start_date + 'T12:00:00');
  // Advance to first target day
  while (currentDate.getDay() !== targetDay) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const insertGame = db.prepare(
    `INSERT INTO games (season_id, division_id, round, match_day, home_team_id, away_team_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const insert = db.transaction(() => {
    for (let i = 0; i < allRounds.length; i++) {
      // Skip blackout dates
      let dateStr = currentDate.toISOString().split('T')[0];
      while (blackouts.includes(dateStr)) {
        currentDate.setDate(currentDate.getDate() + 7);
        dateStr = currentDate.toISOString().split('T')[0];
      }

      for (const match of allRounds[i]) {
        insertGame.run(seasonId, divisionId, i + 1, dateStr, match.home, match.away);
      }
      currentDate.setDate(currentDate.getDate() + 7);
    }
  });
  insert();
}

// ─── Playoff Generation ──────────────────────────────────
function createPlayoffGames(seasonId, divisionId) {
  const standings = getStandings(seasonId, divisionId);
  if (standings.length < 4) return;

  // Get last regular season date for this division
  const lastGame = db.prepare(
    'SELECT MAX(match_day) as last_day FROM games WHERE season_id = ? AND division_id = ? AND is_playoff = 0'
  ).get(seasonId, divisionId);

  let playoffDate = new Date(lastGame.last_day + 'T12:00:00');
  playoffDate.setDate(playoffDate.getDate() + 7);
  const semifinalDate = playoffDate.toISOString().split('T')[0];

  playoffDate.setDate(playoffDate.getDate() + 7);
  const finalDate = playoffDate.toISOString().split('T')[0];

  const insertPlayoff = db.prepare(
    `INSERT INTO games (season_id, division_id, round, match_day, home_team_id, away_team_id, is_playoff, playoff_round)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  );

  // Semifinal 1: #1 vs #4
  insertPlayoff.run(seasonId, divisionId, 100, semifinalDate, standings[0].team_id, standings[3].team_id, 'semifinal');
  // Semifinal 2: #2 vs #3
  insertPlayoff.run(seasonId, divisionId, 100, semifinalDate, standings[1].team_id, standings[2].team_id, 'semifinal');
  // Final: placeholders (updated after semis are played)
  insertPlayoff.run(seasonId, divisionId, 101, finalDate, standings[0].team_id, standings[1].team_id, 'final');
}

function updateFinalTeams(seasonId, divisionId) {
  const semis = db.prepare(
    `SELECT * FROM games WHERE season_id = ? AND division_id = ? AND playoff_round = 'semifinal' AND played = 1`
  ).all(seasonId, divisionId);

  if (semis.length !== 2) return false;

  const winners = semis.map(g => g.home_score > g.away_score ? g.home_team_id : g.away_team_id);

  db.prepare(
    `UPDATE games SET home_team_id = ?, away_team_id = ?
     WHERE season_id = ? AND division_id = ? AND playoff_round = 'final' AND played = 0`
  ).run(winners[0], winners[1], seasonId, divisionId);

  return true;
}

// ─── Query Functions ─────────────────────────────────────
function getActiveSeason() {
  return db.prepare('SELECT * FROM seasons WHERE active = 1 ORDER BY id DESC LIMIT 1').get();
}

function getDivisions(seasonId) {
  return db.prepare('SELECT * FROM divisions WHERE season_id = ? ORDER BY id').all(seasonId);
}

function getTeamsForDivision(seasonId, divisionId) {
  return db.prepare(
    'SELECT * FROM teams WHERE season_id = ? AND division_id = ? AND active = 1 ORDER BY name'
  ).all(seasonId, divisionId);
}

function getAllTeams(seasonId) {
  return db.prepare(
    'SELECT t.*, d.name as division_name FROM teams t JOIN divisions d ON t.division_id = d.id WHERE t.season_id = ? AND t.active = 1 ORDER BY d.id, t.name'
  ).all(seasonId);
}

function getStandings(seasonId, divisionId) {
  return db.prepare(`
    SELECT
      t.id as team_id,
      t.name,
      t.short_name,
      t.color_hex,
      t.color_name,
      COUNT(CASE WHEN g.played = 1 THEN 1 END) as played,
      COUNT(CASE WHEN g.played = 1 AND (
        (g.home_team_id = t.id AND g.home_score > g.away_score) OR
        (g.away_team_id = t.id AND g.away_score > g.home_score)
      ) THEN 1 END) as wins,
      COUNT(CASE WHEN g.played = 1 AND g.home_score = g.away_score AND (
        g.home_team_id = t.id OR g.away_team_id = t.id
      ) THEN 1 END) as draws,
      COUNT(CASE WHEN g.played = 1 AND (
        (g.home_team_id = t.id AND g.home_score < g.away_score) OR
        (g.away_team_id = t.id AND g.away_score < g.home_score)
      ) THEN 1 END) as losses,
      COALESCE(SUM(CASE WHEN g.played = 1 AND g.home_team_id = t.id THEN g.home_score
                        WHEN g.played = 1 AND g.away_team_id = t.id THEN g.away_score
                        ELSE 0 END), 0) as goals_for,
      COALESCE(SUM(CASE WHEN g.played = 1 AND g.home_team_id = t.id THEN g.away_score
                        WHEN g.played = 1 AND g.away_team_id = t.id THEN g.home_score
                        ELSE 0 END), 0) as goals_against
    FROM teams t
    LEFT JOIN games g ON (g.home_team_id = t.id OR g.away_team_id = t.id)
      AND g.season_id = ? AND g.division_id = ? AND g.is_playoff = 0
    WHERE t.season_id = ? AND t.division_id = ? AND t.active = 1
    GROUP BY t.id
    ORDER BY
      (COUNT(CASE WHEN g.played = 1 AND ((g.home_team_id = t.id AND g.home_score > g.away_score) OR (g.away_team_id = t.id AND g.away_score > g.home_score)) THEN 1 END) * 3 +
       COUNT(CASE WHEN g.played = 1 AND g.home_score = g.away_score AND (g.home_team_id = t.id OR g.away_team_id = t.id) THEN 1 END)) DESC,
      (COALESCE(SUM(CASE WHEN g.played = 1 AND g.home_team_id = t.id THEN g.home_score WHEN g.played = 1 AND g.away_team_id = t.id THEN g.away_score ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN g.played = 1 AND g.home_team_id = t.id THEN g.away_score WHEN g.played = 1 AND g.away_team_id = t.id THEN g.home_score ELSE 0 END), 0)) DESC
  `).all(seasonId, divisionId, seasonId, divisionId).map(row => ({
    ...row,
    goal_diff: row.goals_for - row.goals_against,
    points: row.wins * 3 + row.draws
  }));
}

function getSchedule(seasonId, divisionId) {
  let query = `
    SELECT g.*, ht.name as home_name, ht.short_name as home_short, ht.color_hex as home_color,
           at.name as away_name, at.short_name as away_short, at.color_hex as away_color,
           d.name as division_name
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    JOIN divisions d ON g.division_id = d.id
    WHERE g.season_id = ?`;
  const params = [seasonId];

  if (divisionId) {
    query += ' AND g.division_id = ?';
    params.push(divisionId);
  }
  query += ' ORDER BY g.match_day, g.division_id, g.round';
  return db.prepare(query).all(...params);
}

function getUpcomingGames(seasonId, limit = 10) {
  const today = new Date().toISOString().split('T')[0];
  return db.prepare(`
    SELECT g.*, ht.name as home_name, ht.short_name as home_short, ht.color_hex as home_color,
           at.name as away_name, at.short_name as away_short, at.color_hex as away_color,
           d.name as division_name
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    JOIN divisions d ON g.division_id = d.id
    WHERE g.season_id = ? AND g.played = 0 AND g.match_day >= ?
    ORDER BY g.match_day, g.division_id
    LIMIT ?
  `).all(seasonId, today, limit);
}

function getRecentResults(seasonId, limit = 10) {
  return db.prepare(`
    SELECT g.*, ht.name as home_name, ht.short_name as home_short, ht.color_hex as home_color,
           at.name as away_name, at.short_name as away_short, at.color_hex as away_color,
           d.name as division_name
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    JOIN divisions d ON g.division_id = d.id
    WHERE g.season_id = ? AND g.played = 1
    ORDER BY g.match_day DESC, g.id DESC
    LIMIT ?
  `).all(seasonId, limit);
}

function recordResult(gameId, homeScore, awayScore) {
  return db.prepare(
    'UPDATE games SET home_score = ?, away_score = ?, played = 1 WHERE id = ?'
  ).run(homeScore, awayScore, gameId);
}

function getGameById(gameId) {
  return db.prepare(`
    SELECT g.*, ht.name as home_name, at.name as away_name, d.name as division_name,
           d.discord_chat_channel_id
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    JOIN divisions d ON g.division_id = d.id
    WHERE g.id = ?
  `).get(gameId);
}

function getUnplayedGames(seasonId) {
  return db.prepare(`
    SELECT g.id, ht.name as home_name, at.name as away_name, ht.color_hex as home_color, at.color_hex as away_color,
           g.match_day, d.name as division_name, g.is_playoff, g.playoff_round
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    JOIN divisions d ON g.division_id = d.id
    WHERE g.season_id = ? AND g.played = 0
    ORDER BY g.match_day, g.division_id
  `).all(seasonId);
}

function getSeasonStats(seasonId) {
  const total = db.prepare('SELECT COUNT(*) as cnt FROM games WHERE season_id = ?').get(seasonId);
  const played = db.prepare('SELECT COUNT(*) as cnt FROM games WHERE season_id = ? AND played = 1').get(seasonId);
  const teams = db.prepare('SELECT COUNT(*) as cnt FROM teams WHERE season_id = ? AND active = 1').get(seasonId);
  const divisions = db.prepare('SELECT COUNT(*) as cnt FROM divisions WHERE season_id = ?').get(seasonId);
  return {
    total_games: total.cnt,
    played_games: played.cnt,
    remaining_games: total.cnt - played.cnt,
    total_teams: teams.cnt,
    total_divisions: divisions.cnt
  };
}

function getBlackoutDates(seasonId) {
  return db.prepare('SELECT * FROM blackout_dates WHERE season_id = ? ORDER BY date').all(seasonId);
}

function addBlackoutDate(seasonId, date, reason) {
  return db.prepare('INSERT INTO blackout_dates (season_id, date, reason) VALUES (?, ?, ?)').run(seasonId, date, reason);
}

function deleteBlackoutDate(id) {
  return db.prepare('DELETE FROM blackout_dates WHERE id = ?').run(id);
}

function addTeam(name, shortName, colorHex, colorName, seasonId, divisionId) {
  return db.prepare(
    'INSERT INTO teams (name, short_name, color_hex, color_name, season_id, division_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, shortName, colorHex, colorName, seasonId, divisionId);
}

function deleteTeam(id) {
  return db.prepare('UPDATE teams SET active = 0 WHERE id = ?').run(id);
}

function createSeason(name, startDate, gameDay) {
  takeSnapshot('new-season');
  // Deactivate all current seasons
  db.prepare('UPDATE seasons SET active = 0').run();
  return db.prepare('INSERT INTO seasons (name, start_date, game_day) VALUES (?, ?, ?)').run(name, startDate, gameDay);
}

function regenerateAllSchedules(seasonId) {
  takeSnapshot('regenerate-schedules');
  const divisions = getDivisions(seasonId);
  for (const div of divisions) {
    generateSchedule(seasonId, div.id);
  }
}

function getDiscordChannel(key) {
  const row = db.prepare('SELECT channel_id FROM discord_channels WHERE key = ?').get(key);
  return row ? row.channel_id : null;
}

function setDiscordChannel(key, channelId) {
  db.prepare(
    'INSERT OR REPLACE INTO discord_channels (key, channel_id) VALUES (?, ?)'
  ).run(key, channelId);
}

function getTeamByName(name) {
  return db.prepare(
    "SELECT t.*, d.name as division_name FROM teams t JOIN divisions d ON t.division_id = d.id WHERE t.name LIKE ? AND t.active = 1"
  ).get(`%${name}%`);
}

function getNextGameForTeam(teamId, seasonId) {
  const today = new Date().toISOString().split('T')[0];
  return db.prepare(`
    SELECT g.*, ht.name as home_name, at.name as away_name, d.name as division_name
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    JOIN divisions d ON g.division_id = d.id
    WHERE g.season_id = ? AND g.played = 0 AND g.match_day >= ?
      AND (g.home_team_id = ? OR g.away_team_id = ?)
    ORDER BY g.match_day LIMIT 1
  `).get(seasonId, today, teamId, teamId);
}

// ─── Snapshots ──────────────────────────────────────────
const BACKUP_DIR = path.join(dataDir, 'snapshots');

function takeSnapshot(reason) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tag = (reason || 'manual').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `league_${timestamp}_${tag}.db`;
  const dest = path.join(BACKUP_DIR, filename);

  // Use SQLite backup API via VACUUM INTO for a consistent copy
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  console.log(`Snapshot saved: ${filename}`);
  return filename;
}

function listSnapshots() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .sort()
    .reverse()
    .map(f => ({
      filename: f,
      path: path.join(BACKUP_DIR, f),
      size: fs.statSync(path.join(BACKUP_DIR, f)).size,
      created: fs.statSync(path.join(BACKUP_DIR, f)).mtime,
    }));
}

// ─── Initialize ──────────────────────────────────────────
createTables();
seedDatabase();

module.exports = {
  db,
  getActiveSeason,
  getDivisions,
  getTeamsForDivision,
  getAllTeams,
  getStandings,
  getSchedule,
  getUpcomingGames,
  getRecentResults,
  recordResult,
  getGameById,
  getUnplayedGames,
  getSeasonStats,
  getBlackoutDates,
  addBlackoutDate,
  deleteBlackoutDate,
  addTeam,
  deleteTeam,
  createSeason,
  regenerateAllSchedules,
  generateSchedule,
  createPlayoffGames,
  updateFinalTeams,
  getDiscordChannel,
  setDiscordChannel,
  getTeamByName,
  getNextGameForTeam,
  takeSnapshot,
  listSnapshots,
  TEAM_COLORS,
};
