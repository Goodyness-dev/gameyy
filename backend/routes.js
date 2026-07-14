import express from 'express';
import { supabase } from './db.js';
import { getMatches, getMatchById, getMatchOdds } from './txline.js';
import { handleGoalEvent, handleMatchEnd, recalculateLeaderboards } from './engine.js';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createMintToInstruction } from '@solana/spl-token';
import bs58 from 'bs58';
import * as googleTTS from 'google-tts-api';
import axios from 'axios';
import { broadcastUpcomingMatches } from './bot.js';

const router = express.Router();
const connection = new Connection('https://api.devnet.solana.com');

/**
 * @route GET /api/matches
 * @desc Get upcoming matches (Mock fallback if TxLINE API key missing)
 */
router.get('/matches', async (req, res) => {
  if (!process.env.TXLINE_API_KEY || process.env.TXLINE_API_KEY === 'your_txline_api_key') {
    return res.json([
      { id: 'demo-match-001', home: 'Argentina', away: 'France', time: 'Today, 20:00 UTC', status: 'scheduled' },
      { id: 'demo-match-002', home: 'Brazil', away: 'Spain', time: 'Tomorrow, 18:00 UTC', status: 'scheduled' }
    ]);
  }
  const matches = await getMatches();
  res.json(matches || []);
});

/**
 * @route GET /api/matches/:id
 * @desc Get match details, squads, and live odds
 */
router.get('/matches/:id', async (req, res) => {
  // Mock fallback data
  const mockResponse = {
    id: req.params.id,
    home: 'Argentina', away: 'France', time: '20:00 UTC',
    squads: ['Lionel Messi', 'Julian Alvarez', 'Kylian Mbappe', 'Antoine Griezmann', 'Olivier Giroud', 'No Goalscorer'],
    odds: {
      result: { 'Home Win': 2.60, 'Draw': 3.10, 'Away Win': 2.80 },
      btts: { 'Yes': 1.85, 'No': 1.95 },
      goals: { 'Over 2.5': 2.10, 'Under 2.5': 1.75 },
      scorer: { 
        'Lionel Messi': 5.00, 
        'Julian Alvarez': 7.50, 
        'Kylian Mbappe': 5.50, 
        'Antoine Griezmann': 9.00, 
        'Olivier Giroud': 8.50, 
        'No Goalscorer': 12.00 
      }
    }
  };

  // Try real TxLINE data first
  try {
    const [match, odds] = await Promise.all([
      getMatchById(req.params.id),
      getMatchOdds(req.params.id)
    ]);
    
    if (match && odds) {
      console.log('[TxLINE] Serving real odds data for match', req.params.id);
      return res.json({ ...match, odds, source: 'txline' });
    }
  } catch (err) {
    console.log('[TxLINE] Live data unavailable, using mock fallback:', err.message);
  }
  
  // Fallback to mock data for demo
  console.log('[MOCK] Serving hardcoded demo odds for match', req.params.id);
  res.json({ ...mockResponse, source: 'mock' });
});


/**
 * @route POST /api/groups/create
 * @desc Create a new prediction group
 */
