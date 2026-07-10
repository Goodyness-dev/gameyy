import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl, Keypair } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

import Home from './pages/Home';
import CreateGroup from './pages/CreateGroup';
import GroupDashboard from './pages/GroupDashboard';
import PredictMatch from './pages/PredictMatch';
import JoinGroup from './pages/JoinGroup';
import Rules from './pages/Rules';
import ProtectedRoute from './components/ProtectedRoute';
import { useWallet } from '@solana/wallet-adapter-react';

import { useLocation } from 'react-router-dom';

const DemoWalletButton = () => {
  const { connected, publicKey } = useWallet();
  const guestWallet = localStorage.getItem('guestWalletPubKey');
  const activeWallet = connected && publicKey ? publicKey.toString() : guestWallet;
  const location = useLocation();
  const match = location.pathname.match(/\/group\/([A-Za-z0-9]+)/);
  const inviteCode = match ? match[1] : null;
  
  const [wallet, setWallet] = React.useState(activeWallet);
  const [showPopup, setShowPopup] = React.useState(localStorage.getItem('showAirdropPopup') === 'true');
  const [balance, setBalance] = React.useState(100.00);
  
  React.useEffect(() => {
    setWallet(activeWallet);
  }, [activeWallet]);
  
  React.useEffect(() => {
    if (!wallet) return;
    const fetchBalance = async () => {
       const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
       try {
         const url = `${API_URL}/api/wallet/${wallet}/balance` + (inviteCode ? `?inviteCode=${inviteCode}` : '');
         const res = await fetch(url);
         const data = await res.json();
         if (data.balance !== undefined) setBalance(data.balance);
       } catch(e) {}
    };
    fetchBalance();
    const intervalId = setInterval(fetchBalance, 3000);
    return () => clearInterval(intervalId);
  }, [wallet, inviteCode]);

  React.useEffect(() => {
    if (showPopup) {
      localStorage.removeItem('showAirdropPopup');
      setTimeout(() => setShowPopup(false), 5000);
    }
  }, [showPopup]);
  
  const handleCreate = async () => {
    const newWallet = Keypair.generate();
    const pubKey = newWallet.publicKey.toBase58();
    localStorage.setItem('guestWalletPubKey', pubKey);
    localStorage.setItem('guestWalletSecret', JSON.stringify(Array.from(newWallet.secretKey)));
    localStorage.setItem('showAirdropPopup', 'true');
    
    setWallet(pubKey);
    
    try {
       const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
       await fetch(`${API_URL}/api/wallet/airdrop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet_address: pubKey })
       });
    } catch(e) { console.error(e); }

    window.location.reload(); 
  };

  return (
    <>
      {showPopup && (
        <div className="airdrop-popup">
          <span style={{ fontSize: '24px' }}>🎉</span>
          <div>
            <div style={{ fontSize: '16px', marginBottom: '4px' }}>Wallet Created Successfully!</div>
            <div style={{ fontSize: '13px', fontWeight: '600', opacity: 0.8 }}>100 PULSE Tokens have been airdropped to your wallet.</div>
          </div>
        </div>
      )}
      
      {wallet ? (
        <div className="wallet-balance-container">
          <div className="wallet-balance-pill">
            🪙 {balance.toFixed(2)} PULSE
          </div>
          <div className="wallet-addr-pill">💳 {wallet.substring(0,6)}...</div>
        </div>
      ) : (
        <button className="btn-s" style={{padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 'bold'}} onClick={handleCreate}>Create Wallet</button>
      )}
    </>
  );
};

const TopNav = () => {
  return (
    <nav className="nav">
      <Link to="/" className="logo">⚽ TxLINE <span className="logo-accent">Pulse</span></Link>
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && (
          <Link to="/rules" style={{ color: 'var(--gd)', fontWeight: 'bold', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid transparent', whiteSpace: 'nowrap' }} onMouseEnter={e => e.currentTarget.style.borderBottom = '1px solid var(--gd)'} onMouseLeave={e => e.currentTarget.style.borderBottom = '1px solid transparent'}>
            How to Play & Rules
          </Link>
        )}
        {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && !window.solana ? (
          <a href={`https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`} className="wallet-adapter-button wallet-adapter-button-trigger" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            Open in Phantom
          </a>
        ) : (
          <DemoWalletButton />
        )}
      </div>
    </nav>
  );
};

const Footer = () => {
  if (!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return null;
  return (
    <footer style={{ textAlign: 'center', padding: '30px 20px', marginTop: '40px' }}>
      <Link to="/rules" style={{ color: 'var(--gd)', fontWeight: 'bold', textDecoration: 'none', fontSize: '14px', background: 'var(--gr-dk)', padding: '10px 20px', borderRadius: '8px' }}>
        How to Play & Rules
      </Link>
    </footer>
  );
};

const App = () => {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <BrowserRouter>
            <TopNav />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/join" element={<JoinGroup />} />
                <Route path="/create" element={<CreateGroup />} />
                <Route path="/group/:id" element={<GroupDashboard />} />
                <Route path="/group/:id/predict" element={<PredictMatch />} />
                <Route path="/group/join/:id" element={<ProtectedRoute><JoinGroup /></ProtectedRoute>} />
              </Route>
              <Route path="/rules" element={<Rules />} />
            </Routes>
            <Footer />
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
