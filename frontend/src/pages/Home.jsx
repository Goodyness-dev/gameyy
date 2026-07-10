import React, { useState } from 'react';
import { Keypair } from '@solana/web3.js';
import { Link, useNavigate } from 'react-router-dom';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import Modal from '../components/Modal';

const winners = [
  { year: 2022, team: 'Argentina', code: 'ar' },
  { year: 2018, team: 'France', code: 'fr' },
  { year: 2014, team: 'Germany', code: 'de' },
  { year: 2010, team: 'Spain', code: 'es' },
  { year: 2006, team: 'Italy', code: 'it' },
  { year: 2002, team: 'Brazil', code: 'br' },
  { year: 1998, team: 'France', code: 'fr' },
  { year: 1994, team: 'Brazil', code: 'br' }
];

const Home = () => {
  const navigate = useNavigate();
  const { connected, publicKey } = useWallet();
  const guestWallet = localStorage.getItem('guestWalletPubKey');
  const activeWallet = connected && publicKey ? publicKey.toString() : guestWallet;
  
  const [myGroups, setMyGroups] = useState([]);

  React.useEffect(() => {
    if (!activeWallet) return;
    const fetchMyGroups = async () => {
       const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
       try {
         const res = await fetch(`${API_URL}/api/groups/my-groups/${activeWallet}`);
         const data = await res.json();
         if (Array.isArray(data)) setMyGroups(data);
       } catch(e) {}
    };
    fetchMyGroups();
  }, [activeWallet]);

  const handleCreateWallet = async () => {
    if (!localStorage.getItem('guestWalletPubKey')) {
      const newWallet = Keypair.generate();
      const pubKey = newWallet.publicKey.toBase58();
      
      localStorage.setItem('guestWalletPubKey', pubKey);
      localStorage.setItem('guestWalletSecret', JSON.stringify(Array.from(newWallet.secretKey)));
      
      try {
         const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
         await fetch(`${API_URL}/api/wallet/airdrop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet_address: pubKey })
         });
      } catch(e) {}
      
      window.location.reload();
    }
  };

  return (
    <div className="wrap">
      <div className="hero">
        <div className="hero-grid"></div>
        <div className="hero-circle"></div>
        <div className="badge">⚽ WORLD CUP 2026 · POWERED BY TxLINE</div>
        <h1 className="htitle">PREDICT.<br/><em>POOL. WIN.</em></h1>
        <p className="hsub">Connect your wallet, join a group, pick your markets before kickoff.</p>
        <div className="hbtns">
          <Link to="/create" className="btn-g" style={{textDecoration: 'none'}}>⚽ Create a group</Link>
          <button 
            className="btn-s" 
            style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}} 
            onClick={() => navigate('/join')}
          >
            Join a group
          </button>
        </div>
      </div>

      <div className="carousel-wrap">
        <div className="carousel-track">
          {[...winners, ...winners].map((w, i) => (
            <div key={i} className="carousel-item">
              <span className="year">{w.year}</span> 
              <img src={`https://flagcdn.com/w40/${w.code}.png`} alt={`${w.team} flag`} className="carousel-flag" />
              {w.team}
            </div>
          ))}
        </div>
      </div>

      <div className="how">
        <div className="hcard" onClick={handleCreateWallet}>
          <div className="hicon">💳</div>
          <div>
            <h3>Create Wallet</h3>
            <p>Generate a free demo wallet to step onto the pitch without installing Phantom.</p>
          </div>
        </div>
        <div className="hcard" onClick={() => navigate('/join')}>
          <div className="hicon">🏟️</div>
          <div>
            <h3>Join a group</h3>
            <p>Pay the custom entry fee in SOL to enter your prediction group.</p>
          </div>
        </div>
      </div>

      {myGroups.length > 0 && (
        <div style={{ padding: '0 20px', maxWidth: '1000px', margin: '40px auto 60px auto' }}>
          <h2 style={{ color: 'var(--tm)', marginBottom: '15px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{color: 'var(--gd)'}}>🔥</span> Your Active Groups
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
            {myGroups.map(g => (
              <div 
                key={g.id}
                onClick={() => navigate(`/group/${g.invite_code}`)}
                style={{
                  background: 'var(--gr-dk)', border: '1px solid var(--gd)', borderRadius: '12px',
                  padding: '16px 20px', cursor: 'pointer', flex: '1 1 250px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)', transition: 'transform 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--tm)', marginBottom: '4px' }}>{g.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--td)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Code: <strong style={{color: 'var(--gd)'}}>{g.invite_code}</strong></span>
                  <span>Enter ➔</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
