const pmWindows = {};
const pmMuted = {};
const pmTextHistory = {};
const pmVoiceUrls = {};
const pmRecorders = {};
const pmCallState = {};
let pmChannel = null;
let pmTableAvailable = null;
let pmAudioCtx = null;

// Track open private chat users for the private chat tab bar
const pvtOpenUsers = new Map(); // userId -> username
let activePmUserId = null;
let pmDragState = null;

function ensurePmDockedRoot() {
  const root = document.getElementById('pm-root');
  if (!root) return root;
  if (!root.querySelector('.pm-popup-shell')) {
    root.innerHTML = `
      <div class="pm-popup-shell">
        <div class="pm-popup-tabs hidden" id="pm-popup-tabs" aria-label="Open private chats"></div>
        <div class="pm-popup-stage" id="pm-popup-stage"></div>
      </div>
    `;
  }
  root.classList.toggle('hidden', Object.keys(pmWindows).length === 0);
  return root;
}

function stopPmRealtime() {
  if (!pmChannel) return;
  sbClient.removeChannel(pmChannel);
  pmChannel = null;
}



function refreshPmIgnoreState(targetUserId = null) {
  const userIds = targetUserId ? [targetUserId] : Object.keys(pmWindows);
  userIds.forEach((userId) => {
    const win = pmWindows[userId];
    if (!win) return;
    const ignored = typeof isUserIgnored === 'function' && isUserIgnored(userId);
    win.el.classList.toggle('pm-window-ignored', ignored);
    const ignoreBtn = win.el.querySelector('.pm-ignore-btn');
    if (ignoreBtn) {
      ignoreBtn.textContent = ignored ? 'Unignore' : 'Ignore';
      ignoreBtn.title = ignored ? 'Allow incoming private messages again' : 'Ignore incoming private messages';
    }
    renderPmTextHistory(userId);
  });
}



function renderPvtBar() {
  const legacyBar = document.getElementById('rooms-topbar');
  if (legacyBar) {
    legacyBar.innerHTML = '';
    legacyBar.classList.add('hidden');
  }
  const bar = document.getElementById('pm-popup-tabs');
  if (!bar) return;
  bar.innerHTML = '';
  if (pvtOpenUsers.size === 0) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  pvtOpenUsers.forEach((username, userId) => {
    const meta = pmWindows[userId];
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'private-chat-tab'
      + (activePmUserId === userId && !meta?.minimized ? ' active' : '')
      + (meta?.minimized ? ' minimized' : '');
    item.onclick = () => restorePrivateChat(userId);

    const name = document.createElement('span');
    name.className = 'private-chat-tab-name';
    name.textContent = username;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'private-chat-tab-close';
    closeBtn.setAttribute('aria-label', `Close private chat with ${username}`);
    closeBtn.textContent = 'x';
    closeBtn.onclick = (event) => {
      event.stopPropagation();
      closePrivateChat(userId);
    };

    item.append(name, closeBtn);
    bar.appendChild(item);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  ensurePmDockedRoot();
  setTimeout(() => { ensurePmRealtime(); }, 600);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !activePmUserId) return;
  closePrivateChat(activePmUserId);
});

document.addEventListener('click', (event) => {
  Object.keys(pmWindows).forEach(userId => {
    const row = getPmImageRow(userId);
    const btn = pmWindows[userId]?.el.querySelector('.pm-image-btn');
    if (!row || row.classList.contains('hidden')) return;
    if (row.contains(event.target) || btn?.contains(event.target)) return;
    closePmImageInput(userId);
  });
});

window.ensurePmRealtime = ensurePmRealtime;

async function ensurePmRealtime() {
  if (typeof enforceCurrentUserModerationState === 'function') {
    const allowed = await enforceCurrentUserModerationState({ refresh: true });
    if (!allowed) return;
  }
  if (!currentUser?.id || pmChannel) return;

  pmChannel = sbClient.channel('pm-global');
  pmChannel
    .on('broadcast', { event: 'private-message' }, ({ payload }) => {
      if (!payload || payload.to !== currentUser.id) return;
      handleIncomingPm(payload);
    })
    .on('broadcast', { event: 'pm-voice-offer' }, ({ payload }) => {
      handlePmVoiceOffer(payload);
    })
    .on('broadcast', { event: 'pm-voice-answer' }, ({ payload }) => {
      handlePmVoiceAnswer(payload);
    })
    .on('broadcast', { event: 'pm-voice-ice' }, ({ payload }) => {
      handlePmVoiceIce(payload);
    })
    .on('broadcast', { event: 'pm-voice-hangup' }, ({ payload }) => {
      handlePmVoiceHangup(payload);
    })
    .subscribe();
}

