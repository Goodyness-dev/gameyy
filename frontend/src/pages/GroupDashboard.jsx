import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';

const GroupDashboard = () => {
  const { id } = useParams();
  const { connected, publicKey } = useWallet();
  const [groupData, setGroupData] = useState({ entryFee: 0.1, groupName: `GROUP: ${id || 'LM79C3'}` });
  const [leaderboard, setLeaderboard] = useState([]);
  const [escrows, setEscrows] = useState([]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id || 'LM79C3');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'SuoerdevBot';

  useEffect(() => {
    if (!id) return;
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    const fetchData = async () => {
      try {
        // 1. Fetch Group and Leaderboard
        const groupRes = await fetch(`${API_URL}/api/groups/${id}`);
        const group = await groupRes.json();
        
        if (group && !group.error) {
          setGroupData({ entryFee: group.entry_fee, groupName: group.name, groupId: group.id });
          
          const lbRes = await fetch(`${API_URL}/api/leaderboard/${group.id}`);
          const lb = await lbRes.json();
          if (Array.isArray(lb)) {
            const formatted = lb.map((entry, idx) => ({
                rank: idx + 1,
                user: entry.members.telegram_username,
                addr: entry.members.wallet_address.substring(0,4) + '…' + entry.members.wallet_address.substring(entry.members.wallet_address.length - 4),
                pts: entry.total_pts / 100,
                rawAddr: entry.members.wallet_address
            }));
            setLeaderboard(formatted);
          }
        }

        // 2. Fetch User Predictions
        if (connected && publicKey) {
          const predRes = await fetch(`${API_URL}/api/predictions/${id}/${publicKey.toString()}`);
          const preds = await predRes.json();
          if (Array.isArray(preds)) setEscrows(preds);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    // Fetch immediately on mount
    fetchData();

    // Set up 3-second polling interval for live game updates
    const intervalId = setInterval(fetchData, 3000);

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [id, connected, publicKey]);

  const getStatusColor = (status) => {
    if (status === 'won') return 'var(--gd)'; // Gold/Green
    if (status === 'lost') return '#ff4444'; // Red
    return 'var(--tm2)'; // Pending (Gray)
  };

  const getStatusIcon = (status) => {
    if (status === 'won') return '🟢';
    if (status === 'lost') return '🔴';
    return '🟡';
  };

  return (
    <div className="wrap">
      <div className="lobby-hdr">
        <div className="group-badge">{groupData.groupName.toUpperCase()}</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Telegram Deep Link Button */}
          <a 
            href={`https://t.me/${TELEGRAM_BOT_USERNAME}?startgroup=LINK_${id || 'LM79C3'}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#2AABEE', color: '#fff', padding: '7px 16px', borderRadius: '20px', 
              fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', 
              textDecoration: 'none', transition: 'transform 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span>🤖 Add Bot to Telegram</span>
          </a>

          <div 
            onClick={handleCopy} 
            style={{
              cursor: 'pointer', background: 'var(--gr)', color: '#fff', 
              padding: '7px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '800', 
              display: 'flex', alignItems: 'center', gap: '6px', border: 'none',
              transition: 'background 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gr-l)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--gr)'}
          >
            <span>Invite Code: <span style={{color: 'var(--gd)', marginLeft: '4px'}}>{id || 'LM79C3'}</span></span>
            <span>{copied ? '✅' : '📋'}</span>
          </div>
          <div className="pool-pill">🏦 Pool: {groupData.entryFee} SOL</div>
        </div>
      </div>
      <div className="grid">
        <div>
          <div className="sec-label" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            Upcoming matches
            <Link to={`/group/${id || 'LM79C3'}/predict`} className="btn-g" style={{
              padding: '12px 24px', 
              fontSize: '15px', 
              textDecoration: 'none', 
              boxShadow: '0 4px 14px rgba(234, 182, 49, 0.4)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(234, 182, 49, 0.6)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(234, 182, 49, 0.4)'; }}
            >
              Make Picks <span style={{fontSize: '18px'}}>→</span>
            </Link>
          </div>
          <div className="match-card">
            <div className="match-teams">
              <div className="flag" style={{background: 'none', border: 'none', padding: 0}}>
                <img src="https://hatscripts.github.io/circle-flags/flags/ar.svg" alt="Argentina" width="34" height="34" />
              </div>
              <div className="minfo">
                <h4>Argentina vs France</h4>
                <p>Today · 20:00 UTC</p>
              </div>
              <div className="vs">VS</div>
              <div className="flag" style={{background: 'none', border: 'none', padding: 0}}>
                <img src="https://hatscripts.github.io/circle-flags/flags/fr.svg" alt="France" width="34" height="34" />
              </div>
            </div>
          </div>
          <div className="match-card">
            <div className="match-teams">
              <div className="flag" style={{background: 'none', border: 'none', padding: 0}}>
                <img src="https://hatscripts.github.io/circle-flags/flags/br.svg" alt="Brazil" width="34" height="34" />
              </div>
              <div className="minfo">
                <h4>Brazil vs Spain</h4>
                <p>Tomorrow · 18:00 UTC</p>
              </div>
              <div className="vs">VS</div>
              <div className="flag" style={{background: 'none', border: 'none', padding: 0}}>
                <img src="https://hatscripts.github.io/circle-flags/flags/es.svg" alt="Spain" width="34" height="34" />
              </div>
            </div>
          </div>
        </div>
        <div className="sidebar">
          <div className="lb-card">
            <div className="lb-title">Live leaderboard</div>
            {leaderboard.map((u) => (
              <div className="lb-row" key={u.user}>
                <span className="lb-rank">#{u.rank}</span>
                <div>
                  <div className="lb-user">{u.user} {publicKey && u.rawAddr === publicKey.toString() ? '(You)' : ''}</div>
                  <div className="lb-addr">{u.addr}</div>
                </div>
                <span className="lb-pts">{Number(u.pts).toFixed(2)} pts</span>
              </div>
            ))}
          </div>

          <div className="escrow-card" style={{ padding: '1.5rem', background: '#111513', border: '1px solid var(--cr-dd)' }}>
            <div className="escrow-title" style={{ fontSize: '18px', marginBottom: '1.5rem' }}>🎫 Your Live Tickets</div>
            
            {escrows.length === 0 ? (
              <div className="e-row" style={{color: 'var(--tm2)', fontStyle: 'italic', textAlign: 'center'}}>
                No predictions locked yet.
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--cr-dd)'}}>
                  <div className="e-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Active Tickets:</span>
                    <strong style={{ color: 'var(--tm)' }}>{escrows.length}</strong>
                  </div>
                  <div className="e-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Stake Escrowed:</span>
                    <strong style={{ color: 'var(--gd)' }}>{(escrows.length * groupData.entryFee).toFixed(2)} SOL</strong>
                  </div>
                </div>
                
                {escrows.map((esc, i) => (
                  <div key={i} style={{ 
                    marginBottom: i < escrows.length - 1 ? '1.5rem' : 0, 
                    background: 'var(--cr-dd)', 
                    padding: '1rem', 
                    borderRadius: '12px' 
                  }}>
                    <div className="e-row" style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px dashed rgba(245,240,232,0.1)' }}>
                      <strong style={{ color: 'var(--gd)', fontSize: '15px' }}>{esc.match}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--tm2)', marginTop: '4px' }}>Tx: {esc.sig.substring(0, 12)}...</div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {Array.isArray(esc.picks) ? esc.picks.map((pick, idx) => (
                        <div key={idx} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          fontSize: '13px'
                        }}>
                          <div>
                            <span style={{ color: 'var(--tm2)', textTransform: 'capitalize' }}>{pick.market}: </span>
                            <strong style={{ color: 'var(--tm)' }}>{pick.selection}</strong>
                          </div>
                          <div style={{ 
                            color: getStatusColor(pick.status), 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            fontWeight: pick.status !== 'pending' ? '800' : '500'
                          }}>
                            <span>±{pick.odds.toFixed(2)}</span>
                            <span style={{ fontSize: '14px' }}>{getStatusIcon(pick.status)}</span>
                          </div>
                        </div>
                      )) : (
                        <div style={{ fontSize: '12px', color: 'var(--tm2)' }}>Picks format incompatible (legacy).</div>
                      )}
                    </div>
                    {esc.matchStatus === 'completed' && esc.matchResult?.payouts?.[groupData.groupId] && (
                      <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '4px', marginTop: '0.75rem', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '500' }}>Match Completed</span>
                        <span style={{ fontWeight: '600' }}>
                           <a href={`https://explorer.solana.com/tx/${esc.matchResult.payouts[groupData.groupId]}?cluster=devnet`} target="_blank" rel="noreferrer" style={{ color: '#15803d', textDecoration: 'underline' }}>
                             View Payout Tx ↗
                           </a>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default GroupDashboard;
