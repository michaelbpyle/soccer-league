const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('./database');

const GUILD_ID = '1391648870278369350';
const LEAGUE_CHAT_ID = '1391648870915637260';

// ─── Onboarding Role Groups ─────────────────────────────
const ROLE_GROUPS = {
  gender: ['Male', 'Female'],
  experience: ['Just Starting', 'Played as a Kid', 'Played in High School', 'Played in College', 'Played Pro/Semi-Pro'],
  position: ['GK', 'DEF', 'MID', 'FW'],
};

// Color emoji mapping
const colorEmoji = {
  '#FF0000': '\u{1F534}', '#FFFFFF': '\u26AA', '#0066CC': '\u{1F535}',
  '#FFD700': '\u{1F7E1}', '#000000': '\u26AB', '#00CC66': '\u{1F7E2}',
  '#FF8C00': '\u{1F7E0}', '#003366': '\u{1F535}', '#FF69B4': '\u{1F7E3}',
  '#800000': '\u{1F7E4}', '#8B00FF': '\u{1F7E3}', '#CC0000': '\u{1F534}',
  '#008080': '\u{1F535}', '#FFFF00': '\u{1F7E1}', '#228B22': '\u{1F7E2}',
  '#FFE135': '\u{1F7E1}', '#8B4513': '\u{1F7E4}', '#FFB6C1': '\u{1F7E3}',
  '#4B0082': '\u{1F7E3}', '#FF6600': '\u{1F7E0}', '#87CEEB': '\u{1F535}',
};

function getEmoji(hex) {
  return colorEmoji[hex] || '\u26AA';
}

let client = null;

function createBot() {
  client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

  client.once('ready', async () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);
    await registerCommands();
    await ensureChannels();
    await ensureRoles();
  });

  client.on('guildMemberAdd', async (member) => {
    try {
      await sendWelcome(member);
    } catch (err) {
      console.error('Welcome message error:', err);
    }
  });

  client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      try {
        await handleCommand(interaction);
      } catch (err) {
        console.error('Command error:', err);
        const reply = { content: 'Something went wrong.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('role_gender_')) {
      const gender = interaction.customId.replace('role_gender_', '');
      await assignRoles(interaction, 'gender', [gender]);
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'role_experience') {
      await assignRoles(interaction, 'experience', interaction.values);
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'role_position') {
      await assignRoles(interaction, 'position', interaction.values);
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'role_team') {
      await assignTeamRoles(interaction, interaction.values);
      return;
    }
  });

  client.login(process.env.DISCORD_BOT_TOKEN);
  return client;
}

// ─── Command Registration ────────────────────────────────
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  const commands = [
    new SlashCommandBuilder()
      .setName('standings')
      .setDescription('Show current league standings')
      .addStringOption(opt => opt.setName('division').setDescription('Division name (optional)').setRequired(false)),
    new SlashCommandBuilder()
      .setName('schedule')
      .setDescription('Show upcoming games (next 2 weeks)'),
    new SlashCommandBuilder()
      .setName('results')
      .setDescription('Show recent match results'),
    new SlashCommandBuilder()
      .setName('teams')
      .setDescription('List all teams by division'),
    new SlashCommandBuilder()
      .setName('nextgame')
      .setDescription("Show a team's next game")
      .addStringOption(opt => opt.setName('team').setDescription('Team name').setRequired(true)),
    new SlashCommandBuilder()
      .setName('score')
      .setDescription('Record a match result (admin only)')
      .addStringOption(opt => opt.setName('home_team').setDescription('Home team name').setRequired(true))
      .addIntegerOption(opt => opt.setName('home_goals').setDescription('Home team goals').setRequired(true))
      .addStringOption(opt => opt.setName('away_team').setDescription('Away team name').setRequired(true))
      .addIntegerOption(opt => opt.setName('away_goals').setDescription('Away team goals').setRequired(true)),
  ];

  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, GUILD_ID),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log('Slash commands registered');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
}

