/* ══ Theme Management ═══════════════════════════════════════════
   Reads/writes localStorage key 'cc-theme'.
   Syncs dots in both the chat theme bar and any fixed switcher.
═══════════════════════════════════════════════════════════════ */
const THEMES      = ['nebula','ember','arctic','matrix','rose'];
const THEME_NAMES = { nebula:'Nebula', ember:'Ember \ud83d\udd25', arctic:'Arctic \u2744\ufe0f', matrix:'Matrix', rose:'Rose \ud83c\udf38' };
const GUEST_VOICE_LIMIT = 1;
const EMOJI_GROUPS = [
  {
    label: 'Live',
    items: [
      { emoji: '😊', title: 'Happy', live: 'live-bounce' },
      { emoji: '😍', title: 'Love', live: 'live-pulse' },
      { emoji: '😂', title: 'Laugh', live: 'live-wiggle' },
      { emoji: '😮', title: 'Wow', live: 'live-pop' },
      { emoji: '🥳', title: 'Party', live: 'live-spin' },
      { emoji: '😢', title: 'Sad', live: 'live-sway' },
      { emoji: '😡', title: 'Angry', live: 'live-shake' }
    ]
  },
  {
    label: 'Faces',
    items: ['😀','😁','😄','😅','🤣','🙂','😉','😎','🤩','😘','🤗','🤔','🥲','😭','😴','🤯','🥶','🥵','🙄','🤐','🤪','😇','🤠','🥹']
  },
  {
    label: 'Hearts',
    items: ['❤️','💖','💗','💓','💞','💕','💘','💝','🫶','💙','💚','💛','🧡','💜','🖤','🤍']
  },
  {
    label: 'Hands',
    items: ['👍','👎','👏','🙌','🫡','🙏','🤝','👋','✌️','🤞','👌','💪','🫶','👀']
  },
  {
    label: 'Fun',
    items: ['🔥','✨','🌈','⭐','⚡','🎉','🎊','🎈','🎵','🎶','💯','💥','🌸','🍕','☕','🎮']
  }
];

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
  const lbl = document.getElementById('theme-name-label') || document.getElementById('chat-theme-name');
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

function renderEmojiPicker() {
  const picker = document.getElementById('emoji-picker');
  if (!picker) return;
  picker.innerHTML = '';

  EMOJI_GROUPS.forEach(group => {
    const header = document.createElement('div');
    header.className = 'emoji-group-label';
    header.textContent = group.label;
    picker.appendChild(header);

    group.items.forEach(item => {
      const config = typeof item === 'string' ? { emoji: item, title: item } : item;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emoji-btn' + (config.live ? ` ${config.live}` : '');
      btn.textContent = config.emoji;
      btn.title = config.title || config.emoji;
      btn.setAttribute('aria-label', config.title || config.emoji);
      btn.onclick = () => insertEmoji(config.emoji);
      picker.appendChild(btn);
    });
  });
}

function toggleRoomImageUrlInput(event) {
  event?.stopPropagation();
  const popover = document.getElementById('room-image-url-popover');
  const input = document.getElementById('room-image-url-input');
  const trigger = document.getElementById('btn-image-url');
  if (!popover || !input || trigger?.disabled) return;
  closeEmojiPicker();
  if (!popover.classList.contains('hidden')) {
    closeRoomImageUrlInput();
    return;
  }
  popover.classList.remove('hidden');
  input.focus();
}

function closeRoomImageUrlInput(clearValue = true) {
  const popover = document.getElementById('room-image-url-popover');
  const input = document.getElementById('room-image-url-input');
  if (popover) popover.classList.add('hidden');
  if (clearValue && input) input.value = '';
}

function getRoomImageUrlValue() {
  return document.getElementById('room-image-url-input')?.value.trim() || '';
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
const GUEST_TEXT_RATE_LIMIT_COUNT = 2;
const GUEST_TEXT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const guestMessageTimesByRoom = new Map();
let guestRateToastTimer = null;
let roomVoiceNoteRecorder = null;
let roomVoiceNoteStream = null;
let roomVoiceNoteChunks = [];
let roomVoiceNoteStarting = false;
let roomVoiceNoteRoomId = null;
let discardRoomVoiceNoteOnStop = false;
let oldestMessageTimestamp = null;
let isLoadingOlderMessages = false;
let cachedRooms = [];
const CLEARED_MESSAGE_ARCHIVE_KEY = 'cc-cleared-message-archive';
const MAX_CLEARED_MESSAGE_ARCHIVE_ITEMS = 250;
const DELETED_MESSAGE_PREFIX = '🗑️ Message deleted by ';
const AUTH_ENTRY_PAGE_URL = 'login.html';
let guestCleanupPromise = null;

async function getActiveChatSession() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (session) return session;

  // Check if we're coming from a logout action
  const isLogoutFlag = sessionStorage.getItem('cc_logout_flag') === 'true';
  if (isLogoutFlag) {
    // Clear the flag and don't create guest session
    sessionStorage.removeItem('cc_logout_flag');
    return null;
  }

  const { data, error } = await sbClient.auth.signInAnonymously();
  if (error) {
    console.error('Anonymous sign-in failed:', error);
    appendSystemMessage('Could not start guest mode. Please refresh and try again.');
    return null;
  }

  return data.session || null;
}

function isGuestProfile(profile = currentProfile) {
  return !!profile && profile.is_registered === false;
}

function clearGuestLocalState(userId = currentUser?.id) {
  if (!userId) return;
  delete onlineUsers[userId];
  delete cameraStates[userId];
  scheduleRenderUserList();
  document.querySelectorAll(`#messages .msg-row[data-user-id="${CSS.escape(userId)}"]`).forEach(node => node.remove());
  localStorage.removeItem(`cc-avatar-${userId}`);
  localStorage.removeItem('cc-guest-voice-used');
  sessionStorage.removeItem('cc-nick-prompt-shown');
}

async function purgeGuestDataWithClient(userId) {
  const tasks = [
    sbClient.from('messages').delete().eq('user_id', userId),
    sbClient.from('profiles').delete().eq('id', userId)
  ];

  tasks.push(
    sbClient.from('private_messages').delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
  );

  tasks.push(
    sbClient.from('active_users').delete().eq('username', currentProfile?.username || '')
  );

  const results = await Promise.allSettled(tasks);
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value?.error) {
      console.warn('Guest cleanup warning:', result.value.error.message);
    } else if (result.status === 'rejected') {
      console.warn('Guest cleanup warning:', result.reason);
    }
  });
}

