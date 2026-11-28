import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';

// Jak będziesz miał własną grafikę, wrzuć ją do public/ (np. public/chase-bg.jpg)
// i podmień poniższą linijkę na: const CUSTOM_BG_URL: string | null = '/chase-bg.jpg';
const CUSTOM_BG_URL: string | null = null;

const COLS = 60;
const ROWS = 44;
const CELL = 8;
const CANVAS_W = COLS * CELL;
const CANVAS_H = ROWS * CELL;

const EMPTY = 0;
const SAFE = 1;
const TRAIL = 2;

const TARGET_PCT = 75;
const START_LIVES = 3;
const PLAYER_STEP_MS = 52;
const INNER_CELLS = (COLS - 2) * (ROWS - 2);

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fast: boolean;
}

interface PopEffect {
  x: number;
  y: number;
  timer: number;
}

interface GameRuntime {
  grid: Uint8Array;
  px: number;
  py: number;
  prevPx: number;
  prevPy: number;
  dx: number;
  dy: number;
  lastSafeX: number;
  lastSafeY: number;
  isDrawing: boolean;
  stepAccumMs: number;
  lives: number;
  capturedPct: number;
  enemies: Enemy[];
  pops: PopEffect[];
  hitFlash: number;
  respawnPause: number;
  ended: boolean;
}

function idx(x: number, y: number): number {
  return y * COLS + x;
}

function createInitialRuntime(): GameRuntime {
  const grid = new Uint8Array(COLS * ROWS);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1) {
        grid[idx(x, y)] = SAFE;
      }
    }
  }

  const startX = Math.floor(COLS / 2);
  const startY = 0;

  return {
    grid,
    px: startX,
    py: startY,
    prevPx: startX,
    prevPy: startY,
    dx: 0,
    dy: 0,
    lastSafeX: startX,
    lastSafeY: startY,
    isDrawing: false,
    stepAccumMs: 0,
    lives: START_LIVES,
    capturedPct: 0,
    enemies: [
      { x: 14.5, y: 14.5, vx: 11.2, vy: 9.8, fast: false },
      { x: 45.5, y: 28.5, vx: -10.5, vy: -11.4, fast: false },
      { x: 30.5, y: 24.5, vx: 15.2, vy: -13.6, fast: true },
    ],
    pops: [],
    hitFlash: 0,
    respawnPause: 0,
    ended: false,
  };
}

/** Rysuje proceduralne, „stockowe” tło miejsko-finansowe (widoczne pod odkrytym terenem). */
function renderStockBackground(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Nocno-szmaragdowe niebo
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  sky.addColorStop(0, '#0f2e28');
  sky.addColorStop(0.55, '#195443');
  sky.addColorStop(1, '#0b1e1b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Księżyc / łuna
  const glow = ctx.createRadialGradient(385, 68, 6, 385, 68, 70);
  glow.addColorStop(0, 'rgba(253, 224, 71, 0.95)');
  glow.addColorStop(0.35, 'rgba(250, 204, 21, 0.35)');
  glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(300, 0, 180, 150);

  // Delikatna siatka „banknotowa”
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_W; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_H);
    ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
    ctx.stroke();
  }

  // Sylwetki budynków (panorama miasta)
  const buildings = [
    { x: 0, w: 46, h: 120 },
    { x: 42, w: 38, h: 165 },
    { x: 78, w: 54, h: 110 },
    { x: 128, w: 44, h: 200 },
    { x: 170, w: 62, h: 145 },
    { x: 228, w: 36, h: 225 },
    { x: 262, w: 58, h: 155 },
    { x: 318, w: 48, h: 190 },
    { x: 364, w: 52, h: 130 },
    { x: 412, w: 68, h: 175 },
  ];

  for (const b of buildings) {
    const top = CANVAS_H - b.h;
    ctx.fillStyle = '#0d1b1e';
    ctx.fillRect(b.x, top, b.w, b.h);
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.22)';
    ctx.strokeRect(b.x + 0.5, top + 0.5, b.w - 1, b.h - 1);

    // Okna
    for (let wy = top + 12; wy < CANVAS_H - 18; wy += 16) {
      for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 12) {
        const lit = ((wx * 7 + wy * 13) % 5) !== 0;
        ctx.fillStyle = lit ? 'rgba(250, 204, 21, 0.72)' : 'rgba(148, 163, 184, 0.16)';
        ctx.fillRect(wx, wy, 6, 8);
      }
    }
  }

  // Subtelny znak wodny
  ctx.fillStyle = 'rgba(167, 243, 208, 0.12)';
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TEREN CZYSTY', CANVAS_W / 2, 118);
}

