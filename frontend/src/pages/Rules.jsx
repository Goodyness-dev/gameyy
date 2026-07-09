import React from 'react';
import { Link } from 'react-router-dom';

const Rules = () => {
  return (
    <div className="wrap" style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', color: 'var(--tm2)' }}>
      <div style={{ background: 'var(--cr)', padding: '40px', borderRadius: '24px', border: '1px solid var(--cr-dd)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
        
        <h1 style={{ color: 'var(--gd)', marginBottom: '24px', fontSize: '28px' }}>📜 How to Play TxLINE Pulse</h1>
        
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: 'black', fontSize: '20px', marginBottom: '12px' }}>1. Join a Group & Pay the Entry Fee</h2>
          <p style={{ lineHeight: '1.6' }}>
            To participate, you must join a private group via an invite code and pay the Solana entry fee using your Phantom wallet. 
            The entry fee is locked securely in our smart contract escrow for the duration of the match.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: 'black', fontSize: '20px', marginBottom: '12px' }}>2. Make Your Predictions</h2>
          <p style={{ lineHeight: '1.6' }}>
            Before a match begins, you can predict the outcomes of various "Flash Markets" (e.g., Who will score next? Will there be a red card?).
            Each prediction has associated odds. 
          </p>
          <ul style={{ marginTop: '12px', paddingLeft: '20px', lineHeight: '1.6' }}>
            <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--gd)' }}>Winning a Pick:</strong> You earn positive points equal to the odds (e.g., +2.50 pts).</li>
            <li style={{ marginBottom: '8px' }}><strong style={{ color: '#ff4444' }}>Losing a Pick:</strong> You lose points equal to the odds (e.g., -2.50 pts).</li>
            <li style={{ marginBottom: '8px' }}><strong style={{ color: 'var(--tm2)' }}>Pending Picks:</strong> Do not affect your score until the event occurs or the match ends.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: 'black', fontSize: '20px', marginBottom: '12px' }}>3. The Live Leaderboard</h2>
          <p style={{ lineHeight: '1.6' }}>
            As the match happens in real-time, the Telegram Bot and Web Live Chat will announce goals and events. 
            Your predictions are instantly settled, and the Group Leaderboard will actively update your net points!
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ color: 'black', fontSize: '20px', marginBottom: '12px' }}>🏆 4. Winning the Pool & Payouts</h2>
          <p style={{ lineHeight: '1.6' }}>
            When the match officially concludes, the player(s) sitting at <strong>Rank #1</strong> on the leaderboard will take home the entire accumulated SOL Pool! 
            The smart contract will automatically execute the payout directly to your Phantom wallet.
          </p>
        </section>

        <section style={{ marginBottom: '32px', background: 'rgba(255, 68, 68, 0.05)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 68, 68, 0.2)' }}>
          <h2 style={{ color: '#ff4444', fontSize: '20px', marginBottom: '12px' }}>🛡️ The 80% Safety Refund Protocol</h2>
          <p style={{ lineHeight: '1.6', color: 'var(--tm2)' }}>
            What happens if the match is extremely boring and <strong>NOBODY</strong> in your group scores a single positive point?
            <br/><br/>
            If the highest score on the leaderboard is exactly <strong style={{color: '#fff'}}>0.00 pts</strong> or lower at the end of the match, TxLINE's Safety Protocol kicks in.
            Instead of giving the pool to someone who didn't win anything, <strong style={{color: '#fff'}}>80% of the entire pool is automatically refunded</strong> evenly back to all players in the group! 
            (The remaining 20% is retained as the protocol fee).
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