async function openPrivateChat(userId, username) {
  if (!userId || !currentUser?.id || userId === currentUser.id) return;
  // Guests can RECEIVE/reply to PMs but cannot initiate new ones
  if (!currentProfile?.is_registered) {
    // Only allow opening if it was triggered by an incoming PM (caller passes fromIncoming=true)
    // or if a window already exists
    if (!pmWindows[userId] && !openPrivateChat._allowedForGuest) {
      if (typeof showChatToast === 'function') {
        showChatToast('Register to start private chats. You can reply to messages sent to you.', 'info');
      }
      return;
    }
  }
  await ensurePmRealtime();

  if (pmWindows[userId]) {
    restorePrivateChat(userId);
    return;
  }

  pvtOpenUsers.set(userId, username || getUsernameById(userId));
  activePmUserId = userId;
  renderPvtBar();

  // Close mobile sidebars so PM window is visible
  if (typeof closeAllSidebars === 'function') closeAllSidebars();
  if (typeof switchMobileTab === 'function') switchMobileTab('chat');

  const root = ensurePmDockedRoot();
  if (!root) return;
  const stage = document.getElementById('pm-popup-stage');
  if (!stage) return;
  const displayName = username || getUsernameById(userId);
  const avatarLetter = escHtml((displayName || '?').trim().charAt(0).toUpperCase() || '?');

  const wrap = document.createElement('div');
  wrap.className = 'pm-window';
  wrap.dataset.userId = userId;
  wrap.innerHTML = `
    <div class="pm-header">
      <div class="pm-title-wrap">
        <div class="pm-avatar" aria-hidden="true">${avatarLetter}</div>
        <div class="pm-title-copy">
          <span class="pm-title">${escHtml(displayName)}</span>
          <span class="pm-subtitle">Private message</span>
        </div>
      </div>
      <div class="pm-header-actions">
        <label class="pm-receipts-toggle" title="Send read and listen receipts">
          <input type="checkbox" class="pm-receipt-toggle-input" checked>
          <span>Receipts</span>
        </label>
        <button type="button" class="pm-call-btn" title="Start voice call">Call</button>
        <button type="button" class="pm-ignore-btn" title="Ignore incoming private messages">${typeof isUserIgnored === 'function' && isUserIgnored(userId) ? 'Unignore' : 'Ignore'}</button>
        <button type="button" class="pm-mute-btn" title="Toggle PM notification sound">${pmMuted[userId] ? 'Muted' : 'Sound'}</button>
        <button type="button" class="pm-minimize-btn" title="Minimize PM">_</button>
        <button type="button" class="pm-close-btn" title="Close PM">✕</button>
      </div>
    </div>
    <div class="pm-call-banner hidden">
      <span>📞 Incoming call</span>
      <button type="button" class="pm-call-accept">Accept</button>
      <button type="button" class="pm-call-decline">Decline</button>
    </div>
    <div class="pm-call-active hidden">
      <span class="pm-call-active-text">📞 In call</span>
      <button type="button" class="pm-call-end">End Call</button>
    </div>
    <div class="pm-messages"></div>
    <div class="pm-recording-row hidden" style="display: none; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(0,0,0,0.15); border-radius: 8px; margin-top: 5px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <span class="blinking-dot pm-rec-blinking-dot" style="color: #ef4444; font-size: 12px; animation: blinker 1s linear infinite;">🔴</span>
        <span class="pm-rec-timer-display" style="font-family: monospace; font-size: 13px; color: var(--text); font-weight: bold;">00:00</span>
        <span class="pm-rec-status-text" style="font-size: 0.75rem; color: var(--muted); margin-left: 4px;">Recording...</span>
        <button type="button" class="pm-rec-playback-play hidden" style="background: var(--accent); color: white; border: none; border-radius: 4px; padding: 1px 6px; cursor: pointer; font-size: 0.7rem; display: none;">▶ Play</button>
        <audio class="pm-rec-playback-audio hidden" style="display: none;"></audio>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <button type="button" class="pm-rec-discard-btn" title="Discard" style="font-size: 1.1rem; background: transparent; border: none; cursor: pointer; padding: 2px;">🗑️</button>
        <button type="button" class="pm-rec-preview-btn" title="Stop & Preview" style="font-size: 1.1rem; background: transparent; border: none; cursor: pointer; padding: 2px;">⏹️</button>
        <button type="button" class="pm-rec-send-btn" title="Send" style="font-size: 1.1rem; background: transparent; border: none; cursor: pointer; padding: 2px;">📤</button>
      </div>
    </div>
    <div class="pm-image-url-row hidden">
      <input class="pm-image-url-input" type="text" maxlength="1000" placeholder="Paste an image/GIF URL…" autocomplete="off"/>
      <button type="button" class="media-url-clear pm-image-url-clear" title="Cancel image URL">✕</button>
    </div>
    <div class="pm-toolbar">
      <button type="button" class="pm-emoji-btn" title="Emoji">😀</button>
      <button type="button" class="pm-image-btn" title="Share image/GIF by URL">🖼️</button>
      <button type="button" class="pm-record-btn" title="Record voice message">🎙️</button>
      <button type="button" class="pm-game-btn" title="Play a game">🎮</button>
    </div>
    <div class="pm-input-row">
      <input class="pm-input" type="text" maxlength="500" placeholder="Type a private message…"/>
      <button type="button" class="pm-send-btn">Send</button>
    </div>
  `;

  stage.appendChild(wrap);
  // Add corner resize handles
  ['tl','tr','bl','br'].forEach(corner => {
    const handle = document.createElement('div');
    handle.className = 'pm-resizer pm-resizer-' + corner;
    wrap.appendChild(handle);
  });
  pmWindows[userId] = {
    el: wrap,
    userId,
    username: displayName,
    minimized: false,
    left: 0,
    top: 0
  };

  const input = wrap.querySelector('.pm-input');
  const sendBtn = wrap.querySelector('.pm-send-btn');
  const closeBtn = wrap.querySelector('.pm-close-btn');
  const minimizeBtn = wrap.querySelector('.pm-minimize-btn');
  const muteBtn = wrap.querySelector('.pm-mute-btn');
  const recordBtn = wrap.querySelector('.pm-record-btn');
  const emojiBtn = wrap.querySelector('.pm-emoji-btn');
  const imageBtn = wrap.querySelector('.pm-image-btn');
  const imageInput = wrap.querySelector('.pm-image-url-input');
  const imageClearBtn = wrap.querySelector('.pm-image-url-clear');
  const callBtn = wrap.querySelector('.pm-call-btn');
  const ignoreBtn = wrap.querySelector('.pm-ignore-btn');
  const acceptBtn = wrap.querySelector('.pm-call-accept');
  const declineBtn = wrap.querySelector('.pm-call-decline');
  const endCallBtn = wrap.querySelector('.pm-call-end');

  sendBtn.onclick = () => sendPrivateText(userId);
  input.onkeydown = (e) => {
    if (e.key === 'Enter') sendPrivateText(userId);
  };

  minimizeBtn.onclick = () => minimizePrivateChat(userId);
  closeBtn.onclick = () => closePrivateChat(userId);
  muteBtn.onclick = () => {
    pmMuted[userId] = !pmMuted[userId];
    muteBtn.textContent = pmMuted[userId] ? 'Muted' : 'Sound';
  };
  ignoreBtn.onclick = () => {
    if (typeof setUserIgnored !== 'function') return;
    setUserIgnored(userId, !(typeof isUserIgnored === 'function' && isUserIgnored(userId)));
    refreshPmIgnoreState(userId);
  };

  recordBtn.onclick = () => togglePmVoiceNoteRecording(userId);
  // Cancel context menu on long press on mobile
  recordBtn.addEventListener('contextmenu', e => e.preventDefault());

  imageBtn.onclick = (event) => {
    event.stopPropagation();
    togglePmImageInput(userId);
  };
  imageClearBtn.onclick = (event) => {
    event.stopPropagation();
    closePmImageInput(userId);
  };
  imageInput.onkeydown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendPrivateText(userId);
      return;
    }
    if (event.key === 'Escape') closePmImageInput(userId);
  };
  if (emojiBtn && typeof toggleEmojiPicker === 'function') {
    emojiBtn.onclick = (e) => toggleEmojiPicker(e, input);
  }
  const gameBtn = wrap.querySelector('.pm-game-btn');
  if (gameBtn) {
    gameBtn.onclick = (e) => {
      e.stopPropagation();
      if (typeof toggleGamePicker === 'function') toggleGamePicker(userId, gameBtn);
    };
  }
  callBtn.onclick = () => startPmVoiceCall(userId);
  acceptBtn.onclick = () => acceptPmVoiceCall(userId);
  declineBtn.onclick = () => declinePmVoiceCall(userId);
  endCallBtn.onclick = () => endPmVoiceCall(userId);

  if (!currentProfile?.is_registered) {
    recordBtn.style.display = 'none';
    callBtn.style.display = 'none';
  }

  enablePmDragging(userId);
  enablePmResizing(userId);
  setInitialPmWindowPosition(userId);
  renderPmTextHistory(userId);
  refreshPmIgnoreState(userId);
  updatePmCallUi(userId);
  positionPmWindows();

  if (pmTableAvailable !== false && currentProfile?.is_registered) {
    await loadPmHistoryFromDb(userId);
  }

  // Show a soft notice for guests so they know they're in reply-only mode
  if (!currentProfile?.is_registered) {
    const box = getPmMessagesBox(userId);
    if (box) {
      const notice = document.createElement('div');
      notice.className = 'pm-guest-notice';
      notice.innerHTML = `🔓 Guest mode — you can reply to this message. <a href="login.html" style="color:var(--accent);text-decoration:underline">Register</a> for full private chat.`;
      box.prepend(notice);
    }
  }
}

