/* Minesweeper — clear the field without hitting a mine. */
window.ArcadeGames = window.ArcadeGames || {};

ArcadeGames.minesweeper = {
  meta: {
    title: 'Minesweeper',
    tagline: 'Flag the mines. Clear the field.',
    category: 'puzzle',
    accent: '#fbbf24',
    accent2: '#f97316',
    aspect: '1 / 1',
    hint: 'Left-click to reveal, right-click to flag &middot; use Flag mode on touch',
    art: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="14" fill="#fff"/><g stroke="#fff" stroke-width="4" stroke-linecap="round"><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6"/></g><circle cx="27" cy="27" r="4" fill="#b45309"/></svg>'
  },

  create(stage, ui) {
    const DIFFS = {
      easy: { n: 9, mines: 10, label: 'Easy 9\u00D79' },
      medium: { n: 12, mines: 24, label: 'Medium 12\u00D712' }
    };
    let diff = DIFFS.easy;
    let cells, mines, revealed, flagged, alive = false, started, timer, startTime, flagMode, over;

    const wrap = document.createElement('div');
    stage.appendChild(wrap);

    const bar = document.createElement('div');
    bar.className = 'ba-bar';
    const msg = document.createElement('div');
    msg.className = 'ba-msg';
    const gridEl = document.createElement('div');
    gridEl.className = 'ba-grid';

    const btnEasy = document.createElement('button');
    btnEasy.textContent = DIFFS.easy.label;
    const btnMed = document.createElement('button');
    btnMed.textContent = DIFFS.medium.label;
    const btnFlag = document.createElement('button');
    btnFlag.textContent = '\uD83D\uDEA9 Flag mode: off';
    btnEasy.onclick = () => setDiff('easy');
    btnMed.onclick = () => setDiff('medium');
    btnFlag.onclick = () => {
      flagMode = !flagMode;
      btnFlag.textContent = '\uD83D\uDEA9 Flag mode: ' + (flagMode ? 'on' : 'off');
      btnFlag.classList.toggle('active', flagMode);
    };
    bar.appendChild(btnEasy);
    bar.appendChild(btnMed);
    bar.appendChild(btnFlag);
    wrap.appendChild(bar);
    wrap.appendChild(msg);
    wrap.appendChild(gridEl);

    function setDiff(key) {
      diff = DIFFS[key];
      btnEasy.classList.toggle('active', key === 'easy');
      btnMed.classList.toggle('active', key === 'medium');
      build();
    }

    function build() {
      over = false; started = false; revealed = 0; flagged = 0; flagMode = false;
      btnFlag.textContent = '\uD83D\uDEA9 Flag mode: off';
      btnFlag.classList.remove('active');
      clearInterval(timer);
      msg.textContent = '\uD83D\uDCA3 ' + diff.mines + ' mines hidden. Good luck.';
      gridEl.style.gridTemplateColumns = 'repeat(' + diff.n + ', 1fr)';
      gridEl.style.width = 'min(100%, 440px)';
      gridEl.innerHTML = '';
      cells = [];
      const total = diff.n * diff.n;
      for (let i = 0; i < total; i++) {
        const b = document.createElement('button');
        b.className = 'ba-cell ms-cell';
        b.dataset.i = i;
        b.addEventListener('click', () => onReveal(i));
        b.addEventListener('contextmenu', e => { e.preventDefault(); onFlag(i); });
        gridEl.appendChild(b);
        cells.push({ mine: false, open: false, flag: false, n: 0, el: b });
      }
      mines = [];
    }

    function placeMines(safe) {
      const total = diff.n * diff.n;
      let placed = 0, guard = 0;
      while (placed < diff.mines && guard++ < 5000) {
        const i = (Math.random() * total) | 0;
        if (i === safe || cells[i].mine) continue;
        cells[i].mine = true;
        mines.push(i);
        placed++;
      }
      // adjacency counts
      for (let i = 0; i < total; i++) {
        if (cells[i].mine) continue;
        cells[i].n = neighbors(i).filter(j => cells[j].mine).length;
      }
    }

    function neighbors(i) {
      const n = diff.n, x = i % n, y = (i / n) | 0, out = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < n && ny < n) out.push(ny * n + nx);
        }
      return out;
    }

    function tick() {
      const s = Math.floor((Date.now() - startTime) / 1000);
      msg.textContent = '\u23F1\uFE0F ' + s + 's  \u00B7  \uD83D\uDEA9 ' + (diff.mines - flagged) + ' mines left';
    }

    function onReveal(i) {
      if (over) return;
      if (!alive) { // game not started via overlay yet
        return;
      }
      const c = cells[i];
      if (c.open) return;
      if (flagMode) { onFlag(i); return; }
      if (c.flag) return;
      if (!started) {
        started = true;
        placeMines(i);
        startTime = Date.now();
        timer = setInterval(tick, 500);
        tick();
      }
      if (c.mine) {
        explode(i);
        return;
      }
      flood(i);
      checkWin();
    }

    function onFlag(i) {
      if (over || !alive || !started) return;
      const c = cells[i];
      if (c.open) return;
      c.flag = !c.flag;
      flagged += c.flag ? 1 : -1;
      c.el.classList.toggle('flagged', c.flag);
      c.el.textContent = c.flag ? '\uD83D\uDEA9' : '';
      tick();
    }

    function flood(i) {
      const stack = [i];
      while (stack.length) {
        const j = stack.pop();
        const c = cells[j];
        if (c.open || c.flag) continue;
        c.open = true;
        revealed++;
        c.el.classList.add('open');
        if (c.n > 0) {
          c.el.textContent = c.n;
          c.el.style.color = numColor(c.n);
        } else {
          c.el.textContent = '';
          for (const k of neighbors(j)) if (!cells[k].open) stack.push(k);
        }
      }
    }

    function numColor(n) {
      return ['', '#60a5fa', '#4ade80', '#f87171', '#a78bfa', '#fbbf24', '#22d3ee', '#e879f9', '#9aa4c7'][n] || '#fff';
    }

    function explode(hit) {
      over = true;
      alive = false;
      clearInterval(timer);
      for (const m of mines) {
        cells[m].el.classList.add('open');
        cells[m].el.textContent = '\uD83D\uDCA3';
      }
      cells[hit].el.classList.add('boom');
      msg.textContent = 'Boom! You revealed ' + revealed + ' cells.';
      const score = revealed;
      ui.score(score);
      ui.gameOver(score);
    }

    function checkWin() {
      const total = diff.n * diff.n;
      if (revealed === total - diff.mines) {
        over = true;
        alive = false;
        clearInterval(timer);
        const secs = Math.floor((Date.now() - startTime) / 1000);
        for (const m of mines) {
          cells[m].el.textContent = '\uD83D\uDEA9';
          cells[m].el.classList.add('flagged');
        }
        const score = Math.max(100, 3000 - secs * 15);
        msg.textContent = '\uD83C\uDFC6 Cleared in ' + secs + 's!';
        ui.score(score);
        ui.gameOver(score, 'win');
      }
    }

    setDiff('easy');

    return {
      start() {
        if (alive) return;
        build();
        alive = true;
        msg.textContent = 'Click a square to start. \uD83D\uDCA3 ' + diff.mines + ' mines hidden.';
      },
      pause() {},
      resume() {},
      isPaused() { return false; },
      destroy() {
        alive = false;
        clearInterval(timer);
        wrap.remove();
      }
    };
  }
};
