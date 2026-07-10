import { Connection, Keypair } from '@solana/web3.js';
import { createMint } from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const privateKeyString = process.env.TREASURY_PRIVATE_KEY;
if (!privateKeyString || privateKeyString.includes('your_')) {
  console.error('❌ No valid TREASURY_PRIVATE_KEY found in .env');
  process.exit(1);
}

const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyString));
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

async function main() {
  console.log(`\n🔑 Treasury Wallet: ${treasuryKeypair.publicKey.toBase58()}`);
  
  // 1. Create new token mint
  console.log('\n🌟 Creating PULSE Token Mint...');
  const mint = await createMint(
    connection,
    treasuryKeypair,          // payer
    treasuryKeypair.publicKey, // mintAuthority
    null,                     // freezeAuthority
    2                         // decimals (like cents)
  );
  
  console.log(`✅ Token Mint Address: ${mint.toBase58()}`);

  // 2. Save the mint address to .env
  let envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  if (envContent.includes('PULSE_TOKEN_MINT=')) {
    envContent = envContent.replace(/PULSE_TOKEN_MINT=.*/g, `PULSE_TOKEN_MINT=${mint.toBase58()}`);
  } else {
    envContent += `\n# PULSE Custom SPL Token\nPULSE_TOKEN_MINT=${mint.toBase58()}\n`;
  }
  fs.writeFileSync(path.join(__dirname, '.env'), envContent);
  console.log(`✅ Mint address saved to .env as PULSE_TOKEN_MINT`);

  console.log('\n🎉 PULSE Token Setup Complete!');
  console.log('Restart your backend server to load the new token mint.');
}

main().catch(console.error);
