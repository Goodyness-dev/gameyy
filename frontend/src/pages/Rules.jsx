import React from 'react';
import { Link } from 'react-router-dom';

const Rules = () => {
  return (
    <div className="wrap" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', color: 'var(--tm2)' }}>
      <div style={{ background: 'var(--cr)', padding: '40px', borderRadius: '24px', border: '1px solid var(--cr-dd)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
        
        <h1 style={{ color: 'var(--gd)', marginBottom: '24px', fontSize: '28px' }}>📜 How to Play TxLINE Pulse</h1>
        
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: 'black', fontSize: '20px', marginBottom: '12px' }}>1. Create Wallet & Claim Tokens</h2>
          <p style={{ lineHeight: '1.6' }}>
            Start by clicking <strong>Create Wallet</strong> to generate a free demo wallet instantly in your browser. You don't need Phantom or any real crypto! 
            Upon creation, you will automatically be airdropped <strong style={{ color: 'var(--gd)' }}>100.00 PULSE</strong> tokens to play with.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: 'black', fontSize: '20px', marginBottom: '12px' }}>2. Lock Your Picks (Additive Point System)</h2>
          <p style={{ lineHeight: '1.6' }}>
            Before matches begin, use your PULSE tokens to lock in predictions. Instead of traditional parlays where one loss destroys your slip, TxLINE Pulse uses a forgiving <strong>Additive Point System</strong>.
          </p>
          <ul style={{ marginTop: '12px', paddingLeft: '20px', lineHeight: '1.6' }}>
            <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--gd)' }}>Winning a Pick:</strong> Adds its odds to your match multiplier (e.g., +2.0).</li>
            <li style={{ marginBottom: '8px' }}><strong style={{ color: '#ff4444' }}>Losing a Pick:</strong> Subtracts its odds from your match multiplier (e.g., -1.5).</li>
            <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--gd)' }}>Final Payout:</strong> If your final multiplier sum is positive, you win your wager multiplied by that sum! If it's zero or negative, you lose your wager.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: 'black', fontSize: '20px', marginBottom: '12px' }}>3. The Dynamic Live Leaderboard</h2>
          <p style={{ lineHeight: '1.6' }}>
            As the matches happen, our demo engine resolves outcomes in real-time. 
            Your payouts are instantly credited to your global wallet balance.
            Your total PULSE balance determines your exact rank on the Group Leaderboard, which dynamically updates live alongside the matches!
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: 'black', fontSize: '20px', marginBottom: '12px' }}>🏆 4. Winning the Pool</h2>
          <p style={{ lineHeight: '1.6' }}>
            At the end of the tournament, the player sitting at <strong>Rank #1</strong> on the leaderboard takes the crown. Maintain the highest PULSE balance across your group to secure victory!
          </p>
        </section>


        <section style={{ marginBottom: '32px', background: 'rgba(255, 193, 7, 0.1)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 193, 7, 0.4)' }}>
          <h2 style={{ color: '#ffb300', fontSize: '20px', marginBottom: '12px' }}>⚠️ Hackathon Disclaimer & Legal Notice</h2>
          <p style={{ lineHeight: '1.6', color: 'var(--tm2)' }}>
            This application is a <strong>Technical Proof of Concept</strong> built exclusively for the TxODDS x Superteam Earn Hackathon. It operates strictly on the <strong>Solana Devnet</strong> using valueless test tokens. <br/><br/>
            TxLINE Pulse does <strong>NOT</strong> facilitate real-money gambling, illegal wagering, or actual financial escrow. The functionality demonstrated here is a simulation of smart-contract logic and real-time data synchronization intended purely for educational and competition evaluation purposes.
          </p>
        </section>

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Link to="/" className="btn-g" style={{ padding: '14px 32px', fontSize: '16px', textDecoration: 'none', borderRadius: '30px' }}>
            ← Back to Home
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Rules;
