import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';

const JoinGroup = () => {
  const navigate = useNavigate();
  const { connected, publicKey } = useWallet();
  const [groupCode, setGroupCode] = useState('');
  const [error, setError] = useState('');

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    if (!groupCode || !groupCode.trim()) return;
    
    let activeWallet = connected && publicKey ? publicKey.toString() : localStorage.getItem('guestWalletPubKey');
    if (!activeWallet && !connected) {
      activeWallet = 'GUEST_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      localStorage.setItem('guestWalletPubKey', activeWallet);
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_URL}/api/groups/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_code: groupCode.trim(),
          wallet_address: activeWallet,
          telegram_username: `@${activeWallet.substring(0,8)}` // Demo mock
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to join group');
      }

      navigate(`/group/${groupCode.trim()}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="wrap">
      <div className="escrow-card" style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ fontSize: '40px', marginBottom: '1rem' }}>🏟️</div>
        <h2 style={{ fontSize: '28px', marginBottom: '1rem', color: 'var(--tm)' }}>Join a Group</h2>
        <p style={{ color: 'var(--tm2)', marginBottom: '2rem' }}>Enter your group invite code to step onto the pitch.</p>
        
        <form onSubmit={handleJoinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            type="text" 
            value={groupCode} 
            onChange={(e) => setGroupCode(e.target.value)} 
            placeholder="e.g. LM79C3"
            style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '2px solid var(--cr-dd)', fontSize: '16px', textAlign: 'center', fontWeight: 'bold', letterSpacing: '2px' }}
          />
          {error && <div style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>{error}</div>}
          <button type="submit" className="btn-g" style={{ width: '100%' }}>Join Group</button>
        </form>
      </div>
    </div>
  );
};

export default JoinGroup;
