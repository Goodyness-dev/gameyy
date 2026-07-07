import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';

const Home = () => {
  const navigate = useNavigate();
  const { connected } = useWallet();

  return (
    <div className="glass-panel animate-enter" style={{ padding: '3rem', textAlign: 'center', marginTop: '4rem' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>World Cup 2026 Live Predictor</h1>
      <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '3rem', maxWidth: '600px', margin: '0 auto 3rem auto' }}>
        Connect your wallet, join a group, and make your picks before kickoff. Powered by TxLINE real-time data.
      </p>
      
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button 
          className="btn btn-accent" 
          style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}
          onClick={() => navigate('/create')}
          disabled={!connected}
        >
          Create a Group
        </button>
        <button 
          className="btn btn-outline" 
          style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}
          onClick={() => {
            const code = prompt("Enter Invite Code:");
            if(code) navigate(`/group/${code}`);
          }}
          disabled={!connected}
        >
          Join a Group
        </button>
      </div>
      {!connected && (
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Please connect your Solana wallet to continue.
        </p>
      )}
    </div>
  );
};

export default Home;
