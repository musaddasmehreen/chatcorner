/* ══ Theme Management ═══════════════════════════════════════════
   Reads/writes localStorage key 'cc-theme'.
   Syncs dots in both the chat theme bar and any fixed switcher.
═══════════════════════════════════════════════════════════════ */
const THEMES      = ['nebula','ember','arctic','matrix','rose'];
const THEME_NAMES = { nebula:'Nebula', ember:'Ember \ud83d\udd25', arctic:'Arctic \u2744\ufe0f', matrix:'Matrix', rose:'Rose \ud83c\udf38' };

(function initTheme() {
  const saved = localStorage.getItem('cc-theme') || 'nebula';
  applyTheme(saved, false);
})();

function setTheme(name) {
  if (!THEMES.includes(name)) return;
  localStorage.setItem('cc-theme', name);
  applyTheme(name, true);
}

function applyTheme(name, animate) {
  document.documentElement.setAttribute('data-theme', name);
  // Sync all theme dots on the page
  document.querySelectorAll('.theme-dot').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === name);
  });
  // Update in-chat label
  const lbl = document.getElementById('chat-theme-name');
  if (lbl) lbl.textContent = THEME_NAMES[name] || name;
}

/* ══ Emoji Insertion ════════════════════════════════════════════
   Inserts emoji at cursor position in #msg-input.
═══════════════════════════════════════════════════════════════ */
function insertEmoji(emoji) {
  const input = document.getElementById('msg-input');
  if (!input || input.disabled) return;
  const start = input.selectionStart ?? input.value.length;
  const end   = input.selectionEnd   ?? input.value.length;
  input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
  const pos = start + emoji.length;
  input.setSelectionRange(pos, pos);
  input.focus();
  closeEmojiPicker();
}

function toggleEmojiPicker(event) {
  event?.stopPropagation();
  const picker = document.getElementById('emoji-picker');
  const input = document.getElementById('msg-input');
  if (!picker || input?.disabled) return;
  picker.classList.toggle('hidden');
}

function closeEmojiPicker() {
  const picker = document.getElementById('emoji-picker');
  if (picker) picker.classList.add('hidden');
}

/* ══ Chat State ═════════════════════════════════════════════════ */
let currentUser    = null;
let currentProfile = null;
let currentRoom    = null;
let messageChannel = null;
let presenceChannel= null;
let onlineUsers    = {};
let cameraStates   = {};
let presenceBaseData = {};
const ignoredUserIds = new Set();
const profileCache = new Map();
let activeProfileCardUserId = null;
let profileHoverTimer = null;
let avatarUploadInFlight = false;
const GUEST_TEXT_RATE_LIMIT_COUNT = 2;
const GUEST_TEXT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const guestMessageTimesByRoom = new Map();
let guestRateToastTimer = null;

// Debounce handle for renderUserList
let _renderTimer = null;
const QUICK_BAN_OPTIONS = {
  '1h': 1,
  '24h': 24,
  '7d': 168,
  lifetime: null
};

