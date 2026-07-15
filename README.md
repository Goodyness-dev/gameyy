# 🏆 TxLINE Pulse: The Invisible Web3 Sportsbook
**Built for the TxODDS x Superteam Earn Hackathon**

> **⚠️ HACKATHON DISCLAIMER:** This project is a Technical Proof of Concept. It operates strictly on the Solana Devnet using valueless test tokens (PULSE). This application does NOT facilitate real-money gambling, fund locking, or illegal wagering. The "escrow" and "payouts" described herein are simulations of smart-contract logic intended purely for judging and educational purposes.

## 💻 Technical Overview

TxLINE Pulse isn't just another CRUD app—it's a real-time, asynchronous game engine that bridges the **TxODDS API** with a seamless Solana backend and a Telegram-native frontend. 

We approached this hackathon with a massive constraint: **Most people hate dealing with crypto wallets, and nobody wants to download an app just to predict match outcomes with friends.**

To solve this, we engineered a system that completely abstracts the Web3 friction, leverages **TxODDS** as the undisputed source of truth for our game engine state, and pushes all interaction to where the user already is: **Telegram**.

---

## ⚡ The TxODDS Event Engine (The Beating Heart)
Everything in TxLINE Pulse revolves around the TxLINE API. It is the absolute core of our state machine. We don't just fetch odds; we use TxODDS to drive the backend chron-jobs, resolve payouts, and trigger asynchronous Telegram events.

### 1. State Normalization & Polling
TxODDS provides incredibly rich, deep JSON structures. We built a data ingestion pipeline in `backend/txline.js` that normalizes this payload into a flat, relational schema stored in PostgreSQL (Supabase).

- **Auth Pipeline:** We implemented an automated JWT handshake (`POST /auth/guest/start`) coupled with a token activation script (`POST /api/token/activate`) that verifies our on-chain Solana subscription before lighting up the data feed.
- **The Poller Daemon:** Since WebSockets weren't used for the free tier, we engineered a non-blocking `setInterval` daemon that aggressively polls `GET /api/scores/snapshot/{fixtureId}`. We maintain a local Redis-like cache (in-memory) of the previous match state. By diffing the new TxODDS snapshot against the cached state, we emit custom Node.js `EventEmitter` events (e.g., `goal_scored`, `card_issued`, `var_review`) across our backend pipeline.

### 2. The Game Engine (`backend/engine.js`)
When the TxODDS poller emits a `goal_scored` event, our engine acts as the referee. 
It instantly queries Supabase for all locked predictions related to that `fixtureId` and computes partial resolutions (e.g., "Both Teams to Score", "First Goalscorer") within seconds of the live event happening on the pitch.

### 3. The Math: Additive Point-Based Parlays
Traditional sportsbooks use multiplicative parlays (if one leg fails, the entire bet goes to zero). This creates friction and rapid churn for casual players in a group chat setting.

To fix this, we engineered an **Additive Parlay** algorithm tailored specifically for social gameplay. The wager is mathematically split across the selected match events, and the final payout multiplier is derived additively:

`Final Multiplier = 1.0 + (Σ Winning Pick Odds) - (Σ Losing Pick Penalties)`

By pulling the granular fractional odds directly from the `GET /api/odds/snapshot/{fixtureId}` TxODDS endpoint before kickoff, our engine stores the exact risk-to-reward ratio for each micro-market in Supabase. When the match resolves:
- A correct "Home Win" (e.g., 1.5x) adds +0.5 to the base multiplier.
- An incorrect "Over 2.5 Goals" subtracts a dynamic penalty based on implied probability.
- If the final multiplier drops below 0, the wager is lost. If it remains positive, the Solana contract mints exactly `Wager * Final Multiplier`.

This forgiving mathematical model keeps users engaged longer, reducing variance while deeply leveraging TxODDS's highly accurate pre-match probability data.

---

## 👻 The "Invisible Web3" Architecture
We wanted the security and programmable money of Solana, but without the UX nightmare. 

### 1. Ephemeral Burner Wallets
When a user hits the React frontend, we immediately execute `Keypair.generate()` via `@solana/web3.js` and securely serialize the private key into encrypted `localStorage`. The user *has* a wallet, but they never see a seed phrase, install an extension, or sign a popup.

### 2. The Treasury & Automated Airdrops
To let users play immediately, we built a Treasury service. The moment the frontend generates a Keypair, it hits our `/api/faucet` endpoint. The Node.js backend, holding a highly secure Treasury Keypair, signs a zero-fee transaction using the SPL Token Program to transfer 100 PULSE test tokens to the user's burner address so they can start predicting instantly.

### 3. Asynchronous Payouts
When the TxODDS API reports `status: "FT"` (Full Time), the engine evaluates the Additive Parlay formula. If the user's final multiplier is positive, the engine calculates the payout and dynamically mints SPL tokens via an on-chain transaction. The user just sees their balance go up in the UI—the blockchain cryptography is entirely abstracted away.

---

## 🎙️ The Telegram & AI TTS Pipeline
Instead of forcing users to constantly refresh a web app, we push the game state directly into their Telegram group chat using `Telegraf.js`.

### 1. The Telegraf Event Bus
The frontend web group is bound to a Telegram chat ID using a deep link (`/start LINK_<uuid>`). When the TxODDS poller emits a live event (like a goal), the backend identifies the mapped Telegram `chatId`.

### 2. Dynamic Prompting & ElevenLabs TTS
This is where the magic happens. We don't just send a boring text message. 
When TxODDS confirms a goal, the engine looks at who in the group predicted it. It injects these variables into a dynamic LLM prompt:
> *"Generate a 10-second trash talk script. [Player] scored. [User1] predicted it and is gloating. [User2] lost their bet."*

The resulting script is piped directly into the **ElevenLabs API**. We stream the MPEG audio buffer back to the Node server and pipe it directly into `bot.telegram.sendVoice(chatId, { source: audioBuffer })`. 

The result? The group chat gets a custom, highly expressive AI voice note roasting the losers and hyping the winners, entirely driven by the sub-second TxODDS real-time data feed.

### 3. Flash Markets (Inline Keyboards)
When TxODDS reports a high-tension event (like a VAR check or a Red Card), the bot pushes a Telegraf Inline Keyboard. Users have 30 seconds to tap "Yes" or "No" (e.g., "Will a penalty be awarded?"). This writes a micro-prediction directly to Supabase, entirely inside Telegram.

---

## 🛠️ The Stack
- **Frontend**: React, Vite, TailwindCSS (Web3-injected)
- **Backend Core**: Node.js, Express.js (Event-driven Architecture)
- **Data Layer**: Supabase (PostgreSQL, Realtime Subscriptions)
- **State Source of Truth**: TxLINE API (REST, Polling Daemons)
- **Blockchain**: Solana Devnet (`@solana/web3.js`, SPL Token Program)
- **AI / TTS**: ElevenLabs API
- **Social Layer**: Telegram Bot API (`Telegraf.js`)

## 📁 Repository Map
```text
├── backend/
│   ├── engine.js          # The core prediction evaluator (Listens to TxODDS diffs)
│   ├── txline.js          # TxODDS polling daemon & data normalizer
│   ├── bot.js             # Telegram event bus & ElevenLabs streaming buffer logic
│   ├── solana.js          # Ephemeral wallet funding & SPL token minting
│   └── routes.js          # REST endpoints for the React frontend
└── frontend/
    ├── src/hooks/web3.js  # LocalStorage Keypair generation & transaction signing
    └── index.html         # Vite entry point
```

---
*Built with ❤️ for the TxODDS x Superteam Earn Hackathon.*
