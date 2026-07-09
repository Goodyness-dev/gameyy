import { handleGoalEvent, handleMatchEnd } from './engine.js';
import { broadcastGoal, broadcastFlashMarket, resolveFlashMarket } from './bot.js';
import { supabase } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOCK_MATCH_ID_1 = 'demo-match-001'; // arg-fra
const MOCK_MATCH_ID_2 = 'demo-match-002'; // bra-spa

const loadMockData = () => {
  const filePath = path.join(__dirname, 'mock-match.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const runDemo = async () => {
  console.log('--- STARTING TXLINE DEMO REPLAYER ---');
  
  if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN.includes('your_')) {
    console.error("❌ ERROR: TELEGRAM_BOT_TOKEN is missing or invalid in your .env file!");
    console.error("Please add the token from BotFather to .env before running the simulation.");
    return;
  }
  
  console.log('Fetching active Telegram Chat IDs from database...');
  const { data: groups, error } = await supabase.from('groups').select('chat_id').not('chat_id', 'is', null);
  
  if (error || !groups || groups.length === 0) {
    console.log("⚠️ WARNING: No groups found with a linked Telegram Chat ID in the database.");
    console.log("Create a group in the UI and link a Chat ID, or add a default TELEGRAM_CHAT_ID to .env if you just want to test globally.");
  }
  
  const chatIds = groups && groups.length > 0 
    ? [...new Set(groups.map(g => g.chat_id))] 
    : (process.env.TELEGRAM_CHAT_ID ? [process.env.TELEGRAM_CHAT_ID] : []);

  if (chatIds.length === 0) {
    console.error("❌ ERROR: No Telegram Chat IDs available to broadcast to. Exiting.");
    return;
  }

  console.log(`Found ${chatIds.length} unique Telegram communities to broadcast to.`);

  console.log('Resolving real Match UUIDs from database...');
  const { data: matchData1, error: matchErr1 } = await supabase.from('matches').select('id').eq('txline_id', MOCK_MATCH_ID_1).single();
  const { data: matchData2, error: matchErr2 } = await supabase.from('matches').select('id').eq('txline_id', MOCK_MATCH_ID_2).single();
  
  if (matchErr1 || !matchData1) return console.error(`❌ ERROR: Could not find match ${MOCK_MATCH_ID_1}`);
  if (matchErr2 || !matchData2) return console.error(`❌ ERROR: Could not find match ${MOCK_MATCH_ID_2}`);
  
  const realMatchId1 = matchData1.id;
  const realMatchId2 = matchData2.id;

  console.log('Simulating live match events every 10 seconds...');

  const matchDataJSON = loadMockData();
  const events1 = matchDataJSON.events;
  
  // Custom events for Brazil vs Spain
  const events2 = [
    { type: 'kickoff', minute: 1 },
    { type: 'goal', minute: 40, scorer: 'vinicius', score: { home: 1, away: 0 }, ruined_users: [] },
    { type: 'half_time', minute: 45 },
    { type: 'goal', minute: 90, scorer: 'morata', score: { home: 1, away: 1 }, ruined_users: [] },
    { type: 'match_end', minute: 90 }
  ];

  // Run them concurrently using Promise.all
  const simulateMatch = async (events, realMatchId, name) => {
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      await delay(10000); 

      console.log(`\n[${name} - MINUTE ${event.minute}] Event: ${event.type.toUpperCase()}`);

      if (event.type === 'goal') {
        await handleGoalEvent(event, realMatchId);
        for (const chatId of chatIds) await broadcastGoal(chatId, event, event.ruined_users || []);
      } else if (event.type === 'var_check') {
        for (const chatId of chatIds) await broadcastFlashMarket(chatId, event, realMatchId);
      } else if (event.type === 'var_result') {
        for (const chatId of chatIds) await resolveFlashMarket(chatId, event, realMatchId);
      } else if (event.type === 'match_end') {
        console.log(`--- ${name} FINISHED ---`);
        let finalScore = { home: 2, away: 2 }; // Default for arg-fra
        if (name === 'BRA-SPA') finalScore = { home: 1, away: 1 };
        await handleMatchEnd(realMatchId, finalScore);
      }
    }
  };

  await Promise.all([
    simulateMatch(events1, realMatchId1, 'ARG-FRA'),
    simulateMatch(events2, realMatchId2, 'BRA-SPA')
  ]);

  console.log('--- DEMO REPLAYER FINISHED ---');
};

// If run directly: node demo-replayer.js
if (process.argv[1] === __filename) {
  console.log("Triggering demo on the live server (so Web Chat works)...");
  axios.post('http://localhost:3000/api/demo/start')
    .then(() => console.log("✅ Demo triggered! Go look at your Web Dashboard!"))
    .catch(() => {
       console.log("⚠️ Server not running on 3000. Running demo in isolated terminal instead.");
       runDemo();
    });
}
