import WebSocket from 'ws';
import { processMatchEvent } from './engine.js';

// The WebSocket URL provided by TXOdds for their Live Feed (Tx Fusion, etc.)
const TXODDS_WS_URL = process.env.TXODDS_WS_URL || 'wss://feed.txodds.com/live'; 

export const connectTxOddsStream = () => {
  const ws = new WebSocket(TXODDS_WS_URL, {
    headers: {
      'Authorization': `Bearer ${process.env.TXLINE_API_KEY || process.env.TXODDS_API_KEY || 'demo_key'}`
    }
  });

  ws.on('open', () => {
    console.log(`[TXOdds] Connected to live WebSocket stream at ${TXODDS_WS_URL}`);
    // Subscribe to specific matches if the TXOdds API requires it
    // ws.send(JSON.stringify({ action: 'subscribe', matches: ['all'] }));
  });

  ws.on('message', async (data) => {
    try {
      const payload = JSON.parse(data.toString());
      
      // Filter for actual match events (e.g., goals, cards, FT) from the TXOdds feed
      if (payload.match_id && payload.event_type) {
        console.log(`[TXOdds] Live Event Received: ${payload.event_type} for match ${payload.match_id}`);
        
        // Map the proprietary TXOdds payload format to our engine's expected format
        const engineEvent = {
          match_id: payload.match_id,
          event: payload.event_type,
          minute: payload.minute,
          score: payload.score || null,
          scorer: payload.player_name || null
        };
        
        await processMatchEvent(engineEvent.match_id, engineEvent);
      }
    } catch (err) {
      console.error('[TXOdds] Error parsing stream data:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[TXOdds] WebSocket disconnected. Attempting to reconnect in 5 seconds...');
    // Auto-reconnect logic to ensure we never miss a live goal
    setTimeout(connectTxOddsStream, 5000);
  });

  ws.on('error', (err) => {
    console.error('[TXOdds] WebSocket Error:', err.message);
  });
};