/** Odcina mniejszą część pustego pola po domknięciu ścieżki (logika Go! Hamster). */
function captureSmallerRegions(g: GameRuntime): void {
  const { grid } = g;

  // 1. Zamiana całego śladu na bezpieczne pole
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === TRAIL) grid[i] = SAFE;
  }

  // 2. Wyszukanie wszystkich spójnych obszarów EMPTY (BFS)
  const visited = new Uint8Array(COLS * ROWS);
  const components: number[][] = [];
  const queue = new Int32Array(COLS * ROWS);

  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      const start = idx(x, y);
      if (grid[start] !== EMPTY || visited[start]) continue;

      let head = 0;
      let tail = 0;
      queue[tail++] = start;
      visited[start] = 1;
      const cells: number[] = [];

      while (head < tail) {
        const cur = queue[head++];
        cells.push(cur);
        const cx = cur % COLS;
        const cy = (cur - cx) / COLS;

        const neighbors = [
          cx + 1 < COLS - 1 ? cur + 1 : -1,
          cx - 1 > 0 ? cur - 1 : -1,
          cy + 1 < ROWS - 1 ? cur + COLS : -1,
          cy - 1 > 0 ? cur - COLS : -1,
        ];

        for (let k = 0; k < 4; k++) {
          const n = neighbors[k];
          if (n !== -1 && !visited[n] && grid[n] === EMPTY) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
      }

      components.push(cells);
    }
  }

  // 3. Jeśli pole podzieliło się na >= 2 części, zostawiamy tylko NAJWIĘKSZĄ (remis: ta z większą liczbą wrogów)
  if (components.length > 1) {
    const enemyCellSet = new Set(
      g.enemies.map((e) => idx(Math.floor(e.x), Math.floor(e.y)))
    );

    let keepIndex = 0;
    let bestSize = -1;
    let bestEnemies = -1;

    for (let i = 0; i < components.length; i++) {
      const comp = components[i];
      let enemyCount = 0;
      for (let j = 0; j < comp.length; j++) {
        if (enemyCellSet.has(comp[j])) enemyCount++;
      }
      if (
        comp.length > bestSize ||
        (comp.length === bestSize && enemyCount > bestEnemies)
      ) {
        bestSize = comp.length;
        bestEnemies = enemyCount;
        keepIndex = i;
      }
    }

    for (let i = 0; i < components.length; i++) {
      if (i === keepIndex) continue;
      const comp = components[i];
      for (let j = 0; j < comp.length; j++) {
        grid[comp[j]] = SAFE;
      }
    }
  }

  // 4. Eliminacja wrogów zamkniętych w odciętym obszarze
  const survivors: Enemy[] = [];
  for (const e of g.enemies) {
    const ex = Math.max(0, Math.min(COLS - 1, Math.floor(e.x)));
    const ey = Math.max(0, Math.min(ROWS - 1, Math.floor(e.y)));
    if (grid[idx(ex, ey)] === SAFE) {
      g.pops.push({ x: e.x * CELL, y: e.y * CELL, timer: 0.45 });
    } else {
      survivors.push(e);
    }
  }
  g.enemies = survivors;

  // 5. Przeliczenie % zajętego wnętrza planszy
  let captured = 0;
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (grid[idx(x, y)] === SAFE) captured++;
    }
  }
  g.capturedPct = Math.round((captured / INNER_CELLS) * 100);
}

