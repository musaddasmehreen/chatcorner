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
let voiceRecordingSeconds = 0;

// Debounce handle for renderUserList
let _renderTimer = null;
const _rateLimits = {};

function rateLimit(key, maxCalls, windowMs) {
  const now = Date.now();
  if (!_rateLimits[key]) _rateLimits[key] = [];
  _rateLimits[key] = _rateLimits[key].filter(t => now - t < windowMs);
  if (_rateLimits[key].length >= maxCalls) return false;
  _rateLimits[key].push(now);
  return true;
}

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
  if (currentProfile.is_registered) {
    document.getElementById('btn-voice-note').style.display = '';
  }

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
  stopRoomVoiceRecording();

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
    if (voiceBtn) voiceBtn.disabled = false;
  }

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
      if (!payload || payload.from === currentUser?.id) return;
      appendVoiceNoteMessage(payload, false);
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
        await presenceChannel.track(presenceBaseData);
      }
    });

  appendSystemMessage(`You joined #${room.name}`);
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if (!text || !currentRoom) return;
  if (!rateLimit('send-msg', 10, 10000)) {
    appendSystemMessage('⚠️ Slow down! Too many messages.');
    return;
  }
  if (currentRoom.is_locked) {
    appendSystemMessage('This room is locked by admin. Messaging is disabled.');
    return;
  }
  const sanitized = text.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '').trim();
  if (!sanitized) return;

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

  Object.values(onlineUsers).forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-item';
    li.dataset.userId = u.userId;
    li.innerHTML = `
      <span class="dot${u.registered ? '' : ' guest'}"></span>
      <button type="button" class="user-name-btn">${escHtml(u.username)}${u.registered ? ' \u2713' : ''}</button>
      <canvas class="mini-soundbar" data-user-id="${u.userId}" width="32" height="10" aria-hidden="true"></canvas>
      <button type="button" class="camera-user-btn${cameraStates[u.userId] ? '' : ' hidden'}" data-user-id="${u.userId}" title="View camera">\ud83d\udcf7</button>
      ${(currentProfile?.is_admin || currentProfile?.is_mod) && u.userId !== currentUser.id
        ? `<button type="button" class="btn-ban-user" data-uid="${u.userId}" title="Ban user">🚫</button>`
        : ''}
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

function formatVoiceTimer(secondsLeft) {
  const m = Math.floor(secondsLeft / 60);
  const s = String(secondsLeft % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function stopRoomVoiceRecording() {
  const btn = document.getElementById('btn-voice-note');
  const timerEl = document.getElementById('voice-note-timer');
  if (voiceRecordingTimer) {
    clearInterval(voiceRecordingTimer);
    voiceRecordingTimer = null;
  }
  voiceRecordingSeconds = 0;
  if (btn) {
    btn.classList.remove('recording');
    btn.textContent = '🎙️';
    btn.disabled = false;
  }
  if (timerEl) {
    timerEl.style.display = 'none';
    timerEl.textContent = '';
  }
  if (voiceRecorder?.state === 'recording') {
    voiceRecorder.stop();
  }
  voiceRecorder = null;
}

function blobToDataUrlLocal(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function toggleRoomVoiceNote() {
  if (!currentProfile?.is_registered) {
    alert('Voice notes are available for registered users only.');
    return;
  }
  if (!currentRoom) return;

  const btn = document.getElementById('btn-voice-note');
  const timerEl = document.getElementById('voice-note-timer');
  if (voiceRecorder?.state === 'recording') {
    voiceRecorder.stop();
    return;
  }
  if (!rateLimit('voice-note', 3, 60000)) {
    alert('Too many voice notes. Wait a moment.');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    alert('Voice recording is not supported in this browser.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    const recorder = new MediaRecorder(stream);
    voiceRecorder = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      stopRoomVoiceRecording();
      if (!chunks.length || !messageChannel) return;

      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      const dataURL = await blobToDataUrlLocal(blob);
      const payload = {
        from: currentUser.id,
        username: currentProfile.username,
        audioData: dataURL,
        mimeType: blob.type || recorder.mimeType || 'audio/webm'
      };
      appendVoiceNoteMessage(payload, true);
      scrollToBottom();
      await messageChannel.send({
        type: 'broadcast',
        event: 'voice-note',
        payload
      });
    };

    recorder.start();
    voiceRecordingSeconds = 300;
    if (btn) {
      btn.classList.add('recording');
      btn.textContent = '⏹️';
    }
    if (timerEl) {
      timerEl.style.display = '';
      timerEl.textContent = formatVoiceTimer(voiceRecordingSeconds);
    }
    voiceRecordingTimer = setInterval(() => {
      voiceRecordingSeconds -= 1;
      if (timerEl) timerEl.textContent = formatVoiceTimer(Math.max(voiceRecordingSeconds, 0));
      if (voiceRecordingSeconds <= 0 && voiceRecorder?.state === 'recording') {
        voiceRecorder.stop();
      }
    }, 1000);
  } catch (_) {
    alert('Microphone permission is required to record voice notes.');
  }
}

function appendVoiceNoteMessage(payload, isMe = false) {
  if (!payload?.audioData) return;
  const safeAudioSrc = /^data:audio\//i.test(payload.audioData) ? payload.audioData : '';
  if (!safeAudioSrc) return;
  const messages = document.getElementById('messages');
  if (!messages) return;

  const row = document.createElement('div');
  row.className = 'msg-row' + (isMe ? ' self' : '');
  const sender = payload.username || getUsernameById(payload.from) || 'Unknown';
  const initial = sender[0]?.toUpperCase?.() || '?';
  const color = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(sender);

  row.innerHTML = `
    <div class="avatar" style="background:${color}">${escHtml(initial)}</div>
    <div class="msg-bubble">
      <div class="msg-username">🎙️ ${escHtml(sender)}</div>
      <div class="msg-text"><audio controls src="${safeAudioSrc}"></audio></div>
      <div class="msg-time">${formatTime(new Date().toISOString())}</div>
    </div>
  `;

  const audio = row.querySelector('audio');
  if (audio) {
    audio.onended = () => {
      row.remove();
    };
  }

  messages.appendChild(row);
}

async function inChatBanUser(userId, username) {
  if (!currentProfile?.is_admin && !currentProfile?.is_mod) return;
  const reason = prompt('Ban ' + username + '? Enter reason:', 'Banned by moderator');
  if (reason === null) return;
  const { error } = await sbClient.from('profiles').update({
    is_banned: true,
    banned_at: new Date().toISOString(),
    banned_by: currentUser.id,
    ban_reason: reason || 'Banned by moderator'
  }).eq('id', userId);
  if (error) { alert('Ban failed: ' + error.message); return; }
  appendSystemMessage('🚫 ' + username + ' has been banned.');
}
