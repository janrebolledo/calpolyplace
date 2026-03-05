import.meta.hot.accept;
import { WebHaptics, defaultPatterns } from 'web-haptics';

const haptics = new WebHaptics();
import bgSrc from './assets/bg.png';

document.getElementById('canvas-bg').style.backgroundImage = `url(${bgSrc})`;

const COLS = 100;
const ROWS = 100;
const VIEWPORT_COLS = 75;
const VIEWPORT_ROWS = 75;
const BLOCK_SIZE = 10;
const DRAW_COLOR = '#000000';
const CURSOR_COLOR = '#FFFFFF';
const CURSOR_LINE_WIDTH = 2;

let isDrawing = false;
let ws = null;
let myId = null;
const remoteCursors = new Map(); // id -> { color, col, row }
let resetAt = null;

const countdown = document.getElementById('countdown');

function updateCountdown() {
  if (!resetAt) return;
  const secs = Math.max(0, Math.round((resetAt - Date.now()) / 1000));
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  countdown.textContent = `${m}:${s}`;
}
setInterval(updateCountdown, 1000);

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('canvas');
canvas.width = VIEWPORT_COLS * BLOCK_SIZE;
canvas.height = VIEWPORT_ROWS * BLOCK_SIZE;

/** Row-major flat array: grid[row * COLS + col] */
const grid = new Array(ROWS * COLS).fill(false);

let cursorCol = Math.floor(COLS / 2);
let cursorRow = Math.floor(ROWS / 2);

let viewportCol = Math.floor((COLS - VIEWPORT_COLS) / 2);
let viewportRow = Math.floor((ROWS - VIEWPORT_ROWS) / 2);

/** @type {HTMLImageElement | null} */
let bgImage = null;

const img = new Image();
img.src = '/assets/bg.png';
img.onload = () => {
  bgImage = img;
  render();
};

