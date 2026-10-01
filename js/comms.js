/* ── Bro Arcade Comms ────────────────────────────────────────────────
   The full Vault Comms system — servers with text/voice channels, direct
   messages, friend requests, blocking, and WebRTC voice/video calls —
   ported from the Monke Vault app.

   One deliberate change from the vault: its username+password login is
   NOT ported (it stored plaintext passwords in Firestore). Identity here
   is the arcade's anonymous Firebase auth UID, displayed under your
   lobby-chat name. Same Firebase project and same collections as the
   vault, so this joins the existing comms network rather than starting
   a new one.
   ─────────────────────────────────────────────────────────────────── */

var COMMS_APP_ID = 'monke-vault-db';
var COMMS_BOOT_TRIES = 0;

function commsFirebaseReady() {
  return (typeof firebase !== 'undefined') && firebase.apps && firebase.apps.length;
}

function commsDisplayName() {
  try { return (localStorage.getItem('ba-chat-name') || 'Monke').trim() || 'Monke'; }
  catch (e) { return 'Monke'; }
}

/* Create the comms user doc on first run (no password, ever). */
function commsEnsureUserDoc(uid) {
  var ref = window.db.doc('artifacts/' + COMMS_APP_ID + '/public/data/users/' + uid);
  var name = commsDisplayName();
  return ref.get().then(function (snap) {
    if (!snap.exists) {
      return ref.set({
        dms: [], joined_servers: [], friend_requests: [],
        blocked_users: [], silent_blocks: [],
        pfp: window.defaultPfp, isPublic: false,
        displayName: name, isBanned: false
      });
    }
    var d = snap.data() || {};
    if (d.displayName !== name) {
      return ref.update({ displayName: name }).catch(function () {});
    }
  }).catch(function () {});
}

function commsSetMyId(name) {
  var el = document.getElementById('comms-my-id');
  if (el) el.textContent = '@' + name;
}

function commsBoot() {
  if (!commsFirebaseReady()) {
    if (COMMS_BOOT_TRIES++ < 60) setTimeout(commsBoot, 500);
    return;
  }
  window.appId = COMMS_APP_ID;
  if (!window.db) window.db = firebase.firestore();
  if (!window.auth) window.auth = firebase.auth();
  var auth = window.auth;
  function ready(user) {
    if (!user || window.loggedInUser === user.uid) return;
    window.user = user;
    window.loggedInUser = user.uid;
    commsEnsureUserDoc(user.uid).then(function () {
      commsSetMyId(commsDisplayName());
      if (window.loadUserProfile) window.loadUserProfile();
      if (window.setupGlobalNotifications) window.setupGlobalNotifications();
      if (window.renderServersSidebar) window.renderServersSidebar();
      if (window.renderDMsSidebar) window.renderDMsSidebar();
    });
  }
  if (auth.currentUser) ready(auth.currentUser);
  auth.onAuthStateChanged(function (u) {
    if (u) ready(u);
    else auth.signInAnonymously().catch(function () {});
  });
}

/* Arcade tab-system version of the vault's showComms. */
window.showComms = function () {
  if (window.showTab) window.showTab('comms');
  if (window.renderServersSidebar) window.renderServersSidebar();
  if (window.renderDMsSidebar) window.renderDMsSidebar();
};

/* Bring the user back to an active call (minimized call widget). */
window.restoreCall = function () {
  window.showComms();
  var vv = document.getElementById('comms-voice-view');
  var tv = document.getElementById('comms-text-view');
  if (vv && tv && window.currentChatType === 'voice') {
    tv.style.display = 'none';
    vv.style.display = 'flex';
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', commsBoot);
} else {
  commsBoot();
}


/* ── ported vault comms implementation ── */

window.defaultPfp = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23666'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

window.globalChatListeners = []; window.vaultServersCache = {}; window.userProfilesCache = {};

window.rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    ]
};


window.safeSetText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
window.escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));


window.getUserProfileSummary = async (uid) => {
    if (!uid) return { displayName: '', pfp: window.defaultPfp };
    if (window.userProfilesCache[uid]) return window.userProfilesCache[uid];
    try {
        const doc = await window.db.doc(`artifacts/${window.appId}/public/data/users/${uid}`).get();
        if (doc.exists) {
            window.userProfilesCache[uid] = {
                displayName: doc.data().displayName || doc.id,
                pfp: doc.data().pfp || window.defaultPfp
            };
            return window.userProfilesCache[uid];
        }
    } catch (e) { }
    const fallback = { displayName: uid, pfp: window.defaultPfp };
    window.userProfilesCache[uid] = fallback;
    return fallback;
};


window.customAlert = (msg) => {
    const el = document.getElementById('custom-alert-msg');
    if (el) el.innerText = msg;
    document.getElementById('custom-alert-modal').classList.remove('hidden');
};

window.openCustomConfirm = (title, msg, callback) => {
    document.getElementById('custom-confirm-title').innerText = title;
    document.getElementById('custom-confirm-msg').innerText = msg;
    document.getElementById('custom-confirm-yes').onclick = () => {
        document.getElementById('custom-confirm-modal').classList.add('hidden');
        callback();
    };
    document.getElementById('custom-confirm-modal').classList.remove('hidden');
};

window.loadUserProfile = async () => {
    if (!window.loggedInUser || !window.db) return;
    if (window.userProfileUnsubscribe) window.userProfileUnsubscribe();
    window.userProfileUnsubscribe = window.db.doc(`artifacts/${window.appId}/public/data/users/${window.loggedInUser}`).onSnapshot(snap => {
        if (!snap.exists) return;
        const d = snap.data();
        window.myDMs = d.dms || [];
        window.myServers = d.joined_servers || [];
        window.myRequests = d.friend_requests || [];
        window.myBlockedUsers = d.blocked_users || [];
        window.mySilentBlocks = d.silent_blocks || [];
        window.userProfileData = {
            pfp: d.pfp || window.defaultPfp,
            isPublic: d.isPublic || false,
            displayName: d.displayName || window.loggedInUser,
            isBanned: d.isBanned || false
        };
        const pfpEl = document.getElementById('my-mini-pfp');
        if (pfpEl) { pfpEl.src = window.userProfileData.pfp; pfpEl.classList.toggle('public', window.userProfileData.isPublic); }
        if (window.renderDMsSidebar) window.renderDMsSidebar();
        if (window.renderServersSidebar) window.renderServersSidebar();
        if (window.renderFriendRequests) window.renderFriendRequests();
        if (window.renderBlockedUsersSummary) window.renderBlockedUsersSummary();
        const blockedModal = document.getElementById('blocked-users-modal');
        if (blockedModal && !blockedModal.classList.contains('hidden') && window.renderBlockedUsersList) window.renderBlockedUsersList();

        // Keep notification listeners bound dynamically as arrays change
        if (window.setupGlobalNotifications) window.setupGlobalNotifications();
    });
};

window.openProfileEditor = () => {
    if (!window.userProfileData) return;
    document.getElementById('profile-pfp-preview').src = window.userProfileData.pfp || window.defaultPfp;
    document.getElementById('profile-public-toggle').checked = !!window.userProfileData.isPublic;

    let dnInput = document.getElementById('profile-display-name');
    if (!dnInput) {
        const wrapper = document.createElement('div');
        wrapper.style.marginTop = '20px';
        wrapper.innerHTML = `<input type="text" id="profile-display-name" value="${window.userProfileData.displayName || ''}" style="width:100%;" placeholder="Display Name">`;
        const modal = document.querySelector('#profile-editor-modal .glass-panel');
        const toggle = modal.querySelector('[style*="margin-top:30px"]');
        modal.insertBefore(wrapper, toggle);
        dnInput = document.getElementById('profile-display-name');
    } else {
        dnInput.value = window.userProfileData.displayName || '';
    }
    document.getElementById('profile-editor-modal').classList.remove('hidden');
};

