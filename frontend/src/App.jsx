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
import ProtectedRoute from './components/ProtectedRoute';
import { useWallet } from '@solana/wallet-adapter-react';

const TopNav = () => {
  return (
    <nav className="nav">
      <Link to="/" className="logo">⚽ TxLINE <span className="logo-accent">Pulse</span></Link>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <WalletMultiButton />
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
              </Route>
            </Routes>
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
