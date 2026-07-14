import { supabase } from './db.js';
import { handleGoalEvent } from './engine.js';
import { v4 as uuidv4 } from 'uuid';

(async () => {
  try {
    console.log("Setting up test...");
    // 1. Create group
    const groupId = uuidv4();
    await supabase.from('groups').insert([{ id: groupId, name: 'Test Group', invite_code: 'TEST01', created_by: 'wallet1' }]);

    // 2. Create member
    const memberId = uuidv4();
    await supabase.from('members').insert([{ id: memberId, group_id: groupId, wallet_address: 'wallet1', balance: 90 }]);

    // 3. Create leaderboard
    await supabase.from('leaderboard').insert([{ group_id: groupId, member_id: memberId, total_pts: 9000 }]);

    // 4. Create match
    const matchId = uuidv4();
    await supabase.from('matches').insert([{ id: matchId, txline_id: 'test-match', home_team: 'A', away_team: 'B', kickoff_time: new Date().toISOString() }]);

    // 5. Create prediction
    const picks = [
      { market: 'result', selection: 'Home Win', odds: 2.6, status: 'pending', points_awarded: 0 },
      { market: 'btts', selection: 'Yes', odds: 1.85, status: 'pending', points_awarded: 0 },
      { market: 'goals', selection: 'Over 2.5', odds: 2.1, status: 'pending', points_awarded: 0 }
    ];
    await supabase.from('predictions').insert([{
      member_id: memberId,
      match_id: matchId,
      picks: picks,
      wager_amount: 10,
      net_points: 0
    }]);

    console.log("Test data inserted. Firing 3 goals...");
    
    await handleGoalEvent({ scorer: 'Player 1', minute: 10, score: { home: 1, away: 0 } }, matchId);
    await handleGoalEvent({ scorer: 'Player 2', minute: 20, score: { home: 2, away: 0 } }, matchId);
    await handleGoalEvent({ scorer: 'Player 3', minute: 30, score: { home: 2, away: 1 } }, matchId);
    
    console.log("Goals fired. Checking leaderboard...");
    const { data } = await supabase.from('leaderboard').select('*').eq('member_id', memberId).single();
    console.log("Final Leaderboard:", data);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