window.handlePfpUpload = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 150; let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } } else { if (h > MAX) { w = w * MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            window.userProfileData.pfp = canvas.toDataURL('image/jpeg', 0.5);
            document.getElementById('profile-pfp-preview').src = window.userProfileData.pfp;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.saveProfileSettings = async () => {
    window.userProfileData.isPublic = document.getElementById('profile-public-toggle').checked;
    const dnEl = document.getElementById('profile-display-name');
    if (dnEl) window.userProfileData.displayName = dnEl.value.trim() || window.loggedInUser;
    document.getElementById('profile-editor-modal').classList.add('hidden');
    const pfpEl = document.getElementById('my-mini-pfp');
    if (pfpEl) { pfpEl.src = window.userProfileData.pfp; pfpEl.classList.toggle('public', window.userProfileData.isPublic); }
    try {
        await window.db.doc(`artifacts/${window.appId}/public/data/users/${window.loggedInUser}`).set({
            pfp: window.userProfileData.pfp, isPublic: window.userProfileData.isPublic, displayName: window.userProfileData.displayName
        }, { merge: true });
    } catch (e) { window.customAlert('Failed to save profile.'); }
};

// ─── FRIEND REQUESTS ─────────────────────────────────────────────────
window.renderFriendRequests = () => {
    const container = document.getElementById('friend-requests-container');
    const title = document.getElementById('friend-req-title');
    if (!container || !title) return;
    if (!window.myRequests || window.myRequests.length === 0) {
        container.style.display = 'none'; title.style.display = 'none'; return;
    }
    container.style.display = 'block'; title.style.display = 'block';
    container.innerHTML = '';
    window.myRequests.forEach(async (req) => {
        const dName = await window.getUserDisplayName(req);
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.4); border-radius:8px; margin-bottom:5px;';
        div.innerHTML = `
                    <span style="color:#c084fc; font-size:0.8rem; font-weight:bold; font-family:'Nasalization';">@${dName}</span>
                    <div style="display:flex; gap:5px;">
                        <button class="magnet-target" onclick="window.acceptFriendRequest('${req}')" style="background:#22c55e; border:none; border-radius:5px; padding:5px 8px; color:white; font-size:0.7rem; cursor:none;">✓</button>
                        <button class="magnet-target" onclick="window.denyFriendRequest('${req}')" style="background:#ef4444; border:none; border-radius:5px; padding:5px 8px; color:white; font-size:0.7rem; cursor:none;">✕</button>
                    </div>`;
        container.appendChild(div);
    });
};

window.acceptFriendRequest = async (fid) => {
    try {
        const myRef = window.db.doc(`artifacts/${window.appId}/public/data/users/${window.loggedInUser}`);
        await myRef.update({ friend_requests: firebase.firestore.FieldValue.arrayRemove(fid), dms: firebase.firestore.FieldValue.arrayUnion(fid) });
        const friendRef = window.db.doc(`artifacts/${window.appId}/public/data/users/${fid}`);
        await friendRef.update({ dms: firebase.firestore.FieldValue.arrayUnion(window.loggedInUser) });
        if (window.setupGlobalNotifications) window.setupGlobalNotifications();
    } catch (e) { window.customAlert('Failed to accept.'); }
};

window.denyFriendRequest = async (fid) => {
    try {
        await window.db.doc(`artifacts/${window.appId}/public/data/users/${window.loggedInUser}`).update({ friend_requests: firebase.firestore.FieldValue.arrayRemove(fid) });
    } catch (e) { }
};

window.getUserDisplayName = async (uid) => {
    if (window.userProfilesCache && window.userProfilesCache[uid]) return window.userProfilesCache[uid].displayName;
    try {
        const doc = await window.db.doc(`artifacts/${window.appId}/public/data/users/${uid}`).get();
        if (doc.exists) {
            window.userProfilesCache[uid] = { displayName: doc.data().displayName || doc.id, pfp: doc.data().pfp || window.defaultPfp };
            return window.userProfilesCache[uid].displayName;
        }
    } catch (e) { }
    return uid;
};

// ─── PUBLIC PROFILES & BLOCKING ──────────────────────────────────────
window.renderBlockedUsersSummary = async () => {
    const summary = document.getElementById('blocked-users-summary');
    if (!summary) return;

    const blocked = [...new Set(window.myBlockedUsers || [])];
    if (!blocked.length) {
        summary.innerText = 'No blocked users.';
        return;
    }

    const previewProfiles = await Promise.all(blocked.slice(0, 3).map(uid => window.getUserProfileSummary(uid)));
    const previewNames = previewProfiles.map(profile => profile.displayName).filter(Boolean);
    const extra = blocked.length > previewNames.length ? ` +${blocked.length - previewNames.length} more` : '';
    summary.innerText = `${blocked.length} blocked user${blocked.length === 1 ? '' : 's'}: ${previewNames.join(', ')}${extra}`;
};

window.renderBlockedUsersList = async () => {
    const list = document.getElementById('blocked-users-list');
    if (!list) return;

    const blocked = [...new Set(window.myBlockedUsers || [])];
    if (!blocked.length) {
        list.innerHTML = '<div class="blocked-user-empty">Nobody is blocked right now.</div>';
        return;
    }

    list.innerHTML = '<div class="blocked-user-empty">Loading blocked users...</div>';
    const profiles = await Promise.all(blocked.map(uid => window.getUserProfileSummary(uid)));
    list.innerHTML = blocked.map((uid, index) => {
        const profile = profiles[index] || { displayName: uid, pfp: window.defaultPfp };
        const blockType = (window.mySilentBlocks || []).includes(uid) ? 'Silent block' : 'Visible block';
        return `
                <div class="blocked-user-card">
                    <div class="blocked-user-meta">
                        <img src="${profile.pfp || window.defaultPfp}" alt="">
                        <div>
                            <div class="blocked-user-name">${window.escapeHtml(profile.displayName || uid)}</div>
                            <div class="blocked-user-hint">@${window.escapeHtml(uid)} | ${blockType}</div>
                        </div>
                    </div>
                    <button class="action-btn btn-purple magnet-target" data-unblock-user="${window.escapeHtml(uid)}" style="padding:8px 14px; font-size:0.72rem;">UNBLOCK</button>
                </div>
            `;
    }).join('');

    list.querySelectorAll('[data-unblock-user]').forEach(btn => {
        btn.addEventListener('click', () => window.unblockUser(btn.getAttribute('data-unblock-user')));
    });
};

window.openBlockedUsersModal = () => {
    document.getElementById('blocked-users-modal').classList.remove('hidden');
    window.renderBlockedUsersList();
};

window.viewPublicProfile = (username, pfpUrl) => {
    document.getElementById('view-profile-pfp').src = pfpUrl || window.defaultPfp;
    document.getElementById('view-profile-name').innerText = username;
    const blockBtn = document.getElementById('block-user-btn');
    const isBlocked = window.myBlockedUsers && window.myBlockedUsers.includes(username);
    blockBtn.innerText = isBlocked ? 'UNBLOCK' : 'BLOCK';
    blockBtn.onclick = isBlocked
        ? () => window.unblockUser(username)
        : () => {
            document.getElementById('public-profile-modal').classList.add('hidden');
            window._tempBlockId = username;
            document.getElementById('block-modal').classList.remove('hidden');
        };
    const adminContainer = document.getElementById('admin-action-container');
    if (adminContainer) {
        adminContainer.innerHTML = window._v && window._v.includes(btoa(window.loggedInUser))
            ? `<button class="action-btn btn-red magnet-target" style="padding:8px 15px; font-size:0.7rem;" onclick="window.banUser('${username}')">BAN</button>
                       <button class="action-btn btn-purple magnet-target" style="padding:8px 15px; font-size:0.7rem;" onclick="window.unbanUser('${username}')">UNBAN</button>`
            : '';
    }
    document.getElementById('public-profile-modal').classList.remove('hidden');
};

window.banUser = async (fid) => {
    try { await window.db.doc(`artifacts/${window.appId}/public/data/users/${fid}`).update({ isBanned: true }); window.customAlert(`${fid} banned.`); document.getElementById('public-profile-modal').classList.add('hidden'); }
    catch (e) { window.customAlert('Failed.'); }
};

window.unbanUser = async (fid) => {
    try { await window.db.doc(`artifacts/${window.appId}/public/data/users/${fid}`).update({ isBanned: false }); window.customAlert(`${fid} unbanned.`); document.getElementById('public-profile-modal').classList.add('hidden'); }
    catch (e) { window.customAlert('Failed.'); }
};

window.executeBlock = async (silent) => {
    const fid = window._tempBlockId;
    if (!fid) return;
    document.getElementById('block-modal').classList.add('hidden');

    if (!window.myBlockedUsers) window.myBlockedUsers = [];
    if (!window.mySilentBlocks) window.mySilentBlocks = [];

    if (!window.myBlockedUsers.includes(fid)) window.myBlockedUsers.push(fid);
    if (silent && !window.mySilentBlocks.includes(fid)) window.mySilentBlocks.push(fid);
    window.myDMs = (window.myDMs || []).filter(id => id !== fid);

    try {
        let updates = {
            blocked_users: firebase.firestore.FieldValue.arrayUnion(fid),
            dms: firebase.firestore.FieldValue.arrayRemove(fid)
        };
        if (silent) updates.silent_blocks = firebase.firestore.FieldValue.arrayUnion(fid);

        await window.db.doc(`artifacts/${window.appId}/public/data/users/${window.loggedInUser}`).update(updates);

        if (window.currentChatType === 'dm' && window.currentChatMeta === fid) {
            window.currentChatChannel = null;
            document.getElementById('comms-input').disabled = true;
            document.getElementById('comms-send-btn').disabled = true;
        }
        if (window.renderBlockedUsersSummary) window.renderBlockedUsersSummary();
        if (window.renderBlockedUsersList) window.renderBlockedUsersList();
        if (window.renderDMsSidebar) window.renderDMsSidebar();
        window.customAlert('User blocked.');
    } catch (e) { window.customAlert('Failed to block.'); }
};

window.unblockUser = async (fid) => {
    if (!fid) return;
    const profileModal = document.getElementById('public-profile-modal');
    if (profileModal) profileModal.classList.add('hidden');
    window.myBlockedUsers = (window.myBlockedUsers || []).filter(id => id !== fid);
    window.mySilentBlocks = (window.mySilentBlocks || []).filter(id => id !== fid);
    try {
        await window.db.doc(`artifacts/${window.appId}/public/data/users/${window.loggedInUser}`).update({
            blocked_users: firebase.firestore.FieldValue.arrayRemove(fid),
            silent_blocks: firebase.firestore.FieldValue.arrayRemove(fid)
        });
        if (window.renderBlockedUsersSummary) window.renderBlockedUsersSummary();
        if (window.renderBlockedUsersList) window.renderBlockedUsersList();
        if (window.renderDMsSidebar) window.renderDMsSidebar();
        window.customAlert('User unblocked.');
    }
    catch (e) { }
};

// ─── AI ──────────────────────────────────────────────────────────────

window.showNotification = (title, sender, contextStr, text, actionHtml, onClickCallback) => {
    const toast = document.getElementById('notification-toast');
    if (!toast) return;
    document.getElementById('notif-title').innerText = title;
    document.getElementById('notif-sender').innerText = sender;

    const ctxEl = document.getElementById('notif-context');
    if (ctxEl) ctxEl.innerText = contextStr || '';

    document.getElementById('notif-text').innerText = text.length > 50 ? text.substring(0, 50) + '...' : text;

    const actContainer = document.getElementById('notif-action-container');
    if (actContainer) {
        if (actionHtml) {
            actContainer.innerHTML = actionHtml;
            actContainer.style.display = 'block';
        } else {
            actContainer.style.display = 'none';
            actContainer.innerHTML = '';
        }
    }

    toast.onclick = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        toast.classList.remove('show');
        if (onClickCallback) onClickCallback();
    };

    toast.classList.add('show');
    const oldTitle = document.title;
    document.title = 'NEW MESSAGE!';
    setTimeout(() => { toast.classList.remove('show'); document.title = oldTitle; }, 5000);
};

