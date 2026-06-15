/* ══ Theme Management ═══════════════════════════════════════════
   Reads/writes localStorage key 'cc-theme'.
   Syncs dots in both the chat theme bar and any fixed switcher.
═══════════════════════════════════════════════════════════════ */
const THEMES      = ['nebula','ember','arctic','matrix','rose'];
const THEME_NAMES = { nebula:'Nebula', ember:'Ember \ud83d\udd25', arctic:'Arctic \u2744\ufe0f', matrix:'Matrix', rose:'Rose \ud83c\udf38' };
const GUEST_VOICE_LIMIT = 2;
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
// Shared global state variables (declared on window in config.js)
// currentUser, currentProfile, currentRoom, onlineUsers, cameraStates
let messageChannel = null;
let presenceChannel= null;
let profileChannel = null;
let presenceBaseData = {};
const GUEST_TEXT_RATE_LIMIT_COUNT = 5;
const GUEST_TEXT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const GUEST_VOICE_MAX_DURATION_MS = 5000;
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
const IGNORED_USERS_STORAGE_KEY = 'cc-ignored-users';
const POST_LOGIN_REDIRECT_MAX_AGE_MS = 15_000;
let guestCleanupPromise = null;
let ignoredUserIds = loadIgnoredUserIds();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRestoredSession({ attempts = 12, delayMs = 250 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const { data: { session } } = await sbClient.auth.getSession();
    if (session) return session;
    await sleep(delayMs);
  }
  return null;
}

async function getActiveChatSession() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (session) {
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    return session;
  }

  const pendingRedirectTs = Number(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) || '0');
  if (pendingRedirectTs && Date.now() - pendingRedirectTs < POST_LOGIN_REDIRECT_MAX_AGE_MS) {
    const restoredSession = await waitForRestoredSession();
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    if (restoredSession) return restoredSession;
    sessionStorage.setItem('cc_session_restore_failed', 'true');
    window.location.replace(AUTH_ENTRY_PAGE_URL);
    return null;
  }
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);

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
const QUICK_KICK_OPTIONS = {
  'immediate': 0,
  '1m': 1,
  '10m': 10
};
const QUICK_BAN_OPTIONS = {
  '30m': 0.5,
  '1h': 1,
  '3h': 3,
  '6h': 6,
  '12h': 12,
  '1d': 24,
  '3d': 72,
  '7d': 168,
  '1mo': 720,
  'permanent': null
};
let lastRosterTouchAt = 0;

function loadIgnoredUserIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(IGNORED_USERS_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter(Boolean) : []);
  } catch (_) {
    return new Set();
  }
}

function persistIgnoredUserIds() {
  localStorage.setItem(IGNORED_USERS_STORAGE_KEY, JSON.stringify(Array.from(ignoredUserIds)));
}

function isUserIgnored(userId) {
  return !!userId && ignoredUserIds.has(userId);
}

function refreshIgnoredMessageVisibility() {
  document.querySelectorAll('#messages .msg-row[data-user-id]').forEach((row) => {
    const shouldHide = isUserIgnored(row.dataset.userId) && row.dataset.userId !== currentUser?.id;
    row.classList.toggle('hidden', shouldHide);
  });
}

function setUserIgnored(userId, ignored) {
  if (!userId || userId === currentUser?.id) return false;
  if (ignored) ignoredUserIds.add(userId);
  else ignoredUserIds.delete(userId);
  persistIgnoredUserIds();
  refreshIgnoredMessageVisibility();
  if (typeof refreshPmIgnoreState === 'function') refreshPmIgnoreState(userId);
  if (typeof showChatToast === 'function') {
    showChatToast(ignored ? 'User ignored on this device.' : 'User unignored on this device.', 'info', 2200);
  }
  return true;
}

window.isUserIgnored = isUserIgnored;
window.setUserIgnored = setUserIgnored;

function getProfileBanUntil(profile) {
  return profile?.banned_until || profile?.ban_expires_at || null;
}

function isBanActive(profile) {
  if (!profile?.is_banned) return false;
  const banUntil = getProfileBanUntil(profile);
  if (!banUntil) return true;
  const expiresAt = new Date(banUntil).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

async function clearExpiredBan(userId) {
  if (!userId) return;
  await sbClient.from('profiles').update({
    is_banned: false,
    banned_at: null,
    banned_by: null,
    ban_reason: null,
    ban_expires_at: null
  }).eq('id', userId);
}

function updatePresenceBaseFromProfile(profile = currentProfile) {
  presenceBaseData = {
    userId: currentUser?.id,
    username: profile?.username,
    color: profile?.avatar_color,
    registered: !!profile?.is_registered,
    isAdmin: !!profile?.is_admin,
    isMod: !!profile?.is_mod,
    isOwner: !!profile?.is_owner,
    isVip: !!profile?.is_vip,
    cameraOn: !!presenceBaseData.cameraOn,
    viewingCam: !!presenceBaseData.viewingCam,
    nickColor: profile?.nick_color,
    boldNick: !!profile?.bold_nick,
    msgColor: profile?.msg_color,
    boldText: !!profile?.bold_text,
    avatarUrl: profile?.avatar_url
  };
}

function updateCurrentUserBadge() {
  const badge = document.getElementById('user-badge');
  if (badge && currentProfile) {
    badge.textContent = currentProfile.username + (currentProfile.is_registered ? ' ✓' : ' 👤');
  }
  const clearAllBtn = document.getElementById('btn-clear-all');
  if (clearAllBtn) {
    if (getViewerRoleLevel() >= 3) {
      clearAllBtn.classList.remove('hidden');
    } else {
      clearAllBtn.classList.add('hidden');
    }
  }
}

function disconnectRealtimeChannels() {
  if (messageChannel) {
    sbClient.removeChannel(messageChannel);
    messageChannel = null;
  }
  if (presenceChannel) {
    sbClient.removeChannel(presenceChannel);
    presenceChannel = null;
  }
  if (typeof stopPmRealtime === 'function') stopPmRealtime();
}

async function enforceCurrentUserModerationState({ refresh = false } = {}) {
  if (!currentUser?.id) return true;

  let profile = currentProfile;
  if (refresh) {
    const { data } = await sbClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) {
      profile = data;
      currentProfile = data;
      updatePresenceBaseFromProfile(data);
      updateCurrentUserBadge();
    }
  }

  if (!profile) return true;

  if (profile.is_banned) {
    const banUntil = getProfileBanUntil(profile);
    const expiresAt = banUntil ? new Date(banUntil).getTime() : null;
    if (expiresAt && expiresAt <= Date.now()) {
      await clearExpiredBan(currentUser.id);
      const { data: refreshedProfile } = await sbClient.from('profiles').select('*').eq('id', currentUser.id).single();
      currentProfile = refreshedProfile || currentProfile;
      updatePresenceBaseFromProfile(currentProfile);
      updateCurrentUserBadge();
    } else {
      disconnectRealtimeChannels();
      const banUntilText = banUntil ? ` until ${new Date(banUntil).toLocaleString()}` : ' permanently';
      showBlockedOverlay(`⛔ Your account is banned${banUntilText}.`);
      return false;
    }
  }

  if (isKickActive(currentProfile)) {
    disconnectRealtimeChannels();
    const until = new Date(currentProfile.kicked_until).toLocaleString();
    showBlockedOverlay(`⚡ You have been kicked. Please wait until ${until}.`);
    return false;
  }

  return true;
}

function canProcessIncomingPayload(fromUserId) {
  if (isBanActive(currentProfile) || isKickActive(currentProfile)) return false;
  if (fromUserId && fromUserId !== currentUser?.id && isUserIgnored(fromUserId)) return false;
  return true;
}

function upsertOnlineUserProfile(profile) {
  if (!profile?.id) return;
  if (profile.id === currentUser?.id) {
    currentProfile = { ...currentProfile, ...profile };
    updatePresenceBaseFromProfile(currentProfile);
    updateCurrentUserBadge();
    if (presenceChannel) presenceChannel.track(presenceBaseData).catch(() => {});
  }
  if (onlineUsers[profile.id]) {
    onlineUsers[profile.id] = {
      ...onlineUsers[profile.id],
      username: profile.username || onlineUsers[profile.id].username,
      registered: !!profile.is_registered,
      isAdmin: !!profile.is_admin,
      isMod: !!profile.is_mod,
      isOwner: !!profile.is_owner,
      isVip: !!profile.is_vip
    };
    scheduleRenderUserList();
  }
}

function startProfileRealtimeWatcher() {
  if (profileChannel || !currentUser?.id) return;
  profileChannel = sbClient
    .channel('profiles:watch')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles'
    }, async ({ new: profile }) => {
      if (!profile?.id) return;
      upsertOnlineUserProfile(profile);
      if (profile.id === currentUser?.id) {
        await enforceCurrentUserModerationState();
      }
    })
    .subscribe();
}

function isMobileRosterInteraction(event) {
  return event?.type === 'touchstart'
    || window.matchMedia('(max-width: 768px)').matches
    || window.matchMedia('(pointer: coarse)').matches;
}

async function promptUserRosterAction(user, isGuest) {
  if (isGuest) {
    appendSystemMessage('🔒 Register to start private chats.');
    return;
  }
  const ignored = isUserIgnored(user.userId);
  const canMod = canRunQuickModeration();
  const viewerLevel = getViewerRoleLevel();
  const targetLevel = getRoleLevel(user);
  const canAct = canMod && viewerLevel > targetLevel && user.userId !== currentUser?.id;

  const actions = [
    { value: 'pm', label: '💬 Private Message', variant: 'primary' },
    { value: ignored ? 'unignore' : 'ignore', label: ignored ? '👁 Unignore' : '🙈 Ignore', variant: ignored ? 'default' : 'danger' }
  ];
  if (canAct) {
    actions.push({ value: 'kick', label: '⚡ Kick', variant: 'danger' });
    actions.push({ value: 'ban',  label: '🚫 Ban',  variant: 'danger' });
  }

  const action = await showActionSheet({
    title: user.username || 'User',
    message: 'Choose an action',
    actions
  });
  if (action === 'pm' && typeof openPrivateChat === 'function') {
    openPrivateChat(user.userId, user.username);
  } else if (action === 'ignore') {
    setUserIgnored(user.userId, true);
  } else if (action === 'unignore') {
    setUserIgnored(user.userId, false);
  } else if (action === 'kick') {
    quickKickUser(user.userId, user.username);
  } else if (action === 'ban') {
    quickBanUser(user.userId, user.username);
  }
}