window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  currentUser = session.user;

  let { data: prof } = await sbClient.from('profiles').select('*').eq('id', currentUser.id).single();

  if (!prof) {
    const username = 'User_' + currentUser.id.substr(0,5);
    await sbClient.from('profiles').insert({ id: currentUser.id, username, avatar_color: randomColor(), is_registered: false });
    ({ data: prof } = await sbClient.from('profiles').select('*').eq('id', currentUser.id).single());
  }

  currentProfile = prof;
  hydrateIgnoredUsers();
  if (currentProfile?.is_banned) {
    const expiresAt = currentProfile.ban_expires_at ? new Date(currentProfile.ban_expires_at).getTime() : null;
    if (expiresAt && expiresAt <= Date.now()) {
      await sbClient.from('profiles').update({
        is_banned: false,
        banned_at: null,
        banned_by: null,
        ban_reason: null,
        ban_expires_at: null
      }).eq('id', currentUser.id);
      const { data: refreshedProfile } = await sbClient.from('profiles').select('*').eq('id', currentUser.id).single();
      currentProfile = refreshedProfile || currentProfile;
    } else {
      const banUntilText = currentProfile.ban_expires_at
        ? ` until ${new Date(currentProfile.ban_expires_at).toLocaleString()}`
        : ' permanently';
      alert(`Your account is banned${banUntilText}.`);
      await sbClient.auth.signOut();
      window.location.href = 'index.html';
      return;
    }
  }
  if (isKickActive(currentProfile)) {
    const until = new Date(currentProfile.kicked_until).toLocaleString();
    alert(`You have been kicked. Please wait until ${until}.`);
    await sbClient.auth.signOut();
    window.location.href = 'index.html';
    return;
  }
  await syncProfileSessionMetadata();
  if (await enforceVpnGatekeeper()) return;
  presenceBaseData = {
    userId: currentUser.id,
    username: currentProfile.username,
    color: currentProfile.avatar_color,
    registered: currentProfile.is_registered,
    isAdmin: !!currentProfile.is_admin,
    isMod: !!currentProfile.is_mod,
    isOwner: !!currentProfile.is_owner,
    isVip: !!currentProfile.is_vip,
    avatarUrl: currentProfile.avatar_url || '',
    cameraOn: false
  };
  renderCurrentUserBadge();

  document.getElementById('audio-bar').classList.remove('hidden');
  applyGuestModeUI();
  document.getElementById('btn-voice-note')?.addEventListener('click', sendVoiceNote);
  document.getElementById('btn-clear-my-messages')?.addEventListener('click', clearMyMessagesFromScreen);
  document.getElementById('btn-avatar-upload')?.addEventListener('click', () => {
    if (!isRegisteredUser()) {
      appendSystemMessage('🔒 Register to upload a custom avatar.');
      return;
    }
    document.getElementById('avatar-upload-input')?.click();
  });
  document.getElementById('avatar-upload-input')?.addEventListener('change', handleAvatarFileSelection);
  document.getElementById('profile-card-close')?.addEventListener('click', hideProfileCard);

  // Re-apply saved theme now that DOM is ready (syncs dots)
  applyTheme(localStorage.getItem('cc-theme') || 'nebula', false);

  document.addEventListener('click', (event) => {
    const picker = document.getElementById('emoji-picker');
    const emojiBtn = document.getElementById('btn-emoji');
    if (!picker || picker.classList.contains('hidden')) return;
    if (picker.contains(event.target) || emojiBtn?.contains(event.target)) return;
    closeEmojiPicker();
  });
  document.addEventListener('click', handleProfileCardClickOutside);
  document.addEventListener('keydown', handleGlobalChatKeydown);

  await loadRooms();
});

async function loadRooms() {
  const { data: rooms } = await sbClient.from('rooms').select('*').order('name');

  const textList  = document.getElementById('room-list');
  const voiceList = document.getElementById('voice-room-list');
  textList.innerHTML = '';
  voiceList.innerHTML = '';

  rooms.forEach(room => {
    const li = document.createElement('li');
    li.innerHTML = `${room.is_audio_enabled ? '\ud83c\udfa4\ufe0f' : '\ud83d\udcac'} ${room.name}`;
    li.onclick = () => enterRoom(room);
    if (room.is_audio_enabled) voiceList.appendChild(li);
    else textList.appendChild(li);
  });

  if (rooms.length) enterRoom(rooms[0]);
}