window.setupGlobalNotifications = () => {
    if (window.globalChatListeners) window.globalChatListeners.forEach(u => u());
    window.globalChatListeners = [];

    const listenToChannel = (id, title, isDM, serverId, chId, name, chName, banner, creator, type) => {
        const unsub = window.db.collection(`artifacts/${window.appId}/public/data/chat_${id}`)
            .orderBy('timestamp', 'desc').limit(1)
            .onSnapshot(snap => {
                snap.docChanges().forEach(change => {
                    if (change.type !== 'added') return;
                    const m = change.doc.data();
                    if (m.timestamp <= window.loginTime) return;
                    if (m.sender === window.loggedInUser) return;
                    if (window.currentChatChannel === id) return;
                    if (window.myBlockedUsers && window.myBlockedUsers.includes(m.sender)) return;

                    const senderDisplay = window.userProfilesCache[m.sender] ? window.userProfilesCache[m.sender].displayName : m.sender;
                    const safeText = m.text ? m.text.substring(0, 50) : 'Sent an attachment';

                    let actionHtml = null;
                    let textToDisplay = safeText;

                    if (m.text === '[SYSTEM_CALL_INVITE]') {
                        textToDisplay = "Started a Video Call";
                        if (isDM) {
                            actionHtml = `<button class="action-btn btn-purple magnet-target" style="padding:5px 12px; font-size:0.6rem; pointer-events:auto;" onclick="window.openCallPreview('${id}', 'dm_join'); document.getElementById('notification-toast').classList.remove('show'); event.stopPropagation();">JOIN CALL</button>`;
                        }
                    }

                    window.showNotification(
                        title,
                        senderDisplay,
                        !isDM ? ` in ${name}` : '',
                        textToDisplay,
                        actionHtml,
                        () => {
                            if (window.showComms) window.showComms();
                            if (isDM) { if (window.joinChannel) window.joinChannel(id, m.sender); }
                            else { if (window.joinServerChannel) window.joinServerChannel(serverId, chId, name, chName, banner, creator, type); }
                        }
                    );
                });
            });
        window.globalChatListeners.push(unsub);
    };

    // DMs
    (window.myDMs || []).forEach(dm => {
        const dmId = `dm_${[window.loggedInUser, dm].sort().join('_')}`;
        listenToChannel(dmId, 'DM', true);
    });

    // Servers (Text and Voice)
    (window.myServers || []).forEach(async (sid) => {
        try {
            const doc = await window.db.doc(`artifacts/${window.appId}/public/data/channels/${sid}`).get();
            if (!doc.exists) return;
            const data = doc.data();
            (data.channels || [{ id: 'general', name: 'general', type: 'text' }]).forEach(ch => {
                if (!ch.type || ch.type === 'text') {
                    listenToChannel(`server_${sid}_${ch.id}`, `NEW MESSAGE`, false, sid, ch.id, data.name, ch.name, data.banner, data.creator, ch.type);
                } else if (ch.type === 'voice' || ch.type === 'stage') {
                    const vId = `server_${sid}_${ch.id}`;
                    const unsubVoice = window.db.collection(`artifacts/${window.appId}/public/data/voice_rooms/${vId}/participants`)
                        .onSnapshot(snap => {
                            snap.docChanges().forEach(change => {
                                if (change.type === 'added') {
                                    const p = change.doc.data();
                                    if (p.joinedAt <= window.loginTime || change.doc.id === window.loggedInUser) return;
                                    if (ch.type === 'stage' && p.role !== 'speaker') return;
                                    if (window.myBlockedUsers && window.myBlockedUsers.includes(change.doc.id)) return;

                                    const action = `<button class="action-btn btn-purple magnet-target" style="padding:5px 12px; font-size:0.6rem; pointer-events:auto;" onclick="window.showComms(); window.joinServerChannel('${sid}', '${ch.id}', '${data.name.replace(/'/g, "\\'")}', '${ch.name.replace(/'/g, "\\'")}', '${data.banner || ''}', '${data.creator || ''}', '${ch.type}'); document.getElementById('notification-toast').classList.remove('show'); event.stopPropagation();">JOIN NOW</button>`;

                                    window.showNotification(
                                        ch.type === 'stage' ? 'STAGE LIVE' : 'VOICE CHAT',
                                        p.displayName || change.doc.id,
                                        ` in ${data.name} - ${ch.name}`,
                                        ch.type === 'stage' ? 'Is live on stage!' : 'Joined voice channel',
                                        action,
                                        () => { }
                                    );
                                }
                            });
                        });
                    window.globalChatListeners.push(unsubVoice);
                }
            });
        } catch (e) { }
    });
};

// ─── COMMS ───────────────────────────────────────────────────────────
window.renderServersSidebar = async () => {
    const container = document.getElementById('server-list-container');
    if (!container) return;
    const isVip = window._v && window._v.includes(btoa(window.loggedInUser));
    let toRender = [...(window.myServers || [])];

    if (isVip) {
        try {
            const snap = await window.db.collection(`artifacts/${window.appId}/public/data/channels`).get();
            toRender = [];
            snap.forEach(doc => { window.vaultServersCache[doc.id] = doc.data(); toRender.push(doc.id); });
        } catch (e) { }
    }

    if (!toRender.length) { container.innerHTML = '<div style="font-size:0.7rem; color:gray; padding:10px;">No joined servers.</div>'; return; }

    await Promise.all(toRender.map(async id => {
        if (!window.vaultServersCache[id]) {
            try {
                const doc = await window.db.doc(`artifacts/${window.appId}/public/data/channels/${id}`).get();
                if (doc.exists) {
                    window.vaultServersCache[id] = doc.data();
                } else {
                    // Server was deleted, propagate removal
                    window.myServers = window.myServers.filter(s => s !== id);
                    window.db.doc(`artifacts/${window.appId}/public/data/users/${window.loggedInUser}`).update({ joined_servers: firebase.firestore.FieldValue.arrayRemove(id) }).catch(() => { });
                }
            } catch (e) { }
        }
    }));

    let html = '';
    toRender.forEach(id => {
        const data = window.vaultServersCache[id];
        if (!data) return;
        const channels = data.channels || [{ id: 'general', name: 'general', type: 'text' }];
        html += `<div style="margin-bottom:15px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px; padding:5px;">
                        ${data.icon ? `<img src="${data.icon}" style="width:24px; height:24px; border-radius:5px; object-fit:cover;">` : ''}
                        <span style="font-family:'Nasalization'; font-size:0.8rem; color:#fff;">${data.name}</span>
                    </div>`;
        channels.forEach(ch => {
            const active = window.currentChatChannel === `${id}_${ch.id}` ? 'active' : '';
            const icon = ch.type === 'voice' ? '🔊' : ch.type === 'stage' ? '🎤' : '#';
            html += `<div class="comms-channel-btn magnet-target ${active}" style="margin-left:15px; padding:6px 12px;" onclick="window.joinServerChannel('${id}','${ch.id}','${data.name.replace(/'/g, "\\'")}','${ch.name.replace(/'/g, "\\'")}','${data.banner || ''}','${data.creator || ''}','${ch.type || 'text'}')">${icon} ${ch.name}</div>`;
        });
        html += '</div>';
    });
    container.innerHTML = html;
};

window.renderDMsSidebar = async () => {
    const container = document.getElementById('dm-list-container');
    if (!container) return;
    const isVip = window._v && window._v.includes(btoa(window.loggedInUser));
    let dms = [...(window.myDMs || [])];
    if (isVip) {
        try {
            const snap = await window.db.collection(`artifacts/${window.appId}/public/data/users`).get();
            dms = [];
            snap.forEach(doc => { if (doc.id !== window.loggedInUser) dms.push(doc.id); });
        } catch (e) { }
    }
    let html = '';
    for (const dm of dms) {
        if (!window.userProfilesCache[dm]) {
            try {
                const doc = await window.db.doc(`artifacts/${window.appId}/public/data/users/${dm}`).get();
                if (doc.exists) window.userProfilesCache[dm] = { displayName: doc.data().displayName || doc.id, pfp: doc.data().pfp || window.defaultPfp };
            } catch (e) { }
        }
        const dmId = `dm_${[window.loggedInUser, dm].sort().join('_')}`;
        const active = window.currentChatChannel === dmId ? 'active' : '';
        const dn = window.userProfilesCache[dm] ? window.userProfilesCache[dm].displayName : dm;
        html += `<div class="comms-channel-btn magnet-target ${active}" onclick="window.joinChannel('${dmId}','${dm}')">@ ${dn}</div>`;
    }
    container.innerHTML = html;
};