// ─── Ensure Schedule/Standings Channels ──────────────────
async function ensureChannels() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  for (const key of ['schedule', 'standings']) {
    let channelId = db.getDiscordChannel(key);
    if (channelId) {
      const existing = guild.channels.cache.get(channelId);
      if (existing) continue;
    }
    // Create channel
    try {
      const channel = await guild.channels.create({
        name: key,
        type: ChannelType.GuildText,
        reason: 'Soccer League bot auto-create'
      });
      db.setDiscordChannel(key, channel.id);
      console.log(`Created #${key} channel: ${channel.id}`);
    } catch (err) {
      console.error(`Failed to create #${key}:`, err);
    }
  }
}

// ─── Command Handler ─────────────────────────────────────
async function handleCommand(interaction) {
  const season = db.getActiveSeason();
  if (!season) {
    return interaction.reply({ content: 'No active season found.', ephemeral: true });
  }

  switch (interaction.commandName) {
    case 'standings': return cmdStandings(interaction, season);
    case 'schedule': return cmdSchedule(interaction, season);
    case 'results': return cmdResults(interaction, season);
    case 'teams': return cmdTeams(interaction, season);
    case 'nextgame': return cmdNextGame(interaction, season);
    case 'score': return cmdScore(interaction, season);
  }
}

async function cmdStandings(interaction, season) {
  const divFilter = interaction.options.getString('division');
  const divisions = db.getDivisions(season.id);

  const embeds = [];
  for (const div of divisions) {
    if (divFilter && !div.name.toLowerCase().includes(divFilter.toLowerCase())) continue;

    const standings = db.getStandings(season.id, div.id);
    let table = '```\n';
    table += 'Pos  Team             P   W  D  L  GF GA GD  Pts\n';
    table += '─'.repeat(52) + '\n';

    standings.forEach((row, i) => {
      const pos = String(i + 1).padStart(2);
      const name = row.name.substring(0, 16).padEnd(16);
      const p = String(row.played).padStart(2);
      const w = String(row.wins).padStart(2);
      const d = String(row.draws).padStart(2);
      const l = String(row.losses).padStart(2);
      const gf = String(row.goals_for).padStart(3);
      const ga = String(row.goals_against).padStart(3);
      const gd = (row.goal_diff >= 0 ? '+' : '') + String(row.goal_diff);
      const pts = String(row.points).padStart(3);
      const qualify = i < 4 ? ' *' : '';
      table += `${pos}. ${getEmoji(row.color_hex)} ${name} ${p}  ${w} ${d} ${l} ${gf} ${ga} ${gd.padStart(3)} ${pts}${qualify}\n`;
    });
    table += '```\n* = playoff qualifying';

    embeds.push(new EmbedBuilder()
      .setTitle(div.name)
      .setDescription(table)
      .setColor(0x667eea)
    );
  }

  if (embeds.length === 0) {
    return interaction.reply({ content: 'No matching division found.', ephemeral: true });
  }
  return interaction.reply({ embeds });
}

