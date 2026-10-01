/* Bro Arcade — hub logic: cards, search, filters, modal player, high scores. */
(function () {
  'use strict';

  var registry = window.ArcadeGames || {};
  var ORDER = ['snake', 'g2048', 'breakout', 'flappy', 'minesweeper', 'memory',
               'subway', 'rooftop', 'cookie', 'ctr', 'escape'];
  var CATS = { arcade: 'Arcade', puzzle: 'Puzzle', classics: 'Classics' };

  var grid = document.getElementById('game-grid');
  var noResults = document.getElementById('no-results');
  var searchInput = document.getElementById('search');
  var chipsEl = document.getElementById('chips');

  var modal = document.getElementById('game-modal');
  var mTitle = document.getElementById('m-title');
  var mTagline = document.getElementById('m-tagline');
  var mScore = document.getElementById('m-score');
  var mBest = document.getElementById('m-best');
  var mPause = document.getElementById('m-pause');
  var mRestart = document.getElementById('m-restart');
  var mClose = document.getElementById('m-close');
  var mStage = document.getElementById('m-stage');
  var mOverlay = document.getElementById('m-overlay');
  var mOvTitle = document.getElementById('m-ov-title');
  var mOvSub = document.getElementById('m-ov-sub');
  var mOvBtn = document.getElementById('m-ov-btn');
  var mHint = document.getElementById('m-hint');

  var current = null; // { id, controller, score, started }
  var activeCat = 'all';
  var hintTimer = null;

  /* ---------- storage ---------- */
  function bestKey(id) { return 'broarcade_best_' + id; }
  function getBest(id) { return parseInt(localStorage.getItem(bestKey(id)) || '0', 10) || 0; }
  function setBest(id, v) { localStorage.setItem(bestKey(id), String(v)); }
  function bumpPlays() {
    var n = parseInt(localStorage.getItem('broarcade_plays') || '0', 10) || 0;
    localStorage.setItem('broarcade_plays', String(n + 1));
  }

  function refreshStats() {
    document.getElementById('stat-games').textContent = ORDER.filter(function (id) { return registry[id]; }).length;
    document.getElementById('stat-plays').textContent = localStorage.getItem('broarcade_plays') || '0';
    var withBest = ORDER.filter(function (id) { return getBest(id) > 0; }).length;
    document.getElementById('stat-best').textContent = withBest;
  }

  /* ---------- cards ---------- */
  function catLabel(c) { return CATS[c] || c; }

  function buildCards() {
    grid.innerHTML = '';
    ORDER.forEach(function (id) {
      var g = registry[id];
      if (!g) return;
      var m = g.meta;
      var card = document.createElement('button');
      card.className = 'card';
      card.dataset.id = id;
      card.dataset.cat = m.category;
      card.dataset.search = (m.title + ' ' + m.tagline).toLowerCase();
      card.style.setProperty('--g1', m.accent);
      card.style.setProperty('--g2', m.accent2);
      card.style.setProperty('--glow', hexA(m.accent, 0.18));
      card.innerHTML =
        '<div class="card-art">' + m.art + '</div>' +
        '<div class="card-body">' +
        '<span class="card-cat">' + catLabel(m.category) + '</span>' +
        '<h3>' + m.title + '</h3>' +
        '<p>' + m.tagline + '</p>' +
        '<div class="card-foot">' +
        '<span class="card-best">Best: <b>' + getBest(id) + '</b></span>' +
        '<span class="play-btn">Play</span>' +
        '</div></div>';
      card.addEventListener('click', function () { openGame(id); });
      grid.appendChild(card);
    });
    applyFilter();
    refreshStats();
  }

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function applyFilter() {
    var q = searchInput.value.trim().toLowerCase();
    var shown = 0;
    Array.prototype.forEach.call(grid.children, function (card) {
      var okCat = activeCat === 'all' || card.dataset.cat === activeCat;
      var okQ = !q || card.dataset.search.indexOf(q) !== -1;
      var show = okCat && okQ;
      card.style.display = show ? '' : 'none';
      if (show) shown++;
    });
    noResults.hidden = shown !== 0;
  }

  searchInput.addEventListener('input', applyFilter);
  chipsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    Array.prototype.forEach.call(chipsEl.children, function (c) { c.classList.remove('active'); });
    btn.classList.add('active');
    activeCat = btn.dataset.cat;
    applyFilter();
  });

  /* ---------- modal player ---------- */
  function uiFor(id) {
    return {
      score: function (n) {
        if (current && current.id === id) {
          current.score = n;
          mScore.textContent = n;
        }
      },
      gameOver: function (score, kind) {
        if (!current || current.id !== id) return;
        current.score = score;
        mScore.textContent = score;
        var prev = getBest(id);
        var isBest = score > prev;
        if (isBest) {
          setBest(id, score);
          mBest.textContent = score;
        }
        refreshStats();
        updateCardBest(id);
        var won = kind === 'win';
        mOvTitle.textContent = won ? 'You win!' : 'Game over';
        mOvTitle.classList.toggle('win', won);
        mOvSub.innerHTML = 'Score: <b>' + score + '</b><br>Best: <b>' + Math.max(prev, score) + '</b>' +
          (isBest ? '<br><br><span class="newbest">NEW BEST!</span>' : '');
        mOvBtn.textContent = 'Play again';
        mOverlay.hidden = false;
        mPause.textContent = 'Pause';
      },
      message: function (t) {
        mHint.innerHTML = t;
        if (hintTimer) clearTimeout(hintTimer);
        hintTimer = setTimeout(function () {
          if (current) mHint.innerHTML = registry[current.id].meta.hint;
        }, 2600);
      }
    };
  }

  function updateCardBest(id) {
    var card = grid.querySelector('[data-id="' + id + '"] .card-best b');
    if (card) card.textContent = getBest(id);
  }

  function showReady(id) {
    mOvTitle.textContent = 'Ready?';
    mOvTitle.classList.remove('win');
    mOvSub.innerHTML = registry[id].meta.tagline + '<br><br>Best so far: <b>' + getBest(id) + '</b>';
    mOvBtn.textContent = 'Play';
    mOverlay.hidden = false;
    mPause.textContent = 'Pause';
  }

  function openGame(id) {
    var g = registry[id];
    if (!g) return;
    closeGame(true);
    current = { id: id, controller: null, score: 0, started: false };
    mTitle.textContent = g.meta.title;
    mTagline.textContent = g.meta.tagline;
    mHint.innerHTML = g.meta.hint;
    mStage.style.aspectRatio = g.meta.aspect;
    mScore.textContent = '0';
    mBest.textContent = getBest(id);
    bumpPlays();
    refreshStats();
    mountController();
    showReady(id);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function mountController() {
    var g = registry[current.id];
    if (current.controller) {
      try { current.controller.destroy(); } catch (e) { /* noop */ }
    }
    mStage.innerHTML = '';
    current.controller = g.create(mStage, uiFor(current.id));
    current.started = false;
    current.score = 0;
    mScore.textContent = '0';
  }

  function startPlay() {
    if (!current || !current.controller) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    mOverlay.hidden = true;
    current.started = true;
    current.controller.start();
  }

  function closeGame(silent) {
    if (current && current.controller) {
      try { current.controller.destroy(); } catch (e) { /* noop */ }
    }
    current = null;
    if (!silent) {
      modal.hidden = true;
      document.body.style.overflow = '';
    }
  }

  mOvBtn.addEventListener('click', function () {
    if (!current) return;
    if (current.started) {
      // play again after game over: fresh mount, straight in
      mountController();
      showReady(current.id);
      startPlay();
    } else {
      startPlay();
    }
  });

  mPause.addEventListener('click', function () {
    if (!current || !current.controller || !current.started) return;
    if (current.controller.isPaused && current.controller.isPaused()) {
      current.controller.resume();
      mPause.textContent = 'Pause';
    } else {
      current.controller.pause();
      mPause.textContent = 'Resume';
    }
  });

  mRestart.addEventListener('click', function () {
    if (!current) return;
    mountController();
    showReady(current.id);
  });

  mClose.addEventListener('click', function () { closeGame(false); });
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeGame(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeGame(false);
  });

  /* ---------- starfield ---------- */
  (function stars() {
    var cv = document.getElementById('stars');
    var ctx = cv.getContext('2d');
    var stars = [];
    function resize() {
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
    }
    function init() {
      stars = [];
      var n = Math.min(180, Math.floor(window.innerWidth * window.innerHeight / 12000));
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * cv.width,
          y: Math.random() * cv.height,
          r: Math.random() * 1.4 + 0.3,
          s: Math.random() * 0.25 + 0.05,
          p: Math.random() * Math.PI * 2
        });
      }
    }
    window.addEventListener('resize', function () { resize(); init(); });
    resize(); init();
    var t = 0;
    (function loop() {
      t += 0.016;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        st.y += st.s;
        if (st.y > cv.height) st.y = 0;
        var tw = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.5 + st.p));
        ctx.globalAlpha = tw;
        ctx.fillStyle = '#cfe6ff';
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(loop);
    })();
  })();

  buildCards();
})();