window.openAddFriendBrowser = async () => {
    document.getElementById('friend-id-input').value = '';
    const list = document.getElementById('public-users-list');
    list.innerHTML = '<span style="color:gray;">Scanning public network...</span>';
    document.getElementById('add-friend-modal').classList.remove('hidden');
    try {
        const snap = await window.db.collection(`artifacts/${window.appId}/public/data/users`).get();
        list.innerHTML = '';
        let found = false;
        snap.forEach(doc => {
            const u = doc.data();
            if (!u.isPublic || doc.id === window.loggedInUser || (window.myDMs || []).includes(doc.id)) return;
            found = true;
            const requested = (u.friend_requests || []).includes(window.loggedInUser);
            const div = document.createElement('div');
            div.className = 'browser-item magnet-target';
            div.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="${u.pfp || window.defaultPfp}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; border:2px solid #c084fc;">
                            <div style="font-weight:bold; color:#c084fc; font-family:'Nasalization'; font-size:0.8rem;">@${u.displayName || doc.id}</div>
                        </div>
                        <button class="action-btn btn-purple" style="padding:8px 15px; cursor:none;" ${requested ? 'disabled' : ''} onclick="window.executeSendFriendRequest('${doc.id}')">
                            ${requested ? 'SENT' : 'ADD'}
                        </button>`;
            list.appendChild(div);
        });
        if (!found) list.innerHTML = '<span style="color:gray;">No public users found.</span>';
    } catch (e) { list.innerHTML = '<span style="color:#ef4444;">Failed to scan network.</span>'; }
};

window.executeSendFriendRequest = async (fid) => {
    if (!fid) return;
    fid = fid.trim();
    if (fid === window.loggedInUser) { window.customAlert('You cannot add yourself.'); return; }
    if ((window.myDMs || []).includes(fid)) { window.customAlert('Already friends.'); return; }
    if ((window.myBlockedUsers || []).includes(fid)) { window.customAlert('You have blocked this user.'); return; }
    try {
        const ref = window.db.doc(`artifacts/${window.appId}/public/data/users/${fid}`);
        const snap = await ref.get();
        if (!snap.exists) { window.customAlert('User not found.'); return; }
        if ((snap.data().blocked_users || []).includes(window.loggedInUser)) { window.customAlert('Cannot send request.'); return; }
        await ref.update({ friend_requests: firebase.firestore.FieldValue.arrayUnion(window.loggedInUser) });
        window.customAlert('Friend request sent to ' + fid + '!');
        document.getElementById('add-friend-modal').classList.add('hidden');
    } catch (e) { window.customAlert('Error sending request.'); }
};

window.openServerBrowser = async () => {
    const list = document.getElementById('server-browser-list');
    list.innerHTML = '<span style="color:gray;">Scanning frequencies...</span>';
    document.getElementById('server-browser-modal').classList.remove('hidden');
    try {
        const snap = await window.db.collection(`artifacts/${window.appId}/public/data/channels`).get();
        list.innerHTML = '';
        const isVip = window._v && window._v.includes(btoa(window.loggedInUser));
        if (snap.empty) { list.innerHTML = '<span style="color:gray;">No servers found.</span>'; return; }
        snap.forEach(doc => {
            const id = doc.id; const data = doc.data();
            if (!data.isPublic && !isVip) return;
            window.vaultServersCache[id] = data;
            const joined = (window.myServers || []).includes(id);
            const div = document.createElement('div');
            div.className = 'browser-item magnet-target';
            div.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px;">
                            ${data.icon ? `<img src="${data.icon}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #c084fc;">` : ''}
                            <div>
                                <div style="font-weight:bold; color:#c084fc; font-family:'Nasalization';"># ${data.name}</div>
                                <div style="font-size:0.7rem; color:gray;">${data.isPublic ? 'Public' : 'Private'} — ID: ${id}</div>
                            </div>
                        </div>
                        <div style="display:flex; gap:10px;">
                            ${isVip ? `<button class="action-btn btn-red" style="padding:8px 15px; cursor:none;" onclick="window.deleteServer('${id}')">DEL</button>` : ''}
                            <button class="action-btn btn-purple" style="padding:8px 15px; cursor:none;" ${joined ? 'disabled' : ''} onclick="window.executeJoinServer('${id}')">
                                ${joined ? 'JOINED' : 'JOIN'}
                            </button>
                        </div>`;
            list.appendChild(div);
        });
    } catch (e) { list.innerHTML = '<span style="color:#ef4444;">Failed to fetch servers.</span>'; }
};

window.executeJoinServer = async (id) => {
    if (!id || (window.myServers || []).includes(id)) return;
    try {
        let data = window.vaultServersCache[id];
        if (!data) {
            const doc = await window.db.doc(`artifacts/${window.appId}/public/data/channels/${id}`).get();
            if (!doc.exists) { window.customAlert('Server not found.'); return; }
            data = doc.data(); window.vaultServersCache[id] = data;
        }
        if (!window.myServers) window.myServers = [];
        window.myServers.push(id);
        document.getElementById('server-browser-modal').classList.add('hidden');
        const ch = (data.channels && data.channels.length) ? data.channels[0] : { id: 'general', name: 'general', type: 'text' };
        await window.db.doc(`artifacts/${window.appId}/public/data/users/${window.loggedInUser}`).set({ joined_servers: window.myServers }, { merge: true });
        window.renderServersSidebar();
        window.joinServerChannel(id, ch.id, data.name, ch.name, data.banner, data.creator, ch.type);
    } catch (e) { window.customAlert('Error joining server.'); }
};

window.openCreateServerModal = () => {
    window.serverBannerImage = null; window.serverIconImage = null;
    document.getElementById('server-banner-preview').src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23666'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E";
    document.getElementById('server-icon-preview').src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23666'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
    document.getElementById('create-server-name').value = '';
    const t = document.getElementById('create-server-public-toggle'); if (t) t.checked = true;
    document.getElementById('create-server-modal').classList.remove('hidden');
};

window.handleServerBanner = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 400; let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } } else { if (h > MAX) { w = w * MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            window.serverBannerImage = canvas.toDataURL('image/jpeg', 0.6);
            document.getElementById('server-banner-preview').src = window.serverBannerImage;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.handleServerIcon = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 150; let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } } else { if (h > MAX) { w = w * MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            window.serverIconImage = canvas.toDataURL('image/jpeg', 0.6);
            document.getElementById('server-icon-preview').src = window.serverIconImage;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.finalizeCreateServer = async () => {
    const name = document.getElementById('create-server-name').value.trim();
    if (!name) return;
    const t = document.getElementById('create-server-public-toggle');
    document.getElementById('create-server-modal').classList.add('hidden');
    try {
        const ref = await window.db.collection(`artifacts/${window.appId}/public/data/channels`).add({
            name, banner: window.serverBannerImage || null, icon: window.serverIconImage || null,
            isPublic: t ? t.checked : true,
            channels: [{ id: 'general', name: 'general', type: 'text' }],
            creator: window.loggedInUser, timestamp: Date.now()
        });
        window.executeJoinServer(ref.id);
    } catch (e) { window.customAlert('Failed. Check Firebase setup.'); }
};

// ─── CALL PREVIEW LOGIC ──────────────────────────────────────────────

window.openCallPreview = async (channelId, type) => {
    window._pendingCall = { channelId, type };
    const container = document.getElementById('preview-participants');
    window.clearCallStatus();
    container.innerHTML = '<span style="color:gray; font-size:0.8rem;">Loading participants...</span>';
    document.getElementById('call-preview-modal').classList.remove('hidden');

    try {
        const actualChannelId = (type === 'dm_initiate' || type === 'dm_join') ? channelId : channelId;
        const snap = await window.db.collection(`artifacts/${window.appId}/public/data/voice_rooms/${actualChannelId}/participants`).get();
        if (snap.empty) {
            container.innerHTML = '<span style="color:gray; font-size:0.8rem;">Room is empty. Be the first to join!</span>';
        } else {
            let html = '';
            snap.forEach(doc => {
                const p = doc.data();
                html += `<div style="display:flex; flex-direction:column; align-items:center;">
                                    <img src="${p.pfp}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid #c084fc;">
                                    <span style="font-size:0.6rem; color:#aaa; margin-top:3px; font-family:'Nasalization';">${p.displayName.substring(0, 8)}</span>
                                 </div>`;
            });
            container.innerHTML = html;
        }
    } catch (e) {
        container.innerHTML = '<span style="color:#ef4444; font-size:0.8rem;">Error fetching room.</span>';
        window.setCallStatus('Could not load the current room members. Network rules may be blocking the call preview.', 'error');
    }
};

window.executeJoinCall = (withVideo) => {
    document.getElementById('call-preview-modal').classList.add('hidden');
    window.currentVideoEnabled = withVideo;
    window.setCallStatus(withVideo ? 'Preparing video call...' : 'Preparing voice call...', 'info');

    const pc = window._pendingCall;
    if (!pc) return;

    const actualType = (pc.type === 'dm_initiate' || pc.type === 'dm_join') ? 'dm' : pc.type;

    // Re-set global types just in case
    window.currentVoiceType = actualType;
    window.connectToVoice(pc.channelId);

    // If it's a new DM call, drop the invite into the chat
    if (pc.type === 'dm_initiate') {
        window.db.collection(`artifacts/${window.appId}/public/data/chat_${pc.channelId}`).add({
            sender: window.loggedInUser, text: '[SYSTEM_CALL_INVITE]', timestamp: Date.now(),
            pfp: window.userProfileData.pfp, isPublic: window.userProfileData.isPublic,
            displayName: window.userProfileData.displayName || window.loggedInUser,
        }).catch(() => { });
    }
};

// ─── END CALL PREVIEW LOGIC ──────────────────────────────────────────

window.joinChannel = (id, rawId) => {
    // Only leave voice room if we are jumping into a DIFFERENT voice room explicitly.
    // DMs are text by default, call is initiated via "Start Call" manually.

    if (window.chatUnsubscribe) { window.chatUnsubscribe(); window.chatUnsubscribe = null; }
    window.currentChatChannel = id; window.currentChatType = 'dm'; window.currentChatMeta = rawId;
    const dn = window.userProfilesCache[rawId] ? window.userProfilesCache[rawId].displayName : rawId;
    const cah = document.getElementById('comms-active-header');

    document.getElementById('comms-text-view').style.display = 'flex';
    document.getElementById('comms-voice-view').style.display = 'none';

    if (cah) {
        cah.style.backgroundImage = 'none';
        cah.innerHTML = `
                            <div id="comms-header-overlay" class="comms-header-overlay" style="display:none;"></div>
                            <div id="comms-header-content" class="comms-header-content">
                                <span>@ ${dn}</span>
                                <div style="display:flex; gap:10px;">
                                    <div id="call-btn-container" style="display:flex; gap:10px;">
                                        <button class="action-btn btn-purple magnet-target" style="padding:4px 10px; font-size:0.6rem;" onclick="window.openCallPreview('${id}', 'dm_initiate')">🎥 CALL</button>
                                    </div>
                                    <button class="action-btn btn-cancel magnet-target" style="padding:4px 10px; font-size:0.6rem;" onclick="window.leaveDM('${rawId}')">Leave</button>
                                    <button class="action-btn btn-red magnet-target" style="padding:4px 10px; font-size:0.6rem;" onclick="window.viewPublicProfile('${rawId}')">Block</button>
                                </div>
                            </div>`;
    }

    document.getElementById('comms-input').disabled = false;
    document.getElementById('comms-input').placeholder = "Message...";
    document.getElementById('comms-send-btn').disabled = false;
    window.renderDMsSidebar(); window.renderServersSidebar();

    // Check if they visibly blocked us
    window.db.doc(`artifacts/${window.appId}/public/data/users/${rawId}`).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            if (data.blocked_users && data.blocked_users.includes(window.loggedInUser) && (!data.silent_blocks || !data.silent_blocks.includes(window.loggedInUser))) {
                document.getElementById('comms-input').disabled = true;
                document.getElementById('comms-input').placeholder = "This User Blocked You";
                document.getElementById('comms-send-btn').disabled = true;
            }
        }
    }).catch(() => { });

    if (window.mountChatListener) window.mountChatListener(id);
};

