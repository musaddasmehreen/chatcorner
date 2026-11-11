/* ══ Theme Management ═══════════════════════════════════════════
   Reads/writes localStorage key 'cc-theme'.
   Syncs dots in both the chat theme bar and any fixed switcher.
═══════════════════════════════════════════════════════════════ */
const THEMES      = ['nebula','ember','arctic','matrix','rose'];
const THEME_NAMES = { nebula:'Nebula', ember:'Ember \ud83d\udd25', arctic:'Arctic \u2744\ufe0f', matrix:'Matrix', rose:'Rose \ud83c\udf38' };
const GUEST_VOICE_LIMIT = 2;
const EMOJI_GROUPS = [
  {
    label: '💫 Moving & Emotional',
    items: [
      { emoji: '😍', title: 'Love Pulse', live: 'live-pulse' },
      { emoji: '😂', title: 'Laughing Tears', live: 'live-wiggle' },
      { emoji: '🥳', title: 'Party Celebrate', live: 'live-spin' },
      { emoji: '😭', title: 'Crying Tears', live: 'live-sway' },
      { emoji: '😡', title: 'Angry Rage', live: 'live-shake' },
      { emoji: '😊', title: 'Happy Bounce', live: 'live-bounce' },
      { emoji: '💖', title: 'Heartbeat Pulse', live: 'live-heartbeat' },
      { emoji: '🥺', title: 'Pleading Eyes', live: 'live-float' },
      { emoji: '🔥', title: 'Fire Flame', live: 'live-fire' },
      { emoji: '😘', title: 'Kiss Pop', live: 'live-pop' },
      { emoji: '😴', title: 'Sleeping Float', live: 'live-float' },
      { emoji: '😎', title: 'Cool Shades', live: 'live-bounce' },
      { emoji: '✨', title: 'Sparkles Pulse', live: 'live-pulse' },
      { emoji: '👻', title: 'Ghost Dance', live: 'live-wiggle' },
      { emoji: '🫂', title: 'Warm Hug', live: 'live-heartbeat' },
      { emoji: '🥰', title: 'Blush Love', live: 'live-pulse' },
      { emoji: '🤣', title: 'Rolling Laugh', live: 'live-spin' },
      { emoji: '🫠', title: 'Melting Sway', live: 'live-sway' },
      { emoji: '😮', title: 'Wow Pop', live: 'live-pop' },
      { emoji: '⭐', title: 'Star Twinkle', live: 'live-spin' },
      { emoji: '🐾', title: 'Cute Paws', live: 'live-bounce' }
    ]
  },
  {
    label: '🎀 Smart & Cute',
    items: [
      '🐱', '🐰', '🧸', '🐼', '🐻', '🦊', '🐶', '🐹', '🐣', '🦄', '🐨', '🐧', '🐥', '🐬', '🦋',
      '🥺', '🥰', '😻', '😽', '😚', '🤭', '🫣', '🫶', '💖', '🤍', '💌',
      '🌸', '🎀', '🍓', '🍩', '🧁', '🍭', '🍡', '🍧', '🍯', '🧋', '🌷', '🫧', '💫', '🪞', '🪄'
    ]
  },
  {
    label: '🌟 Super Animated Icons',
    items: [
      { emoji: '[super-kitty]', title: 'Kitty Bow' },
      { emoji: '[super-bunny]', title: 'Bunny Basket' },
      { emoji: '[super-dance]', title: 'Dancing Silhouette' },
      { emoji: '[super-wreath]', title: 'Spinning Wreath' },
      { emoji: '[super-welcome]', title: 'Welcome Banner' },
      { emoji: '[super-kissing]', title: 'Umbrella Kiss' },
      { emoji: '[super-car]', title: 'Driving Car' },
      { emoji: '[super-swing]', title: 'Gymnast Swing' },
      { emoji: '[super-motorcycle]', title: 'Flaming Bike' },
      { emoji: '[super-shooting]', title: 'Laser Gun' },
      { emoji: '[super-sleeping]', title: 'Floating Zzz' },
      { emoji: '[super-screamer]', title: 'Screamer' }
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
    label: 'Fun & Aesthetic',
    items: ['🔥','✨','🌈','⭐','⚡','🎉','🎊','🎈','🎵','🎶','💯','💥','🌸','🍕','☕','🎮']
  }
];

const MOVING_EMOJI_ANIMATIONS = {
  '😍': 'live-pulse',
  '😂': 'live-wiggle',
  '🥳': 'live-spin',
  '😭': 'live-sway',
  '😡': 'live-shake',
  '😊': 'live-bounce',
  '💖': 'live-heartbeat',
  '🥺': 'live-float',
  '🔥': 'live-fire',
  '😘': 'live-pop',
  '😴': 'live-float',
  '😎': 'live-bounce',
  '✨': 'live-pulse',
  '👻': 'live-wiggle',
  '🫂': 'live-heartbeat',
  '🥰': 'live-pulse',
  '🤣': 'live-spin',
  '🫠': 'live-sway',
  '😮': 'live-pop',
  '⭐': 'live-spin',
  '🐾': 'live-bounce'
};

const MOVING_SHORTCODES = {
  ':love:': '😍',
  ':laugh:': '😂',
  ':party:': '🥳',
  ':cry:': '😭',
  ':angry:': '😡',
  ':bounce:': '😊',
  ':heartbeat:': '💖',
  ':plead:': '🥺',
  ':fire:': '🔥',
  ':kiss:': '😘',
  ':sleep:': '😴',
  ':cool:': '😎',
  ':sparkles:': '✨',
  ':ghost:': '👻',
  ':hug:': '🫂',
  ':blush:': '🥰',
  ':rofl:': '🤣',
  ':melt:': '🫠',
  ':wow:': '😮',
  ':star:': '⭐',
  ':paws:': '🐾'
};

function parseMovingEmojisHtml(text) {
  if (typeof text !== 'string') return text;
  let result = text;
  Object.keys(MOVING_SHORTCODES).forEach(code => {
    result = result.split(code).join(MOVING_SHORTCODES[code]);
  });
  const parts = result.split(/(<[^>]+>)/g);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] && !parts[i].startsWith('<')) {
      Object.keys(MOVING_EMOJI_ANIMATIONS).forEach(em => {
        if (parts[i].includes(em)) {
          parts[i] = parts[i].split(em).join('<span class="moving-emoji ' + MOVING_EMOJI_ANIMATIONS[em] + '">' + em + '</span>');
        }
      });
    }
  }
  return parts.join('');
}
window.parseMovingEmojisHtml = parseMovingEmojisHtml;

function formatMessageContent(rawContent) {
  if (!rawContent) return '';
  let str = escHtml(String(rawContent));
  if (window.parseYouTubeEmbedHtml) {
    str = window.parseYouTubeEmbedHtml(str);
  }
  str = parseSuperEmojisHtml(str);
  str = parseMovingEmojisHtml(str);
  return str;
}
window.formatMessageText = formatMessageContent;

function parseSuperEmojisHtml(text) {
  if (typeof text !== 'string') return text;
  
  const superEmojisMap = {
    '[super-wreath]': `<div class="super-emoji-container se-wreath" style="font-size:2.2rem;">🌸😊🌸</div>`,
    '[super-car]': `<div class="super-emoji-container se-car" style="font-size:2.2rem;">🚗💨</div>`,
    '[super-dance]': `<div class="super-emoji-container se-dance" style="font-size:2.2rem;">💃✨</div>`,
    '[super-screamer]': `<div class="super-emoji-container se-screamer" style="font-size:2.2rem;position:relative;margin-bottom:10px;">😱🔊<span class="se-screamer-text">Please..!</span></div>`,
    '[super-welcome]': `<div class="super-emoji-container se-welcome" style="font-size:1.4rem;">👋WELCOME👋</div>`,
    '[super-swing]': `<div class="super-emoji-container se-swing" style="font-size:2.2rem;">🤸‍♂️⛓️</div>`,
    '[super-motorcycle]': `<div class="super-emoji-container se-motorcycle" style="font-size:2.2rem;">🏍️🔥</div>`,
    '[super-kissing]': `<div class="super-emoji-container se-kiss" style="font-size:2.2rem;">💏☂️</div>`,
    '[super-shooting]': `<div class="super-emoji-container se-shoot" style="font-size:2.2rem;position:relative;">🔫<span class="se-laser-beam"></span></div>`,
    '[super-sleeping]': `<div class="super-emoji-container se-sleep" style="font-size:2.2rem;position:relative;">😴<span class="se-sleep-z" style="top:-10px;left:15px;">z</span><span class="se-sleep-z" style="top:-18px;left:25px;">Z</span><span class="se-sleep-z" style="top:-25px;left:35px;">Z</span></div>`,
    '[super-kitty]': `<div class="super-emoji-container se-kitty" style="font-size:2.2rem;">🐱🎀</div>`,
    '[super-bunny]': `<div class="super-emoji-container se-bunny" style="font-size:2.2rem;">🐰🧺</div>`
  };
  let result = text;
  Object.keys(superEmojisMap).forEach(code => {
    result = result.split(code).join(superEmojisMap[code]);
  });
  return result;
}

(function initTheme() {
  const saved = localStorage.getItem('cc-theme') || 'nebula';
  applyTheme(saved, false);
})();