/**
 * Opens a PM window for an INCOMING message.
 * Temporarily allows the window to open for guests, then clears the flag.
 */
async function openPrivateChatIncoming(userId, username) {
  openPrivateChat._allowedForGuest = true;
  try {
    await openPrivateChat(userId, username);
  } finally {
    openPrivateChat._allowedForGuest = false;
  }
}

function focusPmWindow(userId) {
  const item = pmWindows[userId];
  if (!item) return;
  item.minimized = false;
  activePmUserId = userId;
  renderPvtBar();
  positionPmWindows();
  item.el.classList.add('pulse');
  setTimeout(() => item.el.classList.remove('pulse'), 250);
  item.el.querySelector('.pm-input')?.focus();
  if (typeof handlePmRestore === 'function') handlePmRestore(userId);
}

function restorePrivateChat(userId) {
  if (!pmWindows[userId]) return;
  focusPmWindow(userId);
}

function minimizePrivateChat(userId) {
  const item = pmWindows[userId];
  if (!item) return;
  item.minimized = true;
  if (activePmUserId === userId) {
    activePmUserId = Array.from(pvtOpenUsers.keys()).find((id) => id !== userId && !pmWindows[id]?.minimized) || null;
  }
  renderPvtBar();
  positionPmWindows();
  if (typeof handlePmMinimize === 'function') handlePmMinimize(userId);
}

function closePrivateChat(userId) {
  const win = pmWindows[userId];
  if (!win) return;

  endPmVoiceCall(userId, false);

  if (pmRecorders[userId]?.state === 'recording') {
    pmRecorders[userId].stop();
  }
  delete pmRecorders[userId];

  cleanupPmVoiceUrls(userId);
  win.el.remove();
  delete pmWindows[userId];
  delete pmCallState[userId];
  pvtOpenUsers.delete(userId);
  activePmUserId = activePmUserId === userId ? (pvtOpenUsers.keys().next().value || null) : activePmUserId;
  renderPvtBar();
  positionPmWindows();
  if (typeof handlePmClose === 'function') handlePmClose(userId);
}

function positionPmWindows() {
  const root = ensurePmDockedRoot();
  if (root) root.classList.toggle('hidden', Object.keys(pmWindows).length === 0);
  Object.entries(pmWindows).forEach(([userId, win]) => {
    const active = userId === activePmUserId && !win.minimized;
    win.el.classList.toggle('active', active);
    win.el.classList.toggle('hidden', !active);
    win.el.style.left = `${win.left}px`;
    win.el.style.top = `${win.top}px`;
    if (typeof syncGameWindowPosition === 'function') {
      syncGameWindowPosition(userId, win.left, win.top, active);
    }
  });
}

function getPmBounds() {
  const stage = document.getElementById('pm-popup-stage');
  const rect = stage?.getBoundingClientRect();
  return rect || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

function clampPmPosition(userId) {
  const item = pmWindows[userId];
  if (!item) return;
  const bounds = getPmBounds();
  const rect = item.el.getBoundingClientRect();
  const maxLeft = Math.max(12, bounds.width - rect.width - 12);
  const maxTop = Math.max(12, bounds.height - rect.height - 12);
  item.left = Math.min(Math.max(12, item.left), maxLeft);
  item.top = Math.min(Math.max(12, item.top), maxTop);
}

function setInitialPmWindowPosition(userId) {
  const item = pmWindows[userId];
  if (!item) return;
  const chatMain = document.querySelector('.chat-main')?.getBoundingClientRect();
  const roster = document.getElementById('sidebar-right')?.getBoundingClientRect();
  const fallbackLeft = chatMain ? Math.max(12, chatMain.left + 12) : Math.max(12, window.innerWidth * 0.24);
  const fallbackTop = chatMain ? Math.max(72, chatMain.top + 18) : 110;
  item.left = roster ? Math.max(12, roster.left - 340) : fallbackLeft;
  item.top = fallbackTop;
  requestAnimationFrame(() => {
    clampPmPosition(userId);
    positionPmWindows();
  });
}

function enablePmDragging(userId) {
  const item = pmWindows[userId];
  const header = item?.el.querySelector('.pm-header');
  if (!item || !header) return;

  header.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('button, input, textarea, a')) return;
    const rect = item.el.getBoundingClientRect();
    pmDragState = {
      userId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    item.el.setPointerCapture?.(event.pointerId);
    header.classList.add('dragging');
    event.preventDefault();
  });
}

document.addEventListener('pointermove', (event) => {
  if (!pmDragState) return;
  const item = pmWindows[pmDragState.userId];
  if (!item) return;
  const bounds = getPmBounds();
  item.left = event.clientX - bounds.left - pmDragState.offsetX;
  item.top = event.clientY - bounds.top - pmDragState.offsetY;
  clampPmPosition(pmDragState.userId);
  positionPmWindows();
});

document.addEventListener('pointerup', () => {
  if (!pmDragState) return;
  const item = pmWindows[pmDragState.userId];
  item?.el.querySelector('.pm-header')?.classList.remove('dragging');
  pmDragState = null;
});

