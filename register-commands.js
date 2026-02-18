require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const GUILD_ID = '1391648870278369350';

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

async function main() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_APP_ID || 'auto', GUILD_ID),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log('Commands registered successfully!');
  } catch (err) {
    console.error('Failed:', err);
  }
}

main();