async function enterRoom(room) {
  if (currentRoom?.id === room.id) return;

  if (messageChannel) sbClient.removeChannel(messageChannel);
  if (presenceChannel) sbClient.removeChannel(presenceChannel);
  if (typeof leaveVoice === 'function') leaveVoice();

  currentRoom = room;
  document.getElementById('current-room-name').textContent = '# ' + room.name;
  document.getElementById('messages').innerHTML = '';
  onlineUsers = {};
  cameraStates = {};

  document.querySelectorAll('.room-list li').forEach(li => {
    li.classList.toggle('active', li.textContent.includes(room.name));
  });

  const audioBar = document.getElementById('audio-bar');
  const msgInput = document.getElementById('msg-input');
  const sendBtn  = document.querySelector('.btn-send');
  const emojiBtn = document.getElementById('btn-emoji');

  if (room.is_audio_enabled) {
    audioBar.classList.remove('hidden');
  } else {
    audioBar.classList.add('hidden');
  }

  if (room.is_locked) {
    msgInput.disabled = true;
    msgInput.placeholder = 'This room is locked by admin.';
    if (sendBtn)  sendBtn.disabled  = true;
    if (emojiBtn) emojiBtn.disabled = true;
    closeEmojiPicker();
  } else {
    msgInput.disabled = false;
    msgInput.placeholder = 'Type a message\u2026 (Enter to send)';
    if (sendBtn)  sendBtn.disabled  = false;
    if (emojiBtn) emojiBtn.disabled = false;
  }
  updateComposerState();

  const { data: messages } = await sbClient
    .from('messages')
    .select('*')
    .eq('room_id', room.id)
    .order('created_at', { ascending: true })
    .limit(50);

  // Batch-append for performance
  if (messages?.length) {
    const container = document.getElementById('messages');
    const frag = document.createDocumentFragment();
    messages.forEach(m => {
      const node = buildMessageNode(m);
      if (node) frag.appendChild(node);
    });
    container.appendChild(frag);
  }
  scrollToBottom();

  messageChannel = sbClient
    .channel('room:' + room.id)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `room_id=eq.${room.id}`
    }, payload => {
      appendMessage(payload.new);
      scrollToBottom();
    })
    .on('postgres_changes', {
      event: 'DELETE', schema: 'public', table: 'messages',
      filter: `room_id=eq.${room.id}`
    }, payload => {
      removeMessageNodeById(payload.old?.id);
    })
    .subscribe();

  presenceChannel = sbClient.channel('presence:' + room.id, {
    config: { presence: { key: currentUser.id } }
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      onlineUsers = {};
      Object.values(state).forEach(arr => arr.forEach(u => {
        onlineUsers[u.userId] = u;
        cameraStates[u.userId] = !!u.cameraOn;
      }));
      scheduleRenderUserList();
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      newPresences.forEach(u => {
        onlineUsers[u.userId] = u;
        cameraStates[u.userId] = !!u.cameraOn;
      });
      scheduleRenderUserList();
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences.forEach(u => {
        delete onlineUsers[u.userId];
        delete cameraStates[u.userId];
      });
      scheduleRenderUserList();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track(presenceBaseData);
      }
    });

  appendSystemMessage(`You joined #${room.name}`);
}

// FIX 1 — Disable input controls and show notice bar for guest users
function applyGuestUI() {
  updateComposerState();
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if (!text || !currentRoom) return;
  if (currentRoom.is_locked) {
    appendSystemMessage('This room is locked by admin. Messaging is disabled.');
    return;
  }
  if (!isRegisteredUser() && !currentRoom?.is_audio_enabled) {
    const waitMs = getGuestMessageWaitMs(currentRoom.id);
    if (waitMs > 0) {
      showGuestRateLimitToast(waitMs);
      return;
    }
  }

  input.value = '';

  await sbClient.from('messages').insert({
    room_id:  currentRoom.id,
    user_id:  currentUser.id,
    username: currentProfile.username,
    content:  text,
    type:     'text'
  });
}