function enablePmResizing(userId) {
  const item = pmWindows[userId];
  if (!item) return;
  const handles = item.el.querySelectorAll('.pm-resizer');
  handles.forEach(handle => {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = item.el.getBoundingClientRect();
      const isTL = handle.classList.contains('pm-resizer-tl');
      const isTR = handle.classList.contains('pm-resizer-tr');
      const isBL = handle.classList.contains('pm-resizer-bl');
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = rect.width;
      const startH = rect.height;
      const startL = item.left;
      const startT = item.top;
      const MIN_W = 260;
      const MIN_H = 200;
      const MAX_W = 600;
      const MAX_H = window.innerHeight * 0.8;

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let newW = startW, newH = startH, newL = startL, newT = startT;

        if (isTL) {
          newW = Math.min(MAX_W, Math.max(MIN_W, startW - dx));
          newH = Math.min(MAX_H, Math.max(MIN_H, startH - dy));
          newL = startL + (startW - newW);
          newT = startT + (startH - newH);
        } else if (isTR) {
          newW = Math.min(MAX_W, Math.max(MIN_W, startW + dx));
          newH = Math.min(MAX_H, Math.max(MIN_H, startH - dy));
          newT = startT + (startH - newH);
        } else if (isBL) {
          newW = Math.min(MAX_W, Math.max(MIN_W, startW - dx));
          newH = Math.min(MAX_H, Math.max(MIN_H, startH + dy));
          newL = startL + (startW - newW);
        } else {
          newW = Math.min(MAX_W, Math.max(MIN_W, startW + dx));
          newH = Math.min(MAX_H, Math.max(MIN_H, startH + dy));
        }

        item.el.style.width = newW + 'px';
        item.el.style.maxWidth = newW + 'px';
        item.el.style.maxHeight = newH + 'px';
        item.left = newL;
        item.top = newT;
        positionPmWindows();
      }

      function onUp() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  });
}

window.addEventListener('resize', () => {
  Object.keys(pmWindows).forEach((userId) => clampPmPosition(userId));
  positionPmWindows();
});

function getPmInput(userId) {
  return pmWindows[userId]?.el.querySelector('.pm-input');
}

function getPmMessagesBox(userId) {
  return pmWindows[userId]?.el.querySelector('.pm-messages');
}

function getPmImageRow(userId) {
  return pmWindows[userId]?.el.querySelector('.pm-image-url-row');
}

function getPmImageInput(userId) {
  return pmWindows[userId]?.el.querySelector('.pm-image-url-input');
}

function closePmImageInput(userId, clearValue = true) {
  const row = getPmImageRow(userId);
  const input = getPmImageInput(userId);
  if (row) row.classList.add('hidden');
  if (clearValue && input) input.value = '';
}

function togglePmImageInput(userId) {
  const row = getPmImageRow(userId);
  const input = getPmImageInput(userId);
  if (!row || !input) return;
  if (!row.classList.contains('hidden')) {
    closePmImageInput(userId);
    return;
  }
  row.classList.remove('hidden');
  input.focus();
}

async function sendPrivateText(userId) {
  // Stealth Mode send warning
  if (window._stealthModeActive) {
    const confirmSend = confirm("⚠️ Caution: You are currently in Stealth Mode. Other users cannot see you in the room. Are you sure you want to send this message?");
    if (!confirmSend) return;
  }

  if (typeof enforceCurrentUserModerationState === 'function') {
    const allowed = await enforceCurrentUserModerationState({ refresh: true });
    if (!allowed) return;
  }
  // Guests can send replies ONLY inside an already-open PM window (received from a registered user)
  if (!currentProfile?.is_registered) {
    if (!pmWindows[userId]) {
      if (typeof showChatToast === 'function') showChatToast('🔒 Register to send private messages.', 'info');
      return;
    }
    // Allowed: guest is replying inside an open PM window — fall through
  }
  const input = getPmInput(userId);
  if (!input) return;
  const text = input.value.trim();

  // YouTube sharing limits (registered only, 1 per minute)
  const ytCheck = window.checkYouTubeSharingLimit ? window.checkYouTubeSharingLimit(text) : { ok: true };
  if (!ytCheck.ok) {
    if (typeof showChatToast === 'function') showChatToast('⚠️ ' + ytCheck.reason, 'warning');
    return;
  }

  const rawImageUrl = getPmImageInput(userId)?.value.trim() || '';
  const imageUrl = rawImageUrl ? normalizeImageUrl(rawImageUrl) : '';
  const isSendingImage = !getPmImageRow(userId)?.classList.contains('hidden') && !!rawImageUrl;
  if (!text && !isSendingImage) return;
  if (isSendingImage && !imageUrl) {
    if (typeof showChatToast === 'function') showChatToast('Enter a valid http(s) image/GIF URL.', 'warning');
    getPmImageInput(userId)?.focus();
    return;
  }

  const createdAt = new Date().toISOString();
  const msgId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

  // ── Security: validate & sanitise PM text before sending ──
  let safeText = text;
  if (!isSendingImage) {
    const validation = window.ccValidatePmText ? window.ccValidatePmText(text) : { ok: true };
    if (!validation.ok) {
      if (typeof showChatToast === 'function') showChatToast('⚠️ ' + validation.reason, 'warning');
      return;
    }
    safeText = validation.sanitised ?? (window.ccSanitize ? window.ccSanitize.chatText(text, 500) : text);
  }

  if (!isSendingImage) input.value = '';

  const message = isSendingImage
    ? { id: msgId, from: currentUser.id, type: 'image', imageUrl, createdAt }
    : { id: msgId, from: currentUser.id, type: 'text', text: safeText, createdAt };
  appendPmHistoryMessage(userId, message, true);

  if (!pmTextHistory[userId]) pmTextHistory[userId] = [];
  pmTextHistory[userId].push(message);

  await sendPmBroadcast(isSendingImage ? { to: userId, type: 'image', imageUrl, id: msgId } : { to: userId, type: 'text', text: safeText, id: msgId });
  // Registered users also persist to DB for history
  if (currentProfile?.is_registered) {
    await persistPmToDb(userId, isSendingImage ? imageUrl : safeText, isSendingImage ? 'image' : 'text');
  }
  if (isSendingImage) {
    closePmImageInput(userId);
    if (typeof showChatToast === 'function') showChatToast('Image/GIF sent in private message.', 'success');
  }
}