async function cmdSchedule(interaction, season) {
  const games = db.getUpcomingGames(season.id, 21);
  if (games.length === 0) {
    return interaction.reply({ content: 'No upcoming games found.', ephemeral: true });
  }

  let text = '';
  let currentDate = '';
  for (const g of games) {
    if (g.match_day !== currentDate) {
      currentDate = g.match_day;
      const dateObj = new Date(g.match_day + 'T12:00:00');
      text += `\n**${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}**\n`;
    }
    const prefix = g.is_playoff ? '\u{1F3C6} ' : '';
    text += `${prefix}${getEmoji(g.home_color)} ${g.home_name} vs ${getEmoji(g.away_color)} ${g.away_name}\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle('Upcoming Games')
    .setDescription(text.substring(0, 4096))
    .setColor(0x667eea);

  return interaction.reply({ embeds: [embed] });
}

async function cmdResults(interaction, season) {
  const results = db.getRecentResults(season.id, 15);
  if (results.length === 0) {
    return interaction.reply({ content: 'No results yet.', ephemeral: true });
  }

  let text = '';
  for (const g of results) {
    const prefix = g.is_playoff ? '\u{1F3C6} ' : '';
    text += `${prefix}${getEmoji(g.home_color)} **${g.home_name}** ${g.home_score} - ${g.away_score} **${g.away_name}** ${getEmoji(g.away_color)}\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle('Recent Results')
    .setDescription(text.substring(0, 4096))
    .setColor(0x667eea);

  return interaction.reply({ embeds: [embed] });
}

async function cmdTeams(interaction, season) {
  const divisions = db.getDivisions(season.id);
  const embeds = [];

  for (const div of divisions) {
    const teams = db.getTeamsForDivision(season.id, div.id);
    let text = '';
    for (const t of teams) {
      text += `${getEmoji(t.color_hex)} **${t.name}** (${t.short_name}) — ${t.color_name}\n`;
    }
    embeds.push(new EmbedBuilder()
      .setTitle(div.name)
      .setDescription(text)
      .setColor(0x667eea)
    );
  }

  return interaction.reply({ embeds });
}

async function cmdNextGame(interaction, season) {
  const teamName = interaction.options.getString('team');
  const team = db.getTeamByName(teamName);

  if (!team) {
    return interaction.reply({ content: `No team found matching "${teamName}".`, ephemeral: true });
  }

  const game = db.getNextGameForTeam(team.id, season.id);
  if (!game) {
    return interaction.reply({ content: `No upcoming games for ${team.name}.`, ephemeral: true });
  }

  const dateObj = new Date(game.match_day + 'T12:00:00');
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isHome = game.home_team_id === team.id;

  const embed = new EmbedBuilder()
    .setTitle(`Next Game: ${team.name}`)
    .setDescription(
      `**${game.home_name}** vs **${game.away_name}**\n` +
      `${dateStr}\n` +
      `${team.name} plays ${isHome ? 'at home' : 'away'}`
    )
    .setColor(0x667eea);

  return interaction.reply({ embeds: [embed] });
}

async function cmdScore(interaction, season) {
  // Admin check
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: 'You need Manage Server permission to record scores.', ephemeral: true });
  }

  const homeName = interaction.options.getString('home_team');
  const homeGoals = interaction.options.getInteger('home_goals');
  const awayName = interaction.options.getString('away_team');
  const awayGoals = interaction.options.getInteger('away_goals');

  const homeTeam = db.getTeamByName(homeName);
  const awayTeam = db.getTeamByName(awayName);

  if (!homeTeam || !awayTeam) {
    return interaction.reply({ content: 'Could not find one or both teams.', ephemeral: true });
  }

  // Find the matching unplayed game
  const game = db.db.prepare(`
    SELECT g.id FROM games g
    WHERE g.season_id = ? AND g.played = 0
      AND g.home_team_id = ? AND g.away_team_id = ?
    ORDER BY g.match_day LIMIT 1
  `).get(season.id, homeTeam.id, awayTeam.id);

  if (!game) {
    return interaction.reply({ content: 'No matching unplayed game found.', ephemeral: true });
  }

  db.recordResult(game.id, homeGoals, awayGoals);
  const recorded = db.getGameById(game.id);

  let color = 0xf39c12; // draw
  if (homeGoals > awayGoals) color = 0x2ecc71;
  if (homeGoals < awayGoals) color = 0xe74c3c;

  const embed = new EmbedBuilder()
    .setTitle('Result Recorded')
    .setDescription(
      `**${recorded.home_name}** ${homeGoals} - ${awayGoals} **${recorded.away_name}**\n` +
      `${recorded.division_name}`
    )
    .setColor(color);

  await interaction.reply({ embeds: [embed] });

  // Post to league chat
  await postToChannel(LEAGUE_CHAT_ID, { embeds: [embed] });
}

// ─── Onboarding ─────────────────────────────────────────
async function ensureRoles() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const allRoles = [...ROLE_GROUPS.gender, ...ROLE_GROUPS.experience, ...ROLE_GROUPS.position];

  // Also ensure a role for every active team
  const season = db.getActiveSeason();
  if (season) {
    const teams = db.getAllTeams(season.id);
    for (const t of teams) allRoles.push(t.name);
  }

  for (const roleName of allRoles) {
    if (!guild.roles.cache.find(r => r.name === roleName)) {
      try {
        await guild.roles.create({ name: roleName, reason: 'Soccer League onboarding' });
        console.log(`Created role: ${roleName}`);
      } catch (err) {
        console.error(`Failed to create role ${roleName}:`, err.message);
      }
    }
  }
}