async function purgeGuestDataWithKeepalive(userId) {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session?.access_token) return;

  const headers = {
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${session.access_token}`,
    Prefer: 'return=minimal'
  };

  const deleteRequests = [
    (() => {
      const url = new URL(`${SUPABASE_URL}/rest/v1/messages`);
      url.searchParams.set('user_id', `eq.${userId}`);
      return fetch(url, { method: 'DELETE', headers, keepalive: true });
    })(),
    (() => {
      const url = new URL(`${SUPABASE_URL}/rest/v1/profiles`);
      url.searchParams.set('id', `eq.${userId}`);
      return fetch(url, { method: 'DELETE', headers, keepalive: true });
    })(),
    (() => {
      const url = new URL(`${SUPABASE_URL}/rest/v1/private_messages`);
      url.searchParams.set('or', `(sender_id.eq.${userId},recipient_id.eq.${userId})`);
      return fetch(url, { method: 'DELETE', headers, keepalive: true });
    })(),
    (() => {
      const username = currentProfile?.username || '';
      if (!username) return Promise.resolve();
      const url = new URL(`${SUPABASE_URL}/rest/v1/active_users`);
      url.searchParams.set('username', `eq.${username}`);
      return fetch(url, { method: 'DELETE', headers, keepalive: true });
    })()
  ];

  await Promise.allSettled(deleteRequests);
}

async function cleanupGuestSession({ keepalive = false } = {}) {
  if (!currentUser?.id || !isGuestProfile()) return;
  if (guestCleanupPromise) return guestCleanupPromise;

  const userId = currentUser.id;
  clearGuestLocalState(userId);

  guestCleanupPromise = (async () => {
    if (keepalive) {
      await purgeGuestDataWithKeepalive(userId);
      return;
    }
    await purgeGuestDataWithClient(userId);
  })().finally(() => {
    guestCleanupPromise = null;
  });

  return guestCleanupPromise;
}

async function prepareForLogout() {
  try {
    if (typeof leaveVoice === 'function') {
      await leaveVoice();
    }
  } catch (_) {}

  try {
    if (currentRoom?.id && presenceChannel) {
      await presenceChannel.untrack();
    }
  } catch (_) {}

  if (isGuestProfile()) {
    await cleanupGuestSession();
  } else {
    sessionStorage.removeItem('cc-nick-prompt-shown');
  }
}

window.prepareForLogout = prepareForLogout;

window.addEventListener('pagehide', () => {
  if (!isGuestProfile()) return;
  void cleanupGuestSession({ keepalive: true });
});

// Debounce handle for renderUserList
let _renderTimer = null;
const activeCamViewers = new Set(); // userIds currently viewing a cam
const typingUsers = new Map();      // userId → { userId, username }
const QUICK_BAN_OPTIONS = {
  '1h': 1,
  '24h': 24,
  '7d': 168,
  lifetime: null
};

window.addEventListener('DOMContentLoaded', async () => {
  const session = await getActiveChatSession();
  if (!session) return;

  currentUser = session.user;

  let { data: prof } = await sbClient.from('profiles').select('*').eq('id', currentUser.id).single();

  if (!prof) {
    const username = 'User_' + currentUser.id.substr(0,5);
    await sbClient.from('profiles').insert({ id: currentUser.id, username, avatar_color: randomColor(), is_registered: false });
    ({ data: prof } = await sbClient.from('profiles').select('*').eq('id', currentUser.id).single());
  }

  currentProfile = prof;
  const localAvatar = localStorage.getItem('cc-avatar-' + currentUser.id);
  if (localAvatar) currentProfile.avatar_url = localAvatar;

  if (!currentProfile.is_registered && !sessionStorage.getItem('cc-nick-prompt-shown')) {
    sessionStorage.setItem('cc-nick-prompt-shown', '1');
    setTimeout(() => showChatToast(`👋 Chatting as ${currentProfile.username} — Register for a custom nick & full access!`, 'info', 6000), 1500);
  }

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
      showBlockedOverlay(`⛔ Your account is banned${banUntilText}.`);
      return;
    }
  }
  if (isKickActive(currentProfile)) {
    const until = new Date(currentProfile.kicked_until).toLocaleString();
    showBlockedOverlay(`⚡ You have been kicked. Please wait until ${until}.`);
    return;
  }
  presenceBaseData = {
    userId: currentUser.id,
    username: currentProfile.username,
    color: currentProfile.avatar_color,
    registered: currentProfile.is_registered,
    isAdmin: !!currentProfile.is_admin,
    isMod: !!currentProfile.is_mod,
    isOwner: !!currentProfile.is_owner,
    isVip: !!currentProfile.is_vip,
    cameraOn: false,
    viewingCam: false
  };
  document.getElementById('user-badge').textContent = currentProfile.username + (currentProfile.is_registered ? ' \u2713' : ' \ud83d\udc64');
  if (currentProfile.is_registered) {
    const avatarBtn = document.getElementById('btn-edit-avatar');
    if (avatarBtn) avatarBtn.style.display = '';
  }

  document.getElementById('audio-bar').classList.remove('hidden');
  applyGuestModeUI();
  document.getElementById('btn-image-url')?.addEventListener('click', toggleRoomImageUrlInput);
  document.getElementById('btn-room-image-url-clear')?.addEventListener('click', (event) => {
    event.stopPropagation();
    closeRoomImageUrlInput();
  });
  document.getElementById('room-image-url-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendMessage();
      return;
    }
    if (event.key === 'Escape') closeRoomImageUrlInput();
  });
  document.getElementById('btn-voice-note')?.addEventListener('click', sendVoiceNote);
  document.getElementById('btn-clear-my-messages')?.addEventListener('click', clearMyMessagesFromScreen);

  // Character counter for message input
  document.getElementById('msg-input')?.addEventListener('input', () => {
    const len = document.getElementById('msg-input').value.length;
    const counter = document.getElementById('msg-char-counter');
    if (counter) {
      counter.textContent = `${len}/500`;
      counter.style.color = len > 450 ? 'var(--red, #ef4444)' : 'var(--muted)';
    }
  });

  // Scroll-to-bottom button visibility
  document.getElementById('messages')?.addEventListener('scroll', () => {
    const el = document.getElementById('messages');
    const btn = document.getElementById('btn-scroll-bottom');
    if (!btn) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    btn.classList.toggle('hidden', atBottom);
  });

  // Typing indicator broadcast
  let _typingTimeout = null;
  let _isTyping = false;
  document.getElementById('msg-input')?.addEventListener('input', () => {
    if (!presenceChannel || !currentProfile?.username) return;
    if (!_isTyping) {
      _isTyping = true;
      presenceChannel.send({ type: 'broadcast', event: 'typing', payload: { username: currentProfile.username, userId: currentUser.id } }).catch(() => {});
    }
    clearTimeout(_typingTimeout);
    _typingTimeout = setTimeout(() => {
      _isTyping = false;
      presenceChannel.send({ type: 'broadcast', event: 'typing-stop', payload: { userId: currentUser.id } }).catch(() => {});
    }, 1500);
  });

  // Re-apply saved theme now that DOM is ready (syncs dots)
  applyTheme(localStorage.getItem('cc-theme') || 'nebula', false);
  renderEmojiPicker();

  document.addEventListener('click', (event) => {
    const picker = document.getElementById('emoji-picker');
    const emojiBtn = document.getElementById('btn-emoji');
    if (picker && !picker.classList.contains('hidden')) {
      if (!(picker.contains(event.target) || emojiBtn?.contains(event.target))) {
        closeEmojiPicker();
      }
    }
    const imagePopover = document.getElementById('room-image-url-popover');
    const imageBtn = document.getElementById('btn-image-url');
    if (imagePopover && !imagePopover.classList.contains('hidden')) {
      if (!(imagePopover.contains(event.target) || imageBtn?.contains(event.target))) {
        closeRoomImageUrlInput();
      }
    }
  });

  // Feature 2 — VPN check (non-blocking; shows overlay if VPN detected)
  checkVpnOnEntry();

  await loadRooms();
});

let _roomCountInterval = null;

async function loadRooms() {
  try {
    const { data: rooms, error } = await sbClient.from('rooms').select('*').order('name');
    if (error || !rooms?.length) return;
    cachedRooms = rooms;
    const textList = document.getElementById('room-list');
    if (textList) textList.innerHTML = '';
    rooms.forEach(room => {
      const icon = room.is_audio_enabled ? '🎤' : '💬';
      const li = document.createElement('li');
      li.textContent = `${icon} ${room.name}`;
      li.title = room.user_count != null ? `${room.name} — ${room.user_count} users` : room.name;
      li.dataset.roomId = String(room.id);
      li.onclick = () => enterRoom(room);
      if (textList) textList.appendChild(li);
    });
    renderRoomsTopbar(rooms);
    enterRoom(rooms[0]);
    if (!_roomCountInterval) _roomCountInterval = setInterval(refreshRoomCounts, 60000);
  } catch(e) { console.error('loadRooms error', e); }
}

async function refreshRoomCounts() {
  try {
    const { data: rooms } = await sbClient.from('rooms').select('id,user_count').order('name');
    if (!rooms) return;
    rooms.forEach(r => {
      const tab = document.querySelector(`.room-tab[data-room-id="${r.id}"]`);
      const badge = tab?.querySelector('.room-count-badge');
      if (badge && r.user_count != null) badge.textContent = r.user_count;
    });
  } catch(e) {}
}

function updateRoomTabCount(roomId, count) {
  return;
}

// Rooms are shown in the left sidebar only.
function renderRoomsTopbar(rooms) {
  const bar = document.getElementById('rooms-topbar');
  if (!bar) return;
  bar.innerHTML = '';
  bar.classList.add('hidden');
}

async function enterRoom(room) {
  if (currentRoom?.id === room.id) return;
  if (roomVoiceNoteRecorder?.state === 'recording') {
    discardRoomVoiceNoteOnStop = true;
    roomVoiceNoteRecorder.stop();
  }

  if (messageChannel) sbClient.removeChannel(messageChannel);
  if (presenceChannel) sbClient.removeChannel(presenceChannel);
  if (typeof leaveVoice === 'function') leaveVoice();

  currentRoom = room;
  const titleEl = document.getElementById('current-room-name');
  if (titleEl) titleEl.textContent = '# ' + room.name;
  document.getElementById('messages').innerHTML = '';
  onlineUsers = {};
  cameraStates = {};

  // Update active tab in topbar
  document.querySelectorAll('.room-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.roomId === String(currentRoom.id)));
  // Update active item in left sidebar room list
  document.querySelectorAll('#room-list li').forEach(li =>
    li.classList.toggle('active', li.dataset.roomId === String(currentRoom.id)));
  // Update topbar room name
  const el = document.getElementById('current-room-name');
  if (el) el.textContent = '# ' + currentRoom.name;

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
    closeRoomImageUrlInput(false);
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

  oldestMessageTimestamp = messages?.length ? messages[0].created_at : null;
  const loadMoreBtn = document.getElementById('btn-load-older');
  if (loadMoreBtn) loadMoreBtn.classList.toggle('hidden', !messages || messages.length < 50);

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
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'messages',
      filter: `room_id=eq.${room.id}`
    }, payload => {
      handleRealtimeMessageUpdate(payload.new);
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
      updateRoomTabCount(currentRoom.id, Object.keys(onlineUsers).length);
      scheduleRenderUserList();
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      newPresences.forEach(u => {
        onlineUsers[u.userId] = u;
        cameraStates[u.userId] = !!u.cameraOn;
      });
      updateRoomTabCount(currentRoom.id, Object.keys(onlineUsers).length);
      scheduleRenderUserList();
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences.forEach(u => {
        delete onlineUsers[u.userId];
        delete cameraStates[u.userId];
      });
      updateRoomTabCount(currentRoom.id, Object.keys(onlineUsers).length);
      scheduleRenderUserList();
    })
    .on('broadcast', { event: 'cam-view' }, ({ payload }) => {
      if (payload?.target === currentUser?.id) {
        showChatToast(`👁️ ${escHtml(payload.viewerName || 'Someone')} is viewing your camera`, 'info', 4000);
      }
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload?.userId === currentUser?.id) return;
      typingUsers.set(payload.userId, payload);
      if (!typingUsers._t) typingUsers._t = {};
      clearTimeout(typingUsers._t[payload.userId]);
      typingUsers._t[payload.userId] = setTimeout(() => { typingUsers.delete(payload.userId); updateTypingIndicator(); }, 3000);
      updateTypingIndicator();
    })
    .on('broadcast', { event: 'typing-stop' }, ({ payload }) => {
      typingUsers.delete(payload?.userId);
      updateTypingIndicator();
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
  const rawImageUrl = getRoomImageUrlValue();
  const imageUrl = rawImageUrl ? normalizeImageUrl(rawImageUrl) : '';
  const imagePopover = document.getElementById('room-image-url-popover');
  const isSendingImage = !imagePopover?.classList.contains('hidden') && !!rawImageUrl;
  if (!text && !isSendingImage) return;
  if (!currentRoom) {
    appendSystemMessage('No room selected. Please wait for rooms to load...');
    return;
  }
  if (currentRoom.is_locked) {
    appendSystemMessage('This room is locked by admin. Messaging is disabled.');
    return;
  }
  if (isSendingImage && !imageUrl) {
    showChatToast('Enter a valid http(s) image/GIF URL.', 'warning');
    document.getElementById('room-image-url-input')?.focus();
    return;
  }
  if (!isRegisteredUser() && !currentRoom?.is_audio_enabled) {
    const waitMs = getGuestMessageWaitMs(currentRoom.id);
    if (waitMs > 0) {
      showGuestRateLimitToast(waitMs);
      return;
    }
  }

  if (!isSendingImage) input.value = '';

  const { error } = await sbClient.from('messages').insert({
    room_id:  currentRoom.id,
    user_id:  currentUser.id,
    username: currentProfile.username,
    content:  isSendingImage ? imageUrl : text,
    type:     isSendingImage ? 'image' : 'text'
  });
  if (error) {
    appendSystemMessage(isSendingImage ? 'Could not share image. Please try again.' : 'Could not send message. Please try again.');
    return;
  }
  if (isSendingImage) {
    closeRoomImageUrlInput();
    showChatToast('Image/GIF shared in chat.', 'success');
  }
}

/* Builds a message DOM node without appending it (used for batch & single) */
function buildMessageNode(msg) {
  if (msg.type === 'system') {
    return buildSystemMessageNode(msg.content, msg.created_at);
  }

  if (msg.type === 'image') {
    return buildImageMessageNode(msg);
  }

  // FIX 2 — Voice note messages: show locked placeholder for guests
  if (msg.type === 'voice') {
    const isMe  = msg.user_id === currentUser?.id;
    const div   = document.createElement('div');
    div.className = 'msg-row' + (isMe ? ' self' : '');
    setMessageRowData(div, msg, sanitizeAudioSource(msg));
    const initial = (msg.username || '?')[0].toUpperCase();
    const color   = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);
    const avatarInner = isMe && currentProfile?.avatar_url
      ? `<img src="${escHtml(currentProfile.avatar_url)}" alt=""/>`
      : initial;
    const audioHtml = currentProfile?.is_registered
      ? `<audio controls src="${escHtml(msg.content)}"></audio>`
      : '<span class="vn-locked">\ud83d\udd12 Register to hear voice notes</span>';
    const deleteButton = buildDeleteButtonHtml(msg.user_id);
    div.innerHTML = `
      <div class="avatar" style="background:${color}">${avatarInner}</div>
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
  setMessageRowData(div, msg, msg.content || '');

  const initial = (msg.username || '?')[0].toUpperCase();
  const color   = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);
  const avatarInner = isMe && currentProfile?.avatar_url
    ? `<img src="${escHtml(currentProfile.avatar_url)}" alt=""/>`
    : initial;
  const deleteButton = buildDeleteButtonHtml(msg.user_id);

  div.innerHTML = `
    <div class="avatar" style="background:${color}">${avatarInner}</div>
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
  const div = buildSystemMessageNode(text, new Date().toISOString());
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
  const viewerLevel = getViewerRoleLevel();

  Object.values(onlineUsers).forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-item';
    li.dataset.userId = u.userId;
    const targetLevel = getRoleLevel(u);
    const showModeration = canModerate && u.userId !== currentUser?.id && viewerLevel > targetLevel;
    const roleBadge = getRoleBadgeHtml(u);
    const vipBadge  = u.isVip ? '<span class="role-badge vip" title="VIP">⭐</span>' : '';
    const viewerEye = onlineUsers[u.userId]?.viewingCam ? '<span class="viewer-eye" title="Watching a camera">👁️</span>' : '';
    li.innerHTML = `
      <span class="dot${u.registered ? '' : ' guest'}"></span>
      ${roleBadge}${vipBadge}
      <button type="button" class="user-name-btn${isGuest ? ' locked-action' : ''}" ${isGuest ? 'title="🔒 Register to start private chats"' : ''}>${escHtml(u.username)}</button>
      <canvas class="mini-soundbar" data-user-id="${u.userId}" width="32" height="10" aria-hidden="true"></canvas>
      ${viewerEye}
      <button type="button" class="camera-user-btn${cameraStates[u.userId] ? '' : ' hidden'}" data-user-id="${u.userId}" title="View camera">\ud83d\udcf7</button>
      ${showModeration ? `<button type="button" class="user-mod-btn kick" data-user-id="${u.userId}" title="Kick for 30 minutes">\u26a1</button>` : ''}
      ${showModeration ? `<button type="button" class="user-mod-btn ban" data-user-id="${u.userId}" title="Ban user">\ud83d\udeab</button>` : ''}
    `;

    // FIX 4 — Guests see "Register to DM" instead of opening private chat
    const nameBtn = li.querySelector('.user-name-btn');
    nameBtn?.addEventListener('click', () => {
      if (isGuest) {
        appendSystemMessage('\ud83d\udd12 Register to start private chats.');
        return;
      }
      if (typeof openPrivateChat === 'function') openPrivateChat(u.userId, u.username);
    });

    // Feature 1 — Hover profile card
    nameBtn?.addEventListener('mouseenter', () => scheduleProfileCard(u, nameBtn));
    nameBtn?.addEventListener('mouseleave', cancelProfileCard);

    li.querySelector('.camera-user-btn')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (typeof showCamInArea === 'function') {
        showCamInArea(u.userId, u.username);
      } else if (typeof openFloatingCamera === 'function') {
        openFloatingCamera(u.userId, u.username);
      }
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

  // Update room-users-bar
  const bar = document.getElementById('room-users-bar');
  if (bar) {
    bar.innerHTML = '';
    const bfrag = document.createDocumentFragment();
    Object.values(onlineUsers).forEach(u => {
      const pill = document.createElement('span');
      pill.className = 'room-user-pill';
      const dot = u.registered ? '🟢' : '👤';
      pill.textContent = `${dot} ${u.username}`;
      bfrag.appendChild(pill);
    });
    bar.appendChild(bfrag);
  }
}

/* Instant scroll — bypasses CSS scroll-behavior for real-time feel */
function scrollToBottom() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

/* ── Load Older Messages (pagination) ── */
async function loadOlderMessages() {
  if (isLoadingOlderMessages || !currentRoom || !oldestMessageTimestamp) return;
  isLoadingOlderMessages = true;
  const btn = document.getElementById('btn-load-older');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

  const { data: older } = await sbClient
    .from('messages')
    .select('*')
    .eq('room_id', currentRoom.id)
    .lt('created_at', oldestMessageTimestamp)
    .order('created_at', { ascending: false })
    .limit(50);

  isLoadingOlderMessages = false;
  if (btn) { btn.disabled = false; btn.textContent = '⬆ Load older messages'; }

  if (!older?.length) {
    if (btn) { btn.classList.add('hidden'); btn.textContent = 'No more messages'; }
    return;
  }

  const container = document.getElementById('messages');
  const prevScrollHeight = container.scrollHeight;
  const frag = document.createDocumentFragment();

  [...older].reverse().forEach(m => {
    const node = buildMessageNode(m);
    if (node) frag.appendChild(node);
  });
  container.insertBefore(frag, container.firstChild);
  container.scrollTop = container.scrollHeight - prevScrollHeight;

  oldestMessageTimestamp = older[older.length - 1].created_at;
  if (older.length < 50 && btn) btn.classList.add('hidden');
}

/* ── Message Search ── */
function searchMessages(query) {
  const q = (query || '').trim().toLowerCase();
  const rows = document.getElementById('messages')?.querySelectorAll('.msg-row');
  let matchCount = 0;
  rows?.forEach(row => {
    if (!q) {
      row.classList.remove('search-hidden', 'search-match');
      return;
    }
    const text = (row.querySelector('.msg-text')?.textContent || '').toLowerCase();
    const user = (row.querySelector('.msg-username')?.textContent || '').toLowerCase();
    if (text.includes(q) || user.includes(q)) {
      row.classList.remove('search-hidden');
      row.classList.add('search-match');
      matchCount++;
    } else {
      row.classList.add('search-hidden');
      row.classList.remove('search-match');
    }
  });
  const counter = document.getElementById('search-count');
  if (counter) counter.textContent = q ? `${matchCount} result${matchCount !== 1 ? 's' : ''}` : '';
}

function clearSearch() {
  const input = document.getElementById('search-input');
  if (input) { input.value = ''; searchMessages(''); }
  const counter = document.getElementById('search-count');
  if (counter) counter.textContent = '';
}

/* ── Blocked overlay (replaces alert for ban/kick) ── */
function showBlockedOverlay(message) {
  let overlay = document.getElementById('cc-blocked-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'cc-blocked-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.92)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'flex-direction:column', 'gap:18px', 'color:#dde3f0',
      'font-size:1.1rem', 'text-align:center', 'padding:32px',
      'z-index:99999', 'backdrop-filter:blur(6px)'
    ].join(';');
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div style="font-size:3.5rem">🚫</div>
    <div style="font-size:1.15rem;font-weight:600;max-width:380px">${escHtml(message)}</div>
    <div style="color:#7e8eaa;font-size:0.85rem">Signing you out and redirecting…</div>
  `;
}

