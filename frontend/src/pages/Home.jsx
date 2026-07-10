import React, { useState } from 'react';
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
  const { setVisible } = useWalletModal();

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
        <div className="hcard" onClick={() => setVisible(true)}>
          <div className="hicon">🔗</div>
          <div>
            <h3>Connect wallet</h3>
            <p>Link your Solana wallet to step onto the pitch.</p>
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
    </div>
  );
};

export default Home;
