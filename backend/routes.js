import express from 'express';
import { supabase } from './db.js';
import { getMatches, getMatchById } from './txline.js';
import { Connection } from '@solana/web3.js';

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
  if (!process.env.TXLINE_API_KEY || process.env.TXLINE_API_KEY === 'your_txline_api_key') {
    return res.json({
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
    });
  }
  const match = await getMatchById(req.params.id);
  res.json(match || {});
});


/**
 * @route POST /api/groups/create
 * @desc Create a new prediction group
 */
router.post('/groups/create', async (req, res) => {
  const { name, created_by, entry_fee } = req.body;
  const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const { data, error } = await supabase
    .from('groups')
    .insert([{ name, created_by, invite_code, entry_fee }])
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
 * @route POST /api/groups/join
 * @desc Join a group with an invite code
 */
router.post('/groups/join', async (req, res) => {
  const { invite_code, wallet_address, telegram_username } = req.body;

  // 1. Find group
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id')
    .eq('invite_code', invite_code)
    .single();

  if (groupError || !group) return res.status(404).json({ error: 'Group not found' });

  // 2. Add member
  const { data, error } = await supabase
    .from('members')
    .insert([{ group_id: group.id, wallet_address, telegram_username }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  
  // 3. Initialize leaderboard entry
  await supabase.from('leaderboard').insert([{ group_id: group.id, member_id: data.id }]);

  res.json({ message: 'Joined successfully', member: data });
});

/**
 * @route POST /api/predictions
 * @desc Submit predictions for a match
 */
router.post('/predictions', async (req, res) => {
  const { wallet_address, group_invite_code, match_id, picks, tx_signature } = req.body;

  // 1. Verify Transaction on Solana Devnet
  if (tx_signature) {
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
      await supabase.from('leaderboard').insert([{ group_id: groupId, member_id: memberId }]);
    }

    // 4. Auto-Resolve Match UUID
    let realMatchId;
    const matchTxId = match_id || 'demo-match-001';
    const { data: matchData } = await supabase.from('matches').select('id').eq('txline_id', matchTxId).single();
    if (matchData) {
      realMatchId = matchData.id;
    } else {
      const { data: newMatch, error: matchError } = await supabase.from('matches').insert([{ txline_id: matchTxId, home_team: 'Argentina', away_team: 'France', kickoff_time: new Date().toISOString() }]).select().single();
      if (matchError) throw new Error("Match Error: " + matchError.message);
      realMatchId = newMatch.id;
    }

    // 5. Save Prediction with real UUIDs
    const { data, error } = await supabase
      .from('predictions')
      .insert([{ 
        member_id: memberId, 
        match_id: realMatchId, 
        picks, 
        tx_signature
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Prediction Save Error:", err);
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
        telegram_username
      )
    `)
    .eq('group_id', groupId)
    .order('total_pts', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