/* ── Typing indicator ── */
function updateTypingIndicator() {
  let el = document.getElementById('typing-indicator');
  const others = [...typingUsers.values()].filter(u => u.userId !== currentUser?.id);
  if (!others.length) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'typing-indicator';
    el.className = 'typing-indicator';
    document.getElementById('messages')?.after(el);
  }
  const names = others.slice(0, 3).map(u => escHtml(u.username)).join(', ');
  el.textContent = `✏️ ${names} ${others.length === 1 ? 'is' : 'are'} typing…`;
}

/* ── Cam view broadcasting ── */
async function broadcastCamView(targetUserId) {
  if (!presenceChannel || !currentUser?.id || !currentProfile) return;
  try {
    await presenceChannel.send({
      type: 'broadcast',
      event: 'cam-view',
      payload: { viewer: currentUser.id, viewerName: currentProfile.username, target: targetUserId }
    });
  } catch (_) {}
}

function markSelfAsViewer(on) {
  if (!currentUser?.id) return;
  if (on) activeCamViewers.add(currentUser.id);
  else activeCamViewers.delete(currentUser.id);
  scheduleRenderUserList();
  if (presenceChannel) {
    presenceBaseData.viewingCam = !!on;
    presenceChannel.track(presenceBaseData).catch(() => {});
  }
}

