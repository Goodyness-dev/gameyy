import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import apiRoutes from './routes.js';
import { startTxOddsPoller } from './txodds-poller.js';
import { globalEvents } from './events.js';
import { runDemo } from './demo-replayer.js';
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

// Demo trigger endpoint
app.post('/api/demo/start', (req, res) => {
  runDemo();
  res.json({ success: true });
});

// SSE Endpoint for Live Chat Web Clients
app.get('/api/live-chat/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send an initial connected message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to Live Chat Stream' })}\n\n`);

  // Listener for new chat messages
  const chatListener = (data) => {
    res.write(`data: ${JSON.stringify({ type: 'chat_message', ...data })}\n\n`);
  };

  globalEvents.on('chat_message', chatListener);

  req.on('close', () => {
    globalEvents.off('chat_message', chatListener);
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  
  // Start the TxLINE Live Score Poller (Free Tier: 60s updates)
  startTxOddsPoller();
});