function hydrateIgnoredUsers() {
  ignoredUserIds.clear();
  try {
    const raw = localStorage.getItem(getIgnoredUsersStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    parsed.forEach(id => ignoredUserIds.add(id));
  } catch (_) {}
}

function persistIgnoredUsers() {
  try {
    localStorage.setItem(getIgnoredUsersStorageKey(), JSON.stringify(Array.from(ignoredUserIds)));
  } catch (_) {}
}

function getIgnoredUsersStorageKey() {
  return `cc-ignored-users:${currentUser?.id || 'guest'}`;
}

function getRoleKey(entity = {}) {
  if (entity.isOwner || entity.is_owner) return 'owner';
  if (entity.isAdmin || entity.is_admin) return 'admin';
  if (entity.isMod || entity.is_mod) return 'mod';
  if (entity.registered || entity.is_registered) return 'registered';
  return 'guest';
}

function getRoleMeta(entity = {}) {
  const role = getRoleKey(entity);
  const map = {
    owner: { key: 'owner', icon: '👑', label: 'Owner', className: 'role-owner', rank: 4 },
    admin: { key: 'admin', icon: '🛡️', label: 'Admin', className: 'role-admin', rank: 3 },
    mod: { key: 'mod', icon: '⚔️', label: 'Moderator', className: 'role-mod', rank: 2 },
    registered: { key: 'registered', icon: '✅', label: 'Registered', className: 'role-registered', rank: 1 },
    guest: { key: 'guest', icon: '👤', label: 'Guest', className: 'role-guest', rank: 0 }
  };
  return map[role];
}

function renderRoleBadges(entity = {}) {
  const base = getRoleMeta(entity);
  const badges = [`<span class="role-badge ${base.className}">${base.icon} ${base.label}</span>`];
  if (entity.isVip || entity.is_vip) badges.push('<span class="role-badge role-vip">⭐ VIP</span>');
  return badges.join('');
}

function renderCurrentUserBadge() {
  const badge = document.getElementById('user-badge');
  if (!badge || !currentProfile) return;
  badge.innerHTML = `${escHtml(currentProfile.username || 'User')} <span class="role-stack">${renderRoleBadges(currentProfile)}</span>`;
}

function obfuscateEmail(email) {
  const value = String(email || '');
  if (!value.includes('@')) return '—';
  const [name, domain] = value.split('@');
  if (!name) return `*@${domain}`;
  const visible = name[0];
  return `${visible}${'*'.repeat(Math.max(4, name.length - 1))}@${domain}`;
}

function obfuscateIp(ipAddress) {
  const value = String(ipAddress || '').trim();
  if (!value) return '—';
  if (currentProfile?.is_admin || currentProfile?.is_owner) return value;
  if (value.includes(':')) {
    const parts = value.split(':');
    return parts.slice(0, 2).join(':') + ':****';
  }
  const parts = value.split('.');
  if (parts.length !== 4) return '***.***.***.***';
  return `${parts[0]}.${parts[1]}.*.*`;
}

function summarizeBrowserInfo(userAgent) {
  const value = String(userAgent || '').trim();
  if (!value) return 'Unknown';
  if (value.includes('Firefox')) return 'Firefox';
  if (value.includes('Edg/')) return 'Edge';
  if (value.includes('Chrome/')) return 'Chrome';
  if (value.includes('Safari/') && !value.includes('Chrome/')) return 'Safari';
  return value.slice(0, 48);
}

function canModerateTargetEntity(target = {}) {
  if (!currentProfile || !target || target.userId === currentUser?.id || target.id === currentUser?.id) return false;
  if (currentProfile.is_owner) return true;
  if (currentProfile.is_admin) return !target.is_owner && !target.isOwner && !target.is_admin && !target.isAdmin;
  if (currentProfile.is_mod) return !target.is_owner && !target.isOwner && !target.is_admin && !target.isAdmin && !target.is_mod && !target.isMod;
  return false;
}

function renderAvatarMarkup({ username = '?', color = '#7c3aed', avatarUrl = '', className = 'avatar' }) {
  const safeInitial = escHtml((username || '?')[0]?.toUpperCase() || '?');
  if (avatarUrl) {
    return `<div class="${className} has-image" style="background:${color}"><img src="${escHtml(avatarUrl)}" alt="${escHtml(username)} avatar" /></div>`;
  }
  return `<div class="${className}" style="background:${color}">${safeInitial}</div>`;
}

/* Builds a message DOM node without appending it (used for batch & single) */
function buildMessageNode(msg) {
  if (ignoredUserIds.has(msg.user_id)) return null;
  if (msg.type === 'system') {
    const div = document.createElement('div');
    div.className = 'msg-system';
    div.textContent = '\u2014 ' + msg.content + ' \u2014';
    return div;
  }

  // FIX 2 — Voice note messages: show locked placeholder for guests
  if (msg.type === 'voice') {
    const isMe  = msg.user_id === currentUser?.id;
    const div   = document.createElement('div');
    div.className = 'msg-row' + (isMe ? ' self' : '');
    div.dataset.messageId = msg.id || '';
    div.dataset.userId = msg.user_id || '';
    const initial = (msg.username || '?')[0].toUpperCase();
    const color   = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);
    const avatarUrl = isMe ? currentProfile?.avatar_url : (onlineUsers[msg.user_id]?.avatarUrl || profileCache.get(msg.user_id)?.avatar_url || '');
    const audioHtml = currentProfile?.is_registered
      ? `<audio controls src="${escHtml(msg.content)}"></audio>`
      : '<span class="vn-locked">\ud83d\udd12 Register to hear voice notes</span>';
    const deleteButton = isMe
      ? '<button type="button" class="msg-local-delete" title="Delete from my screen">🗑️</button>'
      : '';
    div.innerHTML = `
      ${renderAvatarMarkup({ username: msg.username, color, avatarUrl, className: 'avatar' })}
      <div class="msg-bubble">
        ${deleteButton}
        <div class="msg-username">${escHtml(msg.username || 'Unknown')}</div>
        ${audioHtml}
        <div class="msg-time">${formatTime(msg.created_at)}</div>
      </div>`;
    return div;
  }

  const isMe  = msg.user_id === currentUser?.id;
  if (msg.type === 'voice') {
    return appendVoiceNoteMessage(msg, isMe);
  }
  const div   = document.createElement('div');
  div.className = 'msg-row' + (isMe ? ' self' : '');
  div.dataset.messageId = msg.id || '';
  div.dataset.userId = msg.user_id || '';

  const color   = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);
  const avatarUrl = isMe ? currentProfile?.avatar_url : (onlineUsers[msg.user_id]?.avatarUrl || profileCache.get(msg.user_id)?.avatar_url || '');
  const deleteButton = isMe
    ? '<button type="button" class="msg-local-delete" title="Delete from my screen">🗑️</button>'
    : '';

  div.innerHTML = `
    ${renderAvatarMarkup({ username: msg.username, color, avatarUrl, className: 'avatar' })}
    <div class="msg-bubble">
      ${deleteButton}
      <div class="msg-username">${escHtml(msg.username || 'Unknown')}</div>
      <div class="msg-text">${escHtml(msg.content)}</div>
      <div class="msg-time">${formatTime(msg.created_at)}</div>
    </div>`;

  return div;
}

