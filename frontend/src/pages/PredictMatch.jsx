import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';

const TREASURY_PUBKEY = new PublicKey('9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E'); // Mock Treasury Address for Devnet

const PredictMatch = () => {
  const { id: groupId, matchId } = useParams();
  const navigate = useNavigate();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [match, setMatch] = useState(null);
  const [squads, setSquads] = useState([]);
  const [odds, setOdds] = useState({});
  const [group, setGroup] = useState(null); // To fetch entry fee
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [picks, setPicks] = useState({
    result: null,
    btts: null,
    goals: null,
    scorer: null
  });

  useEffect(() => {
    // Fetch dynamic entry fee
    axios.get(`http://localhost:3000/api/groups/${groupId}`)
      .then(res => setGroup(res.data))
      .catch(err => setGroup({ entry_fee: 0.1 })); // fallback

    axios.get(`http://localhost:3000/api/matches/${matchId}`)
      .then(res => {
        setMatch(res.data);
        setSquads(res.data.squads || []);
        setOdds(res.data.odds || {});
      })
      .catch(err => console.error("Error fetching match", err));
  }, [matchId]);

  const togglePick = (market, selection) => {
    setPicks(prev => ({
      ...prev,
      [market]: prev[market] === selection ? null : selection
    }));
  };

  const calculateParlay = () => {
    let potentialWin = 0;
    if (picks.result && odds.result) potentialWin += odds.result[picks.result];
    if (picks.btts && odds.btts) potentialWin += odds.btts[picks.btts];
    if (picks.goals && odds.goals) potentialWin += odds.goals[picks.goals];
    if (picks.scorer && odds.scorer && odds.scorer[picks.scorer]) potentialWin += odds.scorer[picks.scorer];
    return { win: potentialWin.toFixed(2), loss: potentialWin.toFixed(2) };
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    if (!publicKey) return alert("Please connect your Phantom wallet first!");

    const formattedPicks = [];
    if (picks.result) formattedPicks.push({ market: 'result', selection: picks.result, odds: odds.result[picks.result], status: 'pending', points_awarded: 0 });
    if (picks.btts) formattedPicks.push({ market: 'btts', selection: picks.btts, odds: odds.btts[picks.btts], status: 'pending', points_awarded: 0 });
    if (picks.goals) formattedPicks.push({ market: 'goals', selection: picks.goals, odds: odds.goals[picks.goals], status: 'pending', points_awarded: 0 });
    if (picks.scorer) formattedPicks.push({ market: 'scorer', selection: picks.scorer, odds: odds.scorer[picks.scorer], status: 'pending', points_awarded: 0 });

    if (formattedPicks.length === 0) {
      return alert("You must select at least one outcome!");
    }

    setIsSubmitting(true);

    try {
      // 1. Construct Solana Transaction for Escrow
      const feeInLamports = (group.entry_fee || 0.1) * LAMPORTS_PER_SOL;
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: TREASURY_PUBKEY,
          lamports: feeInLamports,
        })
      );

      // 2. Request user to sign and send
      const signature = await sendTransaction(transaction, connection);
      console.log("Transaction Sent. Signature:", signature);

      // 3. Confirm Transaction (Devnet can be slow, so we wait)
      await connection.confirmTransaction(signature, 'processed');

      // 4. Send to Backend
      await axios.post('http://localhost:3000/api/predictions', {
        wallet_address: publicKey.toString(),
        group_invite_code: groupId,
        match_id: matchId,
        picks: formattedPicks,
        tx_signature: signature
      });

      alert("High-Risk Parlay locked in! Escrow funded.");
      navigate(-1);
    } catch (err) {
      console.error(err);
      alert("Failed to submit prediction or transaction rejected.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!match) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', marginTop: '4rem' }}>
        <h2>Loading live odds from TxLINE...</h2>
      </div>
    );
  }

  const { win, loss } = calculateParlay();

  return (
    <div className="glass-panel animate-enter" style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{match.home} vs {match.away}</h2>
        <p style={{ color: 'var(--text-muted)' }}>Kickoff: {match.time}</p>
        <p style={{ color: 'var(--accent-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Select your markets. Correct picks ADD odds to your score. Incorrect picks SUBTRACT odds.
        </p>
      </div>

      <form onSubmit={handlePredict} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Prediction 1 */}
        <div className="input-group">
          <label className="input-label" style={{ color: 'var(--accent-primary)' }}>1. Match Result</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            {['Home Win', 'Draw', 'Away Win'].map(opt => (
              <div 
                key={opt} 
                className={`prediction-option ${picks.result === opt ? 'selected' : ''}`}
                onClick={() => togglePick('result', opt)}
                style={{ textAlign: 'center' }}
              >
                <div>{opt}</div>
                <div style={{ fontSize: '0.8rem', color: picks.result === opt ? '#000' : 'var(--text-muted)' }}>
                  {odds.result ? `±${odds.result[opt].toFixed(2)}` : '...'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prediction 2 */}
        <div className="input-group">
          <label className="input-label" style={{ color: 'var(--accent-primary)' }}>2. Both Teams to Score</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {['Yes', 'No'].map(opt => (
              <div 
                key={opt} 
                className={`prediction-option ${picks.btts === opt ? 'selected' : ''}`}
                onClick={() => togglePick('btts', opt)}
                style={{ textAlign: 'center' }}
              >
                <div>{opt}</div>
                <div style={{ fontSize: '0.8rem', color: picks.btts === opt ? '#000' : 'var(--text-muted)' }}>
                  {odds.btts ? `±${odds.btts[opt].toFixed(2)}` : '...'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prediction 3 */}
        <div className="input-group">
          <label className="input-label" style={{ color: 'var(--accent-primary)' }}>3. Total Goals</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {['Over 2.5', 'Under 2.5'].map(opt => (
              <div 
                key={opt} 
                className={`prediction-option ${picks.goals === opt ? 'selected' : ''}`}
                onClick={() => togglePick('goals', opt)}
                style={{ textAlign: 'center' }}
              >
                <div>{opt}</div>
                <div style={{ fontSize: '0.8rem', color: picks.goals === opt ? '#000' : 'var(--text-muted)' }}>
                  {odds.goals ? `±${odds.goals[opt].toFixed(2)}` : '...'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prediction 4 */}
        <div className="input-group">
          <label className="input-label" style={{ color: 'var(--accent-primary)' }}>4. First Goalscorer</label>
          <select 
            className="input-field" 
            value={picks.scorer || ''} 
            onChange={(e) => togglePick('scorer', e.target.value)}
            style={{ WebkitAppearance: 'none', appearance: 'none', background: 'rgba(0,0,0,0.4) url("data:image/svg+xml;utf8,<svg fill=%27white%27 height=%2724%27 viewBox=%270 0 24 24%27 width=%2724%27 xmlns=%27http://www.w3.org/2000/svg%27><path d=%27M7 10l5 5 5-5z%27/></svg>") no-repeat right 10px center' }}
          >
            <option value="" disabled>Select a player...</option>
            {squads.map(player => (
              <option key={player} value={player}>
                {player} (±{odds.scorer && odds.scorer[player] ? odds.scorer[player].toFixed(2) : '1.00'})
              </option>
            ))}
          </select>
          <button type="button" onClick={() => togglePick('scorer', picks.scorer)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textAlign: 'left', marginTop: '0.5rem' }}>
            {picks.scorer ? 'Clear Selection' : 'Skip this market'}
          </button>
        </div>

        {/* Bet Slip Summary */}
        <div style={{ background: 'rgba(0,0,0,0.6)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Your Bet Slip</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span>Potential Max Points:</span>
            <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>+{win} pts</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Potential Max Loss:</span>
            <span style={{ color: '#EF4444', fontWeight: 'bold' }}>-{loss} pts</span>
          </div>
        </div>

        <button type="submit" className="btn btn-accent" style={{ padding: '1rem', fontSize: '1.1rem' }} disabled={win == 0 || isSubmitting}>
          {isSubmitting ? 'Processing Transaction...' : `Pay ${group ? group.entry_fee : '0.1'} SOL & Lock Parlay`}
        </button>
      </form>
    </div>
  );
};

export default PredictMatch;
