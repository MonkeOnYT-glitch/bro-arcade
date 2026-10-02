/* Fetcher — load any GitHub-hosted HTML page through CDN mirrors that school
   blocklists usually miss.

   Paste a github.com / raw.githubusercontent.com link. We rewrite it into a
   chain of mirrors (Statically, Githack, AllOrigins, CodeTabs, CorsProxy,
   jsDelivr) and load the first one that answers.

   Two load modes:
   - Direct: the winning mirror URL goes straight into the iframe. Relative
     assets resolve natively, so full multi-file games just work.
   - Inject: we fetch the HTML ourselves, rewrite every relative URL to an
     absolute one on the winning mirror, and inject it via srcdoc into a
     sandboxed frame. Use this when a mirror refuses to be framed.

   Quick-load chips: the arcade's embedded games stream assets from jsDelivr /
   githack, which are blocked at Boston's school. Each chip finds every CDN
   URL in that game's loader page, probes mirrors for each one (Statically,
   Githack), rewrites the URLs to the winners, and injects the page into a
   sandboxed frame. Works whether the game uses <base href> or absolute
   URLs inline. */
(function () {
  'use strict';

  var PROBE_TIMEOUT_MS = 8000;

  /* ---------------- GitHub URL parsing ---------------- */

  // parseGitHub(url) -> {user, repo, branch, path} | null
  // Accepts blob, raw, tree, raw.githubusercontent, and bare repo URLs.
  function parseGitHub(input) {
    var u = (input || '').trim();
    if (!u) return null;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    var m;

    // raw.githubusercontent.com/user/repo/branch/path
    m = u.match(/^https?:\/\/raw\.githubusercontent\.com\/([^\/\s]+)\/([^\/\s]+)\/([^\/\s]+)\/(.+)$/i);
    if (m) return { user: m[1], repo: stripGit(m[2]), branch: m[3], path: cleanPath(m[4]) };

    // github.com/user/repo/(blob|raw|tree)/branch/path...
    m = u.match(/^https?:\/\/(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s?#]+)\/(blob|raw|tree)\/([^\/\s]+)\/?(.*)$/i);
    if (m) {
      var rest = cleanPath(m[5] || '');
      return { user: m[1], repo: stripGit(m[2]), branch: m[4], path: rest || 'index.html' };
    }

    // github.com/user/repo  (bare repo — branch unknown, we try main/master)
    m = u.match(/^https?:\/\/(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s?#]+)\/?(?:[?#].*)?$/i);
    if (m) return { user: m[1], repo: stripGit(m[2]), branch: null, path: 'index.html', root: true };

    return null;
  }

  function stripGit(repo) { return repo.replace(/\.git$/i, ''); }
  function cleanPath(p) {
    p = p.split(/[?#]/)[0].replace(/^\/+/, '');
    try { p = decodeURIComponent(p); } catch (e) { /* keep raw */ }
    return p;
  }

  // parseGitHub(url) -> {user, repo, branch, path} | null
  // Accepts blob, raw, tree, raw.githubusercontent, and bare repo URLs.

  /* ---------------- mirror chain ---------------- */

  function rawFileUrl(info) {
    return 'https://raw.githubusercontent.com/' + info.user + '/' + info.repo + '/' +
      info.branch + '/' + info.path.replace(/^\/+/, '');
  }

  // Full-file mirrors for a pasted link.
  // Path-style mirrors (statically/githack/jsdelivr) resolve relative URLs
  // natively. Query-param proxies (allorigins/codetabs/corsproxy) don't, so
  // they carry rewriteBase (the underlying raw file URL) + wrap (which
  // re-wraps every GitHub-ish absolute URL back through the proxy).
  function buildMirrors(info) {
    var raw = rawFileUrl(info);
    var enc = encodeURIComponent(raw);
    var p = info.path.replace(/^\/+/, '');
    function pathMirror(id, name, url) {
      return { id: id, name: name, url: url, rewriteBase: url, wrap: null };
    }
    function proxyMirror(id, name, prefix) {
      return {
        id: id, name: name, url: prefix + enc, rewriteBase: raw,
        wrap: function (abs) { return prefix + encodeURIComponent(abs); }
      };
    }
    return [
      pathMirror('statically', 'Statically',
        'https://cdn.statically.io/gh/' + info.user + '/' + info.repo + '/' + info.branch + '/' + p),
      pathMirror('githack', 'Githack',
        'https://raw.githack.com/' + info.user + '/' + info.repo + '/' + info.branch + '/' + p),
      proxyMirror('allorigins', 'AllOrigins', 'https://api.allorigins.win/raw?url='),
      proxyMirror('codetabs', 'CodeTabs', 'https://api.codetabs.com/v1/proxy?quest='),
      proxyMirror('corsproxy', 'CorsProxy.io', 'https://corsproxy.io/?url='),
      pathMirror('jsdelivr', 'jsDelivr',
        'https://cdn.jsdelivr.net/gh/' + info.user + '/' + info.repo + '@' + info.branch + '/' + p)
    ];
  }

  // Hosts a school blocklist is likely to eat — these get re-wrapped through
  // the proxy in inject mode instead of being left as-is.
  var PROXY_WRAP_HOSTS = /(^|\.)githubusercontent\.com$|(^|\.)github\.com$|^cdn\.jsdelivr\.net$|(^|\.)githack\.com$/i;

  function fetchWithTimeout(url, ms) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, ms == null ? PROBE_TIMEOUT_MS : ms);
    return fetch(url, { mode: 'cors', credentials: 'omit', signal: ctrl.signal })
      .then(function (res) { clearTimeout(t); return res; },
        function (err) { clearTimeout(t); throw err; });
  }

  // First mirror that serves the file as HTML. Resolves null when every
  // mirror is blocked/down. A mirror that answers with a non-HTML status
  // resolves {reachableOnly:true} — the mirror works, the link is probably bad.
  function findWorkingMirror(mirrors) {
    var chain = Promise.resolve(null);
    mirrors.forEach(function (m) {
      chain = chain.then(function (found) {
        if (found) return found;
        setStatus('Trying <b>' + m.name + '</b>…');
        return fetchWithTimeout(m.url).then(function (res) {
          var ct = (res.headers.get('content-type') || '').toLowerCase();
          var looksHtml = res.ok && (ct.indexOf('html') !== -1 || ct.indexOf('text') !== -1 ||
            /\.html?$/i.test(m.url.split('?')[0]));
          if (looksHtml) {
            return res.text().then(function (text) { return { mirror: m, text: text }; });
          }
          return { mirror: m, reachableOnly: true, status: res.status };
        }).catch(function () { return null; }); // blocked / DNS fail -> next mirror
      });
    });
    return chain;
  }

  /* ---------------- HTML rewriting (inject mode) ---------------- */

  var SKIP_URL = /^(#|data:|blob:|javascript:|mailto:|tel:|about:)/i;

  function absolutize(u, base) {
    if (!u || SKIP_URL.test(u)) return u;
    if (/^https?:\/\//i.test(u) || u.indexOf('//') === 0) return u;
    try { return new URL(u, base).href; } catch (e) { return u; }
  }

  // Rewrite every relative URL in html to an absolute one, using the mirror's
  // rewriteBase. For proxy mirrors, GitHub-ish absolute URLs are re-wrapped
  // through the proxy; other hosts (fonts, CDNs) are left alone.
  // Also drops the page's own <base> (it usually points at the blocked CDN).
  function rewriteRelative(html, mirror) {
    var base = mirror.rewriteBase;
    function finalUrl(u) {
      var abs = absolutize(u, base);
      if (!abs || !mirror.wrap) return abs;
      var probe = abs;
      if (probe.indexOf('//') === 0) probe = 'https:' + probe;
      var host = '';
      try { host = new URL(probe).hostname; } catch (e) { return abs; }
      return PROXY_WRAP_HOSTS.test(host) ? mirror.wrap(probe) : abs;
    }
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var bases = doc.querySelectorAll('base');
    for (var i = 0; i < bases.length; i++) bases[i].parentNode.removeChild(bases[i]);

    function rewriteCss(css) {
      return String(css).replace(/url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi,
        function (m, q, u) { return 'url(' + q + finalUrl(u) + q + ')'; });
    }

    var els = doc.querySelectorAll('[src],[href],[action],[poster],[data],[style]');
    for (var j = 0; j < els.length; j++) {
      var el = els[j];
      ['src', 'href', 'action', 'poster', 'data'].forEach(function (attr) {
        var v = el.getAttribute(attr);
        if (v) el.setAttribute(attr, finalUrl(v));
      });
      var ss = el.getAttribute('srcset');
      if (ss) {
        el.setAttribute('srcset', ss.split(',').map(function (part) {
          var bits = part.trim().split(/\s+/);
          bits[0] = finalUrl(bits[0]);
          return bits.join(' ');
        }).join(', '));
      }
      var st = el.getAttribute('style');
      if (st && st.indexOf('url(') !== -1) el.setAttribute('style', rewriteCss(st));
    }
    var styles = doc.querySelectorAll('style');
    for (var k = 0; k < styles.length; k++) {
      styles[k].textContent = rewriteCss(styles[k].textContent);
    }
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }

  /* ---------------- frame plumbing ---------------- */

  var lastResult = null; // {info, mirror, text|null, url}

  function frame() { return document.getElementById('fetcher-iframe'); }

  function setFrameSrc(url) {
    var f = frame();
    if (!f) return;
    f.removeAttribute('srcdoc');
    f.removeAttribute('sandbox');
    f.src = url;
  }

  function injectHtml(html, mirror) {
    var f = frame();
    if (!f) return;
    f.removeAttribute('src');
    // Sandboxed WITHOUT allow-same-origin: game scripts run on an opaque
    // origin, so a shady page can't touch bro-arcade's storage.
    f.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups');
    f.srcdoc = rewriteRelative(html, mirror);
  }

  function setStatus(html) {
    var el = document.getElementById('fetcher-status');
    if (el) el.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function currentMode() {
    var seg = document.getElementById('fetcher-mode-seg');
    var on = seg ? seg.querySelector('button.on') : null;
    return on ? on.getAttribute('data-mode') : 'direct';
  }

  function currentMirrorId() {
    var sel = document.getElementById('fetcher-mirror-select');
    return sel ? sel.value : 'auto';
  }

  function blankHint(mirrorName) {
    return ' <span class="dim">Looks blank? The mirror may block framing — ' +
      '<button class="linklike" onclick="window.fetcherInjectLast()">inject it instead</button>.</span>';
  }

  /* ---------------- main load flow ---------------- */

  window.loadFetcher = function () {
    var input = document.getElementById('fetcher-url-input');
    var url = (input.value || '').trim();
    if (!url) { setStatus('Paste a GitHub link first.'); return; }
    var info = parseGitHub(url);
    if (!info) {
      setStatus('That doesn\'t look like a GitHub file link. Try a <b>github.com/user/repo/blob/main/…</b> URL.');
      return;
    }
    if (input) input.value = url;
    if (!info.branch) { tryBranches(info, ['main', 'master']); return; }
    runLoad(info, null);
  };

  // Bare repo URL: we don't know the default branch, so try candidates.
  function tryBranches(info, branches) {
    var i = 0;
    (function next() {
      if (i >= branches.length) {
        setStatus('No index page found on <b>main</b> or <b>master</b> — paste a direct file link instead.');
        return;
      }
      var attempt = { user: info.user, repo: info.repo, branch: branches[i++], path: 'index.html' };
      setStatus('No branch given — trying <b>' + attempt.branch + '</b>…');
      runLoad(attempt, next);
    })();
  }

  function runLoad(info, onFail) {
    var mode = currentMode();
    var mirrorId = currentMirrorId();
    var mirrors = buildMirrors(info);
    var list = mirrorId === 'auto'
      ? mirrors
      : mirrors.filter(function (m) { return m.id === mirrorId; });
    if (!list.length) { setStatus('Unknown mirror selected.'); return; }

    if (mirrorId !== 'auto') {
      var m = list[0];
      setStatus('Loading via <b>' + m.name + '</b>…');
      // Proxy mirrors can't be framed directly (relative URLs would resolve
      // against the proxy's query string), so they always go through inject.
      if (mode === 'inject' || m.wrap) {
        fetchWithTimeout(m.url).then(function (res) {
          if (!res.ok) throw new Error('http ' + res.status);
          return res.text();
        }).then(function (text) {
          lastResult = { info: info, mirror: m, text: text, url: m.url };
          injectHtml(text, m);
          setStatus('✓ via <b>' + m.name + '</b> (inject mode).');
        }).catch(function () {
          setStatus('<b>' + m.name + '</b> didn\'t answer. Try <b>Auto</b>.');
          if (onFail) onFail();
        });
      } else {
        lastResult = { info: info, mirror: m, text: null, url: m.url };
        setFrameSrc(m.url);
        setStatus('✓ via <b>' + m.name + '</b>.' + blankHint());
      }
      return;
    }

    setStatus('Resolving <b>' + escapeHtml(info.user + '/' + info.repo) + '</b>…');
    findWorkingMirror(list).then(function (found) {
      if (!found) {
        setStatus('Every mirror is blocked or down from here. Try another network.');
        if (onFail) onFail();
        return;
      }
      lastResult = { info: info, mirror: found.mirror, text: found.text || null, url: found.mirror.url };
      if (found.reachableOnly) {
        setStatus('Mirror <b>' + found.mirror.name + '</b> is up but didn\'t return the file (HTTP ' +
          found.status + '). Double-check the link.');
        if (onFail) onFail();
        return;
      }
      // Proxy mirrors can't be framed directly — inject the fetched HTML.
      if (mode === 'inject' || found.mirror.wrap) {
        injectHtml(found.text, found.mirror);
        setStatus('✓ via <b>' + found.mirror.name + '</b> (inject mode).');
      } else {
        setFrameSrc(found.mirror.url);
        setStatus('✓ via <b>' + found.mirror.name + '</b>.' + blankHint());
      }
    });
  }

  // Re-inject the last loaded page via srcdoc (for mirrors that block framing).
  window.fetcherInjectLast = function () {
    var r = lastResult;
    if (!r) { setStatus('Nothing loaded yet.'); return; }
    if (r.text) {
      injectHtml(r.text, r.mirror);
      setStatus('✓ via <b>' + r.mirror.name + '</b> (inject mode).');
      return;
    }
    setStatus('Fetching via <b>' + r.mirror.name + '</b> for injection…');
    fetchWithTimeout(r.url).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.text();
    }).then(function (text) {
      r.text = text;
      injectHtml(text, r.mirror);
      setStatus('✓ via <b>' + r.mirror.name + '</b> (inject mode).');
    }).catch(function () {
      setStatus('Couldn\'t fetch it for injection. Try another mirror.');
    });
  };

  window.fetcherCopyLink = function () {
    var r = lastResult;
    if (!r) { setStatus('Nothing loaded yet — fetch something first.'); return; }
    var done = function () { setStatus('Link copied — this is the mirror URL that worked.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(r.url).then(done, function () { setStatus('Copy failed — long-press the frame URL instead.'); });
    } else {
      setStatus('Clipboard unavailable here.');
    }
  };

  window.fetcherFullscreen = function () {
    var wrap = document.getElementById('fetcher-frame-wrap');
    if (!wrap) return;
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (wrap.requestFullscreen) wrap.requestFullscreen();
  };

  /* ---------------- quick-load chips ---------------- */
  // The embedded games pull assets from jsDelivr / githack — both blocked at
  // Boston's school. Each chip rewrites EVERY cdn.jsdelivr.net / githack.com
  // URL in that game's loader page to a mirror that answers, then injects the
  // page. Works whether the game uses <base href> or absolute URLs inline.

  var QUICK_GAMES = [
    { id: 'subway', title: 'Subway Surfers', file: 'embed/subway.html' },
    { id: 'rooftop', title: 'Rooftop Snipers', file: 'embed/rooftop.html' },
    { id: 'cookie', title: 'Cookie Clicker', file: 'embed/cookie.html' },
    { id: 'ctr', title: 'Cut the Rope', file: 'embed/ctr.html' },
    { id: 'escape', title: 'Escape Road', file: 'embed/escape.html' },
    { id: 'ragdoll-archers', title: 'Ragdoll Archers', file: 'embed/ragdoll-archers.html' },
    { id: 'gorilla-tag', title: 'Gorilla Tag Web', file: 'embed/gorilla-tag.html' },
    { id: 'getaway-shootout', title: 'Getaway Shootout', file: 'embed/getaway-shootout.html' },
    { id: 'run3', title: 'Run 3', file: 'embed/run3.html' },
    { id: 'retro-bowl', title: 'Retro Bowl', file: 'embed/retro-bowl.html' },
    { id: 'ragdoll-drop', title: 'Ragdoll Drop', file: 'embed/ragdoll-drop.html' },
    { id: 'sandbox-city', title: 'Sandbox City', file: 'embed/sandbox-city.html' },
    { id: 'rooftop-snipers-2', title: 'Rooftop Snipers 2', file: 'embed/rooftop-snipers-2.html' }
  ];

  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Every distinct jsDelivr / githack CDN prefix in the HTML, with one real
  // asset URL per prefix (used to probe which mirror serves it).
  // -> [{prefix, user, repo, branch|null, sample|null}]
  function cdnPrefixes(html) {
    var out = [];
    var seen = {};
    var patterns = [
      /https:\/\/cdn\.jsdelivr\.net\/gh\/([^\/@\s"']+)\/([^\/@\s"']+)(?:@([^\/\s"']+))?\//g,
      /https:\/\/(?:raw\.)?githack\.com\/([^\/\s"']+)\/([^\/\s"']+)\/([^\/\s"']+)\//g
    ];
    patterns.forEach(function (re) {
      var m;
      while ((m = re.exec(html)) !== null) {
        if (seen[m[0]]) continue;
        seen[m[0]] = 1;
        // First full URL on this prefix that looks like a real file — not the
        // <base> URL itself (a directory ending in /), which would 404 probes.
        var sample = null;
        var all = html.match(new RegExp(escapeRegExp(m[0]) + '[^\\s"\'<>]+', 'g')) || [];
        for (var i = 0; i < all.length; i++) {
          var rest = all[i].slice(m[0].length);
          if (rest && rest.charAt(rest.length - 1) !== '/') { sample = all[i]; break; }
        }
        out.push({ prefix: m[0], user: m[1], repo: m[2], branch: m[3] || null, sample: sample });
      }
    });
    return out;
  }

  function mirrorPrefix(user, repo, branch, mirrorId) {
    if (mirrorId === 'githack') return 'https://raw.githack.com/' + user + '/' + repo + '/' + branch + '/';
    if (mirrorId === 'jsdelivr') return 'https://cdn.jsdelivr.net/gh/' + user + '/' + repo + '@' + branch + '/';
    return 'https://cdn.statically.io/gh/' + user + '/' + repo + '/' + branch + '/'; // statically
  }

  var MIRROR_NAMES = { statically: 'Statically', githack: 'Githack', jsdelivr: 'jsDelivr' };

  // Default branch via the GitHub API (proxied — api.github.com may be blocked
  // too). Used when a CDN URL has no branch pinned.
  function githubDefaultBranch(user, repo) {
    var url = 'https://api.allorigins.win/raw?url=' +
      encodeURIComponent('https://api.github.com/repos/' + user + '/' + repo);
    return fetchWithTimeout(url).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    }).then(function (j) {
      return (j && j.default_branch) || null;
    }).catch(function () { return null; });
  }

  // Resolve a "@latest" branch pin to a concrete version via jsDelivr's data
  // API (proxied). Statically/githack need a real ref.
  function jsdelivrLatestVersion(user, repo) {
    var url = 'https://api.allorigins.win/raw?url=' +
      encodeURIComponent('https://data.jsdelivr.com/v1/packages/gh/' + user + '/' + repo);
    return fetchWithTimeout(url).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.json();
    }).then(function (j) {
      return (j && j.versions && j.versions[0] && j.versions[0].version) || null;
    }).catch(function () { return null; });
  }

  // Pick a working mirror prefix for one CDN prefix entry.
  // Resolves {prefix, name} — falls back to the original prefix when nothing
  // better answers.
  function resolvePrefix(p) {
    function withBranch(branch) {
      var probePath = p.sample
        ? p.sample.slice(p.prefix.length).split(/[?#]/)[0].replace(/^\/+/, '')
        : null;
      var chain = Promise.resolve(null);
      ['statically', 'githack'].forEach(function (mid) {
        chain = chain.then(function (found) {
          if (found) return found;
          var mp = mirrorPrefix(p.user, p.repo, branch, mid);
          setStatus('Trying <b>' + MIRROR_NAMES[mid] + '</b>…');
          return fetchWithTimeout(mp + (probePath || '')).then(function (res) {
            // With a real asset to check: need 200. Without one (bare <base>),
            // any HTTP answer proves the mirror isn't blocked.
            if (probePath ? res.ok : true) return { prefix: mp, name: MIRROR_NAMES[mid] };
            return null;
          }).catch(function () { return null; }); // blocked -> next
        });
      });
      return chain;
    }

    function decideBranch() {
      if (p.branch && p.branch !== 'latest') return Promise.resolve(p.branch);
      if (p.branch === 'latest') {
        return jsdelivrLatestVersion(p.user, p.repo).then(function (v) { return v || 'latest'; });
      }
      return githubDefaultBranch(p.user, p.repo).then(function (b) { return b || 'main'; });
    }

    return decideBranch().then(withBranch).then(function (winner) {
      if (winner) return winner;
      // Branch guess may be wrong (main vs master) — retry once on master.
      if (!p.branch) {
        return withBranch('master').then(function (w2) {
          return w2 || { prefix: p.prefix, name: 'original CDN' };
        });
      }
      return { prefix: p.prefix, name: 'original CDN' };
    });
  }

  window.fetcherQuick = function (id) {
    var g = null;
    for (var i = 0; i < QUICK_GAMES.length; i++) if (QUICK_GAMES[i].id === id) g = QUICK_GAMES[i];
    if (!g) return;
    setStatus('Loading <b>' + escapeHtml(g.title) + '</b>…');
    fetch(g.file, { credentials: 'omit' }).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.text();
    }).then(function (html) {
      var prefixes = cdnPrefixes(html);
      if (!prefixes.length) { setStatus('No CDN links found in that game file.'); return; }
      var chain = Promise.resolve([]);
      prefixes.forEach(function (p) {
        chain = chain.then(function (done) {
          return resolvePrefix(p).then(function (w) {
            done.push([p.prefix, w.prefix, w.name]);
            return done;
          });
        });
      });
      chain.then(function (pairs) {
        var out = html;
        var names = [];
        pairs.forEach(function (pair) {
          if (pair[0] !== pair[1]) {
            out = out.split(pair[0]).join(pair[1]);
            if (names.indexOf(pair[2]) === -1) names.push(pair[2]);
          }
        });
        var f = frame();
        if (!f) return;
        f.removeAttribute('src');
        // Sandboxed WITHOUT allow-same-origin: game scripts run on an opaque
        // origin, so a shady mirror can't touch bro-arcade's storage.
        f.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups');
        f.srcdoc = out;
        lastResult = null;
        setStatus('✓ <b>' + escapeHtml(g.title) + '</b>' +
          (names.length ? ' via <b>' + names.join(' + ') + '</b>.' : ' — CDN already reachable, loaded as-is.'));
      });
    }).catch(function () {
      setStatus('Couldn\'t read the local game file — this page needs to be served over http(s), not opened as a file.');
    });
  };

  /* ---------------- wire up ---------------- */

  // Exposed for tests / debugging.
  window.fetcherParse = parseGitHub;
  window.fetcherCdnPrefixes = cdnPrefixes;
  window.fetcherBuildMirrors = buildMirrors;
  window.fetcherMirrorPrefix = mirrorPrefix;
  window.fetcherRewrite = rewriteRelative;

  document.addEventListener('DOMContentLoaded', function () {
    var box = document.getElementById('fetcher-chips');
    if (box) {
      QUICK_GAMES.forEach(function (g) {
        var b = document.createElement('button');
        b.className = 'chip';
        b.type = 'button';
        b.textContent = g.title;
        b.setAttribute('data-game', g.id);
        b.addEventListener('click', function () { window.fetcherQuick(g.id); });
        box.appendChild(b);
      });
    }
    var seg = document.getElementById('fetcher-mode-seg');
    if (seg) seg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var btns = seg.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('on');
      b.classList.add('on');
    });
    var input = document.getElementById('fetcher-url-input');
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') window.loadFetcher();
    });
  });
})();
