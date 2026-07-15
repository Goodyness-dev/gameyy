# 🏆 TxLINE Pulse: The Invisible Web3 Sportsbook
**Built for the TxODDS x Superteam Earn Hackathon**

> **⚠️ HACKATHON DISCLAIMER:** This project is a Technical Proof of Concept. It operates strictly on the Solana Devnet using valueless test tokens (PULSE). This application does NOT facilitate real-money gambling, fund locking, or illegal wagering. The "escrow" and "payouts" described herein are simulations of smart-contract logic intended purely for judging and educational purposes.

## 💻 Technical Overview

TxLINE Pulse isn't just another CRUD app—it is a highly asynchronous, real-time game engine that tightly couples the **TxODDS API** with a frictionless Solana backend and a Telegram-native UI. 

I approached this hackathon with a massive constraint in mind: **Most people hate dealing with crypto wallets, and nobody wants to download yet another app just to predict match outcomes with their friends.**

To solve this, I engineered a system that completely abstracts away all Web3 friction, leverages **TxODDS** as the absolute, undisputed source of truth for the game engine's state machine, and pushes all user interactions to the platform they already use every day: **Telegram**.

---

## ⚡ The TxODDS Event Engine (The Beating Heart)
Everything in TxLINE Pulse revolves around the TxLINE API. It is the core of the state machine. I don't just fetch odds to display them; I use TxODDS to drive the backend chron-jobs, mathematically resolve payouts, and trigger asynchronous real-time Telegram events.

### 1. State Normalization & Polling (`backend/txline.js`)
TxODDS provides incredibly rich, deep JSON structures. I built a data ingestion pipeline that normalizes this payload into a flat, relational schema stored in PostgreSQL via Supabase.

- **The Auth Pipeline:** I implemented an automated JWT handshake (`POST /auth/guest/start`) coupled with a token activation script (`POST /api/token/activate`) that verifies my on-chain Solana subscription before lighting up the live data feed.
- **The Poller Daemon:** Because WebSockets weren't utilized for the free tier, I engineered a non-blocking `setInterval` daemon that aggressively polls the `GET /api/scores/snapshot/{fixtureId}` endpoint. I maintain an in-memory cache of the previous match state. By performing a deep object diff of the new TxODDS snapshot against the cached state, the system emits custom Node.js `EventEmitter` events (e.g., `goal_scored`, `card_issued`, `var_review`) across the entire backend pipeline.

### 2. The Game Engine (`backend/engine.js`)
When the TxODDS poller emits a `goal_scored` event, my engine acts as the referee. It instantly queries the Supabase database for all locked predictions related to that specific `fixtureId`.

Because TxODDS updates are practically instantaneous, the game engine's `handleGoalEvent` function can resolve micro-markets like "Both Teams to Score" or "First Goalscorer" within seconds of the live event happening on the pitch, updating the leaderboard in real-time.

---

## 🧮 The Math: Additive Point-Based Parlays
Traditional sportsbooks use multiplicative parlays (where if one leg fails, the entire bet goes to zero). This creates massive friction and rapid churn for casual players in a group chat setting.

### How To Play & Wager Splitting
To fix this, I engineered an **Additive Parlay** algorithm tailored specifically for social gameplay. When a user places a prediction across multiple matches, their **total wager is mathematically divided by the total number of games they bet on**. 

The final payout multiplier is then derived additively from those individual fractional legs:

`Final Multiplier = 1.0 + (Σ Winning Pick Odds) - (Σ Losing Pick Penalties)`

By pulling the granular fractional odds directly from the `GET /api/odds/snapshot/{fixtureId}` TxODDS endpoint before kickoff, my engine stores the exact risk-to-reward ratio for each micro-market inside a `JSONB` array in PostgreSQL. When the `handleMatchEnd` event fires:
- A correct "Home Win" (e.g., 1.5x) adds `+0.5` to the base multiplier.
- An incorrect "Over 2.5 Goals" subtracts a dynamic penalty based on the implied probability.
- If the final multiplier drops below 0, the wager is lost. If it remains positive, the Solana contract automatically mints exactly `(Wager / Number of Games) * Final Multiplier`.

This forgiving mathematical model keeps users engaged longer, reducing variance while deeply leveraging TxODDS's highly accurate pre-match probability data.

---

## 👻 The "Invisible Web3" Architecture
I wanted the cryptographic security and programmable money capabilities of Solana, but without the terrible UX nightmare of browser extensions.

### 1. Ephemeral Burner Wallets
When a user visits the React frontend, I immediately execute `Keypair.generate()` via `@solana/web3.js` under the hood. I securely serialize the private key into encrypted `localStorage`. The user *has* a real Web3 wallet, but they never see a seed phrase, they never install a Phantom extension, and they never sign a popup.

