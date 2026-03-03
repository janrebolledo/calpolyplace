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
    0, 0, canvas.width, canvas.height,
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
}

function updateViewport() {
  if (cursorCol < viewportCol) viewportCol = cursorCol;
  if (cursorCol >= viewportCol + VIEWPORT_COLS) viewportCol = cursorCol - VIEWPORT_COLS + 1;
  if (cursorRow < viewportRow) viewportRow = cursorRow;
  if (cursorRow >= viewportRow + VIEWPORT_ROWS) viewportRow = cursorRow - VIEWPORT_ROWS + 1;

  viewportCol = Math.max(0, Math.min(COLS - VIEWPORT_COLS, viewportCol));
  viewportRow = Math.max(0, Math.min(ROWS - VIEWPORT_ROWS, viewportRow));
}

function moveCursor(dCol, dRow) {
  cursorCol = Math.max(0, Math.min(COLS - 1, cursorCol + dCol));
  cursorRow = Math.max(0, Math.min(ROWS - 1, cursorRow + dRow));
  if (isDrawing) grid[cursorRow * COLS + cursorCol] = true;
  updateViewport();
  render();
}

function toggleDrawing() {
  isDrawing = !isDrawing;
  document.getElementById('draw-label').textContent = isDrawing ? 'stop drawing' : 'start drawing';
  render();
}

const REPEAT_INITIAL = 250;
const REPEAT_MIN = REPEAT_INITIAL / 3;
const REPEAT_DECAY = 0.88;

let repeatTimer = null;

function startRepeat(e, dCol, dRow) {
  e.preventDefault();
  stopRepeat();
  moveCursor(dCol, dRow);
  let interval = REPEAT_INITIAL;
  function schedule() {
    repeatTimer = setTimeout(() => {
      moveCursor(dCol, dRow);
      interval = Math.max(REPEAT_MIN, interval * REPEAT_DECAY);
      schedule();
    }, interval);
  }
  schedule();
}

function stopRepeat() {
  clearTimeout(repeatTimer);
  repeatTimer = null;
}

document.addEventListener('pointerup', stopRepeat);
document.addEventListener('pointercancel', stopRepeat);

window.moveCursor = moveCursor;
window.toggleDrawing = toggleDrawing;
window.startRepeat = startRepeat;
