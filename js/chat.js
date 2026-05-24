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
let voiceRecorder = null;
let voiceRecordingTimer = null;
let voiceRecordingDeadline = 0;
let voiceRecordingStopTimer = null;
let sendCooldownUntil = 0;
const seenVoiceNoteIds = new Set();

/* ══ Rate Limiting ══════════════════════════════════════════════ */
const _rateLimits = {};
function rateLimit(key, maxCalls, windowMs) {
  const now = Date.now();
  if (!_rateLimits[key]) _rateLimits[key] = [];
  _rateLimits[key] = _rateLimits[key].filter(t => now - t < windowMs);
  if (_rateLimits[key].length >= maxCalls) return false;
  _rateLimits[key].push(now);
  return true;
}

// Debounce handle for renderUserList
let _renderTimer = null;

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
    await sbClient.auth.signOut();
    window.location.href = 'index.html?banned=1';
    return;
  }
  presenceBaseData = {
    userId: currentUser.id,
    username: currentProfile.username,
    color: currentProfile.avatar_color,
    registered: currentProfile.is_registered,
    cameraOn: false
  };
  document.getElementById('user-badge').textContent = prof.username + (prof.is_registered ? ' \u2713' : ' \ud83d\udc64');
  updateRoomVoiceNoteUi();

  document.getElementById('audio-bar').classList.remove('hidden');

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
  const voiceBtn = document.getElementById('btn-voice-note');

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
    if (voiceBtn) voiceBtn.disabled = true;
    closeEmojiPicker();
  } else {
    msgInput.disabled = false;
    msgInput.placeholder = 'Type a message\u2026 (Enter to send)';
    if (sendBtn)  sendBtn.disabled  = false;
    if (emojiBtn) emojiBtn.disabled = false;
    if (voiceBtn) voiceBtn.disabled = isSendCooldownActive();
  }
  updateRoomVoiceNoteUi();

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
    .on('broadcast', { event: 'voice-note' }, ({ payload }) => {
      if (!currentProfile?.is_registered || payload?.roomId !== currentRoom?.id) return;
      appendVoiceNoteMessage(payload);
      scrollToBottom();
    })
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `room_id=eq.${room.id}`
    }, payload => {
      appendMessage(payload.new);
      scrollToBottom();
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
        if (!rateLimit('presence:' + room.id, 5, 60000)) {
          activateSendCooldown('⚠️ Too many room connections detected. Sending is disabled for 30 seconds.');
          return;
        }
        await presenceChannel.track(presenceBaseData);
      }
    });

  appendSystemMessage(`You joined #${room.name}`);
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const rawText = input.value;
  if (!rawText || !currentRoom) return;
  if (currentRoom.is_locked) {
    appendSystemMessage('This room is locked by admin. Messaging is disabled.');
    return;
  }
  if (isSendCooldownActive()) {
    appendSystemMessage('⚠️ Sending is temporarily disabled. Please wait a few seconds and try again.');
    return;
  }
  if (!rateLimit('message:' + currentUser.id, 10, 10000)) {
    appendSystemMessage('⚠️ Slow down! You\'re sending messages too fast.');
    return;
  }

  const sanitized = rawText.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '').trim();
  if (!sanitized) {
    input.value = '';
    return;
  }

  input.value = '';

  await sbClient.from('messages').insert({
    room_id:  currentRoom.id,
    user_id:  currentUser.id,
    username: currentProfile.username,
    content:  sanitized,
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

  const isMe  = msg.user_id === currentUser?.id;
  const div   = document.createElement('div');
  div.className = 'msg-row' + (isMe ? ' self' : '');

  const initial = (msg.username || '?')[0].toUpperCase();
  const color   = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);

  div.innerHTML = `
    <div class="avatar" style="background:${color}">${initial}</div>
    <div class="msg-bubble">
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
  const canBanUsers = !!(currentProfile?.is_admin || currentProfile?.is_mod);

  Object.values(onlineUsers).forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-item';
    li.dataset.userId = u.userId;
    li.innerHTML = `
      <span class="dot${u.registered ? '' : ' guest'}"></span>
      <button type="button" class="user-name-btn">${escHtml(u.username)}${u.registered ? ' \u2713' : ''}</button>
      <canvas class="mini-soundbar" data-user-id="${u.userId}" width="32" height="10" aria-hidden="true"></canvas>
      <button type="button" class="camera-user-btn${cameraStates[u.userId] ? '' : ' hidden'}" data-user-id="${u.userId}" title="View camera">\ud83d\udcf7</button>
      ${canBanUsers && u.userId !== currentUser?.id ? `<button type="button" class="btn-ban-user" data-uid="${u.userId}" title="Ban user">🚫</button>` : ''}
    `;
    li.querySelector('.user-name-btn')?.addEventListener('click', () => {
      if (typeof openPrivateChat === 'function') openPrivateChat(u.userId, u.username);
    });
    li.querySelector('.camera-user-btn')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (typeof openFloatingCamera === 'function') openFloatingCamera(u.userId, u.username);
    });
    li.querySelector('.btn-ban-user')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      inChatBanUser(u.userId, u.username);
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

function updateRoomVoiceNoteUi() {
  const btn = document.getElementById('btn-voice-note');
  const timer = document.getElementById('voice-note-timer');
  if (!btn) return;

  if (!currentProfile?.is_registered) {
    btn.style.display = 'none';
    btn.disabled = true;
    timer?.classList.add('hidden');
    return;
  }

  btn.style.display = 'flex';
  btn.disabled = !!currentRoom?.is_locked || isSendCooldownActive();
  if (!voiceRecorder) {
    btn.classList.remove('recording');
    btn.textContent = '🎙️';
    btn.title = 'Voice Note';
    if (timer) {
      timer.textContent = '';
      timer.classList.add('hidden');
    }
  }
}

function isSendCooldownActive() {
  return sendCooldownUntil > Date.now();
}

function activateSendCooldown(message) {
  sendCooldownUntil = Date.now() + 30000;
  updateRoomVoiceNoteUi();
  const voiceBtn = document.getElementById('btn-voice-note');
  if (voiceBtn) voiceBtn.disabled = true;
  appendSystemMessage(message);
  setTimeout(() => {
    if (!isSendCooldownActive()) updateRoomVoiceNoteUi();
  }, 31000);
}

function formatCountdown(msRemaining) {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function updateVoiceRecordingCountdown() {
  const btn = document.getElementById('btn-voice-note');
  const timer = document.getElementById('voice-note-timer');
  if (!btn || !timer || !voiceRecorder) return;
  const remaining = Math.max(0, voiceRecordingDeadline - Date.now());
  btn.classList.add('recording');
  btn.textContent = '⏹️';
  btn.title = 'Stop recording';
  timer.textContent = formatCountdown(remaining);
  timer.classList.remove('hidden');
}

function clearRoomVoiceRecorderState() {
  if (voiceRecordingTimer) clearInterval(voiceRecordingTimer);
  if (voiceRecordingStopTimer) clearTimeout(voiceRecordingStopTimer);
  voiceRecordingTimer = null;
  voiceRecordingStopTimer = null;
  voiceRecordingDeadline = 0;
  voiceRecorder = null;
  updateRoomVoiceNoteUi();
}

async function toggleRoomVoiceNote() {
  if (!currentProfile?.is_registered) {
    alert('Voice notes are available for registered users only.');
    return;
  }
  if (!currentRoom?.id || currentRoom?.is_locked) return;
  if (isSendCooldownActive()) {
    appendSystemMessage('⚠️ Sending is temporarily disabled. Please wait a few seconds and try again.');
    return;
  }

  const activeRecorder = voiceRecorder?.recorder;
  if (activeRecorder?.state === 'recording') {
    activeRecorder.stop();
    return;
  }

  if (!rateLimit('voice-note:' + currentUser.id, 3, 60000)) {
    appendSystemMessage('⚠️ Slow down! You can only send 3 voice notes per minute.');
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    alert('Voice recording is not supported in this browser.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    voiceRecorder = { recorder, stream, chunks };
    voiceRecordingDeadline = Date.now() + (300 * 1000);

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = async () => {
      const snapshot = voiceRecorder;
      clearRoomVoiceRecorderState();
      snapshot?.stream?.getTracks().forEach(track => track.stop());
      if (!snapshot?.chunks?.length || !currentRoom?.id) return;

      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(snapshot.chunks, { type: mimeType });
      const audioData = await blobToBase64(blob);
      const payload = {
        id: `${currentUser.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        type: 'voice-note',
        roomId: currentRoom.id,
        from: currentUser.id,
        username: currentProfile.username,
        audioData,
        mimeType
      };
      appendVoiceNoteMessage(payload);
      if (messageChannel) {
        await messageChannel.send({ type: 'broadcast', event: 'voice-note', payload });
      }
    };

    recorder.start();
    updateVoiceRecordingCountdown();
    voiceRecordingTimer = setInterval(updateVoiceRecordingCountdown, 1000);
    voiceRecordingStopTimer = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, 300000);
  } catch (_) {
    clearRoomVoiceRecorderState();
    alert('Microphone permission is required to record voice notes.');
  }
}

