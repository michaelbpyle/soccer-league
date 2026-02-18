require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const db = require('./database');

const GUILD_ID = '1391648870278369350';
const LEAGUE_CHAT_ID = '1391648870915637260';
const DIV_CHANNELS = {
  1: '1391651423766450209',
  2: '1391653124326035506',
  3: '1391654937032659044'
};

const colorEmoji = {
  '#FF0000': '\u{1F534}', '#FFFFFF': '\u26AA', '#0066CC': '\u{1F535}',
  '#FFD700': '\u{1F7E1}', '#000000': '\u26AB', '#00CC66': '\u{1F7E2}',
  '#FF8C00': '\u{1F7E0}', '#003366': '\u{1F535}', '#FF69B4': '\u{1F7E3}',
  '#800000': '\u{1F7E4}', '#8B00FF': '\u{1F7E3}', '#CC0000': '\u{1F534}',
  '#008080': '\u{1F535}', '#FFFF00': '\u{1F7E1}', '#228B22': '\u{1F7E2}',
  '#FFE135': '\u{1F7E1}', '#8B4513': '\u{1F7E4}', '#FFB6C1': '\u{1F7E3}',
  '#4B0082': '\u{1F7E3}', '#FF6600': '\u{1F7E0}', '#87CEEB': '\u{1F535}',
};

function getEmoji(hex) { return colorEmoji[hex] || '\u26AA'; }

