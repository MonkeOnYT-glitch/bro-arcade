/* Flappy — tap to fly through the pipes. */
window.ArcadeGames = window.ArcadeGames || {};

ArcadeGames.flappy = {
  meta: {
    title: 'Flappy',
    tagline: 'Tap to fly. Thread the pipes.',
    category: 'arcade',
    accent: '#a3e635',
    accent2: '#22d3ee',
    aspect: '7 / 10',
    hint: 'Controls: click / tap / spacebar',
    art: '<svg viewBox="0 0 64 64"><circle cx="30" cy="32" r="14" fill="#fff"/><circle cx="35" cy="28" r="3.4" fill="#0b1020"/><path d="M16 32l-8-4 8-4z" fill="#fff"/><path d="M24 40l-6 8 10-4z" fill="#fff" opacity="0.8"/><rect x="48" y="4" width="10" height="20" rx="2" fill="#fff" opacity="0.9"/><rect x="48" y="40" width="10" height="20" rx="2" fill="#fff" opacity="0.9"/></svg>'
  },

  create(stage, ui) {
    const W = 420, H = 600;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    stage.appendChild(cv);
    const ctx = cv.getContext('2d');

    const GRAV = 0.55, FLAP = -9.2, PIPE_W = 70, GAP = 165, SPEED0 = 2.6;
    let bird, pipes, score, alive, raf, frame, paused, speed, started;

    function reset() {
      bird = { x: 110, y: H / 2, vy: 0, r: 15, rot: 0 };
      pipes = [];
      score = 0; ui.score(0);
      frame = 0; paused = false; started = false;
      speed = SPEED0;
    }

    function flap() {
      if (!alive || paused || !started) return;
      bird.vy = FLAP;
    }

    function spawnPipe() {
      const margin = 90;
      const gy = margin + Math.random() * (H - margin * 2 - GAP);
      pipes.push({ x: W + 10, gapY: gy, passed: false });
    }

    function die() {
      alive = false;
      cancelAnimationFrame(raf);
      draw();
      ui.gameOver(score);
    }

    function loop() {
      if (!alive || paused) return;
      frame++;
      bird.vy = Math.min(14, bird.vy + GRAV);
      bird.y += bird.vy;
      bird.rot = Math.max(-0.4, Math.min(1.2, bird.vy / 10));

      if (frame % 95 === 0) spawnPipe();
      for (const p of pipes) {
        p.x -= speed;
        if (!p.passed && p.x + PIPE_W < bird.x - bird.r) {
          p.passed = true;
          score++;
          ui.score(score);
          if (score % 5 === 0) speed += 0.25;
        }
      }
      pipes = pipes.filter(p => p.x > -PIPE_W - 20);

      // collisions
      if (bird.y + bird.r >= H - 40 || bird.y - bird.r <= 0) { die(); return; }
      for (const p of pipes) {
        if (bird.x + bird.r > p.x && bird.x - bird.r < p.x + PIPE_W) {
          if (bird.y - bird.r < p.gapY || bird.y + bird.r > p.gapY + GAP) { die(); return; }
        }
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    function draw() {
      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0b1e3a'); sky.addColorStop(1, '#0a2a22');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      // distant hills
      ctx.fillStyle = 'rgba(163,230,53,0.08)';
      ctx.beginPath();
      ctx.moveTo(0, H - 40);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H - 40 - Math.sin(x / 60 + 1) * 26);
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      // pipes
      for (const p of pipes) {
        const g = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
        g.addColorStop(0, '#16a34a'); g.addColorStop(0.5, '#4ade80'); g.addColorStop(1, '#15803d');
        ctx.fillStyle = g;
        roundRect(ctx, p.x, 0, PIPE_W, p.gapY, 6); ctx.fill();
        roundRect(ctx, p.x, p.gapY + GAP, PIPE_W, H - p.gapY - GAP, 6); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(p.x + 8, 6, 8, Math.max(0, p.gapY - 12));
        ctx.fillRect(p.x + 8, p.gapY + GAP + 6, 8, Math.max(0, H - p.gapY - GAP - 12));
      }
      // ground
      ctx.fillStyle = '#14532d';
      ctx.fillRect(0, H - 40, W, 40);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, H - 40, W, 6);
      // bird
      ctx.save();
      ctx.translate(bird.x, bird.y);
      ctx.rotate(bird.rot);
      const bg2 = ctx.createRadialGradient(-4, -4, 2, 0, 0, bird.r + 6);
      bg2.addColorStop(0, '#fef08a'); bg2.addColorStop(1, '#eab308');
      ctx.fillStyle = bg2;
      ctx.beginPath(); ctx.arc(0, 0, bird.r, 0, Math.PI * 2); ctx.fill();
      // wing
      ctx.fillStyle = '#ca8a04';
      const flapY = Math.sin(frame / 5) * 4;
      ctx.beginPath(); ctx.ellipse(-6, 2 + flapY, 8, 5, -0.4, 0, Math.PI * 2); ctx.fill();
      // eye
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(6, -5, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b1020';
      ctx.beginPath(); ctx.arc(7.5, -5, 2.4, 0, Math.PI * 2); ctx.fill();
      // beak
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.moveTo(12, 0); ctx.lineTo(22, 3); ctx.lineTo(12, 7);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      // score
      ctx.fillStyle = '#fff';
      ctx.font = '700 44px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 5;
      ctx.strokeText(String(score), W / 2, 80);
      ctx.fillText(String(score), W / 2, 80);
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
      if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); }
    }
    function onPointer(e) {
      e.preventDefault();
      flap();
    }

    document.addEventListener('keydown', onKey);
    cv.addEventListener('pointerdown', onPointer);

    reset();
    draw();

    return {
      start() {
        if (alive) return;
        reset();
        alive = true;
        started = true;
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
        cv.remove();
      }
    };
  }
};
