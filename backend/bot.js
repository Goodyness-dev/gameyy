import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import { supabase } from './db.js';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as googleTTS from 'google-tts-api';
import { globalEvents } from './events.js';

dotenv.config(); console.log('bot.js executing, token:', process.env.TELEGRAM_BOT_TOKEN ? 'exists' : 'missing');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || 'dummy_token_for_dev');

// In-memory store for Hackathon Demo Flash Bets
const flashBets = {};

// Basic Commands
bot.start(async (ctx) => {
  const payload = ctx.startPayload || ctx.payload; // telegraf extracts the start/startgroup payload reliably
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
    
    return ctx.reply(`✅ Successfully linked this Telegram chat to Group ${inviteCode} on TxLINE Pulse! You will now receive live match events here.`);
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
  const templates = [
    `A calm and composed finish by ${scorer} in the ${minute}th minute. Beautiful play.`,
    `Brilliant execution! ${scorer} finds the back of the net at minute ${minute}.`,
    `What a fantastic strike from ${scorer} in the ${minute}th minute. Clinical finishing.`,
    `Goal! ${scorer} makes no mistake in the ${minute}th minute. Pure class.`,
    `A moment of magic from ${scorer} right on the ${minute}th minute mark. Incredible.`,
    `Textbook finishing! ${scorer} slots it home in the ${minute}th minute.`
  ];
  const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
  return randomTemplate;
};

/**
 * ElevenLabs TTS Audio Generation
 */
const generateGoalAudio = async (script) => {
  const apiKey = process.env.ELEVEN_LABS_KEY;
  const voiceId = process.env.ELEVEN_LABS_VOICE_ID || 'pNInz6obbfDQGcgMyIGb'; // Default Adam voice

  // Remove emojis from the text that will be spoken
  const speechText = script.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();

  // For local development/testing without burning credits, return a local mock file
  if (!apiKey || apiKey === 'your_elevenlabs_key') {
    console.log('[TTS MOCK] Playing mock audio for script:', speechText);
    try {
      // Use Google TTS to get a free audio URL of the text
      const url = googleTTS.getAudioUrl(speechText, {
        lang: 'en',
        slow: false,
        host: 'https://translate.google.com',
      });
      
      return { 
        url: url, // For Telegram
        webUrl: `http://localhost:3000/api/tts?text=${encodeURIComponent(speechText)}` // For Web
      };
    } catch(e) {
      // Fallback to cheering if text is too long or errors
      return { url: 'https://actions.google.com/sounds/v1/crowds/crowd_cheer.ogg' };
    }
  }

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: speechText,
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
export const broadcastGoal = async (chatIds, event, ruinedUsernames, matchName) => {
  const script = generateTrashTalk(event.scorer, event.minute, ruinedUsernames);
  const audio = await generateGoalAudio(script);

  // Broadcast to web SSE clients unconditionally
  globalEvents.emit('chat_message', {
    text: script,
    audioUrl: audio?.webUrl || audio?.url || (audio?.source ? `data:audio/mpeg;base64,${audio.source.toString('base64')}` : null),
    timestamp: new Date().toISOString(),
    matchName: matchName
  });

  const chatIdsArray = Array.isArray(chatIds) ? chatIds : [chatIds];

  for (const chatId of chatIdsArray) {
    // Send text first for speed
    try {
      await bot.telegram.sendMessage(chatId, `⚽ ${script}`);
      // Then send the voice note
      if (audio) {
        try {
          if (audio.source) {
            await bot.telegram.sendVoice(chatId, audio);
          } else if (audio.url) {
            await bot.telegram.sendVoice(chatId, { url: audio.url });
          }
        } catch(e) {
          console.error('Failed to send telegram voice:', e.message);
        }
      }
    } catch (e) { console.log("Bot broadcast failed (likely no valid token)"); }
  }
};

/**
 * Flash Markets logic
 */
export const broadcastFlashMarket = async (chatIds, event, matchId, matchName) => {
  console.log(`[FLASH MARKET] Triggering VAR check...`);
  const script = `🚨 VAR CHECK INITIATED 🚨\nPossible Penalty. Will it be given?`;
  const message = `${script}\n\nType YES or NO to make a 5 point Flash Prediction!`;

  const audio = await generateGoalAudio(script);

  // Broadcast to web SSE clients unconditionally
  globalEvents.emit('chat_message', {
    text: script,
    audioUrl: audio?.webUrl || audio?.url || (audio?.source ? `data:audio/mpeg;base64,${audio.source.toString('base64')}` : null),
    timestamp: new Date().toISOString(),
    matchName: matchName
  });

  const chatIdsArray = Array.isArray(chatIds) ? chatIds : [chatIds];

  for (const chatId of chatIdsArray) {
    try {
      await bot.telegram.sendMessage(chatId, message, Markup.inlineKeyboard([
        Markup.button.callback('Yes (+5 / -5 pts)', 'flash_var_yes'),
        Markup.button.callback('No (+5 / -5 pts)', 'flash_var_no')
      ]));
      
      if (audio) {
        try {
          if (audio.source) {
            await bot.telegram.sendVoice(chatId, audio);
          } else if (audio.url) {
            await bot.telegram.sendVoice(chatId, { url: audio.url });
          }
        } catch(e) {
          console.error('Failed to send telegram voice:', e.message);
        }
      }
    } catch (e) { console.error("Bot flash market failed:", e.message || e); }
  }
};

bot.action('flash_var_yes', (ctx) => {
  const user = ctx.from.username || ctx.from.first_name;
  flashBets[user] = 'yes';
  ctx.answerCbQuery('Prediction logged: YES');
  ctx.reply(`⚡ @${user} predicted YES.`);
});

bot.action('flash_var_no', (ctx) => {
  const user = ctx.from.username || ctx.from.first_name;
  flashBets[user] = 'no';
  ctx.answerCbQuery('Prediction logged: NO');
  ctx.reply(`⚡ @${user} predicted NO.`);
});

export const resolveFlashMarket = async (chatIds, event, matchId, matchName) => {
  console.log(`[FLASH MARKET] Resolving VAR check...`);
  const penaltyGiven = event.result === 'penalty_given';
  const winningChoice = penaltyGiven ? 'yes' : 'no';
  
  let resultMsg = `🛑 VAR REVIEW COMPLETE 🛑\nDecision: ${penaltyGiven ? 'PENALTY AWARDED!' : 'NO PENALTY.'}\n\n`;
  
  const winners = [];
  const losers = [];
  const winnerUsernames = [];
  
  for (const [user, choice] of Object.entries(flashBets)) {
    if (choice === winningChoice) {
      winners.push(`@${user}`);
      winnerUsernames.push(`@${user}`);
    } else {
      losers.push(`@${user}`);
    }
  }
  
  if (winners.length > 0) {
    resultMsg += `✅ Winners (+10 PULSE): ${winners.join(', ')}\n`;
    
    // Execute PULSE token mints for winners
    try {
      const privateKeyString = process.env.TREASURY_PRIVATE_KEY;
      const mintAddress = process.env.PULSE_TOKEN_MINT;
      
      if (privateKeyString && mintAddress) {
        const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyString));
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        const mintPubkey = new PublicKey(mintAddress);

        const { data: memberData } = await supabase.from('members').select('id, wallet_address, balance, telegram_username').in('telegram_username', winnerUsernames);
        
        if (memberData && memberData.length > 0) {
          for (const m of memberData) {
            try {
              const userPubkey = new PublicKey(m.wallet_address);
              const userAta = await getOrCreateAssociatedTokenAccount(
                connection, treasuryKeypair, mintPubkey, userPubkey, true, 'confirmed'
              );
              await mintTo(
                connection, treasuryKeypair, mintPubkey, userAta.address, treasuryKeypair.publicKey, 1000 // 10 PULSE * 10^2
              );
              const newBalance = parseFloat(m.balance || 0) + 10;
              await supabase.from('members').update({ balance: newBalance }).eq('id', m.id);
              // Leaderboard sync will happen automatically on next engine loop, or we could update it here.
              await supabase.from('leaderboard').update({ total_pts: newBalance * 100 }).eq('member_id', m.id);
            } catch (err) {
              console.error(`[FLASH ERROR] Failed to mint to ${m.wallet_address}:`, err.message);
            }
          }
        }
      }
    } catch (e) {
      console.error("[FLASH ERROR] Payout execution failed:", e.message);
    }
  }
  
  if (losers.length > 0) resultMsg += `❌ Losers (Missed out on 10 PULSE): ${losers.join(', ')}\n`;
  if (winners.length === 0 && losers.length === 0) resultMsg += `Nobody made a prediction!`;

  // Clear bets
  for (const key in flashBets) delete flashBets[key];

  // Broadcast to web SSE clients unconditionally
  globalEvents.emit('chat_message', {
    text: resultMsg,
    audioUrl: null,
    timestamp: new Date().toISOString(),
    matchName: matchName
  });

  const chatIdsArray = Array.isArray(chatIds) ? chatIds : [chatIds];
  for (const chatId of chatIdsArray) {
    try {
      await bot.telegram.sendMessage(chatId, resultMsg);
    } catch (e) { console.log("Bot resolve failed (likely no valid token)"); }
  }
};