function setTheme(name) {
  if (!THEMES.includes(name)) return;
  try { localStorage.setItem('cc-theme', name); } catch (_) {}
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
let activeEmojiInput = null;

function insertEmoji(emoji) {
  const input = activeEmojiInput || document.getElementById('msg-input');
  if (!input || input.disabled) return;
  const start = input.selectionStart ?? input.value.length;
  const end   = input.selectionEnd   ?? input.value.length;
  input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
  const pos = start + emoji.length;
  input.setSelectionRange(pos, pos);
  input.focus();
  closeEmojiPicker();
}

function toggleEmojiPicker(event, targetInput = null) {
  event?.stopPropagation();
  const picker = document.getElementById('emoji-picker');
  if (!picker) return;

  const isCurrentlyOpen = !picker.classList.contains('hidden');
  const target = targetInput || document.getElementById('msg-input');

  if (isCurrentlyOpen && activeEmojiInput === target) {
    closeEmojiPicker();
    return;
  }

  activeEmojiInput = target;
  if (activeEmojiInput?.disabled) return;

  picker.classList.remove('hidden');

  if (targetInput) {
    const btn = event.currentTarget || event.target;
    if (btn) {
      btn.parentNode.appendChild(picker);
      picker.style.left = 'auto';
      picker.style.right = '10px';
      picker.style.bottom = '40px';
      picker.style.position = 'absolute';
    }
  } else {
    const mainComposer = document.querySelector('.composer-toolbar');
    if (mainComposer) {
      mainComposer.appendChild(picker);
      picker.style.left = '0.8rem';
      picker.style.right = 'auto';
      picker.style.bottom = 'calc(100% + 0.5rem)';
      picker.style.position = 'absolute';
    }
  }

  if (typeof window.closeInputExtras === 'function') {
    window.closeInputExtras();
  }
}

function closeEmojiPicker() {
  const picker = document.getElementById('emoji-picker');
  if (picker) {
    picker.classList.add('hidden');
    // Return picker to main composer toolbar so it's not orphaned in a PM toolbar
    const mainComposer = document.querySelector('.composer-toolbar');
    if (mainComposer && picker.parentNode !== mainComposer) {
      mainComposer.appendChild(picker);
      picker.style.left = '0.8rem';
      picker.style.right = 'auto';
      picker.style.bottom = 'calc(100% + 0.5rem)';
    }
  }
  activeEmojiInput = null;
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
      if (/^\[super-[a-z]+\]$/.test(config.emoji)) {
        // static preview from the trusted built-in map (no user input)
        btn.innerHTML = parseSuperEmojisHtml(config.emoji);
        btn.classList.add('emoji-btn-super');
      } else {
        btn.textContent = config.emoji;
      }
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

let _ytPlayer = null;
let _isSettingVideoState = false;
let _bypassPasswordRooms = new Set();
let _contextMenuRoom = null;
let _pendingRoom = null;
let _pendingRoomEntryCallback = null;
const CLEARED_MESSAGE_ARCHIVE_KEY = 'cc-cleared-message-archive';
const MAX_CLEARED_MESSAGE_ARCHIVE_ITEMS = 250;
const DELETED_MESSAGE_PREFIX = '🗑️ Message deleted by ';
const MESSAGE_CACHE_TTL_MS = 60 * 60 * 1000;
const DELETED_MESSAGE_TOMBSTONE_KEY_PREFIX = 'cc-deleted-msgs-';
const AUTH_ENTRY_PAGE_URL = 'login.html';
const IGNORED_USERS_STORAGE_KEY = 'cc-ignored-users';
const POST_LOGIN_REDIRECT_MAX_AGE_MS = 15_000;
let guestCleanupPromise = null;
let ignoredUserIds = loadIgnoredUserIds();

/* ── Optimistic UI dedup tracking ─────────────────────────────
   Stores { content, userId, ts } for messages sent optimistically.
   Realtime INSERT for same user/content within 5s is skipped.
──────────────────────────────────────────────────────────────── */
const _optimisticPending = new Map(); // tempId -> { content, userId, ts, node }
let _optimisticCounter = 0;

/* ── Debounced presence track ──────────────────────────────────
   Coalesces rapid calls into a single track() every 1500ms.
──────────────────────────────────────────────────────────────── */
let _presenceTrackTimer = null;
function debouncedPresenceTrack() {
  if (!presenceChannel) return;
  clearTimeout(_presenceTrackTimer);
  _presenceTrackTimer = setTimeout(() => {
    presenceChannel.track(presenceBaseData).catch(() => {});
  }, 1500);
}

/* ── Textarea auto-resize helper ───────────────────────────────
   Grows the textarea up to its CSS max-height as content fills.
──────────────────────────────────────────────────────────────── */
let _resizeTicking = false;
function autoResizeTextarea(el) {
  if (!el || _resizeTicking) return;
  _resizeTicking = true;
  window.requestAnimationFrame(() => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    _resizeTicking = false;
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRoomMessageCacheKey(roomId) {
  return roomId ? `cc-msgs-${roomId}` : '';
}

function getDeletedMessageTombstoneKey(roomId) {
  return roomId ? `${DELETED_MESSAGE_TOMBSTONE_KEY_PREFIX}${roomId}` : '';
}

function readDeletedMessageTombstones(roomId) {
  if (!roomId) return {};
  const storageKey = getDeletedMessageTombstoneKey(roomId);
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const now = Date.now();
    const tombstones = {};
    let changed = false;
    Object.entries(raw || {}).forEach(([messageId, ts]) => {
      if (!messageId) {
        changed = true;
        return;
      }
      const stamp = Number(ts);
      if (!Number.isFinite(stamp) || now - stamp > MESSAGE_CACHE_TTL_MS) {
        changed = true;
        return;
      }
      tombstones[messageId] = stamp;
    });
    if (changed) {
      localStorage.setItem(storageKey, JSON.stringify(tombstones));
    }
    return tombstones;
  } catch (_) {
    return {};
  }
}

function filterDeletedMessages(messages, roomId = currentRoom?.id) {
  if (!Array.isArray(messages) || !messages.length) return [];
  const tombstones = readDeletedMessageTombstones(roomId);
  return messages.filter(msg => msg && msg.type !== 'system' && !msg.is_deleted && (!msg.id || !tombstones[msg.id]));
}

function rememberDeletedMessage(messageId, roomId = currentRoom?.id) {
  if (!messageId || !roomId) return;
  try {
    const tombstones = readDeletedMessageTombstones(roomId);
    tombstones[messageId] = Date.now();
    localStorage.setItem(getDeletedMessageTombstoneKey(roomId), JSON.stringify(tombstones));

    const cacheKey = getRoomMessageCacheKey(roomId);
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cached?.msgs?.length) {
      const msgs = cached.msgs.filter(msg => msg?.id !== messageId);
      localStorage.setItem(cacheKey, JSON.stringify({ ...cached, msgs }));
    }
  } catch (_) {}
}

function isDeletedMessage(messageId, roomId = currentRoom?.id) {
  if (!messageId || !roomId) return false;
  return Boolean(readDeletedMessageTombstones(roomId)[messageId]);
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
window.isGuestProfile = isGuestProfile;
window.isGuestUser = isGuestProfile;

function buildGuestProfile(user = currentUser) {
  const fallbackId = String(user?.id || '').replace(/-/g, '');
  const randomSuffix = fallbackId
    || (window.crypto?.randomUUID ? window.crypto.randomUUID().replace(/-/g, '') : String(Date.now()));
  return {
    id: user?.id,
    username: currentProfile?.username || `Guest_${randomSuffix.slice(0, 8).toUpperCase()}`,
    avatar_color: currentProfile?.avatar_color || randomColor(),
    avatar_url: currentProfile?.avatar_url || null,
    is_registered: false
  };
}

async function ensureGuestProfileRecord(user = currentUser) {
  if (!user?.id || user.is_anonymous !== true) {
    return currentProfile;
  }

  const guestProfile = buildGuestProfile(user);
  const { data, error } = await sbClient
    .from('profiles')
    .upsert(guestProfile)
    .select('*')
    .single();

  if (error) {
    console.warn('Guest profile upsert failed:', error);
    currentProfile = { ...guestProfile };
    return currentProfile;
  }

  currentProfile = { ...guestProfile, ...data };
  return currentProfile;
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
const recordingUsers = new Map();   // userId → { userId, username }
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

let _stealthModeActive = false;
window._stealthModeActive = false;
window._lastYouTubeLinkSentTime = 0;
let _globalChatMuted = false;

function toggleStealthMode(enabled) {
  const isStaff = currentProfile?.is_admin || currentProfile?.is_owner || currentProfile?.is_mod;
  if (!isStaff) {
    if (typeof showChatToast === 'function') showChatToast("⚠️ Only staff members can use Stealth Mode.", "warning");
    const checkbox = document.getElementById('stealth-mode-checkbox');
    if (checkbox) checkbox.checked = false;
    return;
  }

  _stealthModeActive = !!enabled;
  window._stealthModeActive = _stealthModeActive;
  presenceBaseData.isStealth = _stealthModeActive;

  try {
    localStorage.setItem('chatcorner_stealth_mode', _stealthModeActive ? 'true' : 'false');
  } catch (_) {}

  const checkbox = document.getElementById('stealth-mode-checkbox');
  if (checkbox) checkbox.checked = _stealthModeActive;

  updateCurrentUserBadge();

  if (presenceChannel) {
    debouncedPresenceTrack();
  }

  if (typeof showChatToast === 'function') {
    showChatToast(
      _stealthModeActive 
        ? "🕵️ Stealth Mode ENABLED. You are hidden from regular users in the roster." 
        : "👁️ Stealth Mode DISABLED. You are now visible to everyone in the roster.", 
      _stealthModeActive ? "info" : "success"
    );
  }
  scheduleRenderUserList();
}
window.toggleStealthMode = toggleStealthMode;

function updatePresenceBaseFromProfile(profile = currentProfile) {
  const isStaff = profile?.is_admin || profile?.is_owner || profile?.is_mod;
  if (isStaff) {
    try {
      const savedStealth = localStorage.getItem('chatcorner_stealth_mode');
      if (savedStealth === 'true') {
        _stealthModeActive = true;
        window._stealthModeActive = true;
      }
    } catch (_) {}
  } else {
    _stealthModeActive = false;
    window._stealthModeActive = false;
  }

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
    avatarUrl: profile?.avatar_url,
    totalOnlineTime: profile?.total_online_time || 0,
    isStealth: _stealthModeActive
  };

  // Toggle visibility of stealth mode checkbox based on permissions
  const stealthLabel = document.getElementById('stealth-mode-label');
  const stealthCheckbox = document.getElementById('stealth-mode-checkbox');
  if (stealthLabel) {
    if (isStaff) {
      stealthLabel.classList.remove('hidden');
      stealthLabel.style.display = 'inline-flex';
      if (stealthCheckbox) stealthCheckbox.checked = _stealthModeActive;
    } else {
      stealthLabel.classList.add('hidden');
      stealthLabel.style.display = 'none';
      if (stealthCheckbox) stealthCheckbox.checked = false;
    }
  }

  // Toggle visibility of owner global mute checkbox
  const ownerMuteLabel = document.getElementById('owner-global-mute-label');
  if (ownerMuteLabel) {
    if (profile?.is_owner) {
      ownerMuteLabel.classList.remove('hidden');
      ownerMuteLabel.style.display = 'inline-flex';
      
      // Initialize check state
      const checkbox = document.getElementById('owner-global-mute-checkbox');
      if (checkbox) checkbox.checked = !!_globalChatMuted;
    } else {
      ownerMuteLabel.classList.add('hidden');
      ownerMuteLabel.style.display = 'none';
    }
  }
}

function updateCurrentUserBadge() {
  const badge = document.getElementById('user-badge');
  if (badge && currentProfile) {
    const prefix = window._stealthModeActive ? '🔴👁️ ' : '';
    badge.textContent = prefix + currentProfile.username + (currentProfile.is_registered ? ' ✓' : ' 👤');
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
    if (presenceChannel) debouncedPresenceTrack();
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

  // Optimize: Fetch profile, room list, and proxy URL in parallel to reduce sequential database network roundtrips
  const [profileResult, roomsResult, proxyBaseUrl] = await Promise.all([
    sbClient.from('profiles').select('*').eq('id', currentUser.id).single(),
    sbClient.from('rooms').select('*').order('name'),
    window.ccSecurity ? window.ccSecurity.getAppSettingValue('proxy_base_url').catch(() => null) : Promise.resolve(null)
  ]);

  if (proxyBaseUrl) {
    window._cachedProxyBaseUrl = proxyBaseUrl.trim();
  }

  let prof = profileResult.data;
  const initialRooms = roomsResult.data || [];

  if (!prof) {
    prof = currentUser?.is_anonymous
      ? await ensureGuestProfileRecord(currentUser)
      : buildGuestProfile(currentUser);
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
  document.getElementById('btn-image-url-mobile')?.addEventListener('click', (event) => {
    if (typeof closeAllSidebars === 'function') closeAllSidebars();
    toggleRoomImageUrlInput(event);
  });
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
  const voiceNoteBtn = document.getElementById('btn-voice-note');
  if (voiceNoteBtn) {
    let isHolding = false;

    const startHold = (e) => {
      e.preventDefault();
      if (isHolding) return;
      isHolding = true;
      startVoiceNoteRecording();
    };

    const stopHold = (e) => {
      e.preventDefault();
      if (!isHolding) return;
      isHolding = false;
      stopVoiceNoteRecording();
    };

    voiceNoteBtn.addEventListener('mousedown', startHold);
    voiceNoteBtn.addEventListener('touchstart', startHold, { passive: false });
    voiceNoteBtn.addEventListener('mouseup', stopHold);
    voiceNoteBtn.addEventListener('mouseleave', stopHold);
    voiceNoteBtn.addEventListener('touchend', stopHold, { passive: false });
    voiceNoteBtn.addEventListener('touchcancel', stopHold, { passive: false });
  }


  // Character counter + auto-resize for textarea message input
  const msgInputEl = document.getElementById('msg-input');
  if (msgInputEl) {
    msgInputEl.addEventListener('input', () => {
      const len = msgInputEl.value.length;
      const counter = document.getElementById('msg-char-counter');
      if (counter) {
        counter.textContent = `${len}/500`;
        counter.style.color = len > 450 ? 'var(--red, #ef4444)' : 'var(--muted)';
      }
      autoResizeTextarea(msgInputEl);
    });
    // Enter = send, Shift+Enter = newline
    msgInputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
  }

  // Scroll-to-bottom button visibility
  let _scrollTicking = false;
  document.getElementById('messages')?.addEventListener('scroll', () => {
    if (!_scrollTicking) {
      window.requestAnimationFrame(() => {
        const el = document.getElementById('messages');
        const btn = document.getElementById('btn-scroll-bottom');
        if (el && btn) {
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          btn.classList.toggle('hidden', atBottom);
        }
        _scrollTicking = false;
      });
      _scrollTicking = true;
    }
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
    const pmEmojiBtn = event.target.closest('.pm-emoji-btn');
    if (picker && !picker.classList.contains('hidden')) {
      if (!(picker.contains(event.target) || emojiBtn?.contains(event.target) || pmEmojiBtn)) {
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

  // Pass pre-fetched rooms list to avoid duplicate loading queries
  await loadRooms(initialRooms);

  // ── Exponential-Backoff Reconnect Engine ────────────────────────────
  // Prevents the "thundering herd" problem: when hundreds of clients
  // reconnect at the same moment (e.g. after a network outage or server
  // restart) they would all hammer Supabase at the same instant without
  // jitter.  This engine adds randomised jitter so attempts are spread
  // out over time, and caps retry delay at 30 s.
  const _reconnect = (() => {
    const BASE_MS  = 1000;   // 1 s initial delay
    const MAX_MS   = 30000;  // 30 s cap
    const MAX_TRIES = 10;    // give up after 10 consecutive failures
    let _attempt  = 0;
    let _timer    = null;
    let _active   = false;

    function _delay(attempt) {
      // Full-jitter exponential back-off: random in [0, min(cap, base * 2^attempt)]
      const exp  = Math.min(MAX_MS, BASE_MS * Math.pow(2, attempt));
      return Math.floor(Math.random() * exp);
    }

    async function _doReconnect() {
      if (!currentRoom) { reset(); return; }
      if (currentRoom._virtual) {
        reset();
        const banner = document.getElementById('connection-error-banner');
        if (banner) banner.classList.add('hidden');
        return;
      }
      const banner = document.getElementById('connection-error-banner');
      try {
        await enterRoom(currentRoom, true);
        // Success — reset counter and hide banner
        reset();
        if (banner) banner.classList.add('hidden');
        showChatToast('✅ Connection restored.', 'success', 2500);
      } catch (err) {
        _attempt++;
        if (_attempt >= MAX_TRIES) {
          console.warn('[CC-RECONNECT] Max retries reached — giving up.');
          if (banner) {
            banner.querySelector('.banner-text').textContent =
              '⚠️ Could not reconnect. Please refresh the page.';
            banner.classList.remove('hidden');
          }
          reset();
          return;
        }
        const wait = _delay(_attempt);
        console.warn(`[CC-RECONNECT] Attempt ${_attempt} failed — retrying in ${wait}ms`);
        if (banner) {
          banner.querySelector('.banner-text').textContent =
            `⚠️ Connection lost. Retrying in ${Math.round(wait/1000)}s… (attempt ${_attempt}/${MAX_TRIES})`;
          banner.classList.remove('hidden');
        }
        _timer = setTimeout(_doReconnect, wait);
      }
    }

    /** Trigger a reconnect sequence (idempotent — ignores if already running). */
    function trigger() {
      if (_active) return; // already in progress
      _active = true;
      const wait = _delay(_attempt);
      _timer = setTimeout(_doReconnect, wait);
    }

    /** Cancel any pending reconnect and reset the counter. */
    function reset() {
      clearTimeout(_timer);
      _timer   = null;
      _attempt = 0;
      _active  = false;
    }

    return { trigger, reset };
  })();

  // ── Offline / Online reconnect recovery ─────────────────────────────
  window.addEventListener('offline', () => {
    const banner = document.getElementById('connection-error-banner');
    if (banner) {
      banner.querySelector('.banner-text').textContent = '⚠️ You are offline. Waiting to reconnect...';
      banner.classList.remove('hidden');
    }
  });

  window.addEventListener('online', () => {
    // Network came back — let the backoff engine handle the Supabase re-subscribe
    // so clients don't all hit the DB at exactly the same millisecond.
    showChatToast('🌐 Network restored — reconnecting...', 'info', 2000);
    _reconnect.trigger();
  });

  // Re-subscribe after tab was hidden for more than 90 seconds
  let _hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _hiddenAt = Date.now();
    } else {
      const gapMs = Date.now() - _hiddenAt;
      if (_hiddenAt > 0 && gapMs > 90_000 && currentRoom) {
        showChatToast('🔄 Refreshing connection...', 'info', 2000);
        _reconnect.trigger();
      }
      _hiddenAt = 0;
    }
  });

  // Expose so channel-error callbacks (below, outside DOMContentLoaded) can use it
  window._ccReconnect = _reconnect;
});

// ── Lightweight Room User Count Management (Zero WebSocket Overhead) ──
let _roomCountInterval = null;
let _roomUserCounts = {};

function updateAllRoomCounts(counts = _roomUserCounts) {
  _roomUserCounts = counts || {};
  document.querySelectorAll('#room-list li').forEach(li => {
    const roomId = li.dataset.roomId;
    if (!roomId) return;
    const count = counts[roomId] ?? (roomId === currentRoom?.id ? Object.keys(onlineUsers || {}).length : 0);
    let badge = li.querySelector('.room-count-pill');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'room-count-pill';
      li.prepend(badge);
    }
    badge.textContent = count;
    badge.title = count + ' online in this room';
  });
}
window.updateAllRoomCounts = updateAllRoomCounts;
window.updateAllRoomCountsFromPresence = updateAllRoomCounts;
window.trackMyCurrentRoomPresence = () => {};
window.initGlobalRoomPresence = () => {};

async function refreshRoomCounts() {
  try {
    const { data: rooms } = await sbClient.from('rooms').select('id,user_count');
    if (!rooms) return;
    rooms.forEach(r => {
      _roomUserCounts[String(r.id)] = r.user_count || 0;
    });
    if (currentRoom) {
      _roomUserCounts[String(currentRoom.id)] = Object.keys(onlineUsers || {}).length || 1;
    }
    updateAllRoomCounts(_roomUserCounts);
  } catch(_) {}
}
window.refreshRoomCounts = refreshRoomCounts;

async function loadRooms(preloadedRooms = null) {
  // Parallelize config loading to boost speed
  const [, roomsData] = await Promise.all([
    loadVirtualRoomConfig(),
    (preloadedRooms && preloadedRooms.length)
      ? Promise.resolve({ data: preloadedRooms, error: null })
      : sbClient.from('rooms').select('*').order('name')
  ]);

  try {
    let rooms = roomsData.data || preloadedRooms || [];
    if (!rooms?.length) return;
    // Exclude legacy popcorn/cowatch rooms from sidebar
    rooms = rooms.filter(r => r.room_type !== 'cowatch' && !(r.name && r.name.toLowerCase().includes('popcorn')));

    // 1. Rename 'Gaming' to 'ChatCorner'
    rooms = rooms.map(r => {
      if (r.name && r.name.toLowerCase() === 'gaming') {
        return {
          ...r,
          name: 'ChatCorner',
          description: 'ChatCorner main lobby 💬'
        };
      }
      return r;
    });

    // 2. Ensure "Guest" proper room exists
    let guestRoom = rooms.find(r => r.name && r.name.toLowerCase() === 'guest');
    if (!guestRoom) {
      guestRoom = {
        id: 'guest-room-global',
        name: 'Guest',
        description: 'Welcome lounge for guests',
        is_audio_enabled: false,
        _isGuestRoom: true
      };
      // Place Guest room right after ChatCorner
      const ccIdx = rooms.findIndex(r => r.name.toLowerCase() === 'chatcorner');
      if (ccIdx >= 0) {
        rooms.splice(ccIdx + 1, 0, guestRoom);
      } else {
        rooms.unshift(guestRoom);
      }
    }

    cachedRooms = rooms;
    const textList = document.getElementById('room-list');
    if (textList) textList.innerHTML = '';

    // Render proper rooms with user count pill in front of room name
    rooms.forEach(room => {
      const icon = room.is_audio_enabled ? '🎤' : '💬';
      const li = document.createElement('li');
      li.dataset.roomId = String(room.id);
      li.title = room.name;
      if (room.is_locked) {
        li.classList.add('room-item-locked');
      }
      const initialCount = _roomUserCounts[String(room.id)] || 0;
      li.innerHTML = `<span class="room-count-pill" title="${initialCount} online">${initialCount}</span><span class="room-icon">${icon}</span> <span class="room-name">${escHtml(room.name)}</span>`;
      li.onclick = () => enterRoom(room);
      li.oncontextmenu = (e) => {
        e.preventDefault();
        showRoomContextMenu(e, room);
      };
      if (textList) textList.appendChild(li);
    });

    // Inject virtual rooms with user count pills in front of room name
    if (textList) {
      if (_virtualRoomConfig.virtual_iptv_enabled) {
        const iptvLi = document.createElement('li');
        iptvLi.dataset.roomId = 'iptv-virtual';
        iptvLi.title = 'IPTV – Live TV Channels';
        iptvLi.classList.add('iptv-room-item');
        const count = _roomUserCounts['iptv-virtual'] || 0;
        iptvLi.innerHTML = `<span class="room-count-pill" title="${count} online">${count}</span><span class="room-icon">📺</span> <span class="room-name">IPTV</span>`;
        iptvLi.onclick = () => enterIPTVRoom();
        textList.appendChild(iptvLi);
      }

      [['sp-virtual', '🎧', 'Spotify', 'Spotify – Listen together', 'virtual_spotify_enabled'],
       ['yt-virtual', '▶️', 'YouTube', 'YouTube – Watch together', 'virtual_youtube_enabled'],
       ['browser-virtual', '🌐', 'Browser', 'Browser – Collaborative Browsing', 'virtual_browser_enabled']].forEach(([id, icon, label, title, enabledKey]) => {
        if (_virtualRoomConfig && _virtualRoomConfig[enabledKey] === false) return;
        const li = document.createElement('li');
        li.dataset.roomId = id;
        li.title = title;
        li.classList.add('iptv-room-item');
        const count = _roomUserCounts[id] || 0;
        li.innerHTML = `<span class="room-count-pill" title="${count} online">${count}</span><span class="room-icon">${icon}</span> <span class="room-name">${label}</span>`;
        li.onclick = () => {
          if (id === 'browser-virtual') {
            enterBrowserRoom();
          } else {
            enterMediaRoom(id);
          }
        };
        textList.appendChild(li);
      });

      if (_virtualRoomConfig.virtual_ludo_enabled) {
        const ludoLi = document.createElement('li');
        ludoLi.dataset.roomId = 'ludo-virtual';
        ludoLi.title = 'Ludo – Play Ludo Game';
        ludoLi.classList.add('ludo-room-item');
        const count = _roomUserCounts['ludo-virtual'] || 0;
        ludoLi.innerHTML = `<span class="room-count-pill" title="${count} online">${count}</span><span class="room-icon">🎲</span> <span class="room-name">Ludo Room</span>`;
        ludoLi.onclick = () => enterLudoRoom();
        textList.appendChild(ludoLi);
      }
    }

    renderRoomsTopbar(rooms);

    // Initial Drop: Guests drop into "Guest", Registered members drop into "ChatCorner"
    const isGuest = isGuestProfile(currentProfile);
    let targetRoom = null;
    if (isGuest) {
      targetRoom = rooms.find(r => r.name && r.name.toLowerCase() === 'guest') || rooms[0];
    } else {
      targetRoom = rooms.find(r => r.name && r.name.toLowerCase() === 'chatcorner')
                || rooms.find(r => r.name && r.name.toLowerCase() === 'gaming')
                || rooms[0];
    }
    enterRoom(targetRoom, false, true);

    tryAutoEnterLudoFromUrl();
    if (!_roomCountInterval) _roomCountInterval = setInterval(refreshRoomCounts, 60000);
  } catch(e) { console.error('loadRooms error', e); }
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

async function enterRoom(room, force = false, skipModRefresh = false) {
  if (room._virtual) {
    if (room.id === 'iptv-virtual') {
      enterIPTVRoom();
    } else if (room.id === 'sp-virtual' || room.id === 'yt-virtual') {
      enterMediaRoom(room.id);
    } else if (room.id === 'browser-virtual') {
      enterBrowserRoom();
    } else if (room.id === 'ludo-virtual') {
      enterLudoRoom();
    } 
    return;
  }

  // ── Access Guard: Only registered members can access other rooms ──
  const isGuest = isGuestProfile(currentProfile);
  const isGuestRoom = room.name && room.name.toLowerCase() === 'guest';
  if (isGuest && !isGuestRoom) {
    showChatToast('🔒 Only registered members can access other rooms. Please register or log in to unlock all rooms!', 'warning', 5000);
    return;
  }
  // Access Guard check for restricted users and locked rooms
  const isOwner = room.owner_id === currentUser?.id || currentProfile?.is_admin || currentProfile?.is_owner || currentProfile?.is_mod;
  
  if (room.description && room.description.startsWith('[') && room.description.endsWith(']') && !isOwner) {
    try {
      const restrictedIds = JSON.parse(room.description);
      if (restrictedIds.includes(currentUser?.id)) {
        showChatToast('⚠️ You are restricted from entering this room by the owner.', 'error');
        return;
      }
    } catch (_) {}
  }

  if (room.is_locked && !isOwner && !_bypassPasswordRooms.has(room.id)) {
    showRoomPasswordPrompt(room, () => {
      enterRoom(room, force, skipModRefresh);
    });
    return;
  }

  // Clean up virtual rooms layout and states
  cleanupVirtualRooms();

  // Optimization: skip redundant db lookup if skipModRefresh is true
  if (!(await enforceCurrentUserModerationState({ refresh: !skipModRefresh }))) return;
  if (!force && currentRoom?.id === room.id) return;
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

  // Dynamic SEO: update page title and meta description for the current room
  document.title = `#${room.name} – ChatCorner`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', `You are in #${room.name} on ChatCorner. Join the conversation, share voice notes, and connect with other users in real-time.`);

  // Auto-close mobile sidebars when a room is selected
  if (typeof closeAllSidebars === 'function') closeAllSidebars();
  if (typeof switchMobileTab === 'function') switchMobileTab('chat');

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

  // Chat input is enabled once you successfully pass the password check
  msgInput.disabled = false;
  msgInput.placeholder = 'Type a message\u2026 (Enter to send, Shift+Enter for newline)';
  if (sendBtn)  sendBtn.disabled  = false;
  if (emojiBtn) emojiBtn.disabled = false;
  updateComposerState();

  const { data: dbMessages } = await sbClient
    .from('messages')
    .select('*')
    .eq('room_id', room.id)
    .neq('type', 'system')
    .order('created_at', { ascending: true })
    .limit(50);

  let messages = filterDeletedMessages(dbMessages || [], room.id);

  oldestMessageTimestamp = messages?.length ? messages[0].created_at : null;
  if (messages?.length) {
    const senderIds = Array.from(new Set(messages.map(m => m.user_id).filter(Boolean)));
    await cacheSenderProfiles(senderIds);
  }
  const loadMoreBtn = document.getElementById('btn-load-older');
  if (loadMoreBtn) loadMoreBtn.classList.toggle('hidden', !messages || messages.length < 50);

  // Batch-append for performance (skip persisted system/deletion notices so newcomers don't see them)
  const MSG_CACHE_KEY = getRoomMessageCacheKey(room.id);

  // Feature 3 — Try restoring from localStorage cache first (shows instantly before DB responds)
  if (!messages?.length) {
    try {
      const cached = JSON.parse(localStorage.getItem(MSG_CACHE_KEY) || 'null');
      if (cached && cached.ts && Date.now() - cached.ts < MESSAGE_CACHE_TTL_MS && cached.msgs?.length) {
        const cachedMessages = filterDeletedMessages(cached.msgs, room.id);
        const container = document.getElementById('messages');
        const frag = document.createDocumentFragment();
        cachedMessages.forEach(m => {
          const node = buildMessageNode(m);
          if (node) { node.classList.add('msg-row--cached'); frag.appendChild(node); }
        });
        container.appendChild(frag);
        if (cachedMessages.length !== cached.msgs.length) {
          localStorage.setItem(MSG_CACHE_KEY, JSON.stringify({ ...cached, msgs: cachedMessages }));
        }
        refreshIgnoredMessageVisibility();
        scrollToBottom();
      }
    } catch (_) {}
  }

  if (messages?.length) {
    const container = document.getElementById('messages');
    const frag = document.createDocumentFragment();
    messages.forEach(m => {
      const node = buildMessageNode(m);
      if (node) frag.appendChild(node);
    });
    container.appendChild(frag);

    // Feature 3 — Cache last 50 messages to localStorage for persistence across logout/login
    try {
      localStorage.setItem(MSG_CACHE_KEY, JSON.stringify({ ts: Date.now(), msgs: messages.slice(-50) }));
    } catch (_) {}
  }
  refreshIgnoredMessageVisibility();
  scrollToBottom();

  const guideBanner = document.getElementById('guest-room-guidance-banner');
  if (guideBanner) {
    guideBanner.classList.toggle('hidden', !isGuestRoom);
  }
  if (isGuestRoom) {
    appendGuestRoomGuidanceCard();
    startGuestRoomGuidanceBroadcast();
  } else {
    stopGuestRoomGuidanceBroadcast();
  }

  messageChannel = sbClient
    .channel('room:' + room.id)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `room_id=eq.${room.id}`
    }, async payload => {
      if (!canProcessIncomingPayload(payload.new?.user_id)) return;
      // Skip system (deletion notice) messages from DB realtime — they are shown locally and auto-expire
      if (payload.new?.type === 'system' || payload.new?.is_deleted || isDeletedMessage(payload.new?.id, room.id)) return;
      // Skip if this is our own optimistic message already shown
      if (payload.new?.id && _optimisticPending.has(payload.new.id)) {
        _optimisticPending.delete(payload.new.id);
        return;
      }
      if (payload.new?.user_id === currentUser?.id) {
        let matchedTempId = null;
        for (const [tempId, entry] of _optimisticPending.entries()) {
          if (entry.userId === payload.new.user_id && entry.content === payload.new.content && (Date.now() - entry.ts < 5000)) {
            matchedTempId = tempId;
            break;
          }
        }
        if (matchedTempId) {
          const entry = _optimisticPending.get(matchedTempId);
          if (entry && entry.node) {
            entry.node.dataset.messageId = payload.new.id;
            entry.node.classList.remove('msg-row--pending');
          }
          _optimisticPending.delete(matchedTempId);
          return;
        }
      }
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
      rememberDeletedMessage(payload.old?.id, room.id);
      removeMessageNodeById(payload.old?.id);
    })
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'messages',
      filter: `room_id=eq.${room.id}`
    }, payload => {
      handleRealtimeMessageUpdate(payload.new);
    })
    .on('broadcast', { event: 'message-deleted' }, ({ payload }) => {
      if (payload?.roomId !== room.id) return;
      rememberDeletedMessage(payload.messageId, room.id);
      removeMessageNodeById(payload.messageId);
    })
    .on('broadcast', { event: 'chat-message' }, async ({ payload }) => {
      if (!payload || payload.room_id !== room.id) return;
      if (payload.user_id === currentUser?.id) return;
      if (!canProcessIncomingPayload(payload.user_id)) return;
      if (payload.user_id) {
        await cacheSenderProfiles([payload.user_id]);
      }
      appendMessage(payload);
      scrollToBottom();
    })
    .subscribe((status) => {
      const banner = document.getElementById('connection-error-banner');
      if (status === 'SUBSCRIBED') {
        if (banner) banner.classList.add('hidden');
        // Successful subscribe cancels any pending backoff sequence
        window._ccReconnect?.reset();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (banner) {
          banner.querySelector('.banner-text').textContent = '⚠️ Connection lost or room limit reached. Reconnecting...';
          banner.classList.remove('hidden');
        }
        // Use the backoff engine instead of immediately retrying
        window._ccReconnect?.trigger();
      }
    });

  const _roomPresenceKey = (currentUser && currentUser.id) || ('guest_' + Math.random().toString(36).slice(2, 7));
  presenceChannel = sbClient.channel('presence:' + room.id, {
    config: { presence: { key: _roomPresenceKey } }
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      onlineUsers = {};
      Object.values(state).forEach(arr => arr.forEach(u => {
        onlineUsers[u.userId] = u;
        cameraStates[u.userId] = !!u.cameraOn;
      }));
      const currentRoomCount = Object.keys(onlineUsers).length;
      updateRoomTabCount(currentRoom.id, currentRoomCount);
      if (currentRoom) {
        _roomUserCounts[String(currentRoom.id)] = currentRoomCount;
        const myPill = document.querySelector(`#room-list li[data-room-id="${currentRoom.id}"] .room-count-pill`);
        if (myPill) myPill.textContent = currentRoomCount;
      }
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
      typingUsers._t[payload.userId] = setTimeout(() => { typingUsers.delete(payload.userId); updateTypingIndicator(); scheduleRenderUserList(); }, 3000);
      updateTypingIndicator();
      scheduleRenderUserList();
    })
    .on('broadcast', { event: 'typing-stop' }, ({ payload }) => {
      typingUsers.delete(payload?.userId);
      updateTypingIndicator();
      scheduleRenderUserList();
    })
    .on('broadcast', { event: 'recording-voice' }, ({ payload }) => {
      if (payload?.userId === currentUser?.id) return;
      recordingUsers.set(payload.userId, payload);
      scheduleRenderUserList();
    })
    .on('broadcast', { event: 'recording-voice-stop' }, ({ payload }) => {
      recordingUsers.delete(payload?.userId);
      scheduleRenderUserList();
    })
    .subscribe(async (status) => {
      const banner = document.getElementById('connection-error-banner');
      if (status === 'SUBSCRIBED') {
        if (banner) banner.classList.add('hidden');
        window._ccReconnect?.reset();
        await presenceChannel.track(presenceBaseData);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (banner) {
          banner.querySelector('.banner-text').textContent = '⚠️ Connection lost or room limit reached. Reconnecting...';
          banner.classList.remove('hidden');
        }
        window._ccReconnect?.trigger();
      }
    });

  // (join notice suppressed — fresh page on room entry)
}

// FIX 1 — Disable input controls and show notice bar for guest users
function applyGuestUI() {
  updateComposerState();
}

let globalMessageTimestamps = [];
function checkGlobalRateLimit() {
  const now = Date.now();
  globalMessageTimestamps = globalMessageTimestamps.filter(t => now - t < 5000);
  if (globalMessageTimestamps.length >= 3) {
    return false;
  }
  globalMessageTimestamps.push(now);
  return true;
}

async function sendMessage() {
  const isAdminOrOwnerOrMod = currentProfile?.is_admin || currentProfile?.is_owner || currentProfile?.is_mod;
  if (_globalChatMuted && !isAdminOrOwnerOrMod) {
    showChatToast('Chat is disabled globally by the owner.', 'warning');
    return;
  }
  if (!checkGlobalRateLimit()) {
    showChatToast('⚠️ Please wait before sending another message (max 3 messages per 5s).', 'warning');
    return;
  }
  if (!(await enforceCurrentUserModerationState({ refresh: true }))) return;
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();

  // Stealth Mode send warning
  if (window._stealthModeActive) {
    const confirmSend = confirm("⚠️ Caution: You are currently in Stealth Mode. Other users cannot see you in the room. Are you sure you want to send this message?");
    if (!confirmSend) return;
  }

  // YouTube sharing limits (registered only, 1 per minute)
  const ytCheck = window.checkYouTubeSharingLimit ? window.checkYouTubeSharingLimit(text) : { ok: true };
  if (!ytCheck.ok) {
    showChatToast('⚠️ ' + ytCheck.reason, 'warning');
    return;
  }

  const rawImageUrl = getRoomImageUrlValue();
  const imageUrl = rawImageUrl ? normalizeImageUrl(rawImageUrl) : '';
  const imagePopover = document.getElementById('room-image-url-popover');
  const isSendingImage = !imagePopover?.classList.contains('hidden') && !!rawImageUrl;
  if (!text && !isSendingImage) return;
  if (!currentRoom) {
    appendSystemMessage('No room selected. Please wait for rooms to load...');
    return;
  }
  if (currentRoom.is_locked && !isAdminOrOwnerOrMod) {
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

  // ── Security: validate content before sending ──
  if (!isSendingImage) {
    const validation = window.ccValidateMessage ? window.ccValidateMessage(text) : { ok: true };
    if (!validation.ok) {
      showChatToast('⚠️ ' + validation.reason, 'warning');
      return;
    }
  }
  const safeImageUrl = isSendingImage && window.ccSanitize
    ? window.ccSanitize.url(imageUrl)
    : imageUrl;
  if (isSendingImage && !safeImageUrl) {
    showChatToast('⚠️ Invalid image URL blocked for security.', 'warning');
    return;
  }
  if (window.ccSanitize) {
    if (!window.ccSanitize.isUUID(currentRoom?.id) || !window.ccSanitize.isUUID(currentUser?.id)) {
      console.warn('[CC-SEC] sendMessage: invalid room/user ID — aborting insert.');
      return;
    }
  }
  if (currentUser?.is_anonymous) {
    await ensureGuestProfileRecord();
  }
  const safeText = window.ccSanitize ? window.ccSanitize.chatText(text, 500) : text;
  const finalContent = isSendingImage ? safeImageUrl : safeText;

  // ── Clear input immediately for instant UX feel ──
  input.value = '';
  autoResizeTextarea(input);
  const counter = document.getElementById('msg-char-counter');
  if (counter) counter.textContent = '0/500';

  // ── OPTIMISTIC UI: append message node instantly before DB confirms ──
  let optimisticNode = null;
  const tempId = `opt-${++_optimisticCounter}`;
  const fakeMsg = {
    id: tempId,
    room_id: currentRoom.id,
    user_id: currentUser.id,
    username: currentProfile.username,
    content: finalContent,
    type: isSendingImage ? 'image' : 'text',
    created_at: new Date().toISOString()
  };
  optimisticNode = buildMessageNode(fakeMsg);
  if (optimisticNode) {
    optimisticNode.classList.add('msg-row--pending');
    optimisticNode.dataset.tempId = tempId;
    document.getElementById('messages').appendChild(optimisticNode);
    scrollToBottom();
    pruneMessageDom();
    _optimisticPending.set(tempId, { content: finalContent, userId: currentUser.id, ts: Date.now(), node: optimisticNode });
  }

  const { data: insertedMsgs, error } = await sbClient.from('messages').insert({
    room_id:  currentRoom.id,
    user_id:  currentUser.id,
    username: currentProfile.username,
    content:  finalContent,
    type:     isSendingImage ? 'image' : 'text'
  }).select('id');

  if (error) {
    // Roll back optimistic node on failure
    if (optimisticNode) {
      optimisticNode.classList.add('is-deleting');
      setTimeout(() => optimisticNode.remove(), 220);
      _optimisticPending.delete(tempId);
    }
    appendSystemMessage(isSendingImage ? 'Could not share image. Please try again.' : 'Could not send message. Please try again.');
    return;
  }

  // Confirm optimistic node — stamp real DB id, remove pending style
  if (optimisticNode && insertedMsgs?.[0]?.id) {
    optimisticNode.dataset.messageId = insertedMsgs[0].id;
    optimisticNode.classList.remove('msg-row--pending');
    // Register real id so the realtime event skips it
    _optimisticPending.set(insertedMsgs[0].id, _optimisticPending.get(tempId) || {});
    _optimisticPending.delete(tempId);
    setTimeout(() => _optimisticPending.delete(insertedMsgs[0].id), 5000);
  } else if (optimisticNode) {
    optimisticNode.classList.remove('msg-row--pending');
    _optimisticPending.delete(tempId);
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
      ? `<img src="${escHtml(avatarUrl)}" alt="${escHtml(msg.username || '')} avatar"/>`
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
    const reportButton = buildReportButtonHtml(msg);
    div.innerHTML = `
      <div class="avatar" style="background:${color}">${avatarInner}</div>
      <div class="msg-bubble">
        ${deleteButton}
        ${reportButton}
        <div class="msg-line"><span class="msg-username" style="${nickStyle}">${escHtml(msg.username || 'Unknown')}:</span> <span class="msg-text">${audioHtml}</span></div>
          <div class="msg-time">${formatTime(msg.created_at)}</div>
      </div>`;

    const audio = div.querySelector('audio');
    if (audio) {
      audio.onplay = () => {
        // Self destruct locally after 30 seconds
        setTimeout(() => {
          div.style.transition = 'opacity 0.8s ease-out';
          div.style.opacity = '0';
          setTimeout(() => div.remove(), 800);
        }, 30000);
      };
    }
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
    ? `<img src="${escHtml(avatarUrl)}" alt="${escHtml(msg.username || '')} avatar"/>`
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
  const reportButton = buildReportButtonHtml(msg);

  div.innerHTML = `
    <div class="avatar" style="background:${color}">${avatarInner}</div>
    <div class="msg-bubble">
      ${deleteButton}
      ${reportButton}
      <div class="msg-line"><span class="msg-username" style="${nickStyle}">${escHtml(msg.username || 'Unknown')}:</span> <span class="msg-text" style="${msgStyle}">${window.formatMessageText ? window.formatMessageText(msg.content) : escHtml(msg.content)}</span></div>
      <div class="msg-time">${formatTime(msg.created_at)}</div>
    </div>`;

  return div;
}

function appendMessage(msg) {
  const node = buildMessageNode(msg);
  if (!node) return;
  document.getElementById('messages').appendChild(node);
  scheduleMessageScroll();
  pruneMessageDom();
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

/* Trim oldest messages from DOM when count exceeds 200 to prevent memory leaks */
function pruneMessageDom() {
  const container = document.getElementById('messages');
  if (!container || container.children.length <= 250) return; // Fast O(1) early exit

  const rows = container.querySelectorAll('.msg-row:not([data-temp-id])');
  const MAX = 200;
  const TRIM = 50;
  if (rows.length > MAX) {
    for (let i = 0; i < TRIM && i < rows.length; i++) rows[i].remove();
    const loadMoreBtn = document.getElementById('btn-load-older');
    if (loadMoreBtn) loadMoreBtn.classList.remove('hidden');

    const remainingRows = container.querySelectorAll('.msg-row:not([data-temp-id])');
    if (remainingRows.length > 0) {
      const firstRow = remainingRows[0];
      const createdAt = firstRow.dataset.createdAt;
      if (createdAt) {
        oldestMessageTimestamp = createdAt;
      }
    }
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

function shouldShowUserInRoster(u) {
  if (!u) return false;
  if (u.isStealth) {
    const isViewerStaff = currentProfile?.is_admin || currentProfile?.is_owner || currentProfile?.is_mod;
    if (!isViewerStaff) return false;
  }
  return true;
}
window.shouldShowUserInRoster = shouldShowUserInRoster;

function renderUserList() {
  const ul   = document.getElementById('user-list');
  const ulMobile = document.getElementById('mobile-online-users');
  const frag = document.createDocumentFragment();
  const fragMobile = document.createDocumentFragment();
  const isGuest = !isRegisteredUser();
  const sortedUsers = getSortedOnlineUsers();

  sortedUsers.forEach(u => {
    if (!shouldShowUserInRoster(u)) return;
    const li = document.createElement('li');
    li.className = 'user-item';
    li.dataset.userId = u.userId;
    const roleBadge = getRoleBadgeHtml(u);
    const stealthBadge = u.isStealth ? '<span class="role-badge" style="background:rgba(100,116,139,0.3);color:#94a3b8;border:1px solid rgba(148,163,184,0.4);" title="Staff member in Stealth Mode">🕵️ Stealth</span>' : '';
    const viewerEye = onlineUsers[u.userId]?.viewingCam ? '<span class="viewer-eye" title="Watching a camera">👁️</span>' : '';
    const avatarHtml = u.avatarUrl
      ? `<img class="roster-avatar" src="${escHtml(u.avatarUrl)}" alt="${escHtml(u.username || '')} avatar"/>`
      : `<div class="roster-avatar-init" style="background:${escHtml(u.color || '#7c3aed')}">${(u.username || '?')[0].toUpperCase()}</div>`;
    
    const isTyping = typingUsers.has(u.userId);
    const isRecording = recordingUsers.has(u.userId);
    let nameClass = '';
    if (isRecording) nameClass = ' recording-glowing-red';
    else if (isTyping) nameClass = ' typing-red';
    
    const displayName = escHtml(u.username) + (isRecording ? ' (Recording...)' : '');
    
    li.innerHTML = `
      <span class="dot${u.registered ? '' : ' guest'}"></span>
      ${avatarHtml}
      ${roleBadge}
      ${stealthBadge}
      <button type="button" class="user-name-btn${nameClass}${isGuest ? ' locked-action' : ''}" title="${isGuest ? '\ud83d\udd12 Register to start private chats' : 'Click for options'}">${displayName}</button>
      ${viewerEye}
      <button type="button" class="camera-user-btn${cameraStates[u.userId] ? '' : ' hidden'}" data-user-id="${escHtml(u.userId)}" title="View camera">\ud83d\udcf7</button>
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

    frag.appendChild(li);

    // Mobile horizontal list item
    if (ulMobile) {
      const mDiv = document.createElement('div');
      mDiv.className = 'mobile-user-avatar-wrap';
      mDiv.dataset.userId = u.userId;
      
      const activeDot = `<span class="mobile-user-status-dot${u.registered ? '' : ' guest'}"></span>`;
      mDiv.innerHTML = `
        <div class="mobile-user-avatar-container">
          ${avatarHtml}
          ${activeDot}
        </div>
        <span class="mobile-user-name${isRecording ? ' recording-glowing-red' : isTyping ? ' typing-red' : ''}">${escHtml(u.username)}${isRecording ? ' (Rec...)' : ''}</span>
      `;
      
      mDiv.addEventListener('click', (ev) => {
        ev.stopPropagation();
        promptUserRosterAction(u, isGuest);
      });
      
      fragMobile.appendChild(mDiv);
    }
  });

  if (ul) {
    ul.innerHTML = '';
    ul.appendChild(frag);
  }

  if (ulMobile) {
    ulMobile.innerHTML = '';
    ulMobile.appendChild(fragMobile);
  }

  // Update room-users-bar
  const bar = document.getElementById('room-users-bar');
  if (bar) {
    bar.innerHTML = '';
    const bfrag = document.createDocumentFragment();
    sortedUsers.forEach(u => {
      if (!shouldShowUserInRoster(u)) return;
      const pill = document.createElement('span');
      pill.className = 'room-user-pill';
      const isTyping = typingUsers.has(u.userId);
      const isRecording = recordingUsers.has(u.userId);
      const prefix = isRecording ? '🔴 ' : (isTyping ? '✏️ ' : (u.registered ? '🟢 ' : '👤 '));
      pill.textContent = `${prefix}${u.username}`;
      bfrag.appendChild(pill);
    });
    bar.appendChild(bfrag);
  }

  // Feature 7 — Glowing star for user with most total online time
  if (ul && sortedUsers.length > 0) {
    let topUserId = null;
    let topTime = 0;
    sortedUsers.forEach(u => {
      const t = onlineUsers[u.userId]?.totalOnlineTime || 0;
      if (t > topTime) { topTime = t; topUserId = u.userId; }
    });
    if (topUserId && topTime > 0) {
      const topLi = ul.querySelector(`li[data-user-id="${CSS.escape(topUserId)}"]`);
      if (topLi && !topLi.querySelector('.top-time-star')) {
        const nameBtn = topLi.querySelector('.user-name-btn');
        if (nameBtn) {
          const star = document.createElement('span');
          star.className = 'top-time-star';
          star.title = 'Most time spent in this chatroom!';
          star.textContent = '🌟';
          nameBtn.after(star);
        }
      }
    }
  }
}

/* Instant scroll — bypasses CSS scroll-behavior for real-time feel */
function scrollToBottom() {
  const el = document.getElementById('messages');
  if (!el) return;
  el.scrollTop = el.scrollHeight;
  requestAnimationFrame(() => {
    if (el.isConnected) el.scrollTop = el.scrollHeight;
  });
}

let _messageScrollFrame = 0;
function scheduleMessageScroll() {
  cancelAnimationFrame(_messageScrollFrame);
  _messageScrollFrame = requestAnimationFrame(() => {
    const el = document.getElementById('messages');
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      if (el.isConnected) el.scrollTop = el.scrollHeight;
    });
  });
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

  const olderMessages = filterDeletedMessages(older || [], currentRoom.id);

  if (!olderMessages.length) {
    if (btn) { btn.classList.add('hidden'); btn.textContent = 'No more messages'; }
    return;
  }

  const senderIds = Array.from(new Set(olderMessages.map(m => m.user_id).filter(Boolean)));
  await cacheSenderProfiles(senderIds);

  const container = document.getElementById('messages');
  const prevScrollHeight = container.scrollHeight;
  const frag = document.createDocumentFragment();

  [...olderMessages].reverse().forEach(m => {
    const node = buildMessageNode(m);
    if (node) frag.appendChild(node);
  });
  container.insertBefore(frag, container.firstChild);
  container.scrollTop = container.scrollHeight - prevScrollHeight;

  oldestMessageTimestamp = olderMessages[olderMessages.length - 1].created_at;
  if ((older?.length || 0) < 50 && btn) btn.classList.add('hidden');
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
  const isViewerStaff = currentProfile?.is_admin || currentProfile?.is_owner || currentProfile?.is_mod;
  const others = [...typingUsers.values()].filter(u => u.userId !== currentUser?.id && (!onlineUsers[u.userId]?.isStealth || isViewerStaff));
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
    debouncedPresenceTrack();
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

function showCamInArea(userId, username) {
  if (typeof openFloatingCamera === 'function') {
    openFloatingCamera(userId, username);
  }
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Convert YouTube URLs in already-escaped message text into a clickable link
   plus a responsive sandboxed embed. Returns the input unchanged when no
   YouTube URL is found. Defined on window so pm.js can reuse it. */
window.parseYouTubeEmbedHtml = function(escapedText) {
  const str = String(escapedText ?? '');
  if (!str) return str;
  const ytRe = /(https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s<>]*v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,15})[^\s<>]*)/i;
  const match = str.match(ytRe);
  if (!match) return str;
  const videoId = match[2].replace(/[^A-Za-z0-9_-]/g, '');
  if (!videoId) return str;
  const link = `<a href="${match[1]}" target="_blank" rel="noopener noreferrer nofollow">${match[1]}</a>`;
  const embed = `<div class="yt-embed" style="position:relative;width:100%;max-width:420px;padding-top:56.25%;margin-top:6px;border-radius:8px;overflow:hidden;">` +
    `<iframe src="https://www.youtube.com/embed/${videoId}" style="position:absolute;inset:0;width:100%;height:100%;border:0;" ` +
    `sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" ` +
    `allowfullscreen loading="lazy" referrerpolicy="no-referrer"></iframe></div>`;
  return str.replace(match[1], link) + embed;
};

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
    try { debouncedPresenceTrack(); } catch (_) {}
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

function buildDeleteButtonHtml(userId, label = '🗑️') {
  if (!canDeleteMessageForUserId(userId)) return '';
  const title = userId === currentUser?.id
    ? 'Delete permanently for everyone'
    : 'Delete this message as admin/moderator';
  return `<button type="button" class="msg-local-delete" title="${escHtml(title)}">${label}</button>`;
}

function buildReportButtonHtml(msg) {
  if (!currentUser?.id || msg.user_id === currentUser.id) return '';
  return `<button type="button" class="msg-local-report" title="Report message for review">⚠️</button>`;
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
  const isAdminOrOwnerOrMod = currentProfile?.is_admin || currentProfile?.is_owner || currentProfile?.is_mod;
  const isLocked = !!currentRoom?.is_locked && !isAdminOrOwnerOrMod;

  document.body.classList.toggle('guest-mode', isGuest);
  if (guestNoticeBar) guestNoticeBar.classList.toggle('hidden', !isGuest);

  const isChatBlocked = _globalChatMuted && !isAdminOrOwnerOrMod;

  if (isChatBlocked) {
    if (msgInput) {
      msgInput.disabled = true;
      msgInput.placeholder = 'Chat is disabled globally by the owner.';
    }
    if (sendBtn) sendBtn.disabled = true;
    if (emojiBtn) emojiBtn.disabled = true;
    if (imageBtn) imageBtn.disabled = true;
    if (voiceBtn) voiceBtn.disabled = false;
    return;
  }

  if (isGuest) {
    if (msgInput) {
      msgInput.disabled = isLocked;
      msgInput.placeholder = isLocked ? 'This room is locked by admin.' : 'Type a message… (Enter to send, Shift+Enter for newline)';
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
      joinVoiceBtn.title = 'Join Voice Chat';
    }
    return;
  }

  if (msgInput) {
    msgInput.disabled = isLocked;
    msgInput.placeholder = isLocked ? 'This room is locked by admin.' : 'Type a message… (Enter to send, Shift+Enter for newline)';
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
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
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
  div.className = 'msg-row image-message' + (isMe ? ' self' : '');
  const imageSrc = sanitizeImageSource(msg);
  setMessageRowData(div, msg, imageSrc || msg?.content || '');

  const initial = (msg.username || '?')[0].toUpperCase();
  const color   = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);
  const avatarInner = isMe && currentProfile?.avatar_url
    ? `<img src="${escHtml(currentProfile.avatar_url)}" alt=""/>`
    : initial;
  const deleteButton = buildDeleteButtonHtml(msg.user_id, '🗑️ Delete');
  const imageMarkup = imageSrc
    ? `
      <img class="msg-inline-image" src="${escHtml(imageSrc)}" alt="Shared image" loading="eager" decoding="async" fetchpriority="high"/>
      <div class="msg-image-error hidden">⚠️ Image could not be loaded.</div>
      <a class="msg-image-link" href="${escHtml(imageSrc)}" target="_blank" rel="noopener noreferrer">Open image</a>
    `
    : '<div class="msg-image-error">⚠️ Invalid image URL.</div>';

  div.innerHTML = `
    <div class="avatar" style="background:${color}">${avatarInner}</div>
    <div class="msg-bubble">
      ${deleteButton ? `<div class="image-delete-row">${deleteButton}</div>` : ''}
      <div class="msg-line"><span class="msg-text">${imageMarkup}</span></div>
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
      <div class="msg-line"><span class="msg-username">${escHtml(msg.username || 'Unknown')}:</span> <span class="msg-voice">${voiceMarkup}</span></div>
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

let voiceRecTimerId = null;

function setVoiceNoteButtonState(isRecording) {
  const voiceBtn = document.getElementById('btn-voice-note');
  if (voiceBtn) {
    voiceBtn.classList.toggle('recording', !!isRecording);
    voiceBtn.textContent = isRecording ? '⏹️' : '🎙️';
    voiceBtn.title = isRecording ? 'Stop and send voice note' : 'Send a voice note';
  }
  const normal = document.getElementById('input-strip-normal');
  const rec = document.getElementById('input-strip-recording');
  const timer = document.getElementById('voice-rec-timer-display');
  clearInterval(voiceRecTimerId);
  voiceRecTimerId = null;
  if (normal) normal.style.display = isRecording ? 'none' : 'flex';
  if (rec) rec.style.display = isRecording ? 'flex' : 'none';
  if (timer) timer.textContent = '00:00';
  if (isRecording && timer) {
    const startedAt = Date.now();
    voiceRecTimerId = setInterval(() => {
      const sec = Math.floor((Date.now() - startedAt) / 1000);
      timer.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    }, 250);
  }
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

async function startVoiceNoteRecording() {
  if (!isRegisteredUser()) {
    const usedCount = parseInt(localStorage.getItem('cc-guest-voice-used') || '0', 10);
    if (usedCount >= GUEST_VOICE_LIMIT) {
      showRegisterForVoice();
      return;
    }
  }
  const isAdminOrOwnerOrMod = currentProfile?.is_admin || currentProfile?.is_owner || currentProfile?.is_mod;
  if (currentRoom?.is_locked && !isAdminOrOwnerOrMod) {
    appendSystemMessage('This room is locked by admin. Voice notes are disabled.');
    return;
  }
  if (!currentRoom?.id) return;
  if (roomVoiceNoteRecorder?.state === 'recording') return;
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

    // Send recording presence broadcast
    if (presenceChannel) {
      presenceChannel.send({
        type: 'broadcast',
        event: 'recording-voice',
        payload: { userId: currentUser.id, username: currentProfile.username }
      }).catch(() => {});
    }

    roomVoiceNoteRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) roomVoiceNoteChunks.push(event.data);
    };

    roomVoiceNoteRecorder.onerror = () => {
      discardRoomVoiceNoteOnStop = true;
      setVoiceNoteButtonState(false);
      showChatToast('Voice note recording failed.', 'warning', 3200);
    };

    roomVoiceNoteRecorder.onstop = async () => {
      setVoiceNoteButtonState(false);
      stopRoomVoiceNoteStream();

      // Send recording stop presence broadcast
      if (presenceChannel) {
        presenceChannel.send({
          type: 'broadcast',
          event: 'recording-voice-stop',
          payload: { userId: currentUser.id }
        }).catch(() => {});
      }

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
        showChatToast('Voice note was empty.', 'warning', 2500);
        return;
      }

      try {
        let blob = new Blob(chunks, { type: mimeType });
        if (typeof compressVoiceNote === 'function') {
          blob = await compressVoiceNote(blob);
        }
        const dataUrl = await roomVoiceBlobToDataUrl(blob);

        await sendRoomVoiceNote(roomIdForVoiceNote, dataUrl);
      } catch (_) {
        showChatToast('Could not process voice note.', 'warning', 3200);
      }
    };

    roomVoiceNoteRecorder.start();
    setVoiceNoteButtonState(true);
    // Guests: auto-stop after 5 seconds
    if (!isRegisteredUser()) {
      setTimeout(() => {
        if (roomVoiceNoteRecorder?.state === 'recording') {
          stopVoiceNoteRecording();
        }
      }, GUEST_VOICE_MAX_DURATION_MS);
    }
  } catch (error) {
    showChatToast(getVoiceNoteStartErrorMessage(error), 'warning', 3200);
    setVoiceNoteButtonState(false);
    stopRoomVoiceNoteStream();
    roomVoiceNoteChunks = [];
    roomVoiceNoteRecorder = null;
    roomVoiceNoteRoomId = null;
  } finally {
    roomVoiceNoteStarting = false;
  }
}

function stopVoiceNoteRecording() {
  if (roomVoiceNoteRecorder?.state === 'recording') {
    setVoiceNoteButtonState(false);
    roomVoiceNoteRecorder.stop();
  }
}

function cancelVoiceNoteRecording() {
  if (roomVoiceNoteRecorder?.state === 'recording') {
    discardRoomVoiceNoteOnStop = true;
    setVoiceNoteButtonState(false);
    roomVoiceNoteRecorder.stop();
  }
}

async function sendRoomVoiceNote(roomId, dataUrl) {
  if (!checkGlobalRateLimit()) {
    showChatToast('⚠️ Please wait before sending another message (max 3 messages per 5s).', 'warning');
    return;
  }
  if (currentUser?.is_anonymous) await ensureGuestProfileRecord();
  const { error } = await sbClient.from('messages').insert({
    room_id: roomId,
    user_id: currentUser.id,
    username: currentProfile.username,
    content: dataUrl,
    type: 'voice'
  });
  if (error) {
    showChatToast('Could not send voice note. Please try again.', 'warning', 3200);
  } else if (!isRegisteredUser()) {
    const newCount = parseInt(localStorage.getItem('cc-guest-voice-used') || '0', 10) + 1;
    localStorage.setItem('cc-guest-voice-used', String(newCount));
    if (newCount >= GUEST_VOICE_LIMIT) setTimeout(() => showRegisterForVoice(), 800);
  }
}

(function initVoiceRecordingControls() {
  const bind = () => {
    document.getElementById('btn-voice-rec-send')?.addEventListener('click', stopVoiceNoteRecording);
    document.getElementById('btn-voice-rec-discard')?.addEventListener('click', cancelVoiceNoteRecording);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

// Kept for backward compatibility but calls start/stop flow
async function sendVoiceNote() {
  if (roomVoiceNoteRecorder?.state === 'recording') {
    stopVoiceNoteRecording();
  } else {
    await startVoiceNoteRecording();
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
  rememberDeletedMessage(msg.id, currentRoom?.id);
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

  rememberDeletedMessage(messageId, currentRoom?.id);
  if (messageChannel && currentRoom?.id) {
    try {
      await messageChannel.send({
        type: 'broadcast',
        event: 'message-deleted',
        payload: { roomId: currentRoom.id, messageId }
      });
    } catch (broadcastError) {
      console.warn('Failed to broadcast message deletion', {
        roomId: currentRoom.id,
        messageId,
        error: broadcastError?.message || broadcastError
      });
    }
  }

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
   Context Menu for Messages — Right-click to Delete
════════════════════════════════════════════════════════════════ */
(function initMessageContextMenu() {
  let ctxMenu = null;

  function removeContextMenu() {
    if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
  }

  document.addEventListener('click', removeContextMenu);
  document.addEventListener('scroll', removeContextMenu, true);

  document.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.msg-row');
    if (!row) return;

    const targetUserId = row.dataset.userId || '';
    const messageId = row.dataset.messageId || '';
    if (!messageId) return;
    if (!canDeleteMessageForUserId(targetUserId)) return;

    e.preventDefault();
    removeContextMenu();

    ctxMenu = document.createElement('div');
    ctxMenu.className = 'msg-context-menu';

    const targetUsername = row.querySelector('.msg-username')?.textContent || 'Unknown';
    const isOwn = targetUserId === currentUser?.id;

    ctxMenu.innerHTML = `
      <button type="button" class="msg-ctx-delete" data-msg-id="${escHtml(messageId)}" data-user-id="${escHtml(targetUserId)}">
        🗑️ ${isOwn ? 'Delete Message' : 'Delete (Mod)'}
      </button>
    `;

    ctxMenu.style.position = 'fixed';
    ctxMenu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    ctxMenu.style.top = Math.min(e.clientY, window.innerHeight - 50) + 'px';
    ctxMenu.style.zIndex = '9999';

    document.body.appendChild(ctxMenu);

    ctxMenu.querySelector('.msg-ctx-delete').onclick = async () => {
      removeContextMenu();
      const deleteBtn = row.querySelector('.msg-local-delete');
      row.classList.add('is-deleting');
      if (deleteBtn) { deleteBtn.disabled = true; deleteBtn.textContent = '…'; }
      archiveClearedMessageRows([row], 'single-message-remove');
      try {
        await deleteMessageForEveryone(messageId, targetUserId, targetUsername);
        removeMessageNodeById(messageId);
      } catch (error) {
        row.classList.remove('is-deleting');
        if (deleteBtn) { deleteBtn.disabled = false; deleteBtn.textContent = '🗑️'; }
        showChatToast(`Could not delete message: ${error.message || 'Please try again.'}`, 'warning', 3200);
      }
    };
  });
})();

document.addEventListener('click', async (event) => {
  const reportBtn = event.target.closest('.msg-local-report');
  if (!reportBtn) return;
  
  const row = reportBtn.closest('.msg-row');
  if (!row) return;
  
  const targetUserId = row.dataset.userId || '';
  const messageId = row.dataset.messageId || '';
  const targetUsername = row.querySelector('.msg-username')?.textContent || 'Unknown';
  const messageText = row.querySelector('.msg-text')?.textContent || '';
  
  if (!messageId) return;

  reportBtn.disabled = true;
  reportBtn.textContent = '…';
  
  try {
    if (window.sbClient) {
      await window.sbClient.from('security_events').insert({
        event_type: 'REPORT_MESSAGE',
        details: {
          messageId,
          targetUserId,
          targetUsername,
          messageText,
          reporterId: currentUser?.id,
          reporterName: currentProfile?.username,
          roomId: currentRoom?.id
        },
        user_agent: navigator.userAgent
      });
    }
    
    showChatToast('Message reported successfully. Thank you.', 'success', 3000);
    reportBtn.textContent = '✓';
    reportBtn.title = 'Reported';
    row.style.opacity = '0.6';
  } catch (err) {
    reportBtn.disabled = false;
    reportBtn.textContent = '🚩';
    showChatToast('Failed to report message. Please try again.', 'warning', 3000);
    console.error('Report error:', err);
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
let _pcSessionId = 0;
let _pcOutsideClickFn = null;
let _pcEscHandlerFn = null;
let _pcScrollHandlerFn = null;
let _pcPendingPinned = false;

function scheduleProfileCard(u, anchor) {
  clearTimeout(_pcTimer);
  clearTimeout(_pcHide);
  _pcTimer = setTimeout(() => showProfileCard(u, anchor), 350);
}

function cancelProfileCard() {
  clearTimeout(_pcTimer);
  if (_pcPendingPinned) {
    return;
  }
  _pcSessionId++; // Invalidate any pending async fetch
  // Do NOT close the profile card if it is in pinned mode
  if (_pcActive && _pcActive.classList.contains('pinned')) {
    return;
  }
  // Small grace period so user can move cursor into the card
  _pcHide = setTimeout(() => hideProfileCard(), 220);
}

function hideProfileCard() {
  _pcPendingPinned = false;
  document.querySelectorAll('#profile-card').forEach(el => el.remove());
  document.querySelectorAll('.profile-card').forEach(el => el.remove());
  if (_pcActive) {
    _pcActive.remove();
    _pcActive = null;
  }
  if (_pcOutsideClickFn) {
    document.removeEventListener('click', _pcOutsideClickFn, true);
    _pcOutsideClickFn = null;
  }
  if (_pcEscHandlerFn) {
    document.removeEventListener('keydown', _pcEscHandlerFn);
    _pcEscHandlerFn = null;
  }
  if (_pcScrollHandlerFn) {
    document.removeEventListener('scroll', _pcScrollHandlerFn, true);
    _pcScrollHandlerFn = null;
  }
}

async function showProfileCard(u, anchor, pinned = false) {
  hideProfileCard();
  _pcPendingPinned = pinned;
  const currentSession = ++_pcSessionId;

  // Fetch full profile for join date, IP, avatar, VIP status
  let profile = null;
  try {
    const { data } = await sbClient.from('profiles').select('*').eq('id', u.userId).single();
    profile = data;
  } catch (_) {}
  
  if (currentSession !== _pcSessionId) return; // Mouse left while fetching
  _pcPendingPinned = false;
  if (!profile) return;

  const viewerLevel  = getViewerRoleLevel();
  const targetLevel  = getRoleLevel(u);
  const canSeeIp     = viewerLevel >= 3;
  const canBan       = viewerLevel > targetLevel && u.userId !== currentUser?.id;
  const canKick      = canBan;
  const canGrantVip  = viewerLevel >= 3 && targetLevel === 1;
  const isVip        = !!(profile.is_vip);
  const isAdmin      = !!(profile.is_admin);
  const isMod        = !!(profile.is_mod);
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

  // Feature 6 — Promote button: owner-only, shows for other users
  const isCurrentUserOwner = !!(currentProfile?.is_owner);
  const isTargetSelf = u.userId === currentUser?.id;
  const targetIsOwner = !!(profile?.is_owner);
  const promoteBtn = isCurrentUserOwner && !isTargetSelf && !targetIsOwner
    ? `<button class="pc-promote-btn" type="button" data-uid="${escHtml(u.userId)}" data-uname="${escHtml(u.username || profile.username || '')}">🏅 Promote/Demote</button>`
    : '';

  const row1Html = (pmBtn || ignoreBtn) ? `<div class="pc-action-row">${pmBtn}${ignoreBtn}</div>` : '';
  const row2Html = (kickBtn || banBtn) ? `<div class="pc-action-row">${kickBtn}${banBtn}</div>` : '';
  const row3Html = promoteBtn ? `<div class="pc-action-row">${promoteBtn}</div>` : '';
  const actionsHtml = (row1Html || row2Html || row3Html || vipBtn)
    ? `<div class="pc-actions">${row1Html}${row2Html}${row3Html}${vipBtn}</div>`
    : '';

  const promoteSectionHtml = isCurrentUserOwner && !isTargetSelf && !targetIsOwner
    ? `
      <div class="pc-promote-section" style="display: none; flex-direction: column; gap: 0.38rem; margin-top: 0.7rem;">
        <div style="font-size: 0.72rem; font-weight: 700; color: var(--muted); margin-bottom: 0.2rem; text-align: center; text-transform: uppercase; letter-spacing: 0.05em;">🏅 Promote / Demote</div>
        <button class="pc-role-opt-btn ${isAdmin ? 'active' : ''}" type="button" data-role="admin">
          🛡️ Admin ${isAdmin ? '(Active)' : ''}
        </button>
        <button class="pc-role-opt-btn ${isMod ? 'active' : ''}" type="button" data-role="mod">
          🔨 Moderator ${isMod ? '(Active)' : ''}
        </button>
        <button class="pc-role-opt-btn ${isVip ? 'active' : ''}" type="button" data-role="vip">
          ⭐ VIP ${isVip ? '(Active)' : ''}
        </button>
        <button class="pc-promote-back-btn" type="button">
          ⬅️ Back
        </button>
      </div>
    `
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
    ${promoteSectionHtml}
  `;

  hideProfileCard();
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

  // Set up robust closing handlers for click outside, escape key, and scroll
  _pcOutsideClickFn = (ev) => {
    if (card && !card.contains(ev.target) && !anchor.contains(ev.target)) {
      hideProfileCard();
    }
  };
  setTimeout(() => {
    if (_pcActive === card) {
      document.addEventListener('click', _pcOutsideClickFn, true);
    }
  }, 50);

  _pcEscHandlerFn = (ev) => {
    if (ev.key === 'Escape') {
      hideProfileCard();
    }
  };
  document.addEventListener('keydown', _pcEscHandlerFn);

  // Close card when scrolling any element (capture phase captures all scrolls)
  _pcScrollHandlerFn = () => {
    hideProfileCard();
  };
  document.addEventListener('scroll', _pcScrollHandlerFn, true);

  if (pinned) {
    // Pinned mode: close on ✕ button
    card.querySelector('.pc-close-btn')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      hideProfileCard();
    });
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

  card.querySelector('.pc-promote-btn')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const actionsEl = card.querySelector('.pc-actions');
    const promoteEl = card.querySelector('.pc-promote-section');
    if (actionsEl && promoteEl) {
      actionsEl.style.display = 'none';
      promoteEl.style.display = 'flex';
    }
  });

  card.querySelector('.pc-promote-back-btn')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const actionsEl = card.querySelector('.pc-actions');
    const promoteEl = card.querySelector('.pc-promote-section');
    if (actionsEl && promoteEl) {
      promoteEl.style.display = 'none';
      actionsEl.style.display = 'flex';
    }
  });

  card.querySelectorAll('.pc-role-opt-btn').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const role = btn.dataset.role;
      let updates = {};
      let label = '';
      if (role === 'admin')  { updates = { is_admin: !isAdmin, is_mod: false }; label = isAdmin ? 'demoted from Admin' : 'promoted to Admin'; }
      if (role === 'mod')    { updates = { is_mod: !isMod, is_admin: false };   label = isMod   ? 'demoted from Moderator' : 'promoted to Moderator'; }
      if (role === 'vip')    { updates = { is_vip: !isVip };                     label = isVip   ? 'VIP removed' : 'granted VIP'; }
      
      const { error } = await sbClient.from('profiles').update(updates).eq('id', u.userId);
      hideProfileCard();
      
      if (error) { showChatToast('Promote failed: ' + error.message, 'error'); return; }
      
      if (onlineUsers[u.userId]) {
        if ('is_admin' in updates) onlineUsers[u.userId].isAdmin = updates.is_admin;
        if ('is_mod'   in updates) onlineUsers[u.userId].isMod   = updates.is_mod;
        if ('is_vip'   in updates) onlineUsers[u.userId].isVip   = updates.is_vip;
      }
      scheduleRenderUserList();
      const targetName = u.username || profile.username || 'User';
      showChatToast(`✅ ${targetName} ${label}.`, 'success');
      appendSystemMessage(`🏅 ${targetName} has been ${label}.`);
    });
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
   Feature 6 — Owner-only Promote/Demote menu
════════════════════════════════════════════════════════════════ */
async function showPromoteMenu(userId, username, profile) {
  // Remove any existing promote menu
  document.getElementById('cc-promote-menu')?.remove();

  const isAdmin = !!(profile?.is_admin);
  const isMod   = !!(profile?.is_mod);
  const isVip   = !!(profile?.is_vip);

  const overlay = document.createElement('div');
  overlay.id = 'cc-promote-menu';
  overlay.className = 'cc-modal-overlay';
  overlay.innerHTML = `
    <div class="cc-modal promote" role="dialog" aria-modal="true">
      <h3 class="cc-modal-title">🏅 Promote / Demote <span class="cc-modal-uname">${escHtml(username || 'User')}</span></h3>
      <div class="cc-modal-grid promote-grid">
        <button class="cc-modal-opt promote${isAdmin ? ' active' : ''}" data-role="admin">
          <span class="cc-opt-icon">🛡️</span>
          <span class="cc-opt-label">Admin</span>
          <span class="cc-opt-note">${isAdmin ? 'Click to demote' : 'Full moderation access'}</span>
        </button>
        <button class="cc-modal-opt promote${isMod ? ' active' : ''}" data-role="mod">
          <span class="cc-opt-icon">🔨</span>
          <span class="cc-opt-label">Moderator</span>
          <span class="cc-opt-note">${isMod ? 'Click to demote' : 'Kick/ban access'}</span>
        </button>
        <button class="cc-modal-opt promote${isVip ? ' active' : ''}" data-role="vip">
          <span class="cc-opt-icon">⭐</span>
          <span class="cc-opt-label">VIP</span>
          <span class="cc-opt-note">${isVip ? 'Click to remove' : 'Custom styles & badge'}</span>
        </button>
      </div>
      <button class="cc-modal-cancel" style="margin-top:12px">Cancel</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('.cc-modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.cc-modal-opt[data-role]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const role = btn.dataset.role;
      let updates = {};
      let label = '';
      if (role === 'admin')  { updates = { is_admin: !isAdmin, is_mod: false }; label = isAdmin ? 'demoted from Admin' : 'promoted to Admin'; }
      if (role === 'mod')    { updates = { is_mod: !isMod, is_admin: false };   label = isMod   ? 'demoted from Moderator' : 'promoted to Moderator'; }
      if (role === 'vip')    { updates = { is_vip: !isVip };                     label = isVip   ? 'VIP removed' : 'granted VIP'; }
      const { error } = await sbClient.from('profiles').update(updates).eq('id', userId);
      overlay.remove();
      if (error) { showChatToast('Promote failed: ' + error.message, 'error'); return; }
      if (onlineUsers[userId]) {
        if ('is_admin' in updates) onlineUsers[userId].isAdmin = updates.is_admin;
        if ('is_mod'   in updates) onlineUsers[userId].isMod   = updates.is_mod;
        if ('is_vip'   in updates) onlineUsers[userId].isVip   = updates.is_vip;
      }
      scheduleRenderUserList();
      showChatToast(`✅ ${username || 'User'} ${label}.`, 'success');
      appendSystemMessage(`🏅 ${username || 'User'} has been ${label}.`);
    });
  });
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
      debouncedPresenceTrack();
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
                  <input type="color" id="cc-edit-nickcolor-picker" value="${escHtml(profile.nick_color || '#ffffff')}" ${!checkColumns ? 'disabled' : ''} oninput="updateColorText(this, 'cc-edit-nickcolor')" />
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
                  <input type="color" id="cc-edit-msgcolor-picker" value="${escHtml(profile.msg_color || '#ffffff')}" ${!checkColumns ? 'disabled' : ''} oninput="updateColorText(this, 'cc-edit-msgcolor')" />
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
      const isVip = !!(profile.is_vip || profile.is_admin || profile.is_mod || profile.is_owner);
      
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
  applyMessageColorPreview();
}

function updateColorText(picker, inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.value = picker.value.toUpperCase();
  }
  applyMessageColorPreview();
}

function applyMessageColorPreview() {
  const input = document.getElementById('cc-edit-msgcolor');
  const value = input?.value.trim();
  if (!/^#[0-9A-F]{6}$/i.test(value)) return;
  document.querySelectorAll('#messages .msg-row.self .msg-text').forEach(el => {
    el.style.color = value;
  });
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
      debouncedPresenceTrack();
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
    if (presenceChannel) debouncedPresenceTrack();
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
   Online Radio System (v3)
   ════════════════════════════════════════════════════════════════ */

// Radio-Browser API Round-Robin Servers
const RADIO_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://fr1.api.radio-browser.info'
];

// Curated high-quality fallback stations (Pakistan and India)
const CURATED_PLAYLISTS = {
  PK: [
    { name: "[Sports] Radio Pakistan Sports", url: "https://whmsonic.radio.gov.pk:7003/stream", category: "sports" },
    { name: "[News] Samaa FM 107.4", url: "https://samaakhi107-itelservices.radioca.st/stream", category: "news" },
    { name: "[News] Radio Pakistan Lahore News (AM 1332)", url: "https://whmsonic.radio.gov.pk:7004/stream?type=http&nocache=12", category: "news" },
    { name: "[News] FM 101 Islamabad", url: "https://whmsonic.radio.gov.pk:7008/stream", category: "news" },
    { name: "[News] FM 101 Karachi", url: "https://whmsonic.radio.gov.pk:8048/stream", category: "news" },
    { name: "[News] City FM 89", url: "https://radio.cityfm89.com/stream", category: "news" },
    { name: "[Music] Hum FM 106.2", url: "https://server.mediacast4u.stream/8002/stream", category: "music" },
    { name: "[Devotional] Mishal Radio (Sufi/Islamic)", url: "https://stream.zeno.fm/yv2k0dp18vzuv", category: "devotional" },
    { name: "[Punjabi] Radio Awaz FM 105", url: "https://stream.zeno.fm/8ty8szwpwfeuv", category: "punjabi" },
    { name: "[Punjabi] Suno FM Punjabi", url: "https://stream.zeno.fm/6wz38f1h20hvv", category: "punjabi" }
  ],
  IN: [
    { name: "[Music] Radio Mirchi Hindi", url: "https://eu8.fastcast4u.com/proxy/clyedupq/stream", category: "music" },
    { name: "[Music] Bollywood Gaane Purane", url: "https://stream.zeno.fm/6n6ewddtad0uv", category: "music" },
    { name: "[Music] Hindi Gold Radio", url: "https://azuracast.vibesounds.in:8010/radio.mp3", category: "music" },
    { name: "[Music] Retro Bollywood 90s Hits", url: "https://stream.zeno.fm/rm4i9pdex3cuv", category: "music" },
    { name: "[Music] Lata Mangeshkar Hits", url: "https://stream.zeno.fm/87xam8pf7tzuv", category: "music" },
    { name: "[Music] Kishore Kumar Radio", url: "https://stream.zeno.fm/0ghtfp8ztm0uv", category: "music" },
    { name: "[Music] Mohammad Rafi Hits", url: "https://stream.zeno.fm/v2zfmxef798uv", category: "music" },
    { name: "[Music] Mirchi Top 20", url: "https://drive.uber.radio/uber/bollywoodnow/icecast.audio", category: "music" },
    { name: "[News] Vividh Bharati (HLS)", url: "https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8", category: "news" },
    { name: "[Punjabi] Dhol Radio Punjabi", url: "https://stream.zeno.fm/n2fd0edh9k8uv", category: "punjabi" },
    { name: "[Punjabi] Radio City Punjabi", url: "https://stream.zeno.fm/f8z7c7q20hvv", category: "punjabi" }
  ],
  GB: [
    { name: "[Music] BBC Asian Network (HLS)", url: "https://as-hls-uk-live.akamaized.net/pool_904/live/uk/bbc_asian_network/bbc_asian_network.isml/bbc_asian_network-audio%3d96000.norewind.m3u8", category: "music" },
    { name: "[Punjabi] Panjab Radio London", url: "https://stream.zeno.fm/84h97t3ewg0uv", category: "punjabi" },
    { name: "[Music] Asian Star Radio", url: "https://stream.zeno.fm/eyxg23ky4x8uv", category: "music" },
    { name: "[Music] Lyca Radio (Bollywood)", url: "https://stream.zeno.fm/6wz38f1h20hvv", category: "music" }
  ],
  CA: [
    { name: "[News/Talk] CIRF Radio Humsafar (Desi)", url: "https://stream.zeno.fm/f8z7c7q20hvv", category: "news" },
    { name: "[Punjabi] Sher E Punjab AM 600", url: "https://stream.zeno.fm/a87g1p7320hvv", category: "punjabi" },
    { name: "[Punjabi] Red FM CKYE 93.1 Vancouver", url: "https://stream.zeno.fm/7x3bfa0zu0hvv", category: "punjabi" }
  ],
  US: [
    { name: "[Punjabi] Radio Punjabi USA", url: "https://stream.zeno.fm/n2fd0edh9k8uv", category: "punjabi" },
    { name: "[Music] Bolly 102.9 FM", url: "https://stream.zeno.fm/87xam8pf7tzuv", category: "music" },
    { name: "[Music] Desi World Radio USA", url: "https://stream.zeno.fm/0ghtfp8ztm0uv", category: "music" }
  ],
  AE: [
    { name: "[Music] City 101.6 Dubai (Bollywood)", url: "https://stream.zeno.fm/v2zfmxef798uv", category: "music" },
    { name: "[Music] Hum FM 106.2 Dubai", url: "https://server.mediacast4u.stream/8002/stream", category: "music" }
  ],
  AU: [
    { name: "[Music] SBS PopDesi (Bollywood HLS)", url: "https://sbs-live-audio.akamaized.net/popdesi/popdesi.m3u8", category: "music" }
  ]
};

// Global Radio Player Instance
window.radioPlayer = new Audio();
window.radioPlayer.preload = "none";
window.radioPlayer.volume = 0.8; // Set default volume to 80%
window.hlsInstance = null; // hls.js instance

// Loaded channels cache in memory
let loadedRadioChannels = [];

// Helper to fetch from Radio-Browser API with fallback round-robin
async function fetchRadioBrowser(endpoint) {
  // Shuffle servers to load-balance
  const shuffledServers = [...RADIO_SERVERS].sort(() => Math.random() - 0.5);
  
  for (const server of shuffledServers) {
    try {
      const url = `${server}/json${endpoint}`;
      console.log(`[Radio] Attempting fetch from: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ChatCornerRadioApp/3.0' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn(`[Radio] Server ${server} failed:`, err);
    }
  }
  return null;
}