async function sendWelcome(member) {
  const embed = new EmbedBuilder()
    .setTitle(`Welcome, ${member.displayName}!`)
    .setDescription(
      'Welcome to the soccer league! Please answer the quick questions below so we can get you sorted.\n\n' +
      '**1.** What is your gender? *(for coed purposes)*\n' +
      '**2.** What is your playing experience/ability?\n' +
      '**3.** What roles/positions are you most comfortable in?\n' +
      '**4.** What team(s) are you on?'
    )
    .setColor(0x667eea);

  const genderRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('role_gender_Male').setLabel('Male').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('role_gender_Female').setLabel('Female').setStyle(ButtonStyle.Primary)
  );

  const experienceRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('role_experience')
      .setPlaceholder('Select your playing experience...')
      .addOptions(
        { label: 'Just Starting', value: 'Just Starting' },
        { label: 'Played as a Kid', value: 'Played as a Kid' },
        { label: 'Played in High School', value: 'Played in High School' },
        { label: 'Played in College', value: 'Played in College' },
        { label: 'Played Pro/Semi-Pro', value: 'Played Pro/Semi-Pro' },
      )
  );

  const positionRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('role_position')
      .setPlaceholder('Select your preferred positions (pick all that apply)...')
      .setMinValues(1)
      .setMaxValues(4)
      .addOptions(
        { label: 'GK', description: 'Goalkeeper', value: 'GK' },
        { label: 'DEF', description: 'Defender', value: 'DEF' },
        { label: 'MID', description: 'Midfielder', value: 'MID' },
        { label: 'FW', description: 'Forward', value: 'FW' },
      )
  );

  const components = [genderRow, experienceRow, positionRow];

  // Build team select menu from active teams
  const season = db.getActiveSeason();
  if (season) {
    const teams = db.getAllTeams(season.id);
    if (teams.length > 0) {
      const teamRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('role_team')
          .setPlaceholder('What team(s) are you on? (select all that apply)')
          .setMinValues(1)
          .setMaxValues(Math.min(teams.length, 25))
          .addOptions(teams.map(t => ({
            label: t.name,
            description: t.division_name,
            value: t.name,
          })))
      );
      components.push(teamRow);
    }
  }

  await postToChannel(LEAGUE_CHAT_ID, {
    content: `Welcome ${member}!`,
    embeds: [embed],
    components,
  });
}

async function assignRoles(interaction, group, selectedValues) {
  const guild = interaction.guild || client.guilds.cache.get(GUILD_ID);
  if (!guild) return interaction.reply({ content: 'Something went wrong.', ephemeral: true });

  const member = await guild.members.fetch(interaction.user.id);

  // Remove any existing roles in this group first
  for (const roleName of ROLE_GROUPS[group]) {
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
    }
  }

  // Assign selected roles
  const added = [];
  for (const value of selectedValues) {
    const role = guild.roles.cache.find(r => r.name === value);
    if (role) {
      await member.roles.add(role);
      added.push(role.name);
    }
  }

  const labels = { gender: 'Gender', experience: 'Experience', position: 'Position(s)' };
  await interaction.reply({ content: `${labels[group]} set: **${added.join(', ')}**`, ephemeral: true });
}

async function assignTeamRoles(interaction, teamNames) {
  const guild = interaction.guild || client.guilds.cache.get(GUILD_ID);
  if (!guild) return interaction.reply({ content: 'Something went wrong.', ephemeral: true });

  const member = await guild.members.fetch(interaction.user.id);
  const season = db.getActiveSeason();
  if (!season) return interaction.reply({ content: 'No active season.', ephemeral: true });

  const allTeams = db.getAllTeams(season.id);

  // Remove all existing team roles first
  for (const team of allTeams) {
    const role = guild.roles.cache.find(r => r.name === team.name);
    if (role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
    }
  }

  // Add selected team roles + welcome in each team channel
  const added = [];
  for (const teamName of teamNames) {
    const role = guild.roles.cache.find(r => r.name === teamName);
    if (role) {
      await member.roles.add(role);
      added.push(teamName);
    }

    const team = allTeams.find(t => t.name === teamName);
    if (team && team.discord_channel_id) {
      const color = parseInt((team.color_hex || '#667eea').replace('#', ''), 16);
      const embed = new EmbedBuilder()
        .setDescription(`${getEmoji(team.color_hex)} **${member.displayName}** has joined **${team.name}**! Welcome to the squad!`)
        .setColor(color);
      await postToChannel(team.discord_channel_id, { embeds: [embed] });
    }
  }

  await interaction.reply({ content: `Team(s) set: **${added.join(', ')}**`, ephemeral: true });
}