function bindRosterInteraction(li, nameBtn, user, isGuest) {
  const openPm = () => {
    if (isGuest) {
      appendSystemMessage('🔒 Register to start private chats.');
      return;
    }
    if (typeof openPrivateChat === 'function') openPrivateChat(user.userId, user.username);
  };

  li.addEventListener('dblclick', (event) => {
    if (isMobileRosterInteraction(event)) return;
    event.preventDefault();
    openPm();
  });

  // Mobile: touchstart → action sheet (includes kick/ban for mods)
  nameBtn?.addEventListener('touchstart', (event) => {
    lastRosterTouchAt = Date.now();
    if (!isMobileRosterInteraction(event)) return;
    event.preventDefault();
    event.stopPropagation();
    promptUserRosterAction(user, isGuest);
  }, { passive: false });

  // Mobile fallback click
  nameBtn?.addEventListener('click', (event) => {
    if (!isMobileRosterInteraction(event)) return;
    if (Date.now() - lastRosterTouchAt < 650) return;
    event.preventDefault();
    event.stopPropagation();
    promptUserRosterAction(user, isGuest);
  });

  // Desktop single click → pin the profile card (stays open for clicking buttons)
  nameBtn?.addEventListener('click', (event) => {
    if (isMobileRosterInteraction(event)) return;
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(_pcTimer);
    clearTimeout(_pcHide);
    showProfileCard(user, nameBtn, true); // true = pinned mode
  });
}

