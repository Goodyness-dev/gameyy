import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TXLINE_BASE_URL = 'https://api.txodds.com/v1'; // Assuming base URL, will adjust based on actual TxLINE API spec if different
const TXLINE_API_KEY = process.env.TXLINE_API_KEY || '';

const txlineClient = axios.create({
  baseURL: TXLINE_BASE_URL,
  headers: {
    'Authorization': `Bearer ${TXLINE_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Fetch all World Cup matches
 */
export const getMatches = async () => {
  try {
    const response = await txlineClient.get('/worldcup/matches');
    return response.data;
  } catch (error) {
    console.error('Error fetching matches from TxLINE:', error.message);
    return null;
  }
};

/**
 * Fetch a specific match by ID
 */
export const getMatchById = async (id) => {
  try {
    const response = await txlineClient.get(`/worldcup/matches/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching match ${id}:`, error.message);
    return null;
  }
};

/**
 * Fetch events for a specific match
 */
export const getMatchEvents = async (id) => {
  try {
    const response = await txlineClient.get(`/worldcup/matches/${id}/events`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching events for match ${id}:`, error.message);
    return [];
  }
};

/**
 * Fetch live odds for a specific match (for the Market Defy multiplier)
 */
export const getMatchOdds = async (id) => {
  try {
    const response = await txlineClient.get(`/worldcup/odds/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching odds for match ${id}:`, error.message);
    return null;
  }
};
