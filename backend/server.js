import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import apiRoutes from './routes.js';
import { startTxOddsPoller } from './txodds-poller.js';
import './bot.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  
  // Start the TxLINE Live Score Poller (Free Tier: 60s updates)
  startTxOddsPoller();
});
