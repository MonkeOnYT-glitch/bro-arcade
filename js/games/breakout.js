/* Breakout — bounce the ball, clear the bricks. */
window.ArcadeGames = window.ArcadeGames || {};

ArcadeGames.breakout = {
  meta: {
    title: 'Breakout',
    tagline: 'Clear every brick. Don\u2019t drop the ball.',
    category: 'arcade',
    accent: '#e879f9',
    accent2: '#a855f7',
    aspect: '4 / 3',
    hint: 'Controls: mouse / touch, or \u2190 \u2192 keys',
    art: '<svg viewBox="0 0 64 64"><rect x="8" y="10" width="14" height="8" rx="2" fill="#fff"/><rect x="25" y="10" width="14" height="8" rx="2" fill="#fff" opacity="0.75"/><rect x="42" y="10" width="14" height="8" rx="2" fill="#fff" opacity="0.5"/><rect x="8" y="22" width="14" height="8" rx="2" fill="#fff" opacity="0.75"/><rect x="25" y="22" width="14" height="8" rx="2" fill="#fff" opacity="0.5"/><rect x="20" y="46" width="24" height="6" rx="3" fill="#fff"/><circle cx="32" cy="38" r="4" fill="#fff"/></svg>'
  },

  create(stage, ui) {
    const W = 640, H = 480;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    stage.appendChild(cv);
    const ctx = cv.getContext('2d');

    const ROW_COLORS = ['#f43f5e', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#a78bfa'];
    let paddle, ball, bricks, score, lives, level, alive, raf, paused, keys;

    function buildBricks() {
      bricks = [];
      const cols = 9, rows = 5 + Math.min(2, level - 1);
      const bw = (W - 40 - (cols - 1) * 8) / cols, bh = 22;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          bricks.push({
            x: 20 + c * (bw + 8), y: 60 + r * (bh + 8),
            w: bw, h: bh,
            hp: r === 0 ? 2 : 1,
            color: ROW_COLORS[r % ROW_COLORS.length],
            dead: false
          });
        }
      }
    }

    function resetBall() {
      ball = { x: W / 2, y: H - 60, r: 8, dx: 0, dy: 0, stuck: true };
    }

    function reset(full) {
      if (full) { score = 0; lives = 3; level = 1; ui.score(0); }
      paddle = { w: 96, h: 12, x: W / 2 - 48, y: H - 36, speed: 9 };
      buildBricks();
      resetBall();
      paused = false;
      draw();
    }

    function launch() {
      if (!ball.stuck) return;
      const sp = 5 + level * 0.7;
      const a = -Math.PI / 2 + (Math.random() * 0.5 - 0.25);
      ball.dx = Math.cos(a) * sp;
      ball.dy = Math.sin(a) * sp;
      ball.stuck = false;
    }

    function die() {
      lives--;
      if (lives <= 0) {
        alive = false;
        cancelAnimationFrame(raf);
        draw();
        ui.gameOver(score);
      } else {
        resetBall();
      }
    }

    function loop() {
      if (!alive || paused) return;
      // paddle keys
      if (keys.left) paddle.x -= paddle.speed;
      if (keys.right) paddle.x += paddle.speed;
      paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));

      if (ball.stuck) {
        ball.x = paddle.x + paddle.w / 2;
        ball.y = paddle.y - ball.r - 2;
      } else {
        ball.x += ball.dx;
        ball.y += ball.dy;
        // walls
        if (ball.x < ball.r) { ball.x = ball.r; ball.dx *= -1; }
        if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.dx *= -1; }
        if (ball.y < ball.r) { ball.y = ball.r; ball.dy *= -1; }
        // paddle
        if (ball.dy > 0 &&
            ball.y + ball.r >= paddle.y && ball.y + ball.r <= paddle.y + paddle.h + 10 &&
            ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r) {
          const rel = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
          const sp = Math.hypot(ball.dx, ball.dy);
          const ang = -Math.PI / 2 + rel * 1.1;
          ball.dx = Math.cos(ang) * sp;
          ball.dy = Math.sin(ang) * sp;
          ball.y = paddle.y - ball.r - 1;
        }
        // bricks
        for (const b of bricks) {
          if (b.dead) continue;
          if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
              ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
            // determine bounce axis by smallest penetration
            const ox = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
            const oy = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
            if (ox < oy) ball.dx *= -1; else ball.dy *= -1;
            b.hp--;
            if (b.hp <= 0) {
              b.dead = true;
              score += 10 * level;
              ui.score(score);
            } else {
              score += 5;
              ui.score(score);
            }
            break;
          }
        }
        if (ball.y > H + 20) { die(); }
        if (bricks.every(b => b.dead)) {
          level++;
          ui.message('Level ' + level + ' — faster ball!');
          buildBricks();
          resetBall();
        }
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    function draw() {
      ctx.fillStyle = '#05080f';
      ctx.fillRect(0, 0, W, H);
      // bricks
      for (const b of bricks) {
        if (b.dead) continue;
        ctx.fillStyle = b.color;
        if (b.hp === 2) { ctx.globalAlpha = 1; } else { ctx.globalAlpha = 0.85; }
        roundRect(ctx, b.x, b.y, b.w, b.h, 5);
        ctx.fill();
        if (b.hp === 2) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 3);
        }
        ctx.globalAlpha = 1;
      }
      // paddle
      const pg = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.w, 0);
      pg.addColorStop(0, '#e879f9'); pg.addColorStop(1, '#818cf8');
      ctx.fillStyle = pg;
      roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 6);
      ctx.fill();
      // ball
      const bg = ctx.createRadialGradient(ball.x, ball.y, 1, ball.x, ball.y, ball.r * 2);
      bg.addColorStop(0, '#fff'); bg.addColorStop(0.4, '#22d3ee'); bg.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
      // lives
      ctx.fillStyle = '#9aa4c7';
      ctx.font = '600 15px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Lives: ' + '\u25CF'.repeat(Math.max(0, lives)) + '\u25CB'.repeat(Math.max(0, 3 - lives)), 20, 32);
      ctx.textAlign = 'right';
      ctx.fillText('Level ' + level, W - 20, 32);
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

    function canvasX(e) {
      const r = cv.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX);
      return (cx - r.left) * (W / r.width);
    }

    function onKey(e) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.left = true; e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.right = true; e.preventDefault(); }
      if (e.key === ' ' || e.key === 'ArrowUp') { launch(); e.preventDefault(); }
    }
    function onKeyUp(e) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    }
    function onMouse(e) {
      paddle.x = canvasX(e) - paddle.w / 2;
    }
    function onTap() { launch(); }

    keys = { left: false, right: false };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    cv.addEventListener('mousemove', onMouse);
    cv.addEventListener('touchmove', function (e) { onMouse(e); e.preventDefault(); }, { passive: false });
    cv.addEventListener('touchstart', function (e) { onMouse(e); }, { passive: true });
    cv.addEventListener('click', onTap);

    reset(true);

    return {
      start() {
        if (alive) return;
        alive = true;
        reset(true);
        raf = requestAnimationFrame(loop);
      },
      pause() { paused = true; },
      resume() {
        if (!alive || !paused) return;
        paused = false;
        raf = requestAnimationFrame(loop);
      },
      isPaused() { return paused; },
      destroy() {
        alive = false;
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('keyup', onKeyUp);
        cv.remove();
      }
    };
  }
};