async function handleIncomingPm(payload) {
  // Guests CAN receive PMs from registered users
  const fromUserId = payload.from;
  if (!fromUserId) return;
  if (typeof canProcessIncomingPayload === 'function' && !canProcessIncomingPayload(fromUserId)) return;

  const username = payload.username || getUsernameById(fromUserId);

  // For guests: temporarily set the flag to allow the PM window to open for incoming messages
  if (!currentProfile?.is_registered) {
    openPrivateChat._allowedForGuest = true;
  }
  await openPrivateChatIncoming(fromUserId, username);

  if (payload.type && payload.type.startsWith('game_')) {
    const handler = window.handleIncomingGameEvent || (typeof handleIncomingGameEvent === 'function' ? handleIncomingGameEvent : null);
    if (handler) {
      handler(payload);
    } else {
      console.error('[GameEngine] handleIncomingGameEvent is not defined on window or in global scope!');
    }
    return;
  }

  if (payload.type === 'receipt' && payload.id) {
    const receiptEl = document.querySelector(`.pm-receipt-${payload.id}`);
    if (receiptEl) {
      receiptEl.textContent = payload.receiptType === 'listened' ? '🎙️✓✓' : '✓✓';
      receiptEl.classList.add('read');
    }
    return;
  }

  if (['text', 'image', 'voice'].includes(payload.type) && payload.id) {
    if (activePmUserId === fromUserId) {
       const toggle = pmWindows[fromUserId]?.el.querySelector('.pm-receipt-toggle-input');
       if (!toggle || toggle.checked) {
         sendPmBroadcast({ to: fromUserId, type: 'receipt', id: payload.id, receiptType: 'read' });
       }
    }
  }

  if (payload.type === 'voice' && payload.voiceDataUrl) {
    const blob = dataUrlToBlob(payload.voiceDataUrl);
    const url = URL.createObjectURL(blob);
    appendPmVoiceMessage(fromUserId, { id: payload.id, from: fromUserId, audioUrl: url }, false);
    trackPmVoiceUrl(fromUserId, url);
    playPmNotification(fromUserId);
    return;
  }

  if (payload.type === 'image') {
    const createdAt = payload.createdAt || new Date().toISOString();
    const message = { id: payload.id, from: fromUserId, type: 'image', imageUrl: payload.imageUrl || '', createdAt };
    appendPmHistoryMessage(fromUserId, message, false);
    if (!pmTextHistory[fromUserId]) pmTextHistory[fromUserId] = [];
    pmTextHistory[fromUserId].push(message);
    playPmNotification(fromUserId);
    return;
  }

  if (payload.type === 'text') {
    const createdAt = payload.createdAt || new Date().toISOString();
    const message = { id: payload.id, from: fromUserId, type: 'text', text: payload.text || '', createdAt };
    appendPmHistoryMessage(fromUserId, message, false);

    if (!pmTextHistory[fromUserId]) pmTextHistory[fromUserId] = [];
    pmTextHistory[fromUserId].push(message);
    playPmNotification(fromUserId);
  }
}

