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
    },
    /* ---- Vault Arcade imports ---- */
    {
      id: 'ragdoll-archers',
      title: 'Ragdoll Archers',
      tagline: 'Stick-figure bow battles.',
      file: 'embed/ragdoll-archers.html',
      aspect: '16 / 10',
      accent: '#a78bfa', accent2: '#7c3aed',
      hint: 'Controls: aim with mouse &middot; drag and release to shoot',
      art: '<svg viewBox="0 0 64 64" fill="none"><path d="M14 8c14 12 14 36 0 48" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M14 32h34" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M48 32l-8-5M48 32l-8 5" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>'
    },
    {
      id: 'gorilla-tag',
      title: 'Gorilla Tag Web',
      tagline: 'Swing like a gorilla. Tag, you\u2019re it.',
      file: 'embed/gorilla-tag.html',
      aspect: '16 / 10',
      accent: '#4ade80', accent2: '#15803d',
      hint: 'Controls: click and drag to swing your arms',
      art: '<svg viewBox="0 0 64 64" fill="none"><path d="M20 50c-6-8-8-18-4-28 3-8 10-12 16-12s13 4 16 12c4 10 2 20-4 28" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="26" cy="26" r="2.6" fill="#fff"/><circle cx="38" cy="26" r="2.6" fill="#fff"/><path d="M26 36c3 3 9 3 12 0" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>'
    },
    {
      id: 'getaway-shootout',
      title: 'Getaway Shootout',
      tagline: 'Race, shoot, escape.',
      file: 'embed/getaway-shootout.html',
      aspect: '16 / 9',
      accent: '#f87171', accent2: '#b91c1c',
      hint: 'Controls: W to jump &middot; E to shoot / grab',
      art: '<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="18" stroke="#fff" stroke-width="5"/><circle cx="32" cy="32" r="7" stroke="#fff" stroke-width="4"/><circle cx="32" cy="32" r="2" fill="#fff"/></svg>'
    },
    {
      id: 'run3',
      title: 'Run 3',
      tagline: 'Run through the space tunnels.',
      file: 'embed/run3.html',
      aspect: '16 / 10',
      accent: '#22d3ee', accent2: '#0e7490',
      hint: 'Controls: arrow keys / WASD to move &middot; space to jump',
      art: '<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="6" fill="#fff"/><ellipse cx="32" cy="32" rx="16" ry="24" stroke="#fff" stroke-width="4"/><ellipse cx="32" cy="32" rx="26" ry="10" stroke="#fff" stroke-width="4" transform="rotate(35 32 32)"/></svg>'
    },
    {
      id: 'retro-bowl',
      title: 'Retro Bowl',
      tagline: 'Retro football glory.',
      file: 'embed/retro-bowl.html',
      aspect: '16 / 10',
      accent: '#fbbf24', accent2: '#92400e',
      hint: 'Controls: mouse to aim &middot; click to throw',
      art: '<svg viewBox="0 0 64 64" fill="none"><ellipse cx="32" cy="32" rx="20" ry="12" stroke="#fff" stroke-width="5" transform="rotate(-25 32 32)"/><path d="M28 26l8 12M32 24v16" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>'
    },
    {
      id: 'ragdoll-drop',
      title: 'Ragdoll Drop',
      tagline: 'Drop the ragdoll. Try not to break it.',
      file: 'embed/ragdoll-drop.html',
      aspect: '16 / 10',
      accent: '#f472b6', accent2: '#9d174d',
      hint: 'Controls: click to drop &middot; guide the fall',
      art: '<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="14" r="6" stroke="#fff" stroke-width="4"/><path d="M32 20v14M32 26l-10 6M32 26l10 6M32 34l-8 14M32 34l8 14" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>'
    },
    {
      id: 'sandbox-city',
      title: 'Sandbox City',
      tagline: 'Open-world sandbox driving.',
      file: 'embed/sandbox-city.html',
      aspect: '16 / 9',
      accent: '#60a5fa', accent2: '#1d4ed8',
      hint: 'Controls: WASD to drive &middot; explore the city',
      art: '<svg viewBox="0 0 64 64" fill="none"><path d="M10 54V30l8-6v30M22 54V18l10-8v44M38 54V26l8-5v33M50 54V36" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 54h52" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>'
    },
    {
      id: 'rooftop-snipers-2',
      title: 'Rooftop Snipers 2',
      tagline: 'The sequel. More rooftops.',
      file: 'embed/rooftop-snipers-2.html',
      aspect: '16 / 10',
      accent: '#e879f9', accent2: '#a21caf',
      hint: 'Controls: W to jump &middot; knock them off first',
      art: '<svg viewBox="0 0 64 64" fill="none"><rect x="10" y="40" width="18" height="14" stroke="#fff" stroke-width="4"/><rect x="36" y="40" width="18" height="14" stroke="#fff" stroke-width="4"/><path d="M19 40V26M45 40V26" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="14" r="6" stroke="#fff" stroke-width="4"/></svg>'
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