router.post('/groups/create', async (req, res) => {
  const { name, created_by, entry_fee, chat_id } = req.body;
  
  if (!created_by) return res.status(400).json({ error: 'Create Wallet first' });
  
  const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const { data, error } = await supabase
    .from('groups')
    .insert([{ name, created_by, invite_code, entry_fee, chat_id }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/**
 * @route GET /api/groups/:invite_code
 * @desc Get group details
 */
router.get('/groups/:invite_code', async (req, res) => {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', req.params.invite_code)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Group not found' });
  res.json(data);
});

/**
 * @route GET /api/groups/my-groups/:wallet_address
 * @desc Fetch all groups a user has joined
 */
router.get('/groups/my-groups/:wallet_address', async (req, res) => {
  const { wallet_address } = req.params;
  const { data, error } = await supabase
    .from('members')
    .select('group_id, groups!inner(name, invite_code)')
    .eq('wallet_address', wallet_address)
    .order('joined_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Flatten the response
  const groups = data.map(m => ({
    id: m.group_id,
    name: m.groups.name,
    invite_code: m.groups.invite_code
  }));

  res.json(groups);
});

/**
 * @route POST /api/groups/join
 * @desc Join a group with an invite code
 */
router.post('/groups/join', async (req, res) => {
  const { invite_code, wallet_address, telegram_username } = req.body;
  
  if (!wallet_address) return res.status(400).json({ error: 'Create Wallet first' });

  // 1. Find group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id')
    .eq('invite_code', invite_code)
    .single();

  if (groupError || !group) return res.status(404).json({ error: 'Group not found' });

  // 2. Check if already joined
  const { data: existingMember } = await supabase
    .from('members')
    .select('*')
    .eq('group_id', group.id)
    .eq('wallet_address', wallet_address)
    .single();

  if (existingMember) {
    return res.json({ message: 'Already joined', member: existingMember });
  }

  // 3. Add member
  const { data, error } = await supabase
    .from('members')
    .insert([{ group_id: group.id, wallet_address, telegram_username }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  
  // 4. Initialize leaderboard entry
  await supabase.from('leaderboard').insert([{ group_id: group.id, member_id: data.id, total_pts: 10000 }]);

  res.json({ message: 'Joined successfully', member: data });
});

/**
 * @route POST /api/wallet/airdrop
 * @desc Mint 100 PULSE tokens to a new wallet
 */
router.post('/wallet/airdrop', async (req, res) => {
  const { wallet_address } = req.body;
  const mintAddress = process.env.PULSE_TOKEN_MINT;
  const privateKeyString = process.env.TREASURY_PRIVATE_KEY;
  
  if (!mintAddress || !privateKeyString || !wallet_address) {
    return res.status(400).json({ error: 'Missing airdrop configuration or wallet address' });
  }

  try {
    const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyString));
    const userPubkey = new PublicKey(wallet_address);
    const mintPubkey = new PublicKey(mintAddress);
    
    // Compute user ATA address
    const userAtaAddress = await getAssociatedTokenAddress(mintPubkey, userPubkey, true);
    const userAtaInfo = await connection.getAccountInfo(userAtaAddress);

    const transaction = new Transaction();

    // Create ATA if it doesn't exist
    if (!userAtaInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          treasuryKeypair.publicKey, // payer
          userAtaAddress, // ata
          userPubkey, // owner
          mintPubkey // mint
        )
      );
    }

    // Mint 100 tokens (with 2 decimals, so 10000)
    transaction.add(
      createMintToInstruction(
        mintPubkey,
        userAtaAddress,
        treasuryKeypair.publicKey,
        10000 // 100.00
      )
    );

    console.log(`[AIRDROP] Attempting mintTo. Mint: ${mintPubkey.toBase58()}, Destination: ${userAtaAddress.toBase58()}, Authority: ${treasuryKeypair.publicKey.toBase58()}`);
    const txSig = await sendAndConfirmTransaction(
      connection,
      transaction,
      [treasuryKeypair],
      { commitment: 'confirmed' }
    );

    console.log(`[AIRDROP] Minted 100 PULSE to ${wallet_address} - Sig: ${txSig}`);
    res.json({ success: true, txSig });
  } catch (err) {
    console.error("[AIRDROP ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/wallet/:wallet_address/balance
 * @desc Get the live balance of a wallet from the DB
 */
router.get('/wallet/:wallet_address/balance', async (req, res) => {
  const { wallet_address } = req.params;
  const { inviteCode } = req.query;

  let groupId = null;
  if (inviteCode) {
    const { data: g } = await supabase.from('groups').select('id').eq('invite_code', inviteCode).single();
    if (g) groupId = g.id;
  }

  let query = supabase
    .from('members')
    .select('balance')
    .eq('wallet_address', wallet_address)
    .order('balance', { ascending: true })
    .limit(1);

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return res.json({ balance: 100 }); // Default fallback for uninitialized
  }
  
  res.json({ balance: parseFloat(data.balance || 100) });
});

/**
 * @route POST /api/predictions
 * @desc Submit predictions for a match
 */
router.post('/predictions', async (req, res) => {
  const { wallet_address, group_invite_code, match_id, picks, tx_signature, wager_amount } = req.body;

  // 1. Verify Transaction on Solana Devnet
  if (tx_signature && tx_signature.length > 50) {
    try {
      const tx = await connection.getTransaction(tx_signature, { maxSupportedTransactionVersion: 0 });
      if (!tx) {
         console.log("[WARNING] Transaction not found on Devnet. Proceeding for demo purposes.");
      } else {
         console.log("[SUCCESS] Escrow transaction verified on-chain.");
      }
    } catch (err) {
      console.error("Tx Verify Error:", err);
    }
  }

  try {
    let inviteCode = group_invite_code || 'DEMO-' + Math.random().toString(36).substring(7);
    let safeWallet = wallet_address || 'mock_wallet_' + Math.random().toString(36).substring(7);

    // 2. Auto-Resolve Group UUID
    let groupId;
    const { data: group } = await supabase.from('groups').select('id').eq('invite_code', inviteCode).single();
    if (group) {
      groupId = group.id;
    } else {
      // Mock group if missing
      const { data: newGroup, error: groupError } = await supabase.from('groups').insert([{ name: 'Demo Group', invite_code: inviteCode, created_by: safeWallet, entry_fee: 0.1 }]).select().single();
      if (groupError) throw new Error("Group Error: " + groupError.message);
      groupId = newGroup.id;
    }

    // 3. Auto-Resolve Member UUID
    let memberId;
    const { data: member } = await supabase.from('members').select('id').eq('wallet_address', safeWallet).eq('group_id', groupId).single();
    if (member) {
      memberId = member.id;
    } else {
      // Auto-join group
      const { data: newMember, error: memberError } = await supabase.from('members').insert([{ group_id: groupId, wallet_address: safeWallet, telegram_username: '@' + safeWallet.substring(0,5) }]).select().single();
      if (memberError) throw new Error("Member Error: " + memberError.message);
      memberId = newMember.id;
      // Init leaderboard
      await supabase.from('leaderboard').insert([{ group_id: groupId, member_id: memberId, total_pts: 10000 }]);
    }

    // 4. Auto-Resolve Match UUID
    let realMatchId;
    if (match_id && match_id.length === 36 && match_id.split('-').length === 5) {
      realMatchId = match_id;
    } else {
      const matchTxId = match_id || 'demo-match-001';
      const isBrazil = matchTxId === 'bra-spa' || matchTxId === 'demo-match-002';
      
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .upsert(
          [{ 
             txline_id: matchTxId, 
             home_team: isBrazil ? 'Brazil' : 'Argentina', 
             away_team: isBrazil ? 'Spain' : 'France', 
             kickoff_time: new Date().toISOString() 
          }],
          { onConflict: 'txline_id' }
        )
        .select('id')
        .single();
        
      if (matchError) throw new Error("Match Error: " + matchError.message);
      realMatchId = matchData.id;
    }

    // 5. Check Balance, Deduct Wager, and Save Prediction
    const { data: memberData } = await supabase.from('members').select('balance').eq('id', memberId).single();
    const currentBalance = parseFloat(memberData?.balance || 100);
    const wager = parseFloat(wager_amount || 0);

    if (currentBalance < wager) throw new Error("Insufficient PULSE points balance");

    await supabase.from('members').update({ balance: currentBalance - wager }).eq('id', memberId);
    
    const { data, error } = await supabase
      .from('predictions')
      .insert([{ 
        member_id: memberId, 
        match_id: realMatchId, 
        picks, 
        wager_amount: wager,
        tx_signature
      }])
      .select()
      .single();

    if (error) throw error;
    
    // Sync leaderboard dynamically for this member
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
    const liveTotal = (currentBalance - wager) + liveBonus;
    await supabase.from('leaderboard').update({ total_pts: Math.round(liveTotal * 100) }).eq('member_id', memberId).eq('group_id', groupId);
    
    res.json(data);
  } catch (err) {
    console.error("Prediction Save Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /api/predictions/bulk
 * @desc Submit multiple predictions at once for a parlay
 */
router.post('/predictions/bulk', async (req, res) => {
  const { wallet_address, group_invite_code, tx_signature, wager_amount, predictions } = req.body;

  if (tx_signature && tx_signature.length > 50) {
    try {
      const tx = await connection.getTransaction(tx_signature, { maxSupportedTransactionVersion: 0 });
      if (!tx) {
         console.log("[WARNING] Transaction not found on Devnet. Proceeding for demo purposes.");
      } else {
         console.log("[SUCCESS] Escrow transaction verified on-chain.");
      }
    } catch (err) {
      console.error("Tx Verify Error:", err);
    }
  }

  try {
    let inviteCode = group_invite_code || 'DEMO-' + Math.random().toString(36).substring(7);
    let safeWallet = wallet_address || 'mock_wallet_' + Math.random().toString(36).substring(7);

    let groupId;
    const { data: group } = await supabase.from('groups').select('id').eq('invite_code', inviteCode).single();
    if (group) {
      groupId = group.id;
    } else {
      const { data: newGroup, error: groupError } = await supabase.from('groups').insert([{ name: 'Demo Group', invite_code: inviteCode, created_by: safeWallet, entry_fee: 0.1 }]).select().single();
      if (groupError) throw new Error("Group Error: " + groupError.message);
      groupId = newGroup.id;
    }

    let memberId;
    const { data: member } = await supabase.from('members').select('id').eq('wallet_address', safeWallet).eq('group_id', groupId).single();
    if (member) {
      memberId = member.id;
    } else {
      const { data: newMember, error: memberError } = await supabase.from('members').insert([{ group_id: groupId, wallet_address: safeWallet, telegram_username: '@' + safeWallet.substring(0,5) }]).select().single();
      if (memberError) throw new Error("Member Error: " + memberError.message);
      memberId = newMember.id;
      await supabase.from('leaderboard').insert([{ group_id: groupId, member_id: memberId, total_pts: 10000 }]);
    }

    const { data: memberData } = await supabase.from('members').select('balance').eq('id', memberId).single();
    const currentBalance = parseFloat(memberData?.balance || 100);
    const wager = parseFloat(wager_amount || 0);

    if (currentBalance < wager) throw new Error("Insufficient PULSE points balance");

    await supabase.from('members').update({ balance: currentBalance - wager }).eq('id', memberId);

    const splitWager = parseFloat((wager / predictions.length).toFixed(2));
    const inserts = [];

    for (const pred of predictions) {
      let realMatchId;
      if (pred.match_id && pred.match_id.length === 36 && pred.match_id.split('-').length === 5) {
        realMatchId = pred.match_id;
      } else {
        const matchTxId = pred.match_id || 'demo-match-001';
        const isBrazil = matchTxId === 'bra-spa' || matchTxId === 'demo-match-002';
        
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .upsert(
            [{ 
               txline_id: matchTxId, 
               home_team: isBrazil ? 'Brazil' : 'Argentina', 
               away_team: isBrazil ? 'Spain' : 'France', 
               kickoff_time: new Date().toISOString() 
            }],
            { onConflict: 'txline_id' }
          )
          .select('id')
          .single();
          
        if (matchError) throw new Error("Match Error: " + matchError.message);
        realMatchId = matchData.id;
      }

      inserts.push({
        member_id: memberId,
        match_id: realMatchId,
        picks: pred.picks,
        wager_amount: splitWager,
        tx_signature: tx_signature ? `${tx_signature}-${inserts.length}` : null
      });
    }

    const { data, error } = await supabase
      .from('predictions')
      .insert(inserts)
      .select();

    if (error) throw error;
    
    // Sync leaderboard dynamically for this member
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
    const liveTotal = (currentBalance - wager) + liveBonus;
    await supabase.from('leaderboard').update({ total_pts: Math.round(liveTotal * 100) }).eq('member_id', memberId).eq('group_id', groupId);
    
    res.json(data);
  } catch (err) {
    console.error("Bulk Prediction Save Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/leaderboard/:groupId
 * @desc Get group leaderboard
 */
router.get('/leaderboard/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const { data, error } = await supabase
    .from('leaderboard')
    .select(`
      total_pts,
      matches_played,
      members (
        wallet_address,
        telegram_username,
        balance
      )
    `)
    .eq('group_id', groupId)
    .order('total_pts', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Aggregate by telegram_username to fix duplicate dummy member rows
  const aggregated = {};
  for (const row of data) {
    const user = row.members?.telegram_username || 'Unknown';
    if (!aggregated[user]) {
      // Deep clone to avoid mutating the original data
      aggregated[user] = JSON.parse(JSON.stringify(row));
    } else {
      aggregated[user].total_pts += row.total_pts;
      aggregated[user].matches_played += row.matches_played;
      if (row.members && aggregated[user].members) {
         const oldBal = parseFloat(aggregated[user].members.balance || 0);
         const newBal = parseFloat(row.members.balance || 0);
         aggregated[user].members.balance = (oldBal + newBal).toString();
      }
    }
  }

  // Re-sort the aggregated array
  const finalData = Object.values(aggregated).sort((a, b) => b.total_pts - a.total_pts);

  res.json(finalData);
});

/**
 * @route GET /api/predictions/:inviteCode/:walletAddress
 * @desc Get all predictions for a specific user in a specific group
 */
router.get('/predictions/:inviteCode/:walletAddress', async (req, res) => {
  const { inviteCode, walletAddress } = req.params;

  try {
    // 1. Get Group
    const { data: group } = await supabase.from('groups').select('id, entry_fee').eq('invite_code', inviteCode).single();
    if (!group) return res.json([]);

    // 2. Get Member
    const { data: member } = await supabase.from('members').select('id').eq('wallet_address', walletAddress).eq('group_id', group.id).single();
    if (!member) return res.json([]);

    // 3. Get Predictions with Match Details
    const { data, error } = await supabase
      .from('predictions')
      .select(`
        id,
        picks,
        wager_amount,
        tx_signature,
        status:locked,
        matches (
          home_team,
          away_team,
          txline_id
        )
      `)
      .eq('member_id', member.id);

    if (error) throw error;
    
    // Format to match frontend escrow expectations
    const formatted = data.map(p => {
      // Calculate totalPos from picks object
      let totalPts = 0;
      if (p.picks) {
        if (typeof p.picks.result === 'number') totalPts += p.picks.result;
        // In our frontend picks object, it stores the selected string (e.g. 'Home win') 
        // Wait, the frontend stores the selections. Where are the odds? 
        // We will just let the frontend parse it, or we can send the raw picks.
      }
      return {
        matchId: p.matches.txline_id,
        match: `${p.matches.home_team} vs ${p.matches.away_team}`,
        picks: p.picks,
        wager_amount: p.wager_amount,
        sig: p.tx_signature,
        matchStatus: p.status ? 'completed' : 'live'
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /api/webhook/txline
 * @desc Production webhook endpoint for receiving live match events from the sports data provider.
 */
router.post('/webhook/txline', async (req, res) => {
  const liveEventData = req.body;
  
  if (!liveEventData || !liveEventData.match_id) {
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  try {
    console.log(`[WEBHOOK] Received live event for match ${liveEventData.match_id}: ${liveEventData.event || 'UPDATE'}`);
    
    // Pass the real-time event directly into our existing engine
    if (liveEventData.event === 'GOAL') {
      await handleGoalEvent(liveEventData.match_id, liveEventData.score);
    } else if (liveEventData.event === 'MATCH_END') {
      await handleMatchEnd(liveEventData.match_id);
    }
    
    res.status(200).send('Webhook Processed Successfully');
  } catch (err) {
    console.error('[WEBHOOK ERROR]', err);
    res.status(500).send('Internal Engine Error');
  }
});

/**
 * @route GET /api/tts
 * @desc Proxy for Google TTS to bypass browser CORS
 */
router.get('/tts', async (req, res) => {
  const { text } = req.query;
  if (!text) return res.status(400).json({ error: 'Missing text' });
  try {
    const url = googleTTS.getAudioUrl(text, { lang: 'en', slow: false, host: 'https://translate.google.com' });
    const response = await axios.get(url, { responseType: 'stream' });
    res.setHeader('Content-Type', 'audio/mpeg');
    response.data.pipe(res);
  } catch (err) {
    res.redirect('https://actions.google.com/sounds/v1/crowds/crowd_cheer.ogg');
  }
});

/**
 * @route POST /api/demo/upcoming-alert
 * @desc Manual trigger for hackathon demo to announce new odds available on Telegram
 */
router.post('/demo/upcoming-alert', async (req, res) => {
  const { matchCount = 4 } = req.body;
  
  try {
    const { data: groups } = await supabase.from('groups').select('chat_id').not('chat_id', 'is', null);
    
    if (groups && groups.length > 0) {
      for (const group of groups) {
        if (group.chat_id) {
          await broadcastUpcomingMatches(group.chat_id, matchCount);
        }
      }
      res.json({ success: true, message: `Broadcasted to ${groups.length} groups` });
    } else {
      res.json({ success: true, message: 'No groups with active telegram chats found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
