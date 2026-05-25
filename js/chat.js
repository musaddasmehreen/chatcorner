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

// Debounce handle for renderUserList
let _renderTimer = null;
const QUICK_BAN_OPTIONS = {
  '1h': 1,
  '24h': 24,
  '7d': 168,
  lifetime: null
};
const GUEST_MSG_LIMIT = 2;
const GUEST_MSG_WINDOW_MS = 60 * 1000;
const GUEST_MSG_RATE_KEY = 'cc-guest-msg-rate-v1';
const PERSONAL_CLEAR_KEY = 'cc-personal-clear-v1';
let guestRateToastTimer = null;
let guestRateToastEl = null;
const guestRateMemoryStore = {};

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
  presenceBaseData = {
    userId: currentUser.id,
    username: currentProfile.username,
    color: currentProfile.avatar_color,
    registered: currentProfile.is_registered,
    isAdmin: !!currentProfile.is_admin,
    isMod: !!currentProfile.is_mod,
    cameraOn: false
  };
  document.getElementById('user-badge').textContent = currentProfile.username + (currentProfile.is_registered ? ' \u2713' : ' \ud83d\udc64');

  document.getElementById('audio-bar').classList.remove('hidden');
  applyGuestModeUI();

  // Re-apply saved theme now that DOM is ready (syncs dots)
  applyTheme(localStorage.getItem('cc-theme') || 'nebula', false);

  document.addEventListener('click', (event) => {
    const picker = document.getElementById('emoji-picker');
    const emojiBtn = document.getElementById('btn-emoji');
    if (!picker || picker.classList.contains('hidden')) return;
    if (picker.contains(event.target) || emojiBtn?.contains(event.target)) return;
    closeEmojiPicker();
  });

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

  // FIX 1 — Apply guest UI restrictions after all room setup
  if (!currentProfile?.is_registered) applyGuestUI();
}