function toggleRadioControls() {
  const container = document.getElementById('radio-selectors');
  const volContainer = document.getElementById('radio-volume-container');
  if (container) {
    container.classList.toggle('hidden');
  }
  if (volContainer) {
    volContainer.classList.toggle('hidden');
  }
}

// Categorize a station dynamically using its name and tags
function categorizeStation(station) {
  const name = (station.name || '').toLowerCase();
  const tags = (station.tags || '').toLowerCase();
  const combined = `${name} ${tags}`;

  if (combined.includes('punjabi') || combined.includes('panjabi') || combined.includes('bhangra') || combined.includes('singh') || combined.includes('khalsa')) {
    return 'punjabi';
  }
  if (combined.includes('sport') || combined.includes('cricket') || combined.includes('commentary') || combined.includes('khel')) {
    return 'sports';
  }
  if (combined.includes('news') || combined.includes('khabar') || combined.includes('samaa') || combined.includes('politics') || combined.includes('talk') || combined.includes('current affairs') || combined.includes('government') || combined.includes('public')) {
    return 'news';
  }
  if (combined.includes('islamic') || combined.includes('quran') || combined.includes('naat') || combined.includes('hamd') || combined.includes('sufi') || combined.includes('ghazal') || combined.includes('devotional') || combined.includes('bhajan') || combined.includes('shabad') || combined.includes('kirtan') || combined.includes('temple')) {
    return 'devotional';
  }
  // Default category is music for general channels
  return 'music';
}

