import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const ProtectedRoute = ({ children }) => {
  const { connected } = useWallet();
  const [hasPhantom, setHasPhantom] = useState(true);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const guestWallet = localStorage.getItem('guestWalletPubKey');

  if (!connected && !guestWallet) {
    return (
      <div className="wrap" style={{ textAlign: 'center', marginTop: '4rem', minHeight: '60vh' }}>
        <h2 style={{ fontSize: '36px', marginBottom: '1rem', color: 'var(--tm)' }}>Wallet Connection Required</h2>
        <p style={{ color: 'var(--tm2)', marginBottom: '2.5rem', fontSize: '16px' }}>
          You need to create your embedded wallet to receive your 100 PULSE tokens before you can join groups or make predictions.
        </p>
        
        <div style={{ background: '#fff', border: '2px solid var(--cr-dd)', padding: '2.5rem', borderRadius: '16px', maxWidth: '500px', margin: '0 auto', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '40px', marginBottom: '1rem' }}>💳</div>
          <h3 style={{ color: 'var(--gr-dk)', marginBottom: '1rem', fontSize: '22px' }}>No Wallet Found</h3>
          
          <p style={{ marginBottom: '2rem', color: 'var(--tm)', fontSize: '15px', lineHeight: '1.6' }}>
            Click the button below to go back to the home page and create your invisible embedded wallet!
          </p>
          <a href="/" className="btn-g" style={{ textDecoration: 'none', display: 'inline-block', width: '100%' }}>
            ← Go to Home
          </a>
        </div>
      </div>
    );
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