function getSortedOnlineUsers(users = Object.values(onlineUsers)) {
  return [...users].sort((a, b) => {
    const levelDiff = getRoleLevel(b) - getRoleLevel(a);
    if (levelDiff) return levelDiff;
    return String(a.username || '').localeCompare(String(b.username || ''), undefined, { sensitivity: 'base' });
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  const session = await getActiveChatSession();
  if (!session) return;

  currentUser = session.user;

  let { data: prof } = await sbClient.from('profiles').select('*').eq('id', currentUser.id).single();

  if (!prof) {
    const username = 'User_' + currentUser.id.substr(0,5);
    await sbClient.from('profiles').insert({ id: currentUser.id, username, avatar_color: randomColor(), is_registered: false });
    const { data: refetchedProf } = await sbClient.from('profiles').select('*').eq('id', currentUser.id).single();
    prof = refetchedProf || {
      id: currentUser.id,
      username: username,
      avatar_color: randomColor(),
      is_registered: false
    };
  }

  currentProfile = prof;
  const localAvatar = localStorage.getItem('cc-avatar-' + currentUser.id);
  if (localAvatar && currentProfile) currentProfile.avatar_url = localAvatar;
  updatePresenceBaseFromProfile(currentProfile);
  startProfileRealtimeWatcher();
  startOnlineTimeTracking(currentProfile);

  if (!currentProfile.is_registered && !sessionStorage.getItem('cc-nick-prompt-shown')) {
    sessionStorage.setItem('cc-nick-prompt-shown', '1');
    setTimeout(() => showChatToast(`👋 Chatting as ${currentProfile.username} — Register for a custom nick & full access!`, 'info', 6000), 1500);
  }

  if (!(await enforceCurrentUserModerationState())) {
    return;
  }
  updateCurrentUserBadge();
  const userBadge = document.getElementById('user-badge');
  if (userBadge) {
    userBadge.style.cursor = 'pointer';
    userBadge.title = 'Click to view/edit profile';
    userBadge.addEventListener('click', () => {
      showProfileModal(currentUser.id, 'profile');
    });
  }
  if (typeof ensurePmRealtime === 'function') {
    ensurePmRealtime();
  }
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
  if (!(await enforceCurrentUserModerationState({ refresh: true }))) return;
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

  const voiceControls = document.getElementById('voice-controls');
  const barDivider = document.getElementById('bar-divider');
  if (voiceControls) {
    if (room.is_audio_enabled) {
      voiceControls.classList.remove('hidden');
      if (barDivider) barDivider.classList.remove('hidden');
    } else {
      voiceControls.classList.add('hidden');
      if (barDivider) barDivider.classList.add('hidden');
    }
  }

  const msgInput = document.getElementById('msg-input');
  const sendBtn  = document.querySelector('.btn-send');
  const emojiBtn = document.getElementById('btn-emoji');

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
    .neq('type', 'system')
    .order('created_at', { ascending: true })
    .limit(50);

  oldestMessageTimestamp = messages?.length ? messages[0].created_at : null;
  if (messages?.length) {
    const senderIds = Array.from(new Set(messages.map(m => m.user_id).filter(Boolean)));
    await cacheSenderProfiles(senderIds);
  }
  const loadMoreBtn = document.getElementById('btn-load-older');
  if (loadMoreBtn) loadMoreBtn.classList.toggle('hidden', !messages || messages.length < 50);

  // Batch-append for performance (skip persisted system/deletion notices so newcomers don't see them)
  if (messages?.length) {
    const container = document.getElementById('messages');
    const frag = document.createDocumentFragment();
    messages.forEach(m => {
      if (m.type === 'system') return; // deletion notices are transient — don't show in history
      const node = buildMessageNode(m);
      if (node) frag.appendChild(node);
    });
    container.appendChild(frag);
  }
  refreshIgnoredMessageVisibility();
  scrollToBottom();

  messageChannel = sbClient
    .channel('room:' + room.id)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `room_id=eq.${room.id}`
    }, async payload => {
      if (!canProcessIncomingPayload(payload.new?.user_id)) return;
      // Skip system (deletion notice) messages from DB realtime — they are shown locally and auto-expire
      if (payload.new?.type === 'system') return;
      if (payload.new?.user_id) {
        await cacheSenderProfiles([payload.new.user_id]);
      }
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

  // (join notice suppressed — fresh page on room entry)
}

// FIX 1 — Disable input controls and show notice bar for guest users
function applyGuestUI() {
  updateComposerState();
}

async function sendMessage() {
  if (!(await enforceCurrentUserModerationState({ refresh: true }))) return;
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
  if (!isRegisteredUser()) {
    const waitMs = getGuestMessageWaitMs(currentRoom.id);
    if (waitMs > 0) {
      showGuestRateLimitToast(waitMs);
      return;
    }
  }

  if (!isSendingImage) input.value = '';

  // ── Security: validate content before sending ──────────────────
  if (!isSendingImage) {
    const validation = window.ccValidateMessage ? window.ccValidateMessage(text) : { ok: true };
    if (!validation.ok) {
      showChatToast('⚠️ ' + validation.reason, 'warning');
      return;
    }
  }
  // Sanitise image URL — only allow http(s)
  const safeImageUrl = isSendingImage && window.ccSanitize
    ? window.ccSanitize.url(imageUrl)
    : imageUrl;
  if (isSendingImage && !safeImageUrl) {
    showChatToast('⚠️ Invalid image URL blocked for security.', 'warning');
    return;
  }
  // Validate room/user IDs are proper UUIDs before insert
  if (window.ccSanitize) {
    if (!window.ccSanitize.isUUID(currentRoom?.id) || !window.ccSanitize.isUUID(currentUser?.id)) {
      console.warn('[CC-SEC] sendMessage: invalid room/user ID — aborting insert.');
      return;
    }
  }
  // Sanitise text content
  const safeText = window.ccSanitize ? window.ccSanitize.chatText(text, 500) : text;

  const { data: insertedMsgs, error } = await sbClient.from('messages').insert({
    room_id:  currentRoom.id,
    user_id:  currentUser.id,
    username: currentProfile.username,
    content:  isSendingImage ? safeImageUrl : safeText,
    type:     isSendingImage ? 'image' : 'text'
  }).select('id');

  if (error) {
    appendSystemMessage(isSendingImage ? 'Could not share image. Please try again.' : 'Could not send message. Please try again.');
    return;
  }

  // Delete guest messages immediately from the database to keep history empty for guests
  if (!isRegisteredUser() && insertedMsgs?.[0]?.id) {
    void sbClient.from('messages').delete().eq('id', insertedMsgs[0].id);
  }

  if (isSendingImage) {
    closeRoomImageUrlInput();
    showChatToast('Image/GIF shared in chat.', 'success');
  }
}

/* Builds a message DOM node without appending it (used for batch & single) */
function buildMessageNode(msg) {
  if (msg?.user_id && !canProcessIncomingPayload(msg.user_id)) return null;
  if (msg.type === 'system') {
    return buildSystemMessageNode(msg.content, msg.created_at);
  }

  if (msg.type === 'image') {
    return buildImageMessageNode(msg);
  }

  // FIX 2 — Voice note messages: show locked placeholder for guests
  if (msg.type === 'voice') {
    const isMe  = msg.user_id === currentUser?.id;
    const senderProf = onlineUsers[msg.user_id] || senderProfilesCache.get(msg.user_id) || (isMe ? currentProfile : null);
    const div   = document.createElement('div');
    div.className = 'msg-row' + (isMe ? ' self' : '');
    setMessageRowData(div, msg, sanitizeAudioSource(msg));
    const initial = (msg.username || '?')[0].toUpperCase();
    const color   = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);
    
    const avatarUrl = isMe ? currentProfile?.avatar_url : (senderProf?.avatar_url || null);
    const avatarInner = avatarUrl
      ? `<img src="${escHtml(avatarUrl)}" alt=""/>`
      : initial;
      
    let nickStyle = '';
    if (senderProf?.nick_color) {
      nickStyle += `color: ${escHtml(senderProf.nick_color)};`;
    }
    if (senderProf?.bold_nick) {
      if (senderProf.is_vip || senderProf.isVip || senderProf.is_admin || senderProf.isAdmin || senderProf.is_mod || senderProf.isMod || senderProf.is_owner || senderProf.isOwner) {
        nickStyle += `font-weight: bold;`;
      }
    }
    
    const audioHtml = currentProfile?.is_registered
      ? `<audio controls src="${escHtml(msg.content)}"></audio>`
      : '<span class="vn-locked">\ud83d\udd12 Register to hear voice notes</span>';
    const deleteButton = buildDeleteButtonHtml(msg.user_id);
    div.innerHTML = `
      <div class="avatar" style="background:${color}">${avatarInner}</div>
      <div class="msg-bubble">
        ${deleteButton}
        <div class="msg-username" style="${nickStyle}">${escHtml(msg.username || 'Unknown')}</div>
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
  
  const senderProf = onlineUsers[msg.user_id] || senderProfilesCache.get(msg.user_id) || (isMe ? currentProfile : null);
  const avatarUrl = isMe ? currentProfile?.avatar_url : (senderProf?.avatar_url || null);
  const avatarInner = avatarUrl
    ? `<img src="${escHtml(avatarUrl)}" alt=""/>`
    : initial;
    
  let nickStyle = '';
  if (senderProf?.nick_color) {
    nickStyle += `color: ${escHtml(senderProf.nick_color)};`;
  }
  if (senderProf?.bold_nick) {
    if (senderProf.is_vip || senderProf.isVip || senderProf.is_admin || senderProf.isAdmin || senderProf.is_mod || senderProf.isMod || senderProf.is_owner || senderProf.isOwner) {
      nickStyle += `font-weight: bold;`;
    }
  }

  let msgStyle = '';
  if (senderProf?.msg_color) {
    msgStyle += `color: ${escHtml(senderProf.msg_color)};`;
  }
  if (senderProf?.bold_text) {
    if (senderProf.is_vip || senderProf.isVip || senderProf.is_admin || senderProf.isAdmin || senderProf.is_mod || senderProf.isMod || senderProf.is_owner || senderProf.isOwner) {
      msgStyle += `font-weight: bold;`;
    }
  }

  const deleteButton = buildDeleteButtonHtml(msg.user_id);

  div.innerHTML = `
    <div class="avatar" style="background:${color}">${avatarInner}</div>
    <div class="msg-bubble">
      ${deleteButton}
      <div class="msg-username" style="${nickStyle}">${escHtml(msg.username || 'Unknown')}</div>
      <div class="msg-text" style="${msgStyle}">${escHtml(msg.content)}</div>
      <div class="msg-time">${formatTime(msg.created_at)}</div>
    </div>`;

  return div;
}

function appendMessage(msg) {
  const node = buildMessageNode(msg);
  if (!node) return;
  document.getElementById('messages').appendChild(node);
  // Deletion notices (type=system) auto-disappear after 5 minutes for live users
  if (msg?.type === 'system' && String(msg?.content || '').startsWith(DELETED_MESSAGE_PREFIX)) {
    setTimeout(() => {
      if (node.parentNode) {
        node.classList.add('is-deleting');
        setTimeout(() => node.remove(), 220);
      }
    }, 5 * 60 * 1000);
  }
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
  const isGuest = !isRegisteredUser();
  const sortedUsers = getSortedOnlineUsers();

  sortedUsers.forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-item';
    li.dataset.userId = u.userId;
    const roleBadge = getRoleBadgeHtml(u);
    const viewerEye = onlineUsers[u.userId]?.viewingCam ? '<span class="viewer-eye" title="Watching a camera">👁️</span>' : '';
    const avatarHtml = u.avatarUrl
      ? `<img class="roster-avatar" src="${escHtml(u.avatarUrl)}" alt=""/>`
      : `<div class="roster-avatar-init" style="background:${escHtml(u.color || '#7c3aed')}">${(u.username || '?')[0].toUpperCase()}</div>`;
    
    li.innerHTML = `
      <span class="dot${u.registered ? '' : ' guest'}"></span>
      ${avatarHtml}
      ${roleBadge}
      <button type="button" class="user-name-btn${isGuest ? ' locked-action' : ''}" title="${isGuest ? '\ud83d\udd12 Register to start private chats' : 'Click for options'}">${escHtml(u.username)}</button>
      <canvas class="mini-soundbar" data-user-id="${u.userId}" width="32" height="10" aria-hidden="true"></canvas>
      ${viewerEye}
      <button type="button" class="camera-user-btn${cameraStates[u.userId] ? '' : ' hidden'}" data-user-id="${u.userId}" title="View camera">\ud83d\udcf7</button>
    `;

    const nameBtn = li.querySelector('.user-name-btn');
    bindRosterInteraction(li, nameBtn, u, isGuest);

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
    // Kick/ban buttons in sidebar are removed — only available in profile card (opened by clicking name)

    frag.appendChild(li);
  });

  ul.innerHTML = '';
  ul.appendChild(frag);

  // Update room-users-bar
  const bar = document.getElementById('room-users-bar');
  if (bar) {
    bar.innerHTML = '';
    const bfrag = document.createDocumentFragment();
    sortedUsers.forEach(u => {
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
    .neq('type', 'system')
    .lt('created_at', oldestMessageTimestamp)
    .order('created_at', { ascending: false })
    .limit(50);

  isLoadingOlderMessages = false;
  if (btn) { btn.disabled = false; btn.textContent = '⬆ Load older messages'; }

  if (!older?.length) {
    if (btn) { btn.classList.add('hidden'); btn.textContent = 'No more messages'; }
    return;
  }

  const senderIds = Array.from(new Set(older.map(m => m.user_id).filter(Boolean)));
  await cacheSenderProfiles(senderIds);

  const container = document.getElementById('messages');
  const prevScrollHeight = container.scrollHeight;
  const frag = document.createDocumentFragment();

  [...older].reverse().forEach(m => {
    if (m.type === 'system') return; // skip deletion notices in paginated history too
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
  return currentProfile?.is_owner === true || currentProfile?.is_admin === true || currentProfile?.is_mod === true;
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
  const until = new Date(profile.kicked_until).getTime();
  return Number.isFinite(until) && until > Date.now();
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
  if (source.startsWith('data:') || source.startsWith('blob:') || source.startsWith('https://') || source.startsWith('http://')) {
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
  const token = await showKickModal(username);
  if (!token || !Object.prototype.hasOwnProperty.call(QUICK_KICK_OPTIONS, token)) return;
  const durationMinutes = QUICK_KICK_OPTIONS[token];
  // immediate = 10 second timeout (just enough to flush their connection)
  const kickedUntil = durationMinutes === 0
    ? new Date(Date.now() + 10 * 1000).toISOString()
    : new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  const { error } = await sbClient.from('profiles').update({ kicked_until: kickedUntil }).eq('id', userId);
  if (error) { appendSystemMessage(`Kick failed for ${username || 'user'}: ${error.message}`); return; }
  const label = token === 'immediate' ? 'immediately' : `for ${token}`;
  appendSystemMessage(`⚡ ${username || 'User'} was kicked ${label}.`);
}

async function quickBanUser(userId, username) {
  if (!canRunQuickModeration() || !userId) return;
  const token = await showBanModal(username);
  if (!token || !Object.prototype.hasOwnProperty.call(QUICK_BAN_OPTIONS, token)) return;

  const durationHours = QUICK_BAN_OPTIONS[token];
  const banExpiresAt = durationHours === null
    ? null
    : new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  // For permanent bans: collect advanced fingerprint and store it
  let deviceFingerprint = null;
  if (token === 'permanent' && window.ccFingerprint) {
    try { deviceFingerprint = await window.ccFingerprint.generate(); } catch (_) {}
  }

  const updateObj = {
    is_banned: true,
    banned_at: new Date().toISOString(),
    banned_by: currentUser.id,
    ban_reason: 'In-chat moderation',
    ban_expires_at: banExpiresAt
  };
  // Store fingerprint for permanent bans (if column exists)
  if (deviceFingerprint) updateObj.device_fingerprint = deviceFingerprint;

  const { error } = await sbClient.from('profiles').update(updateObj).eq('id', userId);
  if (error) { appendSystemMessage(`Ban failed for ${username || 'user'}: ${error.message}`); return; }

  const label = durationHours === null ? 'permanently' : `for ${token}`;
  appendSystemMessage(`🚫 ${username || 'User'} has been banned ${label}.`);
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
      const mimeType = roomVoiceNoteRecorder?.mimeType || 'audio/webm';
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
        const blob = new Blob(chunks, { type: mimeType });
        const dataUrl = await roomVoiceBlobToDataUrl(blob);
        const { data: insertedMsgs, error } = await sbClient.from('messages').insert({
          room_id: roomIdForVoiceNote,
          user_id: currentUser.id,
          username: currentProfile.username,
          content: dataUrl,
          type: 'voice'
        }).select('id');
        if (error) {
          appendSystemMessage('Could not send voice note. Please try again.');
        } else if (!isRegisteredUser()) {
          if (insertedMsgs?.[0]?.id) {
            void sbClient.from('messages').delete().eq('id', insertedMsgs[0].id);
          }
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
    // Guests: auto-stop after 5 seconds
    if (!isRegisteredUser()) {
      setTimeout(() => {
        if (roomVoiceNoteRecorder?.state === 'recording') {
          roomVoiceNoteRecorder.stop();
        }
      }, GUEST_VOICE_MAX_DURATION_MS);
    }
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
  // Auto-remove deletion notice after 5 minutes for live users
  setTimeout(() => {
    if (replacement.parentNode) {
      replacement.classList.add('is-deleting');
      setTimeout(() => replacement.remove(), 220);
    }
  }, 5 * 60 * 1000);
}

async function deleteMessageForEveryone(messageId, targetUserId, targetUsername) {
  const deletingOwn = targetUserId === currentUser?.id;
  const deletingAsModerator = !deletingOwn && canDeleteAnyMessage();
  const { error: deleteError } = await sbClient.from('messages').delete().eq('id', messageId);
  if (deleteError) throw deleteError;

  if (deletingAsModerator && currentRoom?.id) {
    const deleterName = currentProfile?.username || 'Admin';
    // Show deletion notice locally only — NOT stored in DB to keep history clean
    appendSystemMessage(`🗑️ Message deleted by ${deleterName}`);
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

  const isModOrAbove = getViewerRoleLevel() >= 3;

  if (isModOrAbove) {
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
  } else {
    // Normal/VIP users: Local clear only
    mine.forEach(node => {
      node.classList.add('is-deleting');
      setTimeout(() => node.remove(), 240);
    });
    if (clearBtn) {
      clearBtn.textContent = 'Cleared ✓';
      setTimeout(() => {
        clearBtn.disabled = false;
        clearBtn.textContent = 'Clear My Messages';
      }, 1800);
    }
    showChatToast(`Cleared your ${mine.length} message${mine.length === 1 ? '' : 's'} locally from your screen.`, 'success');
  }
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

/* Role level: Guest=0, User=1, VIP=2, Mod=3, Admin=4, Owner=5 */
function getRoleLevel(u) {
  if (u.isOwner || u.is_owner) return 5;
  if (u.isAdmin || u.is_admin) return 4;
  if (u.isMod   || u.is_mod)   return 3;
  if (u.isVip   || u.is_vip)   return 2;
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
  if (u.isVip   || u.is_vip)   return '<span class="role-badge vip" title="VIP">⭐</span>';
  if (u.registered || u.is_registered) return '<span class="role-badge user" title="User">✅</span>';
  return '<span class="role-badge guest" title="Guest">👤</span>';
}

function getRoleLabel(u) {
  if (u.isOwner || u.is_owner) return 'Owner';
  if (u.isAdmin || u.is_admin) return 'Admin';
  if (u.isMod   || u.is_mod)   return 'Moderator';
  if (u.isVip   || u.is_vip)   return 'VIP';
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
  // Do NOT close the profile card if it is in pinned mode
  if (_pcActive && _pcActive.classList.contains('pinned')) {
    return;
  }
  // Small grace period so user can move cursor into the card
  _pcHide = setTimeout(() => hideProfileCard(), 220);
}

function hideProfileCard() {
  if (_pcActive) {
    _pcActive.remove();
    _pcActive = null;
  }
}

async function showProfileCard(u, anchor, pinned = false) {
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
  const canKick      = canBan;
  const canGrantVip  = viewerLevel >= 3 && targetLevel === 1;
  const isVip        = !!(profile.is_vip);
  const ignoreLabel  = isUserIgnored(u.userId) ? 'Unignore' : 'Ignore';

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
  const kickBtn = canKick
    ? `<button class="pc-kick-btn" type="button" data-uid="${escHtml(u.userId)}">⚡ Kick</button>`
    : '';
  const banBtn = canBan
    ? `<button class="pc-ban-btn" type="button" data-uid="${escHtml(u.userId)}">🚫 Ban</button>`
    : '';
  const vipBtn = canGrantVip
    ? `<button class="pc-vip-btn" type="button" data-uid="${escHtml(u.userId)}" data-action="${isVip ? 'revoke' : 'grant'}">${isVip ? '⭐ Revoke VIP' : '⭐ Grant VIP'}</button>`
    : '';
  const ignoreBtn = u.userId !== currentUser?.id
    ? `<button class="pc-ignore-btn" type="button" data-uid="${escHtml(u.userId)}" data-action="${ignoreLabel.toLowerCase()}">${ignoreLabel}</button>`
    : '';
  const pmBtn = u.userId !== currentUser?.id && isRegisteredUser()
    ? `<button class="pc-pm-btn" type="button" data-uid="${escHtml(u.userId)}">💬 Message</button>`
    : '';
  const closeBtnHtml = pinned
    ? `<button class="pc-close-btn" type="button" aria-label="Close">✕</button>`
    : '';
  const profileBtn = u.userId === currentUser?.id
    ? `<button class="pc-profile-btn pm-btn" type="button" data-uid="${escHtml(u.userId)}">👤 Edit Profile</button>`
    : `<button class="pc-profile-btn" type="button" data-uid="${escHtml(u.userId)}">👤 View Profile</button>`;

  const row1Html = (pmBtn || ignoreBtn) ? `<div class="pc-action-row">${pmBtn}${ignoreBtn}</div>` : '';
  const row2Html = (kickBtn || banBtn) ? `<div class="pc-action-row">${kickBtn}${banBtn}</div>` : '';
  const actionsHtml = (row1Html || row2Html || vipBtn)
    ? `<div class="pc-actions">${row1Html}${row2Html}${vipBtn}</div>`
    : '';

  const card = document.createElement('div');
  card.id = 'profile-card';
  card.className = 'profile-card' + (pinned ? ' pinned' : '');
  card.innerHTML = `
    ${closeBtnHtml}
    <div class="pc-header">
      ${avatarHtml}
      <div class="pc-info">
        <div class="pc-name">${escHtml(profile.username || 'Unknown')} ${vipBadge}</div>
        <div class="pc-role">${roleBadge} ${escHtml(roleLabel)}</div>
        ${profileBtn}
      </div>
    </div>
    <div class="pc-join">📅 Joined ${escHtml(joinDate)}</div>
    ${ipRow}
    ${actionsHtml}
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
    card.style.left = Math.max(8, left) + 'px';
    card.style.top  = Math.max(8, top)  + 'px';
    card.style.visibility = 'visible';
  });

  if (pinned) {
    // Pinned mode: close on ✕ button, Escape key, or click outside
    card.querySelector('.pc-close-btn')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      hideProfileCard();
    });
    const outsideClick = (ev) => {
      if (!card.contains(ev.target)) {
        hideProfileCard();
        document.removeEventListener('click', outsideClick, true);
      }
    };
    // Delay so the triggering click doesn't immediately close it
    setTimeout(() => document.addEventListener('click', outsideClick, true), 50);
    const escHandler = (ev) => {
      if (ev.key === 'Escape') { hideProfileCard(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);
  } else {
    // Hover mode: keep alive while mouse is inside
    card.addEventListener('mouseenter', () => { clearTimeout(_pcHide); });
    card.addEventListener('mouseleave', () => hideProfileCard());
  }

  // Action buttons — same for both modes
  card.querySelector('.pc-profile-btn')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    hideProfileCard();
    showProfileModal(u.userId, 'profile');
  });

  card.querySelector('.pc-pm-btn')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    hideProfileCard();
    if (typeof openPrivateChat === 'function') openPrivateChat(u.userId, u.username);
  });

  card.querySelector('.pc-kick-btn')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    hideProfileCard();
    quickKickUser(u.userId, u.username);
  });

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

  card.querySelector('.pc-ignore-btn')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const ignore = ev.currentTarget.dataset.action === 'ignore';
    setUserIgnored(u.userId, ignore);
    hideProfileCard();
  });
}

