/* 2048 — slide and merge tiles to reach 2048. */
window.ArcadeGames = window.ArcadeGames || {};

ArcadeGames.g2048 = {
  meta: {
    title: '2048',
    tagline: 'Slide the tiles. Chase the 2048.',
    category: 'puzzle',
    accent: '#fbbf24',
    accent2: '#f59e0b',
    aspect: '1 / 1',
    hint: 'Controls: arrow keys / WASD &middot; swipe on touch',
    art: '<svg viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="10" fill="#fff" opacity="0.92"/><text x="32" y="41" text-anchor="middle" font-family="Arial Black" font-size="20" fill="#b45309">2048</text></svg>'
  },

  create(stage, ui) {
    const SIZE = 480, N = 4, GAP = 12;
    const CELL = (SIZE - GAP * (N + 1)) / N;
    const cv = document.createElement('canvas');
    cv.width = SIZE; cv.height = SIZE;
    stage.appendChild(cv);
    const ctx = cv.getContext('2d');

    let grid, score, alive, won, touchX, touchY;

    const COLORS = {
      2: ['#eee4da', '#776e65'], 4: ['#ede0c8', '#776e65'],
      8: ['#f2b179', '#f9f6f2'], 16: ['#f59563', '#f9f6f2'],
      32: ['#f67c5f', '#f9f6f2'], 64: ['#f65e3b', '#f9f6f2'],
      128: ['#edcf72', '#f9f6f2'], 256: ['#edcc61', '#f9f6f2'],
      512: ['#edc850', '#f9f6f2'], 1024: ['#edc53f', '#f9f6f2'],
      2048: ['#edc22e', '#f9f6f2']
    };
    function tileColor(v) {
      if (COLORS[v]) return COLORS[v];
      return ['#3c3a32', '#f9f6f2'];
    }

    function reset() {
      grid = Array.from({ length: N }, () => Array(N).fill(0));
      score = 0; ui.score(0);
      alive = true; won = false;
      spawn(); spawn();
      draw();
    }

    function emptyCells() {
      const out = [];
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++)
          if (grid[y][x] === 0) out.push({ x, y });
      return out;
    }

    function spawn() {
      const cells = emptyCells();
      if (!cells.length) return;
      const c = cells[(Math.random() * cells.length) | 0];
      grid[c.y][c.x] = Math.random() < 0.9 ? 2 : 4;
    }

    // lines of values in move order; write back merged lines
    function move(dir) {
      if (!alive) return false;
      let lines = [];
      if (dir === 'left') for (let y = 0; y < N; y++) lines.push(grid[y].map((v, x) => ({ x, y, v })));
      if (dir === 'right') for (let y = 0; y < N; y++) lines.push(grid[y].map((v, x) => ({ x: N - 1 - x, y, v })).reverse());
      if (dir === 'up') for (let x = 0; x < N; x++) lines.push(grid.map((row, y) => ({ x, y, v: row[x] })));
      if (dir === 'down') for (let x = 0; x < N; x++) lines.push(grid.map((row, y) => ({ x, y: N - 1 - y, v: row[N - 1 - y] })).reverse());

      let moved = false, gained = 0;
      for (const line of lines) {
        const vals = line.map(c => c.v).filter(v => v !== 0);
        const merged = [];
        for (let i = 0; i < vals.length; i++) {
          if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
            const nv = vals[i] * 2;
            merged.push(nv);
            gained += nv;
            i++;
          } else {
            merged.push(vals[i]);
          }
        }
        while (merged.length < N) merged.push(0);
        for (let i = 0; i < N; i++) {
          if (grid[line[i].y][line[i].x] !== merged[i]) moved = true;
          grid[line[i].y][line[i].x] = merged[i];
        }
      }

      if (moved) {
        score += gained;
        ui.score(score);
        spawn();
        draw();
        const max = Math.max(...grid.flat());
        if (max >= 2048 && !won) {
          won = true;
          ui.message('You hit 2048! Keep going for a bigger score.');
        }
        if (!canMove()) {
          alive = false;
          draw();
          ui.gameOver(score);
        }
      }
      return moved;
    }

    function canMove() {
      if (emptyCells().length) return true;
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const v = grid[y][x];
          if (x + 1 < N && grid[y][x + 1] === v) return true;
          if (y + 1 < N && grid[y + 1][x] === v) return true;
        }
      return false;
    }

    function draw() {
      ctx.fillStyle = '#0d1327';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.font = 'bold 34px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const v = grid[y][x];
          const px = GAP + x * (CELL + GAP), py = GAP + y * (CELL + GAP);
          if (v === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
          } else {
            const [bg, fg] = tileColor(v);
            ctx.fillStyle = bg;
            ctx.fillStyle = bg;
          }
          roundRect(ctx, px, py, CELL, CELL, 10);
          ctx.fill();
          if (v !== 0) {
            const [, fg] = tileColor(v);
            ctx.fillStyle = fg;
            ctx.font = 'bold ' + (v >= 1024 ? 28 : v >= 128 ? 32 : 38) + 'px Inter, sans-serif';
            ctx.fillText(String(v), px + CELL / 2, py + CELL / 2 + 2);
          }
        }
      }
    }

    function roundRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function doMove(dir) { move(dir); }

    function onKey(e) {
      const map = {
        ArrowUp: 'up', w: 'up', W: 'up',
        ArrowDown: 'down', s: 'down', S: 'down',
        ArrowLeft: 'left', a: 'left', A: 'left',
        ArrowRight: 'right', d: 'right', D: 'right'
      };
      if (map[e.key]) {
        e.preventDefault();
        doMove(map[e.key]);
      }
    }
    function onTouchStart(e) {
      const t = e.changedTouches[0];
      touchX = t.clientX; touchY = t.clientY;
    }
    function onTouchEnd(e) {
      if (touchX == null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchX, dy = t.clientY - touchY;
      touchX = null;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? 'right' : 'left');
      else doMove(dy > 0 ? 'down' : 'up');
    }

    document.addEventListener('keydown', onKey);
    cv.addEventListener('touchstart', onTouchStart, { passive: true });
    cv.addEventListener('touchend', onTouchEnd, { passive: true });

    reset();

    return {
      start() { reset(); },
      pause() {},
      resume() {},
      isPaused() { return false; },
      destroy() {
        alive = false;
        document.removeEventListener('keydown', onKey);
        cv.removeEventListener('touchstart', onTouchStart);
        cv.removeEventListener('touchend', onTouchEnd);
        cv.remove();
      }
    };
  }
};
