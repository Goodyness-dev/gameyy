/**
 * TxLINE Setup Script
 * 
 * This script handles the full TxLINE API activation flow:
 * 1. Subscribe on-chain to the FREE World Cup tier (Service Level 1)
 * 2. Get a guest JWT session
 * 3. Sign the activation message
 * 4. Activate the API token
 * 5. Save credentials to .env
 * 
 * Usage: node setup-txline.js
 * 
 * Prerequisites:
 *   - Your wallet (TREASURY_PRIVATE_KEY in .env) needs some devnet SOL for tx fees
 *   - Run `solana airdrop 2 <your-pubkey> --url devnet` if needed
 */

import * as anchor from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import axios from 'axios';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// ── Network Config (matches TxLINE docs exactly) ──────────────────────
const NETWORK = 'devnet';

const CONFIG = {
  mainnet: {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    apiOrigin: 'https://txline.txodds.com',
    programId: new PublicKey('9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA'),
    txlTokenMint: new PublicKey('Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL'),
  },
  devnet: {
    rpcUrl: 'https://api.devnet.solana.com',
    apiOrigin: 'https://txline-dev.txodds.com',
    programId: new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J'),
    txlTokenMint: new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG'),
  },
};

const { rpcUrl, apiOrigin, programId, txlTokenMint } = CONFIG[NETWORK];
const apiBaseUrl = `${apiOrigin}/api`;

// ── Free Tier Config ──────────────────────────────────────────────────
const SERVICE_LEVEL_ID = 1;   // World Cup & Int Friendlies (60s delay, FREE)
const DURATION_WEEKS = 4;      // 4 weeks (28 days)
const SELECTED_LEAGUES = [];   // Empty = standard bundle

// ── Load wallet from .env ─────────────────────────────────────────────
const privateKeyString = process.env.TREASURY_PRIVATE_KEY;
if (!privateKeyString || privateKeyString.includes('your_')) {
  console.error('❌ No valid TREASURY_PRIVATE_KEY found in .env');
  console.error('   Add your Solana wallet private key (base58) to .env');
  process.exit(1);
}

let walletKeypair;
try {
  walletKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyString));
} catch (e) {
  console.error('❌ Invalid TREASURY_PRIVATE_KEY format:', e.message);
  process.exit(1);
}

console.log(`\n🔑 Wallet: ${walletKeypair.publicKey.toBase58()}`);
console.log(`🌐 Network: ${NETWORK}`);
console.log(`📡 API: ${apiOrigin}\n`);

// ── Setup Anchor ──────────────────────────────────────────────────────
const connection = new Connection(rpcUrl, 'confirmed');

// Create a wallet adapter from the keypair
const wallet = {
  publicKey: walletKeypair.publicKey,
  signTransaction: async (tx) => {
    tx.partialSign(walletKeypair);
    return tx;
  },
  signAllTransactions: async (txs) => {
    txs.forEach(tx => tx.partialSign(walletKeypair));
    return txs;
  },
};

const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: 'confirmed',
});
anchor.setProvider(provider);