function appendVoiceNoteMessage(payload) {
  if (!payload?.id || seenVoiceNoteIds.has(payload.id)) return;
  if (!payload?.audioData || !payload?.mimeType) return;
  seenVoiceNoteIds.add(payload.id);

  const isMe = payload.from === currentUser?.id;
  const div = document.createElement('div');
  div.className = 'msg-row msg-voice' + (isMe ? ' self' : '');
  const initial = (payload.username || '?')[0].toUpperCase();
  const color = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(payload.username);
  const audioSrc = `data:${payload.mimeType};base64,${payload.audioData}`;

  div.innerHTML = `
    <div class="avatar" style="background:${color}">${initial}</div>
    <div class="msg-bubble">
      <div class="msg-username">🎙️ ${escHtml(payload.username || 'Unknown')}</div>
      <audio controls preload="metadata" src="${audioSrc}"></audio>
      <div class="msg-time">${formatTime(new Date().toISOString())}</div>
    </div>`;

  const audio = div.querySelector('audio');
  if (audio) {
    audio.onended = () => div.remove();
  }

  document.getElementById('messages').appendChild(div);
}

async function inChatBanUser(userId, username) {
  if (!currentProfile?.is_admin && !currentProfile?.is_mod) return;
  const reason = prompt(`Ban ${username}? Enter reason (or cancel to abort):`, 'Banned by moderator');
  if (reason === null) return;
  const { error } = await sbClient.from('profiles').update({
    is_banned: true,
    banned_at: new Date().toISOString(),
    banned_by: currentUser.id,
    ban_reason: reason || 'Banned by moderator'
  }).eq('id', userId);
  if (error) {
    alert('Ban failed: ' + error.message);
    return;
  }
  appendSystemMessage(`🚫 ${username} has been banned.`);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
