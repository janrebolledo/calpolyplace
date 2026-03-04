import { serve } from 'bun';
import { trackPageVisit, trackSessionOpen, trackSessionClose, trackPaint, trackCanvasReset, getStats } from './analytics.js';
import index from './public/index.html';
import tailwind from 'bun-plugin-tailwind';

const COLS = 100;
const ROWS = 100;
const COLORS = ['#ffbe0b', '#fb5607', '#ff006e', '#8338ec', '#3a86ff'];

const grid = new Array(ROWS * COLS).fill(false);
const clients = new Map(); // id -> { ws, color, col, row }
let colorIndex = 0;

function nextResetTime() {
  const next = new Date();
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next.getTime();
}

let resetAt = nextResetTime();

function scheduleReset() {
  setTimeout(() => {
    grid.fill(false);
    trackCanvasReset();
    resetAt = nextResetTime();
    const json = JSON.stringify({ type: 'reset', resetAt });
    for (const [, client] of clients) client.ws.send(json);
    scheduleReset();
  }, resetAt - Date.now());
}
scheduleReset();

function broadcast(senderId, msg) {
  const json = JSON.stringify(msg);
  for (const [id, client] of clients) {
    if (id !== senderId) client.ws.send(json);
  }
}

serve({
  port: process.env.PORT || 3000,
  plugins: [tailwind],
  routes: {
    '/': index,
    '/stats': () => Response.json(getStats()),
  },
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const id = crypto.randomUUID();
      const color = COLORS[colorIndex++ % COLORS.length];
      trackPageVisit(req);
      const upgraded = server.upgrade(req, { data: { id, color } });
      if (upgraded) return;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }
    return new Response(Bun.file(`./public${url.pathname}`));
  },
  websocket: {
    open(ws) {
      const { id, color } = ws.data;
      clients.set(id, { ws, color, col: 50, row: 50 });
      ws.send(JSON.stringify({ type: 'init', id, color, grid, resetAt }));
      trackSessionOpen(id, clients.size);
    },
    message(ws, raw) {
      const { id, color } = ws.data;
      const msg = JSON.parse(raw);
      if (msg.type === 'cursor') {
        clients.get(id).col = msg.col;
        clients.get(id).row = msg.row;
        broadcast(id, { type: 'cursor', id, color, col: msg.col, row: msg.row });
      } else if (msg.type === 'paint') {
        grid[msg.row * COLS + msg.col] = true;
        broadcast(id, { type: 'paint', col: msg.col, row: msg.row });
        trackPaint(id);
      }
    },
    close(ws) {
      const { id } = ws.data;
      clients.delete(id);
      broadcast(id, { type: 'leave', id });
      trackSessionClose(id);
    },
  },
});