function render() {
  if (!canvas || !bgImage) return;
  const ctx = canvas.getContext('2d');

  // 1. Background (slice the viewport portion from the full image)
  const fullW = COLS * BLOCK_SIZE;
  const fullH = ROWS * BLOCK_SIZE;
  ctx.drawImage(
    bgImage,
    (viewportCol / COLS) * bgImage.naturalWidth,
    (viewportRow / ROWS) * bgImage.naturalHeight,
    (VIEWPORT_COLS / COLS) * bgImage.naturalWidth,
    (VIEWPORT_ROWS / ROWS) * bgImage.naturalHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  // 2. Painted blocks
  ctx.fillStyle = DRAW_COLOR;
  for (let row = viewportRow; row < viewportRow + VIEWPORT_ROWS; row++) {
    for (let col = viewportCol; col < viewportCol + VIEWPORT_COLS; col++) {
      if (grid[row * COLS + col]) {
        ctx.fillRect(
          (col - viewportCol) * BLOCK_SIZE,
          (row - viewportRow) * BLOCK_SIZE,
          BLOCK_SIZE,
          BLOCK_SIZE,
        );
      }
    }
  }

  // 3. Cursor (2px inset border)
  const screenCol = cursorCol - viewportCol;
  const screenRow = cursorRow - viewportRow;
  ctx.strokeStyle = CURSOR_COLOR;
  ctx.lineWidth = CURSOR_LINE_WIDTH;
  ctx.strokeRect(
    screenCol * BLOCK_SIZE + CURSOR_LINE_WIDTH / 2,
    screenRow * BLOCK_SIZE + CURSOR_LINE_WIDTH / 2,
    BLOCK_SIZE - CURSOR_LINE_WIDTH,
    BLOCK_SIZE - CURSOR_LINE_WIDTH,
  );

  // 4. Remote cursors (only those within viewport)
  for (const [, cursor] of remoteCursors) {
    const rScreenCol = cursor.col - viewportCol;
    const rScreenRow = cursor.row - viewportRow;
    if (
      rScreenCol < 0 ||
      rScreenCol >= VIEWPORT_COLS ||
      rScreenRow < 0 ||
      rScreenRow >= VIEWPORT_ROWS
    )
      continue;
    ctx.strokeStyle = cursor.color;
    ctx.lineWidth = CURSOR_LINE_WIDTH;
    ctx.strokeRect(
      rScreenCol * BLOCK_SIZE + CURSOR_LINE_WIDTH / 2,
      rScreenRow * BLOCK_SIZE + CURSOR_LINE_WIDTH / 2,
      BLOCK_SIZE - CURSOR_LINE_WIDTH,
      BLOCK_SIZE - CURSOR_LINE_WIDTH,
    );
  }
}

function updateViewport() {
  if (cursorCol < viewportCol) viewportCol = cursorCol;
  if (cursorCol >= viewportCol + VIEWPORT_COLS)
    viewportCol = cursorCol - VIEWPORT_COLS + 1;
  if (cursorRow < viewportRow) viewportRow = cursorRow;
  if (cursorRow >= viewportRow + VIEWPORT_ROWS)
    viewportRow = cursorRow - VIEWPORT_ROWS + 1;

  viewportCol = Math.max(0, Math.min(COLS - VIEWPORT_COLS, viewportCol));
  viewportRow = Math.max(0, Math.min(ROWS - VIEWPORT_ROWS, viewportRow));
}

function moveCursor(dCol, dRow) {
  cursorCol = Math.max(0, Math.min(COLS - 1, cursorCol + dCol));
  cursorRow = Math.max(0, Math.min(ROWS - 1, cursorRow + dRow));
  if (isDrawing) {
    grid[cursorRow * COLS + cursorCol] = true;
    if (ws && ws.readyState === WebSocket.OPEN)
      ws.send(
        JSON.stringify({ type: 'paint', col: cursorCol, row: cursorRow }),
      );
  }
  if (ws && ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify({ type: 'cursor', col: cursorCol, row: cursorRow }));
  updateViewport();
  render();
}

function toggleDrawing() {
  isDrawing = !isDrawing;
  document.getElementById('draw-label').textContent = isDrawing
    ? 'stop drawing'
    : 'start drawing';
  haptics.trigger(defaultPatterns.success);
  render();
}

function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws${location.search}`);
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'init') {
      myId = msg.id;
      resetAt = msg.resetAt;
      updateCountdown();
      for (let i = 0; i < msg.grid.length; i++) grid[i] = msg.grid[i];
      render();
    } else if (msg.type === 'cursor') {
      remoteCursors.set(msg.id, {
        color: msg.color,
        col: msg.col,
        row: msg.row,
      });
      render();
    } else if (msg.type === 'paint') {
      grid[msg.row * COLS + msg.col] = true;
      render();
    } else if (msg.type === 'reset') {
      resetAt = msg.resetAt;
      grid.fill(false);
      render();
    } else if (msg.type === 'leave') {
      remoteCursors.delete(msg.id);
      render();
    }
  });
}
connectWS();

const REPEAT_INITIAL = 250;
const REPEAT_MIN = REPEAT_INITIAL / 3;
const REPEAT_DECAY = 0.88;

let repeatTimer = null;
let currentDir = { dCol: 0, dRow: 0 };

function startRepeat(e, dCol, dRow) {
  e.preventDefault();
  stopRepeat();
  currentDir.dCol = dCol;
  currentDir.dRow = dRow;
  moveCursor(dCol, dRow);
  let interval = REPEAT_INITIAL;
  function schedule() {
    repeatTimer = setTimeout(() => {
      moveCursor(currentDir.dCol, currentDir.dRow);
      interval = Math.max(REPEAT_MIN, interval * REPEAT_DECAY);
      schedule();
    }, interval);
  }
  schedule();
}

function updateRepeatDir(dCol, dRow) {
  currentDir.dCol = dCol;
  currentDir.dRow = dRow;
}

function stopRepeat() {
  clearTimeout(repeatTimer);
  repeatTimer = null;
}

document.addEventListener('pointerup', stopRepeat);
document.addEventListener('pointercancel', stopRepeat);

const KEY_DIRS = {
  ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
  ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
};

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.target !== document.body && e.target !== document.documentElement) return;
  const dir = KEY_DIRS[e.key];
  if (dir) {
    e.preventDefault();
    startRepeat(e, dir[0], dir[1]);
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    toggleDrawing();
  }
});

document.addEventListener('keyup', (e) => {
  if (KEY_DIRS[e.key]) stopRepeat();
});

window.moveCursor = moveCursor;
window.toggleDrawing = toggleDrawing;
window.startRepeat = startRepeat;
window.updateRepeatDir = updateRepeatDir;
window.isRepeating = () => repeatTimer !== null;

// Viewport panning via touch/drag on the canvas
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panOriginCol = 0;
let panOriginRow = 0;
let panDisabledDrawing = false;

canvas.style.touchAction = 'none';

canvas.addEventListener('pointerdown', (e) => {
  isPanning = true;
  panDisabledDrawing = false;
  panStartX = e.clientX;
  panStartY = e.clientY;
  panOriginCol = viewportCol;
  panOriginRow = viewportRow;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!isPanning) return;
  const dx = e.clientX - panStartX;
  const dy = e.clientY - panStartY;
  if (!panDisabledDrawing && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    panDisabledDrawing = true;
    if (isDrawing) toggleDrawing();
  }
  const rect = canvas.getBoundingClientRect();
  viewportCol = Math.max(0, Math.min(COLS - VIEWPORT_COLS, Math.round(panOriginCol - dx * VIEWPORT_COLS / rect.width)));
  viewportRow = Math.max(0, Math.min(ROWS - VIEWPORT_ROWS, Math.round(panOriginRow - dy * VIEWPORT_ROWS / rect.height)));
  render();
});

canvas.addEventListener('pointerup', () => { isPanning = false; });
canvas.addEventListener('pointercancel', () => { isPanning = false; });