window.joinServerChannel = (serverId, channelId, serverName, channelName, banner, creator, type) => {
    const finalId = `server_${serverId}_${channelId}`;

    // Only disconnect if switching to a DIFFERENT voice room
    if ((type === 'voice' || type === 'stage') && window._currentVoiceRoomRef && window._currentVoiceRoomRef.id !== finalId) {
        window.leaveVoiceRoom();
    }

    if (window.chatUnsubscribe) { window.chatUnsubscribe(); window.chatUnsubscribe = null; }

    window.currentChatChannel = finalId; window.currentChatType = type; window.currentChatMeta = serverId;
    window.currentVoiceCreator = creator;
    window.currentVoiceType = type;

    const isVip = window._v && window._v.includes(btoa(window.loggedInUser));
    const isCreator = creator === window.loggedInUser || isVip;
    const actionHtml = isCreator
        ? `<button class="action-btn btn-purple magnet-target" style="padding:4px 10px; font-size:0.6rem;" onclick="window.openAddChannelModal('${serverId}')">+ Channel</button>
                           <button class="action-btn btn-red magnet-target" style="padding:4px 10px; font-size:0.6rem;" onclick="window.deleteServer('${serverId}')">Delete</button>`
        : `<button class="action-btn btn-cancel magnet-target" style="padding:4px 10px; font-size:0.6rem;" onclick="window.leaveServer('${serverId}')">Leave</button>`;

    const typeIcon = type === 'voice' ? '🔊' : type === 'stage' ? '🎤' : '#';
    const cah = document.getElementById('comms-active-header');

    if (cah) {
        if (banner && banner !== 'undefined') { cah.style.backgroundImage = `url('${banner}')`; document.getElementById('comms-header-overlay').style.display = 'block'; }
        else { cah.style.backgroundImage = 'none'; document.getElementById('comms-header-overlay').style.display = 'none'; }
        document.getElementById('comms-header-content').innerHTML = `
                            <span style="display:flex; align-items:center; gap:10px;">
                                ${banner && banner !== 'undefined' ? `<img src="${banner}" style="width:25px; height:25px; border-radius:5px; object-fit:cover;">` : ''}
                                ${serverName} <span style="color:gray; margin:0 5px;">></span> ${typeIcon} ${channelName}
                            </span>
                            <div style="display:flex; gap:10px;"><div id="call-btn-container" style="display:flex; gap:10px;"></div>${actionHtml}</div>`;
    }

    if (type === 'voice' || type === 'stage') {
        document.getElementById('comms-text-view').style.display = 'none';
        document.getElementById('comms-voice-view').style.display = 'flex';
        document.getElementById('voice-title').innerText = type === 'stage' ? 'STAGE: ' + channelName : 'VOICE: ' + channelName;

        document.getElementById('btn-connect-voice').style.display = 'inline-block';
        document.getElementById('stage-controls').style.display = 'none';
        document.getElementById('stage-admin-panel').style.display = 'none';
        document.getElementById('voice-participants-grid').innerHTML = '';
    } else {
        document.getElementById('comms-text-view').style.display = 'flex';
        document.getElementById('comms-voice-view').style.display = 'none';
        document.getElementById('comms-input').disabled = false;
        document.getElementById('comms-input').placeholder = "Message...";
        document.getElementById('comms-send-btn').disabled = false;
        if (window.mountChatListener) window.mountChatListener(finalId);
    }

    window.renderServersSidebar(); window.renderDMsSidebar();
};