function appendPmTextMessage(userId, msg, isMe) {
  const box = getPmMessagesBox(userId);
  if (!box) return;

  const row = document.createElement('div');
  row.className = 'pm-msg' + (isMe ? ' self' : '');
  if (msg.id) row.dataset.msgId = msg.id;
  const receiptHtml = isMe && msg.id ? `<span class="pm-receipt-status pm-receipt-${msg.id}">✓</span>` : '';
  const formattedText = window.parseYouTubeEmbedHtml ? window.parseYouTubeEmbedHtml(escHtml(msg.text || '')) : escHtml(msg.text || '');
  row.innerHTML = `
    <div class="pm-msg-bubble">${formattedText}</div>
    <div class="pm-msg-time">${formatTime(msg.createdAt)} ${receiptHtml}</div>
  `;

  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

function appendPmImageMessage(userId, msg, isMe) {
  const box = getPmMessagesBox(userId);
  if (!box) return;

  const imageSrc = normalizeImageUrl(msg.imageUrl || '');
  const row = document.createElement('div');
  row.className = 'pm-msg pm-image' + (isMe ? ' self' : '');
  if (msg.id) row.dataset.msgId = msg.id;
  const receiptHtml = isMe && msg.id ? `<span class="pm-receipt-status pm-receipt-${msg.id}">✓</span>` : '';
  row.innerHTML = `
    <div class="pm-msg-bubble">
      ${imageSrc
        ? `
          <img class="pm-inline-image" src="${escHtml(imageSrc)}" alt="Shared image"/>
          <div class="pm-image-error hidden">⚠️ Image could not be loaded.</div>
          <a class="pm-image-link" href="${escHtml(imageSrc)}" target="_blank" rel="noopener noreferrer">Open image</a>
        `
        : '<div class="pm-image-error">⚠️ Invalid image URL.</div>'}
    </div>
    <div class="pm-msg-time">${formatTime(msg.createdAt)} ${receiptHtml}</div>
  `;

  const image = row.querySelector('.pm-inline-image');
  const error = row.querySelector('.pm-image-error');
  image?.addEventListener('error', () => {
    image.remove();
    if (error) error.classList.remove('hidden');
  }, { once: true });

  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

function appendPmHistoryMessage(userId, msg, isMe) {
  if (msg.type === 'image') {
    appendPmImageMessage(userId, msg, isMe);
    return;
  }
  appendPmTextMessage(userId, msg, isMe);
}

function appendPmVoiceMessage(userId, msg, isMe) {
  const box = getPmMessagesBox(userId);
  if (!box) return;

  // FIX 2 — Lock voice notes for guest users
  const audioHtml = currentProfile?.is_registered
    ? `<audio controls src="${msg.audioUrl}"></audio>`
    : '<span class="vn-locked">\uD83D\uDD12 Register to hear voice notes</span>';

  const row = document.createElement('div');
  row.className = 'pm-msg pm-voice' + (isMe ? ' self' : '');
  if (msg.id) row.dataset.msgId = msg.id;
  const receiptHtml = isMe && msg.id ? `<span class="pm-receipt-status pm-receipt-${msg.id}">✓</span>` : '';
  const voiceMarkup = currentProfile?.is_registered
    ? `<audio controls preload="none" src="${escHtml(msg.audioUrl || '')}"></audio>`
    : '🔒 Voice notes are for registered users only.';
  row.innerHTML = `
    <div class="pm-msg-bubble">${voiceMarkup}</div>
    <div class="pm-msg-time">${formatTime(msg.createdAt || new Date().toISOString())} ${receiptHtml}</div>
  `;
  
  if (!isMe && msg.id && currentProfile?.is_registered) {
    const audio = row.querySelector('audio');
    if (audio) {
      audio.addEventListener('play', () => {
        const toggle = pmWindows[userId]?.el.querySelector('.pm-receipt-toggle-input');
        if (!toggle || toggle.checked) {
          sendPmBroadcast({ to: userId, type: 'receipt', id: msg.id, receiptType: 'listened' });
        }
      }, { once: true });
    }
  }

  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

function renderPmTextHistory(userId) {
  const box = getPmMessagesBox(userId);
  if (!box) return;
  box.innerHTML = '';
  const ignored = typeof isUserIgnored === 'function' && isUserIgnored(userId);

  (pmTextHistory[userId] || []).forEach(msg => {
    if (ignored && msg.from === userId) return;
    appendPmHistoryMessage(userId, msg, msg.from === currentUser.id);
  });
}

let pmVoiceTimers = {};
let pmVoiceSeconds = {};
let pmVoiceBlobs = {};
let pmVoicePreviewMode = {};
let pmAutoSendOnStop = {};
let pmDiscardOnStop = {};

function togglePmVoiceNoteRecording(userId) {
  const recorder = pmRecorders[userId];
  if (recorder && recorder.state === 'recording') {
    recorder.stop();
  } else {
    startPmVoiceNoteRecording(null, userId);
  }
}

function resetPmInputState(userId) {
  const wrap = pmWindows[userId]?.el;
  if (!wrap) return;

  clearInterval(pmVoiceTimers[userId]);
  delete pmVoiceTimers[userId];
  delete pmVoiceSeconds[userId];
  delete pmVoiceBlobs[userId];
  delete pmVoicePreviewMode[userId];
  delete pmAutoSendOnStop[userId];
  delete pmDiscardOnStop[userId];
  delete pmRecorders[userId];

  const normalToolbar = wrap.querySelector('.pm-toolbar');
  const normalInputRow = wrap.querySelector('.pm-input-row');
  const recRow = wrap.querySelector('.pm-recording-row');

  if (normalToolbar) {
    normalToolbar.classList.remove('hidden');
    normalToolbar.style.display = 'flex';
  }
  if (normalInputRow) {
    normalInputRow.classList.remove('hidden');
    normalInputRow.style.display = 'flex';
  }
  if (recRow) {
    recRow.classList.add('hidden');
    recRow.style.display = 'none';
    const playbackAudio = recRow.querySelector('.pm-rec-playback-audio');
    if (playbackAudio) {
      playbackAudio.pause();
      playbackAudio.src = '';
    }
  }
}

async function sendPmVoiceNoteDirectly(userId, blob) {
  let finalBlob = blob;
  if (typeof compressVoiceNote === 'function') {
    finalBlob = await compressVoiceNote(blob);
  }
  
  const reader = new FileReader();
  reader.readAsDataURL(finalBlob);
  reader.onloadend = async () => {
    const base64data = reader.result;
    
    // Create local UI message first
    const createdAt = new Date().toISOString();
    const msgId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const localAudioUrl = URL.createObjectURL(finalBlob);
    
    trackPmVoiceUrl(userId, localAudioUrl);
    
    const msg = { id: msgId, from: currentUser.id, type: 'voice', audioUrl: localAudioUrl, createdAt };
    appendPmVoiceMessage(userId, msg, true);
    
    if (!pmTextHistory[userId]) pmTextHistory[userId] = [];
    pmTextHistory[userId].push(msg);

    // Send via db/broadcast
    await sendPmBroadcast({ to: userId, type: 'voice', voiceDataUrl: base64data, createdAt, id: msgId });
    if (typeof sendPrivateMessage === 'function') {
      await sendPrivateMessage(userId, base64data, 'voice');
    }
    resetPmInputState(userId);
  };
}

async function startPmVoiceNoteRecording(e, userId) {
  if (!currentProfile?.is_registered) {
    if (typeof showChatToast === 'function') showChatToast('Voice notes are available for registered users only.', 'warning');
    return;
  }

  const wrap = pmWindows[userId]?.el;
  if (!wrap) return;

  const normalToolbar = wrap.querySelector('.pm-toolbar');
  const normalInputRow = wrap.querySelector('.pm-input-row');
  const recRow = wrap.querySelector('.pm-recording-row');
  
  if (!normalToolbar || !normalInputRow || !recRow) return;

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    if (typeof showChatToast === 'function') showChatToast('Voice recording is not supported in this browser.', 'warning');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    const mediaRecorder = new MediaRecorder(stream);
    pmRecorders[userId] = mediaRecorder;
    pmDiscardOnStop[userId] = false;
    pmAutoSendOnStop[userId] = false;
    pmVoicePreviewMode[userId] = false;
    pmVoiceBlobs[userId] = null;

    normalToolbar.classList.add('hidden');
    normalToolbar.style.display = 'none';
    normalInputRow.classList.add('hidden');
    normalInputRow.style.display = 'none';
    recRow.classList.remove('hidden');
    recRow.style.display = 'flex';

    recRow.querySelector('.pm-rec-timer-display').textContent = '00:00';
    recRow.querySelector('.pm-rec-status-text').textContent = 'Recording...';
    recRow.querySelector('.pm-rec-blinking-dot').classList.remove('hidden');
    recRow.querySelector('.pm-rec-blinking-dot').style.display = 'inline';
    
    const playbackPlayBtn = recRow.querySelector('.pm-rec-playback-play');
    playbackPlayBtn.classList.add('hidden');
    playbackPlayBtn.style.display = 'none';
    
    const previewBtn = recRow.querySelector('.pm-rec-preview-btn');
    previewBtn.textContent = '⏹️';
    previewBtn.title = 'Stop & Preview';

    pmVoiceSeconds[userId] = 0;
    clearInterval(pmVoiceTimers[userId]);
    pmVoiceTimers[userId] = setInterval(() => {
      pmVoiceSeconds[userId]++;
      const mins = String(Math.floor(pmVoiceSeconds[userId] / 60)).padStart(2, '0');
      const secs = String(pmVoiceSeconds[userId] % 60).padStart(2, '0');
      recRow.querySelector('.pm-rec-timer-display').textContent = `${mins}:${secs}`;
    }, 1000);

    const discardBtn = recRow.querySelector('.pm-rec-discard-btn');
    const sendBtn = recRow.querySelector('.pm-rec-send-btn');
    const playbackAudio = recRow.querySelector('.pm-rec-playback-audio');

    discardBtn.onclick = () => {
      if (mediaRecorder.state === 'recording') {
        pmDiscardOnStop[userId] = true;
        mediaRecorder.stop();
      } else {
        resetPmInputState(userId);
      }
    };

    previewBtn.onclick = () => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      } else if (pmVoicePreviewMode[userId]) {
        playbackPlayBtn.click();
      }
    };

    sendBtn.onclick = async () => {
      if (mediaRecorder.state === 'recording') {
        pmAutoSendOnStop[userId] = true;
        mediaRecorder.stop();
      } else if (pmVoicePreviewMode[userId] && pmVoiceBlobs[userId]) {
        await sendPmVoiceNoteDirectly(userId, pmVoiceBlobs[userId]);
      }
    };

    playbackPlayBtn.onclick = () => {
      if (playbackAudio.paused) {
        playbackAudio.play();
        playbackPlayBtn.textContent = '⏸ Pause';
      } else {
        playbackAudio.pause();
        playbackPlayBtn.textContent = '▶ Play';
      }
    };
    playbackAudio.onended = () => {
      playbackPlayBtn.textContent = '▶ Play';
    };

    sbClient.channel('presence-global').send({
      type: 'broadcast',
      event: 'recording-voice',
      payload: { userId: currentUser.id, username: currentUser.username, roomId: 'pm' }
    }).catch(e => console.warn(e));

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      clearInterval(pmVoiceTimers[userId]);
      stream.getTracks().forEach(t => t.stop());

      sbClient.channel('presence-global').send({
        type: 'broadcast',
        event: 'recording-voice-stop',
        payload: { userId: currentUser.id, roomId: 'pm' }
      }).catch(e => console.warn(e));

      if (pmDiscardOnStop[userId]) {
        resetPmInputState(userId);
        return;
      }

      if (!chunks.length) {
        if (typeof showChatToast === 'function') showChatToast('Voice note cancelled.', 'warning');
        resetPmInputState(userId);
        return;
      }

      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });

      if (pmAutoSendOnStop[userId]) {
        await sendPmVoiceNoteDirectly(userId, blob);
        return;
      }

      pmVoiceBlobs[userId] = blob;
      pmVoicePreviewMode[userId] = true;

      recRow.querySelector('.pm-rec-status-text').textContent = 'Preview Ready';
      recRow.querySelector('.pm-rec-blinking-dot').style.display = 'none';
      recRow.querySelector('.pm-rec-blinking-dot').classList.add('hidden');
      
      const audioUrl = URL.createObjectURL(blob);
      playbackAudio.src = audioUrl;
      playbackPlayBtn.classList.remove('hidden');
      playbackPlayBtn.style.display = 'inline-block';
      playbackPlayBtn.textContent = '▶ Play';

      previewBtn.textContent = '▶/⏸';
      previewBtn.title = 'Play/Pause Preview';
    };

    mediaRecorder.start();

  } catch (error) {
    console.error('Mic access failed', error);
    if (typeof showChatToast === 'function') showChatToast('Microphone permission denied.', 'error');
    resetPmInputState(userId);
  }
}

