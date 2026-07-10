# 🏆 TxLINE Pulse: World Cup Prediction Game
**Built for the TxODDS x Superteam Earn Hackathon**

> **⚠️ HACKATHON DISCLAIMER:** This project is a Technical Proof of Concept. It operates strictly on the Solana Devnet using valueless test tokens. This application does NOT facilitate real-money gambling, fund locking, or illegal wagering. The "escrow" and "payouts" described herein are simulations of smart-contract logic intended purely for judging and educational purposes, in full compliance with the hackathon's Terms and Conditions.

## 📖 Overview
TxLINE Pulse is a real-time, social World Cup prediction platform that brings the energy of a live group chat into a structured, automated game. Friends create private groups, pool SOL, lock in predictions before kickoff, and watch their leaderboard update live as the match plays out. 

Instead of constantly checking a website, users link their Telegram group chat. The system automatically pushes live match events, dynamic flash markets, and **AI-generated voice notes** reacting to goals in real-time. When the final whistle blows, the game engine calculates the final scores and automatically triggers Solana Devnet smart contracts to pay out the winner.

---

## ✨ Key Features
- **Frictionless Demo Wallets:** Users can instantly generate a burner web wallet and receive an airdrop of 100 PULSE tokens to play with, removing the barrier to entry of installing Phantom for the demo.
- **Additive Point-Based Parlays:** A forgiving parlay system where picks across multiple matches are mathematically split. Winning picks add to a match multiplier, and losing picks subtract.
- **Real-Time Match Engine:** Powered by the **TxLINE API**, polling live match events and odds.
- **Telegram Native UX:** Live notifications, leaderboards, and flash markets delivered directly to Telegram via **Telegraf**.
- **AI Text-to-Speech Voice Notes:** Goal events trigger custom "trash talk" scripts converted to highly expressive audio using **ElevenLabs** and sent as voice notes to the chat.
- **Automated Payouts:** The backend verifies predictions, computes payouts using the additive logic, and dynamically mints SPL tokens (PULSE) to the winners in real-time.

---

## 🏗️ Architecture & How It Works Behind the Scenes

### 1. The User Flow
1. **Create Wallet:** A user arrives on the web app and clicks "Create Wallet" to instantly generate a local keypair and receive 100 PULSE test tokens.
2. **Create/Join Group:** The user creates a private group or joins an existing one via an invite code. The active groups are instantly visible on their personalized Home dashboard.
3. **Link Telegram:** The group creator sends the invite link to their Telegram bot (`/start LINK_<invite_code>`), binding the web group to their Telegram chat.
4. **Predict (Additive Parlays):** Members use their PULSE tokens to lock in predictions before kickoff. The wager is split across the selected matches.
5. **Live Match:** Once the match starts, predictions lock. The backend constantly polls TxLINE for events.
6. **Goal!:** When a goal happens, the game engine partially evaluates picks. The bot crafts a TTS script detailing who scored and whose predictions were ruined, generating a voice note and sending it to Telegram.
7. **Resolution:** The backend evaluates predictions match-by-match. If a user's final odds multiplier (Sum of Won Picks - Sum of Lost Picks) is positive, the engine instantly mints the PULSE token payout to their wallet, and their live navbar balance and leaderboard rank automatically update!

### 2. The Game Engine (`backend/engine.js`)
The core engine acts as the referee. It listens to the TxLINE event feed.
- **`handleGoalEvent`**: When TxLINE reports a goal, the engine immediately checks if "Both Teams to Score" hit, or if the "First Goalscorer" prediction was correct.
- **`executePayouts`**: At match end, the engine evaluates the additive odds logic (`Sum of Won - Sum of Lost`). If positive, it calculates the payout (`Wager * Final Multiplier`), creates a Solana transaction using the SPL Token Program, and mints the PULSE tokens directly to the user's wallet.

### 3. Telegram & ElevenLabs Architecture (`backend/bot.js`)
The Telegram bot is built using `Telegraf.js`.
- **Voice Notes**: When a goal is scored, the backend generates a dynamic script based on the scorer, the minute, and the usernames of people who predicted that scorer. This text is sent to the ElevenLabs API, which returns an MPEG audio buffer. The bot then uses `bot.telegram.sendVoice` to drop it into the chat, mimicking a real person sending a voice note.
- **Flash Markets**: The bot pushes interactive Telegram inline keyboards during the match. For example, if a VAR check occurs, the bot asks "Will a penalty be awarded?". Users click "Yes" or "No" to risk/win 5 extra points.

### 4. TxLINE Integration (`backend/txline.js`)
Our system interfaces with TxLINE's Free Tier API.
- We authenticate using a Guest Session JWT and an activated API token.
- We act as a polling consumer, translating TxLINE's rich data structures into our simplified schema (`Home Win`, `Over 2.5`, etc.).

**TxLINE Endpoints Used:**
- `POST /auth/guest/start`: Generates a Guest JWT to start the session.
- `POST /api/token/activate`: Activates the API token after the on-chain Solana subscription is verified.
- `GET /api/fixtures/snapshot`: Retrieves a snapshot of all upcoming matches (futures) to populate the prediction dashboard.
- `GET /api/odds/snapshot/{fixtureId}`: Fetches pre-match point multipliers (odds) for a specific match to calculate potential points.
- `GET /api/scores/snapshot/{fixtureId}`: Polled continuously during a match to receive live match events (goals, scores) and trigger our backend engine.

---

## 🛠️ Tech Stack
- **Frontend**: React, Vite, TailwindCSS
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: Solana Devnet (`@solana/web3.js`)
- **APIs & Integrations**: 
  - TxLINE (Match Data & Odds)
  - ElevenLabs (Text-to-Speech)
  - Telegram Bot API (Telegraf)

---

## 📁 Codebase Structure

```text
├── backend/
│   ├── server.js          # Express setup, CORS, and health checks
│   ├── routes.js          # REST API (groups, predictions, SOL tx verification)
│   ├── engine.js          # Prediction evaluation and Solana automated payouts
│   ├── bot.js             # Telegram bot logic, ElevenLabs TTS, Flash markets
│   ├── txline.js          # TxLINE API client (auth, odds, live scores)
│   ├── db.js              # Supabase client initialization
│   └── schema.sql         # PostgreSQL database schema
├── frontend/
│   ├── src/               # React components, pages, and web3 wallet logic
│   ├── index.html         # Vite entry point
│   └── vite.config.js     # Frontend build configuration
└── worldcup_prediction_game_spec.md # Original Hackathon architecture spec
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js (v18+)
- Supabase account
- Solana CLI / Phantom Wallet (switched to Devnet)
- Telegram Bot Token (via BotFather)
- ElevenLabs API Key

### 2. Environment Variables
Create a `.env` file in the `backend/` directory:
```env
# Server
PORT=3000

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Solana Escrow
TREASURY_PRIVATE_KEY=your_base58_private_key

# APIs
TXLINE_API_KEY=your_txline_key
TELEGRAM_BOT_TOKEN=your_bot_token
ELEVEN_LABS_KEY=your_elevenlabs_key
ELEVEN_LABS_VOICE_ID=pNInz6obbfDQGcgMyIGb
```

### 3. Run the Backend
```bash
cd backend
npm install
npm start
```

### 4. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```

---
*Built with ❤️ for the TxODDS x Superteam Earn Hackathon.*
