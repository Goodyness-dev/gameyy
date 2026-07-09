import { getMatchEvents } from './txline.js';
import { handleGoalEvent, handleMatchEnd } from './engine.js';
import { supabase } from './db.js';

// Poll every 60 seconds (Free tier TxLINE standard)
const POLL_INTERVAL = 60000; 

// Simple memory store to prevent processing the same action twice
const processedActionIds = new Set();

export const startTxOddsPoller = () => {
  console.log('[TxLINE] Starting Live Scores Poller (60s intervals)');
  
  setInterval(async () => {
    try {
      // 1. Get all matches that are currently live (or scheduled but might have started)
      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .neq('status', 'completed');

      if (!matches || matches.length === 0) return;

      for (const match of matches) {
        if (!match.txline_id || match.txline_id.startsWith('demo-')) continue;
        
        // 2. Fetch the latest snapshots for the fixture
        const snapshots = await getMatchEvents(match.txline_id);
        
        if (snapshots && Array.isArray(snapshots) && snapshots.length > 0) {
           // Iterate through recent snapshots (TxLINE returns an array of actions)
           for (const action of snapshots) {
             
             // Check if we've already processed this exact event (using TxLINE's unique ID)
             if (processedActionIds.has(action.id)) continue;
             processedActionIds.add(action.id);
             
             // Check if it's a critical game event
             const isGoal = action.action === 'Goal' || (action.dataSoccer && action.dataSoccer.Goal);
             const isMatchEnd = action.gameState === 'Ended' || action.action === 'MatchEnd';
             
             if (isGoal || isMatchEnd) {
               console.log(`[TxLINE Poller] Detected new ${action.action || 'Event'} for match ${match.txline_id}`);
               
               // Map to our engine's expected format
               const engineEvent = {
                 match_id: match.id,
                 event: isGoal ? 'GOAL' : 'MATCH_END',
                 minute: action.clock?.seconds ? Math.floor(action.clock.seconds / 60) : 90,
                 score: action.scoreSoccer ? {
                   home: action.scoreSoccer.Participant1?.Total?.Goals || 0,
                   away: action.scoreSoccer.Participant2?.Total?.Goals || 0
                 } : null,
                 scorer: action.dataSoccer?.PlayerId ? `Player #${action.dataSoccer.PlayerId}` : null
               };
               
               if (isGoal) {
                 await handleGoalEvent(match.id, engineEvent.score);
               } else if (isMatchEnd) {
                 await handleMatchEnd(match.id);
               }
             }
           }
        }
      }
    } catch (err) {
      console.error('[TxLINE Poller] Error polling data:', err.message);
    }
  }, POLL_INTERVAL);
};
