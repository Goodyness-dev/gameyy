# World Cup Group Prediction Game — Full Build Spec
**Hackathon:** TxODDS x Superteam Earn | **Deadline:** July 19, 2026 (23:59 UTC)  
**Prize Pool:** $16,000 USDT | **Stack:** React + Node/Express + Telegraf.js + TxLINE + ElevenLabs

---

## 1. What We're Building

A real-time group prediction game for the 2026 World Cup. Friends create a private group, lock in predictions before kickoff, and watch their leaderboard update live as the match plays out. A Telegram bot drives engagement — notifying members before matches, sending voice notes on goals, and announcing the winner when the final whistle blows.

**The one-line pitch:** Fantasy football's social energy, compressed into a single match, with live feedback and a voice that reacts when things happen.

---

## 2. Core User Flow

```
Friend creates group → Share link → Members join → 
Match notification fires on Telegram → Members make predictions on site → 
Kickoff locks predictions → TxLINE polls live data → 
Leaderboard updates in real-time → Goal fires TTS voice note on Telegram → 
Match ends → Winner announced on Telegram + site
```

---

## 3. The 4 Predictions (Fixed, Non-Negotiable)

Every member makes exactly these 4 picks before kickoff:

| # | Prediction | Resolution |
|---|-----------|------------|
| 1 | Match result (Home / Draw / Away) | Full-time result |
| 2 | Both teams to score (Yes / No) | At least 1 goal each side |
| 3 | Over / Under 2.5 goals | Total goals in match |
| 4 | First goalscorer (pick from squad list) | First goal of the match |

**Scoring:**
- Prediction 1, 2, 3 → 1 point each
- Prediction 4 (first goalscorer) → 2 points (hardest, highest reward)
- Max score per match: 5 points

Ties on the leaderboard are broken by submission time — earlier predictions win.

---

## 4. Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| Frontend | React (Vite) | Fast to build, easy to deploy |
| Backend | Node.js + Express | Handles TxLINE polling + Telegram bot |
| Database | PostgreSQL (Supabase free tier) | Groups, users, predictions, leaderboard |
| Telegram Bot | Telegraf.js | Notifications + voice notes |
| TTS | ElevenLabs API (free tier) | Goal voice notes |
| Live Data | TxLINE API | Scores, goals, match events |
| Hosting | Railway or Render (free tier) | Deploy backend fast |
| Frontend Deploy | Vercel | Instant React deploys |

---

## 5. Database Schema

### `groups`
```sql
id          UUID PRIMARY KEY
name        TEXT
invite_code TEXT UNIQUE
created_by  TEXT  -- telegram_id
chat_id     BIGINT  -- telegram group chat id
created_at  TIMESTAMP
```

### `members`
```sql
id           UUID PRIMARY KEY
group_id     UUID REFERENCES groups(id)
telegram_id  TEXT
username     TEXT
joined_at    TIMESTAMP
```

### `matches`
```sql
id           UUID PRIMARY KEY
txline_id    TEXT UNIQUE  -- TxLINE match ID
home_team    TEXT
away_team    TEXT
kickoff_time TIMESTAMP
status       TEXT  -- scheduled | live | finished
result       JSONB  -- { home: 2, away: 1, scorer: "Mbappe", btts: true }
```

### `predictions`
```sql
id              UUID PRIMARY KEY
member_id       UUID REFERENCES members(id)
match_id        UUID REFERENCES matches(id)
result_pick     TEXT  -- home | draw | away
btts_pick       BOOLEAN
goals_pick      TEXT  -- over | under
first_scorer    TEXT  -- player name
points_earned   INT DEFAULT 0
submitted_at    TIMESTAMP
locked          BOOLEAN DEFAULT false
```

### `leaderboard`
```sql
id         UUID PRIMARY KEY
group_id   UUID REFERENCES groups(id)
member_id  UUID REFERENCES members(id)
total_pts  INT DEFAULT 0
matches_played INT DEFAULT 0
```

---

## 6. TxLINE Integration

### Endpoints You'll Use

```
GET /worldcup/matches          → fetch all 104 matches + kickoff times
GET /worldcup/matches/{id}     → single match details + current score
GET /worldcup/matches/{id}/events  → goal events, cards, substitutions
GET /worldcup/odds/{id}        → live odds (for context, not core logic)
```

Reference: https://txline.txodds.com/documentation/worldcup

### Polling Strategy

**Pre-match:** No polling needed. Just fetch match schedule once on server start and cache it.