/* ── Join Voice Quick (from input bar button) ── */
function joinVoiceQuick() {
  if (!currentRoom?.is_audio_enabled) {
    showChatToast('This room does not support voice chat.', 'warning');
    return;
  }
  if (typeof inVoice !== 'undefined' && inVoice) {
    if (typeof leaveVoice === 'function') leaveVoice();
  } else {
    if (typeof joinVoice === 'function') joinVoice();
  }
}

/* ── Cam Area: show a user's camera stream inside #cam-area ── */
let _camAreaStream = null;
let _camAreaUserId = null;

function showCamInArea(userId, username) {
  const area = document.getElementById('cam-window-area');
  if (!area) {
    if (typeof openFloatingCamera === 'function') openFloatingCamera(userId, username);
    return;
  }

  // If audio.js has a peer stream, use it; otherwise delegate to openFloatingCamera
  let stream = null;
  if (typeof peerConnections !== 'undefined' && peerConnections[userId]) {
    const receivers = peerConnections[userId].getReceivers?.() || [];
    const videoReceiver = receivers.find(r => r.track?.kind === 'video');
    if (videoReceiver?.track) {
      stream = new MediaStream([videoReceiver.track]);
    }
  }

  if (!stream) {
    // Delegate to audio.js floating camera and mirror the video element
    if (typeof openFloatingCamera === 'function') openFloatingCamera(userId, username);
    // Mirror: after short delay, grab video from floating window into cam-area
    setTimeout(() => _mirrorFloatingCamToArea(userId, username), 200);
    return;
  }

  _placeCamInArea(stream, userId, username);
}

