/* Tab navigation: Games / Monke AI / Cloak / Proxy views. */
(function () {
  'use strict';

  var VIEWS = { games: 'view-games', ai: 'view-ai', cloak: 'view-cloak', proxy: 'view-proxy' };

  window.showTab = function (name) {
    if (!VIEWS[name]) return;
    Object.keys(VIEWS).forEach(function (k) {
      var el = document.getElementById(VIEWS[k]);
      if (el) el.hidden = k !== name;
    });
    var btns = document.querySelectorAll('.tab-btn');
    Array.prototype.forEach.call(btns, function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    window.scrollTo(0, 0);
  };

  document.addEventListener('DOMContentLoaded', function () {
    var nav = document.getElementById('main-nav');
    if (nav) nav.addEventListener('click', function (e) {
      var b = e.target.closest('.tab-btn');
      if (b && b.dataset.tab) window.showTab(b.dataset.tab);
    });
    var logo = document.getElementById('logo-home');
    if (logo) logo.addEventListener('click', function (e) {
      e.preventDefault();
      window.showTab('games');
    });
  });
})();