/* ════════════════════════════════════════════════════════════════
   Kick Modal — premium animated dialog
════════════════════════════════════════════════════════════════ */
function showKickModal(username) {
  return new Promise((resolve) => {
    document.getElementById('cc-kick-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'cc-kick-modal';
    overlay.className = 'cc-modal-overlay';
    overlay.innerHTML = `
      <div class="cc-modal kick" role="dialog" aria-modal="true">
        <div class="cc-modal-icon">⚡</div>
        <h3 class="cc-modal-title">Kick <span class="cc-modal-uname">${escHtml(username || 'User')}</span>?</h3>
        <p class="cc-modal-sub">Choose timeout duration</p>
        <div class="cc-modal-grid">
          <button class="cc-modal-opt kick" data-val="immediate"><span class="cc-opt-icon">💨</span><span class="cc-opt-label">Immediate</span><span class="cc-opt-note">Can return instantly</span></button>
          <button class="cc-modal-opt kick" data-val="1m"><span class="cc-opt-icon">🕑</span><span class="cc-opt-label">1 Minute</span><span class="cc-opt-note">Short timeout</span></button>
          <button class="cc-modal-opt kick" data-val="10m"><span class="cc-opt-icon">⏰</span><span class="cc-opt-label">10 Minutes</span><span class="cc-opt-note">Cooling-off period</span></button>
        </div>
        <button class="cc-modal-cancel">Cancel</button>
      </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    overlay.querySelector('.cc-modal-cancel').onclick = () => { overlay.remove(); resolve(null); };
    overlay.querySelectorAll('.cc-modal-opt').forEach(btn => {
      btn.onclick = () => { const v = btn.dataset.val; overlay.remove(); resolve(v); };
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
  });
}

/* ════════════════════════════════════════════════════════════════
   Ban Modal — premium animated dialog
════════════════════════════════════════════════════════════════ */
function showBanModal(username) {
  return new Promise((resolve) => {
    document.getElementById('cc-ban-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'cc-ban-modal';
    overlay.className = 'cc-modal-overlay';
    overlay.innerHTML = `
      <div class="cc-modal ban" role="dialog" aria-modal="true">
        <div class="cc-modal-icon">🚫</div>
        <h3 class="cc-modal-title">Ban <span class="cc-modal-uname">${escHtml(username || 'User')}</span>?</h3>
        <p class="cc-modal-sub">Select suspension duration</p>
        <div class="cc-modal-grid ban-grid">
          <button class="cc-modal-opt ban" data-val="30m"><span class="cc-opt-label">30 Min</span></button>
          <button class="cc-modal-opt ban" data-val="1h"><span class="cc-opt-label">1 Hour</span></button>
          <button class="cc-modal-opt ban" data-val="3h"><span class="cc-opt-label">3 Hours</span></button>
          <button class="cc-modal-opt ban" data-val="6h"><span class="cc-opt-label">6 Hours</span></button>
          <button class="cc-modal-opt ban" data-val="12h"><span class="cc-opt-label">12 Hours</span></button>
          <button class="cc-modal-opt ban" data-val="1d"><span class="cc-opt-label">1 Day</span></button>
          <button class="cc-modal-opt ban" data-val="3d"><span class="cc-opt-label">3 Days</span></button>
          <button class="cc-modal-opt ban" data-val="7d"><span class="cc-opt-label">7 Days</span></button>
          <button class="cc-modal-opt ban" data-val="1mo"><span class="cc-opt-label">1 Month</span></button>
          <button class="cc-modal-opt ban permanent" data-val="permanent"><span class="cc-opt-icon">♾️</span><span class="cc-opt-label">Permanent</span><span class="cc-opt-note">Fingerprint recorded — no return</span></button>
        </div>
        <button class="cc-modal-cancel">Cancel</button>
      </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    overlay.querySelector('.cc-modal-cancel').onclick = () => { overlay.remove(); resolve(null); };
    overlay.querySelectorAll('.cc-modal-opt').forEach(btn => {
      btn.onclick = () => { const v = btn.dataset.val; overlay.remove(); resolve(v); };
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
  });
}

/* ════════════════════════════════════════════════════════════════
   Legacy showActionSheet (kept for any other callers)
════════════════════════════════════════════════════════════════ */
let actionSheetResolver = null;

function ensureActionSheet() {
  let overlay = document.getElementById('chat-action-sheet');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'chat-action-sheet';
  overlay.className = 'chat-action-sheet hidden';
  overlay.innerHTML = `
    <div class="chat-action-sheet-panel" role="dialog" aria-modal="true" aria-label="Choose action">
      <div class="chat-action-sheet-title"></div>
      <div class="chat-action-sheet-message"></div>
      <div class="chat-action-sheet-actions"></div>
      <button type="button" class="chat-action-sheet-cancel">Cancel</button>
    </div>
  `;
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeActionSheet(null);
  });
  overlay.querySelector('.chat-action-sheet-cancel')?.addEventListener('click', () => closeActionSheet(null));
  document.body.appendChild(overlay);
  return overlay;
}

function closeActionSheet(value) {
  const overlay = document.getElementById('chat-action-sheet');
  if (overlay) overlay.classList.add('hidden');
  if (actionSheetResolver) { actionSheetResolver(value); actionSheetResolver = null; }
}

function showActionSheet({ title = '', message = '', actions = [] } = {}) {
  const overlay = ensureActionSheet();
  const titleEl = overlay.querySelector('.chat-action-sheet-title');
  const messageEl = overlay.querySelector('.chat-action-sheet-message');
  const actionsEl = overlay.querySelector('.chat-action-sheet-actions');
  if (!titleEl || !messageEl || !actionsEl) return Promise.resolve(null);
  titleEl.textContent = title;
  messageEl.textContent = message;
  actionsEl.innerHTML = '';
  actions.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chat-action-btn ${action.variant || 'default'}`;
    button.textContent = action.label;
    button.addEventListener('click', () => closeActionSheet(action.value));
    actionsEl.appendChild(button);
  });
  overlay.classList.remove('hidden');
  return new Promise((resolve) => { actionSheetResolver = resolve; });
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
    
    // Save to database
    const { error } = await sbClient.from('profiles').update({ avatar_url: dataUrl }).eq('id', currentUser.id);
    if (error) throw error;

    currentProfile.avatar_url = dataUrl;
    updatePresenceBaseFromProfile(currentProfile);
    if (presenceChannel) {
      presenceChannel.track(presenceBaseData).catch(() => {});
    }

    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
    closeAvatarUpload();
    appendSystemMessage('✅ Avatar updated!');
    updateCurrentUserBadge();
    scheduleRenderUserList();
  } catch (err) {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
    setAvatarUploadError('❌ Could not save avatar: ' + (err.message || err));
  }
}

/* ════════════════════════════════════════════════════════════════
   Profile Modal & Advanced Settings
   ════════════════════════════════════════════════════════════════ */
let senderProfilesCache = new Map();
let pendingAvatarDataUrl = null;

async function cacheSenderProfiles(userIds) {
  const uncached = userIds.filter(id => id && !senderProfilesCache.has(id));
  if (!uncached.length) return;
  
  try {
    const { data, error } = await sbClient
      .from('profiles')
      .select('id, username, avatar_color, avatar_url, is_vip, is_admin, is_mod, is_owner, nick_color, bold_nick, msg_color, bold_text, sex, birthdate, country, relationship_status, bio, created_at, email')
      .in('id', uncached);
    if (data) {
      data.forEach(p => senderProfilesCache.set(p.id, p));
    }
  } catch (err) {
    console.error('Failed to cache sender profiles:', err);
  }
}

async function showProfileModal(userId, startTab = 'profile') {
  document.getElementById('cc-profile-modal-overlay')?.remove();
  
  let targetProfile = null;
  if (userId === currentUser?.id) {
    targetProfile = currentProfile;
  } else {
    try {
      const { data } = await sbClient.from('profiles').select('*').eq('id', userId).single();
      targetProfile = data;
    } catch (_) {}
  }
  
  if (!targetProfile) {
    showChatToast('Could not load profile.', 'error');
    return;
  }
  
  const isMe = userId === currentUser?.id;
  
  const overlay = document.createElement('div');
  overlay.id = 'cc-profile-modal-overlay';
  overlay.className = 'cc-profile-modal-overlay';
  
  overlay.innerHTML = `
    <div class="cc-profile-modal" role="dialog" aria-modal="true">
      <div class="cc-profile-header">
        <div class="cc-profile-title">
          <span>💬 LIVE CHAT ROOM - Profile</span>
        </div>
        <div class="cc-profile-controls">
          <button class="cc-profile-ctrl-btn close-btn" onclick="closeProfileModal()">✕</button>
        </div>
      </div>
      <div class="cc-profile-body">
        <aside class="cc-profile-sidebar">
          <button class="cc-profile-tab-btn" data-tab="profile">${isMe ? '👤 My profile' : '👤 Profile'}</button>
          ${isMe ? `<button class="cc-profile-tab-btn" data-tab="vip">⭐ VIP</button>` : ''}
          ${isMe ? `<button class="cc-profile-tab-btn" data-tab="ignore">🚫 Ignore list</button>` : ''}
          ${isMe || (getViewerRoleLevel() >= 3) ? `<button class="cc-profile-tab-btn" data-tab="coins">🪙 Coins</button>` : ''}
          ${isMe ? `<button class="cc-profile-tab-btn" data-tab="account">⚙️ Account</button>` : ''}
        </aside>
        <main class="cc-profile-content" id="cc-profile-content-pane">
        </main>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  const tabButtons = overlay.querySelectorAll('.cc-profile-tab-btn');
  tabButtons.forEach(btn => {
    btn.onclick = () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProfileTab(btn.dataset.tab, targetProfile, isMe);
    };
  });
  
  const initialBtn = overlay.querySelector(`.cc-profile-tab-btn[data-tab="${startTab}"]`) || overlay.querySelector('.cc-profile-tab-btn');
  initialBtn?.classList.add('active');
  renderProfileTab(initialBtn?.dataset.tab || 'profile', targetProfile, isMe);
  
  const escClose = (ev) => {
    if (ev.key === 'Escape') {
      closeProfileModal();
      document.removeEventListener('keydown', escClose);
    }
  };
  document.addEventListener('keydown', escClose);
}