function randomScore() {
  // Weighted: 0-2 common, 3 less common, 4-5 rare
  const weights = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 4, 5];
  return weights[Math.floor(Math.random() * weights.length)];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function postToChannel(client, channelId, message) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) await channel.send(message);
  } catch (err) {
    console.error(`Post failed (${channelId}):`, err.message);
  }
}

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  await client.login(process.env.DISCORD_BOT_TOKEN);
  await new Promise(resolve => client.once('ready', resolve));
  console.log(`Logged in as ${client.user.tag}`);

  const season = db.getActiveSeason();
  if (!season) { console.log('No active season!'); process.exit(1); }

  const divisions = db.getDivisions(season.id);

  // Reset all games
  db.db.prepare('UPDATE games SET home_score = NULL, away_score = NULL, played = 0 WHERE season_id = ?').run(season.id);
  // Delete playoff games
  db.db.prepare('DELETE FROM games WHERE season_id = ? AND is_playoff = 1').run(season.id);
  console.log('Reset all game results');

  // Simulate regular season
  const schedule = db.getSchedule(season.id);
  const rounds = {};
  for (const game of schedule) {
    const key = `${game.division_id}-${game.round}`;
    if (!rounds[key]) rounds[key] = [];
    rounds[key].push(game);
  }

  const sortedKeys = Object.keys(rounds).sort((a, b) => {
    const [dA, rA] = a.split('-').map(Number);
    const [dB, rB] = b.split('-').map(Number);
    return rA - rB || dA - dB;
  });

  let currentRound = 0;
  for (const key of sortedKeys) {
    const games = rounds[key];
    const round = parseInt(key.split('-')[1]);
    const divId = parseInt(key.split('-')[0]);

    if (round !== currentRound) {
      currentRound = round;
      console.log(`\n=== Round ${round} ===`);
    }

    const divName = divisions.find(d => d.id === divId)?.name || `Division ${divId}`;
    const divChannelId = Object.values(DIV_CHANNELS)[divId - divisions[0].id] || null;

    let resultText = `**${divName} - Round ${round}**\n`;

    for (const game of games) {
      const hs = randomScore();
      const as = randomScore();
      db.recordResult(game.id, hs, as);
      console.log(`  ${game.home_name} ${hs} - ${as} ${game.away_name}`);
      resultText += `${getEmoji(game.home_color)} **${game.home_name}** ${hs} - ${as} **${game.away_name}** ${getEmoji(game.away_color)}\n`;
    }

    // Post to division channel
    if (divChannelId) {
      const embed = new EmbedBuilder()
        .setTitle(`Round ${round} Results`)
        .setDescription(resultText)
        .setColor(0x667eea);
      await postToChannel(client, divChannelId, { embeds: [embed] });
      await sleep(1500);
    }
  }

  // Post final standings to league chat
  console.log('\n=== Final Standings ===');
  const standingsEmbeds = [];
  for (const div of divisions) {
    const standings = db.getStandings(season.id, div.id);
    let table = '```\n';
    table += 'Pos  Team              Pts  W  D  L  GD\n';
    table += '\u2500'.repeat(45) + '\n';
    standings.forEach((row, i) => {
      const pos = String(i + 1).padStart(2);
      const name = row.name.substring(0, 17).padEnd(17);
      const qualify = i < 4 ? ' *' : '';
      table += `${pos}. ${name} ${String(row.points).padStart(3)}  ${String(row.wins).padStart(2)} ${String(row.draws).padStart(2)} ${String(row.losses).padStart(2)} ${((row.goal_diff >= 0 ? '+' : '') + row.goal_diff).padStart(3)}${qualify}\n`;
      console.log(`  ${pos}. ${row.name} - ${row.points}pts (${row.wins}W ${row.draws}D ${row.losses}L) GD:${row.goal_diff}`);
    });
    table += '```\n* = playoff qualifying';

    standingsEmbeds.push(new EmbedBuilder()
      .setTitle(div.name)
      .setDescription(table)
      .setColor(0x667eea)
    );
  }
  await postToChannel(client, LEAGUE_CHAT_ID, { embeds: standingsEmbeds });
  await sleep(2000);

  // Create and simulate playoffs
  console.log('\n=== Playoffs ===');
  for (const div of divisions) {
    db.createPlayoffGames(season.id, div.id);
  }

  // Simulate semifinals
  const semis = db.db.prepare(
    "SELECT g.*, ht.name as home_name, at.name as away_name, ht.color_hex as home_color, at.color_hex as away_color, d.name as division_name FROM games g JOIN teams ht ON g.home_team_id = ht.id JOIN teams at ON g.away_team_id = at.id JOIN divisions d ON g.division_id = d.id WHERE g.season_id = ? AND g.playoff_round = 'semifinal'"
  ).all(season.id);

  let semiText = '**Semifinal Results**\n\n';
  for (const game of semis) {
    let hs, as;
    do { hs = randomScore(); as = randomScore(); } while (hs === as); // No draws
    db.recordResult(game.id, hs, as);
    const winner = hs > as ? game.home_name : game.away_name;
    semiText += `${getEmoji(game.home_color)} **${game.home_name}** ${hs} - ${as} **${game.away_name}** ${getEmoji(game.away_color)}  \u2192 ${winner} advances\n`;
    console.log(`  SF: ${game.home_name} ${hs} - ${as} ${game.away_name} (${winner} wins)`);
  }

  const semiEmbed = new EmbedBuilder()
    .setTitle('\u{1F3C6} Playoff Semifinals')
    .setDescription(semiText)
    .setColor(0xffd700);
  await postToChannel(client, LEAGUE_CHAT_ID, { embeds: [semiEmbed] });
  await sleep(2000);

  // Update finals with semifinal winners
  for (const div of divisions) {
    db.updateFinalTeams(season.id, div.id);
  }

  // Simulate finals
  const finals = db.db.prepare(
    "SELECT g.*, ht.name as home_name, at.name as away_name, ht.color_hex as home_color, at.color_hex as away_color, d.name as division_name FROM games g JOIN teams ht ON g.home_team_id = ht.id JOIN teams at ON g.away_team_id = at.id JOIN divisions d ON g.division_id = d.id WHERE g.season_id = ? AND g.playoff_round = 'final'"
  ).all(season.id);

  let finalText = '**Division Finals**\n\n';
  for (const game of finals) {
    let hs, as;
    do { hs = randomScore(); as = randomScore(); } while (hs === as);
    db.recordResult(game.id, hs, as);
    const champion = hs > as ? game.home_name : game.away_name;
    finalText += `**${game.division_name}**\n`;
    finalText += `${getEmoji(game.home_color)} **${game.home_name}** ${hs} - ${as} **${game.away_name}** ${getEmoji(game.away_color)}\n`;
    finalText += `\u{1F3C6} **${champion} are CHAMPIONS!** \u{1F3C6}\n\n`;
    console.log(`  FINAL: ${game.home_name} ${hs} - ${as} ${game.away_name} -> ${champion} CHAMPIONS!`);
  }

  const finalEmbed = new EmbedBuilder()
    .setTitle('\u{1F3C6} Division Champions \u{1F3C6}')
    .setDescription(finalText)
    .setColor(0xffd700);
  await postToChannel(client, LEAGUE_CHAT_ID, { embeds: [finalEmbed] });

  console.log('\nSimulation complete!');
  await sleep(2000);
  client.destroy();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