export const broadcastMatchEnd = async (chatIds, matchName, finalScore, winners = []) => {
  let script = `🏁 FULL TIME! ${matchName} has officially ended. Final Score: ${finalScore.home} - ${finalScore.away}.`;

  if (winners && winners.length > 0) {
    const winnerTexts = winners.map(w => `@${(w.username || 'unknown').replace('@', '')} (+${w.payout.toFixed(2)} PULSE)`).join(', ');
    script += `\n\n🏆 Congratulations to our winners: ${winnerTexts}!`;
  } else {
    script += `\n\nSadly, nobody scored any points on this match. Better luck next time!`;
  }

  globalEvents.emit('chat_message', {
    text: script,
    audioUrl: null,
    timestamp: new Date().toISOString(),
    matchName: matchName
  });

  const chatIdsArray = Array.isArray(chatIds) ? chatIds : [chatIds];
  for (const chatId of chatIdsArray) {
    try {
      await bot.telegram.sendMessage(chatId, `🏁 ${script}`);
    } catch (e) { console.log("Bot match end broadcast failed"); }
  }
};

export const broadcastUpcomingMatches = async (chatId, matchCount) => {
  const script = `🚨 Alert! ${matchCount} new upcoming matches and their live odds are now available. Head over to the web dashboard to lock in your parlays before kickoff!`;
  
  const audio = await generateGoalAudio(script);

  globalEvents.emit('chat_message', {
    text: script,
    audioUrl: audio?.webUrl || audio?.url || (audio?.source ? `data:audio/mpeg;base64,${audio.source.toString('base64')}` : null),
    timestamp: new Date().toISOString()
  });

  try {
    await bot.telegram.sendMessage(chatId, `📅 ${script}`);
    if (audio) {
      if (audio.source) await bot.telegram.sendVoice(chatId, audio);
      else if (audio.url) await bot.telegram.sendVoice(chatId, { url: audio.url });
    }
  } catch (e) { console.log("Bot upcoming matches broadcast failed"); }
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