function stopPmVoiceNoteRecording(e, userId) {
  const recorder = pmRecorders[userId];
  if (recorder && recorder.state === 'recording') {
    recorder.stop();
  }
}

function getPmVoiceChannelKey(userId) {
  const ids = [currentUser?.id || '', userId || ''].sort();
  return `pm-voice:${ids[0]}:${ids[1]}`;
}

function ensurePmCallState(userId) {
  if (!pmCallState[userId]) {
    pmCallState[userId] = {
      pc: null,
      stream: null,
      state: 'idle',
      incomingOffer: null,
      pendingIce: [],
      remoteAudioEl: null
    };
  }
  return pmCallState[userId];
}

function updatePmCallUi(userId) {
  const win = pmWindows[userId]?.el;
  if (!win) return;

  const state = ensurePmCallState(userId);
  const incoming = win.querySelector('.pm-call-banner');
  const active = win.querySelector('.pm-call-active');
  const activeText = win.querySelector('.pm-call-active-text');
  const callBtn = win.querySelector('.pm-call-btn');

  incoming?.classList.toggle('hidden', state.state !== 'incoming');
  active?.classList.toggle('hidden', !(state.state === 'calling' || state.state === 'active'));
  if (activeText) {
    activeText.textContent = state.state === 'calling' ? '📞 Calling…' : '📞 In call';
  }
  if (callBtn) callBtn.disabled = state.state !== 'idle';
}

async function updatePmVoicePresence(userId, stateName) {
  const state = ensurePmCallState(userId);
  state.state = stateName;
  updatePmCallUi(userId);
}

function cleanupPmVoiceCallState(userId) {
  const state = pmCallState[userId];
  if (!state) return;

  state.stream?.getTracks().forEach(track => track.stop());
  state.stream = null;

  if (state.pc) {
    try { state.pc.close(); } catch (_) {}
    state.pc = null;
  }

  if (state.remoteAudioEl) {
    state.remoteAudioEl.srcObject = null;
    state.remoteAudioEl.remove();
    state.remoteAudioEl = null;
  }

  state.pendingIce = [];
  state.incomingOffer = null;
  state.state = 'idle';
  updatePmCallUi(userId);
}

function ensurePmRemoteAudio(userId) {
  const state = ensurePmCallState(userId);
  if (state.remoteAudioEl) return state.remoteAudioEl;
  const audio = document.createElement('audio');
  audio.autoplay = true;
  audio.playsInline = true;
  audio.className = 'hidden';
  document.body.appendChild(audio);
  state.remoteAudioEl = audio;
  return audio;
}

async function createPmPeerConnection(userId) {
  const state = ensurePmCallState(userId);
  if (state.pc) return state.pc;

  const pc = new RTCPeerConnection(ICE_SERVERS);
  state.pc = pc;

  pc.onicecandidate = async ({ candidate }) => {
    if (!candidate || !pmChannel) return;
    await pmChannel.send({
      type: 'broadcast',
      event: 'pm-voice-ice',
      payload: {
        from: currentUser.id,
        to: userId,
        candidate,
        callKey: getPmVoiceChannelKey(userId)
      }
    });
  };

  pc.ontrack = ({ streams }) => {
    const audio = ensurePmRemoteAudio(userId);
    audio.srcObject = streams[0];
  };

  pc.onconnectionstatechange = () => {
    if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
      cleanupPmVoiceCallState(userId);
    }
  };

  return pc;
}

async function ensurePmCallLocalStream(userId) {
  const state = ensurePmCallState(userId);
  if (state.stream) return state.stream;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.stream = stream;
  return stream;
}