async function onRadioCountryChange(countryCode) {
  const categorySelect = document.getElementById('radio-category-select');
  const channelSelect = document.getElementById('radio-channel-select');
  if (!channelSelect || !categorySelect) return;

  // Reset dropdowns
  categorySelect.disabled = true;
  categorySelect.value = "all";
  channelSelect.disabled = true;
  channelSelect.innerHTML = '<option value="">-- Loading Channels... --</option>';

  if (!countryCode) {
    channelSelect.innerHTML = '<option value="">-- Set Channel --</option>';
    return;
  }

  showChatToast("Loading radio channels...", "info");

  // Fetch stations from Radio-Browser API (handling diaspora countries differently)
  let rawStations = [];
  try {
    if (countryCode === 'PK' || countryCode === 'IN') {
      const apiEndpoint = `/stations/search?countrycode=${countryCode}&hidebroken=true&order=clickcount&reverse=true&limit=80`;
      rawStations = await fetchRadioBrowser(apiEndpoint);
    } else {
      // Fetch Hindi, Urdu, and Punjabi streams globally in parallel
      const promises = ['hindi', 'urdu', 'punjabi'].map(lang => 
        fetchRadioBrowser(`/stations/search?language=${lang}&hidebroken=true&order=clickcount&reverse=true&limit=100`)
      );
      const results = await Promise.all(promises);
      const allStations = results.filter(r => r !== null).flat();
      
      // Filter in-memory for the diaspora country (e.g. GB/UK, US, CA, AE, AU)
      rawStations = allStations.filter(s => {
        const cc = (s.countrycode || '').toUpperCase();
        if (countryCode === 'GB' && cc === 'UK') return true;
        if (countryCode === 'UK' && cc === 'GB') return true;
        return cc === countryCode;
      });
    }
  } catch (apiErr) {
    console.error("[Radio] API fetching threw exception:", apiErr);
  }

  let apiChannels = [];
  if (rawStations && Array.isArray(rawStations)) {
    // Filter and map only secure HTTPS streams, avoiding .pls playlist wrappers
    apiChannels = rawStations
      .filter(s => {
        const streamUrl = s.url_resolved || s.url || '';
        const isSecure = streamUrl.startsWith('https://');
        const isPlaylist = streamUrl.endsWith('.pls') || streamUrl.endsWith('.asx');
        return isSecure && !isPlaylist;
      })
      .map(s => {
        const cat = categorizeStation(s);
        const namePrefix = cat === 'sports' ? '[Sports]' : cat === 'news' ? '[News]' : cat === 'devotional' ? '[Devotional]' : cat === 'punjabi' ? '[Punjabi]' : '[Music]';
        return {
          name: `${namePrefix} ${s.name}`,
          url: s.url_resolved || s.url,
          category: cat
        };
      });
  } else {
    console.warn("[Radio] API unreachable or empty. Using curated fallbacks only.");
  }

  // Combine curated fallback channels with API channels (removing duplicates by name)
  const curated = CURATED_PLAYLISTS[countryCode] || [];
  const uniqueNames = new Set(curated.map(c => c.name));
  
  // Merge and prioritize curated channels
  loadedRadioChannels = [
    ...curated,
    ...apiChannels.filter(ac => !uniqueNames.has(ac.name))
  ];

  categorySelect.disabled = false;
  populateChannels("all");
}

