/* Embedded games — third-party titles loaded in an iframe stage.
   Each game streams its assets from a public CDN mirror at play time;
   if a mirror goes down the card stays but the game won't load. */
window.ArcadeGames = window.ArcadeGames || {};

(function () {
  'use strict';

  var DEFS = [
    {
      id: 'subway',
      title: 'Subway Surfers',
      tagline: 'Dodge the inspector. Grab the coins.',
      file: 'embed/subway.html',
      aspect: '9 / 13',
      accent: '#4ade80', accent2: '#16a34a',
      hint: 'Controls: arrow keys / swipe &middot; space for hoverboard',
      art: '<svg viewBox="0 0 64 64" fill="none"><rect x="14" y="8" width="36" height="44" rx="8" stroke="#fff" stroke-width="5"/><line x1="14" y1="30" x2="50" y2="30" stroke="#fff" stroke-width="5"/><circle cx="24" cy="40" r="3.5" fill="#fff"/><circle cx="40" cy="40" r="3.5" fill="#fff"/><path d="M20 52l-4 6M44 52l4 6" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>'
    },
    {
      id: 'rooftop',
      title: 'Rooftop Snipers',
      tagline: 'Knock your buddy off the roof.',
      file: 'embed/rooftop.html',
      aspect: '16 / 10',
      accent: '#fb923c', accent2: '#ea580c',
      hint: 'Controls: W to jump &middot; knock them off first',
      art: '<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="20" stroke="#fff" stroke-width="5"/><circle cx="32" cy="32" r="4" fill="#fff"/><path d="M32 4v12M32 48v12M4 32h12M48 32h12" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>'
    },
    {
      id: 'cookie',
      title: 'Cookie Clicker',
      tagline: 'Bake cookies. All of the cookies.',
      file: 'embed/cookie.html',
      aspect: '16 / 10',
      accent: '#fbbf24', accent2: '#b45309',
      hint: 'Controls: click the cookie. That&rsquo;s it. That&rsquo;s the game.',
      art: '<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="22" stroke="#fff" stroke-width="5"/><circle cx="24" cy="26" r="3" fill="#fff"/><circle cx="38" cy="24" r="3" fill="#fff"/><circle cx="30" cy="38" r="3" fill="#fff"/><circle cx="40" cy="38" r="3" fill="#fff"/><circle cx="24" cy="44" r="2.4" fill="#fff"/></svg>'
    },
    {
      id: 'ctr',
      title: 'Cut the Rope',
      tagline: 'Cut ropes. Feed the candy.',
      file: 'embed/ctr.html',
      aspect: '4 / 3',
      accent: '#f472b6', accent2: '#db2777',
      hint: 'Controls: swipe to cut ropes &middot; feed Om Nom',
      art: '<svg viewBox="0 0 64 64" fill="none"><path d="M32 6v14" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="34" r="14" stroke="#fff" stroke-width="5"/><path d="M14 28l-8-6M14 40l-8 6M50 28l8-6M50 40l8 6" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="27" cy="32" r="2.4" fill="#fff"/><circle cx="37" cy="32" r="2.4" fill="#fff"/></svg>'
    },
    {
      id: 'escape',
      title: 'Escape Road',
      tagline: 'Outrun the cops. Don\u2019t stop.',
      file: 'embed/escape.html',
      aspect: '16 / 9',
      accent: '#60a5fa', accent2: '#2563eb',
      hint: 'Controls: WASD / arrow keys to drive',
      art: '<svg viewBox="0 0 64 64" fill="none"><path d="M8 40l6-14a4 4 0 013.6-2.4h28.8A4 4 0 0150 26l6 14" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="6" y="38" width="52" height="10" rx="4" stroke="#fff" stroke-width="5"/><circle cx="20" cy="50" r="4" fill="#fff"/><circle cx="44" cy="50" r="4" fill="#fff"/></svg>'
    }
  ];

  function makeEmbed(stage, file) {
    stage.style.position = 'relative';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;inset:0;';
    var frame = document.createElement('iframe');
    frame.src = file;
    frame.setAttribute('allow', 'autoplay; encrypted-media; fullscreen');
    frame.setAttribute('allowfullscreen', '');
    frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#000;';
    var veil = document.createElement('div');
    veil.style.cssText = 'position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
      'background:rgba(4,7,16,.72);color:#fff;font-weight:700;letter-spacing:3px;font-size:18px;';
    veil.textContent = 'PAUSED';
    wrap.appendChild(frame);
    wrap.appendChild(veil);
    stage.appendChild(wrap);
    var paused = false;

    function focusFrame() {
      try { frame.contentWindow.focus(); } catch (e) { /* cross-origin */ }
    }

    return {
      start: function () { focusFrame(); },
      pause: function () { paused = true; veil.style.display = 'flex'; },
      resume: function () { paused = false; veil.style.display = 'none'; focusFrame(); },
      isPaused: function () { return paused; },
      destroy: function () {
        try { frame.src = 'about:blank'; } catch (e) { /* noop */ }
        wrap.remove();
        stage.style.position = '';
      }
    };
  }

  DEFS.forEach(function (d) {
    window.ArcadeGames[d.id] = {
      meta: {
        title: d.title,
        tagline: d.tagline,
        category: 'arcade',
        accent: d.accent,
        accent2: d.accent2,
        aspect: d.aspect,
        hint: d.hint,
        art: d.art
      },
      create: function (stage, ui) { return makeEmbed(stage, d.file); }
    };
  });
})();
