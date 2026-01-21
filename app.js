/* Game: click a cell -> invert all values in its row and column (0<->1). Goal: all ones. */

const $ = (sel) => document.querySelector(sel);

const els = {
  grid: $("#grid"),
  rows: $("#rows"),
  cols: $("#cols"),
  newBtn: $("#newBtn"),
  shuffleBtn: $("#shuffleBtn"),
  resetBtn: $("#resetBtn"),
  copyBtn: $("#copyBtn"),
  movesPill: $("#movesPill"),
  onesPill: $("#onesPill"),
  winPill: $("#winPill"),
  matrixInput: $("#matrixInput"),
  applyMatrixBtn: $("#applyMatrixBtn"),
  applyError: $("#applyError"),
};

/** @type {number[][]} */
let board = [];
/** @type {number[][]} */
let initialBoard = [];
let moves = 0;
let highlight = { r: -1, c: -1, pivot: false };

function clampInt(n, min, max, fallback) {
  const x = Number.parseInt(String(n), 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

function cloneBoard(b) {
  return b.map((row) => row.slice());
}

function createBoard(rows, cols, fill = 0) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
}

function countOnes(b) {
  let ones = 0;
  for (const row of b) for (const v of row) ones += v === 1 ? 1 : 0;
  return ones;
}

function isWin(b) {
  for (const row of b) for (const v of row) if (v !== 1) return false;
  return true;
}

function setWinUI(win) {
  els.winPill.hidden = !win;
}

function setError(msg) {
  els.applyError.textContent = msg || "";
  els.applyError.style.color = msg ? "rgba(239,68,68,0.95)" : "rgba(255,255,255,0.65)";
}

function updateStatus() {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const total = rows * cols;
  els.movesPill.textContent = `Ходы: ${moves}`;
  els.onesPill.textContent = `Единицы: ${countOnes(board)}/${total}`;
  setWinUI(isWin(board));
}

function renderGrid() {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  els.grid.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;
  els.grid.innerHTML = "";

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.setAttribute("role", "gridcell");
      btn.dataset.r = String(r);
      btn.dataset.c = String(c);
      btn.dataset.v = String(board[r][c]);
      btn.textContent = String(board[r][c]);
      els.grid.appendChild(btn);
    }
  }

  applyHighlights();
  updateStatus();
}

function applyHighlights() {
  const cells = els.grid.querySelectorAll(".cell");
  for (const cell of cells) {
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const isRC = (highlight.r === r || highlight.c === c) && highlight.r !== -1 && highlight.c !== -1;
    cell.classList.toggle("is-highlight", Boolean(isRC));
    cell.classList.toggle("is-pivot", highlight.pivot && highlight.r === r && highlight.c === c);
  }
}

function setCellValue(r, c, v) {
  board[r][c] = v;
  const cell = els.grid.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  if (cell) {
    cell.dataset.v = String(v);
    cell.textContent = String(v);
  }
}

function invertAt(r, c) {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  // invert row r
  for (let j = 0; j < cols; j++) {
    setCellValue(r, j, board[r][j] ^ 1);
  }

  // invert column c (skip intersection to match "row + column" toggle exactly once for pivot cell)
  for (let i = 0; i < rows; i++) {
    if (i === r) continue;
    setCellValue(i, c, board[i][c] ^ 1);
  }
}

function newGameFromBoard(b) {
  board = cloneBoard(b);
  initialBoard = cloneBoard(b);
  moves = 0;
  highlight = { r: -1, c: -1, pivot: false };
  renderGrid();
  syncMatrixTextarea();
}

function newEmptyFromInputs() {
  const rows = clampInt(els.rows.value, 2, 12, 4);
  const cols = clampInt(els.cols.value, 2, 12, 4);
  els.rows.value = String(rows);
  els.cols.value = String(cols);
  newGameFromBoard(createBoard(rows, cols, 0));
  setError("");
}

