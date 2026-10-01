/* Cloak — tab disguise + fake Google search. Ported from the Monke Vault
   Google Cloak. All search results are generated locally (no API calls);
   the disguise only changes this tab's title and favicon. */
(function () {
  'use strict';

  var LS_MODE = 'broarcade_cloak_mode';
  var LS_PANIC_KEY = 'broarcade_panic_key';
  var LS_PANIC_URL = 'broarcade_panic_url';

  var REAL_TITLE = 'Bro Arcade — Free Games, No Downloads';
  var REAL_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230a0a0f'/%3E%3Ctext x='32' y='44' font-size='34' text-anchor='middle' fill='%23ff6b9d' font-family='Arial Black'%3EB%3C/text%3E%3C/svg%3E";

  var MODES = {
    none:   { label: 'Off',          title: REAL_TITLE, icon: REAL_ICON },
    google: { label: 'Google',       title: 'Google', icon: 'https://www.google.com/favicon.ico' },
    drive:  { label: 'Google Drive',  title: 'My Drive - Google Drive', icon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png' },
    gmail:  { label: 'Gmail',        title: 'Inbox - Gmail', icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico' },
    clever: { label: 'Clever',       title: 'Clever | Portal', icon: 'https://assets.clever.com/resource-icons/apps/5000234a3621dfbb160000b0/icon_86f5c6c.png' }
  };

  var currentMode = 'none';

  function $(id) { return document.getElementById(id); }

  function setFavicon(href) {
    var link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = href;
  }

  function paintModeButtons() {
    var btns = document.querySelectorAll('.cloak-mode-btn');
    Array.prototype.forEach.call(btns, function (b) {
      b.classList.toggle('active', b.dataset.mode === currentMode);
    });
  }

  window.setCloakMode = function (mode) {
    if (!MODES[mode]) return;
    currentMode = mode;
    try { localStorage.setItem(LS_MODE, mode); } catch (e) { /* noop */ }
    var m = MODES[mode];
    document.title = m.title;
    setFavicon(m.icon);
    paintModeButtons();
    var stage = $('cloak-google-wrap');
    if (stage) stage.style.display = mode === 'google' ? '' : 'none';
    toast(mode === 'none' ? 'Cloak off — tab is Bro Arcade again.' : 'Disguised as ' + m.label + '.');
  };

  window.exitCloak = function () { window.setCloakMode('none'); };

  /* ---------- fake Google search (100% local) ---------- */
  window.sendCloakQuery = function (inputId) {
    var inp = $(inputId);
    if (!inp || !inp.value.trim()) return;
    var q = inp.value.trim();
    $('cloak-google-home').style.display = 'none';
    var res = $('cloak-google-results');
    res.style.display = 'block';
    var ri = $('cloak-results-input');
    if (ri) ri.value = q;
    var list = $('cloak-results-list');
    list.innerHTML = '<div class="cloak-loading">Searching…</div>';
    setTimeout(function () {
      var eq = encodeURIComponent(q);
      var results = [
        { url: 'https://en.wikipedia.org/wiki/' + eq, title: q + ' - Wikipedia', desc: 'Learn everything about ' + q + ', its history, meanings, and comprehensive details on Wikipedia.' },
        { url: 'https://www.dictionary.com/browse/' + eq, title: q + ' Definition & Meaning', desc: 'Define ' + q + ' at Dictionary.com, the leading online source for English definitions.' },
        { url: 'https://news.google.com/search?q=' + eq, title: 'Latest news on ' + q, desc: 'The most recent updates, articles, and breaking news regarding ' + q + '.' },
        { url: 'https://www.britannica.com/search?query=' + eq, title: q + ' | Encyclopedia Britannica', desc: 'Explore facts, articles, and comprehensive research about ' + q + '.' },
        { url: 'https://scholar.google.com/scholar?q=' + eq, title: 'Scholarly articles for ' + q, desc: 'Academic research, journals, and publications referencing ' + q + '.' }
      ];
      list.innerHTML = results.map(function (r) {
        return '<div class="cloak-result">' +
          '<div class="cloak-result-url">' + r.url.replace(/</g, '&lt;') + '</div>' +
          '<div class="cloak-result-title" data-sim="1">' + r.title.replace(/</g, '&lt;') + ' <span class="sim-tag">simulated</span></div>' +
          '<div class="cloak-result-desc">' + r.desc.replace(/</g, '&lt;') + '</div></div>';
      }).join('');
      Array.prototype.forEach.call(list.querySelectorAll('[data-sim]'), function (el) {
        el.addEventListener('click', function () { toast('Simulated cloak result — not a real link.'); });
      });
    }, 350);
  };

  window.cloakBackHome = function () {
    $('cloak-google-results').style.display = 'none';
    $('cloak-google-home').style.display = 'flex';
    var i = $('cloak-home-input');
    if (i) i.value = '';
  };

  /* ---------- panic key ---------- */
  function getPanicKey() {
    try { return localStorage.getItem(LS_PANIC_KEY) || '`'; } catch (e) { return '`'; }
  }
  function getPanicUrl() {
    try { return localStorage.getItem(LS_PANIC_URL) || 'https://classroom.google.com/'; } catch (e) { return 'https://classroom.google.com/'; }
  }

  window.savePanic = function () {
    var k = $('panic-key-input'), u = $('panic-url-input');
    try {
      localStorage.setItem(LS_PANIC_KEY, (k && k.value) || '`');
      localStorage.setItem(LS_PANIC_URL, (u && u.value.trim()) || 'https://classroom.google.com/');
    } catch (e) { /* noop */ }
    toast('Panic key saved. Press it anywhere to bail.');
  };

  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === getPanicKey()) window.location.href = getPanicUrl();
  });

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('cloak-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    try { currentMode = localStorage.getItem(LS_MODE) || 'none'; } catch (e) { currentMode = 'none'; }
    if (!MODES[currentMode]) currentMode = 'none';
    var m = MODES[currentMode];
    document.title = m.title;
    setFavicon(m.icon);
    paintModeButtons();
    var stage = $('cloak-google-wrap');
    if (stage) stage.style.display = currentMode === 'google' ? '' : 'none';
    var k = $('panic-key-input'), u = $('panic-url-input');
    if (k) k.value = getPanicKey();
    if (u) u.value = getPanicUrl();
    var hi = $('cloak-home-input');
    if (hi) hi.addEventListener('keydown', function (e) { if (e.key === 'Enter') window.sendCloakQuery('cloak-home-input'); });
    var ri = $('cloak-results-input');
    if (ri) ri.addEventListener('keydown', function (e) { if (e.key === 'Enter') window.sendCloakQuery('cloak-results-input'); });
  });
})();
