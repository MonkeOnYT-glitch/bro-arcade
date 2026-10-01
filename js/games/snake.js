/* Snake — classic arcade snake. */
window.ArcadeGames = window.ArcadeGames || {};

ArcadeGames.snake = {
  meta: {
    title: 'Snake',
    tagline: 'Eat, grow, don\u2019t crash.',
    category: 'classics',
    accent: '#22d3ee',
    accent2: '#0ea5e9',
    aspect: '1 / 1',
    hint: 'Controls: arrow keys / WASD &middot; swipe on touch',
    art: '<svg viewBox="0 0 64 64" fill="none"><path d="M10 44c8 0 8-12 16-12s8 12 16 12 8-12 12-12" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="52" cy="30" r="4" fill="#fff"/><circle cx="53.5" cy="29" r="1.4" fill="#0ea5e9"/></svg>'
  },

  create(stage, ui) {
    const SIZE = 480, N = 24, CELL = SIZE / N;
    const cv = document.createElement('canvas');
    cv.width = SIZE; cv.height = SIZE;
    stage.appendChild(cv);
    const ctx = cv.getContext('2d');

    let snake, dir, pending, food, score, alive, raf, last, acc, stepMs, paused;
    let touchX = null, touchY = null;

    function reset() {
      snake = [{ x: 12, y: 12 }, { x: 11, y: 12 }, { x: 10, y: 12 }];
      dir = { x: 1, y: 0 };
      pending = { x: 1, y: 0 };
      score = 0; ui.score(0);
      stepMs = 135;
      acc = 0; last = 0; paused = false;
      placeFood();
    }

    function placeFood() {
      do {
        food = { x: (Math.random() * N) | 0, y: (Math.random() * N) | 0 };
      } while (snake.some(s => s.x === food.x && s.y === food.y));
    }

    function setDir(x, y) {
      if (x === -dir.x && y === -dir.y) return; // no 180s
      if (x === dir.x && y === dir.y) return;
      pending = { x, y };
    }

    function step() {
      dir = pending;
      const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      const hitWall = h.x < 0 || h.y < 0 || h.x >= N || h.y >= N;
      const hitSelf = snake.some(s => s.x === h.x && s.y === h.y);
      if (hitWall || hitSelf) { die(); return; }
      snake.unshift(h);
      if (h.x === food.x && h.y === food.y) {
        score += 10;
        ui.score(score);
        stepMs = Math.max(65, stepMs - 2.5);
        placeFood();
      } else {
        snake.pop();
      }
    }

    function die() {
      alive = false;
      cancelAnimationFrame(raf);
      draw();
      ui.gameOver(score);
    }

    function loop(t) {
      if (!alive || paused) return;
      if (!last) last = t;
      acc += t - last;
      last = t;
      let guard = 0;
      while (acc >= stepMs && guard++ < 8) {
        acc -= stepMs;
        step();
        if (!alive) return;
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    function draw() {
      ctx.fillStyle = '#05080f';
      ctx.fillRect(0, 0, SIZE, SIZE);
      // subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 1;
      for (let i = 1; i < N; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE, i * CELL); ctx.stroke();
      }
      // food
      const fx = food.x * CELL + CELL / 2, fy = food.y * CELL + CELL / 2;
      const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, CELL);
      glow.addColorStop(0, '#fda4af');
      glow.addColorStop(0.5, '#f43f5e');
      glow.addColorStop(1, 'rgba(244,63,94,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(fx, fy, CELL * 0.95, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fb7185';
      ctx.beginPath(); ctx.arc(fx, fy, CELL * 0.32, 0, Math.PI * 2); ctx.fill();
      // snake
      for (let i = snake.length - 1; i >= 0; i--) {
        const s = snake[i];
        const t = i / Math.max(1, snake.length - 1);
        const r = 70 + Math.round(t * 120), g = 200 - Math.round(t * 60), b = 220;
        ctx.fillStyle = i === 0 ? '#22d3ee' : 'rgb(' + r + ',' + g + ',' + b + ')';
        const pad = i === 0 ? 1.5 : 2.5;
        roundRect(ctx, s.x * CELL + pad, s.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 6);
        ctx.fill();
        if (i === 0) {
          // eyes
          ctx.fillStyle = '#04121a';
          const ex = s.x * CELL + CELL / 2, ey = s.y * CELL + CELL / 2;
          const ox = dir.x * 4, oy = dir.y * 4;
          ctx.beginPath(); ctx.arc(ex - 4 + ox, ey - 3 + oy, 2.4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(ex + 4 + ox, ey - 3 + oy, 2.4, 0, Math.PI * 2); ctx.fill();
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

    function onKey(e) {
      const k = e.key;
      const map = {
        ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
        ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
        ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
        ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
      };
      if (map[k]) {
        e.preventDefault();
        if (alive && !paused) setDir(map[k][0], map[k][1]);
      }
    }

    function onTouchStart(e) {
      const t = e.changedTouches[0];
      touchX = t.clientX; touchY = t.clientY;
    }
    function onTouchEnd(e) {
      if (touchX === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchX, dy = t.clientY - touchY;
      touchX = null;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (alive && !paused) {
        if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
        else setDir(0, dy > 0 ? 1 : -1);
      }
    }

    document.addEventListener('keydown', onKey);
    cv.addEventListener('touchstart', onTouchStart, { passive: true });
    cv.addEventListener('touchend', onTouchEnd, { passive: true });

    reset();
    draw();

    return {
      start() {
        if (alive) return;
        reset();
        alive = true;
        raf = requestAnimationFrame(loop);
      },
      pause() { paused = true; },
      resume() {
        if (!alive || !paused) return;
        paused = false;
        last = 0;
        raf = requestAnimationFrame(loop);
      },
      isPaused() { return paused; },
      destroy() {
        alive = false;
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', onKey);
        cv.removeEventListener('touchstart', onTouchStart);
        cv.removeEventListener('touchend', onTouchEnd);
        cv.remove();
      }
    };
  }
};