**Live match:** Poll `GET /matches/{id}/events` every **30 seconds**. This is your heartbeat.

```js
// polling.js
const pollMatch = async (txlineMatchId, internalMatchId) => {
  const events = await txline.getMatchEvents(txlineMatchId);
  
  for (const event of events) {
    if (event.type === 'goal') {
      await handleGoalEvent(event, internalMatchId);
    }
    if (event.type === 'match_end') {
      await handleMatchEnd(internalMatchId);
    }
  }
};
```

**Important:** Store the last event timestamp you processed. On each poll, only handle events newer than that. This prevents double-firing notifications on the same goal.

### Goal Event Handler

```js
const handleGoalEvent = async (event, matchId) => {
  // 1. Update match score in DB
  await db.updateMatchScore(matchId, event.score);

  // 2. Check if any member had this scorer as first goalscorer
  await resolveFirstScorerPredictions(matchId, event.scorer, event.minute);

  // 3. Check BTTS status
  await resolveBTTSIfApplicable(matchId, event.score);

  // 4. Update leaderboard
  await recalculateLeaderboard(matchId);

  // 5. Fire TTS voice note on Telegram
  await sendGoalVoiceNote(matchId, event);
};
```

---

## 7. Telegram Bot (Telegraf.js)

### Bot Commands

```
/start        → Welcome message + link to create/join group
/newgroup     → Creates a new prediction group, returns invite link
/join {code}  → Joins an existing group
/predict      → Sends link to current match prediction page
/leaderboard  → Shows current group standings as a formatted message
```

### Notification 1 — Pre-Match Reminder (1 hour before kickoff)

Triggered by a cron job that checks for matches starting in ~60 minutes.

```
🏆 MATCH ALERT — [Group Name]

[Home Team] 🆚 [Away Team]
Kickoff: 60 minutes

Make your predictions now before the cutoff:
👉 [link to prediction page]

Current picks:
✅ Goody — done
⏳ Tade — pending
⏳ Kemi — pending
```

### Notification 2 — Goal Voice Note

When TxLINE fires a goal event, you:
1. Build a script string server-side
2. Send it to ElevenLabs API → get back audio buffer
3. Send audio buffer to Telegram as `sendVoice`

**Script template:**
```
GOAL! [Scorer] puts [Team] ahead in the [minute]th minute. 
Score is now [Home] [homeScore] - [awayScore] [Away].
[If first goal: "That's the first goal of the match."]
[If member had scorer: "[Member] called that one — they move to [X] points and lead the group."]
```

### Notification 3 — Match End

```
⚽ FULL TIME — [Home] [score] [Away]

🏅 [Group Name] Winner: @[username] with [X]/5 points

Final Standings:
1. @goody — 5pts
2. @tade — 3pts  
3. @kemi — 2pts

GG everyone. Next match: [Team A] vs [Team B] in [X] hours.
```

---

## 8. ElevenLabs TTS Integration

```js
// tts.js
import axios from 'axios';

const ELEVEN_LABS_KEY = process.env.ELEVEN_LABS_KEY;
const VOICE_ID = 'your_chosen_voice_id'; // pick an energetic male voice

export const generateGoalAudio = async (script) => {
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      text: script,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.4, similarity_boost: 0.8 }
    },
    {
      headers: {
        'xi-api-key': ELEVEN_LABS_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      responseType: 'arraybuffer'
    }
  );
  return Buffer.from(response.data);
};
```

```js
// In your Telegram notification handler
const audioBuffer = await generateGoalAudio(script);
await bot.telegram.sendVoice(chatId, { source: audioBuffer });
```

**ElevenLabs free tier gives you 10,000 characters/month.** Average goal script is ~120 chars. You have room for ~83 goal notifications before you hit the limit. More than enough for the hackathon demo.

---

## 9. Frontend — Pages & Components

### Pages

```
/                    → Landing page (hero, how it works, create group CTA)
/create              → Create a group, get invite code
/join/{code}         → Join a group (enter Telegram username)
/group/{id}          → Group dashboard (upcoming matches, leaderboard)
/predict/{matchId}   → Prediction form for a specific match
/leaderboard/{id}    → Full group leaderboard across all matches
```

### Key Components

**PredictionForm.jsx**
- Shows match info (teams, kickoff time, countdown)
- 4 prediction inputs (radio buttons / toggle switches)
- First goalscorer is a searchable dropdown populated from TxLINE squad data
- Submit button locks when countdown hits 0

**LiveLeaderboard.jsx**
- Polls your backend every 30s during a live match
- Shows member name, points, correct predictions highlighted green
- Animates position changes (someone moves up when they get a point)

