/* Lobby chat — realtime via Boston's "newmonkevault" Firebase project.
   Uses Firestore + anonymous auth, same data model as the vault app:
   collection artifacts/monke-vault-db/public/data/chat_arcade-lobby
   message: { sender, displayName, text, timestamp } */
(function () {
  'use strict';

  var COLLECTION = 'artifacts/monke-vault-db/public/data/chat_arcade-lobby';
  var MAX_LEN = 500;
  var SEND_GAP = 1500;

  var fab = document.getElementById('chat-fab');
  var panel = document.getElementById('chat-panel');
  var closeBtn = document.getElementById('chat-close');
  var log = document.getElementById('chat-log');
  var form = document.getElementById('chat-form');
  var input = document.getElementById('chat-input');
  var nameInput = document.getElementById('chat-name');
  var statusEl = document.getElementById('chat-status');
  var badge = document.getElementById('chat-badge');
  var sendBtn = form.querySelector('.chat-send');

  var open = false;
  var me = null;
  var lastSend = 0;
  var unread = 0;
  var ready = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? 'Today at ' + t : d.toLocaleDateString() + ' at ' + t;
  }

  function setStatus(text, online) {
    statusEl.textContent = text;
    statusEl.classList.toggle('online', !!online);
  }

  function displayName() {
    var n = ((nameInput.value || '').trim() || localStorage.getItem('ba-chat-name') || '').trim();
    if (!n) n = 'Player' + Math.floor(1000 + Math.random() * 9000);
    return n.slice(0, 20);
  }

  nameInput.value = localStorage.getItem('ba-chat-name') || '';
  nameInput.addEventListener('change', function () {
    var n = nameInput.value.trim().slice(0, 20);
    if (n) localStorage.setItem('ba-chat-name', n);
    else localStorage.removeItem('ba-chat-name');
  });

  function render(messages) {
    log.innerHTML = '';
    if (!messages.length) {
      log.innerHTML = '<div class="chat-empty">No messages yet. Say hi!</div>';
      return;
    }
    messages.forEach(function (m) {
      var mine = !!(me && m.sender && m.sender === me.uid);
      var div = document.createElement('div');
      div.className = 'chat-msg' + (mine ? ' mine' : '');
      div.innerHTML =
        '<div class="chat-meta"><b>' + esc(m.displayName || 'Player') + '</b>' +
        '<span>' + esc(fmtTime(m.timestamp)) + '</span></div>' +
        '<div class="chat-text">' + esc(m.text) + '</div>';
      log.appendChild(div);
    });
    log.scrollTop = log.scrollHeight;
  }

  function toggle(force) {
    open = typeof force === 'boolean' ? force : !open;
    panel.hidden = !open;
    if (open) {
      unread = 0;
      badge.hidden = true;
      setTimeout(function () { input.focus(); }, 60);
      log.scrollTop = log.scrollHeight;
    } else {
      fab.focus();
    }
  }

  fab.addEventListener('click', function () { toggle(); });
  closeBtn.addEventListener('click', function () { toggle(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) { e.stopPropagation(); toggle(false); }
  }, true);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!ready || !me) return;
    var text = input.value.trim();
    if (!text) return;
    if (text.length > MAX_LEN) { input.value = text.slice(0, MAX_LEN); return; }
    var now = Date.now();
    if (now - lastSend < SEND_GAP) return;
    lastSend = now;
    input.value = '';
    sendBtn.disabled = true;
    firebase.firestore().collection(COLLECTION).add({
      sender: me.uid,
      displayName: displayName(),
      text: text,
      timestamp: Date.now()
    }).then(function () {
      sendBtn.disabled = false;
    }).catch(function () {
      sendBtn.disabled = false;
      setStatus('Send failed — try again', false);
    });
  });

  function init() {
    if (typeof firebase === 'undefined') { setStatus('Chat unavailable', false); return; }
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp({
          apiKey: 'AIzaSyBIE85V4pzQp-bZKQ2dNxJkggEZ4qLXRyc',
          authDomain: 'newmonkevault.firebaseapp.com',
          projectId: 'newmonkevault',
          storageBucket: 'newmonkevault.firebasestorage.app',
          messagingSenderId: '120207548495',
          appId: '1:120207548495:web:613017e1880c14a52aca3a'
        });
      }
    } catch (err) { setStatus('Chat unavailable', false); return; }

    var auth = firebase.auth();
    var db = firebase.firestore();
    setStatus('Connecting…', false);
    auth.onAuthStateChanged(function (u) {
      if (!u) {
        auth.signInAnonymously().catch(function () { setStatus('Chat unavailable', false); });
        return;
      }
      me = u;
      ready = true;
      setStatus('Online', true);
      db.collection(COLLECTION)
        .orderBy('timestamp', 'asc')
        .limitToLast(100)
        .onSnapshot(function (snap) {
          var msgs = [];
          snap.forEach(function (doc) {
            var d = doc.data();
            if (d && typeof d.text === 'string') msgs.push(d);
          });
          render(msgs);
          if (!open) {
            unread++;
            badge.hidden = false;
            badge.textContent = unread > 99 ? '99+' : String(unread);
          }
        }, function () {
          setStatus('Chat unavailable', false);
        });
    });
  }

  init();
})();