function onRadioCategoryChange(categoryCode) {
  populateChannels(categoryCode);
}

function populateChannels(categoryCode) {
  const channelSelect = document.getElementById('radio-channel-select');
  if (!channelSelect) return;

  channelSelect.innerHTML = '<option value="">-- Set Channel --</option>';

  // Filter channels based on selected category
  const filtered = loadedRadioChannels.filter(ch => {
    if (!categoryCode || categoryCode === "all") return true;
    return ch.category === categoryCode;
  });

  if (filtered.length === 0) {
    channelSelect.innerHTML = '<option value="">-- No channels found --</option>';
    channelSelect.disabled = true;
    return;
  }

  filtered.forEach((ch, idx) => {
    const opt = document.createElement('option');
    // Store original index in loadedRadioChannels to make retrieval simple
    opt.value = loadedRadioChannels.indexOf(ch);
    opt.textContent = ch.name;
    channelSelect.appendChild(opt);
  });

  channelSelect.disabled = false;
}

async function onRadioChannelChange(channelIdx) {
  const countrySelect = document.getElementById('radio-country-select');
  const statusArea = document.getElementById('radio-status-area');
  const statusText = document.getElementById('radio-status-text');
  
  if (!countrySelect || channelIdx === "" || !loadedRadioChannels[parseInt(channelIdx, 10)]) {
    return;
  }
  
  const channel = loadedRadioChannels[parseInt(channelIdx, 10)];
  const countryName = countrySelect.value === 'PK' ? 'Pakistan 🇵🇰' : 'India 🇮🇳';
  
  // Prevent WebRTC Voice Chat from playing at the same time
  if (typeof leaveVoice === 'function') {
    leaveVoice();
  }
  
  try {
    statusArea.classList.remove('hidden');
    statusText.textContent = `Playing: ${channel.name} - ${countryName}`;
    
    // Clean up any existing HLS player instance
    if (window.hlsInstance) {
      window.hlsInstance.destroy();
      window.hlsInstance = null;
    }

    const streamUrl = channel.url;
    console.log(`[Radio] Attempting to play stream: ${streamUrl}`);

    // If stream is HLS (.m3u8), load it via hls.js
    if (streamUrl.includes('.m3u8') && typeof Hls !== 'undefined') {
      if (Hls.isSupported()) {
        window.hlsInstance = new Hls({
          maxMaxBufferLength: 10,
          enableWorker: true
        });
        window.hlsInstance.loadSource(streamUrl);
        window.hlsInstance.attachMedia(window.radioPlayer);
        
        window.hlsInstance.on(Hls.Events.MANIFEST_PARSED, async () => {
          try {
            await window.radioPlayer.play();
          } catch (playErr) {
            console.error("[Radio] HLS play start error:", playErr);
            throw playErr;
          }
        });

        window.hlsInstance.on(Hls.Events.ERROR, function (event, data) {
          if (data.fatal) {
            console.warn("[Radio] Fatal HLS error encountered, retrying...", data.type);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                window.hlsInstance.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                window.hlsInstance.recoverMediaError();
                break;
              default:
                stopRadioPlayer();
                showChatToast("Fatal radio stream playback error.", "error");
                break;
            }
          }
        });
      } else if (window.radioPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari/iOS)
        window.radioPlayer.src = streamUrl;
        await window.radioPlayer.play();
      } else {
        throw new Error("HLS streaming not supported by this browser.");
      }
    } else {
      // Standard progressive audio stream (MP3/AAC)
      window.radioPlayer.src = streamUrl;
      await window.radioPlayer.play();
    }
  } catch (err) {
    console.error("Radio play failed:", err);
    showChatToast("Could not load radio stream: " + (err.message || "playback blocked"), "error");
    stopRadioPlayer();
  }
}

