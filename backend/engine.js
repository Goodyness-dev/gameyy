import { supabase } from './db.js';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import bs58 from 'bs58';export const handleGoalEvent = async (event, matchId) => {
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

  // Evaluate Over 2.5 immediately if the 3rd goal is scored
  if (totalGoals === 3) {
    await evaluatePicks(matchId, 'goals', 'Over 2.5');
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
  
  // Trigger Escrow Payouts to update DB balances
  const winners = await executePayouts(matchId);

  // Update match status to finished so we don't double count in live bonus
  await supabase.from('matches').update({ status: 'finished' }).eq('id', matchId);

  // Recalculate leaderboards AFTER balances are updated
  await recalculateLeaderboards(matchId);

  return winners;
};

const executePayouts = async (matchId) => {
  console.log(`\n[ESCROW] Executing automated payouts for match ${matchId}...`);
  
  const privateKeyString = process.env.TREASURY_PRIVATE_KEY;
  const canMint = privateKeyString && !privateKeyString.includes('your_');
  let treasuryKeypair;
  const winnersList = [];

  if (!canMint) {
    console.log('[ESCROW] ⚠️ No valid TREASURY_PRIVATE_KEY in .env. Will skip on-chain mints, but WILL update DB balances.');
  } else {
    try {
      treasuryKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyString));
    } catch(e) {
      console.error("[ESCROW] ❌ Invalid TREASURY_PRIVATE_KEY formatting.");
    }
  }

  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // 1. Fetch all predictions for this match
  const { data: predictions } = await supabase
    .from('predictions')
    .select('id, member_id, picks, wager_amount, members(wallet_address, balance, group_id, telegram_username)')
    .eq('match_id', matchId);

  if (!predictions || predictions.length === 0) return winnersList;

  const mintAddress = process.env.PULSE_TOKEN_MINT;
  const mintPubkey = mintAddress ? new PublicKey(mintAddress) : null;
  if (!mintPubkey) console.log('[ESCROW] ❌ No PULSE_TOKEN_MINT found in .env. Skipping mint.');

  const memberPayouts = {};

  // 2. Evaluate winners and calculate payouts
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

    if (allResolved && totalOdds > 0) {
       const payoutAmount = pred.wager_amount * totalOdds;
       
       if (!memberPayouts[pred.member_id]) {
         memberPayouts[pred.member_id] = {
           payout: 0,
           username: pred.members.telegram_username,
           wallet_address: pred.members.wallet_address,
           oldBalance: parseFloat(pred.members.balance || 0),
           group_id: pred.members.group_id
         };
       }
       memberPayouts[pred.member_id].payout += payoutAmount;
    } else {
       console.log(`[ESCROW] Prediction ${pred.id} lost or still pending.`);
    }
  }

  const winnersByGroup = {};

  // 3. Execute payouts and DB updates once per winning member
  for (const memberId of Object.keys(memberPayouts)) {
    const data = memberPayouts[memberId];
    console.log(`[ESCROW] Winner found! ${data.wallet_address} won ${data.payout.toFixed(2)} PULSE in group ${data.group_id}`);
    
    if (!winnersByGroup[data.group_id]) winnersByGroup[data.group_id] = {};
    if (!winnersByGroup[data.group_id][data.username]) winnersByGroup[data.group_id][data.username] = 0;
    winnersByGroup[data.group_id][data.username] += data.payout;

    // Update DB balance always (preventing race conditions by doing it once)
    await supabase.from('members').update({ balance: data.oldBalance + data.payout }).eq('id', memberId);

    if (canMint && treasuryKeypair && mintPubkey) {
      try {
        const userPubkey = new PublicKey(data.wallet_address);
        const userAta = await getOrCreateAssociatedTokenAccount(connection, treasuryKeypair, mintPubkey, userPubkey);
        const signature = await mintTo(connection, treasuryKeypair, mintPubkey, userAta.address, treasuryKeypair.publicKey, Math.floor(data.payout * 100));
        console.log(`✅ [SUCCESS] Tokens minted! Sig: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      } catch (err) {
        console.error(`❌ [ERROR] Failed to mint payout to ${data.wallet_address}:`, err.message);
      }
    }
  }

  const finalWinnersByGroup = {};
  for (const groupId of Object.keys(winnersByGroup)) {
    finalWinnersByGroup[groupId] = Object.keys(winnersByGroup[groupId]).map(u => ({ username: u, payout: winnersByGroup[groupId][u] }));
  }
  return finalWinnersByGroup;
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

export const recalculateLeaderboards = async (matchId) => {
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
    
    // Calculate live bonus from active predictions
    const { data: livePreds } = await supabase
      .from('predictions')
      .select('wager_amount, net_points, matches!inner(status)')
      .eq('member_id', memberId)
      .neq('matches.status', 'finished');
      
    let liveBonus = 0;
    if (livePreds) {
       livePreds.forEach(pred => {
          liveBonus += (parseFloat(pred.wager_amount) || 0) * (parseFloat(pred.net_points) || 0);
       });
    }

    const liveTotal = (parseFloat(m.balance) || 0) + liveBonus;

    await supabase
      .from('leaderboard')
      .update({ total_pts: Math.round(liveTotal * 100) })
      .eq('member_id', memberId)
      .eq('group_id', memberGroups[memberId]);
  }
};