function applyPendingPmIceCandidates(userId) {
  const state = ensurePmCallState(userId);
  if (!state.pc || !state.pc.remoteDescription) return;
  const queued = [...state.pendingIce];
  state.pendingIce = [];
  queued.forEach(async (candidate) => {
    try { await state.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
  });
}

async function startPmVoiceCall(userId) {
  if (!currentProfile?.is_registered) {
    alert('Voice calls are available for registered users only.');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
    alert('Real-time voice calls are not supported in this browser.');
    return;
  }
  await ensurePmRealtime();

  const state = ensurePmCallState(userId);
  if (state.state !== 'idle') return;

  try {
    const stream = await ensurePmCallLocalStream(userId);
    const pc = await createPmPeerConnection(userId);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await updatePmVoicePresence(userId, 'calling');

    await pmChannel.send({
      type: 'broadcast',
      event: 'pm-voice-offer',
      payload: {
        from: currentUser.id,
        to: userId,
        sdp: offer,
        username: currentProfile?.username,
        callKey: getPmVoiceChannelKey(userId)
      }
    });
  } catch (_) {
    cleanupPmVoiceCallState(userId);
    alert('Microphone permission is required to start a voice call.');
  }
}

async function acceptPmVoiceCall(userId) {
  if (!currentProfile?.is_registered) {
    alert('Voice calls are available for registered users only.');
    return;
  }
  const state = ensurePmCallState(userId);
  if (!state.incomingOffer) return;

  try {
    const stream = await ensurePmCallLocalStream(userId);
    const pc = await createPmPeerConnection(userId);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(state.incomingOffer));
    state.incomingOffer = null;
    applyPendingPmIceCandidates(userId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updatePmVoicePresence(userId, 'active');

    await pmChannel.send({
      type: 'broadcast',
      event: 'pm-voice-answer',
      payload: {
        from: currentUser.id,
        to: userId,
        sdp: answer,
        callKey: getPmVoiceChannelKey(userId)
      }
    });
  } catch (_) {
    cleanupPmVoiceCallState(userId);
    alert('Could not accept voice call.');
  }
}

async function declinePmVoiceCall(userId) {
  const state = ensurePmCallState(userId);
  state.incomingOffer = null;
  cleanupPmVoiceCallState(userId);
  if (!pmChannel) return;

  await pmChannel.send({
    type: 'broadcast',
    event: 'pm-voice-hangup',
    payload: {
      from: currentUser.id,
      to: userId,
      declined: true,
      callKey: getPmVoiceChannelKey(userId)
    }
  });
}

async function endPmVoiceCall(userId, notifyPeer = true) {
  const state = ensurePmCallState(userId);
  const wasInCall = state.state !== 'idle' || !!state.incomingOffer;
  cleanupPmVoiceCallState(userId);
  if (!notifyPeer || !pmChannel || !wasInCall) return;

  await pmChannel.send({
    type: 'broadcast',
    event: 'pm-voice-hangup',
    payload: {
      from: currentUser.id,
      to: userId,
      callKey: getPmVoiceChannelKey(userId)
    }
  });
}

async function handlePmVoiceOffer(payload) {
  if (!payload || payload.to !== currentUser?.id || !currentProfile?.is_registered) return;
  const fromUserId = payload.from;
  if (!fromUserId || payload.callKey !== getPmVoiceChannelKey(fromUserId)) return;
  if (typeof canProcessIncomingPayload === 'function' && !canProcessIncomingPayload(fromUserId)) return;

  await openPrivateChat(fromUserId, payload.username || getUsernameById(fromUserId));
  const state = ensurePmCallState(fromUserId);
  if (state.state === 'active' || state.state === 'calling') {
    await declinePmVoiceCall(fromUserId);
    return;
  }

  state.incomingOffer = payload.sdp;
  await updatePmVoicePresence(fromUserId, 'incoming');
}

async function handlePmVoiceAnswer(payload) {
  if (!payload || payload.to !== currentUser?.id) return;
  const fromUserId = payload.from;
  if (!fromUserId || payload.callKey !== getPmVoiceChannelKey(fromUserId)) return;
  if (typeof canProcessIncomingPayload === 'function' && !canProcessIncomingPayload(fromUserId)) return;
  const state = ensurePmCallState(fromUserId);
  if (!state.pc) return;

  await state.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
  applyPendingPmIceCandidates(fromUserId);
  await updatePmVoicePresence(fromUserId, 'active');
}

function handlePmVoiceIce(payload) {
  if (!payload || payload.to !== currentUser?.id || !payload.candidate) return;
  const fromUserId = payload.from;
  if (!fromUserId || payload.callKey !== getPmVoiceChannelKey(fromUserId)) return;
  if (typeof canProcessIncomingPayload === 'function' && !canProcessIncomingPayload(fromUserId)) return;
  const state = ensurePmCallState(fromUserId);
  if (!state.pc || !state.pc.remoteDescription) {
    state.pendingIce.push(payload.candidate);
    return;
  }
  state.pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
}

function handlePmVoiceHangup(payload) {
  if (!payload || payload.to !== currentUser?.id) return;
  const fromUserId = payload.from;
  if (!fromUserId || payload.callKey !== getPmVoiceChannelKey(fromUserId)) return;
  if (typeof canProcessIncomingPayload === 'function' && !canProcessIncomingPayload(fromUserId)) return;
  cleanupPmVoiceCallState(fromUserId);
}

function trackPmVoiceUrl(userId, url) {
  if (!pmVoiceUrls[userId]) pmVoiceUrls[userId] = [];
  pmVoiceUrls[userId].push(url);
}

function cleanupPmVoiceUrls(userId) {
  (pmVoiceUrls[userId] || []).forEach((url) => URL.revokeObjectURL(url));
  pmVoiceUrls[userId] = [];
}

async function sendPmBroadcast(payload) {
  if (typeof enforceCurrentUserModerationState === 'function') {
    const allowed = await enforceCurrentUserModerationState({ refresh: true });
    if (!allowed) return;
  }
  if (!pmChannel || !currentUser?.id) return;
  await pmChannel.send({
    type: 'broadcast',
    event: 'private-message',
    payload: {
      ...payload,
      from: currentUser.id,
      username: currentProfile?.username,
      createdAt: new Date().toISOString()
    }
  });
}

async function ensurePrivateTableSupport() {
  if (pmTableAvailable !== null) return pmTableAvailable;

  const { error } = await sbClient
    .from('private_messages')
    .select('id', { count: 'exact', head: true })
    .limit(1);

  pmTableAvailable = !error;
  return pmTableAvailable;
}

async function persistPmToDb(userId, content, type = 'text') {
  const ok = await ensurePrivateTableSupport();
  if (!ok) return;

  const payload = {
    sender_id: currentUser.id,
    recipient_id: userId,
    content,
    type
  };

  const { error } = await sbClient.from('private_messages').insert(payload);
  if (error) pmTableAvailable = false;
}

async function loadPmHistoryFromDb(userId) {
  const ok = await ensurePrivateTableSupport();
  if (!ok) return;

  const { data, error } = await sbClient
    .from('private_messages')
    .select('*')
    .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${currentUser.id})`)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    pmTableAvailable = false;
    return;
  }

  const existing = pmTextHistory[userId] || [];
  const seen = new Set(existing.map(m => `${m.from}|${m.type || 'text'}|${m.text || m.imageUrl || ''}|${m.createdAt}`));

  (data || []).forEach(row => {
    if (row.type && !['text', 'image'].includes(row.type)) return;
    const item = {
      from: row.sender_id,
      type: row.type || 'text',
      createdAt: row.created_at || new Date().toISOString()
    };
    if (item.type === 'image') item.imageUrl = row.content || '';
    else item.text = row.content || '';
    const key = `${item.from}|${item.type}|${item.text || item.imageUrl || ''}|${item.createdAt}`;
    if (!seen.has(key)) {
      existing.push(item);
      seen.add(key);
    }
  });

  pmTextHistory[userId] = existing;
  renderPmTextHistory(userId);
}

function playPmNotification(userId) {
  if (pmMuted[userId]) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  if (!pmAudioCtx) pmAudioCtx = new AudioCtx();
  if (pmAudioCtx.state === 'suspended') pmAudioCtx.resume().catch(() => {});

  const osc = pmAudioCtx.createOscillator();
  const gain = pmAudioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 820;
  gain.gain.value = 0.0001;

  osc.connect(gain);
  gain.connect(pmAudioCtx.destination);

  const now = pmAudioCtx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.03, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  osc.start(now);
  osc.stop(now + 0.17);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const header = parts[0];
  const b64 = parts[1] || '';
  const mime = (header.match(/data:(.*?);base64/) || [])[1] || 'audio/webm';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
