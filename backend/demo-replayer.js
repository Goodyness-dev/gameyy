import { handleGoalEvent, handleMatchEnd } from './engine.js';
import { broadcastGoal, broadcastFlashMarket, resolveFlashMarket } from './bot.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOCK_MATCH_ID = 'demo-match-001';
const MOCK_CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'dummy_chat_id'; 

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
  
  if (!process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID.includes('dummy')) {
    console.error("❌ ERROR: TELEGRAM_CHAT_ID is missing or invalid in your .env file!");
    console.error("You must message the bot /start to get your Chat ID, and put it in .env!");
    return;
  }

  console.log('Simulating live match events every 10 seconds...');

  const matchData = loadMockData();
  const events = matchData.events;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    
    // Simulate real-time delay (e.g., 10 seconds between events in demo)
    await delay(10000); 

    console.log(`\n[MINUTE ${event.minute}] TxLINE Event Received: ${event.type.toUpperCase()}`);

    if (event.type === 'goal') {
      // 1. Process the goal in the game engine (updates DB & Leaderboard)
      await handleGoalEvent(event, MOCK_MATCH_ID);

      // 2. Mock discovering ruined predictions (In a real app, query the DB for picks against this)
      const mockRuinedUsers = event.ruined_users || [];

      // 3. Fire the Telegram Notification & Voice Note
      await broadcastGoal(MOCK_CHAT_ID, event, mockRuinedUsers);
    } else if (event.type === 'var_check') {
      await broadcastFlashMarket(MOCK_CHAT_ID, event, MOCK_MATCH_ID);
    } else if (event.type === 'var_result') {
      await resolveFlashMarket(MOCK_CHAT_ID, event, MOCK_MATCH_ID);
    } else if (event.type === 'match_end') {
      console.log('--- MATCH FINISHED ---');
      const finalScore = { home: 2, away: 2 }; // From our mock events
      await handleMatchEnd(MOCK_MATCH_ID, finalScore);
      // In a real app, calculate final points and transfer Solana prize pool here
    }
  }

  console.log('--- DEMO REPLAYER FINISHED ---');
};

// If run directly: node demo-replayer.js
if (process.argv[1] === __filename) {
  runDemo();
}
