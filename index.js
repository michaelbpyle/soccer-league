require('dotenv').config();

const express = require('express');
const path = require('path');
const db = require('./database');
const bot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── Routes ──────────────────────────────────────────────

// Dashboard
app.get('/', (req, res) => {
  const season = db.getActiveSeason();
  if (!season) return res.render('dashboard', { season: null, stats: null, upcoming: [], results: [], divisions: [], standingsByDiv: {} });

  const stats = db.getSeasonStats(season.id);
  const upcoming = db.getUpcomingGames(season.id, 9);
  const results = db.getRecentResults(season.id, 6);
  const divisions = db.getDivisions(season.id);
  const standingsByDiv = {};
  for (const div of divisions) {
    standingsByDiv[div.id] = db.getStandings(season.id, div.id);
  }

  res.render('dashboard', { season, stats, upcoming, results, divisions, standingsByDiv });
});

// Schedule
app.get('/schedule', (req, res) => {
  const season = db.getActiveSeason();
  const divisions = season ? db.getDivisions(season.id) : [];
  const divId = req.query.div ? parseInt(req.query.div) : null;
  const schedule = season ? db.getSchedule(season.id, divId) : [];
  res.render('schedule', { season, divisions, schedule, selectedDiv: divId });
});

// Standings
app.get('/standings', (req, res) => {
  const season = db.getActiveSeason();
  const divisions = season ? db.getDivisions(season.id) : [];
  const standingsByDiv = {};
  if (season) {
    for (const div of divisions) {
      standingsByDiv[div.id] = db.getStandings(season.id, div.id);
    }
  }
  res.render('standings', { season, divisions, standingsByDiv });
});

// Teams
app.get('/teams', (req, res) => {
  const season = db.getActiveSeason();
  const divisions = season ? db.getDivisions(season.id) : [];
  const teamsByDiv = {};
  if (season) {
    for (const div of divisions) {
      teamsByDiv[div.id] = db.getTeamsForDivision(season.id, div.id);
    }
  }
  res.render('teams', { season, divisions, teamsByDiv });
});

app.post('/teams/add', (req, res) => {
  const { name, short_name, color_hex, color_name, division_id } = req.body;
  const season = db.getActiveSeason();
  if (season && name && division_id) {
    db.addTeam(name, short_name || name.substring(0, 3).toUpperCase(), color_hex || '#888888', color_name || 'Gray', season.id, parseInt(division_id));
  }
  res.redirect('/teams');
});

app.post('/teams/delete/:id', (req, res) => {
  db.deleteTeam(parseInt(req.params.id));
  res.redirect('/teams');
});

// Results
app.get('/results', (req, res) => {
  const season = db.getActiveSeason();
  const results = season ? db.getRecentResults(season.id, 20) : [];
  const unplayed = season ? db.getUnplayedGames(season.id) : [];
  res.render('results', { season, results, unplayed });
});

app.post('/results/record', async (req, res) => {
  const { game_id, home_score, away_score } = req.body;
  if (game_id && home_score !== undefined && away_score !== undefined) {
    db.recordResult(parseInt(game_id), parseInt(home_score), parseInt(away_score));

    // Post result to Discord
    const game = db.getGameById(parseInt(game_id));
    if (game) {
      try { await bot.postResult(game); } catch (e) { console.error('Discord post failed:', e.message); }
    }
  }
  res.redirect('/results');
});

// Admin
app.get('/admin', (req, res) => {
  const season = db.getActiveSeason();
  const blackouts = season ? db.getBlackoutDates(season.id) : [];
  const divisions = season ? db.getDivisions(season.id) : [];
  res.render('admin', { season, blackouts, divisions });
});

app.post('/admin/season', (req, res) => {
  const { name, start_date, game_day } = req.body;
  if (name && start_date) {
    db.createSeason(name, start_date, game_day || 'Saturday');
  }
  res.redirect('/admin');
});

app.post('/admin/regenerate', (req, res) => {
  const season = db.getActiveSeason();
  if (season) {
    db.regenerateAllSchedules(season.id);
  }
  res.redirect('/admin');
});

app.post('/admin/blackout', (req, res) => {
  const { date, reason } = req.body;
  const season = db.getActiveSeason();
  if (season && date) {
    db.addBlackoutDate(season.id, date, reason || null);
  }
  res.redirect('/admin');
});

app.post('/admin/blackout/delete/:id', (req, res) => {
  db.deleteBlackoutDate(parseInt(req.params.id));
  res.redirect('/admin');
});

// API
app.get('/api/standings', (req, res) => {
  const season = db.getActiveSeason();
  if (!season) return res.json({ error: 'No active season' });

  const divisions = db.getDivisions(season.id);
  const result = {};
  for (const div of divisions) {
    result[div.name] = db.getStandings(season.id, div.id);
  }
  res.json(result);
});

// ─── Start Server ────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Soccer League web server running on port ${PORT}`);
});

// ─── Start Discord Bot ───────────────────────────────────
bot.createBot();
bot.startWeeklyPosts();

console.log('Soccer League Manager starting...');
