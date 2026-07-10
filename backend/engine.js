import { supabase } from './db.js';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import bs58 from 'bs58';
import { broadcastWinner } from './bot.js';

export const handleGoalEvent = async (event, matchId) => {
  console.log(`[TxLINE EVENT] Goal! Scorer: ${event.scorer}, Minute: ${event.minute}, Score: ${event.score.home}-${event.score.away}`);
  
  await supabase.from('matches').update({ result: event.score }).eq('id', matchId);

  const totalGoals = event.score.home + event.score.away;
  const isBTTS = event.score.home > 0 && event.score.away > 0;

  // We will evaluate parlays. For the demo, we'll evaluate First Scorer immediately if totalGoals === 1.
  // Full match results are evaluated on 'match_end' event (handled below).
  if (totalGoals === 1) {
    await evaluatePicks(matchId, 'scorer', event.scorer);
  }

  // Evaluate BTTS if it just hit
  if (isBTTS && (totalGoals === 2 || (event.score.home === 1 && event.score.away === 1))) {
    await evaluatePicks(matchId, 'btts', 'Yes');
  }

  await recalculateLeaderboards(matchId);
};

export const handleMatchEnd = async (matchId, finalScore) => {
  const totalGoals = finalScore.home + finalScore.away;
  
  // Evaluate Result Pick
  let result = 'Draw';
  if (finalScore.home > finalScore.away) result = 'Home Win';
  if (finalScore.away > finalScore.home) result = 'Away Win';
  await evaluatePicks(matchId, 'result', result);

  // Evaluate Over/Under 2.5
  const goalsPick = totalGoals > 2.5 ? 'Over 2.5' : 'Under 2.5';
  await evaluatePicks(matchId, 'goals', goalsPick);
  
  // Also anyone who picked BTTS 'No' won if it didn't hit, lost if it did.
  // Anyone who picked wrong scorer lost.
  // For simplicity in this demo hackathon script, evaluatePicks handles both Won and Lost status based on correctValue.
  
  await recalculateLeaderboards(matchId);

  // Trigger Escrow Payouts
  await executePayouts(matchId);
};

const executePayouts = async (matchId) => {
  console.log(`\n[ESCROW] Executing automated payouts for match ${matchId}...`);
  
  const privateKeyString = process.env.TREASURY_PRIVATE_KEY;
  if (!privateKeyString || privateKeyString.includes('your_')) {
    console.log('[ESCROW] ❌ No valid TREASURY_PRIVATE_KEY in .env. Skipping actual on-chain payouts.');
    return;
  }

  let treasuryKeypair;
  try {
    treasuryKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyString));
  } catch(e) {
    console.error("[ESCROW] ❌ Invalid TREASURY_PRIVATE_KEY formatting.");
    return;
  }

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // 1. Fetch all predictions for this match
  const { data: predictions } = await supabase
    .from('predictions')
    .select('id, member_id, picks, wager_amount, members(wallet_address, balance, group_id, telegram_username)')
    .eq('match_id', matchId);

  if (!predictions || predictions.length === 0) return;

  const mintAddress = process.env.PULSE_TOKEN_MINT;
  if (!mintAddress) {
     console.log('[ESCROW] ❌ No PULSE_TOKEN_MINT found in .env');
     return;
  }
  const mintPubkey = new PublicKey(mintAddress);

  // 2. Evaluate winners and pay out
  for (const pred of predictions) {
    if (!pred.picks || !pred.wager_amount) continue;

    let totalOdds = 0;
    let allResolved = true;

    for (const p of pred.picks) {
      if (p.status === 'pending') {
        allResolved = false;
      } else if (p.status === 'won') {
        totalOdds += parseFloat(p.odds);
      } else if (p.status === 'lost') {
        totalOdds -= parseFloat(p.odds);
      }
    }

    // Only payout if all picks are resolved and the total odds sum is positive
    if (allResolved && totalOdds > 0) {
       const payoutAmount = pred.wager_amount * totalOdds;
       console.log(`[ESCROW] Winner found! ${pred.members.wallet_address} won ${payoutAmount.toFixed(2)} PULSE`);

       try {
         const userPubkey = new PublicKey(pred.members.wallet_address);
         const userAta = await getOrCreateAssociatedTokenAccount(
           connection,
           treasuryKeypair,
           mintPubkey,
           userPubkey
         );

         // Mint winnings to user
         const signature = await mintTo(
           connection,
           treasuryKeypair,
           mintPubkey,
           userAta.address,
           treasuryKeypair.publicKey,
           Math.floor(payoutAmount * 100) // 2 decimals
         );
         
         console.log(`✅ [SUCCESS] Tokens minted! Sig: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

         // Update DB balance
         const currentBalance = parseFloat(pred.members.balance || 0);
         await supabase.from('members').update({ balance: currentBalance + payoutAmount }).eq('id', pred.member_id);

         // Broadcast
         const { data: groupData } = await supabase.from('groups').select('chat_id').eq('id', pred.members.group_id).single();
         if (groupData?.chat_id) {
           await broadcastWinner(groupData.chat_id, "The Match", [pred.members.telegram_username], payoutAmount);
         }
       } catch (err) {
         console.error(`❌ [ERROR] Failed to mint payout to ${pred.members.wallet_address}:`, err.message);
       }
    } else {
       console.log(`[ESCROW] Prediction ${pred.id} lost or still pending.`);
    }
  }
};

const evaluatePicks = async (matchId, market, correctValue) => {
  // Fetch all predictions for this match
  const { data: predictions } = await supabase
    .from('predictions')
    .select('id, picks, net_points')
    .eq('match_id', matchId);

  if (!predictions) return;

  for (const pred of predictions) {
    if (!Array.isArray(pred.picks)) {
       console.log(`[ENGINE] Skipping legacy prediction format for id: ${pred.id}`);
       continue;
    }

    let updated = false;
    let newNetPoints = pred.net_points || 0;
    
    const updatedPicks = pred.picks.map(pick => {
      if (pick.market === market && pick.status === 'pending') {
        updated = true;
        if (String(pick.selection).toLowerCase() === String(correctValue).toLowerCase()) {
          pick.status = 'won';
          pick.points_awarded = pick.odds;
          newNetPoints += pick.odds;
        } else {
          pick.status = 'lost';
          pick.points_awarded = -pick.odds;
          newNetPoints -= pick.odds;
        }
      }
      return pick;
    });

    if (updated) {
      await supabase
        .from('predictions')
        .update({ picks: updatedPicks, net_points: newNetPoints })
        .eq('id', pred.id);
    }
  }
};

const recalculateLeaderboards = async (matchId) => {
  // First, find all members who had predictions in this match
  const { data: affectedPredictions } = await supabase
    .from('predictions')
    .select('member_id, members(group_id)')
    .eq('match_id', matchId);

  if (!affectedPredictions || affectedPredictions.length === 0) return;

  const memberGroups = {};
  affectedPredictions.forEach(p => {
    memberGroups[p.member_id] = p.members.group_id;
  });

  const memberIds = Object.keys(memberGroups);

  // Then, fetch the balances directly from members table
  for (const memberId of memberIds) {
    const { data: m } = await supabase.from('members').select('balance').eq('id', memberId).single();
    await supabase
      .from('leaderboard')
      .update({ total_pts: Math.round((parseFloat(m.balance) || 0) * 100) })
      .eq('member_id', memberId)
      .eq('group_id', memberGroups[memberId]);
  }
};
