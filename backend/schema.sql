-- Supabase Database Schema

-- 1. Groups Table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL, -- Solana Wallet Address
  chat_id BIGINT, -- Telegram group chat id
  entry_fee NUMERIC DEFAULT 0, -- Optional SOL entry fee
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Members Table
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  telegram_username TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Matches Table (Populated from TxLINE)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  txline_id TEXT UNIQUE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled', -- scheduled | live | finished
  result JSONB -- { home: 2, away: 1, scorer: "Mbappe", btts: true }
);

-- 4. Predictions Table
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  picks JSONB NOT NULL, -- Array of objects: { market: "result", selection: "Home Win", odds: 2.10, status: "pending", points_awarded: 0 }
  net_points NUMERIC DEFAULT 0,
  tx_signature TEXT UNIQUE, -- Stores the Solana transaction signature
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  locked BOOLEAN DEFAULT false
);

-- 5. Leaderboard Table
CREATE TABLE leaderboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  total_pts NUMERIC DEFAULT 0,
  matches_played INT DEFAULT 0
);