// FIX 1 — Disable input controls and show notice bar for guest users
function applyGuestUI() {
  updateComposerState();
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if (!text || !currentRoom) return;
  if (!isRegisteredUser() && !isTextRoomForGuestRateLimit()) {
    appendSystemMessage('Guests can send messages only in text rooms.');
    return;
  }
  if (currentRoom.is_locked) {
    appendSystemMessage('This room is locked by admin. Messaging is disabled.');
    return;
  }
  if (!isRegisteredUser()) {
    const rateLimit = checkAndTrackGuestRateLimit(currentRoom.id);
    if (!rateLimit.allowed) {
      showGuestRateLimitToast(rateLimit.waitSeconds);
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

/* Builds a message DOM node without appending it (used for batch & single) */
function buildMessageNode(msg) {
  if (msg.type === 'system') {
    const div = document.createElement('div');
    div.className = 'msg-system';
    div.textContent = '\u2014 ' + msg.content + ' \u2014';
    return div;
  }
  if (shouldHideMessageLocally(msg)) return null;

  // FIX 2 — Voice note messages: show locked placeholder for guests
  if (msg.type === 'voice') {
    const isMe  = msg.user_id === currentUser?.id;
    const canDeleteMessage = canDeleteChatMessage(msg);
    const div   = document.createElement('div');
    div.className = 'msg-row' + (isMe ? ' self' : '');
    div.dataset.messageId = msg.id || '';
    div.dataset.userId = msg.user_id || '';
    div.dataset.createdAt = msg.created_at || '';
    const initial = (msg.username || '?')[0].toUpperCase();
    const color   = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);
    const audioHtml = currentProfile?.is_registered
      ? `<audio controls src="${escHtml(msg.content)}"></audio>`
      : '<span class="vn-locked">\uD83D\uDD12 Register to hear voice notes</span>';
    div.innerHTML = `
      <div class="avatar" style="background:${color}">${initial}</div>
      <div class="msg-bubble">
        <div class="msg-username">${escHtml(msg.username || 'Unknown')}</div>
        ${audioHtml}
        ${buildMessageActions(msg, canDeleteMessage)}
        <div class="msg-time">${formatTime(msg.created_at)}</div>
      </div>`;
    return div;
  }

  const isMe  = msg.user_id === currentUser?.id;
  const canDeleteMessage = canDeleteChatMessage(msg);
  if (msg.type === 'voice') {
    return appendVoiceNoteMessage(msg, isMe);
  }
  const div   = document.createElement('div');
  div.className = 'msg-row' + (isMe ? ' self' : '');
  div.dataset.messageId = msg.id || '';
  div.dataset.userId = msg.user_id || '';
  div.dataset.createdAt = msg.created_at || '';

  const initial = (msg.username || '?')[0].toUpperCase();
  const color   = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);

  div.innerHTML = `
    <div class="avatar" style="background:${color}">${initial}</div>
    <div class="msg-bubble">
      <div class="msg-username">${escHtml(msg.username || 'Unknown')}</div>
      <div class="msg-text">${escHtml(msg.content)}</div>
      ${buildMessageActions(msg, canDeleteMessage)}
      <div class="msg-time">${formatTime(msg.created_at)}</div>
    </div>`;

  return div;
}

function appendMessage(msg) {
  const node = buildMessageNode(msg);
  if (node) document.getElementById('messages').appendChild(node);
}

function canDeleteChatMessage(msg) {
  if (!msg?.id || !msg?.user_id) return false;
  return msg.user_id === currentUser?.id || canRunQuickModeration();
}

function buildMessageActions(msg, canDeleteMessage) {
  if (!canDeleteMessage || !msg?.id) return '';
  return `
    <div class="msg-actions">
      <label class="msg-select-wrap" title="Select message">
        <input class="msg-select" type="checkbox" aria-label="Select message ${escHtml(msg.username || 'Unknown')}" />
      </label>
      <button type="button" class="msg-delete-btn" onclick="deleteChatMessage('${msg.id}')">\uD83D\uDDD1\uFE0F</button>
    </div>
  `;
}

function removeMessageNodeById(messageId) {
  if (!messageId) return;
  const selector = `.msg-row[data-message-id="${CSS.escape(String(messageId))}"]`;
  const node = document.querySelector(selector);
  if (node) node.remove();
}

async function deleteChatMessage(messageId) {
  const row = document.querySelector(`.msg-row[data-message-id="${CSS.escape(String(messageId))}"]`);
  if (!row) return;
  const messageUserId = row.dataset.userId || '';
  const canDelete = messageUserId === currentUser?.id || canRunQuickModeration();
  if (!canDelete) return;
  if (!confirm('Delete this message?')) return;
  const { error } = await sbClient.from('messages').delete().eq('id', messageId);
  if (error) {
    appendSystemMessage(`Delete failed: ${error.message}`);
    return;
  }
  removeMessageNodeById(messageId);
}

function isTextRoomForGuestRateLimit() {
  return !!currentRoom && currentRoom.is_audio_enabled !== true;
}

function getGuestRateStore() {
  try {
    const raw = localStorage.getItem(GUEST_MSG_RATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return guestRateMemoryStore;
  }
}

function setGuestRateStore(store) {
  try {
    localStorage.setItem(GUEST_MSG_RATE_KEY, JSON.stringify(store));
  } catch (_) {
    Object.keys(guestRateMemoryStore).forEach(k => delete guestRateMemoryStore[k]);
    Object.assign(guestRateMemoryStore, store);
  }
}

function checkAndTrackGuestRateLimit(roomId) {
  const now = Date.now();
  const store = getGuestRateStore();
  const times = Array.isArray(store[roomId]) ? store[roomId] : [];
  const recent = times.filter(ts => Number.isFinite(ts) && now - ts < GUEST_MSG_WINDOW_MS);
  if (recent.length >= GUEST_MSG_LIMIT) {
    const oldest = Math.min(...recent);
    const waitSeconds = Math.max(1, Math.ceil((oldest + GUEST_MSG_WINDOW_MS - now) / 1000));
    store[roomId] = recent;
    setGuestRateStore(store);
    return { allowed: false, waitSeconds };
  }
  recent.push(now);
  store[roomId] = recent;
  setGuestRateStore(store);
  return { allowed: true, waitSeconds: 0 };
}

function showGuestRateLimitToast(waitSeconds) {
  let remaining = Math.max(1, Number(waitSeconds) || 1);
  if (!guestRateToastEl) {
    guestRateToastEl = document.getElementById('chat-toast-wrap');
  }
  if (!guestRateToastEl) return;
  if (guestRateToastTimer) clearInterval(guestRateToastTimer);

  guestRateToastEl.classList.add('show');
  guestRateToastEl.textContent = `Guest limit reached: 2 messages/minute. Try again in ${remaining}s.`;

  guestRateToastTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(guestRateToastTimer);
      guestRateToastTimer = null;
      guestRateToastEl.classList.remove('show');
      return;
    }
    guestRateToastEl.textContent = `Guest limit reached: 2 messages/minute. Try again in ${remaining}s.`;
  }, 1000);
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
  const isGuest = !isRegisteredUser();

  Object.values(onlineUsers).forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-item';
    li.dataset.userId = u.userId;
    const showModeration = canModerate && u.userId !== currentUser?.id;
    li.innerHTML = `
      <span class="dot${u.registered ? '' : ' guest'}"></span>
      <button type="button" class="user-name-btn${isGuest ? ' locked-action' : ''}" ${isGuest ? 'title="🔒 Register to start private chats"' : ''}>${escHtml(u.username)}${u.registered ? ' \u2713' : ''}</button>
      <canvas class="mini-soundbar" data-user-id="${u.userId}" width="32" height="10" aria-hidden="true"></canvas>
      <button type="button" class="camera-user-btn${cameraStates[u.userId] ? '' : ' hidden'}" data-user-id="${u.userId}" title="View camera">\ud83d\udcf7</button>
      ${showModeration ? `<button type="button" class="user-mod-btn kick" data-user-id="${u.userId}" title="Kick for 30 minutes">\u26a1</button>` : ''}
      ${showModeration ? `<button type="button" class="user-mod-btn ban" data-user-id="${u.userId}" title="Ban user">\ud83d\udeab</button>` : ''}
    `;

    // FIX 4 — Guests see "Register to DM" instead of opening private chat
    li.querySelector('.user-name-btn')?.addEventListener('click', () => {
      if (isGuest) {
        appendSystemMessage('\ud83d\udd12 Register to start private chats.');
        return;
      }
      if (typeof openPrivateChat === 'function') openPrivateChat(u.userId, u.username);
    });

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
  const clearMyBtn = document.getElementById('clear-my-messages-btn');
  const joinVoiceBtn = document.getElementById('btn-join-voice');
  const isGuest = !isRegisteredUser();
  const isLocked = !!currentRoom?.is_locked;
  const guestTextAllowed = isGuest && isTextRoomForGuestRateLimit() && !isLocked;

  document.body.classList.toggle('guest-mode', isGuest);
  document.body.classList.toggle('guest-text-allowed', guestTextAllowed);
  if (guestNoticeBar) guestNoticeBar.classList.toggle('hidden', !isGuest);
  if (clearMyBtn) clearMyBtn.classList.toggle('hidden', canRunQuickModeration());

  if (isGuest) {
    closeEmojiPicker();
    if (msgInput) {
      msgInput.disabled = !guestTextAllowed;
      msgInput.placeholder = guestTextAllowed
        ? 'Guest mode: 2 messages/minute'
        : 'Guests can send messages only in text rooms.';
      msgInput.title = guestTextAllowed
        ? 'Guest limit: 2 messages per minute'
        : 'Switch to a text room to send messages';
    }
    if (sendBtn) {
      sendBtn.disabled = !guestTextAllowed;
      sendBtn.title = guestTextAllowed
        ? 'Guest limit: 2 messages per minute'
        : 'Switch to a text room to send messages';
      sendBtn.classList.toggle('locked-action', !guestTextAllowed);
    }
    if (emojiBtn) {
      emojiBtn.classList.remove('hidden');
      emojiBtn.disabled = !guestTextAllowed;
      emojiBtn.title = guestTextAllowed ? '' : 'Switch to a text room to use emoji';
    }
    if (voiceBtn) {
      voiceBtn.classList.add('hidden');
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

function getPersonalClearStore() {
  try {
    const raw = localStorage.getItem(PERSONAL_CLEAR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function setPersonalClearStore(store) {
  try {
    localStorage.setItem(PERSONAL_CLEAR_KEY, JSON.stringify(store));
  } catch (_) {}
}

function getPersonalClearCutoff(roomId) {
  if (!roomId) return 0;
  const store = getPersonalClearStore();
  const value = Number(store[roomId]);
  return Number.isFinite(value) ? value : 0;
}

function shouldHideMessageLocally(msg) {
  if (!msg?.user_id || msg.user_id !== currentUser?.id || !currentRoom?.id) return false;
  const cutoff = getPersonalClearCutoff(currentRoom.id);
  if (!cutoff) return false;
  const createdAt = new Date(msg.created_at || 0).getTime();
  return Number.isFinite(createdAt) && createdAt <= cutoff;
}

function clearMyMessagesLocal() {
  if (!currentRoom?.id || !currentUser?.id) return;
  if (!confirm('Clear only your messages from your current view?')) return;
  const store = getPersonalClearStore();
  store[currentRoom.id] = Date.now();
  setPersonalClearStore(store);
  document.querySelectorAll(`.msg-row[data-user-id="${CSS.escape(String(currentUser.id))}"]`).forEach(node => node.remove());
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

  const initial = (msg.username || '?')[0].toUpperCase();
  const color = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);
  const voiceSrc = sanitizeAudioSource(msg);

  const voiceMarkup = isRegisteredUser()
    ? (voiceSrc ? `<audio controls preload="none" src="${escHtml(voiceSrc)}"></audio>` : '<div class="msg-text">Voice note unavailable.</div>')
    : '<div class="msg-text">🔒 Voice notes are for registered users only.</div>';

  div.innerHTML = `
    <div class="avatar" style="background:${color}">${initial}</div>
    <div class="msg-bubble">
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
