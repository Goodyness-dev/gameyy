import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const ProtectedRoute = ({ children }) => {
  const { connected } = useWallet();
  const [hasPhantom, setHasPhantom] = useState(true);

  useEffect(() => {
    // Check if Phantom is injected in the window object
    const checkPhantom = () => {
      const isPhantomInstalled = window.phantom?.solana?.isPhantom || window.solana?.isPhantom;
      setHasPhantom(!!isPhantomInstalled);
    };

    // Small delay to allow extensions to inject
    setTimeout(checkPhantom, 500);
  }, []);

  if (!connected) {
    return (
      <div className="wrap" style={{ textAlign: 'center', marginTop: '4rem', minHeight: '60vh' }}>
        <h2 style={{ fontSize: '36px', marginBottom: '1rem', color: 'var(--tm)' }}>Wallet Connection Required</h2>
        <p style={{ color: 'var(--tm2)', marginBottom: '2.5rem', fontSize: '16px' }}>
          You need to connect your Solana wallet before you can join groups or make predictions.
        </p>
        
        {!hasPhantom ? (
          <div style={{ background: '#fff', border: '2px solid #ff6b6b', padding: '2.5rem', borderRadius: '16px', maxWidth: '500px', margin: '0 auto', boxShadow: '0 8px 24px rgba(255,107,107,0.15)' }}>
            <div style={{ fontSize: '40px', marginBottom: '1rem' }}>👻</div>
            <h3 style={{ color: '#ff6b6b', marginBottom: '1rem', fontSize: '22px' }}>Phantom Wallet Not Detected</h3>
            <p style={{ marginBottom: '2rem', color: 'var(--tm)', fontSize: '15px', lineHeight: '1.6' }}>
              We highly recommend using Phantom Wallet for the best experience. It looks like you don't have the browser extension installed.
            </p>
            <a href="https://phantom.app/download" target="_blank" rel="noreferrer" className="btn-g" style={{ textDecoration: 'none', display: 'inline-block', width: '100%' }}>
              Download Phantom Extension
            </a>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '2px solid var(--cr-dd)', padding: '3rem', borderRadius: '16px', maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '1rem' }}>🔐</div>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '20px' }}>Connect to Continue</h3>
            <WalletMultiButton />
          </div>
        )}
      </div>
    );
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
