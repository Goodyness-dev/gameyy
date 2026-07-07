import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

const App = () => {
  // Set to 'devnet' for development
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="bg-gradient-glow"></div>
          <div className="bg-gradient-glow-alt"></div>
          <BrowserRouter>
            <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
              <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ color: 'var(--accent-primary)', fontSize: '1.5rem', margin: 0 }}>TxLINE Pulse</h1>
                <WalletMultiButton style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }} />
              </nav>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/create" element={<CreateGroup />} />
                <Route path="/group/:id" element={<GroupDashboard />} />
                <Route path="/group/:id/predict/:matchId" element={<PredictMatch />} />
              </Routes>
            </div>
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