function appendMessage(msg) {
  const node = buildMessageNode(msg);
  if (node) document.getElementById('messages').appendChild(node);
}

function appendSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg-system';
  div.textContent = '\u2014 ' + text + ' \u2014';
  document.getElementById('messages').appendChild(div);
}

/* Debounced user list render — avoids hammering the DOM on rapid presence events */
function scheduleRenderUserList() {
  if (_renderTimer) return;
  _renderTimer = requestAnimationFrame(() => {
    _renderTimer = null;
    renderUserList();
  });
}

function renderUserList() {
  const ul   = document.getElementById('user-list');
  const frag = document.createDocumentFragment();
  const canModerate = canRunQuickModeration();
  const isGuestViewer = !isRegisteredUser();

  Object.values(onlineUsers).forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-item' + (u.isVip ? ' user-vip' : '');
    li.dataset.userId = u.userId;
    const showModeration = canModerate && canModerateTargetEntity(u);
    li.innerHTML = `
      <span class="dot${u.registered ? '' : ' guest'}"></span>
      <button type="button" class="user-name-btn" title="View profile card">
        <span class="user-name-meta">
          <span class="user-name-text">${escHtml(u.username)}</span>
          <span class="role-stack">${renderRoleBadges(u)}</span>
        </span>
      </button>
      <canvas class="mini-soundbar" data-user-id="${u.userId}" width="32" height="10" aria-hidden="true"></canvas>
      <button type="button" class="camera-user-btn${cameraStates[u.userId] ? '' : ' hidden'}" data-user-id="${u.userId}" title="View camera">\ud83d\udcf7</button>
      ${showModeration ? `<button type="button" class="user-mod-btn kick" data-user-id="${u.userId}" title="Kick for 30 minutes">\u26a1</button>` : ''}
      ${showModeration ? `<button type="button" class="user-mod-btn ban" data-user-id="${u.userId}" title="Ban user">\ud83d\udeab</button>` : ''}
    `;

    const nameBtn = li.querySelector('.user-name-btn');
    const openCard = (event) => showProfileCardForUser(u.userId, event, u);
    nameBtn?.addEventListener('click', openCard);
    nameBtn?.addEventListener('mouseenter', (event) => {
      clearTimeout(profileHoverTimer);
      profileHoverTimer = setTimeout(() => openCard(event), 180);
    });
    nameBtn?.addEventListener('mouseleave', () => clearTimeout(profileHoverTimer));
    nameBtn?.addEventListener('focus', openCard);

    li.querySelector('.camera-user-btn')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (typeof openFloatingCamera === 'function') openFloatingCamera(u.userId, u.username);
    });
    li.querySelector('.user-mod-btn.kick')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      quickKickUser(u.userId, u.username);
    });
    li.querySelector('.user-mod-btn.ban')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      quickBanUser(u.userId, u.username);
    });

    frag.appendChild(li);
  });

  ul.innerHTML = '';
  ul.appendChild(frag);
}

