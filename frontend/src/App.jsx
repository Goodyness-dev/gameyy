import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

import Home from './pages/Home';
import CreateGroup from './pages/CreateGroup';
import GroupDashboard from './pages/GroupDashboard';
import PredictMatch from './pages/PredictMatch';
import JoinGroup from './pages/JoinGroup';
import Rules from './pages/Rules';
import ProtectedRoute from './components/ProtectedRoute';
import { useWallet } from '@solana/wallet-adapter-react';

const TopNav = () => {
  return (
    <nav className="nav">
      <Link to="/" className="logo">⚽ TxLINE <span className="logo-accent">Pulse</span></Link>
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Link to="/rules" style={{ color: 'var(--gd)', fontWeight: 'bold', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid transparent', whiteSpace: 'nowrap' }} onMouseEnter={e => e.currentTarget.style.borderBottom = '1px solid var(--gd)'} onMouseLeave={e => e.currentTarget.style.borderBottom = '1px solid transparent'}>
          How to Play & Rules
        </Link>
        {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && !window.solana ? (
          <a href={`https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`} className="wallet-adapter-button wallet-adapter-button-trigger" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            Open in Phantom
          </a>
        ) : (
          <WalletMultiButton />
        )}
      </div>
    </nav>
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
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