function _mirrorFloatingCamToArea(userId, username) {
  const floatWin = document.getElementById('floating-camera-window');
  const floatVid = document.getElementById('floating-camera-video');
  if (!floatVid || !floatVid.srcObject) return;
  _placeCamInArea(floatVid.srcObject, userId, username);
  // Hide floating window now that cam-area is showing
  if (floatWin) floatWin.classList.add('hidden');
}

function _placeCamInArea(stream, userId, username) {
  const area = document.getElementById('cam-window-area');
  const video = document.getElementById('cam-video');
  const usernameEl = document.getElementById('cam-window-username');
  const minBtn = document.getElementById('btn-cam-minimize');
  const closeBtn = document.getElementById('btn-cam-close');
  if (!area) return;

  // Stop any previous stream in cam window
  _clearCamArea(false);

  _camAreaStream = stream;
  _camAreaUserId = userId;
  if (usernameEl) usernameEl.textContent = username || '';
  if (video) video.srcObject = stream;
  if (minBtn) minBtn.onclick = () => _minimizeCamToBar(userId, username, stream);
  if (closeBtn) closeBtn.onclick = () => _clearCamArea(true);
  area.style.display = '';
}

function _clearCamArea(stopStream) {
  const area = document.getElementById('cam-window-area');
  const video = document.getElementById('cam-video');
  const usernameEl = document.getElementById('cam-window-username');
  if (!area) return;

  if (video) {
    if (stopStream && video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
    }
    video.srcObject = null;
  }
  if (usernameEl) usernameEl.textContent = '';
  area.style.display = 'none';
  _camAreaStream = null;
  _camAreaUserId = null;
}

function _minimizeCamToBar(userId, username, stream) {
  _clearCamArea(false);
  const bar = document.getElementById('minimized-cams-bar');
  if (!bar) return;

  const pill = document.createElement('div');
  pill.className = 'mini-cam-item';
  pill.dataset.userId = userId;

  const thumb = document.createElement('video');
  thumb.className = 'mini-cam-thumb';
  thumb.autoplay = true;
  thumb.playsInline = true;
  thumb.muted = true;
  thumb.srcObject = stream;

  const label = document.createElement('span');
  label.textContent = username || 'User';

  pill.onclick = () => {
    pill.remove();
    _placeCamInArea(stream, userId, username);
  };

  pill.appendChild(thumb);
  pill.appendChild(label);
  bar.appendChild(pill);
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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

function canDeleteAnyMessage() {
  return currentProfile?.is_owner === true || canRunQuickModeration();
}

function canDeleteMessageForUserId(userId) {
  if (!currentUser?.id) return false;
  return userId === currentUser.id || canDeleteAnyMessage();
}

function buildDeleteButtonHtml(userId) {
  if (!canDeleteMessageForUserId(userId)) return '';
  const title = userId === currentUser?.id
    ? 'Delete permanently for everyone'
    : 'Delete this message as admin/moderator';
  return `<button type="button" class="msg-local-delete" title="${escHtml(title)}">🗑️</button>`;
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
  const imageBtn = document.getElementById('btn-image-url');
  const voiceBtn = document.getElementById('btn-voice-note');
  const joinVoiceQuickBtn = document.getElementById('btn-join-voice-quick');
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
    if (imageBtn) {
      imageBtn.classList.remove('hidden');
      imageBtn.disabled = isLocked;
      imageBtn.title = '';
    }
    if (voiceBtn) {
      voiceBtn.style.display = '';
      voiceBtn.disabled = false;
      voiceBtn.title = '🎙️ Send a voice note (1 free for guests)';
    }
    if (joinVoiceQuickBtn) {
      joinVoiceQuickBtn.style.display = '';
      joinVoiceQuickBtn.disabled = false;
      joinVoiceQuickBtn.title = 'Join Voice Chat';
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
  if (imageBtn) {
    imageBtn.classList.remove('hidden');
    imageBtn.disabled = isLocked;
    imageBtn.title = '';
  }
  if (voiceBtn) {
    voiceBtn.style.display = '';
    voiceBtn.disabled = isLocked;
    voiceBtn.title = '';
  }
  if (joinVoiceQuickBtn) {
    joinVoiceQuickBtn.style.display = '';
    joinVoiceQuickBtn.disabled = isLocked;
    joinVoiceQuickBtn.title = 'Join Voice Chat';
  }
}

function setMessageRowData(row, msg, content) {
  if (!row) return;
  row.dataset.messageId = msg?.id || '';
  row.dataset.userId = msg?.user_id || '';
  row.dataset.messageType = msg?.type || 'text';
  row.dataset.messageContent = content || '';
  row.dataset.createdAt = msg?.created_at || '';
}

function normalizeImageUrl(value) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    if (!/\.(apng|avif|bmp|gif|ico|jpe?g|jfif|png|svg|webp)$/i.test(parsed.pathname)) return '';
    return parsed.href;
  } catch (_) {
    return '';
  }
}

function sanitizeImageSource(msg) {
  return normalizeImageUrl(msg?.image_url || msg?.content || '');
}

function sanitizeAudioSource(msg) {
  const source = msg?.audio_url || msg?.voice_url || msg?.content || '';
  if (!source) return '';
  if (source.startsWith('data:audio/') || source.startsWith('blob:') || source.startsWith('https://') || source.startsWith('http://')) {
    return source;
  }
  return '';
}

function buildImageMessageNode(msg) {
  const isMe  = msg.user_id === currentUser?.id;
  const div   = document.createElement('div');
  div.className = 'msg-row' + (isMe ? ' self' : '');
  const imageSrc = sanitizeImageSource(msg);
  setMessageRowData(div, msg, imageSrc || msg?.content || '');

  const initial = (msg.username || '?')[0].toUpperCase();
  const color   = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);
  const avatarInner = isMe && currentProfile?.avatar_url
    ? `<img src="${escHtml(currentProfile.avatar_url)}" alt=""/>`
    : initial;
  const deleteButton = buildDeleteButtonHtml(msg.user_id);
  const imageMarkup = imageSrc
    ? `
      <img class="msg-inline-image" src="${escHtml(imageSrc)}" alt="Shared image" loading="lazy"/>
      <div class="msg-image-error hidden">⚠️ Image could not be loaded.</div>
      <a class="msg-image-link" href="${escHtml(imageSrc)}" target="_blank" rel="noopener noreferrer">Open image</a>
    `
    : '<div class="msg-image-error">⚠️ Invalid image URL.</div>';

  div.innerHTML = `
    <div class="avatar" style="background:${color}">${avatarInner}</div>
    <div class="msg-bubble">
      ${deleteButton}
      <div class="msg-username">${escHtml(msg.username || 'Unknown')}</div>
      <div class="msg-text">${imageMarkup}</div>
      <div class="msg-time">${formatTime(msg.created_at)}</div>
    </div>`;

  const image = div.querySelector('.msg-inline-image');
  const error = div.querySelector('.msg-image-error');
  image?.addEventListener('error', () => {
    image.remove();
    if (error) error.classList.remove('hidden');
  }, { once: true });

  return div;
}

function appendVoiceNoteMessage(msg, isMe) {
  const div = document.createElement('div');
  div.className = 'msg-row' + (isMe ? ' self' : '');
  setMessageRowData(div, msg, sanitizeAudioSource(msg));

  const initial = (msg.username || '?')[0].toUpperCase();
  const color = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);
  const voiceSrc = sanitizeAudioSource(msg);

  const voiceMarkup = isRegisteredUser()
    ? (voiceSrc ? `<audio controls preload="none" src="${escHtml(voiceSrc)}"></audio>` : '<div class="msg-text">Voice note unavailable.</div>')
    : '<div class="msg-text">🔒 Voice notes are for registered users only.</div>';
  const deleteButton = buildDeleteButtonHtml(msg.user_id);

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

