import { serve } from 'bun';
import index from './public/index.html';

const COLS = 100;
const ROWS = 100;
const COLORS = ['#ffbe0b', '#fb5607', '#ff006e', '#8338ec', '#3a86ff'];

const grid = new Array(ROWS * COLS).fill(false);
const clients = new Map(); // id -> { ws, color, col, row }
let colorIndex = 0;

function broadcast(senderId, msg) {
  const json = JSON.stringify(msg);
  for (const [id, client] of clients) {
    if (id !== senderId) client.ws.send(json);
  }
}

serve({
  routes: { '/': index },
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const id = crypto.randomUUID();
      const color = COLORS[colorIndex++ % COLORS.length];
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
      ws.send(JSON.stringify({ type: 'init', id, color, grid }));
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
      }
    },
    close(ws) {
      const { id } = ws.data;
      clients.delete(id);
      broadcast(id, { type: 'leave', id });
    },
  },
});