**GroupDashboard.jsx**
- Upcoming matches with "Make Predictions" CTA
- Live match card (if one is running) with current score + leaderboard
- Past matches with results

---

## 10. Backend API Routes

```
POST /api/groups/create              → create group, return invite code
POST /api/groups/join                → join group by invite code
GET  /api/groups/:id                 → group info + members
GET  /api/groups/:id/leaderboard     → ranked member list with points

GET  /api/matches                    → all upcoming World Cup matches
GET  /api/matches/:id                → single match + current score
POST /api/predictions                → submit predictions (pre-kickoff only)
GET  /api/predictions/:matchId/:memberId → fetch a member's picks

GET  /api/leaderboard/:groupId       → full standings
```

---

## 11. Build Order (18 Days)

### Days 1–3: Foundation
- [ ] Set up Supabase DB, run schema migrations
- [ ] Scaffold Express backend, connect to DB
- [ ] Register TxLINE account, test API calls, confirm World Cup endpoints work
- [ ] Scaffold React frontend with Vite

### Days 4–6: Core Prediction Flow
- [ ] Build group create/join flow (backend + frontend)
- [ ] Build prediction form UI
- [ ] Submit predictions to DB with pre-kickoff lock logic

### Days 7–9: TxLINE Live Integration
- [ ] Build match poller (30s interval, events endpoint)
- [ ] Goal event handler → score update → prediction resolution
- [ ] Match end handler → final leaderboard calculation

### Days 10–12: Telegram Bot
- [ ] Set up Telegraf.js bot
- [ ] Build `/start`, `/newgroup`, `/join` commands
- [ ] Pre-match reminder cron job
- [ ] Match end notification

### Days 13–14: TTS Voice Notes
- [ ] ElevenLabs integration
- [ ] Goal script builder
- [ ] `sendVoice` on Telegram

### Days 15–16: Frontend Polish
- [ ] Live leaderboard with polling
- [ ] Group dashboard
- [ ] Mobile-responsive UI (judges will check this)

### Days 17–18: Demo Prep
- [ ] Deploy backend to Railway, frontend to Vercel
- [ ] Record demo video (show full flow: join group → predict → live update → voice note → winner)
- [ ] Write technical documentation
- [ ] Submit on Superteam Earn

---

## 12. Demo Video Plan (Critical — judges weight this heavily)

The matches will be over by review time. Your demo video **is** your product. Plan it like this:

1. **0:00–0:30** — Show the problem. "World Cup group chats are chaotic. Everyone's making predictions but nobody tracks them."
2. **0:30–1:30** — Create a group, share the link, show two "friends" joining (use two browser windows)
3. **1:30–2:30** — Make predictions on both accounts before kickoff
4. **2:30–3:30** — Show a live match (use a match in progress or seed test data). Leaderboard updates when a prediction resolves. Fire a goal voice note on Telegram live.
5. **3:30–4:30** — Match ends. Show Telegram winner announcement. Show final leaderboard.
6. **4:30–5:00** — Quick technical callout: TxLINE endpoints used, stack overview.

**Seed your DB with a real completed match** so the demo isn't dependent on a live game happening during recording.

---

## 13. Judging Criteria Mapping

| Criterion | How We Hit It |
|-----------|--------------|
| Fan Accessibility & UX | Simple 4-pick UI, Telegram-native notifications, no crypto knowledge needed |
| Real-Time Responsiveness | 30s TxLINE polling, live leaderboard updates, instant goal notifications |
| Originality & Value Creation | Combines group sweepstake + live updates + TTS voice notes in one flow nobody has built |
| Commercial & Monetization Path | Premium groups (paid entry, winner takes pool), sponsored voice skins, tournament packages |
| Completeness & Execution | Full end-to-end flow: group → predict → live → notify → winner |

---

## 14. Environment Variables

```env
# TxLINE
TXLINE_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=

# ElevenLabs
ELEVEN_LABS_KEY=
ELEVEN_LABS_VOICE_ID=

# App
FRONTEND_URL=
PORT=3000
```

---

## 15. What This Is NOT (Stay Disciplined)

- ❌ No fund locking or prize pools — legally toxic, out of scope
- ❌ No on-chain writes — no clear value add for this use case
- ❌ No AI analysis or pundit commentary layer — scope creep
- ❌ No wallet connection required — friction that kills fan adoption
- ❌ No admin dashboard — you don't need it for the demo

Every feature not on this list is a distraction. Build the loop first.