function showChatToast(text, variant = 'success', timeoutMs = 2200) {
  const wrap = ensureChatToastWrap();
  const toast = document.createElement('div');
  toast.className = `chat-toast ${variant}`.trim();
  toast.textContent = text;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), timeoutMs);
}

function setVoiceNoteButtonState(isRecording) {
  const voiceBtn = document.getElementById('btn-voice-note');
  if (!voiceBtn) return;
  voiceBtn.classList.toggle('recording', !!isRecording);
  voiceBtn.textContent = isRecording ? '⏹️' : '🎙️';
  voiceBtn.title = isRecording ? 'Stop and send voice note' : 'Voice note';
}

function stopRoomVoiceNoteStream() {
  roomVoiceNoteStream?.getTracks()?.forEach(track => track.stop());
  roomVoiceNoteStream = null;
}

function roomVoiceBlobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getVoiceNoteStartErrorMessage(error) {
  if (!error) return 'Could not start voice note recording.';
  if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
    return 'Microphone permission denied.';
  }
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return 'No microphone was found.';
  }
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return 'Microphone is busy in another app.';
  }
  return 'Could not start voice note recording.';
}

async function sendVoiceNote() {
  if (!isRegisteredUser()) {
    const usedCount = parseInt(localStorage.getItem('cc-guest-voice-used') || '0', 10);
    if (usedCount >= GUEST_VOICE_LIMIT) {
      showRegisterForVoice();
      return;
    }
  }
  if (currentRoom?.is_locked) {
    appendSystemMessage('This room is locked by admin. Voice notes are disabled.');
    return;
  }
  if (!currentRoom?.id) return;
  if (roomVoiceNoteRecorder?.state === 'recording') {
    roomVoiceNoteRecorder.stop();
    return;
  }
  if (roomVoiceNoteStarting) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    appendSystemMessage('Your browser does not support voice notes.');
    return;
  }

  roomVoiceNoteStarting = true;
  try {
    roomVoiceNoteStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    roomVoiceNoteChunks = [];
    roomVoiceNoteRecorder = new MediaRecorder(roomVoiceNoteStream);
    roomVoiceNoteRoomId = currentRoom.id;
    discardRoomVoiceNoteOnStop = false;

    roomVoiceNoteRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) roomVoiceNoteChunks.push(event.data);
    };

    roomVoiceNoteRecorder.onerror = () => {
      appendSystemMessage('Voice note recording failed.');
    };

    roomVoiceNoteRecorder.onstop = async () => {
      setVoiceNoteButtonState(false);
      stopRoomVoiceNoteStream();

      const chunks = roomVoiceNoteChunks.slice();
      roomVoiceNoteChunks = [];
      roomVoiceNoteRecorder = null;
      const roomIdForVoiceNote = roomVoiceNoteRoomId;
      roomVoiceNoteRoomId = null;

      if (discardRoomVoiceNoteOnStop) {
        discardRoomVoiceNoteOnStop = false;
        return;
      }

      if (!chunks.length) {
        appendSystemMessage('Voice note cancelled.');
        return;
      }

      try {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const dataUrl = await roomVoiceBlobToDataUrl(blob);
        const { error } = await sbClient.from('messages').insert({
          room_id: roomIdForVoiceNote,
          user_id: currentUser.id,
          username: currentProfile.username,
          content: dataUrl,
          type: 'voice'
        });
        if (error) {
          appendSystemMessage('Could not send voice note. Please try again.');
        } else if (!isRegisteredUser()) {
          const newCount = parseInt(localStorage.getItem('cc-guest-voice-used') || '0', 10) + 1;
          localStorage.setItem('cc-guest-voice-used', String(newCount));
          if (newCount >= GUEST_VOICE_LIMIT) {
            setTimeout(() => showRegisterForVoice(), 800);
          }
        }
      } catch (_) {
        appendSystemMessage('Could not send voice note. Please try again.');
      }
    };

    roomVoiceNoteRecorder.start();
    setVoiceNoteButtonState(true);
    appendSystemMessage('🎙️ Recording voice note… click again to send.');
  } catch (error) {
    appendSystemMessage(getVoiceNoteStartErrorMessage(error));
    setVoiceNoteButtonState(false);
    stopRoomVoiceNoteStream();
    roomVoiceNoteChunks = [];
    roomVoiceNoteRecorder = null;
    roomVoiceNoteRoomId = null;
    discardRoomVoiceNoteOnStop = false;
  } finally {
    roomVoiceNoteStarting = false;
  }
}

function showRegisterForVoice() {
  const existing = document.getElementById('register-for-voice-popup');
  if (existing) { existing.remove(); }
  const popup = document.createElement('div');
  popup.id = 'register-for-voice-popup';
  popup.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--surface);color:var(--text);border:1px solid var(--border,#444);border-radius:12px;padding:16px 20px;max-width:320px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,.4);text-align:center;';
  popup.innerHTML = `
    <p style="margin:0 0 12px;font-size:15px;">🎙️ You've used your 1 free voice note!<br>Sign in or register for a permanent account and unlimited voice notes.</p>
    <div style="display:flex;gap:8px;justify-content:center;">
      <a href="${AUTH_ENTRY_PAGE_URL}" style="background:var(--accent,#7c3aed);color:#fff;padding:7px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Login</a>
      <button onclick="document.getElementById('register-for-voice-popup')?.remove()" style="background:var(--surface2,#333);color:var(--text);border:none;padding:7px 14px;border-radius:8px;cursor:pointer;">Close</button>
    </div>`;
  document.body.appendChild(popup);
}

function removeMessageNodeById(messageId) {
  if (!messageId) return;
  const row = document
    .querySelector(`#messages .msg-row[data-message-id="${CSS.escape(String(messageId))}"]`);
  if (!row) return;
  row.classList.add('is-deleting');
  setTimeout(() => row.remove(), 220);
}

function buildSystemMessageNode(content, createdAt) {
  const div = document.createElement('div');
  const text = String(content || '');
  const isDeletionNotice = text.startsWith(DELETED_MESSAGE_PREFIX);
  const time = formatTime(createdAt);
  div.className = `msg-system${isDeletionNotice ? ' msg-system-deleted' : ''}`;
  div.innerHTML = `
    <span class="msg-system-text">${isDeletionNotice ? escHtml(text) : `— ${escHtml(text)} —`}</span>
    ${time ? `<span class="msg-system-time">${escHtml(time)}</span>` : ''}
  `;
  return div;
}

function handleRealtimeMessageUpdate(msg) {
  if (!msg?.id || !msg?.is_deleted) return;
  const deletedBy = msg.deleted_by || msg.username || 'Moderator';
  const replacement = buildSystemMessageNode(
    `${DELETED_MESSAGE_PREFIX}${deletedBy}`,
    msg.deleted_at || msg.updated_at || new Date().toISOString()
  );
  const row = document.querySelector(`#messages .msg-row[data-message-id="${CSS.escape(String(msg.id))}"]`);
  if (!row) return;
  row.replaceWith(replacement);
}

async function deleteMessageForEveryone(messageId, targetUserId, targetUsername) {
  const deletingOwn = targetUserId === currentUser?.id;
  const deletingAsModerator = !deletingOwn && canDeleteAnyMessage();
  const { error: deleteError } = await sbClient.from('messages').delete().eq('id', messageId);
  if (deleteError) throw deleteError;

  if (deletingAsModerator && currentRoom?.id) {
    const deleterName = currentProfile?.username || 'Admin';
    const { error: placeholderError } = await sbClient.from('messages').insert({
      room_id: currentRoom.id,
      user_id: currentUser.id,
      username: deleterName,
      content: `${DELETED_MESSAGE_PREFIX}${deleterName}`,
      type: 'system'
    });
    if (placeholderError) {
      console.warn('Failed to write moderation deletion placeholder', {
        deleterId: currentUser?.id,
        targetUserId,
        targetUsername,
        messageId,
        error: placeholderError.message
      });
    }
  }
}