export function ChaseScreen() {
  const { state, chaseFinish, dismissChase } = useGameStore();
  const chase = state?.activeChase ?? null;
  const isFinished = chase?.finished ?? false;
  const result = chase?.result ?? null;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<GameRuntime>(createInitialRuntime());
  const finishRef = useRef(chaseFinish);
  finishRef.current = chaseFinish;

  const [hud, setHud] = useState({
    lives: START_LIVES,
    capturedPct: 0,
    enemiesLeft: 3,
  });

  // Reset gry przy otwarciu nowego pościgu
  useEffect(() => {
    if (!chase || chase.finished) return;
    runtimeRef.current = createInitialRuntime();
    setHud({ lives: START_LIVES, capturedPct: 0, enemiesLeft: 3 });
  }, [chase !== null]);

  // Przygotowanie tła (stockowe albo własny obrazek z CUSTOM_BG_URL)
  useEffect(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_W;
    offscreen.height = CANVAS_H;
    renderStockBackground(offscreen);
    bgCanvasRef.current = offscreen;

    if (CUSTOM_BG_URL) {
      const img = new Image();
      img.onload = () => {
        const ctx = offscreen.getContext('2d');
        if (!ctx) return;
        const scale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, (CANVAS_W - dw) / 2, (CANVAS_H - dh) / 2, dw, dh);
      };
      img.src = CUSTOM_BG_URL;
    }
  }, []);

  const setDirection = (dx: number, dy: number) => {
    const g = runtimeRef.current;
    if (g.ended || isFinished) return;

    // Blokujemy natychmiastowy zawrót o 180° na własny ślad
    if (g.isDrawing && dx !== 0 && dx === -g.dx) return;
    if (g.isDrawing && dy !== 0 && dy === -g.dy) return;

    if (g.isDrawing && (dx !== 0 || dy !== 0)) {
      const nx = g.px + dx;
      const ny = g.py + dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && g.grid[idx(nx, ny)] === TRAIL) {
        return;
      }
    }

    g.dx = dx;
    g.dy = dy;
  };

  // Obsługa klawiatury (Strzałki / WASD + Spacja lub 5 jako STOP)
  useEffect(() => {
    if (!chase) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isFinished) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          dismissChase();
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setDirection(0, -1);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setDirection(0, 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setDirection(-1, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setDirection(1, 0);
      } else if (e.key === ' ' || e.key === '5') {
        e.preventDefault();
        setDirection(0, 0);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chase !== null, isFinished, dismissChase]);

  // Główna pętla gry 60 FPS
  useEffect(() => {
    if (!chase) return;

    let rafId = 0;
    let lastTime = performance.now();

    const loseLife = (g: GameRuntime) => {
      g.lives -= 1;
      for (let i = 0; i < g.grid.length; i++) {
        if (g.grid[i] === TRAIL) g.grid[i] = EMPTY;
      }
      g.px = g.lastSafeX;
      g.py = g.lastSafeY;
      g.prevPx = g.lastSafeX;
      g.prevPy = g.lastSafeY;
      g.dx = 0;
      g.dy = 0;
      g.isDrawing = false;
      g.hitFlash = 0.45;
      g.respawnPause = 0.55;

      setHud({
        lives: Math.max(0, g.lives),
        capturedPct: g.capturedPct,
        enemiesLeft: g.enemies.length,
      });

      if (g.lives <= 0 && !g.ended) {
        g.ended = true;
        finishRef.current('caught');
      }
    };

    const stepPlayer = (g: GameRuntime) => {
      if (g.dx === 0 && g.dy === 0) {
        g.prevPx = g.px;
        g.prevPy = g.py;
        return;
      }

      const nx = g.px + g.dx;
      const ny = g.py + g.dy;

      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
        g.dx = 0;
        g.dy = 0;
        g.prevPx = g.px;
        g.prevPy = g.py;
        return;
      }

      const targetCell = g.grid[idx(nx, ny)];

      if (targetCell === TRAIL) {
        g.dx = 0;
        g.dy = 0;
        g.prevPx = g.px;
        g.prevPy = g.py;
        return;
      }

      g.prevPx = g.px;
      g.prevPy = g.py;
      g.px = nx;
      g.py = ny;

      if (targetCell === SAFE) {
        if (g.isDrawing) {
          captureSmallerRegions(g);
          g.isDrawing = false;
          g.dx = 0;
          g.dy = 0;
          g.lastSafeX = nx;
          g.lastSafeY = ny;

          setHud({
            lives: g.lives,
            capturedPct: g.capturedPct,
            enemiesLeft: g.enemies.length,
          });

          if ((g.capturedPct >= TARGET_PCT || g.enemies.length === 0) && !g.ended) {
            g.ended = true;
            finishRef.current('escaped');
          }
        } else {
          g.lastSafeX = nx;
          g.lastSafeY = ny;
        }
      } else {
        if (!g.isDrawing) {
          g.lastSafeX = g.prevPx;
          g.lastSafeY = g.prevPy;
          g.isDrawing = true;
        }
        g.grid[idx(nx, ny)] = TRAIL;
      }
    };

    const stepEnemies = (g: GameRuntime, dt: number) => {
      for (const e of g.enemies) {
        const dist = Math.max(Math.abs(e.vx * dt), Math.abs(e.vy * dt));
        const subSteps = Math.max(1, Math.ceil(dist / 0.25));
        const subDt = dt / subSteps;

        for (let s = 0; s < subSteps; s++) {
          const nextX = e.x + e.vx * subDt;
          const cellX = Math.floor(nextX);
          const curY = Math.floor(e.y);
          if (
            cellX <= 0 ||
            cellX >= COLS - 1 ||
            g.grid[idx(cellX, Math.max(0, Math.min(ROWS - 1, curY)))] === SAFE
          ) {
            e.vx = -e.vx;
          } else {
            e.x = nextX;
          }

          const nextY = e.y + e.vy * subDt;
          const curX = Math.floor(e.x);
          const cellY = Math.floor(nextY);
          if (
            cellY <= 0 ||
            cellY >= ROWS - 1 ||
            g.grid[idx(Math.max(0, Math.min(COLS - 1, curX)), cellY)] === SAFE
          ) {
            e.vy = -e.vy;
          } else {
            e.y = nextY;
          }

          const ex = Math.max(0, Math.min(COLS - 1, Math.floor(e.x)));
          const ey = Math.max(0, Math.min(ROWS - 1, Math.floor(e.y)));

          if (g.grid[idx(ex, ey)] === TRAIL) {
            loseLife(g);
            return;
          }

          if (g.isDrawing) {
            const dpx = e.x - (g.px + 0.5);
            const dpy = e.y - (g.py + 0.5);
            if (dpx * dpx + dpy * dpy < 0.72) {
              loseLife(g);
              return;
            }
          }
        }
      }
    };

    const draw = (g: GameRuntime, now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Tło (odsłaniane w strefach SAFE)
      if (bgCanvasRef.current) {
        ctx.drawImage(bgCanvasRef.current, 0, 0);
      } else {
        ctx.fillStyle = '#0f2e28';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      // 2. Zakryte pole EMPTY + ślad TRAIL
      const { grid } = g;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const v = grid[idx(x, y)];
          if (v === EMPTY) {
            ctx.fillStyle = (x + y) % 2 === 0 ? '#121318' : '#161820';
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
          } else if (v === TRAIL) {
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
          }
        }
      }

      // 3. Krawędź ramki i odciętych stref
      ctx.fillStyle = 'rgba(52, 211, 153, 0.45)';
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (grid[idx(x, y)] !== SAFE) continue;
          const isOuter = x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1;
          const touchesEmpty =
            !isOuter &&
            (grid[idx(x + 1, y)] === EMPTY ||
              grid[idx(x - 1, y)] === EMPTY ||
              grid[idx(x, y + 1)] === EMPTY ||
              grid[idx(x, y - 1)] === EMPTY);

          if (isOuter) {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
          } else if (touchesEmpty) {
            ctx.fillStyle = 'rgba(52, 211, 153, 0.65)';
            ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
          }
        }
      }

      // 4. Efekty eliminacji wrogów
      for (const p of g.pops) {
        const progress = 1 - p.timer / 0.45;
        ctx.strokeStyle = `rgba(74, 222, 128, ${1 - progress})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6 + progress * 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 5. Wrogowie (mafiozi)
      const pulse = 0.85 + Math.sin(now / 110) * 0.15;
      for (const e of g.enemies) {
        const cx = e.x * CELL;
        const cy = e.y * CELL;

        if (e.fast) {
          // Szybki „cyngiel” (pomarańczowa gwiazdka — jak szybki wróg w Go! Hamster)
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(now / 140);
          ctx.fillStyle = '#fb923c';
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const r = i % 2 === 0 ? 7.5 : 3.2;
            const a = (i * Math.PI) / 4;
            if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Standardowy mafiozo
          ctx.fillStyle = `rgba(239, 68, 68, ${0.28 * pulse})`;
          ctx.beginPath();
          ctx.arc(cx, cy, 9.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.arc(cx, cy, 6.2, 0, Math.PI * 2);
          ctx.fill();

          // Kapelusz + okulary
          ctx.fillStyle = '#111827';
          ctx.fillRect(cx - 6, cy - 6, 12, 2.5);
          ctx.fillRect(cx - 4, cy - 9, 8, 3.5);
          ctx.fillStyle = '#fef2f2';
          ctx.fillRect(cx - 3.5, cy - 1.5, 2.5, 2);
          ctx.fillRect(cx + 1, cy - 1.5, 2.5, 2);
        }
      }

      // 6. Gracz (płynna interpolacja między krokami siatki)
      const t = Math.min(1, g.stepAccumMs / PLAYER_STEP_MS);
      const drawX = (g.prevPx + (g.px - g.prevPx) * t + 0.5) * CELL;
      const drawY = (g.prevPy + (g.py - g.prevPy) * t + 0.5) * CELL;

      ctx.fillStyle = g.isDrawing ? 'rgba(251, 191, 36, 0.35)' : 'rgba(56, 189, 248, 0.35)';
      ctx.beginPath();
      ctx.arc(drawX, drawY, 8.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = g.isDrawing ? '#facc15' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(drawX, drawY, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 7. Błysk po trafieniu
      if (g.hitFlash > 0) {
        ctx.fillStyle = `rgba(220, 38, 38, ${Math.min(0.45, g.hitFlash)})`;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const g = runtimeRef.current;

      if (g.hitFlash > 0) g.hitFlash = Math.max(0, g.hitFlash - dt);
      if (g.pops.length > 0) {
        g.pops = g.pops
          .map((p) => ({ ...p, timer: p.timer - dt }))
          .filter((p) => p.timer > 0);
      }

      if (!g.ended && !isFinished) {
        if (g.respawnPause > 0) {
          g.respawnPause = Math.max(0, g.respawnPause - dt);
        } else {
          g.stepAccumMs += dt * 1000;
          while (g.stepAccumMs >= PLAYER_STEP_MS && !g.ended) {
            g.stepAccumMs -= PLAYER_STEP_MS;
            stepPlayer(g);
          }
          if (!g.ended) {
            stepEnemies(g, dt);
          }
        }
      }

      draw(g, now);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [chase !== null, isFinished]);

  if (!state || !chase) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-3 sm:p-4 z-50">
      <div className="bg-stone-900 text-stone-100 rounded-lg shadow-2xl max-w-xl w-full p-4 sm:p-5 border-4 border-red-900">
        {/* Górny HUD */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-emerald-400 uppercase tracking-widest leading-tight">
              Ucieknij przed mafią
            </h2>
            <p className="text-[11px] text-stone-400">
              Odetnij {TARGET_PCT}% planszy lub zamknij wszystkich mafiozów
            </p>
          </div>

          <div className="text-right shrink-0">
            <div className="text-base leading-none tracking-wider" title="Pozostałe życia">
              {Array.from({ length: START_LIVES }).map((_, i) => (
                <span key={i} className={i < hud.lives ? 'opacity-100' : 'opacity-20'}>
                  ❤️
                </span>
              ))}
            </div>
            <div className="text-[11px] font-mono text-stone-400 mt-1">
              Mafia: <span className="text-red-400 font-bold">{hud.enemiesLeft}</span>
            </div>
          </div>
        </div>

        {/* Pasek postępu jak w Go! Hamster */}
        <div className="mb-3">
          <div className="flex justify-between text-xs font-mono mb-1">
            <span className="text-stone-300">
              Odkryto: <b className="text-emerald-400">{hud.capturedPct}%</b>
            </span>
            <span className="text-stone-400">Cel: {TARGET_PCT}%</span>
          </div>
          <div className="relative h-2.5 bg-stone-800 rounded overflow-hidden border border-stone-700">
            <div
              className="h-full bg-emerald-500 transition-all duration-150"
              style={{ width: `${Math.min(100, hud.capturedPct)}%` }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-300"
              style={{ left: `${TARGET_PCT}%` }}
              title={`Cel: ${TARGET_PCT}%`}
            />
          </div>
        </div>

        {/* Plansza Canvas */}
        <div className="flex justify-center mb-3">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full max-w-[480px] aspect-[60/44] rounded border-2 border-stone-700 bg-black block select-none"
          />
        </div>

        {/* Sterowanie lub podsumowanie */}
        {!isFinished ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-col items-center gap-1.5 select-none">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDirection(0, -1);
                }}
                className="bg-stone-700 hover:bg-stone-600 active:bg-stone-500 w-14 h-10 rounded font-bold text-lg"
              >
                ↑
              </button>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setDirection(-1, 0);
                  }}
                  className="bg-stone-700 hover:bg-stone-600 active:bg-stone-500 w-14 h-10 rounded font-bold text-lg"
                >
                  ←
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setDirection(0, 0);
                  }}
                  title="Zatrzymaj (Spacja / 5)"
                  className="bg-amber-700 hover:bg-amber-600 active:bg-amber-500 w-14 h-10 rounded font-bold text-sm"
                >
                  ■
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setDirection(1, 0);
                  }}
                  className="bg-stone-700 hover:bg-stone-600 active:bg-stone-500 w-14 h-10 rounded font-bold text-lg"
                >
                  →
                </button>
              </div>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDirection(0, 1);
                }}
                className="bg-stone-700 hover:bg-stone-600 active:bg-stone-500 w-14 h-10 rounded font-bold text-lg"
              >
                ↓
              </button>
            </div>

            <p className="text-[11px] text-stone-400 text-center">
              Sterowanie: <b>Strzałki / WASD</b> · Stop: <b>Spacja</b> lub <b>5</b>
            </p>
          </div>
        ) : (
          <div className="text-center pt-1">
            <div
              className={`text-xl font-bold mb-1 ${
                result === 'escaped' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {result === 'escaped' ? 'Uciekłeś mafii!' : 'Dopadli cię...'}
            </div>
            <p className="text-xs text-stone-400 mb-3">
              {result === 'escaped'
                ? 'Odkryto teren! +10 opinii publicznej, -10 relacji z mafią, -10 000 kosztów ucieczki.'
                : 'Kara -50 000, -15 opinii publicznej i -20 relacji z mafią.'}
            </p>
            <button
              type="button"
              onClick={dismissChase}
              className="bg-stone-100 text-stone-900 w-full py-2.5 rounded font-bold hover:bg-white transition"
            >
              Wróć do biura
            </button>
          </div>
        )}
      </div>
    </div>
  );
}