// Load the IDL
const idlPath = path.join(__dirname, 'idl', 'txoracle.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
const program = new anchor.Program(idl, provider);

async function main() {
  try {
    // ── Step 0: Check SOL balance ──────────────────────────────────
    const balance = await connection.getBalance(walletKeypair.publicKey);
    const solBalance = balance / 1e9;
    console.log(`💰 SOL Balance: ${solBalance} SOL`);
    
    if (solBalance < 0.01) {
      console.error('❌ Insufficient SOL for transaction fees.');
      console.error(`   Run: solana airdrop 2 ${walletKeypair.publicKey.toBase58()} --url devnet`);
      process.exit(1);
    }

    // ── Step 1: Subscribe on-chain (FREE) ──────────────────────────
    console.log('\n📝 Step 1: Subscribing on-chain (Free World Cup Tier)...');

    const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('token_treasury_v2')],
      programId
    );

    const tokenTreasuryVault = getAssociatedTokenAddressSync(
      txlTokenMint,
      tokenTreasuryPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pricing_matrix')],
      programId
    );

    // Check if the user's TxL token account exists, create it if not
    const userTokenAccount = getAssociatedTokenAddressSync(
      txlTokenMint,
      walletKeypair.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    try {
      await getAccount(connection, userTokenAccount, 'confirmed', TOKEN_2022_PROGRAM_ID);
      console.log('   Token account already exists, skipping creation.');
    } catch {
      console.log('   Creating TxL token account...');
      const createAtaIx = createAssociatedTokenAccountInstruction(
        walletKeypair.publicKey,   // payer
        userTokenAccount,          // ata address
        walletKeypair.publicKey,   // owner
        txlTokenMint,              // mint
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const ataTx = new anchor.web3.Transaction().add(createAtaIx);
      const ataSig = await anchor.web3.sendAndConfirmTransaction(connection, ataTx, [walletKeypair]);
      console.log(`   ✅ Token account created: ${ataSig}`);
    }

    const txSig = await program.methods
      .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
      .accounts({
        user: walletKeypair.publicKey,
        pricingMatrix: pricingMatrixPda,
        tokenMint: txlTokenMint,
        userTokenAccount,
        tokenTreasuryVault,
        tokenTreasuryPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ Subscription tx: ${txSig}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);

    // ── Step 2: Get guest JWT ──────────────────────────────────────
    console.log('\n🔐 Step 2: Starting guest session...');
    
    const authResponse = await axios.post(`${apiOrigin}/auth/guest/start`);
    const jwt = authResponse.data.token;
    console.log(`✅ Guest JWT obtained`);

    // ── Step 3: Sign activation message ────────────────────────────
    console.log('\n✍️  Step 3: Signing activation message...');

    const messageString = `${txSig}:${SELECTED_LEAGUES.join(',')}:${jwt}`;
    const message = new TextEncoder().encode(messageString);
    const signatureBytes = nacl.sign.detached(message, walletKeypair.secretKey);
    const walletSignature = Buffer.from(signatureBytes).toString('base64');
    console.log(`✅ Message signed`);

    // ── Step 4: Activate API token ─────────────────────────────────
    console.log('\n🚀 Step 4: Activating API token...');

    const activationResponse = await axios.post(
      `${apiBaseUrl}/token/activate`,
      {
        txSig,
        walletSignature,
        leagues: SELECTED_LEAGUES,
      },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );

    const apiToken = activationResponse.data.token || activationResponse.data;
    console.log(`✅ API Token activated!`);

    // ── Step 5: Save credentials to .env ───────────────────────────
    console.log('\n💾 Step 5: Saving credentials to .env...');

    let envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');

    // Update or add TXLINE_JWT
    if (envContent.includes('TXLINE_JWT=')) {
      envContent = envContent.replace(/TXLINE_JWT=.*/g, `TXLINE_JWT=${jwt}`);
    } else {
      envContent += `\n# TxLINE API Credentials (auto-generated by setup-txline.js)\nTXLINE_JWT=${jwt}\n`;
    }

    // Update or add TXLINE_API_TOKEN
    if (envContent.includes('TXLINE_API_TOKEN=')) {
      envContent = envContent.replace(/TXLINE_API_TOKEN=.*/g, `TXLINE_API_TOKEN=${apiToken}`);
    } else {
      envContent += `TXLINE_API_TOKEN=${apiToken}\n`;
    }

    // Update or add TXLINE_NETWORK
    if (envContent.includes('TXLINE_NETWORK=')) {
      envContent = envContent.replace(/TXLINE_NETWORK=.*/g, `TXLINE_NETWORK=${NETWORK}`);
    } else {
      envContent += `TXLINE_NETWORK=${NETWORK}\n`;
    }

    fs.writeFileSync(path.join(__dirname, '.env'), envContent);
    console.log(`✅ Credentials saved to .env`);

    // ── Step 6: Test the API ───────────────────────────────────────
    console.log('\n🧪 Step 6: Testing API access...');

    try {
      const testResponse = await axios.get(`${apiBaseUrl}/fixtures/snapshot`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'X-Api-Token': apiToken,
        },
      });
      const fixtures = testResponse.data;
      console.log(`✅ API working! Got ${Array.isArray(fixtures) ? fixtures.length : 'some'} fixtures`);
      
      // Show upcoming future matches
      if (Array.isArray(fixtures) && fixtures.length > 0) {
        const now = Date.now();
        const upcoming = fixtures
          .filter(f => new Date(f.StartTime).getTime() > now)
          .sort((a, b) => new Date(a.StartTime) - new Date(b.StartTime))
          .slice(0, 5);
        
        if (upcoming.length > 0) {
          console.log(`\n   📅 Upcoming future matches:`);
          upcoming.forEach((f, i) => {
            const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
            const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
            console.log(`   ${i + 1}. ${home} vs ${away} — ${new Date(f.StartTime).toISOString()} (ID: ${f.FixtureId})`);
          });
          console.log(`\n   Use these FixtureIds to fetch pre-match odds via /api/odds/snapshot/{fixtureId}`);
        }
      }
    } catch (testErr) {
      console.log(`⚠️  API test returned: ${testErr.response?.status || testErr.message}`);
      console.log('   This may be normal if there are no active fixtures right now.');
    }

    // ── Done ───────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 TxLINE setup complete!');
    console.log('═'.repeat(60));
    console.log(`\n   Network:    ${NETWORK}`);
    console.log(`   Tier:       Free World Cup (Service Level ${SERVICE_LEVEL_ID})`);
    console.log(`   Duration:   ${DURATION_WEEKS * 7} days`);
    console.log(`   Tx:         ${txSig}`);
    console.log(`\n   Your backend will now fetch LIVE odds from TxODDS.`);
    console.log(`   Restart the backend server to pick up the new credentials.\n`);

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    if (error.response?.data) {
      console.error('   API response:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.logs) {
      console.error('   Program logs:', error.logs);
    }
    process.exit(1);
  }
}

main();