/* Instant scroll — bypasses CSS scroll-behavior for real-time feel */
function scrollToBottom() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function stringToColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#7c3aed','#06b6d4','#f59e0b','#10b981','#ef4444','#ec4899','#6366f1','#0ea5e9'];
  return colors[Math.abs(hash) % colors.length];
}

function randomColor() {
  const colors = ['#7c3aed','#06b6d4','#f59e0b','#10b981','#ef4444','#ec4899','#6366f1'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function setUserCameraState(userId, cameraOn) {
  if (!userId) return;
  cameraStates[userId] = !!cameraOn;
  if (onlineUsers[userId]) onlineUsers[userId].cameraOn = !!cameraOn;
  scheduleRenderUserList();
}

async function setLocalCameraState(cameraOn) {
  if (!currentUser?.id) return;
  cameraStates[currentUser.id] = !!cameraOn;
  presenceBaseData.cameraOn = !!cameraOn;
  scheduleRenderUserList();
  if (presenceChannel) {
    try { await presenceChannel.track(presenceBaseData); } catch (_) {}
  }
}

function getUsernameById(userId) {
  return onlineUsers[userId]?.username || (userId === currentUser?.id ? currentProfile?.username : 'User');
}

function isRegisteredUser() {
  return currentProfile?.is_registered === true;
}

function canRunQuickModeration() {
  return currentProfile?.is_admin === true || currentProfile?.is_mod === true;
}

function isKickActive(profile) {
  if (!profile?.kicked_until) return false;
  return new Date(profile.kicked_until).getTime() > Date.now();
}

function applyGuestModeUI() {
  updateComposerState();
}

function updateComposerState() {
  const msgInput = document.getElementById('msg-input');
  const sendBtn = document.querySelector('.btn-send');
  const emojiBtn = document.getElementById('btn-emoji');
  const voiceBtn = document.getElementById('btn-voice-note');
  const guestNoticeBar = document.getElementById('guest-notice-bar');
  const joinVoiceBtn = document.getElementById('btn-join-voice');
  const isGuest = !isRegisteredUser();
  const isLocked = !!currentRoom?.is_locked;

  document.body.classList.toggle('guest-mode', isGuest);
  if (guestNoticeBar) guestNoticeBar.classList.toggle('hidden', !isGuest);

  if (isGuest) {
    if (msgInput) {
      msgInput.disabled = isLocked;
      msgInput.placeholder = isLocked ? 'This room is locked by admin.' : 'Type a message… (Enter to send)';
      msgInput.title = '';
    }
    if (sendBtn) {
      sendBtn.disabled = isLocked;
      sendBtn.title = '';
      sendBtn.classList.remove('locked-action');
    }
    if (emojiBtn) {
      emojiBtn.classList.remove('hidden');
      emojiBtn.disabled = isLocked;
      emojiBtn.title = '';
    }
    if (voiceBtn) {
      voiceBtn.classList.remove('hidden');
      voiceBtn.disabled = true;
      voiceBtn.title = '🔒 Voice notes are for registered users only';
    }
    if (joinVoiceBtn) {
      joinVoiceBtn.title = '🔒 Register to join voice';
    }
    return;
  }

  if (msgInput) {
    msgInput.disabled = isLocked;
    msgInput.placeholder = isLocked ? 'This room is locked by admin.' : 'Type a message… (Enter to send)';
    msgInput.title = '';
  }
  if (sendBtn) {
    sendBtn.disabled = isLocked;
    sendBtn.title = '';
    sendBtn.classList.remove('locked-action');
  }
  if (emojiBtn) {
    emojiBtn.classList.remove('hidden');
    emojiBtn.disabled = isLocked;
    emojiBtn.title = '';
  }
  if (voiceBtn) {
    voiceBtn.classList.remove('hidden');
    voiceBtn.disabled = isLocked;
    voiceBtn.title = '';
  }
}

function sanitizeAudioSource(msg) {
  const source = msg?.audio_url || msg?.voice_url || msg?.content || '';
  if (!source) return '';
  if (source.startsWith('data:audio/') || source.startsWith('blob:') || source.startsWith('https://') || source.startsWith('http://')) {
    return source;
  }
  return '';
}

function appendVoiceNoteMessage(msg, isMe) {
  const div = document.createElement('div');
  div.className = 'msg-row' + (isMe ? ' self' : '');
  div.dataset.messageId = msg.id || '';
  div.dataset.userId = msg.user_id || '';

  const initial = (msg.username || '?')[0].toUpperCase();
  const color = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);
  const voiceSrc = sanitizeAudioSource(msg);

  const voiceMarkup = isRegisteredUser()
    ? (voiceSrc ? `<audio controls preload="none" src="${escHtml(voiceSrc)}"></audio>` : '<div class="msg-text">Voice note unavailable.</div>')
    : '<div class="msg-text">🔒 Voice notes are for registered users only.</div>';
  const deleteButton = isMe
    ? '<button type="button" class="msg-local-delete" title="Delete from my screen">🗑️</button>'
    : '';

  div.innerHTML = `
    <div class="avatar" style="background:${color}">${initial}</div>
    <div class="msg-bubble">
      ${deleteButton}
      <div class="msg-username">${escHtml(msg.username || 'Unknown')}</div>
      <div class="msg-voice">${voiceMarkup}</div>
      <div class="msg-time">${formatTime(msg.created_at)}</div>
    </div>`;

  return div;
}

async function quickKickUser(userId, username) {
  if (!canRunQuickModeration() || !userId) return;
  const kickedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { error } = await sbClient.from('profiles').update({ kicked_until: kickedUntil }).eq('id', userId);
  if (error) {
    appendSystemMessage(`Kick failed for ${username || 'user'}: ${error.message}`);
    return;
  }
  appendSystemMessage(`⚡ ${username || 'User'} has been kicked for 30 minutes.`);
}

async function quickBanUser(userId, username) {
  if (!canRunQuickModeration() || !userId) return;

  const choice = prompt('Ban for: 1h, 24h, 7d, or Lifetime', '1h');
  if (choice === null) return;
  const normalized = String(choice).trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(QUICK_BAN_OPTIONS, normalized)) {
    appendSystemMessage('Ban cancelled. Use: 1h, 24h, 7d, or Lifetime.');
    return;
  }

  const durationHours = QUICK_BAN_OPTIONS[normalized];
  const banExpiresAt = durationHours === null
    ? null
    : new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  const { error } = await sbClient.from('profiles').update({
    is_banned: true,
    banned_at: new Date().toISOString(),
    banned_by: currentUser.id,
    ban_reason: 'In-chat moderation',
    ban_expires_at: banExpiresAt
  }).eq('id', userId);

  if (error) {
    appendSystemMessage(`Ban failed for ${username || 'user'}: ${error.message}`);
    return;
  }
  appendSystemMessage(`🚫 ${username || 'User'} has been banned (${durationHours === null ? 'Lifetime' : normalized}).`);
}

