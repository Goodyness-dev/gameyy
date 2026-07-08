import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import Modal from '../components/Modal';

const PredictMatch = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { connected, publicKey } = useWallet();
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: '', title: '', desc: '', action: null });
  
  const [entryFee, setEntryFee] = useState(0.1);
  const [matches, setMatches] = useState([]);
  const [existingPredictions, setExistingPredictions] = useState([]);
  
  // State is now an object keyed by match txline_id
  const [picks, setPicks] = useState({});
  const [oddsMap, setOddsMap] = useState({});
  const [expandedIndex, setExpandedIndex] = useState(0);

  const defaultOdds = {
    'Home win': 2.60, 'Draw': 3.10, 'Away win': 2.80,
    'Yes': 1.85, 'No': 1.95,
    'Over 2.5': 2.10, 'Under 2.5': 1.75,
    'messi': 5.50, 'mbappe': 5.00, 'alvarez': 7.50,
    'giroud': 8.00, 'dimaria': 10.00, 'griezmann': 9.50,
    'vinicius': 5.00, 'morata': 7.00, 'rodrygo': 6.50
  };

  useEffect(() => {
    if (!id) return;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    // Fetch Group entry fee
    fetch(`${API_URL}/api/groups/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.entry_fee !== undefined) setEntryFee(data.entry_fee);
      })
      .catch(() => {});
      
    // Fetch User Predictions to filter out already picked matches
    if (connected && publicKey) {
      fetch(`${API_URL}/api/predictions/${id}/${publicKey.toString()}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setExistingPredictions(data.map(p => p.matchId));
          }
        })
        .catch(() => {});
    }

    // Fetch upcoming matches
    fetch(`${API_URL}/api/matches`)
      .then(res => res.json())
      .then(data => {
         if (Array.isArray(data)) {
            setMatches(data);
            // Pre-fill odds map and picks object
            const newOdds = {};
            const newPicks = {};
            data.forEach(m => {
               newOdds[m.id] = { ...defaultOdds };
               newPicks[m.id] = { result: null, btts: null, goals: null, scorer: null };
            });
            setOddsMap(newOdds);
            setPicks(newPicks);
         }
      })
      .catch(() => {});
  }, [id, connected, publicKey]);

  const handlePick = (matchId, group, value) => {
    setPicks(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [group]: value
      }
    }));
  };

  let totalPos = 0;
  Object.keys(picks).forEach(matchId => {
     const p = picks[matchId];
     const o = oddsMap[matchId];
     if (p && o) {
       if (p.result) totalPos += o[p.result] || 0;
       if (p.btts) totalPos += o[p.btts] || 0;
       if (p.goals) totalPos += o[p.goals] || 0;
       if (p.scorer) totalPos += o[p.scorer] || 0;
     }
  });

  const handlePay = async () => {
    if (!connected) {
      setModalConfig({ isOpen: true, type: 'error', title: 'Wallet Not Connected', desc: 'Please connect your wallet first!' });
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    // Find all matches that have at least one pick
    const matchesToSubmit = Object.keys(picks).filter(matchId => {
      const p = picks[matchId];
      return p.result || p.btts || p.goals || p.scorer;
    });

    if (matchesToSubmit.length === 0) {
      setModalConfig({ isOpen: true, type: 'error', title: 'No Picks', desc: 'Please make at least one pick before locking your parlay.' });
      return;
    }

    try {
      // Submit sequentially
      for (const matchId of matchesToSubmit) {
        const fakeSig = Math.random().toString(36).substring(2, 6).toUpperCase() + '…' + Math.random().toString(36).substring(2, 6).toUpperCase();
        
        const p = picks[matchId];
        const o = oddsMap[matchId];
        
        const picksArray = [];
        if (p.result) picksArray.push({ market: 'result', selection: p.result, odds: o[p.result] || 0, status: 'pending', points_awarded: 0 });
        if (p.btts) picksArray.push({ market: 'btts', selection: p.btts, odds: o[p.btts] || 0, status: 'pending', points_awarded: 0 });
        if (p.goals) picksArray.push({ market: 'goals', selection: p.goals, odds: o[p.goals] || 0, status: 'pending', points_awarded: 0 });
        if (p.scorer) picksArray.push({ market: 'scorer', selection: p.scorer, odds: o[p.scorer] || 0, status: 'pending', points_awarded: 0 });

        const res = await fetch(`${API_URL}/api/predictions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet_address: publicKey.toString(),
            group_invite_code: id,
            match_id: matchId,
            picks: picksArray,
            tx_signature: fakeSig
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to submit prediction');
        }
      }

      setModalConfig({ 
        isOpen: true, 
        type: 'success', 
        title: 'Success!', 
        desc: `Successfully locked in your parlay across ${matchesToSubmit.length} matches for ${entryFee} SOL!`,
        action: () => navigate(`/group/${id || 'LM79C3'}`)
      });
    } catch (err) {
      setModalConfig({ isOpen: true, type: 'error', title: 'Error', desc: err.message });
    }
  };

  const availableMatches = matches.filter(m => !existingPredictions.includes(m.id));

  return (
    <div className="wrap">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '28px', fontWeight: '800' }}>Build Your Master Parlay</h2>
        <p style={{ color: 'var(--tm2)' }}>Make your selections across all upcoming games and lock them in at once.</p>
        <div style={{textAlign: 'center', marginTop: '6px'}}>
          <span className="rule-note">✅ Correct picks ADD odds &nbsp;·&nbsp; ❌ Wrong picks SUBTRACT odds</span>
        </div>
      </div>

      <div className="layout" style={{ gridTemplateColumns: '1fr 320px', gap: '3rem' }}>
        <div>
          {availableMatches.length === 0 ? (
            <div className="lb-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--tm2)' }}>No matches available</h3>
              <p>You have either predicted all matches or there are no upcoming games.</p>
            </div>
          ) : (
            availableMatches.map((match, idx) => {
              const p = picks[match.id] || {};
              const o = oddsMap[match.id] || {};
              const isBrazil = match.home === 'Brazil';
              
              return (
                <div key={match.id} style={{ marginBottom: expandedIndex === idx ? '3rem' : '1rem' }}>
                  <div className="match-hero" 
                       onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                       style={{ 
                         padding: '1.5rem', 
                         borderRadius: '16px', 
                         marginBottom: expandedIndex === idx ? '1.5rem' : '0',
                         cursor: 'pointer',
                         transition: 'background 0.2s',
                         position: 'relative'
                       }}
                       onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gr-l)'}
                       onMouseLeave={(e) => e.currentTarget.style.background = 'var(--gr-dk)'}
                  >
                    <div style={{ position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', color: 'rgba(245,240,232,0.6)' }}>
                      {expandedIndex === idx ? '▲' : '▼'}
                    </div>
                    <div className="mh-teams" style={{ gap: '2rem' }}>
                      <div className="tblock">
                        <div className="tflag" style={{background: 'none', border: 'none', padding: 0}}>
                          <img src={`https://hatscripts.github.io/circle-flags/flags/${isBrazil ? 'br' : 'ar'}.svg`} alt={match.home} width="40" height="40" />
                        </div>
                        <div className="tname" style={{ fontSize: '18px' }}>{match.home}</div>
                      </div>
                      <div className="vs-pill" style={{ fontSize: '12px', padding: '2px 8px' }}>VS</div>
                      <div className="tblock">
                        <div className="tflag" style={{background: 'none', border: 'none', padding: 0}}>
                          <img src={`https://hatscripts.github.io/circle-flags/flags/${isBrazil ? 'es' : 'fr'}.svg`} alt={match.away} width="40" height="40" />
                        </div>
                        <div className="tname" style={{ fontSize: '18px' }}>{match.away}</div>
                      </div>
                    </div>
                    <div className="kickoff" style={{ fontSize: '12px' }}>Kickoff: {match.time}</div>
                  </div>

                  {expandedIndex === idx && (
                    <div className="mkts">
                    <div className="mkt-block">
                      <div className="mkt-label">1. Match result</div>
                      <div className="opts opts-3">
                        <div className={`opt ${p.result === 'Home win' ? 'sel' : ''}`} onClick={() => handlePick(match.id, 'result', 'Home win')}>
                          <span className="opt-name">Home win</span>
                          <span className="opt-odds">±{o['Home win']?.toFixed(2)}</span>
                        </div>
                        <div className={`opt ${p.result === 'Draw' ? 'sel' : ''}`} onClick={() => handlePick(match.id, 'result', 'Draw')}>
                          <span className="opt-name">Draw</span>
                          <span className="opt-odds">±{o['Draw']?.toFixed(2)}</span>
                        </div>
                        <div className={`opt ${p.result === 'Away win' ? 'sel' : ''}`} onClick={() => handlePick(match.id, 'result', 'Away win')}>
                          <span className="opt-name">Away win</span>
                          <span className="opt-odds">±{o['Away win']?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mkt-block">
                      <div className="mkt-label">2. Both teams to score</div>
                      <div className="opts opts-2">
                        <div className={`opt ${p.btts === 'Yes' ? 'sel' : ''}`} onClick={() => handlePick(match.id, 'btts', 'Yes')}>
                          <span className="opt-name">Yes</span>
                          <span className="opt-odds">±{o['Yes']?.toFixed(2)}</span>
                        </div>
                        <div className={`opt ${p.btts === 'No' ? 'sel' : ''}`} onClick={() => handlePick(match.id, 'btts', 'No')}>
                          <span className="opt-name">No</span>
                          <span className="opt-odds">±{o['No']?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mkt-block">
                      <div className="mkt-label">3. Total goals</div>
                      <div className="opts opts-2">
                        <div className={`opt ${p.goals === 'Over 2.5' ? 'sel' : ''}`} onClick={() => handlePick(match.id, 'goals', 'Over 2.5')}>
                          <span className="opt-name">Over 2.5</span>
                          <span className="opt-odds">±{o['Over 2.5']?.toFixed(2)}</span>
                        </div>
                        <div className={`opt ${p.goals === 'Under 2.5' ? 'sel' : ''}`} onClick={() => handlePick(match.id, 'goals', 'Under 2.5')}>
                          <span className="opt-name">Under 2.5</span>
                          <span className="opt-odds">±{o['Under 2.5']?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mkt-block">
                      <div className="mkt-label">4. First goalscorer</div>
                      <select 
                        className="player-sel" 
                        value={p.scorer || ""} 
                        onChange={(e) => handlePick(match.id, 'scorer', e.target.value)}
                      >
                        <option value="" disabled>Select a player…</option>
                        {isBrazil ? (
                          <>
                            <option value="vinicius">V. Júnior (±{o['vinicius']?.toFixed(2)})</option>
                            <option value="rodrygo">Rodrygo (±{o['rodrygo']?.toFixed(2)})</option>
                            <option value="morata">A. Morata (±{o['morata']?.toFixed(2)})</option>
                          </>
                        ) : (
                          <>
                            <option value="messi">L. Messi (±{o['messi']?.toFixed(2)})</option>
                            <option value="mbappe">K. Mbappé (±{o['mbappe']?.toFixed(2)})</option>
                            <option value="alvarez">J. Álvarez (±{o['alvarez']?.toFixed(2)})</option>
                            <option value="giroud">O. Giroud (±{o['giroud']?.toFixed(2)})</option>
                            <option value="dimaria">A. Di María (±{o['dimaria']?.toFixed(2)})</option>
                            <option value="griezmann">A. Griezmann (±{o['griezmann']?.toFixed(2)})</option>
                          </>
                        )}
                      </select>
                      <div className="skip" onClick={() => handlePick(match.id, 'scorer', null)}>Skip this market →</div>
                    </div>
                  </div>
                  )}
                  
                  {idx < availableMatches.length - 1 && (
                     <div style={{ height: '2px', background: 'var(--cr-dd)', margin: expandedIndex === idx ? '3rem 0' : '1.5rem 0', opacity: 0.5 }}></div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="betslip" style={{ position: 'sticky', top: '2rem', height: 'fit-content' }}>
          <div className="bs-deco1"></div>
          <div className="bs-deco2"></div>
          <div className="bs-title">⚽ Master bet slip</div>
          <div className="bs-row">
            <span className="bs-lbl">Potential max points</span>
            <span className="pts-pos">+{totalPos.toFixed(2)} pts</span>
          </div>
          <div className="bs-row">
            <span className="bs-lbl">Potential max loss</span>
            <span className="pts-neg">−{totalPos.toFixed(2)} pts</span>
          </div>
          <button className="pay-btn" onClick={handlePay}>🔒 Pay {entryFee} SOL and lock parlay</button>
          <Link to={`/group/${id || 'LM79C3'}`} className="cancel-lnk">Cancel and go back</Link>
        </div>
      </div>
      
      <Modal 
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        desc={modalConfig.desc}
        onClose={() => {
          setModalConfig({ ...modalConfig, isOpen: false });
          if (modalConfig.action) modalConfig.action();
        }}
      />
    </div>
  );
};

export default PredictMatch;
