import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * TxLINE API Client
 * 
 * Authentication flow (no API key needed for World Cup Free Tier):
 * 1. POST /auth/guest/start → get a guest JWT
 * 2. Subscribe on-chain (free for World Cup tier, service level 1 or 12)
 * 3. POST /api/token/activate → get an API token
 * 4. Use both JWT + API token in all data requests
 * 
 * Run `npm run setup:txline` to complete activation.
 * 
 * Endpoints (from TxLINE docs):
 *   GET /api/fixtures/snapshot                → all upcoming fixtures (FUTURE matches)
 *   GET /api/fixtures/snapshot?competitionId= → fixtures for a specific competition
 *   GET /api/odds/snapshot/{fixtureId}        → pre-match odds for a fixture
 *   GET /api/scores/snapshot/{fixtureId}      → scores for a fixture (live/completed)
 */

const NETWORK = process.env.TXLINE_NETWORK || 'devnet';

const CONFIG = {
  mainnet: {
    apiOrigin: 'https://txline.txodds.com',
  },
  devnet: {
    apiOrigin: 'https://txline-dev.txodds.com',
  },
};

const apiOrigin = CONFIG[NETWORK]?.apiOrigin || CONFIG.devnet.apiOrigin;

let guestJwt = process.env.TXLINE_JWT || null;
let apiToken = process.env.TXLINE_API_TOKEN || null;

if (guestJwt && apiToken) {
  console.log('[TxLINE] Loaded saved credentials from .env — live data enabled');
} else {
  console.log('[TxLINE] No saved credentials — run `npm run setup:txline` to activate live data');
}

/**
 * Build the HTTP client with auth headers
 */
const getClient = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (guestJwt) headers['Authorization'] = `Bearer ${guestJwt}`;
  if (apiToken) headers['X-Api-Token'] = apiToken;
  
  return axios.create({
    timeout: 30000,
    headers,
    baseURL: apiOrigin,
  });
};

/**
 * Start a guest session to get a JWT (no API key needed)
 */
export const getGuestSession = async () => {
  try {
    const response = await axios.post(`${apiOrigin}/auth/guest/start`);
    guestJwt = response.data.token;
    console.log('[TxLINE] Guest session started');
    return guestJwt;
  } catch (error) {
    console.error('[TxLINE] Failed to start guest session:', error.message);
    return null;
  }
};

/**
 * Set the activated API token (called after on-chain subscription + activation)
 */
export const setApiToken = (token) => {
  apiToken = token;
};

/**
 * Fetch all upcoming fixtures (FUTURE matches included)
 * Endpoint: GET /api/fixtures/snapshot
 * Optional: ?competitionId=500005 to filter by competition
 */
export const getMatches = async (competitionId) => {
  try {
    if (!guestJwt) await getGuestSession();
    const client = getClient();
    const params = competitionId ? { competitionId } : {};
    const response = await client.get('/api/fixtures/snapshot', { params });
    return response.data;
  } catch (error) {
    console.error('[TxLINE] Error fetching fixtures:', error.message);
    return null;
  }
};

/**
 * Fetch a specific fixture by ID
 * Endpoint: GET /api/fixtures/snapshot?competitionId={id}
 * Note: TxLINE returns fixtures with FixtureId, Participant1, Participant2, StartTime
 */
export const getMatchById = async (fixtureId) => {
  try {
    if (!guestJwt) await getGuestSession();
    const client = getClient();
    const response = await client.get('/api/fixtures/snapshot');
    // Find the specific fixture from all fixtures
    const fixtures = response.data;
    if (Array.isArray(fixtures)) {
      return fixtures.find(f => String(f.FixtureId) === String(fixtureId)) || null;
    }
    return null;
  } catch (error) {
    console.error(`[TxLINE] Error fetching fixture ${fixtureId}:`, error.message);
    return null;
  }
};

/**
 * Fetch scores/events for a specific fixture
 * Endpoint: GET /api/scores/snapshot/{fixtureId}
 */
export const getMatchEvents = async (fixtureId) => {
  try {
    if (!guestJwt) await getGuestSession();
    const client = getClient();
    const response = await client.get(`/api/scores/snapshot/${fixtureId}`);
    return response.data;
  } catch (error) {
    console.error(`[TxLINE] Error fetching scores for fixture ${fixtureId}:`, error.message);
    return [];
  }
};

/**
 * Fetch pre-match odds for a specific fixture (works for FUTURE matches)
 * Endpoint: GET /api/odds/snapshot/{fixtureId}
 */
export const getMatchOdds = async (fixtureId) => {
  try {
    if (!guestJwt) await getGuestSession();
    const client = getClient();
    const response = await client.get(`/api/odds/snapshot/${fixtureId}`);
    return response.data;
  } catch (error) {
    console.error(`[TxLINE] Error fetching odds for fixture ${fixtureId}:`, error.message);
    return null;
  }
};