function pruneGuestMessageTimes(roomId) {
  const key = roomId || 'unknown';
  const now = Date.now();
  const times = guestMessageTimesByRoom.get(key) || [];
  const recent = times.filter(ts => now - ts < GUEST_TEXT_RATE_LIMIT_WINDOW_MS);
  guestMessageTimesByRoom.set(key, recent);
  return recent;
}

function getGuestMessageWaitMs(roomId) {
  const recent = pruneGuestMessageTimes(roomId);
  if (recent.length < GUEST_TEXT_RATE_LIMIT_COUNT) {
    recent.push(Date.now());
    guestMessageTimesByRoom.set(roomId || 'unknown', recent);
    return 0;
  }
  return Math.max(0, GUEST_TEXT_RATE_LIMIT_WINDOW_MS - (Date.now() - recent[0]));
}

function ensureChatToastWrap() {
  let wrap = document.getElementById('chat-toast-wrap');
  if (wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'chat-toast-wrap';
  wrap.className = 'chat-toast-wrap';
  document.body.appendChild(wrap);
  return wrap;
}

function showGuestRateLimitToast(waitMs) {
  const wrap = ensureChatToastWrap();
  const existing = document.getElementById('guest-rate-limit-toast');
  if (existing) existing.remove();
  if (guestRateToastTimer) {
    clearInterval(guestRateToastTimer);
    guestRateToastTimer = null;
  }
  const toast = document.createElement('div');
  toast.id = 'guest-rate-limit-toast';
  toast.className = 'chat-toast warning';
  wrap.appendChild(toast);

  const render = () => {
    const seconds = Math.max(0, Math.ceil(waitMs / 1000));
    toast.textContent = `Guest limit reached: ${GUEST_TEXT_RATE_LIMIT_COUNT} messages/minute. Try again in ${seconds}s.`;
    if (waitMs <= 0) {
      if (guestRateToastTimer) clearInterval(guestRateToastTimer);
      guestRateToastTimer = null;
      setTimeout(() => toast.remove(), 400);
      return;
    }
    waitMs -= 1000;
  };

  render();
  guestRateToastTimer = setInterval(render, 1000);
}

function sendVoiceNote() {
  if (!isRegisteredUser()) {
    appendSystemMessage('🔒 Voice notes are for registered users only.');
    return;
  }
  appendSystemMessage('Voice note sender is currently unavailable.');
}

function removeMessageNodeById(messageId) {
  if (!messageId) return;
  document
    .querySelector(`#messages .msg-row[data-message-id="${CSS.escape(String(messageId))}"]`)
    ?.remove();
}

function clearMyMessagesFromScreen() {
  if (!currentUser?.id) return;
  const mine = document.querySelectorAll(`#messages .msg-row[data-user-id="${CSS.escape(currentUser.id)}"]`);
  mine.forEach(node => node.remove());
}

document.addEventListener('click', (event) => {
  const deleteBtn = event.target.closest('.msg-local-delete');
  if (!deleteBtn) return;
  const row = deleteBtn.closest('.msg-row');
  if (!row) return;
  if (row.dataset.userId !== currentUser?.id) return;
  row.remove();
});