window.openAddChannelModal = (serverId) => {
    window._tempServerIdForChannel = serverId;
    document.getElementById('add-channel-input').value = '';
    document.getElementById('add-channel-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('add-channel-input').focus(), 100);
};

window.submitAddChannel = async () => {
    const val = document.getElementById('add-channel-input').value.trim();
    const sid = window._tempServerIdForChannel;
    const typeEl = document.getElementById('add-channel-type');
    if (!val || !sid) return;
    document.getElementById('add-channel-modal').classList.add('hidden');
    const newCh = { id: val.toLowerCase().replace(/\s+/g, '-'), name: val, type: typeEl ? typeEl.value : 'text' };
    try {
        await window.db.doc(`artifacts/${window.appId}/public/data/channels/${sid}`).update({ channels: firebase.firestore.FieldValue.arrayUnion(newCh) });
        const doc = await window.db.doc(`artifacts/${window.appId}/public/data/channels/${sid}`).get();
        if (doc.exists) window.vaultServersCache[sid] = doc.data();
        window.renderServersSidebar();
    } catch (e) { window.customAlert('Error adding channel.'); }
};

const _clearChannelUI = () => {
    window.currentChatChannel = null;
    const cah = document.getElementById('comms-active-header');
    if (cah) { cah.style.backgroundImage = 'none'; cah.innerHTML = "<div id='comms-header-overlay' class='comms-header-overlay' style='display:none;'></div><div id='comms-header-content' class='comms-header-content'><span style='color:gray;'># select-a-channel</span></div>"; }
    const log = document.getElementById('comms-chat-log'); if (log) log.innerHTML = '';
    document.getElementById('comms-input').disabled = true;
    document.getElementById('comms-send-btn').disabled = true;
    document.getElementById('comms-text-view').style.display = 'flex';
    document.getElementById('comms-voice-view').style.display = 'none';
};

window.leaveServer = (sid) => {
    window.openCustomConfirm('LEAVE SERVER', 'Leave this server?', async () => {
        window.myServers = (window.myServers || []).filter(id => id !== sid);
        if (window.currentChatType === 'server' && window.currentChatMeta === sid) _clearChannelUI();
        window.renderServersSidebar();
        try { await window.db.doc(`artifacts/${window.appId}/public/data/users/${window.loggedInUser}`).update({ joined_servers: firebase.firestore.FieldValue.arrayRemove(sid) }); } catch (e) { }
    });
};

window.deleteServer = (sid) => {
    window.openCustomConfirm('DELETE SERVER', 'Permanently delete this server?', async () => {
        window.myServers = (window.myServers || []).filter(id => id !== sid);
        if (window.currentChatType === 'server' && window.currentChatMeta === sid) _clearChannelUI();
        window.renderServersSidebar();
        try {
            await window.db.doc(`artifacts/${window.appId}/public/data/channels/${sid}`).delete();
            await window.db.doc(`artifacts/${window.appId}/public/data/users/${window.loggedInUser}`).update({ joined_servers: firebase.firestore.FieldValue.arrayRemove(sid) });
        } catch (e) { }
    });
};

window.leaveDM = (fid) => {
    window.openCustomConfirm('LEAVE DM', 'Close this DM?', async () => {
        window.myDMs = (window.myDMs || []).filter(id => id !== fid);
        if (window.currentChatType === 'dm' && window.currentChatMeta === fid) _clearChannelUI();
        window.renderDMsSidebar();
        try { await window.db.doc(`artifacts/${window.appId}/public/data/users/${window.loggedInUser}`).update({ dms: firebase.firestore.FieldValue.arrayRemove(fid) }); } catch (e) { }
    });
};

window.deleteMessage = async (channelId, msgId) => {
    try { await window.db.doc(`artifacts/${window.appId}/public/data/chat_${channelId}/${msgId}`).delete(); } catch (e) { }
};

window.handleCommsImageSelect = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX = 400; let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } } else { if (h > MAX) { w = w * MAX / h; h = MAX; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            window.commsPendingImage = canvas.toDataURL('image/jpeg', 0.6);
            document.getElementById('comms-img-preview').src = window.commsPendingImage;
            document.getElementById('comms-img-preview-container').style.display = 'block';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.clearCommsImage = () => {
    window.commsPendingImage = null;
    document.getElementById('comms-img-preview-container').style.display = 'none';
    document.getElementById('comms-file-upload').value = '';
};

window.sendCommsMessage = async () => {
    if (!window.currentChatChannel) return;
    if (window.userProfileData.isBanned) { window.customAlert('You are banned from sending messages.'); return; }

    const input = document.getElementById('comms-input');
    const text = input.value.trim();
    if (!text && !window.commsPendingImage) return;
    if (Date.now() - window.lastCommsMsgTime < 1500) { window.customAlert('Anti-spam: please wait a moment.'); return; }
    if (text.length > 1000 || text.split(' ').some(w => w.length > 100)) { window.customAlert('Message too long or contains very long words.'); return; }
    window.lastCommsMsgTime = Date.now();
    const img = window.commsPendingImage;
    window.clearCommsImage();
    input.value = '';
    try {
        await window.db.collection(`artifacts/${window.appId}/public/data/chat_${window.currentChatChannel}`).add({
            sender: window.loggedInUser, text, image: img || null, timestamp: Date.now(),
            pfp: window.userProfileData.pfp, isPublic: window.userProfileData.isPublic,
            displayName: window.userProfileData.displayName || window.loggedInUser,
            readBy: [window.loggedInUser]
        });
    } catch (e) { window.customAlert('Failed to send message.'); }
};

window.requestChatRender = () => {
    if (window._chatRenderQueued) return;
    window._chatRenderQueued = true;
    requestAnimationFrame(() => {
        window._chatRenderQueued = false;
        if (window.renderCurrentChatLog) window.renderCurrentChatLog();
    });
};

window.renderCurrentChatLog = () => {
    const log = document.getElementById('comms-chat-log');
    if (!log) return;
    const msgs = window.currentChatMessages || [];
    const isVip = window._v && window._v.includes(btoa(window.loggedInUser));
    const shouldScroll = log.scrollHeight - log.scrollTop - log.clientHeight < 80;

    if (!msgs.length) { log.innerHTML = '<div style="margin:auto; color:gray;">Chat empty.</div>'; return; }

    log.innerHTML = msgs.map(m => {
        if ((window.myBlockedUsers || []).includes(m.sender)) return '';
        if (!window.userProfilesCache[m.sender]) {
            window.userProfilesCache[m.sender] = { displayName: m.displayName || m.sender, pfp: m.pfp || window.defaultPfp };
            window.db.doc(`artifacts/${window.appId}/public/data/users/${m.sender}`).get().then(doc => {
                if (doc.exists) {
                    window.userProfilesCache[m.sender] = { displayName: doc.data().displayName || doc.id, pfp: doc.data().pfp || window.defaultPfp };
                    window.requestChatRender();
                }
            }).catch(() => { });
        }
        const profile = window.userProfilesCache[m.sender];
        let safeText = m.text || '';
        if (safeText.length > 1000 || safeText.split(' ').some(w => w.length > 100)) safeText = '[Message removed: too long]';

        const readBy = m.readBy || [];
        const isVisible = document.visibilityState === 'visible';
        const cp = document.getElementById('comms-page');
        const isCommsOpen = cp && !cp.classList.contains('hidden');
        if (isVisible && isCommsOpen && !readBy.includes(window.loggedInUser)) {
            window.db.collection(`artifacts/${window.appId}/public/data/chat_${window.currentChatChannel}`).doc(m.id).update({ readBy: firebase.firestore.FieldValue.arrayUnion(window.loggedInUser) }).catch(() => { });
        }

        const isMe = m.sender === window.loggedInUser;
        const avatarClass = m.isPublic ? 'chat-avatar public-click magnet-target' : 'chat-avatar';
        const avatarClick = m.isPublic ? `onclick="window.viewPublicProfile('${m.sender}','${profile.pfp}')"` : '';

        let msgContent = '';
        if (m.image) msgContent += `<img src="${m.image}" style="max-width:250px; border-radius:10px; margin-bottom:5px; display:block; border:2px solid rgba(255,255,255,0.1);">`;

        if (safeText === '[SYSTEM_CALL_INVITE]') {
            msgContent += `<span style="display:block; margin-bottom:5px; font-weight:bold; color:#c084fc;">Video Call Invite</span>
                                           <button class="action-btn btn-purple magnet-target" style="padding:6px 15px; font-size:0.7rem;" onclick="window.openCallPreview('${window.currentChatChannel}', 'dm_join')">JOIN CALL</button>`;
        } else if (safeText === '[SYSTEM_CALL_ENDED]') {
            msgContent += `<span style="display:block; margin-bottom:5px; font-weight:bold; color:gray;">Video Call Ended</span>
                                           <button class="action-btn btn-cancel" style="padding:6px 15px; font-size:0.7rem;" disabled>INVALID</button>`;
        } else if (safeText) {
            msgContent += `<span>${safeText}</span>`;
        }

        let readHtml = '';
        if (isMe) {
            const others = readBy.filter(u => u !== window.loggedInUser);
            if (others.length) {
                if (window.currentChatType === 'dm') { readHtml = '<div style="font-size:0.6rem; color:#4ade80; text-align:right; margin-top:2px;">Read</div>'; }
                else { const names = others.map(o => window.userProfilesCache[o] ? window.userProfilesCache[o].displayName : o).join(', '); readHtml = `<div style="font-size:0.6rem; color:#4ade80; text-align:right; margin-top:2px;">Read by: ${names}</div>`; }
            }
        }
        const delBtn = isVip ? `<button class="chat-delete-btn magnet-target" onclick="window.deleteMessage('${window.currentChatChannel}','${m.id}')">🗑</button>` : '';

        return `<div style="margin-bottom:15px; width:100%; display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'};">
                            <div style="display:flex; align-items:flex-end; gap:10px; flex-direction:${isMe ? 'row-reverse' : 'row'}; max-width:80%;">
                                <img src="${profile.pfp}" class="${avatarClass}" ${avatarClick} style="width:30px; height:30px; border-radius:50%; border:1px solid #555;">
                                <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; max-width:100%;">
                                    <div style="display:flex; gap:8px; align-items:baseline; margin-bottom:4px;">
                                        <span style="font-size:0.65rem; color:gray; font-family:'Nasalization';">${profile.displayName}</span>
                                        <span style="font-size:0.55rem; color:rgba(255,255,255,0.2);">${formatTime(m.timestamp)}</span>
                                        ${delBtn}
                                    </div>
                                    <div class="ai-msg ${isMe ? 'user-msg' : 'bot-msg'}">${msgContent}</div>
                                    ${readHtml}
                                </div>
                            </div>
                        </div>`;
    }).join('');

    if (shouldScroll) log.scrollTop = log.scrollHeight;
};

window.mountChatListener = (id) => {
    const log = document.getElementById('comms-chat-log');
    if (log) log.innerHTML = '<div style="margin:auto; color:gray;">Syncing...</div>';
    if (window.chatUnsubscribe) { window.chatUnsubscribe(); window.chatUnsubscribe = null; }
    window.chatUnsubscribe = window.db.collection(`artifacts/${window.appId}/public/data/chat_${id}`).onSnapshot(snap => {
        window.currentChatMessages = [];
        snap.forEach(doc => window.currentChatMessages.push({ id: doc.id, ...doc.data() }));
        window.currentChatMessages.sort((a, b) => a.timestamp - b.timestamp);
        window.requestChatRender();
    }, () => {
        if (log) log.innerHTML = '<div style="margin:auto; color:#ef4444;">DB rules blocked this channel.</div>';
    });
};

// ─── WEBRTC SIGNALING & VOICE LOGIC ──────────────────────────────────

window.setCallStatus = (message, tone = 'info') => {
    ['voice-join-status', 'call-preview-status'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (!message) {
            el.classList.add('hidden');
            el.removeAttribute('data-tone');
            el.innerText = '';
            return;
        }
        el.innerText = message;
        el.setAttribute('data-tone', tone);
        el.classList.remove('hidden');
    });
    const globalStatus = document.getElementById('global-call-status');
    if (globalStatus) globalStatus.innerText = message || 'Standby';
};

window.clearCallStatus = () => {
    window.setCallStatus('');
    const globalStatus = document.getElementById('global-call-status');
    if (globalStatus) globalStatus.innerText = 'Standby';
};

window.describeCallError = (error, stage = 'media') => {
    const code = error && error.name ? ` (${error.name})` : '';
    if (stage === 'signal') return `Call signaling failed. Network rules or school policy may be blocking realtime traffic${code}.`;
    if (stage === 'peer') return `The peer connection failed after joining. School filtering may be blocking WebRTC${code}.`;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'This browser or device policy does not allow microphone/camera access.';
    switch (error && error.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
            return `Microphone or camera permission was denied${code}.`;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
            return `No usable microphone or camera was found on this device${code}.`;
        case 'NotReadableError':
        case 'TrackStartError':
            return `The microphone or camera is busy or blocked by another app${code}.`;
        case 'SecurityError':
            return `The browser blocked media access for security or policy reasons${code}.`;
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
            return `This device cannot satisfy the requested audio/video settings${code}.`;
        case 'AbortError':
            return `Media startup was interrupted before the device opened${code}.`;
        default:
            return `The call could not start cleanly${code}.`;
    }
};

window.connectToVoice = async (overrideId) => {
    const channelId = overrideId || window.currentChatChannel;
    const type = window.currentVoiceType;
    const creatorId = window.currentVoiceCreator;

    window.leaveVoiceRoom(); // Clean previous connection
    window.voiceJoinTime = Date.now();

    const isVip = window._v && window._v.includes(btoa(window.loggedInUser));
    const isCreator = window.loggedInUser === creatorId || isVip;
    window.myStageRole = (type === 'stage' && !isCreator) ? 'audience' : 'speaker';
    window.handRaised = false;
    window._previousSpeakerCount = 0;
    let joinStatus = window.currentVideoEnabled ? 'Connecting to video call...' : 'Connecting to voice call...';
    window.setCallStatus(joinStatus, 'info');

    try {
        window.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: window.currentVideoEnabled });
        if (window.myStageRole === 'audience') {
            window.localStream.getAudioTracks().forEach(t => t.enabled = false);
        }
    } catch (e) {
        window.localStream = null;
        joinStatus = `${window.describeCallError(e)} Joining in listen-only mode.`;
        window.setCallStatus(joinStatus, 'warn');
        window.customAlert(joinStatus);
    }

    // Show global bar
    const gb = document.getElementById('global-call-bar');
    gb.classList.remove('hidden');
    setTimeout(() => gb.classList.add('active'), 50);

    if (type !== 'dm') {
        document.getElementById('btn-connect-voice').style.display = 'none';
        if (type === 'stage') {
            document.getElementById('stage-controls').style.display = 'flex';
            window.updateStageButtons();
        }
    }

    if (window.localStream) {
        const localVid = document.getElementById('local-video');
        localVid.srcObject = window.localStream;
        localVid.style.display = window.currentVideoEnabled ? 'block' : 'none';
    }

    const roomRef = window.db.collection(`artifacts/${window.appId}/public/data/voice_rooms`).doc(channelId);
    window._currentVoiceRoomRef = roomRef;
    const myPartRef = roomRef.collection('participants').doc(window.loggedInUser);

    try {
        await myPartRef.set({
            joinedAt: window.voiceJoinTime,
            role: window.myStageRole,
            handRaised: false,
            displayName: window.userProfileData.displayName || window.loggedInUser,
            pfp: window.userProfileData.pfp || window.defaultPfp
        });
    } catch (e) {
        window.setCallStatus('Could not join the call room. Database or network rules blocked the connection.', 'error');
        if (window.localStream) {
            window.localStream.getTracks().forEach(t => t.stop());
            window.localStream = null;
        }
        const localVid = document.getElementById('local-video');
        if (localVid) {
            localVid.srcObject = null;
            localVid.style.display = 'none';
        }
        gb.classList.remove('active');
        gb.classList.add('hidden');
        return;
    }

    if (window.localStream) {
        if (type === 'stage' && window.myStageRole === 'audience') joinStatus = 'Joined the stage as a listener. Raise your hand to speak.';
        else joinStatus = window.currentVideoEnabled ? 'Video call connected.' : 'Voice call connected.';
        window.setCallStatus(joinStatus, 'success');
    }

    window.voiceParticipants = {};

    // Listen to Participants
    window.voiceRoomUnsubscribe = roomRef.collection('participants').onSnapshot(snap => {
        snap.docChanges().forEach(change => {
            const peerId = change.doc.id;
            const data = change.doc.data();

            if (change.type === 'removed') {
                delete window.voiceParticipants[peerId];
                window.closePeer(peerId);
            } else {
                window.voiceParticipants[peerId] = data;
                if (peerId === window.loggedInUser) {
                    if (type === 'stage' && data.role === 'speaker' && window.myStageRole === 'audience') {
                        window.myStageRole = 'speaker';
                        window.handRaised = false;
                        if (window.localStream) window.localStream.getAudioTracks().forEach(t => t.enabled = true);
                        window.updateStageButtons();
                        window.customAlert('You are now a speaker!');
                    }
                } else if (change.type === 'added' && data.joinedAt) {
                    const remoteJoinTime = data.joinedAt || 0;
                    if (remoteJoinTime < window.voiceJoinTime || (remoteJoinTime === window.voiceJoinTime && peerId < window.loggedInUser)) {
                        window.createOffer(channelId, peerId, type);
                    }
                }
            }
        });

        if (type !== 'dm') window.renderVoiceParticipants();
        if (type === 'stage' && window.myStageRole === 'speaker') window.renderStageAdmin(snap);

        if (type === 'stage') {
            const currentSpeakers = Object.values(window.voiceParticipants).filter(p => p.role === 'speaker').length;
            if (window._previousSpeakerCount > 0 && currentSpeakers === 0) {
                window.leaveVoiceRoom();
                window.customAlert('Notice: The Stage Has Ended');
            }
            window._previousSpeakerCount = currentSpeakers;
        }
    });

    window.signalsUnsubscribe = roomRef.collection('signals').onSnapshot(snap => {
        snap.docChanges().forEach(change => {
            if (change.type === 'added') {
                const data = change.doc.data();
                if (data.target === window.loggedInUser && data.timestamp >= window.voiceJoinTime) {
                    if (data.type === 'offer') window.handleOffer(channelId, data.sender, data.sdp, type);
                    else if (data.type === 'answer') window.handleAnswer(data.sender, data.sdp);
                    else if (data.type === 'ice') window.handleIce(data.sender, data.candidate);
                }
            }
        });
    }, err => {
        console.error("Signaling error:", err);
        const status = window.describeCallError(err, 'signal');
        window.setCallStatus(status, 'error');
    });
};

