// One-time script: fix duplicate channels, post pinned welcome,
// post division schedules & standings in division chats.
// Run with: node setup-discord.js

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const db = require('./database');

const GUILD_ID = '1391648870278369350';
const LEAGUE_CHAT_ID = '1391648870915637260';

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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);

  await fixDuplicateChannels(guild);
  await postPinnedWelcome(guild);
  await postDivisionContent(guild);

  console.log('\nSetup complete!');
  client.destroy();
  process.exit(0);
});

// ─── 1. Fix Duplicate Schedule/Standings Channels ────────
async function fixDuplicateChannels(guild) {
  console.log('\n--- Fixing duplicate channels ---');

  const botScheduleId = db.getDiscordChannel('schedule');
  const botStandingsId = db.getDiscordChannel('standings');

  const allChannels = guild.channels.cache;

  for (const [name, botId] of [['schedule', botScheduleId], ['standings', botStandingsId]]) {
    const dupes = allChannels.filter(c => c.name === name && c.isTextBased());
    console.log(`#${name}: found ${dupes.size} channel(s)`);

    for (const [id, channel] of dupes) {
      if (id === botId) {
        console.log(`  keeping ${id} (bot-managed)`);
      } else {
        console.log(`  deleting relic ${id}`);
        await channel.delete('Removing duplicate channel');
      }
    }
  }
}

// ─── 2. Post Pinned Welcome in League Chat ───────────────
async function postPinnedWelcome(guild) {
  console.log('\n--- Posting pinned welcome ---');
  const channel = guild.channels.cache.get(LEAGUE_CHAT_ID);
  if (!channel) { console.error('League chat not found!'); return; }

  const embed = new EmbedBuilder()
    .setTitle('Welcome to the NOLA Sunday Coed Soccer League!')
    .setDescription(
      'This is the official Discord for the **Sunday Coed Soccer League**.\n\n' +
      '**Quick Links**\n' +
      '[League Website](https://michaelbpyle.com/soccer-league/) | ' +
      '[Schedule](https://michaelbpyle.com/soccer-league/schedule) | ' +
      '[Standings](https://michaelbpyle.com/soccer-league/standings)\n\n' +
      '**Bot Commands**\n' +
      '`/standings` \u2014 Current standings\n' +
      '`/schedule` \u2014 Upcoming games\n' +
      '`/results` \u2014 Recent results\n' +
      '`/teams` \u2014 All teams by division\n' +
      '`/nextgame <team>` \u2014 A team\'s next game\n\n' +
      '**Channels**\n' +
      'Each division has its own category with a general chat and team channels. ' +
      'Check **#schedule** and **#standings** for league-wide updates.\n\n' +
      '*New members \u2014 answer the questions Meola sends you to pick your gender, experience, positions, and team!*'
    )
    .setColor(0x667eea);

  const msg = await channel.send({ embeds: [embed] });
  await msg.pin();
  console.log('Pinned welcome message in #league-chat');
}

// ─── 3. Post Schedules & Standings in Division Chats ─────
async function postDivisionContent(guild) {
  console.log('\n--- Posting division content ---');
  const season = db.getActiveSeason();
  if (!season) { console.error('No active season!'); return; }

  const divisions = db.getDivisions(season.id);

  for (const div of divisions) {
    const chatChannel = guild.channels.cache.get(div.discord_chat_channel_id);
    if (!chatChannel) {
      console.error(`Chat channel not found for ${div.name} (${div.discord_chat_channel_id})`);
      continue;
    }

    // ── Schedule ──
    const schedule = db.getSchedule(season.id, div.id);
    let schedText = '';
    let currentDate = '';
    let currentRound = 0;
    for (const g of schedule) {
      if (g.match_day !== currentDate) {
        currentDate = g.match_day;
        currentRound = g.round;
        const dateObj = new Date(g.match_day + 'T12:00:00');
        const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        schedText += `\n**${dateStr}** \u2014 Round ${currentRound}\n`;
      }
      schedText += `${getEmoji(g.home_color)} ${g.home_name} vs ${getEmoji(g.away_color)} ${g.away_name}\n`;
    }

    const schedEmbed = new EmbedBuilder()
      .setTitle(`${div.name} \u2014 ${season.name} Schedule`)
      .setDescription(schedText.substring(0, 4096))
      .setColor(0x667eea)
      .setFooter({ text: `${schedule.length} games | ${season.game_day}s` });

    await chatChannel.send({ embeds: [schedEmbed] });
    console.log(`Posted schedule in ${div.name} chat`);

    // ── Standings ──
    const standings = db.getStandings(season.id, div.id);
    let standText = '```\n';
    standText += 'Pos  Team             P   W  D  L  GD  Pts\n';
    standText += '\u2500'.repeat(46) + '\n';
    standings.forEach((row, i) => {
      const pos = String(i + 1).padStart(2);
      const name = row.name.substring(0, 16).padEnd(16);
      const p = String(row.played).padStart(2);
      const w = String(row.wins).padStart(2);
      const d = String(row.draws).padStart(2);
      const l = String(row.losses).padStart(2);
      const gd = ((row.goal_diff >= 0 ? '+' : '') + row.goal_diff).padStart(4);
      const pts = String(row.points).padStart(3);
      const qual = i < 4 ? ' *' : '';
      standText += `${pos}. ${name} ${p}  ${w} ${d} ${l} ${gd} ${pts}${qual}\n`;
    });
    standText += '```\n* = playoff qualifying';

    const standEmbed = new EmbedBuilder()
      .setTitle(`${div.name} \u2014 Standings`)
      .setDescription(standText)
      .setColor(0x667eea);

    await chatChannel.send({ embeds: [standEmbed] });
    console.log(`Posted standings in ${div.name} chat`);

    // Rate-limit buffer
    await new Promise(r => setTimeout(r, 1000));
  }
}

client.login(process.env.DISCORD_BOT_TOKEN);
