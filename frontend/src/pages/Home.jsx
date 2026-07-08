import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import Modal from '../components/Modal';

const Home = () => {
  const navigate = useNavigate();
  const { setVisible } = useWalletModal();
  const { connected, publicKey } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [groupCode, setGroupCode] = useState('');
  const [errorModal, setErrorModal] = useState({ isOpen: false, type: 'error', title: '', desc: '' });

  const handleJoinSubmit = async () => {
    if (!groupCode || !groupCode.trim()) return;
    
    if (!connected) {
      setErrorModal({ isOpen: true, type: 'error', title: 'Wallet Not Connected', desc: 'Please connect your Solana wallet first.' });
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_URL}/api/groups/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_code: groupCode.trim(),
          wallet_address: publicKey.toString(),
          telegram_username: `@${publicKey.toString().substring(0,5)}` // Demo mock
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to join group');
      }

      setShowModal(false);
      navigate(`/group/${groupCode.trim()}`);
    } catch (err) {
      setErrorModal({ isOpen: true, type: 'error', title: 'Error', desc: err.message });
    }
  };

  return (
    <div className="wrap">
      <div className="hero">
        <div className="hero-grid"></div>
        <div className="hero-circle"></div>
        <div className="badge">⚽ WORLD CUP 2026 · POWERED BY TxLINE</div>
        <h1 className="htitle">PREDICT.<br/><em>STAKE. WIN.</em></h1>
        <p className="hsub">Connect your wallet, join a group, pick your markets before kickoff.</p>
        <div className="hbtns">
          <Link to="/create" className="btn-g" style={{textDecoration: 'none'}}>⚽ Create a group</Link>
          <button 
            className="btn-s" 
            style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}} 
            onClick={() => setShowModal(true)}
          >
            Join a group
          </button>
        </div>
      </div>

      <Modal 
        isOpen={showModal}
        type="prompt"
        title="Join a Group"
        desc="Enter the group code to join."
        inputValue={groupCode}
        setInputValue={setGroupCode}
        onClose={() => { setShowModal(false); setGroupCode(''); }}
        onSubmit={handleJoinSubmit}
      />

      <Modal 
        isOpen={errorModal.isOpen}
        type={errorModal.type}
        title={errorModal.title}
        desc={errorModal.desc}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
      />

      <div className="how">
        <div className="hcard" onClick={() => setVisible(true)}>
          <div className="hicon">🔗</div>
          <div>
            <h3>Connect wallet</h3>
            <p>Link your Solana wallet to step onto the pitch.</p>
          </div>
        </div>
        <div className="hcard" onClick={() => setShowModal(true)}>
          <div className="hicon">🏟️</div>
          <div>
            <h3>Join a group</h3>
            <p>Pay 0.1 SOL to enter your prediction group.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
