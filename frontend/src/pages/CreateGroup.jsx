import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import Modal from '../components/Modal';

const CreateGroup = () => {
  const navigate = useNavigate();
  const { connected, publicKey } = useWallet();
  const [groupName, setGroupName] = useState('');
  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: '', title: '', desc: '', action: null });

  const handleCreate = async (e) => {
    e.preventDefault();
    
    let activeWallet = connected && publicKey ? publicKey.toString() : localStorage.getItem('guestWalletPubKey');
    if (!activeWallet && !connected) {
      activeWallet = 'GUEST_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      localStorage.setItem('guestWalletPubKey', activeWallet);
    }
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_URL}/api/groups/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          created_by: activeWallet
        })
      });
      
      if (!res.ok) throw new Error('Failed to create group');
      
      const data = await res.json();
      navigate(`/group/${data.invite_code}`);
    } catch (err) {
      setModalConfig({ isOpen: true, type: 'error', title: 'Error', desc: err.message });
    }
  };

  return (
    <div className="wrap" style={{ maxWidth: '600px' }}>
      <div className="lb-card" style={{ marginTop: '2rem', padding: '2rem' }}>
        <div className="lb-title" style={{ fontSize: '24px', textAlign: 'center', marginBottom: '1.5rem' }}>
          ⚽ Create a New Group
        </div>
        
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '12px', color: 'var(--gd)', marginBottom: '6px', letterSpacing: '1px' }}>
              GROUP NAME
            </label>
            <input 
              type="text" 
              placeholder="e.g. Degens Only" 
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 14px', border: '2px solid var(--cr-dd)', 
                borderRadius: '12px', background: '#fff', fontFamily: "'Nunito', sans-serif", 
                fontSize: '14px', color: 'var(--tm)', outline: 'none'
              }}
            />
          </div>
          

          <button type="submit" className="btn-g" style={{ width: '100%', marginTop: '1rem', fontSize: '16px' }}>
            Create & Generate Invite
          </button>

          <Link to="/" style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'rgba(245,240,232,0.6)', textDecoration: 'none' }}>
            ← Cancel and go back
          </Link>
        </form>
      </div>
      
      <Modal 
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        desc={modalConfig.desc}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
      />
    </div>
  );
};

export default CreateGroup;
