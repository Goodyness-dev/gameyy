import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';

const CreateGroup = () => {
  const navigate = useNavigate();
  const { connected } = useWallet();
  const [groupName, setGroupName] = useState('');
  const [entryFee, setEntryFee] = useState(0);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!connected) return alert("Wallet not connected");
    // API Call to backend to create group
    // Mock response:
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    alert(`Group created! Invite Code: ${inviteCode}`);
    navigate(`/group/${inviteCode}`);
  };

  return (
    <div className="glass-panel animate-enter" style={{ padding: '2rem', maxWidth: '500px', margin: '2rem auto' }}>
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>Create a New Group</h2>
      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="input-group">
          <label className="input-label">Group Name</label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="e.g. Degens Only" 
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label className="input-label">Entry Fee (SOL)</label>
          <input 
            type="number" 
            step="0.01"
            className="input-field" 
            placeholder="0.0" 
            value={entryFee}
            onChange={(e) => setEntryFee(parseFloat(e.target.value))}
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Set to 0 for a free-to-play group.</span>
        </div>
        <button type="submit" className="btn btn-accent" style={{ marginTop: '1rem' }}>
          Create & Get Invite Link
        </button>
      </form>
    </div>
  );
};

export default CreateGroup;