function archiveClearedMessageRows(rows, reason = 'clear-my-messages') {
  if (!rows?.length) return 0;
  try {
    const existing = JSON.parse(localStorage.getItem(CLEARED_MESSAGE_ARCHIVE_KEY) || '[]');
    const archivedRows = rows.map(row => ({
      messageId: row.dataset.messageId || '',
      userId: row.dataset.userId || '',
      username: row.querySelector('.msg-username')?.textContent || currentProfile?.username || 'Unknown',
      type: row.dataset.messageType || 'text',
      content: row.dataset.messageContent || '',
      createdAt: row.dataset.createdAt || '',
      roomId: currentRoom?.id || '',
      roomName: currentRoom?.name || '',
      clearedAt: new Date().toISOString(),
      reason
    }));
    localStorage.setItem(
      CLEARED_MESSAGE_ARCHIVE_KEY,
      JSON.stringify(existing.concat(archivedRows).slice(-MAX_CLEARED_MESSAGE_ARCHIVE_ITEMS))
    );
    return archivedRows.length;
  } catch (_) {
    return 0;
  }
}

async function clearMyMessagesFromScreen() {
  if (!currentUser?.id) return;
  const mine = Array.from(document.querySelectorAll(`#messages .msg-row[data-user-id="${CSS.escape(currentUser.id)}"]`));
  if (!mine.length) {
    showChatToast('No messages to delete.', 'warning');
    return;
  }
  const messageIds = mine.map(row => row.dataset.messageId).filter(Boolean);
  if (!messageIds.length) {
    showChatToast('No deletable messages found.', 'warning');
    return;
  }
  const clearBtn = document.getElementById('btn-clear-my-messages');
  if (clearBtn) {
    clearBtn.disabled = true;
    clearBtn.textContent = 'Deleting…';
  }
  const archivedCount = archiveClearedMessageRows(mine, 'clear-my-messages-db');
  const { error } = await sbClient.from('messages').delete().in('id', messageIds).eq('room_id', currentRoom?.id);
  if (error) {
    showChatToast(`Could not delete messages: ${error.message}`, 'warning', 3200);
    console.warn('Failed to clear messages permanently', {
      userId: currentUser?.id,
      roomId: currentRoom?.id,
      count: messageIds.length,
      error: error.message
    });
    if (clearBtn) {
      clearBtn.disabled = false;
      clearBtn.textContent = 'Clear My Messages';
    }
    return;
  }
  mine.forEach(node => {
    node.classList.add('is-deleting');
    setTimeout(() => node.remove(), 240);
  });
  if (clearBtn) {
    clearBtn.textContent = 'Deleted ✓';
    setTimeout(() => {
      clearBtn.disabled = false;
      clearBtn.textContent = 'Clear My Messages';
    }, 1800);
  }
  showChatToast(`Deleted ${mine.length} message${mine.length === 1 ? '' : 's'} for everyone${archivedCount ? ' and saved to your archive.' : '.'}`, 'success');
}

function clearMyMessages() {
  return clearMyMessagesFromScreen();
}

document.addEventListener('click', async (event) => {
  const deleteBtn = event.target.closest('.msg-local-delete');
  if (!deleteBtn) return;
  const row = deleteBtn.closest('.msg-row');
  if (!row) return;
  const targetUserId = row.dataset.userId || '';
  const messageId = row.dataset.messageId || '';
  const targetUsername = row.querySelector('.msg-username')?.textContent || 'Unknown';
  if (!messageId) return;
  if (!canDeleteMessageForUserId(targetUserId)) {
    showChatToast('You do not have permission to delete this message.', 'warning', 3200);
    console.warn('Blocked unauthorized message deletion attempt', {
      actorId: currentUser?.id,
      actorName: currentProfile?.username,
      targetUserId,
      targetUsername,
      messageId,
      roomId: currentRoom?.id
    });
    return;
  }
  deleteBtn.disabled = true;
  deleteBtn.textContent = '…';
  row.classList.add('is-deleting');
  archiveClearedMessageRows([row], 'single-message-remove');
  try {
    await deleteMessageForEveryone(messageId, targetUserId, targetUsername);
    removeMessageNodeById(messageId);
  } catch (error) {
    row.classList.remove('is-deleting');
    deleteBtn.disabled = false;
    deleteBtn.textContent = '🗑️';
    showChatToast(`Could not delete message: ${error.message || 'Please try again.'}`, 'warning', 3200);
    console.warn('Message deletion failed', {
      actorId: currentUser?.id,
      actorName: currentProfile?.username,
      targetUserId,
      targetUsername,
      messageId,
      roomId: currentRoom?.id,
      error: error?.message || error
    });
  }
});

/* ════════════════════════════════════════════════════════════════
   Feature 1 — Hover Profile Card & Role Hierarchy
════════════════════════════════════════════════════════════════ */

/* Role level: Guest=0, User=1, Mod=2, Admin=3, Owner=4 */
function getRoleLevel(u) {
  if (u.isOwner || u.is_owner) return 4;
  if (u.isAdmin || u.is_admin) return 3;
  if (u.isMod   || u.is_mod)   return 2;
  if (u.registered || u.is_registered) return 1;
  return 0;
}

function getViewerRoleLevel() {
  return getRoleLevel(currentProfile || {});
}

function getRoleBadgeHtml(u) {
  if (u.isOwner || u.is_owner) return '<span class="role-badge owner" title="Owner">👑</span>';
  if (u.isAdmin || u.is_admin) return '<span class="role-badge admin" title="Admin">🛡️</span>';
  if (u.isMod   || u.is_mod)   return '<span class="role-badge mod" title="Moderator">🔨</span>';
  if (u.registered || u.is_registered) return '<span class="role-badge user" title="User">✅</span>';
  return '<span class="role-badge guest" title="Guest">👤</span>';
}

function getRoleLabel(u) {
  if (u.isOwner || u.is_owner) return 'Owner';
  if (u.isAdmin || u.is_admin) return 'Admin';
  if (u.isMod   || u.is_mod)   return 'Moderator';
  if (u.registered || u.is_registered) return 'User';
  return 'Guest';
}

let _pcTimer  = null;
let _pcHide   = null;
let _pcActive = null;

function scheduleProfileCard(u, anchor) {
  clearTimeout(_pcTimer);
  clearTimeout(_pcHide);
  _pcTimer = setTimeout(() => showProfileCard(u, anchor), 350);
}

function cancelProfileCard() {
  clearTimeout(_pcTimer);
  // Small grace period so user can move cursor into the card
  _pcHide = setTimeout(() => hideProfileCard(), 220);
}

function hideProfileCard() {
  if (_pcActive) {
    _pcActive.remove();
    _pcActive = null;
  }
}

