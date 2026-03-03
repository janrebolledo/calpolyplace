const COLS = 100;
const ROWS = 100;
const BLOCK_SIZE = 10;
const DRAW_COLOR = '#000000';
const CURSOR_COLOR = '#FFFFFF';
const CURSOR_LINE_WIDTH = 2;

let isDrawing = false;

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('canvas');
canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;

/** Row-major flat array: grid[row * COLS + col] */
const grid = new Array(ROWS * COLS).fill(false);

let cursorCol = Math.floor(COLS / 2);
let cursorRow = Math.floor(ROWS / 2);

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

  // 1. Background
  ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

  // 2. Painted blocks
  ctx.fillStyle = DRAW_COLOR;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (grid[row * COLS + col]) {
        ctx.fillRect(
          col * BLOCK_SIZE,
          row * BLOCK_SIZE,
          BLOCK_SIZE,
          BLOCK_SIZE,
        );
      }
    }
  }

  // 3. Cursor (2px inset border)
  ctx.strokeStyle = CURSOR_COLOR;
  ctx.lineWidth = CURSOR_LINE_WIDTH;
  ctx.strokeRect(
    cursorCol * BLOCK_SIZE + CURSOR_LINE_WIDTH / 2,
    cursorRow * BLOCK_SIZE + CURSOR_LINE_WIDTH / 2,
    BLOCK_SIZE - CURSOR_LINE_WIDTH,
    BLOCK_SIZE - CURSOR_LINE_WIDTH,
  );
}

function moveCursor(dCol, dRow) {
  cursorCol = Math.max(0, Math.min(COLS - 1, cursorCol + dCol));
  cursorRow = Math.max(0, Math.min(ROWS - 1, cursorRow + dRow));
  if (isDrawing) grid[cursorRow * COLS + cursorCol] = true;
  render();
}

function toggleDrawing() {
  isDrawing = !isDrawing;
  render();
}

window.moveCursor = moveCursor;
window.toggleDrawing = toggleDrawing;