function closeProfileModal() {
  document.getElementById('cc-profile-modal-overlay')?.remove();
}

function renderProfileTab(tab, profile, isMe, editMode = false) {
  const container = document.getElementById('cc-profile-content-pane');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (tab === 'profile') {
    if (editMode && isMe) {
      const checkColumns = profile.bio !== undefined;
      const birthdateStr = profile.birthdate || '';
      let bDay = '', bMonth = '', bYear = '';
      if (birthdateStr.includes('-')) {
        const parts = birthdateStr.split('-');
        bYear = parts[0];
        bMonth = parts[1];
        bDay = parts[2];
      }
      
      let daysOptions = '<option value="">Day</option>';
      for (let i = 1; i <= 31; i++) {
        const val = String(i).padStart(2, '0');
        daysOptions += `<option value="${val}" ${bDay === val ? 'selected' : ''}>${i}</option>`;
      }
      
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      let monthsOptions = '<option value="">Month</option>';
      months.forEach((m, idx) => {
        const val = String(idx + 1).padStart(2, '0');
        monthsOptions += `<option value="${val}" ${bMonth === val ? 'selected' : ''}>${m}</option>`;
      });
      
      let yearsOptions = '<option value="">Year</option>';
      const currentYear = new Date().getFullYear();
      for (let i = currentYear; i >= 1900; i--) {
        yearsOptions += `<option value="${i}" ${bYear === String(i) ? 'selected' : ''}>${i}</option>`;
      }
      
      container.innerHTML = `
        <div class="cc-profile-edit-layout">
          <div class="cc-profile-edit-header">
            <h3 class="cc-profile-edit-title">Edit profile</h3>
            <button class="cc-profile-back-link" onclick="renderProfileTab('profile', currentProfile, true, false)">← Return to profile</button>
          </div>
          
          ${!checkColumns ? `
            <div style="background:rgba(239, 68, 68, 0.15); border:1px solid rgba(239, 68, 68, 0.4); padding:12px; border-radius:8px; color:#ff8b8b; font-size:0.85rem; margin-bottom:10px;">
              ⚠️ Profile database columns are missing. Please execute the SQL updates in <code>schema-updates.sql</code> in your Supabase SQL editor to enable all editing features.
            </div>
          ` : ''}
          
          <form id="cc-profile-edit-form" class="cc-profile-form-grid" onsubmit="saveProfileChanges(event)">
            <div class="cc-profile-form-group">
              <label class="cc-profile-label">Name in this chat / Default profile name</label>
              <input type="text" id="cc-edit-username" class="cc-profile-input" value="${escHtml(profile.username || '')}" required />
              <span style="font-size:0.75rem;color:var(--muted)">Other people in this chat will see this name.</span>
            </div>
            
            <div class="cc-profile-form-group">
              <label class="cc-profile-label">Sex</label>
              <select id="cc-edit-sex" class="cc-profile-select" ${!checkColumns ? 'disabled' : ''}>
                <option value="">Choose...</option>
                <option value="Male" ${profile.sex === 'Male' ? 'selected' : ''}>Male</option>
                <option value="Female" ${profile.sex === 'Female' ? 'selected' : ''}>Female</option>
                <option value="Other" ${profile.sex === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            
            <div class="cc-profile-form-group">
              <label class="cc-profile-label">Birthdate</label>
              <div class="cc-profile-birthdate-row">
                <select id="cc-edit-bday" class="cc-profile-select" ${!checkColumns ? 'disabled' : ''}>${daysOptions}</select>
                <select id="cc-edit-bmonth" class="cc-profile-select" ${!checkColumns ? 'disabled' : ''}>${monthsOptions}</select>
                <select id="cc-edit-byear" class="cc-profile-select" ${!checkColumns ? 'disabled' : ''}>${yearsOptions}</select>
              </div>
            </div>
            
            <div class="cc-profile-form-group">
              <label class="cc-profile-label">Country</label>
              <select id="cc-edit-country" class="cc-profile-select" ${!checkColumns ? 'disabled' : ''}>
                <option value="">Choose...</option>
                <option value="United States" ${profile.country === 'United States' ? 'selected' : ''}>United States</option>
                <option value="United Kingdom" ${profile.country === 'United Kingdom' ? 'selected' : ''}>United Kingdom</option>
                <option value="Canada" ${profile.country === 'Canada' ? 'selected' : ''}>Canada</option>
                <option value="Australia" ${profile.country === 'Australia' ? 'selected' : ''}>Australia</option>
                <option value="Germany" ${profile.country === 'Germany' ? 'selected' : ''}>Germany</option>
                <option value="France" ${profile.country === 'France' ? 'selected' : ''}>France</option>
                <option value="Pakistan" ${profile.country === 'Pakistan' ? 'selected' : ''}>Pakistan</option>
                <option value="India" ${profile.country === 'India' ? 'selected' : ''}>India</option>
                <option value="Other" ${profile.country === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            
            <div class="cc-profile-form-group">
              <label class="cc-profile-label">Relationship status</label>
              <select id="cc-edit-relationship" class="cc-profile-select" ${!checkColumns ? 'disabled' : ''}>
                <option value="">Choose...</option>
                <option value="Single" ${profile.relationship_status === 'Single' ? 'selected' : ''}>Single</option>
                <option value="In a relationship" ${profile.relationship_status === 'In a relationship' ? 'selected' : ''}>In a relationship</option>
                <option value="Married" ${profile.relationship_status === 'Married' ? 'selected' : ''}>Married</option>
                <option value="It's complicated" ${profile.relationship_status === "It's complicated" ? 'selected' : ''}>It's complicated</option>
              </select>
            </div>
            
            <div class="cc-profile-form-group full-width">
              <label class="cc-profile-label">About me</label>
              <textarea id="cc-edit-bio" class="cc-profile-textarea" placeholder="Write a short bio..." maxlength="300" ${!checkColumns ? 'disabled' : ''}>${escHtml(profile.bio || '')}</textarea>
            </div>
            
            <div class="cc-profile-form-group">
              <label class="cc-profile-label">Nick color (HEX code)</label>
              <div class="cc-profile-color-row">
                <input type="text" id="cc-edit-nickcolor" class="cc-profile-input" placeholder="#ffffff" value="${escHtml(profile.nick_color || '')}" maxlength="7" ${!checkColumns ? 'disabled' : ''} oninput="updateColorPreview(this, 'cc-edit-nickcolor-picker')" />
                <div class="cc-profile-color-picker-btn">
                  <input type="color" id="cc-edit-nickcolor-picker" value="${profile.nick_color || '#ffffff'}" ${!checkColumns ? 'disabled' : ''} oninput="updateColorText(this, 'cc-edit-nickcolor')" />
                </div>
              </div>
              <div class="cc-profile-checkbox-row">
                <input type="checkbox" id="cc-edit-boldnick" ${profile.bold_nick ? 'checked' : ''} ${!checkColumns ? 'disabled' : ''} />
                <label for="cc-edit-boldnick">Bold nick <span class="role-badge vip" style="font-size: 0.65rem;">VIP</span></label>
              </div>
            </div>
            
            <div class="cc-profile-form-group">
              <label class="cc-profile-label">Messages color (HEX code)</label>
              <div class="cc-profile-color-row">
                <input type="text" id="cc-edit-msgcolor" class="cc-profile-input" placeholder="#ffffff" value="${escHtml(profile.msg_color || '')}" maxlength="7" ${!checkColumns ? 'disabled' : ''} oninput="updateColorPreview(this, 'cc-edit-msgcolor-picker')" />
                <div class="cc-profile-color-picker-btn">
                  <input type="color" id="cc-edit-msgcolor-picker" value="${profile.msg_color || '#ffffff'}" ${!checkColumns ? 'disabled' : ''} oninput="updateColorText(this, 'cc-edit-msgcolor')" />
                </div>
              </div>
              <div class="cc-profile-checkbox-row">
                <input type="checkbox" id="cc-edit-boldtext" ${profile.bold_text ? 'checked' : ''} ${!checkColumns ? 'disabled' : ''} />
                <label for="cc-edit-boldtext">Bold text <span class="role-badge vip" style="font-size: 0.65rem;">VIP</span></label>
              </div>
            </div>
            
            <div class="cc-profile-actions full-width">
              <button type="button" class="cc-profile-btn secondary" onclick="renderProfileTab('profile', currentProfile, true, false)">Cancel</button>
              <button type="submit" class="cc-profile-btn primary" id="btn-save-profile">Save changes</button>
            </div>
          </form>
          
          <div class="cc-profile-delete-section">
            <h4>Danger Zone</h4>
            <div class="cc-profile-delete-row">
              ${!profile.is_registered ? `
                <button class="cc-profile-btn danger-sm" onclick="unregisterCurrentProfile()">Unregister profile from this chat</button>
              ` : ''}
              <button class="cc-profile-btn danger-sm" onclick="fullyDeleteCurrentProfile()">Fully delete this profile</button>
            </div>
          </div>
        </div>
      `;
    } else {
      const joinDate = profile.created_at
        ? new Date(profile.created_at).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Unknown';
      const roleLabel = getRoleLabel(profile);
      const roleBadge = getRoleBadgeHtml(profile);
      
      const avatarHtml = profile.avatar_url
        ? `<img src="${escHtml(profile.avatar_url)}" alt=""/>`
        : `<span style="font-size:3.5rem;font-weight:700;">${(profile.username || '?')[0].toUpperCase()}</span>`;
      
      const bioText = profile.bio ? escHtml(profile.bio) : '<em style="color:var(--muted)">No biography set.</em>';
      
      const sessionSecs = isMe ? Math.floor((Date.now() - sessionStart) / 1000) : 0;
      const totalSecs = profile.total_online_time || 0;
      const monthlySecs = profile.monthly_online_time || 0;

      container.innerHTML = `
        <div class="cc-profile-view-layout">
          <div class="cc-profile-view-left">
            <div class="cc-profile-large-avatar" id="cc-profile-avatar-container" style="background:${escHtml(profile.avatar_color || '#7c3aed')}">
              ${avatarHtml}
            </div>
            
            ${isMe ? `
              <div class="cc-profile-btn-vertical">
                <label class="btn-photo">
                  📷 Change photo
                  <input type="file" accept="image/*" onchange="onProfileAvatarSelect(event)" />
                </label>
                <button class="btn-edit" onclick="renderProfileTab('profile', currentProfile, true, true)">🔧 Edit profile</button>
              </div>
            ` : (getViewerRoleLevel() >= 3 ? `
              <div class="cc-profile-btn-vertical">
                <button class="btn-edit" id="cc-btn-toggle-user-vip" onclick="toggleUserVipFromProfile('${profile.id}', ${!isVip})">${isVip ? '⭐ Revoke VIP' : '⭐ Grant VIP'}</button>
                <button class="btn-photo" onclick="renderProfileTab('coins', senderProfilesCache.get('${profile.id}') || currentProfile, false)">🪙 Allot Coins</button>
              </div>
            ` : '')}
          </div>
          <div class="cc-profile-view-right">
            <div class="cc-profile-view-header">
              <span class="cc-profile-view-name">${escHtml(profile.username || 'Unknown')}</span>
              <span class="cc-profile-status-badge">ONLINE</span>
            </div>
            <div class="cc-profile-view-role">
              ${roleBadge} <span>${escHtml(roleLabel)}</span>
            </div>
            
            <table class="cc-profile-details-table">
              <tr>
                <td class="label-col">📅 Joined</td>
                <td class="val-col">${escHtml(joinDate)}</td>
              </tr>
              <tr>
                <td class="label-col">🚻 Sex</td>
                <td class="val-col">${profile.sex ? escHtml(profile.sex) : 'Not specified'}</td>
              </tr>
              <tr>
                <td class="label-col">🎂 Birthdate</td>
                <td class="val-col">${profile.birthdate ? formatDateString(profile.birthdate) : 'Not specified'}</td>
              </tr>
              <tr>
                <td class="label-col">🌐 Country</td>
                <td class="val-col">${profile.country ? escHtml(profile.country) : 'Not specified'}</td>
              </tr>
              <tr>
                <td class="label-col">❤️ Relationship</td>
                <td class="val-col">${profile.relationship_status ? escHtml(profile.relationship_status) : 'Not specified'}</td>
              </tr>
              <tr>
                <td class="label-col">📝 About me</td>
                <td class="val-col">${bioText}</td>
              </tr>
            </table>

            <div class="cc-profile-online-time-card">
              <h4 style="margin:0 0 12px;color:#c0b0ff;font-size:0.95rem;font-family:'Exo 2',sans-serif;">⏱️ Time Spent in Chatroom</h4>
              <div class="cc-profile-time-row">
                <span class="lbl">🕒 This Session:</span>
                <span class="val" id="cc-time-session">${isMe ? formatOnlineTime(sessionSecs) : 'Active'}</span>
              </div>
              <div class="cc-profile-time-row">
                <span class="lbl">📆 This Month:</span>
                <span class="val" id="cc-time-month">${formatOnlineTime(monthlySecs)}</span>
              </div>
              <div class="cc-profile-time-row">
                <span class="lbl">🌐 All Time:</span>
                <span class="val" id="cc-time-all">${formatOnlineTime(totalSecs)}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  } 
  
  else if (tab === 'vip') {
    const isVip = profile.is_vip || profile.is_admin || profile.is_mod || profile.is_owner;
    
    container.innerHTML = `
      <div>
        <div class="cc-profile-vip-card">
          <h3 class="cc-profile-vip-title">⭐ VIP Privileges</h3>
          <p class="cc-profile-vip-text">
            Unlock exclusive custom styling and rise above the rest in the chat. Customize how your name and messages appear in the main chat room.
          </p>
        </div>
        
        <div class="cc-profile-vip-features">
          <div class="cc-profile-vip-feature-item">
            <span class="cc-profile-vip-icon">🎨</span>
            <div>
              <div class="cc-profile-vip-lbl">Custom Nickname Color</div>
              <span style="font-size:0.75rem;color:var(--muted)">Pick any hex color for your nickname.</span>
            </div>
          </div>
          
          <div class="cc-profile-vip-feature-item">
            <span class="cc-profile-vip-icon">✍️</span>
            <div>
              <div class="cc-profile-vip-lbl">Custom Message Color</div>
              <span style="font-size:0.75rem;color:var(--muted)">Change color of all messages you send.</span>
            </div>
          </div>
          
          <div class="cc-profile-vip-feature-item">
            <span class="cc-profile-vip-icon">🔤</span>
            <div>
              <div class="cc-profile-vip-lbl">Bold Nickname & Text</div>
              <span style="font-size:0.75rem;color:var(--muted)">Make your name and messages stand out in bold.</span>
            </div>
          </div>
          
          <div class="cc-profile-vip-feature-item">
            <span class="cc-profile-vip-icon">👑</span>
            <div>
              <div class="cc-profile-vip-lbl">VIP Badge Highlight</div>
              <span style="font-size:0.75rem;color:var(--muted)">A shiny VIP badge displayed next to your name.</span>
            </div>
          </div>
        </div>
        
        <div style="margin-top:24px;text-align:center;background:rgba(10,12,32,0.4);border:1px solid rgba(255,255,255,0.05);padding:20px;border-radius:12px;">
          <h4 style="margin:0 0 10px;color:#fff;">Your VIP Status</h4>
          ${isVip ? `
            <div style="color:#4ade80;font-weight:700;font-size:1.1rem;display:flex;align-items:center;justify-content:center;gap:6px;">
              <span>✅ VIP Privileges Active</span>
            </div>
            <p style="font-size:0.8rem;color:var(--muted);margin:6px 0 0;">You can customize your styles in the "My profile" edit section.</p>
          ` : `
            <div style="color:#f59e0b;font-weight:700;font-size:1.1rem;margin-bottom:12px;">
              <span>❌ Inactive</span>
            </div>
            <button class="cc-profile-btn primary" onclick="claimFreeVipDeveloperMode()">Activate VIP (Developer Mode)</button>
          `}
        </div>
      </div>
    `;
  } 
  
  else if (tab === 'ignore') {
    container.innerHTML = `
      <h3 style="color:#fff;margin:0 0 16px;font-family:'Exo 2',sans-serif;">🚫 Blocked Users</h3>
      <div id="cc-profile-ignore-list-container">
        <div class="cc-profile-empty">Loading ignore list...</div>
      </div>
    `;
    loadIgnoreListTab();
  } 
  
  else if (tab === 'coins') {
    const coinsVal = profile.coins !== undefined ? profile.coins : 150;
    
    if (isMe) {
      container.innerHTML = `
        <div class="cc-profile-coins-card" style="padding: 20px 10px;">
          <span class="cc-profile-coin-spinner">🪙</span>
          <div class="cc-profile-coins-bal">${coinsVal} Coins</div>
          <p class="cc-profile-coins-desc" style="margin-bottom:12px;">
            Coins can be spent on premium emojis, voice note filters, background styles, and virtual gifts.
          </p>
          
          <h4 style="color:#fff; margin:20px 0 10px; font-family:'Exo 2',sans-serif; text-align:left; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:6px;">🛒 Purchase Coins</h4>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; text-align: left;">
            <div style="background: rgba(10, 12, 32, 0.5); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-weight: 700; color: #fff; font-size: 1.1rem; margin-bottom: 4px;">🪙 150 Coins</div>
                <span style="font-size: 0.75rem; color: var(--muted);">Starter coin package for chat items.</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
                <span style="font-weight: 700; color: #f59e0b; font-family: 'Orbitron';">100 PKR</span>
                <button class="cc-profile-btn primary" style="padding: 6px 12px; font-size: 0.75rem;" onclick="contactAdminForCoins(150, 100)">Buy Now</button>
              </div>
            </div>
            
            <div style="background: rgba(10, 12, 32, 0.5); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-weight: 700; color: #fff; font-size: 1.1rem; margin-bottom: 4px;">🪙 250 Coins</div>
                <span style="font-size: 0.75rem; color: var(--muted);">Popular coin package with extra value.</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
                <span style="font-weight: 700; color: #f59e0b; font-family: 'Orbitron';">150 PKR</span>
                <button class="cc-profile-btn primary" style="padding: 6px 12px; font-size: 0.75rem;" onclick="contactAdminForCoins(250, 150)">Buy Now</button>
              </div>
            </div>
          </div>
          
          <div style="margin-top:16px; font-size:0.8rem; color:var(--muted); text-align:center; background:rgba(10, 12, 32, 0.3); padding:10px; border-radius:8px;">
            ℹ️ Payments are accepted via JazzCash / EasyPaisa / Bank Transfer. Clicking "Buy Now" will open a private message with the Admin to complete your purchase.
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="cc-profile-coins-card" style="padding: 20px 10px;">
          <span class="cc-profile-coin-spinner">🪙</span>
          <div class="cc-profile-coins-bal">${coinsVal} Coins</div>
          <p style="color:var(--muted);font-size:0.9rem;margin-bottom:12px;">This is the coin balance for user ${escHtml(profile.username || 'User')}.</p>
          
          <div style="margin-top:20px; background:rgba(10,12,32,0.4); border:1px solid rgba(255,255,255,0.05); padding:20px; border-radius:12px; text-align:left;">
            <h4 style="margin:0 0 12px;color:#fff;">🛡️ Admin Coins Control</h4>
            <p style="font-size:0.8rem;color:var(--muted);margin:0 0 14px;">Allot any amount of coins to this user by entering the quantity below.</p>
            
            <div style="display:flex;gap:12px;align-items:center;">
              <input type="number" id="cc-allot-coins-val" class="cc-profile-input" style="width:120px;" value="${coinsVal}" min="0" />
              <button class="cc-profile-btn primary" onclick="allotCoinsToUser('${profile.id}')">💾 Allot Coins</button>
            </div>
          </div>
        </div>
      `;
    }
  } 
  
  else if (tab === 'account') {
    container.innerHTML = `
      <h3 style="color:#fff;margin:0 0 18px;font-family:'Exo 2',sans-serif;">⚙️ Account Settings</h3>
      <div class="cc-profile-form-grid">
        <div class="cc-profile-form-group">
          <label class="cc-profile-label">Registration Type</label>
          <input type="text" class="cc-profile-input" value="${profile.is_registered ? 'Registered Account' : 'Guest Profile'}" disabled />
        </div>
        
        <div class="cc-profile-form-group">
          <label class="cc-profile-label">Email Address</label>
          <input type="text" class="cc-profile-input" value="${escHtml(profile.email || 'None (Guest)')}" disabled />
        </div>
        
        ${profile.is_registered ? `
          <div class="cc-profile-form-group full-width" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:18px;margin-top:10px;">
            <h4 style="margin:0 0 12px;color:#fff;">Change Password</h4>
          </div>
          
          <div class="cc-profile-form-group">
            <label class="cc-profile-label">New Password</label>
            <input type="password" id="cc-account-newpass" class="cc-profile-input" placeholder="Min 6 characters" />
          </div>
          
          <div class="cc-profile-form-group" style="justify-content:flex-end;">
            <button class="cc-profile-btn primary" onclick="updateAccountPassword()">Update Password</button>
          </div>
        ` : ''}
      </div>
    `;
  }
}

function updateColorPreview(input, pickerId) {
  const picker = document.getElementById(pickerId);
  if (picker && /^#[0-9A-F]{6}$/i.test(input.value)) {
    picker.value = input.value;
  }
}

function updateColorText(picker, inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.value = picker.value.toUpperCase();
  }
}

function formatDateString(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (_) {
    return dateStr;
  }
}

function onProfileAvatarSelect(event) {
  const file = event.target.files?.[0];
  if (!file || !file.type.startsWith('image/')) {
    showChatToast('Please select a valid image.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const SIZE = 100;
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      const srcAspect = img.naturalWidth / img.naturalHeight;
      let sx, sy, sw, sh;
      if (srcAspect >= 1) {
        sh = img.naturalHeight;
        sw = img.naturalHeight;
        sx = (img.naturalWidth - sw) / 2;
        sy = 0;
      } else {
        sw = img.naturalWidth;
        sh = img.naturalWidth;
        sx = 0;
        sy = (img.naturalHeight - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
      
      const croppedUrl = canvas.toDataURL('image/jpeg', 0.85);
      pendingAvatarDataUrl = croppedUrl;
      
      const container = document.getElementById('cc-profile-avatar-container');
      if (container) {
        container.innerHTML = `<img src="${croppedUrl}" alt=""/>`;
      }
      showChatToast('Avatar preview updated. Click "Edit Profile" and then "Save Changes" to finalize!', 'info');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveProfileChanges(event) {
  event.preventDefault();
  
  const saveBtn = document.getElementById('btn-save-profile');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
  
  const newUsername = document.getElementById('cc-edit-username').value.trim();
  if (!newUsername) {
    showChatToast('Username cannot be empty.', 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save changes'; }
    return;
  }
  
  const payload = {
    username: newUsername
  };
  
  const sexEl = document.getElementById('cc-edit-sex');
  if (sexEl && !sexEl.disabled) {
    payload.sex = sexEl.value;
    
    const day = document.getElementById('cc-edit-bday').value;
    const month = document.getElementById('cc-edit-bmonth').value;
    const year = document.getElementById('cc-edit-byear').value;
    if (day && month && year) {
      payload.birthdate = `${year}-${month}-${day}`;
    } else {
      payload.birthdate = null;
    }
    
    payload.country = document.getElementById('cc-edit-country').value;
    payload.relationship_status = document.getElementById('cc-edit-relationship').value;
    payload.bio = document.getElementById('cc-edit-bio').value.trim();
    payload.nick_color = document.getElementById('cc-edit-nickcolor').value.trim() || null;
    payload.bold_nick = document.getElementById('cc-edit-boldnick').checked;
    payload.msg_color = document.getElementById('cc-edit-msgcolor').value.trim() || null;
    payload.bold_text = document.getElementById('cc-edit-boldtext').checked;
  }
  
  try {
    if (pendingAvatarDataUrl) {
      localStorage.setItem('cc-avatar-' + currentUser.id, pendingAvatarDataUrl);
      payload.avatar_url = pendingAvatarDataUrl;
      currentProfile.avatar_url = pendingAvatarDataUrl;
      pendingAvatarDataUrl = null;
    }
    
    const { error } = await sbClient.from('profiles').update(payload).eq('id', currentUser.id);
    if (error) throw error;
    
    currentProfile = { ...currentProfile, ...payload };
    updatePresenceBaseFromProfile(currentProfile);
    updateCurrentUserBadge();
    
    if (presenceChannel) {
      presenceChannel.track(presenceBaseData).catch(() => {});
    }
    
    showChatToast('Profile saved successfully!', 'success');
    renderProfileTab('profile', currentProfile, true, false);
  } catch (err) {
    showChatToast('Error saving profile: ' + (err.message || err), 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save changes'; }
  }
}

async function claimFreeVipDeveloperMode() {
  try {
    const { error } = await sbClient.from('profiles').update({ is_vip: true }).eq('id', currentUser.id);
    if (error) throw error;
    currentProfile.is_vip = true;
    updatePresenceBaseFromProfile(currentProfile);
    if (presenceChannel) presenceChannel.track(presenceBaseData).catch(() => {});
    showChatToast('⭐ VIP Activated! Enjoy exclusive nickname/message styles.', 'success');
    renderProfileTab('vip', currentProfile, true);
  } catch (err) {
    showChatToast('Failed to activate VIP: ' + err.message, 'error');
  }
}

async function unregisterCurrentProfile() {
  if (!confirm('Are you sure you want to unregister? This will log you out.')) return;
  try {
    await logout();
  } catch (err) {
    showChatToast('Failed to unregister: ' + err.message, 'error');
  }
}

async function fullyDeleteCurrentProfile() {
  if (!confirm('⚠️ WARNING: This will permanently delete your profile and account. This cannot be undone. Proceed?')) return;
  try {
    const { error } = await sbClient.from('profiles').delete().eq('id', currentUser.id);
    if (error) throw error;
    await sbClient.auth.signOut();
    window.location.replace('login.html');
  } catch (err) {
    showChatToast('Failed to delete account: ' + err.message, 'error');
  }
}

async function loadIgnoreListTab() {
  const container = document.getElementById('cc-profile-ignore-list-container');
  if (!container) return;
  
  const ids = Array.from(ignoredUserIds);
  if (!ids.length) {
    container.innerHTML = '<div class="cc-profile-empty">Your ignore list is empty.</div>';
    return;
  }
  
  try {
    const { data, error } = await sbClient
      .from('profiles')
      .select('id, username, avatar_color, avatar_url')
      .in('id', ids);
    if (error) throw error;
    
    if (!data || !data.length) {
      container.innerHTML = '<div class="cc-profile-empty">Your ignore list is empty.</div>';
      return;
    }
    
    let html = '<div class="cc-profile-ignore-list">';
    data.forEach(user => {
      const avatarHtml = user.avatar_url
        ? `<img src="${escHtml(user.avatar_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"/>`
        : (user.username || '?')[0].toUpperCase();
      const color = user.avatar_color || '#7c3aed';
      
      html += `
        <div class="cc-profile-ignore-row" id="cc-ignore-row-${user.id}">
          <div class="cc-profile-ignore-user">
            <div class="cc-profile-ignore-avatar" style="background:${color}">${avatarHtml}</div>
            <span class="cc-profile-ignore-uname">${escHtml(user.username || 'User')}</span>
          </div>
          <button class="cc-profile-btn danger-sm" style="padding:6px 12px;font-size:0.75rem;" onclick="unignoreFromTab('${user.id}')">Unignore</button>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="cc-profile-empty" style="color:#ff8b8b;">Error loading ignore list: ${escHtml(err.message)}</div>`;
  }
}

async function unignoreFromTab(userId) {
  setUserIgnored(userId, false);
  const row = document.getElementById(`cc-ignore-row-${userId}`);
  if (row) {
    row.remove();
  }
  if (ignoredUserIds.size === 0) {
    const container = document.getElementById('cc-profile-ignore-list-container');
    if (container) {
      container.innerHTML = '<div class="cc-profile-empty">Your ignore list is empty.</div>';
    }
  }
}

async function updateAccountPassword() {
  const newPass = document.getElementById('cc-account-newpass').value;
  if (!newPass || newPass.length < 6) {
    showChatToast('Password must be at least 6 characters.', 'error');
    return;
  }
  try {
    const { error } = await sbClient.auth.updateUser({ password: newPass });
    if (error) throw error;
    showChatToast('Password updated successfully!', 'success');
    document.getElementById('cc-account-newpass').value = '';
  } catch (err) {
    showChatToast('Failed to update password: ' + err.message, 'error');
  }
}

/* ⏱️ Online Time spent tracking logic */
let sessionStart = Date.now();
let displayTotalOnline = 0;
let displayMonthlyOnline = 0;
let onlineTimeTickInterval = null;
let onlineTimeFlushInterval = null;

function startOnlineTimeTracking(profile) {
  if (!profile) return;
  
  sessionStart = Date.now();
  displayTotalOnline = profile.total_online_time || 0;
  displayMonthlyOnline = profile.monthly_online_time || 0;
  
  clearInterval(onlineTimeTickInterval);
  clearInterval(onlineTimeFlushInterval);
  
  onlineTimeTickInterval = setInterval(() => {
    displayTotalOnline++;
    displayMonthlyOnline++;
    
    const sessionEl = document.getElementById('cc-time-session');
    const monthEl = document.getElementById('cc-time-month');
    const allEl = document.getElementById('cc-time-all');
    
    if (sessionEl) {
      const sessionSecs = Math.floor((Date.now() - sessionStart) / 1000);
      sessionEl.textContent = formatOnlineTime(sessionSecs);
    }
    if (monthEl) {
      monthEl.textContent = formatOnlineTime(displayMonthlyOnline);
    }
    if (allEl) {
      allEl.textContent = formatOnlineTime(displayTotalOnline);
    }
  }, 1000);
  
  onlineTimeFlushInterval = setInterval(flushOnlineTime, 15000);
  window.addEventListener('beforeunload', flushOnlineTime);
}

async function flushOnlineTime() {
  if (!currentUser?.id) return;
  
  const now = new Date();
  const monthCode = now.getFullYear() * 100 + (now.getMonth() + 1);
  
  const payload = {
    total_online_time: displayTotalOnline,
    monthly_online_time: displayMonthlyOnline,
    last_active_month: monthCode
  };
  
  if (currentProfile?.last_active_month && currentProfile.last_active_month !== monthCode) {
    displayMonthlyOnline = 0;
    payload.monthly_online_time = 0;
  }
  
  try {
    await sbClient.from('profiles').update(payload).eq('id', currentUser.id);
    if (currentProfile) {
      currentProfile.total_online_time = payload.total_online_time;
      currentProfile.monthly_online_time = payload.monthly_online_time;
      currentProfile.last_active_month = monthCode;
    }
  } catch (err) {
    console.error('Error flushing online time:', err);
  }
}

function formatOnlineTime(totalSeconds) {
  if (!totalSeconds || totalSeconds < 0) return '0s';
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  let parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

/* 🪙 Admin Coins & VIP Control Logic */
async function toggleUserVipFromProfile(userId, grant) {
  try {
    const { error } = await sbClient.from('profiles').update({ is_vip: grant }).eq('id', userId);
    if (error) throw error;
    
    const cached = senderProfilesCache.get(userId);
    if (cached) {
      cached.is_vip = grant;
    }
    if (onlineUsers[userId]) {
      onlineUsers[userId].isVip = grant;
    }
    
    showChatToast(grant ? '⭐ VIP status granted!' : '⭐ VIP status revoked!', 'success');
    showProfileModal(userId, 'profile');
  } catch (err) {
    showChatToast('Failed to update VIP: ' + err.message, 'error');
  }
}

async function allotCoinsToUser(userId) {
  const input = document.getElementById('cc-allot-coins-val');
  if (!input) return;
  
  const amount = parseInt(input.value, 10);
  if (isNaN(amount) || amount < 0) {
    showChatToast('Please enter a valid coin amount.', 'error');
    return;
  }
  
  try {
    const { error } = await sbClient.from('profiles').update({ coins: amount }).eq('id', userId);
    if (error) throw error;
    
    const cached = senderProfilesCache.get(userId);
    if (cached) {
      cached.coins = amount;
    }
    if (userId === currentUser?.id) {
      currentProfile.coins = amount;
    }
    
    showChatToast(`🪙 Successfully allotted ${amount} coins!`, 'success');
    
    const updatedProfile = cached || (userId === currentUser?.id ? currentProfile : null);
    if (updatedProfile) {
      renderProfileTab('coins', updatedProfile, userId === currentUser?.id);
    }
  } catch (err) {
    showChatToast('Failed to allot coins: ' + err.message, 'error');
  }
}

async function contactAdminForCoins(coins, price) {
  closeProfileModal();
  
  const adminUser = Object.values(onlineUsers).find(u => u.isOwner || u.is_owner || u.isAdmin || u.is_admin);
  
  if (adminUser) {
    showChatToast(`Opening chat with Admin ${adminUser.username} to purchase coins...`, 'success');
    if (typeof openPrivateChat === 'function') {
      openPrivateChat(adminUser.userId, adminUser.username);
      setTimeout(() => {
        const pmInput = document.querySelector('.pm-window-input');
        if (pmInput) {
          pmInput.value = `Hi, I would like to buy the ${coins} Coins package for ${price} PKR.`;
          pmInput.focus();
        }
      }, 500);
    }
  } else {
    try {
      const { data } = await sbClient.from('profiles').select('id, username').eq('is_owner', true).limit(1).maybeSingle();
      if (data) {
        showChatToast(`Opening chat with Admin ${data.username} to purchase coins...`, 'success');
        if (typeof openPrivateChat === 'function') {
          openPrivateChat(data.id, data.username);
        }
      } else {
        showChatToast('No administrators are currently online. Please check back later or contact SleepyOak.', 'info');
      }
    } catch (_) {
      showChatToast('No administrators are currently online. Please check back later.', 'info');
    }
  }
}

window.toggleUserVipFromProfile = toggleUserVipFromProfile;
window.allotCoinsToUser = allotCoinsToUser;
window.contactAdminForCoins = contactAdminForCoins;

/* ════════════════════════════════════════════════════════════════
   Online Radio System
   ════════════════════════════════════════════════════════════════ */

const RADIO_PLAYLISTS = {
  PK: {
    name: "Pakistan 🇵🇰",
    channels: [
      { name: "Samaa FM 107.4", url: "https://samaapew107-itelservices.radioca.st/stream" },
      { name: "Mast FM 103", url: "https://stream.zeno.fm/7x3bfa0zu0hvv" },
      { name: "FM 100 Karachi", url: "https://stream.zeno.fm/9a7d3hpyu0hvv" }
    ]
  },
  US: {
    name: "United States 🇺🇸",
    channels: [
      { name: "Chilltrax (Ambient/Chill)", url: "https://ice64.securenetsystems.net/CHILLTRAX" },
      { name: "Jazz24 (Seattle)", url: "https://live.jazz24.org/jazz24-mp3" },
      { name: "KEXP 90.3 FM (Alternative)", url: "https://kexp-mp3-128.streamguys1.com/kexp128.mp3" },
      { name: "WNYC News (New York)", url: "https://wnyc-am.wnyc.org/wnycam-web" }
    ]
  },
  UK: {
    name: "United Kingdom 🇬🇧",
    channels: [
      { name: "Capital FM London", url: "https://icecast.global.com/capitalmp3" },
      { name: "Classic FM", url: "https://icecast.global.com/classicmp3" },
      { name: "LBC London News", url: "https://icecast.global.com/lbcmp3" }
    ]
  },
  IN: {
    name: "India 🇮🇳",
    channels: [
      { name: "Radio Mirchi Love", url: "https://stream.zeno.fm/a87g1p7320hvv" },
      { name: "Bollywood Retro Hits", url: "https://stream.zeno.fm/6wz38f1h20hvv" },
      { name: "Radio City Hindi", url: "https://stream.zeno.fm/f8z7c7q20hvv" }
    ]
  },
  FR: {
    name: "France 🇫🇷",
    channels: [
      { name: "FIP Radio (Eclectic)", url: "https://stream.radiofrance.fr/fip/fip.mp3" },
      { name: "France Inter", url: "https://stream.radiofrance.fr/franceinter/franceinter.mp3" },
      { name: "NRJ Hits", url: "https://direct.nrj.fr/live/nrj-128.mp3" }
    ]
  },
  DE: {
    name: "Germany 🇩🇪",
    channels: [
      { name: "Deutschlandfunk", url: "https://st01.sslstream.dlf.de/dlf/01/128/mp3/stream.mp3" },
      { name: "TechnoBase.FM", url: "https://listen.technobase.fm/tunein-mp3-hd" },
      { name: "WDR 1Live", url: "https://wdr-1live-live.sslstream.wdr.de/wdr/1live/live/mp3/128/stream.mp3" }
    ]
  }
};

window.radioPlayer = new Audio();
window.radioPlayer.preload = "none";

function toggleRadioControls() {
  const container = document.getElementById('radio-selectors');
  if (container) {
    container.classList.toggle('hidden');
  }
}

function onRadioCountryChange(countryCode) {
  const channelSelect = document.getElementById('radio-channel-select');
  if (!channelSelect) return;
  
  // Clear previous options
  channelSelect.innerHTML = '<option value="">-- Set Channel --</option>';
  
  if (!countryCode || !RADIO_PLAYLISTS[countryCode]) {
    channelSelect.disabled = true;
    return;
  }
  
  const data = RADIO_PLAYLISTS[countryCode];
  data.channels.forEach((ch, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = ch.name;
    channelSelect.appendChild(opt);
  });
  
  channelSelect.disabled = false;
}

async function onRadioChannelChange(channelIdx) {
  const countryCode = document.getElementById('radio-country-select').value;
  const statusArea = document.getElementById('radio-status-area');
  const statusText = document.getElementById('radio-status-text');
  
  if (!countryCode || channelIdx === "" || !RADIO_PLAYLISTS[countryCode]) {
    return;
  }
  
  const channel = RADIO_PLAYLISTS[countryCode].channels[parseInt(channelIdx, 10)];
  const countryName = RADIO_PLAYLISTS[countryCode].name.split(" ")[0];
  
  // Prevent WebRTC Voice Chat from playing at the same time
  if (typeof leaveVoice === 'function') {
    leaveVoice();
  }
  
  try {
    statusArea.classList.remove('hidden');
    statusText.textContent = `Playing: ${channel.name} - ${countryName}`;
    
    window.radioPlayer.src = channel.url;
    await window.radioPlayer.play();
  } catch (err) {
    console.error("Radio play failed:", err);
    showChatToast("Could not load radio stream: " + err.message, "error");
    stopRadioPlayer();
  }
}

function stopRadioPlayer() {
  if (window.radioPlayer) {
    window.radioPlayer.pause();
    window.radioPlayer.src = "";
    try { window.radioPlayer.load(); } catch(_) {}
  }
  const statusArea = document.getElementById('radio-status-area');
  if (statusArea) {
    statusArea.classList.add('hidden');
  }
  const channelSelect = document.getElementById('radio-channel-select');
  if (channelSelect) {
    channelSelect.value = "";
  }
}

function clearScreenLocally() {
  const container = document.getElementById('messages');
  if (container) {
    container.innerHTML = '';
    showChatToast('Chat screen cleared locally.', 'success');
  }
}

async function clearAllRoomMessages() {
  if (!currentRoom?.id) return;
  if (getViewerRoleLevel() < 3) {
    showChatToast('You do not have permission to clear this room.', 'error');
    return;
  }

  const confirmed = confirm('⚠️ WARNING: This will permanently delete ALL messages in this room for everyone. Proceed?');
  if (!confirmed) return;

  const btn = document.getElementById('btn-clear-all');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Clearing…';
  }

  try {
    const { error } = await sbClient.from('messages').delete().eq('room_id', currentRoom.id);
    if (error) throw error;
    showChatToast('All messages cleared successfully.', 'success');
    
    // Clear screen locally
    const container = document.getElementById('messages');
    if (container) container.innerHTML = '';
  } catch (err) {
    console.error('Clear all failed:', err);
    showChatToast('Failed to clear messages: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Clear For All';
    }
  }
}

window.toggleRadioControls = toggleRadioControls;
window.onRadioCountryChange = onRadioCountryChange;
window.onRadioChannelChange = onRadioChannelChange;
window.stopRadioPlayer = stopRadioPlayer;
window.clearScreenLocally = clearScreenLocally;
window.clearAllRoomMessages = clearAllRoomMessages;