function stopRadioPlayer() {
  if (window.radioPlayer) {
    window.radioPlayer.pause();
    window.radioPlayer.src = "";
    try { window.radioPlayer.load(); } catch(_) {}
  }
  
  // Destroy HLS instance if it exists
  if (window.hlsInstance) {
    window.hlsInstance.destroy();
    window.hlsInstance = null;
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

let radioVolume = 0.8;
let isRadioMuted = false;

function onRadioVolumeChange(val) {
  const vol = parseFloat(val) / 100;
  radioVolume = vol;
  if (isRadioMuted && vol > 0) {
    isRadioMuted = false;
    const slider = document.getElementById('radio-volume-slider');
    if (slider) slider.style.opacity = 1;
  }
  if (window.radioPlayer) {
    window.radioPlayer.volume = isRadioMuted ? 0 : vol;
  }
  updateVolumeIcon(val);
  const valText = document.getElementById('radio-volume-val');
  if (valText) {
    valText.textContent = isRadioMuted ? 'Mute' : `${val}%`;
  }
}

function toggleRadioMute() {
  isRadioMuted = !isRadioMuted;
  const btn = document.getElementById('btn-radio-mute');
  const slider = document.getElementById('radio-volume-slider');
  const valText = document.getElementById('radio-volume-val');
  
  if (isRadioMuted) {
    if (window.radioPlayer) window.radioPlayer.volume = 0;
    if (btn) btn.textContent = '🔇';
    if (slider) slider.style.opacity = 0.5;
    if (valText) valText.textContent = 'Mute';
  } else {
    if (window.radioPlayer) window.radioPlayer.volume = radioVolume;
    if (btn) btn.textContent = getVolumeIconForValue(radioVolume * 100);
    if (slider) slider.style.opacity = 1;
    if (valText) valText.textContent = `${Math.round(radioVolume * 100)}%`;
  }
}

function getVolumeIconForValue(val) {
  if (val == 0) return '🔇';
  if (val < 30) return '🔈';
  if (val < 70) return '🔉';
  return '🔊';
}

function updateVolumeIcon(val) {
  const btn = document.getElementById('btn-radio-mute');
  if (btn && !isRadioMuted) {
    btn.textContent = getVolumeIconForValue(val);
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
window.onRadioCategoryChange = onRadioCategoryChange;
window.onRadioChannelChange = onRadioChannelChange;
window.stopRadioPlayer = stopRadioPlayer;
window.onRadioVolumeChange = onRadioVolumeChange;
window.toggleRadioMute = toggleRadioMute;
window.clearScreenLocally = clearScreenLocally;
window.clearAllRoomMessages = clearAllRoomMessages;

// ──────────────────────────────────────────────
// 📺 IPTV ROOM MODULE
// ──────────────────────────────────────────────

let _iptvHls = null;
let _iptvChannels = [];
let _iptvCurrentChannel = null;
let _iptvChannelChannel = null; // Supabase realtime channel for IPTV chat
let _iptvActive = false;

// IPTV M3U sources from iptv-org
const IPTV_SOURCES = {
  'country:pk': 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/pk.m3u',
  'country:in': 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/in.m3u',
  'country:us': 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u',
  'country:uk': 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/gb.m3u',
  'country:ca': 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ca.m3u',
  'cat:news':        'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/pk.m3u',
  'cat:sports':      'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/pk.m3u',
  'cat:movies':      'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/pk.m3u',
  'cat:music':       'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/pk.m3u',
  'cat:documentary': 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u',
  'cat:kids':        'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u',
  'cat:general':     'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/pk.m3u',
};

const VIRTUAL_ROOM_DEFAULTS = {
  virtual_iptv_enabled: true,
  virtual_iptv_category: 'country:pk',
  virtual_iptv_source: '',
  virtual_youtube_enabled: true,
  virtual_youtube_default: '',
  virtual_spotify_enabled: true,
  virtual_spotify_default: '',
  virtual_ludo_enabled: true,
  virtual_ludo_room: '',
  virtual_browser_enabled: true,
  virtual_browser_default: 'https://en.wikipedia.org/wiki/Main_Page',
  virtual_browser_locked: false,
  virtual_browser_pin: '1234'
};
let _virtualRoomConfig = { ...VIRTUAL_ROOM_DEFAULTS };

async function loadVirtualRoomConfig() {
  try {
    const keys = Object.keys(VIRTUAL_ROOM_DEFAULTS);
    const { data, error } = await sbClient.from('app_settings').select('key,value').in('key', keys);
    if (error) return;
    (data || []).forEach(row => {
      if (row.key.endsWith('_enabled')) _virtualRoomConfig[row.key] = row.value === 'true';
      else if (Object.prototype.hasOwnProperty.call(_virtualRoomConfig, row.key)) _virtualRoomConfig[row.key] = row.value || VIRTUAL_ROOM_DEFAULTS[row.key];
    });
  } catch (error) {
    console.warn('Virtual room settings unavailable; using defaults.', error);
  }
}

// Category filter keywords for category-type sources
const IPTV_CAT_KEYWORDS = {
  'cat:news':        ['news'],
  'cat:sports':      ['sports', 'sport'],
  'cat:movies':      ['movie', 'cinema', 'film'],
  'cat:music':       ['music', 'entertainment'],
  'cat:documentary': ['documentary', 'docu'],
  'cat:kids':        ['kids', 'children', 'family'],
  'cat:general':     [],
};

function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const channels = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      current = { name: '', logo: '', group: '', url: '' };
      const nameMatch = line.match(/,(.+)$/);
      if (nameMatch) current.name = nameMatch[1].trim();
      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      if (logoMatch) current.logo = logoMatch[1];
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      if (groupMatch) current.group = groupMatch[1].toLowerCase();
    } else if (line && !line.startsWith('#') && current) {
      current.url = line.trim();
      if (current.url) channels.push(current);
      current = null;
    }
  }
  return channels;
}

function filterChannelsByCategory(channels, key) {
  if (!key.startsWith('cat:')) return channels;
  const keywords = IPTV_CAT_KEYWORDS[key] || [];
  if (!keywords.length) return channels;
  return channels.filter(ch => keywords.some(k => (ch.group || '').includes(k) || ch.name.toLowerCase().includes(k)));
}

let _iptvVerificationQueue = [];
let _iptvVerifying = false;

async function checkChannelReachability(url) {
  if (window.location.protocol === 'https:' && url.startsWith('http://')) {
    return false; // Mixed content will be blocked by the browser anyway
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout
    await fetch(url, { method: 'GET', mode: 'no-cors', signal: controller.signal });
    clearTimeout(timeoutId);
    return true;
  } catch (e) {
    return false;
  }
}

function startVerifyingChannels(channelsToCheck) {
  _iptvVerificationQueue = [...channelsToCheck];
  if (!_iptvVerifying) {
    _iptvVerifying = true;
    verifyNextBatch();
  }
}

async function verifyNextBatch() {
  if (!_iptvActive || _iptvVerificationQueue.length === 0) {
    _iptvVerifying = false;
    _iptvVerificationQueue = [];
    return;
  }

  const batch = _iptvVerificationQueue.splice(0, 5);
  const results = await Promise.all(batch.map(async (ch) => {
    if (!_iptvChannels.some(item => item.url === ch.url)) {
      return { ch, isReachable: true }; // Already replaced or loaded new
    }
    const isReachable = await checkChannelReachability(ch.url);
    return { ch, isReachable };
  }));

  results.forEach(({ ch, isReachable }) => {
    if (!isReachable && _iptvActive) {
      ch.broken = true;
      _iptvChannels = _iptvChannels.filter(item => item.url !== ch.url);
      const li = document.querySelector(`.iptv-channel-list li[data-url="${encodeURIComponent(ch.url)}"]`);
      if (li) li.remove();
    }
  });

  if (_iptvActive && _iptvVerificationQueue.length > 0) {
    setTimeout(verifyNextBatch, 100);
  } else {
    _iptvVerifying = false;
    _iptvVerificationQueue = [];
  }
}

async function loadIPTVChannels(key) {
  const url = _virtualRoomConfig.virtual_iptv_source || IPTV_SOURCES[key] || IPTV_SOURCES['country:pk'];
  const listEl = document.getElementById('iptv-channel-list');
  if (listEl) listEl.innerHTML = '<li style="padding:12px;color:var(--muted)">⏳ Loading channels...</li>';
  try {
    let text;
    try {
      const resp = await fetch(url, { cache: 'default' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      text = await resp.text();
    } catch (e) {
      const proxy = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
      const resp2 = await fetch(proxy);
      const json = await resp2.json();
      text = json.contents;
    }
    let channels = parseM3U(text);
    if (key.startsWith('cat:')) channels = filterChannelsByCategory(channels, key);
    _iptvChannels = channels.slice(0, 200);
    renderIPTVChannelList(_iptvChannels);
    startVerifyingChannels(_iptvChannels);
  } catch (err) {
    console.error('IPTV load error', err);
    if (listEl) listEl.innerHTML = '<li style="padding:12px;color:#ef4444">❌ Failed to load channels. Try another region.</li>';
    _iptvChannels = [];
  }
}

function renderIPTVChannelList(channels) {
  const listEl = document.getElementById('iptv-channel-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!channels.length) {
    listEl.innerHTML = '<li style="padding:12px;color:var(--muted)">No channels found.</li>';
    return;
  }
  const frag = document.createDocumentFragment();
  channels.forEach((ch, i) => {
    const li = document.createElement('li');
    li.dataset.index = String(i);
    li.dataset.url = encodeURIComponent(ch.url);
    if (ch.logo) {
      const img = document.createElement('img');
      img.src = ch.logo;
      img.alt = '';
      img.className = 'iptv-channel-logo';
      img.onerror = () => { img.style.display = 'none'; };
      li.appendChild(img);
    } else {
      const span = document.createElement('span');
      span.textContent = '📺';
      li.appendChild(span);
    }
    const nameSpan = document.createElement('span');
    nameSpan.textContent = ch.name || ('Channel ' + (i + 1));
    li.appendChild(nameSpan);
    li.onclick = () => playIPTVChannel(ch, li);
    frag.appendChild(li);
  });
  listEl.appendChild(frag);
}

function playIPTVChannel(ch, liEl) {
  _iptvCurrentChannel = ch;
  document.querySelectorAll('.iptv-channel-list li').forEach(l => l.classList.remove('active'));
  if (liEl) liEl.classList.add('active');

  const video = document.getElementById('iptv-player');
  const overlay = document.getElementById('iptv-player-overlay');
  const loadingText = document.getElementById('iptv-loading-text');
  if (!video) return;

  if (overlay) overlay.classList.remove('hidden');
  if (loadingText) loadingText.textContent = 'Loading: ' + ch.name + '...';

  if (_iptvHls) {
    _iptvHls.destroy();
    _iptvHls = null;
  }
  video.src = '';

  const onReady = () => { if (overlay) overlay.classList.add('hidden'); };
  const onError = () => {
    if (overlay) overlay.classList.remove('hidden');
    if (loadingText) loadingText.textContent = '⚠️ Cannot play this channel. Try another.';
    
    // Mark as broken and remove from DOM/list
    ch.broken = true;
    _iptvChannels = _iptvChannels.filter(item => item.url !== ch.url);
    const li = document.querySelector(`.iptv-channel-list li[data-url="${encodeURIComponent(ch.url)}"]`);
    if (li) li.remove();
  };
  video.onplaying = onReady;
  video.onerror = onError;

  if (ch.url.includes('.m3u8') || ch.url.includes('m3u8')) {
    if (window.Hls && Hls.isSupported()) {
      _iptvHls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
      _iptvHls.loadSource(ch.url);
      _iptvHls.attachMedia(video);
      _iptvHls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      _iptvHls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) onError();
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = ch.url;
      video.play().catch(onError);
    } else {
      onError();
    }
  } else {
    video.src = ch.url;
    video.play().catch(onError);
  }
}

function enterIPTVRoom() {
  if (isGuestProfile(currentProfile)) {
    showChatToast('🔒 Only registered members can access other rooms. Please register or log in to unlock all rooms!', 'warning', 5000);
    return;
  }
  cleanupVirtualRooms();
  _iptvActive = true;

  // Mark sidebar item
  document.querySelectorAll('#room-list li').forEach(li => li.classList.remove('active'));
  const iptvLi = document.querySelector('#room-list li[data-room-id="iptv-virtual"]');
  if (iptvLi) iptvLi.classList.add('active');

  // Show IPTV container, hide regular messages area controls
  const iptvContainer = document.getElementById('iptv-container');
  if (iptvContainer) iptvContainer.classList.remove('hidden');

  // Show return button
  const btnReturn = document.getElementById('btn-iptv-return');
  if (btnReturn) btnReturn.classList.remove('hidden');

  // Update topbar
  const titleEl = document.getElementById('current-room-name');
  if (titleEl) titleEl.textContent = '📺 IPTV Live Channels';
  document.title = '📺 IPTV – ChatCorner';

  // Add page-shell class
  const shell = document.querySelector('.page-shell');
  if (shell) shell.classList.add('iptv-active');

  // Switch mobile tab to chat
  if (typeof switchMobileTab === 'function') switchMobileTab('chat');

  // Keep the shared voice chat available in IPTV rooms.
  const msgContainer = document.getElementById('messages');
  if (msgContainer) msgContainer.innerHTML = '';
  const voiceControls = document.getElementById('voice-controls');
  if (voiceControls) voiceControls.classList.remove('hidden');
  const barDivider = document.getElementById('bar-divider');
  if (barDivider) barDivider.classList.remove('hidden');

  // Enable input
  const msgInput = document.getElementById('msg-input');
  const sendBtn = document.querySelector('.btn-send');
  const emojiBtn = document.getElementById('btn-emoji');
  if (msgInput) { msgInput.disabled = false; msgInput.placeholder = '💬 Chat in IPTV room...'; }
  if (sendBtn) sendBtn.disabled = false;
  if (emojiBtn) emojiBtn.disabled = false;

  // Wrap messages + input-strip into .iptv-chat-wrapper for left panel
  const chatMain = document.querySelector('.chat-main');
  const messages = document.getElementById('messages');
  const inputStrip = document.querySelector('.input-strip');
  if (chatMain && messages && inputStrip && !document.querySelector('.iptv-chat-wrapper')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'iptv-chat-wrapper';
    chatMain.appendChild(wrapper);
    wrapper.appendChild(messages);
    wrapper.appendChild(inputStrip);
  }

  // Set currentRoom to a virtual object so message sending works via realtime broadcast
  currentRoom = { id: 'iptv-virtual', name: 'IPTV', is_audio_enabled: true, _virtual: true };
  updateComposerState();

  // Subscribe to realtime broadcast channel for IPTV chat (no DB writes, broadcast only)
  if (_iptvChannelChannel) sbClient.removeChannel(_iptvChannelChannel);
  _iptvChannelChannel = sbClient.channel('iptv-chat-room', {
    config: { broadcast: { self: false } }
  });
  _iptvChannelChannel.on('broadcast', { event: 'message' }, ({ payload }) => {
    renderIPTVChatMessage(payload);
  }).subscribe();

  // Load default channels (Pakistan)
  const catSelect = document.getElementById('iptv-category-select');
  const defaultVal = _virtualRoomConfig.virtual_iptv_category || (catSelect ? catSelect.value : 'country:pk');
  if (catSelect && IPTV_SOURCES[defaultVal]) catSelect.value = defaultVal;
  loadIPTVChannels(defaultVal);
}

function exitIPTVRoom() {
  if (!_iptvActive) return;
  _iptvActive = false;

  const iptvContainer = document.getElementById('iptv-container');
  if (iptvContainer) iptvContainer.classList.add('hidden');

  const shell = document.querySelector('.page-shell');
  if (shell) shell.classList.remove('iptv-active');

  // Hide return button
  const btnReturn = document.getElementById('btn-iptv-return');
  if (btnReturn) btnReturn.classList.add('hidden');

  // Unwrap chat elements back into .chat-main
  const chatMain = document.querySelector('.chat-main');
  const wrapper = document.querySelector('.iptv-chat-wrapper');
  if (chatMain && wrapper) {
    while (wrapper.firstChild) chatMain.appendChild(wrapper.firstChild);
    wrapper.remove();
  }

  // Stop video
  if (_iptvHls) { _iptvHls.destroy(); _iptvHls = null; }
  const video = document.getElementById('iptv-player');
  if (video) { video.pause(); video.src = ''; }

  // Remove realtime channel
  if (_iptvChannelChannel) { sbClient.removeChannel(_iptvChannelChannel); _iptvChannelChannel = null; }

  // Clear channel list
  const listEl = document.getElementById('iptv-channel-list');
  if (listEl) listEl.innerHTML = '';
}

function exitIPTVRoomAndShowRooms() {
  cleanupVirtualRooms();
  if (cachedRooms && cachedRooms.length > 0) {
    const isGuest = isGuestProfile(currentProfile);
    let targetRoom = null;
    if (isGuest) {
      targetRoom = cachedRooms.find(r => r.name && r.name.toLowerCase() === 'guest') || cachedRooms[0];
    } else {
      targetRoom = cachedRooms.find(r => r.name && r.name.toLowerCase() === 'chatcorner')
                || cachedRooms.find(r => r.name && r.name.toLowerCase() === 'gaming')
                || cachedRooms[0];
    }
    enterRoom(targetRoom);
  }
  if (typeof switchMobileTab === 'function') {
    switchMobileTab('rooms');
  }
}

function renderIPTVChatMessage(payload) {
  const container = document.getElementById('messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'message';
  const username = payload.username || 'Anonymous';
  const text = String(payload.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  div.innerHTML = `<span class="msg-user">${username.replace(/</g,'&lt;')}: </span><span class="msg-text">${window.formatMessageText ? window.formatMessageText(payload.text) : text}</span>`;
  container.appendChild(div);
  scheduleMessageScroll();
}

// Patch sendMessage to support IPTV and Virtual Co-Watch broadcast when in virtual rooms
const _origSendMessage = window.sendMessage;
window.sendMessage = async function() {
  if (currentRoom?._virtual) {
    const input = document.getElementById('msg-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    // Browser Virtual Room in-room chat
    if (currentRoom.id === 'browser-virtual') {
      if (window.BrowserRoom && typeof window.BrowserRoom.sendChatMessage === 'function') {
        const ok = await window.BrowserRoom.sendChatMessage(text);
        if (ok) {
          input.value = '';
          if (typeof autoResizeTextarea === 'function') autoResizeTextarea(input);
          const counter = document.getElementById('msg-char-counter');
          if (counter) counter.textContent = '0/500';
        }
      }
      return;
    }
    const channel = _iptvActive && _iptvChannelChannel ? _iptvChannelChannel : _mediaChannel;
    if (!channel) {
      showChatToast('Chat is still connecting. Please try again.', 'warning');
      return;
    }
    if (!_iptvActive) {
      await Promise.race([
        _mediaChannelReady,
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);
    }
    if ((!_iptvActive && channel !== _mediaChannel) || channel.state !== 'joined') {
      showChatToast('Chat is still connecting. Please try again.', 'warning');
      return;
    }
    const payload = {
      username: currentProfile?.username || currentUser?.email?.split('@')[0] || 'Guest',
      text,
      ts: Date.now()
    };
    
    let sendStatus;
    if (_iptvActive && _iptvChannelChannel) {
      sendStatus = await _iptvChannelChannel.send({ type: 'broadcast', event: 'message', payload });
    } else if (_mediaKind) {
      sendStatus = await channel.send({ type: 'broadcast', event: 'message', payload });
    }
    if (sendStatus !== 'ok') {
      showChatToast('Could not send message. Please try again.', 'warning');
      return;
    }
    input.value = '';
    autoResizeTextarea(input);
    const counter = document.getElementById('msg-char-counter');
    if (counter) counter.textContent = '0/500';
    renderIPTVChatMessage(payload);
    return;
  }
  if (typeof _origSendMessage === 'function') return _origSendMessage();
};

window.enterIPTVRoom = enterIPTVRoom;
window.exitIPTVRoom = exitIPTVRoom;
window.exitIPTVRoomAndShowRooms = exitIPTVRoomAndShowRooms;

window.changeIPTVCategoryOrCountry = function(val) {
  loadIPTVChannels(val);
};

window.onIPTVChannelSearchInput = function(query) {
  if (!_iptvChannels.length) return;
  const q = query.toLowerCase().trim();
  const filtered = q ? _iptvChannels.filter(ch => ch.name.toLowerCase().includes(q)) : _iptvChannels;
  renderIPTVChannelList(filtered);
};

// ── Room Password Access Prompt Modals ──

function showRoomPasswordPrompt(room, callback) {
  _pendingRoom = room;
  _pendingRoomEntryCallback = callback;
  
  const modal = document.getElementById('room-password-prompt-modal');
  const errorDiv = document.getElementById('room-password-error');
  const input = document.getElementById('room-access-password');
  
  if (modal) {
    if (input) input.value = '';
    if (errorDiv) errorDiv.classList.add('hidden');
    modal.classList.remove('hidden');
    if (input) input.focus();
  }
}

function closeRoomPasswordPrompt() {
  const modal = document.getElementById('room-password-prompt-modal');
  if (modal) modal.classList.add('hidden');
  _pendingRoomEntryCallback = null;
  _pendingRoom = null;
}

async function submitRoomPassword() {
  if (!_pendingRoom || !_pendingRoomEntryCallback) return;
  const room = _pendingRoom;
  const password = document.getElementById('room-access-password').value;
  const errorDiv = document.getElementById('room-password-error');
  
  try {
    const { data: verified, error } = await sbClient.rpc('verify_room_password', {
      p_room_id: room.id,
      p_password: password
    });
    
    if (error) throw error;
    
    if (verified) {
      _bypassPasswordRooms.add(room.id);
      closeRoomPasswordPrompt();
      if (typeof _pendingRoomEntryCallback === 'function') {
        _pendingRoomEntryCallback();
      }
    } else {
      if (errorDiv) errorDiv.classList.add('hidden');
    }
  } catch (err) {
    console.error(err);
    showChatToast('Verification error: ' + err.message, 'warning');
  }
}

// ── Room Lock setup modals (Owner/Admin context option) ──

function showRoomContextMenu(e, room) {
  const isOwner = room.owner_id === currentUser?.id || currentProfile?.is_admin || currentProfile?.is_owner || currentProfile?.is_mod;
  if (!isOwner) return; // Non-owners don't see context menu

  _contextMenuRoom = room;
  const menu = document.getElementById('room-context-menu');
  if (!menu) return;

  const lockItem = document.getElementById('menu-item-lock');
  if (lockItem) {
    lockItem.textContent = room.is_locked ? '🔓 Unlock Room' : '🔒 Lock Room';
  }

  menu.style.left = e.pageX + 'px';
  menu.style.top = e.pageY + 'px';
  menu.classList.remove('hidden');

  e.stopPropagation();
}

function handleMenuLockToggle() {
  const menu = document.getElementById('room-context-menu');
  if (menu) menu.classList.add('hidden');

  if (!_contextMenuRoom) return;
  const room = _contextMenuRoom;
  
  if (room.is_locked) {
    unlockRoomAction(room);
  } else {
    const modal = document.getElementById('room-lock-setup-modal');
    if (modal) {
      const input = document.getElementById('room-lock-password');
      if (input) input.value = '';
      modal.classList.remove('hidden');
      if (input) input.focus();
    }
  }
}

async function unlockRoomAction(room) {
  try {
    const { data, error } = await sbClient.rpc('unlock_room', { p_room_id: room.id });
    if (error) throw error;
    
    showChatToast('Room unlocked successfully!', 'success');
    
    // Refresh rooms listing
    room.is_locked = false;
    await loadRooms();
  } catch (err) {
    console.error(err);
    showChatToast('Failed to unlock room: ' + err.message, 'warning');
  }
}

async function saveRoomLockSettings() {
  if (!_contextMenuRoom) return;
  const room = _contextMenuRoom;
  const password = document.getElementById('room-lock-password').value.trim();
  
  if (!password) {
    showChatToast('Please enter a password.', 'warning');
    return;
  }
  
  try {
    const { data, error } = await sbClient.rpc('lock_room', { 
      p_room_id: room.id,
      p_password: password
    });
    if (error) throw error;
    
    showChatToast('Room locked successfully!', 'success');
    closeRoomLockSetup();
    
    // Refresh rooms listing
    room.is_locked = true;
    await loadRooms();
  } catch (err) {
    console.error(err);
    showChatToast('Failed to lock room: ' + err.message, 'warning');
  }
}

function closeRoomLockSetup() {
  const modal = document.getElementById('room-lock-setup-modal');
  if (modal) modal.classList.add('hidden');
}

// Close context menus on click anywhere
document.addEventListener('click', () => {
  const menu = document.getElementById('room-context-menu');
  if (menu) menu.classList.add('hidden');
});

// Global functions exports

window.closeRoomPasswordPrompt = closeRoomPasswordPrompt;
window.submitRoomPassword = submitRoomPassword;
window.closeRoomLockSetup = closeRoomLockSetup;
window.saveRoomLockSettings = saveRoomLockSettings;
window.handleMenuLockToggle = handleMenuLockToggle;
window.showRoomContextMenu = showRoomContextMenu;


async function checkGlobalChatMute() {
  try {
    const { data, error } = await sbClient
      .from('app_settings')
      .select('value')
      .eq('key', 'global_chat_disabled')
      .maybeSingle();
    if (!error && data) {
      const isMuted = (data.value === 'true');
      if (_globalChatMuted !== isMuted) {
        _globalChatMuted = isMuted;
        updateComposerState();
        const checkbox = document.getElementById('owner-global-mute-checkbox');
        if (checkbox) checkbox.checked = isMuted;
      }
    }
  } catch (_) {}
}

checkGlobalChatMute();
setInterval(checkGlobalChatMute, 10000);


async function toggleGlobalChatMute(active) {
  if (!currentProfile?.is_owner) {
    showChatToast('Only the owner can toggle global chat mute.', 'error');
    return;
  }
  
  _globalChatMuted = active;
  
  try {
    const { error } = await sbClient
      .from('app_settings')
      .upsert({ key: 'global_chat_disabled', value: String(active), updated_at: new Date().toISOString() }, { onConflict: 'key' });
      
    if (error) throw error;
    showChatToast(active ? 'Chat has been muted globally.' : 'Global chat mute released.', 'info');
    updateComposerState();
  } catch (err) {
    showChatToast('Failed to save setting: ' + err.message, 'error');
  }
}

async function handleMenuRestrictUser() {
  const menu = document.getElementById('room-context-menu');
  if (menu) menu.classList.add('hidden');

  if (!_contextMenuRoom) return;
  const room = _contextMenuRoom;

  const username = prompt("Enter username of the user you wish to RESTRICT from entering this room:\n(To clear all restrictions for this room, click OK with an empty input)");
  if (username === null) return;

  const targetUser = username.trim();
  if (targetUser === "") {
    try {
      const { error } = await sbClient
        .from('rooms')
        .update({ description: '' })
        .eq('id', room.id);
      if (error) throw error;
      showChatToast('All restrictions cleared for this room.', 'success');
      room.description = '';
    } catch (err) {
      showChatToast('Error: ' + err.message, 'error');
    }
    return;
  }

  try {
    const { data: profile, error: profileErr } = await sbClient
      .from('profiles')
      .select('id, username')
      .eq('username', targetUser)
      .maybeSingle();

    if (profileErr || !profile) {
      showChatToast('User "' + targetUser + '" not found.', 'error');
      return;
    }

    let restrictedIds = [];
    try {
      if (room.description && room.description.startsWith('[') && room.description.endsWith(']')) {
        restrictedIds = JSON.parse(room.description);
      }
    } catch (_) {}

    if (!restrictedIds.includes(profile.id)) {
      restrictedIds.push(profile.id);
    }

    const { error: updateErr } = await sbClient
      .from('rooms')
      .update({ description: JSON.stringify(restrictedIds) })
      .eq('id', room.id);

    if (updateErr) throw updateErr;

    showChatToast('User "' + profile.username + '" restricted from entering this room!', 'success');
    room.description = JSON.stringify(restrictedIds);
  } catch (err) {
    showChatToast('Failed to restrict user: ' + err.message, 'error');
  }
}


/* ── Virtual Rooms Unified Cleanup ── */

/* ── Guest Room Guidance & Registration System ── */
let _guestGuideTimer = null;

function appendGuestRoomGuidanceCard() {
  const container = document.getElementById('messages');
  if (!container || container.querySelector('.guest-chat-guide-card')) return;
  const card = document.createElement('div');
  card.className = 'guest-chat-guide-card';
  card.innerHTML = `
    <div class="guest-chat-guide-header">
      <span>💡 Welcome to ChatCorner Guest Lounge</span>
    </div>
    <div class="guest-chat-guide-body">
      <p style="margin:0 0 0.5rem;color:#f1f5f9;">You are currently in the <strong>#Guest</strong> room. Only registered members can access other chatrooms and virtual media rooms.</p>
      <ul class="guest-chat-guide-perks">
        <li>🔓 <strong>ChatRooms:</strong> ChatCorner, General, Voice Lounge</li>
        <li>🌐 <strong>Browser Room:</strong> Synchronized watch parties & browsing</li>
        <li>📺 <strong>Virtual Entertainment:</strong> IPTV Channels, Spotify & Ludo</li>
        <li>🎙️ <strong>Voice Calls & Notes:</strong> Send and hear voice notes in real-time</li>
        <li>🎨 <strong>Personal Identity:</strong> Custom avatar, nick colors & VIP status</li>
      </ul>
      <p style="margin:0.5rem 0 0.4rem;font-size:0.78rem;color:#a78bfa;">Registration is 100% free, takes 10 seconds, and only requires a username and password.</p>
      <div class="guest-chat-guide-actions">
        <a href="login.html" class="btn-guest-register-cta">👉 Click Here to Register Free / Log In</a>
      </div>
    </div>
  `;
  container.prepend(card);
}

function startGuestRoomGuidanceBroadcast() {
  if (_guestGuideTimer) clearInterval(_guestGuideTimer);
  _guestGuideTimer = setInterval(() => {
    if (!currentRoom || currentRoom.name?.toLowerCase() !== 'guest') {
      stopGuestRoomGuidanceBroadcast();
      return;
    }
    const container = document.getElementById('messages');
    if (!container) return;
    const noticeNode = document.createElement('div');
    noticeNode.className = 'msg-row system-msg guest-guide-notice';
    noticeNode.innerHTML = `
      <div class="msg-bubble system-bubble" style="background:linear-gradient(135deg,rgba(139,109,237,0.22),rgba(236,72,153,0.22));border:1px solid rgba(139,109,237,0.45);border-radius:10px;padding:0.6rem 0.9rem;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,0.3);">
        <span style="font-weight:700;color:#f472b6;">📢 Registration Guidance:</span>
        <span style="color:#e2e8f0;margin:0 6px;">Register your free account to unlock <strong>ChatCorner</strong>, <strong>Browser Room</strong>, <strong>IPTV</strong>, and voice notes!</span>
        <a href="login.html" style="color:#38bdf8;font-weight:700;text-decoration:underline;margin-left:4px;">Register Free →</a>
      </div>
    `;
    container.appendChild(noticeNode);
    scrollToBottom();
  }, 120000);
}

function stopGuestRoomGuidanceBroadcast() {
  if (_guestGuideTimer) {
    clearInterval(_guestGuideTimer);
    _guestGuideTimer = null;
  }
}
window.appendGuestRoomGuidanceCard = appendGuestRoomGuidanceCard;
window.startGuestRoomGuidanceBroadcast = startGuestRoomGuidanceBroadcast;
window.stopGuestRoomGuidanceBroadcast = stopGuestRoomGuidanceBroadcast;

function cleanupVirtualRooms() {
  const guideBanner = document.getElementById('guest-room-guidance-banner');
  if (guideBanner) guideBanner.classList.add('hidden');
  stopGuestRoomGuidanceBroadcast();
  // Exit voice and cleanup message/presence realtime channels from old room
  if (messageChannel) sbClient.removeChannel(messageChannel);
  if (presenceChannel) sbClient.removeChannel(presenceChannel);
  if (typeof leaveVoice === 'function') leaveVoice();

  // Reset virtual flags
  if (typeof exitIPTVRoom === 'function') exitIPTVRoom();
  if (typeof exitMediaRoom === 'function') exitMediaRoom();
  if (window.BrowserRoom && typeof window.BrowserRoom.exit === 'function') window.BrowserRoom.exit();

  // Cleanup layout classes on shell
  const shell = document.querySelector('.page-shell');
  if (shell) {
    shell.classList.remove('ludo-active');
    shell.classList.remove('iptv-active');
  }

  // Hide virtual containers
  const ludoContainer = document.getElementById('ludo-container');
  if (ludoContainer) ludoContainer.classList.add('hidden');

  const iptvContainer = document.getElementById('iptv-container');
  if (iptvContainer) iptvContainer.classList.add('hidden');

  const ludoReturnBtn = document.getElementById('btn-ludo-return');
  if (ludoReturnBtn) ludoReturnBtn.classList.add('hidden');

  const iptvReturnBtn = document.getElementById('btn-iptv-return');
  if (iptvReturnBtn) iptvReturnBtn.classList.add('hidden');

  // Restore mobile tabs
  const mobileTabs = document.getElementById('mobile-tabs');
  if (mobileTabs) mobileTabs.style.display = '';
}

function sanitizeLudoRoomKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

const _ludoAutoRoomKey = (() => {
  try {
    const params = new URLSearchParams(window.location.search || '');
    return sanitizeLudoRoomKey(params.get('ludo') || params.get('ludoRoom') || '');
  } catch (_) {
    return '';
  }
})();
let _ludoAutoEntered = false;

function getDefaultLudoRoomKey() {
  if (_virtualRoomConfig.virtual_ludo_room) return sanitizeLudoRoomKey(_virtualRoomConfig.virtual_ludo_room);
  const roomId = currentRoom && !currentRoom._virtual ? sanitizeLudoRoomKey(currentRoom.id) : '';
  return roomId ? `room-${roomId}` : 'global';
}

function tryAutoEnterLudoFromUrl() {
  if (_ludoAutoEntered || !_ludoAutoRoomKey) return;
  _ludoAutoEntered = true;
  setTimeout(() => enterLudoRoom(_ludoAutoRoomKey), 120);
}

/* ── Ludo Room Functions ── */
function enterLudoRoom(roomKey) {
  if (isGuestProfile(currentProfile)) {
    showChatToast('🔒 Only registered members can access other rooms. Please register or log in to unlock all rooms!', 'warning', 5000);
    return;
  }
  cleanupVirtualRooms();

  // Mark sidebar item active
  document.querySelectorAll('#room-list li').forEach(li => li.classList.remove('active'));
  const ludoLi = document.querySelector('#room-list li[data-room-id="ludo-virtual"]');
  if (ludoLi) ludoLi.classList.add('active');

  // Set virtual room state
  const resolvedRoomKey = sanitizeLudoRoomKey(roomKey) || getDefaultLudoRoomKey();
  currentRoom = { id: 'ludo-virtual', name: 'Ludo', _virtual: true };
  // Update topbar title
  const titleEl = document.getElementById('current-room-name');
  if (titleEl) titleEl.textContent = '🎲 Ludo Room';
  document.title = '🎲 Ludo – ChatCorner';

  // Load the game iframe (lazy-load only on first entry)
  const iframe = document.getElementById('ludo-iframe');
  if (iframe) {
    const userNick = currentUser?.username || 'Guest';
    const nextSrc = 'ludo/index.html?v=5.5&nick=' + encodeURIComponent(userNick) + '&room=' + encodeURIComponent(resolvedRoomKey);
    if (iframe.getAttribute('src') !== nextSrc) iframe.src = nextSrc;
  }

  // Show ludo container, hide chat elements
  const ludoContainer = document.getElementById('ludo-container');
  if (ludoContainer) ludoContainer.classList.remove('hidden');

  const shell = document.querySelector('.page-shell');
  if (shell) {
    shell.classList.add('ludo-active');
  }

  // Hide mobile tabs for clean full-screen
  const mobileTabs = document.getElementById('mobile-tabs');
  if (mobileTabs) mobileTabs.style.display = 'none';

  // Show/hide return buttons
  document.getElementById('btn-iptv-return')?.classList.remove('hidden');
  applyLudoScale();
}

function applyLudoScale() {
  const scale = parseFloat(localStorage.getItem('ludoScale')) || 1;
  const box = document.getElementById('ludo-container');
  if (box) box.style.setProperty('--ludo-scale', scale);
  const label = document.getElementById('ludo-zoom-label');
  if (label) label.textContent = Math.round(scale * 100) + '%';
}

window.ludoZoom = function(delta) {
  const cur = parseFloat(localStorage.getItem('ludoScale')) || 1;
  const next = delta === 0 ? 1 : Math.min(1.2, Math.max(0.5, Math.round((cur + delta) * 10) / 10));
  localStorage.setItem('ludoScale', String(next));
  applyLudoScale();
};

function exitLudoRoom() {
  cleanupVirtualRooms();
  if (cachedRooms && cachedRooms.length > 0) {
    enterRoom(cachedRooms[0]);
  }
}

window.enterLudoRoom = enterLudoRoom;
window.exitLudoRoom = exitLudoRoom;
window.openPersonalLudoRoom = function openPersonalLudoRoom(opponentId) {
  const me = sanitizeLudoRoomKey(currentUser?.id || 'guest');
  const them = sanitizeLudoRoomKey(opponentId);
  if (!them) return false;
  const roomKey = 'pm-' + [me, them].sort().join('-');
  enterLudoRoom(roomKey);
  return true;
};

window.toggleGlobalChatMute = toggleGlobalChatMute;

/* ── Auto-scroll: keep main room and PM message lists pinned to the newest message ── */
(function initAutoScroll() {
  const NEAR_PX = 150;
  const nearBottom = (el) => el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_PX;
  const toBottom = (el) => {
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      if (el.isConnected) el.scrollTop = el.scrollHeight;
    });
  };
  const isList = (el) => el && el.nodeType === 1 && (el.id === 'messages' || el.classList.contains('pm-messages'));
  const stuck = new WeakMap();

  document.addEventListener('scroll', (e) => {
    if (isList(e.target)) stuck.set(e.target, nearBottom(e.target));
  }, true);

  // Images/embeds change height after insertion
  document.addEventListener('load', (e) => {
    const list = e.target?.closest?.('#messages, .pm-messages');
    if (list && stuck.get(list) !== false) toBottom(list);
  }, true);

  const observer = new MutationObserver((mutations) => {
    const touched = new Set();
    mutations.forEach((m) => { if (m.addedNodes.length && isList(m.target)) touched.add(m.target); });
    touched.forEach((list) => {
      const last = list.lastElementChild;
      const own = last && (last.classList.contains('self') || last.dataset?.userId === currentUser?.id);
      if (stuck.get(list) !== false || own) {
        toBottom(list);
        stuck.set(list, true);
      }
    });
  });

  const start = () => {
    const main = document.getElementById('messages');
    if (main) observer.observe(main, { childList: true });
    const pmRoot = document.getElementById('pm-root');
    if (pmRoot) observer.observe(pmRoot, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();


/* ════════════════════════════════════════════════════════════════
   🎧 SPOTIFY + ▶️ YouTube ROOMS (synced listening / watching)
   YouTube: only admins/owner control playback.
   Spotify: first registered user in the room controls; VIP/Mod/Admin
   take priority; mods/admins can claim control; guests never control.
════════════════════════════════════════════════════════════════ */
let _mediaKind = null;            // 'sp' | 'yt' | null
let _mediaChannel = null;
let _mediaChannelReady = Promise.resolve();
let _mediaResolveChannelReady = null;
let _mediaTimer = null;
let _mediaJoinedAt = 0;
let _mediaClaimed = false;
let _ytReady = null;
let _ytState = { videoId: null, playing: false, time: 0 };
let _spController = null;
let _spState = { uri: null, paused: true, position: 0 };
let _spSuppress = false;

function _mediaIsAdmin() { return getViewerRoleLevel() >= 4; }
function _mediaUserName() {
  return currentProfile?.username || currentUser?.email?.split('@')[0] || 'Guest';
}
function _mediaToast(msg) {
  const el = document.getElementById(_mediaKind === 'sp' ? 'sp-status' : 'yt-status');
  if (el) el.textContent = msg;
}

function enterMediaRoom(id) {
  if (isGuestProfile(currentProfile)) {
    showChatToast('🔒 Only registered members can access other rooms. Please register or log in to unlock all rooms!', 'warning', 5000);
    return;
  }
  cleanupVirtualRooms();
  const kind = id === 'sp-virtual' ? 'sp' : 'yt';
  _mediaKind = kind;
  _mediaJoinedAt = Date.now();
  _mediaClaimed = false;

  document.querySelectorAll('#room-list li').forEach(li => li.classList.remove('active'));
  const li = document.querySelector(`#room-list li[data-room-id="${id}"]`);
  if (li) li.classList.add('active');

  const container = document.getElementById(kind === 'sp' ? 'sp-container' : 'yt-container');
  if (container) container.classList.remove('hidden');
  const btnReturn = document.getElementById('btn-iptv-return');
  if (btnReturn) btnReturn.classList.remove('hidden');

  const label = kind === 'sp' ? '🎧 Spotify' : '▶️ YouTube';
  const titleEl = document.getElementById('current-room-name');
  if (titleEl) titleEl.textContent = label + ' Room';
  document.title = label + ' – ChatCorner';

  const shell = document.querySelector('.page-shell');
  if (shell) shell.classList.add('iptv-active', 'media-room');
  if (typeof switchMobileTab === 'function') switchMobileTab('chat');

  const msgContainer = document.getElementById('messages');
  if (msgContainer) msgContainer.innerHTML = '';
  ['voice-controls', 'bar-divider'].forEach(i => document.getElementById(i)?.classList.remove('hidden'));
  const msgInput = document.getElementById('msg-input');
  if (msgInput) { msgInput.disabled = false; msgInput.placeholder = `💬 Chat in ${label} room...`; }
  const sendBtn = document.querySelector('.btn-send');
  if (sendBtn) sendBtn.disabled = false;
  const emojiBtn = document.getElementById('btn-emoji');
  if (emojiBtn) emojiBtn.disabled = false;

  const chatMain = document.querySelector('.chat-main');
  const messages = document.getElementById('messages');
  const inputStrip = document.querySelector('.input-strip');
  if (chatMain && messages && inputStrip && !document.querySelector('.iptv-chat-wrapper')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'iptv-chat-wrapper';
    chatMain.appendChild(wrapper);
    wrapper.appendChild(messages);
    wrapper.appendChild(inputStrip);
  }

  currentRoom = { id, name: kind === 'sp' ? 'Spotify' : 'YouTube', is_audio_enabled: true, _virtual: true };
  updateComposerState();

  if (kind === 'yt') initYouTubeRoom(); else initSpotifyRoom();
}

function exitMediaRoom() {
  if (!_mediaKind) return;
  const kind = _mediaKind;
  _mediaKind = null;
  clearInterval(_mediaTimer);
  _mediaTimer = null;

  ['sp-container', 'yt-container', 'browser-container'].forEach(i => document.getElementById(i)?.classList.add('hidden'));
  const shell = document.querySelector('.page-shell');
  if (shell) shell.classList.remove('iptv-active', 'media-room');
  document.getElementById('btn-iptv-return')?.classList.add('hidden');

  const chatMain = document.querySelector('.chat-main');
  const wrapper = document.querySelector('.iptv-chat-wrapper');
  if (chatMain && wrapper) {
    while (wrapper.firstChild) chatMain.appendChild(wrapper.firstChild);
    wrapper.remove();
  }

  if (_mediaChannel) { sbClient.removeChannel(_mediaChannel); _mediaChannel = null; }
  if (kind === 'yt' && _ytPlayer) { try { _ytPlayer.stopVideo(); } catch (e) {} }
  if (kind === 'sp') {
    try { if (_spController) _spController.pause(); } catch (e) {}
    _spController = null;
    const holder = document.getElementById('sp-embed');
    if (holder) holder.innerHTML = '';
  }
  _ytState = { videoId: null, playing: false, time: 0 };
  _spState = { uri: null, paused: true, position: 0 };
}

function _mediaSend(event, payload) {
  if (_mediaChannel) _mediaChannel.send({ type: 'broadcast', event, payload });
}

function _mediaOpenChannel(name, presence) {
  if (_mediaChannel) sbClient.removeChannel(_mediaChannel);
  _mediaChannelReady = new Promise(resolve => {
    _mediaResolveChannelReady = resolve;
  });
  const roomKey = String(currentRoom?.id || _mediaKind || 'media').replace(/[^a-zA-Z0-9_-]/g, '_');
  _mediaChannel = sbClient.channel(`${name}:${roomKey}`, {
    config: { broadcast: { self: false }, presence: { key: currentUser?.id || String(Math.random()) } }
  });
  _mediaChannel.on('broadcast', { event: 'message' }, ({ payload }) => renderIPTVChatMessage(payload));
  return _mediaChannel;
}

function _mediaMarkChannelReady(status) {
  if (status === 'SUBSCRIBED' && _mediaResolveChannelReady) {
    _mediaResolveChannelReady();
    _mediaResolveChannelReady = null;
  }
}

/* ───────── YouTube ───────── */
function _ytParseId(input) {
  const v = String(input || '').trim();
  const m = v.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(v) ? v : null;
}

function _ytLoadApi() {
  if (_ytReady) return _ytReady;
  _ytReady = new Promise(resolve => {
    if (window.YT && window.YT.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return _ytReady;
}

async function initYouTubeRoom() {
  const admin = _mediaIsAdmin();
  document.getElementById('yt-admin-bar')?.classList.toggle('hidden', !admin);
  document.getElementById('yt-guard')?.classList.toggle('hidden', admin);
  document.getElementById('yt-sync-btn')?.classList.toggle('hidden', admin);
  _mediaToast(admin ? 'You control playback.' : 'Only admins control playback.');

  const ch = _mediaOpenChannel('yt-chat-room');
  ch.on('broadcast', { event: 'yt-state' }, ({ payload }) => { if (!_mediaIsAdmin()) _ytApply(payload); });
  ch.on('broadcast', { event: 'yt-request' }, () => { if (_mediaIsAdmin()) _ytBroadcast(); });
  ch.subscribe(status => {
    _mediaMarkChannelReady(status);
    if (status === 'SUBSCRIBED') _mediaSend('yt-request', {});
  });

  await _ytLoadApi();
  if (_mediaKind !== 'yt') return;
  if (!_ytPlayer) {
    _ytPlayer = new YT.Player('yt-player', {
      width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, controls: _mediaIsAdmin() ? 1 : 0, disablekb: _mediaIsAdmin() ? 0 : 1 },
      events: { onStateChange: _ytOnState }
    });
  }
  if (!_ytState.videoId && _virtualRoomConfig.virtual_youtube_default) {
    const defaultVideoId = _ytParseId(_virtualRoomConfig.virtual_youtube_default);
    if (defaultVideoId) {
      _ytState.videoId = defaultVideoId;
      _ytPlayer.cueVideoById(defaultVideoId, 0);
    }
  }
  clearInterval(_mediaTimer);
  _mediaTimer = setInterval(() => { if (_mediaIsAdmin() && _ytState.videoId) _ytBroadcast(); }, 4000);
}

function _ytBroadcast() {
  if (!_ytPlayer || !_ytPlayer.getPlayerState || !_ytState.videoId) return;
  const st = _ytPlayer.getPlayerState();
  _mediaSend('yt-state', {
    videoId: _ytState.videoId,
    playing: st === 1 || st === 3,
    time: _ytPlayer.getCurrentTime() || 0,
    ts: Date.now()
  });
}

function _ytOnState(e) {
  if (!_mediaIsAdmin() || !_ytState.videoId) return;
  if ([1, 2, 0].includes(e.data)) _ytBroadcast();
}

function _ytApply(p) {
  if (!_ytPlayer || !_ytPlayer.loadVideoById || !p || !p.videoId) return;
  const target = (p.time || 0) + (p.playing ? (Date.now() - (p.ts || Date.now())) / 1000 : 0);
  if (_ytState.videoId !== p.videoId) {
    _ytState.videoId = p.videoId;
    if (p.playing) _ytPlayer.loadVideoById(p.videoId, target); else _ytPlayer.cueVideoById(p.videoId, target);
    return;
  }
  if (Math.abs((_ytPlayer.getCurrentTime() || 0) - target) > 2) _ytPlayer.seekTo(target, true);
  const st = _ytPlayer.getPlayerState();
  if (p.playing && st !== 1 && st !== 3) _ytPlayer.playVideo();
  if (!p.playing && st === 1) _ytPlayer.pauseVideo();
}

window.ytLoadVideo = function() {
  if (!_mediaIsAdmin()) return;
  const input = document.getElementById('yt-url-input');
  const id = _ytParseId(input?.value);
  if (!id) { _mediaToast('Invalid YouTube link.'); return; }
  _ytState.videoId = id;
  _ytPlayer.loadVideoById(id, 0);
  input.value = '';
  setTimeout(_ytBroadcast, 800);
  _mediaToast('Video loaded for everyone.');
};

window.ytSyncNow = function() {
  if (_ytPlayer && _ytPlayer.playVideo && _ytState.videoId) { _ytPlayer.unMute(); _ytPlayer.playVideo(); }
  _mediaSend('yt-request', {});
};

/* ───────── Spotify ───────── */
function _spParseUri(input) {
  const m = String(input || '').match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/);
  if (m) return `spotify:${m[1]}:${m[2]}`;
  return /^spotify:(track|album|playlist|episode|show|artist):[A-Za-z0-9]+$/.test(String(input || '').trim()) ? input.trim() : null;
}

function _spRank(meta) {
  if (!meta || meta.level < 1) return -1;
  if (meta.claimed && meta.level >= 3) return 3;
  return meta.level >= 2 ? 2 : 1;
}

function _spGetController() {
  const state = _mediaChannel ? _mediaChannel.presenceState() : {};
  let best = null;
  Object.entries(state).forEach(([key, metas]) => {
    const m = metas[0];
    if (!m) return;
    const rank = _spRank(m);
    if (rank < 0) return;
    if (!best || rank > best.rank || (rank === best.rank && m.joinedAt < best.joinedAt)) {
      best = { id: key, name: m.name, rank, joinedAt: m.joinedAt };
    }
  });
  return best;
}

function _spAmController() {
  const c = _spGetController();
  return !!c && c.id === currentUser?.id;
}

function _spRefreshUi() {
  const c = _spGetController();
  const me = _spAmController();
  const level = getViewerRoleLevel();
  document.getElementById('sp-control-bar')?.classList.toggle('hidden', !me);
  document.getElementById('sp-guard')?.classList.toggle('hidden', me);
  document.getElementById('sp-claim-btn')?.classList.toggle('hidden', !(level >= 3 && !me));
  document.getElementById('sp-sync-btn')?.classList.toggle('hidden', me);
  _mediaToast(level < 1
    ? 'Guests can only listen. Register to control music.'
    : me ? 'You control the music.' : (c ? `${c.name} controls the music.` : 'No one controls the music yet.'));
}

async function _spTrack() {
  if (!_mediaChannel) return;
  await _mediaChannel.track({
    name: _mediaUserName(),
    level: getViewerRoleLevel(),
    joinedAt: _mediaJoinedAt,
    claimed: _mediaClaimed
  });
}

function _spLoadApi() {
  return new Promise(resolve => {
    if (window._spIFrameApi) return resolve(window._spIFrameApi);
    const timer = setTimeout(() => resolve(null), 8000);
    window.onSpotifyIframeApiReady = api => { clearTimeout(timer); window._spIFrameApi = api; resolve(api); };
    if (!document.getElementById('sp-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'sp-iframe-api';
      tag.src = 'https://open.spotify.com/embed/iframe-api/v1';
      tag.async = true;
      tag.onerror = () => { clearTimeout(timer); resolve(null); };
      document.head.appendChild(tag);
    }
  });
}

// Plain iframe embed used when the Spotify IFrame API is unavailable (no play/pause sync)
function _spRenderFallback(uri) {
  const m = String(uri || '').match(/^spotify:(\w+):([A-Za-z0-9]+)$/);
  const holder = document.getElementById('sp-embed');
  if (!holder || !m) return;
  holder.innerHTML = `<iframe src="https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator" width="100%" height="352" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
}

function _spLoad(uri) {
  if (_spController) _spController.loadUri(uri);
  else _spRenderFallback(uri);
}

async function initSpotifyRoom() {
  const ch = _mediaOpenChannel('sp-chat-room');
  ch.on('presence', { event: 'sync' }, _spRefreshUi);
  ch.on('broadcast', { event: 'sp-state' }, ({ payload }) => { if (!_spAmController()) _spApply(payload); });
  ch.on('broadcast', { event: 'sp-request' }, () => { if (_spAmController()) _spBroadcast(); });
  ch.subscribe(async status => {
    _mediaMarkChannelReady(status);
    if (status === 'SUBSCRIBED') {
      await _spTrack();
      _mediaSend('sp-request', {});
    }
  });
  _spRefreshUi();

  const api = await _spLoadApi();
  if (_mediaKind !== 'sp') return;
  const defaultUri = _spState.uri || _spParseUri(_virtualRoomConfig.virtual_spotify_default) || 'spotify:playlist:37i9dQZEVXbMDoHDwVN2tF';
  if (!_spState.uri) _spState = { uri: defaultUri, paused: true, position: 0 };
  if (!_spController) {
    const holder = document.getElementById('sp-embed');
    if (api) {
      holder.innerHTML = '<div id="sp-embed-inner"></div>';
      api.createController(document.getElementById('sp-embed-inner'),
        { uri: defaultUri, width: '100%', height: 352 },
        ctrl => {
          _spController = ctrl;
          _spLoad(_spState.uri);
          ctrl.addListener('playback_update', e => {
            if (!e || !e.data || !_spAmController() || _spSuppress) return;
            _spState.paused = !!e.data.isPaused;
            _spState.position = Math.floor((e.data.position || 0) / 1000);
            _spBroadcast();
          });
        });
      setTimeout(() => { if (!_spController && _mediaKind === 'sp') _spRenderFallback(defaultUri); }, 6000);
    } else {
      _spRenderFallback(defaultUri);
    }
  }
  clearInterval(_mediaTimer);
  _mediaTimer = setInterval(() => { if (_spAmController() && _spState.uri) _spBroadcast(); }, 5000);
}

function _spBroadcast() {
  _mediaSend('sp-state', { uri: _spState.uri, paused: _spState.paused, position: _spState.position, ts: Date.now() });
}

function _spApply(p) {
  if (!p || !p.uri) return;
  if (!_spController) {
    if (_spState.uri !== p.uri) { _spState.uri = p.uri; _spRenderFallback(p.uri); }
    return;
  }
  _spSuppress = true;
  if (_spState.uri !== p.uri) {
    _spState.uri = p.uri;
    _spController.loadUri(p.uri);
  }
  if (!p.paused) {
    const pos = (p.position || 0) + (Date.now() - (p.ts || Date.now())) / 1000;
    _spController.seek(Math.max(0, Math.floor(pos)));
    _spController.resume ? _spController.resume() : _spController.play();
  } else {
    _spController.pause();
  }
  setTimeout(() => { _spSuppress = false; }, 1500);
}

window.spLoadUri = function() {
  if (!_spAmController()) return;
  const input = document.getElementById('sp-url-input');
  const uri = _spParseUri(input?.value);
  if (!uri) { _mediaToast('Invalid Spotify link.'); return; }
  _spState = { uri, paused: false, position: 0 };
  _spLoad(uri);
  if (_spController) setTimeout(() => _spController.play(), 800);
  input.value = '';
  setTimeout(_spBroadcast, 1000);
};

window.spClaimControl = async function() {
  if (getViewerRoleLevel() < 3) return;
  _mediaClaimed = true;
  await _spTrack();
  _spRefreshUi();
};

window.spSyncNow = function() {
  if (_spController && _spState.uri) _spController.play();
  _mediaSend('sp-request', {});
};

window.enterMediaRoom = enterMediaRoom;
window.exitMediaRoom = exitMediaRoom;


window.enterBrowserRoom = function() { if (window.BrowserRoom) window.BrowserRoom.enter(); };


function enterBrowserRoom() {
  if (window.BrowserRoom && typeof window.BrowserRoom.enter === 'function') {
    window.BrowserRoom.enter();
  }
}
window.enterBrowserRoom = enterBrowserRoom;
