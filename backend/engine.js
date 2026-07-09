import { supabase } from './db.js';
import { Connection, Keypair, SystemProgram, Transaction, PublicKey, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
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

  // 1. Fetch all predictions for this match to identify groups
  const { data: predictions } = await supabase
    .from('predictions')
    .select('member_id, members(group_id, wallet_address, groups(entry_fee))')
    .eq('match_id', matchId);

  if (!predictions || predictions.length === 0) return;

  // 2. Group by group_id
  const groups = {};
  predictions.forEach(p => {
    const gId = p.members.group_id;
    if (!groups[gId]) {
      groups[gId] = { pool: 0, members: [], entry_fee: parseFloat(p.members.groups.entry_fee || 0) };
    }
    groups[gId].pool += parseFloat(p.members.groups.entry_fee || 0);
    groups[gId].members.push({ id: p.member_id, wallet: p.members.wallet_address });
  });

  // 3. For each group, find the winner(s) and pay them out
  for (const [groupId, groupData] of Object.entries(groups)) {
    if (groupData.pool <= 0) continue;

    const { data: lb } = await supabase
      .from('leaderboard')
      .select('member_id, total_pts, members(wallet_address)')
      .eq('group_id', groupId)
      .order('total_pts', { ascending: false });

    if (!lb || lb.length === 0) continue;

    const topScore = parseFloat(lb[0].total_pts) / 100;
    let payoutsToMake = [];

    if (topScore <= 0) {
      console.log(`[ESCROW] Group ${groupId}: Nobody won! (Top score is ${topScore}). Activating 80/20 refund logic.`);
      const refundAmount = groupData.entry_fee * 0.8;
      
      // Everyone gets 80% back
      for (const member of groupData.members) {
         payoutsToMake.push({ wallet: member.wallet, amount: refundAmount, reason: '80% Refund' });
      }
      console.log(`[ESCROW] Retaining 20% (${groupData.entry_fee * 0.2 * groupData.members.length} SOL) as protocol profit. 🤑`);

    } else {
      const winners = lb.filter(entry => (parseFloat(entry.total_pts) / 100) === topScore);
      const payoutPerWinner = groupData.pool / winners.length;
      console.log(`[ESCROW] Group ${groupId}: Total Pool ${groupData.pool} SOL. Winners: ${winners.length}. Payout: ${payoutPerWinner} SOL each.`);

      for (const winner of winners) {
         payoutsToMake.push({ wallet: winner.members.wallet_address, amount: payoutPerWinner, reason: 'Winner Payout' });
      }
    }

    // Execute the transactions on Solana
    for (const payout of payoutsToMake) {
      try {
        console.log(`[ESCROW TRANSACTION] Sending ${payout.amount} SOL to wallet ${payout.wallet}... (${payout.reason})`);
        
        const toPubkey = new PublicKey(payout.wallet);
        const lamports = Math.floor(payout.amount * LAMPORTS_PER_SOL);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: treasuryKeypair.publicKey,
            toPubkey,
            lamports,
          })
        );

        const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair]);
        console.log(`✅ [SUCCESS] Transaction confirmed! Signature: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        payout.signature = signature;
      } catch (err) {
        console.error(`❌ [ERROR] Failed to send payout to ${payout.wallet}:`, err.message);
      }
    }
    
    // Broadcast winner announcement
    const { data: groupDataFromDb } = await supabase.from('groups').select('chat_id').eq('id', groupId).single();
    const chatId = groupDataFromDb?.chat_id;
    if (chatId) {
      if (topScore <= 0) {
        await broadcastWinner(chatId, "The Match", [], 0);
      } else {
        // Find winner usernames
        const { data: winnerMembers } = await supabase
          .from('members')
          .select('id, user_id')
          .in('id', lb.filter(entry => (parseFloat(entry.total_pts) / 100) === topScore).map(w => w.member_id));
          
        const winnerNames = winnerMembers ? winnerMembers.map(w => w.user_id) : [];
        const payoutPerWinner = groupData.pool / winnerNames.length;
        await broadcastWinner(chatId, "The Match", winnerNames, payoutPerWinner);
      }
    }
    
    if (payoutsToMake.some(p => p.signature)) {
      const { data: matchObj } = await supabase.from('matches').select('result').eq('id', matchId).single();
      const resData = matchObj?.result || {};
      resData.payouts = resData.payouts || {};
      
      const sigsForGroup = payoutsToMake.filter(p => p.signature).map(p => p.signature);
      if (sigsForGroup.length > 0) {
        resData.payouts[groupId] = sigsForGroup[0]; // just grab the first valid signature for the group to link to
      }
      await supabase.from('matches').update({ result: resData }).eq('id', matchId);
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

  // Then, fetch ALL predictions for these members across ALL matches to sum their true total points
  const { data: allPredictions } = await supabase
    .from('predictions')
    .select('member_id, net_points')
    .in('member_id', memberIds);

  const memberPoints = {};
  memberIds.forEach(id => memberPoints[id] = 0);

  if (allPredictions) {
    allPredictions.forEach(p => {
      memberPoints[p.member_id] += (p.net_points || 0);
    });
  }

  // Update the leaderboard with the true total sum
  for (const memberId of memberIds) {
    await supabase
      .from('leaderboard')
      .update({ total_pts: Math.round(memberPoints[memberId] * 100) })
      .eq('member_id', memberId)
      .eq('group_id', memberGroups[memberId]);
  }
};