// ─── Posting Helpers ─────────────────────────────────────
async function postToChannel(channelId, message) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) await channel.send(message);
  } catch (err) {
    console.error(`Failed to post to channel ${channelId}:`, err.message);
  }
}

async function postResult(game) {
  if (!client || !client.isReady()) return;

  let color = 0xf39c12;
  if (game.home_score > game.away_score) color = 0x2ecc71;
  if (game.home_score < game.away_score) color = 0xe74c3c;

  const embed = new EmbedBuilder()
    .setTitle('Match Result')
    .setDescription(
      `**${game.home_name}** ${game.home_score} - ${game.away_score} **${game.away_name}**\n` +
      `${game.division_name}`
    )
    .setColor(color);

  await postToChannel(LEAGUE_CHAT_ID, { embeds: [embed] });

  // Also post to division channel
  if (game.discord_chat_channel_id) {
    await postToChannel(game.discord_chat_channel_id, { embeds: [embed] });
  }
}

async function postStandings(seasonId) {
  if (!client || !client.isReady()) return;
  const channelId = db.getDiscordChannel('standings');
  if (!channelId) return;

  const divisions = db.getDivisions(seasonId);
  const embeds = [];

  for (const div of divisions) {
    const standings = db.getStandings(seasonId, div.id);
    let table = '```\n';
    table += 'Pos  Team             P   W  D  L  GF GA GD  Pts\n';
    table += '\u2500'.repeat(52) + '\n';

    standings.forEach((row, i) => {
      const pos = String(i + 1).padStart(2);
      const name = row.name.substring(0, 16).padEnd(16);
      table += `${pos}. ${name} ${String(row.played).padStart(2)}  ${String(row.wins).padStart(2)} ${String(row.draws).padStart(2)} ${String(row.losses).padStart(2)} ${String(row.goals_for).padStart(3)} ${String(row.goals_against).padStart(3)} ${((row.goal_diff >= 0 ? '+' : '') + row.goal_diff).padStart(3)} ${String(row.points).padStart(3)}\n`;
    });
    table += '```';

    embeds.push(new EmbedBuilder()
      .setTitle(div.name)
      .setDescription(table)
      .setColor(0x667eea)
    );
  }

  await postToChannel(channelId, { embeds });
}

async function postScheduleUpdate(seasonId) {
  if (!client || !client.isReady()) return;
  const channelId = db.getDiscordChannel('schedule');
  if (!channelId) return;

  const games = db.getUpcomingGames(seasonId, 21);
  if (games.length === 0) return;

  let text = '';
  let currentDate = '';
  for (const g of games) {
    if (g.match_day !== currentDate) {
      currentDate = g.match_day;
      const dateObj = new Date(g.match_day + 'T12:00:00');
      text += `\n**${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}**\n`;
    }
    text += `${getEmoji(g.home_color)} ${g.home_name} vs ${getEmoji(g.away_color)} ${g.away_name}\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle('Upcoming Schedule')
    .setDescription(text.substring(0, 4096))
    .setColor(0x667eea);

  await postToChannel(channelId, { embeds: [embed] });
}

// ─── Weekly Auto-post ────────────────────────────────────
function startWeeklyPosts() {
  setInterval(() => {
    const now = new Date();
    if (now.getDay() === 1 && now.getHours() === 9 && now.getMinutes() === 0) {
      const season = db.getActiveSeason();
      if (season) {
        postScheduleUpdate(season.id);
        postStandings(season.id);
      }
    }
  }, 60000); // Check every minute
}

module.exports = {
  createBot,
  postResult,
  postStandings,
  postScheduleUpdate,
  startWeeklyPosts,
  getClient: () => client,
};