async function showProfileCard(u, anchor) {
  hideProfileCard();

  // Fetch full profile for join date, IP, avatar, VIP status
  let profile = null;
  try {
    const { data } = await sbClient.from('profiles').select('*').eq('id', u.userId).single();
    profile = data;
  } catch (_) {}
  if (!profile) return;

  const viewerLevel  = getViewerRoleLevel();
  const targetLevel  = getRoleLevel(u);
  const canSeeIp     = viewerLevel >= 3;
  const canBan       = viewerLevel > targetLevel && u.userId !== currentUser?.id;
  const canGrantVip  = viewerLevel >= 3 && targetLevel === 1; // Admin/Owner → regular Users only
  const isVip        = !!(profile.is_vip);

  const roleLabel = getRoleLabel(u);
  const roleBadge = getRoleBadgeHtml(u);
  const vipBadge  = isVip ? '<span class="role-badge vip" title="VIP">⭐</span>' : '';
  const joinDate  = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Unknown';

  const avatarHtml = profile.avatar_url
    ? `<img class="pc-avatar-img" src="${escHtml(profile.avatar_url)}" alt=""/>`
    : `<div class="pc-avatar-init" style="background:${escHtml(profile.avatar_color || '#7c3aed')}">${(profile.username || '?')[0].toUpperCase()}</div>`;

  const ipRow  = canSeeIp && profile.last_ip
    ? `<div class="pc-ip">🌐 ${escHtml(profile.last_ip)}</div>`
    : '';
  const banBtn = canBan
    ? `<button class="pc-ban-btn" type="button" data-uid="${escHtml(u.userId)}">🚫 Ban</button>`
    : '';
  const vipBtn = canGrantVip
    ? `<button class="pc-vip-btn" type="button" data-uid="${escHtml(u.userId)}" data-action="${isVip ? 'revoke' : 'grant'}">${isVip ? '⭐ Revoke VIP' : '⭐ Grant VIP'}</button>`
    : '';

  const card = document.createElement('div');
  card.id = 'profile-card';
  card.className = 'profile-card';
  card.innerHTML = `
    <div class="pc-header">
      ${avatarHtml}
      <div class="pc-info">
        <div class="pc-name">${escHtml(profile.username || 'Unknown')} ${vipBadge}</div>
        <div class="pc-role">${roleBadge} ${escHtml(roleLabel)}</div>
      </div>
    </div>
    <div class="pc-join">📅 Joined ${escHtml(joinDate)}</div>
    ${ipRow}
    <div class="pc-actions">${banBtn}${vipBtn}</div>
  `;

  document.body.appendChild(card);
  _pcActive = card;

  // Position: right of the anchor, clamped to viewport
  const rect = anchor.getBoundingClientRect();
  let top  = rect.top;
  let left = rect.right + 8;
  card.style.visibility = 'hidden';
  card.style.left = left + 'px';
  card.style.top  = top  + 'px';

  requestAnimationFrame(() => {
    const cr = card.getBoundingClientRect();
    if (cr.right  > window.innerWidth  - 8) left = rect.left - cr.width - 8;
    if (cr.bottom > window.innerHeight - 8) top  = window.innerHeight - cr.height - 8;
    card.style.left = left + 'px';
    card.style.top  = top  + 'px';
    card.style.visibility = 'visible';
  });

  // Keep card alive when mouse enters it
  card.addEventListener('mouseenter', () => { clearTimeout(_pcHide); });
  card.addEventListener('mouseleave', () => hideProfileCard());

  card.querySelector('.pc-ban-btn')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    hideProfileCard();
    quickBanUser(u.userId, u.username);
  });

  card.querySelector('.pc-vip-btn')?.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    const grant = ev.currentTarget.dataset.action === 'grant';
    await toggleVip(u.userId, u.username, grant);
    hideProfileCard();
  });
}

/* ════════════════════════════════════════════════════════════════
   Feature 4 — VIP Management
════════════════════════════════════════════════════════════════ */
async function toggleVip(userId, username, grant) {
  const { error } = await sbClient.from('profiles')
    .update({ is_vip: grant })
    .eq('id', userId);
  if (error) {
    appendSystemMessage(`VIP update failed: ${error.message}`);
    return;
  }
  // Update presence for the target if they're online in current room
  if (onlineUsers[userId]) onlineUsers[userId].isVip = grant;
  scheduleRenderUserList();
  appendSystemMessage(`⭐ ${username || 'User'} VIP status ${grant ? 'granted' : 'revoked'}.`);
}

/* ════════════════════════════════════════════════════════════════
   Feature 2 — Chatroom VPN Gatekeeper
════════════════════════════════════════════════════════════════ */
async function checkVpnOnEntry() {
  try {
    const res = await fetch('https://ipwho.is/');
    if (!res.ok) { console.warn('VPN check: API unavailable, allowing entry'); return; }
    const data = await res.json();
    const conn = data.connection || {};
    if (conn.proxy || conn.vpn || conn.tor || conn.hosting) {
      showVpnBlocker();
    }
  } catch (e) {
    console.warn('VPN check failed, allowing entry:', e);
  }
}

function showVpnBlocker() {
  const overlay = document.getElementById('vpn-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

/* ════════════════════════════════════════════════════════════════
   Feature 3 — Dynamic Avatar Scaling
════════════════════════════════════════════════════════════════ */
function openAvatarUpload() {
  if (!isRegisteredUser()) {
    appendSystemMessage('🔒 Avatar upload is for registered users only.');
    return;
  }
  const modal = document.getElementById('avatar-upload-modal');
  if (!modal) return;
  // Reset state
  const preview = document.getElementById('avatar-preview');
  const hint    = document.getElementById('avatar-upload-hint');
  const errorEl = document.getElementById('avatar-upload-error');
  const saveBtn = document.getElementById('btn-save-avatar');
  const fileInput = document.getElementById('avatar-file-input');
  if (preview)   { preview.src = ''; preview.classList.add('hidden'); }
  if (hint)      hint.textContent = 'Select an image to preview your avatar.';
  if (errorEl)   { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
  if (saveBtn)   saveBtn.disabled = true;
  if (fileInput) fileInput.value = '';
  modal.classList.remove('hidden');
}

function closeAvatarUpload() {
  const modal = document.getElementById('avatar-upload-modal');
  const errorEl = document.getElementById('avatar-upload-error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
  if (modal) modal.classList.add('hidden');
}

function setAvatarUploadError(message) {
  const errorEl = document.getElementById('avatar-upload-error');
  if (!errorEl) return;
  const text = String(message || '').trim();
  errorEl.textContent = text;
  errorEl.classList.toggle('hidden', !text);
}

function onAvatarFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file || !file.type.startsWith('image/')) {
    setAvatarUploadError('❌ Please choose a valid image file.');
    return;
  }
  setAvatarUploadError('');
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => renderAvatarPreview(img);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderAvatarPreview(img) {
  const canvas = document.getElementById('avatar-canvas');
  if (!canvas) return;
  const SIZE = 100;
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  // Center-crop: cover (not stretch) — pick the smaller dimension
  const srcAspect = img.naturalWidth / img.naturalHeight;
  let sx, sy, sw, sh;
  if (srcAspect >= 1) {
    // Landscape or square: fit height, crop width
    sh = img.naturalHeight;
    sw = img.naturalHeight;
    sx = (img.naturalWidth  - sw) / 2;
    sy = 0;
  } else {
    // Portrait: fit width, crop height
    sw = img.naturalWidth;
    sh = img.naturalWidth;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);

  const preview = document.getElementById('avatar-preview');
  const hint    = document.getElementById('avatar-upload-hint');
  const saveBtn = document.getElementById('btn-save-avatar');

  if (preview) {
    preview.src = canvas.toDataURL('image/jpeg', 0.85);
    preview.classList.remove('hidden');
  }
  if (hint)    hint.textContent = '100 × 100 px preview (center-cropped)';
  if (saveBtn) saveBtn.disabled = false;
  setAvatarUploadError('');
}

async function saveAvatar() {
  const canvas = document.getElementById('avatar-canvas');
  if (!canvas) return;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  if (!dataUrl || dataUrl === 'data:,') return;
  setAvatarUploadError('');
  const saveBtn = document.getElementById('btn-save-avatar');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
  try {
    localStorage.setItem('cc-avatar-' + currentUser.id, dataUrl);
    currentProfile.avatar_url = dataUrl;
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
    closeAvatarUpload();
    appendSystemMessage('✅ Avatar updated!');
  } catch (_) {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
    setAvatarUploadError('❌ Could not save avatar. Please try again.');
  }
}
