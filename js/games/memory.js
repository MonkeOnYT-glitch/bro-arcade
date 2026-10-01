/* Memory Match — flip the cards, find every pair. */
window.ArcadeGames = window.ArcadeGames || {};

ArcadeGames.memory = {
  meta: {
    title: 'Memory Match',
    tagline: 'Flip the cards. Find every pair.',
    category: 'puzzle',
    accent: '#22d3ee',
    accent2: '#a78bfa',
    aspect: '1 / 1',
    hint: 'Click or tap cards to flip them',
    art: '<svg viewBox="0 0 64 64"><rect x="8" y="14" width="20" height="28" rx="5" fill="#fff"/><rect x="36" y="14" width="20" height="28" rx="5" fill="#fff" opacity="0.55"/><text x="18" y="35" text-anchor="middle" font-size="16">\u2B50</text></svg>'
  },

  create(stage, ui) {
    const EMOJI = ['\uD83D\uDE80', '\uD83C\uDFAE', '\uD83D\uDC7E', '\uD83C\uDF55', '\uD83D\uDC31', '\uD83C\uDF89', '\u26A1', '\uD83C\uDFB2'];
    const N = 4;
    let alive, first, lock, matched, moves, startTime, timer, over;

    const wrap = document.createElement('div');
    stage.appendChild(wrap);
    const msg = document.createElement('div');
    msg.className = 'ba-msg';
    const gridEl = document.createElement('div');
    gridEl.className = 'ba-grid mem-grid';
    gridEl.style.gridTemplateColumns = 'repeat(' + N + ', 1fr)';
    gridEl.style.width = 'min(100%, 440px)';
    wrap.appendChild(msg);
    wrap.appendChild(gridEl);

    function build() {
      over = false; first = null; lock = false; matched = 0; moves = 0;
      clearInterval(timer);
      ui.score(0);
      msg.textContent = 'Find all ' + EMOJI.length + ' pairs.';
      const deck = shuffle(EMOJI.concat(EMOJI));
      gridEl.innerHTML = '';
      deck.forEach(e => {
        const card = document.createElement('button');
        card.className = 'ba-cell mem-card';
        card.dataset.e = e;
        card.innerHTML =
          '<span class="mem-inner">' +
          '<span class="mem-face mem-front">?</span>' +
          '<span class="mem-face mem-back">' + e + '</span>' +
          '</span>';
        card.addEventListener('click', () => flip(card));
        gridEl.appendChild(card);
      });
    }

    function shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    function flip(card) {
      if (!alive || over || lock) return;
      if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
      if (!startTime) {
        startTime = Date.now();
        timer = setInterval(tick, 500);
      }
      card.classList.add('flipped');
      if (!first) {
        first = card;
        return;
      }
      moves++;
      ui.score(moves);
      if (first.dataset.e === card.dataset.e) {
        first.classList.add('matched');
        card.classList.add('matched');
        first = null;
        matched += 2;
        if (matched === N * N) win();
      } else {
        lock = true;
        const a = first, b = card;
        first = null;
        setTimeout(() => {
          a.classList.remove('flipped');
          b.classList.remove('flipped');
          lock = false;
        }, 700);
      }
    }

    function tick() {
      const s = Math.floor((Date.now() - startTime) / 1000);
      msg.textContent = 'Moves: ' + moves + '  \u00B7  \u23F1\uFE0F ' + s + 's';
    }

    function win() {
      over = true;
      alive = false;
      clearInterval(timer);
      const secs = Math.floor((Date.now() - startTime) / 1000);
      const score = Math.max(100, 2500 - moves * 25 - secs * 5);
      msg.textContent = '\uD83C\uDFC6 All pairs found in ' + moves + ' moves!';
      ui.score(score);
      ui.gameOver(score, 'win');
    }

    build();
    alive = false;

    return {
      start() {
        if (alive) return;
        build();
        alive = true;
        startTime = null;
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
