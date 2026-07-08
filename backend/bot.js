import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import { supabase } from './db.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'dummy_token_for_dev');

// In-memory store for Hackathon Demo Flash Bets
const flashBets = {};

// Basic Commands
bot.command('start', async (ctx) => {
  const payload = ctx.payload; // telegraf extracts the startgroup payload
  if (payload && payload.startsWith('LINK_')) {
    const inviteCode = payload.split('_')[1];
    
    const { data, error } = await supabase
      .from('groups')
      .update({ chat_id: ctx.chat.id })
      .eq('invite_code', inviteCode)
      .select();
      
    if (error || !data || data.length === 0) {
      return ctx.reply('❌ Failed to link group. Please check if the invite code is valid.');
    }
    
    return ctx.reply(`✅ Successfully linked this Telegram community to Group ${inviteCode} on TxLINE Pulse! You will now receive live match events here.`);
  }

  console.log("[TELEGRAM] Received /start from Chat ID:", ctx.chat.id);
  ctx.reply(`Welcome to TxLINE Pulse! 🏆\n\nLink your wallet and join a group on our web dashboard to start predicting.\n\n(Developer Note: Your Chat ID is ${ctx.chat.id} - Paste this into your .env file as TELEGRAM_CHAT_ID)`);
});

bot.command('leaderboard', async (ctx) => {
  // In a real flow, we'd look up the group associated with ctx.chat.id
  ctx.reply('🏆 Current Leaderboard:\n1. @goody - 5 pts\n2. @kemi - 2 pts');
});

/**
 * Generate AI Trash Talk Script
 * In a real app, this would hit OpenAI. For the hackathon demo, we use a dynamic template.
 */
const generateTrashTalk = (scorer, minute, ruinedPredictions) => {
  const ruinedText = ruinedPredictions.length > 0 
    ? `That completely ruins the prediction for ${ruinedPredictions.join(', ')}!` 
    : `A great pick for those who backed him.`;
    
  return `GOAL! ${scorer} finds the back of the net in the ${minute}th minute! ${ruinedText}`;
};

/**
 * ElevenLabs TTS Audio Generation
 */
const generateGoalAudio = async (script) => {
  const apiKey = process.env.ELEVEN_LABS_KEY;
  const voiceId = process.env.ELEVEN_LABS_VOICE_ID || 'pNInz6obbfDQGcgMyIGb'; // Default Adam voice

  // For local development/testing without burning credits, return a local mock file
  if (!apiKey || apiKey === 'your_elevenlabs_key') {
    console.log('[TTS MOCK] Playing mock audio for script:', script);
    // Instead of a local file, we return a public URL of a crowd cheering so Telegram can send it!
    return { url: 'https://actions.google.com/sounds/v1/crowds/crowd_cheer.ogg' };
  }

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: script,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.4, similarity_boost: 0.8 }
      },
      {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        responseType: 'arraybuffer'
      }
    );
    return { source: Buffer.from(response.data) };
  } catch (error) {
    console.error('ElevenLabs Error:', error.message);
    return null;
  }
};

/**
 * Triggered by the Engine when a goal happens
 */
export const broadcastGoal = async (chatId, event, ruinedUsernames) => {
  const script = generateTrashTalk(event.scorer, event.minute, ruinedUsernames);
  
  // Send text first for speed
  try {
    await bot.telegram.sendMessage(chatId, `⚽ ${script}`);
    // Then send the voice note
    const audio = await generateGoalAudio(script);
    if (audio) {
      await bot.telegram.sendVoice(chatId, audio);
    }
  } catch (e) { console.log("Bot broadcast failed (likely no valid token)"); }
};

/**
 * Flash Markets logic
 */
export const broadcastFlashMarket = async (chatId, event, matchId) => {
  console.log(`[FLASH MARKET] Triggering VAR check...`);
  const message = `🚨 VAR CHECK IN PROGRESS 🚨\n${event.description}\n\nWill a penalty be awarded? You have 30 seconds to vote. Risk: 5 points.`;
  
  try {
    await bot.telegram.sendMessage(chatId, message, Markup.inlineKeyboard([
      Markup.button.callback('Yes (+5 / -5 pts)', 'flash_var_yes'),
      Markup.button.callback('No (+5 / -5 pts)', 'flash_var_no')
    ]));
  } catch (e) { console.error("Bot flash market failed:", e.message || e); }
};

bot.action('flash_var_yes', (ctx) => {
  const user = ctx.from.username || ctx.from.first_name;
  flashBets[user] = 'yes';
  ctx.answerCbQuery('Bet placed: YES');
  ctx.reply(`⚡ @${user} bet YES.`);
});

bot.action('flash_var_no', (ctx) => {
  const user = ctx.from.username || ctx.from.first_name;
  flashBets[user] = 'no';
  ctx.answerCbQuery('Bet placed: NO');
  ctx.reply(`⚡ @${user} bet NO.`);
});

export const resolveFlashMarket = async (chatId, event, matchId) => {
  console.log(`[FLASH MARKET] Resolving VAR check...`);
  const penaltyGiven = event.result === 'penalty_given';
  const winningChoice = penaltyGiven ? 'yes' : 'no';
  
  let resultMsg = `🛑 VAR REVIEW COMPLETE 🛑\nDecision: ${penaltyGiven ? 'PENALTY AWARDED!' : 'NO PENALTY.'}\n\n`;
  
  const winners = [];
  const losers = [];
  
  for (const [user, choice] of Object.entries(flashBets)) {
    if (choice === winningChoice) {
      winners.push(`@${user}`);
      // In a real app, update DB points here via engine.js
    } else {
      losers.push(`@${user}`);
      // In a real app, update DB points here via engine.js
    }
  }
  
  if (winners.length > 0) resultMsg += `✅ Winners (+5 pts): ${winners.join(', ')}\n`;
  if (losers.length > 0) resultMsg += `❌ Losers (-5 pts): ${losers.join(', ')}\n`;
  if (winners.length === 0 && losers.length === 0) resultMsg += `Nobody placed a bet!`;

  // Clear bets
  for (const key in flashBets) delete flashBets[key];

  try {
    await bot.telegram.sendMessage(chatId, resultMsg);
  } catch (e) { console.log("Bot resolve failed (likely no valid token)"); }
};

// Start the bot if a real token is provided
if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token') {
  bot.launch().then(() => console.log('Telegram Bot running.')).catch(e => console.log('Telegram failed:', e.message));
} else {
  console.log('[BOT MOCK] Telegram Bot launch skipped (no valid token).');
}

// Enable graceful stop
process.once('SIGINT', () => {
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token') bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token') bot.stop('SIGTERM');
});
