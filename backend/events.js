import { EventEmitter } from 'events';

// Global Event Emitter for internal pub/sub (e.g. from bot.js to server.js SSE)
export const globalEvents = new EventEmitter();
