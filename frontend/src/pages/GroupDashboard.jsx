import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';

const GroupDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { connected } = useWallet();

  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [group, setGroup] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    // 1. Fetch upcoming matches
    axios.get('http://localhost:3000/api/matches')
      .then(res => setUpcomingMatches(res.data))
      .catch(err => console.error("Error fetching matches", err));

    // 2. Fetch Group details & Leaderboard
    axios.get(`http://localhost:3000/api/groups/${id}`)
      .then(res => {
        setGroup(res.data);
        return axios.get(`http://localhost:3000/api/leaderboard/${res.data.id}`);
      })
      .then(res => {
        if (res && res.data) {
           const mappedLb = res.data.map(entry => ({
             name: entry.members?.telegram_username || 'Unknown',
             points: parseFloat(entry.total_pts) || 0,
             wallet: entry.members?.wallet_address 
               ? entry.members.wallet_address.substring(0,4) + '...' + entry.members.wallet_address.slice(-4) 
               : 'Unknown'
           }));
           setLeaderboard(mappedLb);
        }
      })
      .catch(err => console.error("Error fetching group data", err));
  }, [id]);

  const poolSize = group ? (group.entry_fee * leaderboard.length).toFixed(2) : '0.00';

  return (
    <div className="animate-enter" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', marginTop: '2rem' }}>
      {/* Matches Column */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>Group: {id}</h2>
          <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)' }}>
            💰 Pool: {poolSize} SOL
          </span>
        </div>

        <h3 style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Upcoming Matches</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {upcomingMatches.map(match => (
            <div key={match.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{match.home} vs {match.away}</h4>
                <p style={{ color: 'var(--text-muted)' }}>{match.time}</p>
              </div>
              <button 
                className="btn btn-accent" 
                onClick={() => navigate(`/group/${id}/predict/${match.id}`)}
                disabled={!connected}
              >
                Make Predictions
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>Live Leaderboard</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {leaderboard.map((user, index) => (
              <div key={user.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: index !== leaderboard.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div>
                  <span style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>#{index + 1}</span>
                  <span>{user.name}</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.wallet}</div>
                </div>
                <span style={{ fontWeight: 'bold', color: 'var(--accent-secondary)' }}>{user.points} pts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Escrow Payout Status */}
        <div className="glass-panel" style={{ padding: '1.5rem', background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.1) 0%, rgba(0,0,0,0) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <h3 style={{ marginBottom: '1rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🔒</span> Smart Escrow Status
          </h3>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: '0.5rem' }}><strong>Match:</strong> PSG vs Bayern (Completed)</p>
            <p style={{ marginBottom: '0.5rem' }}><strong>Result:</strong> No Winners (Top Score ≤ 0)</p>
            <p style={{ marginBottom: '0.5rem' }}><strong>Action:</strong> 80% Refund Protocol Activated</p>
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(16, 185, 129, 0.4)' }}>
              <span style={{ color: '#10B981', fontWeight: 'bold' }}>✅ Payout Processed</span>
              <p style={{ fontSize: '0.8rem', marginTop: '0.25rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                Sig: 5KjX...9fHq
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupDashboard;