function shuffleGame() {
  // Start from all zeros then apply random valid moves: guarantees "reachable" boards.
  const rows = clampInt(els.rows.value, 2, 12, 4);
  const cols = clampInt(els.cols.value, 2, 12, 4);
  const b = createBoard(rows, cols, 0);

  board = cloneBoard(b);
  els.grid.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;
  renderGrid();

  const steps = Math.max(8, Math.floor((rows * cols) / 2));
  for (let k = 0; k < steps; k++) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    invertAt(r, c);
  }

  // After randomization, set as initial.
  initialBoard = cloneBoard(board);
  moves = 0;
  highlight = { r: -1, c: -1, pivot: false };
  applyHighlights();
  updateStatus();
  syncMatrixTextarea();
  setError("");
}

function resetGame() {
  newGameFromBoard(initialBoard);
  setError("");
}

function serializeBoard(b) {
  return b.map((row) => row.join(" ")).join("\n");
}

function syncMatrixTextarea() {
  els.matrixInput.value = serializeBoard(board);
}

function parseMatrix(text) {
  const lines = String(text)
    .trim()
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error("Пустая матрица.");

  /** @type {number[][]} */
  const rows = [];
  let cols = -1;

  for (const line of lines) {
    // accept: "0 1 0", "0,1,0", "0101"
    let tokens;
    if (/^[01]+$/.test(line)) tokens = line.split("");
    else tokens = line.split(/[,\s]+/).filter(Boolean);

    const row = tokens.map((t) => {
      if (t !== "0" && t !== "1") throw new Error(`Недопустимое значение "${t}". Используйте только 0/1.`);
      return t === "1" ? 1 : 0;
    });

    if (cols === -1) cols = row.length;
    if (row.length !== cols) throw new Error("Все строки должны быть одинаковой длины.");
    rows.push(row);
  }

  if (rows.length < 2 || cols < 2) throw new Error("Минимальный размер поля: 2×2.");
  if (rows.length > 12 || cols > 12) throw new Error("Максимальный размер поля: 12×12.");

  return rows;
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  // Fallback
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve();
}

// Events
els.grid.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const cell = target.closest(".cell");
  if (!cell) return;

  const r = Number(cell.dataset.r);
  const c = Number(cell.dataset.c);

  // Shift+click: only highlight row/col
  if (e.shiftKey) {
    highlight = { r, c, pivot: true };
    applyHighlights();
    return;
  }

  highlight = { r, c, pivot: true };
  applyHighlights();

  invertAt(r, c);
  moves += 1;
  updateStatus();
  syncMatrixTextarea();
});

els.grid.addEventListener("mousemove", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const cell = target.closest(".cell");
  if (!cell) return;
  if (highlight.pivot) return; // don't override after a click highlight
  const r = Number(cell.dataset.r);
  const c = Number(cell.dataset.c);
  highlight = { r, c, pivot: false };
  applyHighlights();
});

els.grid.addEventListener("mouseleave", () => {
  if (highlight.pivot) return;
  highlight = { r: -1, c: -1, pivot: false };
  applyHighlights();
});

els.newBtn.addEventListener("click", newEmptyFromInputs);
els.shuffleBtn.addEventListener("click", shuffleGame);
els.resetBtn.addEventListener("click", resetGame);

els.copyBtn.addEventListener("click", async () => {
  try {
    await copyToClipboard(serializeBoard(board));
    setError("Скопировано в буфер обмена.");
    setTimeout(() => setError(""), 1200);
  } catch {
    setError("Не удалось скопировать. Выделите текст в поле матрицы и скопируйте вручную.");
  }
});

els.applyMatrixBtn.addEventListener("click", () => {
  try {
    const b = parseMatrix(els.matrixInput.value);
    els.rows.value = String(b.length);
    els.cols.value = String(b[0].length);
    newGameFromBoard(b);
    setError("");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Не удалось прочитать матрицу.");
  }
});

// Initialize with the example from the screenshot (4x4).
newGameFromBoard([
  [0, 0, 1, 1],
  [0, 1, 1, 1],
  [1, 1, 0, 0],
  [1, 1, 0, 0],
]);

