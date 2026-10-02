/* Monke AI — Gemini-powered chatbot for Bro Arcade.
   Ported from the Monke Vault AI: 5 personas, image upload, voice dictation,
   local math fast-path, chat history, and a per-browser daily limit.
   NOTE: the Gemini API key below is stored scrambled (split + base64) to deter
   scrapers, but anyone with devtools can still recover it — that is inherent
   to client-side AI calls. Restrict the key in AI Studio (HTTP referrers +
   Generative Language API only) for real protection. */
(function () {
  'use strict';

  /* Keys are stored scrambled (split + base64) so they don't sit in
     plaintext for scrapers. Reassembled at runtime — this deters bots,
     not anyone with devtools. */
  function unscramble(parts) {
    var s = '';
    for (var i = 0; i < parts.length; i++) {
      try { s += atob(parts[i]); } catch (e) { /* noop */ }
    }
    return s;
  }

    var GEMINI_KEY = unscramble(['QVEuQWI4Uk42SjVGeUc=', 'dHQtY2owQ3FrTGpQYjc=', 'azZPNXE5eWhGVXg0UFQ=', 'S2NPcUlObEFxMXc=']); // reassembled from scrambled parts at runtime
  var MODEL_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';
  var LS_HISTORY = 'broarcade_ai_history';
  var LS_COUNT = 'broarcade_ai_count';
  var LS_COUNT_DAY = 'broarcade_ai_day';
  var DAILY_LIMIT = 30;
  var MAX_TURNS = 60;

  var PERSONAS = {
    monke: 'You are Monke, an advanced AI monkey. You speak with high intelligence but frequently use monkey-related analogies, puns, and emojis (like \u{1F34C} and \u{1F412}).',
    friend: 'You are my casual best friend. You match my energy exactly. Use casual internet slang, be super chill, and talk to me like we are texting.',
    math: 'You are an advanced mathematical tutor. You provide clear, step-by-step breakdowns for math problems and equations without any unnecessary conversational filler.',
    smart: 'You are a highly intelligent, logical research assistant. Provide detailed, accurate, and structured information. Use professional and academic language.',
    essays: 'You are an expert essayist and academic writer. You write formally, with impeccable grammar, structured paragraphs, sophisticated transitions, and elevated vocabulary.'
  };

  var currentPersona = 'monke';
  var aiHistory = [];
  var pendingImage = null;
  var sending = false;

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- daily limit (per browser) ---------- */
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function getCount() {
    try {
      if (localStorage.getItem(LS_COUNT_DAY) !== todayStr()) return 0;
      return parseInt(localStorage.getItem(LS_COUNT) || '0', 10) || 0;
    } catch (e) { return 0; }
  }
  function bumpCount() {
    try {
      var n = getCount() + 1;
      localStorage.setItem(LS_COUNT_DAY, todayStr());
      localStorage.setItem(LS_COUNT, String(n));
      updateLimitUI();
    } catch (e) { /* noop */ }
  }
  function limitHit() { return getCount() >= DAILY_LIMIT; }
  function updateLimitUI() {
    var note = $('ai-limit-note');
    if (note) note.textContent = getCount() + ' / ' + DAILY_LIMIT + ' AI messages today';
    var input = $('ai-input'), btn = $('ai-send-btn');
    if (limitHit()) {
      if (input) { input.disabled = true; input.placeholder = 'Daily limit reached — back tomorrow'; }
      if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
    }
  }

  /* ---------- history ---------- */
  function saveHistory() {
    try { localStorage.setItem(LS_HISTORY, JSON.stringify(aiHistory.slice(-MAX_TURNS))); }
    catch (e) { /* noop */ }
  }
  function loadHistory() {
    try { aiHistory = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]'); }
    catch (e) { aiHistory = []; }
    renderHistory();
  }
  function renderHistory() {
    var log = $('ai-chat-log');
    if (!log) return;
    log.innerHTML = '';
    if (!aiHistory.length) {
      log.innerHTML = '<div class="ai-row left"><div class="ai-msg bot-msg">UPLINK ESTABLISHED. Pick a persona and ask me anything. \u{1F412}</div></div>';
      return;
    }
    aiHistory.forEach(function (turn) {
      var isUser = turn.role === 'user';
      var textPart = null, imgPart = null;
      (turn.parts || []).forEach(function (p) {
        if (p.text) textPart = p.text;
        if (p.inlineData) imgPart = p.inlineData;
      });
      var html = '';
      if (imgPart) html += '<img src="data:' + imgPart.mimeType + ';base64,' + imgPart.data + '" style="max-height:150px;border-radius:8px;margin-bottom:8px;display:block;">';
      if (textPart) html += '<span>' + esc(textPart) + '</span>';
      var row = document.createElement('div');
      row.className = 'ai-row ' + (isUser ? 'right' : 'left');
      row.innerHTML = '<div class="ai-msg ' + (isUser ? 'user-msg' : 'bot-msg') + '">' + html + '</div>';
      log.appendChild(row);
    });
    log.scrollTop = log.scrollHeight;
  }

  /* ---------- personas ---------- */
  window.setPersona = function (name) {
    if (!PERSONAS[name]) return;
    currentPersona = name;
    var btns = document.querySelectorAll('.persona-btn');
    Array.prototype.forEach.call(btns, function (b) {
      b.classList.toggle('active', b.dataset.persona === name);
    });
  };

  /* ---------- image upload ---------- */
  window.handleAIImageSelect = function (ev) {
    var file = ev.target.files && ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 768;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        pendingImage = { mimeType: 'image/jpeg', data: cv.toDataURL('image/jpeg', 0.6).split(',')[1] };
        $('ai-img-preview').src = 'data:image/jpeg;base64,' + pendingImage.data;
        $('ai-img-preview-container').hidden = false;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    ev.target.value = '';
  };
  window.clearAIImage = function () {
    pendingImage = null;
    var c = $('ai-img-preview-container');
    if (c) c.hidden = true;
  };

  /* ---------- dictation ---------- */
  window.startAIDictation = function () {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { flashHint('Voice input not supported in this browser.'); return; }
    try {
      var rec = new SR();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.onresult = function (e) {
        var t = e.results[0][0].transcript;
        var input = $('ai-input');
        if (input) { input.value = (input.value ? input.value + ' ' : '') + t; updateCharCount(); input.focus(); }
      };
      rec.onerror = function () { flashHint('Could not hear that — try again.'); };
      rec.start();
      flashHint('Listening… speak now.');
    } catch (e) { flashHint('Voice input failed to start.'); }
  };

  window.updateCharCount = function () {
    var input = $('ai-input'), cc = $('ai-char-count');
    if (input && cc) cc.textContent = input.value.length ? input.value.length + ' / 2000' : '';
  };

  window.clearAIChat = function () {
    aiHistory = [];
    saveHistory();
    renderHistory();
  };

  var hintTimer = null;
  function flashHint(msg) {
    var h = $('ai-hint');
    if (!h) return;
    h.textContent = msg;
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { h.textContent = ''; }, 2600);
  }

  /* ---------- network ---------- */
  function fetchWithRetry(url, options, retries) {
    retries = (retries == null) ? 5 : retries;
    function attempt(n) {
      return fetch(url, options).then(function (r) {
        if (!r.ok && n > 0 && (r.status === 429 || r.status >= 500)) {
          return new Promise(function (res) { setTimeout(res, 800 * (6 - n)); }).then(function () { return attempt(n - 1); });
        }
        return r;
      }).catch(function (e) {
        if (n > 0) return new Promise(function (res) { setTimeout(res, 800 * (6 - n)); }).then(function () { return attempt(n - 1); });
        throw e;
      });
    }
    return attempt(retries);
  }

  /* ---------- send ---------- */
  window.sendToAI = function () {
    if (sending) return;
    var input = $('ai-input'), log = $('ai-chat-log');
    if (!input || !log) return;
    if (limitHit()) { flashHint('Daily AI limit reached — back tomorrow.'); return; }
    var query = input.value.trim().slice(0, 2000);
    if (!query && !pendingImage) return;

    var logHtml = '';
    if (pendingImage) logHtml += '<img src="data:image/jpeg;base64,' + pendingImage.data + '" style="max-height:100px;border-radius:8px;margin-bottom:8px;display:block;">';
    if (query) logHtml += '<span>' + esc(query) + '</span>';
    var userRow = document.createElement('div');
    userRow.className = 'ai-row right';
    userRow.innerHTML = '<div class="ai-msg user-msg">' + logHtml + '</div>';
    log.appendChild(userRow);
    log.scrollTop = log.scrollHeight;

    var payloadParts = [];
    if (query) payloadParts.push({ text: query });
    if (pendingImage) payloadParts.push({ inlineData: pendingImage });

    input.value = '';
    window.clearAIImage();
    updateCharCount();

    // Local math fast-path — no API call burned for arithmetic.
    if (query && !payloadParts.some(function (p) { return p.inlineData; }) &&
        /^[0-9+\-*/().%\sxX]+$/.test(query) && /[0-9]/.test(query) && /[+\-*/xX]/.test(query)) {
      try {
        var result = new Function('return ' + query.replace(/[xX]/g, '*'))();
        if (result !== undefined && !isNaN(result)) {
          var w = document.createElement('div');
          w.className = 'ai-row left';
          w.innerHTML = '<div class="ai-msg bot-msg">' + esc(query) + ' = ' + esc(String(result)) + '</div>';
          log.appendChild(w);
          log.scrollTop = log.scrollHeight;
          return;
        }
      } catch (e) { /* fall through to AI */ }
    }

    var botId = 'msg-' + Date.now();
    var botRow = document.createElement('div');
    botRow.className = 'ai-row left';
    botRow.innerHTML = '<div class="ai-msg bot-msg" id="' + botId + '">…THINKING…</div>';
    log.appendChild(botRow);
    log.scrollTop = log.scrollHeight;

    sending = true;
    var sysPrompt = PERSONAS[currentPersona] || PERSONAS.monke;
    var tempHistory = aiHistory.concat([{ role: 'user', parts: payloadParts }]);

    fetchWithRetry(MODEL_URL + '?key=' + GEMINI_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sysPrompt }] },
        contents: tempHistory.slice(-20)
      })
    }).then(function (r) { return r.json(); }).then(function (data) {
      var bEl = document.getElementById(botId);
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) throw new Error('API failure');
      var reply = data.candidates[0].content.parts[0].text;
      aiHistory = tempHistory;
      aiHistory.push({ role: 'model', parts: [{ text: reply }] });
      if (bEl) bEl.innerText = reply;
      saveHistory();
      bumpCount();
      log.scrollTop = log.scrollHeight;
    }).catch(function () {
      var bEl = document.getElementById(botId);
      if (bEl) bEl.innerHTML = '<span style="color:#f87171;">UPLINK ERROR: network issue or API limits.</span>';
    }).then(function () { sending = false; });
  };

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    loadHistory();
    updateLimitUI();
    var input = $('ai-input');
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') window.sendToAI();
    });
    var file = $('ai-file-upload');
    if (file) file.addEventListener('change', window.handleAIImageSelect);
  });
})();
