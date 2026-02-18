require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const GUILD_ID = '1391648870278369350';
const LEAGUE_CHAT_ID = '1391648870915637260';
const DIV_CHANNELS = [
  '1391651423766450209', // Div 1
  '1391653124326035506', // Div 2
  '1391654937032659044', // Div 3
];

// Team channels
const TEAM_CHANNELS = [
  '1391656689312464976', '1391656727316791317', '1391656759151824956',
  '1391656787060457533', '1391656821021741079', '1391656845692764250',
  '1391656299690987600', '1391656344548933784', '1391656386374664204',
  '1391656438887219222', '1391656504523882566', '1391656555698585611',
  '1391655069006696448', '1391655133682602045', '1391655180688429076',
  '1391655210627104849', '1391655250510741624', '1391655300846583919',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clearChannel(client, channelId, label) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) { console.log(`  ${label}: channel not found`); return 0; }

    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const messages = await channel.messages.fetch({ limit: 100 });
      if (messages.size === 0) { hasMore = false; break; }

      // Filter to bot messages only
      const botMessages = messages.filter(m => m.author.id === client.user.id);
      if (botMessages.size === 0) { hasMore = false; break; }

      // bulkDelete only works on messages < 14 days old
      const now = Date.now();
      const recent = botMessages.filter(m => (now - m.createdTimestamp) < 14 * 24 * 60 * 60 * 1000);
      const old = botMessages.filter(m => (now - m.createdTimestamp) >= 14 * 24 * 60 * 60 * 1000);

      if (recent.size > 1) {
        try {
          await channel.bulkDelete(recent);
          totalDeleted += recent.size;
        } catch (e) {
          // Fall back to individual delete
          for (const [, msg] of recent) {
            try { await msg.delete(); totalDeleted++; await sleep(1000); } catch (err) { /* skip */ }
          }
        }
      } else if (recent.size === 1) {
        try { await recent.first().delete(); totalDeleted++; } catch (e) { /* skip */ }
      }

      // Delete old messages one by one
      for (const [, msg] of old) {
        try { await msg.delete(); totalDeleted++; await sleep(1000); } catch (e) { /* skip */ }
      }

      await sleep(1500); // Rate limit safety

      if (messages.size < 100) hasMore = false;
    }

    console.log(`  ${label}: deleted ${totalDeleted} bot messages`);
    return totalDeleted;
  } catch (err) {
    console.log(`  ${label}: error - ${err.message}`);
    return 0;
  }
}

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  await client.login(process.env.DISCORD_BOT_TOKEN);
  await new Promise(resolve => client.once('ready', resolve));
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Bot user ID: ${client.user.id}\n`);

  // Also find the auto-created schedule/standings channels from the DB
  const db = require('./database');
  const scheduleChannelId = db.getDiscordChannel('schedule');
  const standingsChannelId = db.getDiscordChannel('standings');

  const allChannels = [
    { id: LEAGUE_CHAT_ID, label: '#league-chat' },
    { id: DIV_CHANNELS[0], label: '#div-1-chat' },
    { id: DIV_CHANNELS[1], label: '#div-2-chat' },
    { id: DIV_CHANNELS[2], label: '#div-3-chat' },
  ];

  if (scheduleChannelId) allChannels.push({ id: scheduleChannelId, label: '#schedule' });
  if (standingsChannelId) allChannels.push({ id: standingsChannelId, label: '#standings' });

  // Add team channels
  TEAM_CHANNELS.forEach((id, i) => allChannels.push({ id, label: `team-channel-${i + 1}` }));

  let grandTotal = 0;
  console.log('Clearing bot messages from all channels...\n');

  for (const ch of allChannels) {
    const count = await clearChannel(client, ch.id, ch.label);
    grandTotal += count;
    await sleep(500);
  }

  console.log(`\nDone! Cleared ${grandTotal} total bot messages.`);

  client.destroy();
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