window.createPeerConnection = (targetUid, channelId, type) => {
    if (window.peerConnections[targetUid]) return window.peerConnections[targetUid];
    const pc = new RTCPeerConnection(window.rtcConfig);
    window.peerConnections[targetUid] = pc;

    if (window.localStream) {
        window.localStream.getTracks().forEach(t => pc.addTrack(t, window.localStream));
    }

    pc.onicecandidate = (e) => {
        if (e.candidate) {
            window.db.collection(`artifacts/${window.appId}/public/data/voice_rooms/${channelId}/signals`).add({
                sender: window.loggedInUser, target: targetUid, type: 'ice', candidate: JSON.stringify(e.candidate), timestamp: Date.now()
            }).catch(() => { });
        }
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            window.setCallStatus(window.describeCallError({ name: pc.connectionState }, 'peer'), 'error');
        }
    };

    pc.ontrack = (e) => {
        let audioEl = document.getElementById('audio_' + targetUid);
        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = 'audio_' + targetUid;
            audioEl.autoplay = true;
            document.getElementById('audio-elements-container').appendChild(audioEl);
        }
        audioEl.srcObject = e.streams[0];

        let rv = document.getElementById('remote-video-' + targetUid);
        if (!rv) {
            rv = document.createElement('video');
            rv.id = 'remote-video-' + targetUid;
            rv.autoplay = true;
            rv.playsInline = true;
            rv.style.cssText = "height:50px; width:70px; border-radius:8px; border:2px solid #c084fc; object-fit:cover; display:none;";
            document.getElementById('remote-videos-container').appendChild(rv);
        }
        rv.srcObject = e.streams[0];

        // Show video element if a video track exists
        e.streams[0].onaddtrack = () => {
            if (e.streams[0].getVideoTracks().length > 0) rv.style.display = 'block';
        };
        if (e.streams[0].getVideoTracks().length > 0) rv.style.display = 'block';
    };

    return pc;
};

window.createOffer = async (channelId, targetUid, type) => {
    try {
        const pc = window.createPeerConnection(targetUid, channelId, type);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await window.db.collection(`artifacts/${window.appId}/public/data/voice_rooms/${channelId}/signals`).add({
            sender: window.loggedInUser, target: targetUid, type: 'offer', sdp: JSON.stringify(offer), timestamp: Date.now()
        });
    } catch (e) { window.setCallStatus(window.describeCallError(e, 'peer'), 'error'); }
};

window.handleOffer = async (channelId, senderUid, sdpStr, type) => {
    try {
        const pc = window.createPeerConnection(senderUid, channelId, type);
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdpStr)));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await window.db.collection(`artifacts/${window.appId}/public/data/voice_rooms/${channelId}/signals`).add({
            sender: window.loggedInUser, target: senderUid, type: 'answer', sdp: JSON.stringify(answer), timestamp: Date.now()
        });
        window.processIceQueue(senderUid);
    } catch (e) { window.setCallStatus(window.describeCallError(e, 'peer'), 'error'); }
};