### 2. The Treasury & Automated Airdrops
To let users play immediately, I built a Treasury service. The moment the frontend generates a Keypair, it hits my `/api/faucet` REST endpoint. The Node.js backend, holding a highly secure Treasury Keypair in its environment variables, signs a zero-fee transaction using the SPL Token Program to transfer 100 PULSE test tokens to the user's ephemeral burner address so they can start predicting instantly.

### 3. Asynchronous On-Chain Payouts (`backend/solana.js`)
When the TxODDS API reports `status: "FT"` (Full Time), the `executePayouts()` function kicks in. It iterates over the database, evaluates the Additive Parlay formula, and calculates the net payout. For every winner, the backend securely fetches their `AssociatedTokenAccount` (ATA) and dynamically mints SPL tokens directly to their wallet using `mintTo()`. The user simply sees their balance go up in the UI—the blockchain cryptography is entirely abstracted away.

---

## 🎙️ The Telegram & Google TTS AI Pipeline (`backend/bot.js`)
Instead of forcing users to constantly refresh a web app, I push the game state directly into their Telegram group chat using `Telegraf.js`.

### 1. The Telegraf Event Bus
The frontend web group is bound to a Telegram chat ID using a deep link (`/start LINK_<uuid>`). When the TxODDS poller emits a live event (like a goal), the backend identifies the mapped Telegram `chat_id` from the Supabase `groups` table.

### 2. Dynamic Prompting & Google Text-to-Speech (TTS)
This is where the magic happens. I don't just send a boring text message. 
When TxODDS confirms a goal, the engine looks at who in the group predicted it. It injects these variables into a dynamic trash-talk script:
> *"Goal! Mbappe slots it home in the 45th minute. @John predicted it and is gloating. @Sarah lost her bet."*

This dynamic script is then piped directly into the **Google TTS API** (`google-tts-api`). I stream the audio URL/buffer back to the Node server and pipe it directly into Telegraf's `bot.telegram.sendVoice(chatId, { url: audioUrl })`. 

The result? The group chat receives a custom, real-time AI voice note roasting the losers and hyping the winners, entirely driven by the sub-second TxODDS real-time data feed.

### 3. Flash Markets (Inline Keyboards)
When TxODDS reports a high-tension event (like a VAR check or a Penalty Awarded), the bot pushes a Telegraf Inline Keyboard. Users have 30 seconds to tap "Yes" or "No" directly inside Telegram. This bypasses the web app entirely and writes a micro-prediction straight to the `predictions` table in Supabase.

---

## 🗄️ Database Architecture
I utilized Supabase (PostgreSQL) for relational state management. The schema is highly optimized for the game engine:
- **`groups`**: Links the web session to a Telegram `chat_id`.
- **`members`**: Stores the user's `wallet_address`, `telegram_username`, and internal `balance`.
- **`matches`**: Mirrors the TxODDS snapshot feed (`txline_id`, `home_team`, `away_team`, `status`, `result` as a JSONB object).
- **`predictions`**: Stores a `JSONB` array of user picks (e.g., `[{ market: "result", selection: "Home Win", odds: 2.10, status: "pending" }]`) mapped to a `match_id` and a `member_id`.

---

## 🛠️ The Tech Stack
- **Frontend**: React, Vite, TailwindCSS (Web3-injected via `@solana/web3.js`)
- **Backend Core**: Node.js, Express.js (Event-driven Architecture)
- **Data Layer**: Supabase (PostgreSQL, Realtime Subscriptions)
- **State Source of Truth**: TxLINE API (REST, Polling Daemons)
- **Blockchain**: Solana Devnet (`@solana/web3.js`, `@solana/spl-token`)
- **AI / TTS**: Google TTS API (`google-tts-api`)
- **Social Layer**: Telegram Bot API (`Telegraf.js`)

## 📁 Repository Map
```text
├── backend/
│   ├── engine.js          # Core prediction evaluator & Additive Parlay math (Listens to TxODDS diffs)
│   ├── txline.js          # TxODDS polling daemon, JWT Auth, & data normalizer
│   ├── bot.js             # Telegram event bus & Google TTS streaming audio logic
│   ├── routes.js          # REST endpoints & Treasury airdrop faucet logic
│   └── schema.sql         # Supabase PostgreSQL relational schema
└── frontend/
    ├── src/                 # React UI components and web-based dashboard
    └── index.html           # Vite entry point
```

---
*Built with ❤️ for the TxODDS x Superteam Earn Hackathon.*