window.handleAnswer = async (senderUid, sdpStr) => {
    try {
        const pc = window.peerConnections[senderUid];
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sdpStr)));
            window.processIceQueue(senderUid);
        }
    } catch (e) { window.setCallStatus(window.describeCallError(e, 'peer'), 'error'); }
};

window.handleIce = async (senderUid, candidateStr) => {
    try {
        const pc = window.peerConnections[senderUid];
        if (pc) {
            const rtcCand = new RTCIceCandidate(JSON.parse(candidateStr));
            if (pc.remoteDescription) {
                await pc.addIceCandidate(rtcCand).catch(() => { });
            } else {
                window.iceCandidateQueue[senderUid] = window.iceCandidateQueue[senderUid] || [];
                window.iceCandidateQueue[senderUid].push(rtcCand);
            }
        }
    } catch (e) { window.setCallStatus(window.describeCallError(e, 'peer'), 'error'); }
};

window.processIceQueue = async (uid) => {
    const pc = window.peerConnections[uid];
    if (pc && window.iceCandidateQueue[uid]) {
        for (const cand of window.iceCandidateQueue[uid]) {
            await pc.addIceCandidate(cand).catch(() => { });
        }
        window.iceCandidateQueue[uid] = [];
    }
};

window.closePeer = (uid) => {
    if (window.peerConnections[uid]) {
        window.peerConnections[uid].close();
        delete window.peerConnections[uid];
    }
    const a = document.getElementById('audio_' + uid);
    if (a) a.remove();
    const v = document.getElementById('remote-video-' + uid);
    if (v) v.remove();
};

window.hangUp = async () => {
    const currentChannel = window._currentVoiceRoomRef ? window._currentVoiceRoomRef.id : null;
    const currentType = window.currentVoiceType;
    window.leaveVoiceRoom();

    // Invalidate DM call invites when hanging up
    if (currentType === 'dm' && currentChannel) {
        try {
            const snap = await window.db.collection(`artifacts/${window.appId}/public/data/chat_${currentChannel}`)
                .where('text', '==', '[SYSTEM_CALL_INVITE]')
                .get();
            snap.forEach(doc => {
                doc.ref.update({ text: '[SYSTEM_CALL_ENDED]' });
            });
        } catch (e) { }
    }
};

window.leaveVoiceRoom = () => {
    if (window.voiceRoomUnsubscribe) { window.voiceRoomUnsubscribe(); window.voiceRoomUnsubscribe = null; }
    if (window.signalsUnsubscribe) { window.signalsUnsubscribe(); window.signalsUnsubscribe = null; }

    if (window._currentVoiceRoomRef && window.loggedInUser) {
        window._currentVoiceRoomRef.collection('participants').doc(window.loggedInUser).delete().catch(() => { });
        window._currentVoiceRoomRef = null;
    }

    Object.keys(window.peerConnections).forEach(id => window.closePeer(id));
    window.peerConnections = {};
    window.voiceParticipants = {};
    window.iceCandidateQueue = {};

    if (window.localStream) {
        window.localStream.getTracks().forEach(t => t.stop());
        window.localStream = null;
    }

    document.getElementById('audio-elements-container').innerHTML = '';
    document.getElementById('remote-videos-container').innerHTML = '';
    const localVideo = document.getElementById('local-video');
    if (localVideo) {
        localVideo.srcObject = null;
        localVideo.style.display = 'none';
    }

    const gb = document.getElementById('global-call-bar');
    if (gb) {
        gb.classList.remove('active');
        setTimeout(() => gb.classList.add('hidden'), 400);
    }

    const btnConn = document.getElementById('btn-connect-voice');
    if (btnConn) btnConn.style.display = 'inline-block';

    const grid = document.getElementById('voice-participants-grid');
    if (grid) grid.innerHTML = '';
    const stageCtrls = document.getElementById('stage-controls');
    if (stageCtrls) stageCtrls.style.display = 'none';
    const adminPanel = document.getElementById('stage-admin-panel');
    if (adminPanel) adminPanel.style.display = 'none';
    window.clearCallStatus();
};

// ─── STAGE UI & CONTROLS ─────────────────────────────────────────────
window.updateStageButtons = () => {
    const raiseBtn = document.getElementById('btn-raise-hand');
    const stepBtn = document.getElementById('btn-step-down');
    const adminPanel = document.getElementById('stage-admin-panel');

    const isVip = window._v && window._v.includes(btoa(window.loggedInUser));
    const isCreator = window.loggedInUser === window.currentVoiceCreator || isVip;

    if (window.myStageRole === 'audience') {
        raiseBtn.style.display = 'inline-block';
        stepBtn.style.display = 'none';
        adminPanel.style.display = 'none';
        raiseBtn.innerText = window.handRaised ? '✋ LOWER HAND' : '✋ RAISE HAND';
    } else {
        raiseBtn.style.display = 'none';
        if (!isCreator) {
            stepBtn.style.display = 'inline-block';
        } else {
            stepBtn.style.display = 'none';
        }
        adminPanel.style.display = 'block';
    }
};

window.toggleHand = async () => {
    if (!window._currentVoiceRoomRef) return;
    window.handRaised = !window.handRaised;
    await window._currentVoiceRoomRef.collection('participants').doc(window.loggedInUser).update({ handRaised: window.handRaised });
    window.updateStageButtons();
};

window.stepDown = async () => {
    if (!window._currentVoiceRoomRef) return;
    await window._currentVoiceRoomRef.collection('participants').doc(window.loggedInUser).update({ role: 'audience', handRaised: false });
    if (window.localStream) window.localStream.getAudioTracks().forEach(t => t.enabled = false);
    window.myStageRole = 'audience';
    window.updateStageButtons();
};

window.bringUpToStage = async (uid) => {
    if (!window._currentVoiceRoomRef) return;
    await window._currentVoiceRoomRef.collection('participants').doc(uid).update({ role: 'speaker', handRaised: false });
};

window.renderVoiceParticipants = () => {
    const grid = document.getElementById('voice-participants-grid');
    if (!grid) return;
    let html = '';
    const type = window.currentVoiceType;

    const renderUser = (id, p) => {
        const isMe = id === window.loggedInUser;
        const micIcon = p.role === 'audience' ? '<span style="color:#ef4444; font-size:0.6rem;">🔇</span>' : '<span style="color:#4ade80; font-size:0.6rem;">🎙️</span>';
        const hand = p.handRaised ? '<span style="position:absolute; top:-10px; right:-10px; font-size:1.5rem; animation:pulse-dot-anim 1s infinite alternate;">✋</span>' : '';
        const border = isMe ? 'border-color:#4ade80;' : (p.role === 'speaker' ? 'border-color:#c084fc;' : 'border-color:#555;');
        return `
                            <div style="display:flex; flex-direction:column; align-items:center; position:relative; width:80px;">
                                ${hand}
                                <img src="${p.pfp}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid transparent; ${border} margin-bottom:5px;">
                                <span style="font-size:0.7rem; font-family:'Nasalization'; color:#fff; text-align:center; word-break:break-all;">${p.displayName}</span>
                                ${type === 'stage' ? micIcon : ''}
                            </div>`;
    };

    if (type === 'stage') {
        html += '<div style="width:100%; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:10px; padding-bottom:5px; color:#c084fc; font-family:\'Nasalization\'; text-align:center;">SPEAKERS</div>';
        html += '<div style="display:flex; flex-wrap:wrap; gap:15px; justify-content:center; width:100%; margin-bottom:20px;">';
        Object.keys(window.voiceParticipants).forEach(id => { if (window.voiceParticipants[id].role === 'speaker') html += renderUser(id, window.voiceParticipants[id]); });
        html += '</div>';

        html += '<div style="width:100%; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:10px; padding-bottom:5px; color:gray; font-family:\'Nasalization\'; text-align:center;">AUDIENCE</div>';
        html += '<div style="display:flex; flex-wrap:wrap; gap:15px; justify-content:center; width:100%;">';
        Object.keys(window.voiceParticipants).forEach(id => { if (window.voiceParticipants[id].role === 'audience') html += renderUser(id, window.voiceParticipants[id]); });
        html += '</div>';
    } else {
        Object.keys(window.voiceParticipants).forEach(id => { html += renderUser(id, window.voiceParticipants[id]); });
    }
    grid.innerHTML = html;
};

window.renderStageAdmin = (snap) => {
    const list = document.getElementById('raised-hands-list');
    if (!list) return;
    let html = '';
    snap.forEach(doc => {
        const p = doc.data();
        if (p.handRaised && p.role === 'audience') {
            html += `
                                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 15px; border-radius:8px;">
                                    <span style="font-family:'Inter'; font-size:0.8rem;"><img src="${p.pfp}" style="width:20px; height:20px; border-radius:50%; vertical-align:middle; margin-right:8px;"> ${p.displayName}</span>
                                    <button class="action-btn btn-purple magnet-target" style="padding:4px 10px; font-size:0.6rem;" onclick="window.bringUpToStage('${doc.id}')">BRING UP</button>
                                </div>`;
        }
    });
    if (!html) html = '<span style="color:gray; font-size:0.8rem;">No hands raised.</span>';
    list.innerHTML = html;
};

window.toggleMic = () => {
    if (!window.localStream) return;
    const track = window.localStream.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; document.getElementById('btn-toggle-mic').classList.toggle('off', !track.enabled); }
};

window.toggleCam = () => {
    if (!window.localStream) return;
    const track = window.localStream.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; document.getElementById('btn-toggle-cam').classList.toggle('off', !track.enabled); }
};
