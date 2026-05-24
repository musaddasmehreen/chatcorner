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

const rateLimitState = new Map();
let voiceRecorder = null;
let voiceRecordingTimer = null;
let voiceRecordingSeconds = 0;
let voiceRecordingDiscard = false;
let voiceRecordingStream = null;
let voiceRecordingRoomId = null;

function rateLimit(key, maxCalls, windowMs) {
  const now = Date.now();
  const bucket = (rateLimitState.get(key) || []).filter(ts => now - ts < windowMs);
  if (bucket.length >= maxCalls) {
    rateLimitState.set(key, bucket);
    return false;
  }
  bucket.push(now);
  rateLimitState.set(key, bucket);
  return true;
}

function stripHtmlTags(value = '') {
  return String(value).replace(/[<>]/g, '');
}

function formatVoiceNoteTimer(totalSeconds) {
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function resetRoomVoiceNoteUi() {
  const btn = document.getElementById('btn-voice-note');
  const timer = document.getElementById('voice-note-timer');
  if (voiceRecordingTimer) clearInterval(voiceRecordingTimer);
  voiceRecordingTimer = null;
  voiceRecordingSeconds = 0;
  voiceRecordingDiscard = false;
  voiceRecordingRoomId = null;
  if (btn) {
    btn.classList.remove('recording');
    btn.textContent = '🎙️';
  }
  if (timer) timer.textContent = '';
}

function stopRoomVoiceRecorder(discard = false) {
  if (!voiceRecorder || voiceRecorder.state !== 'recording') return;
  voiceRecordingDiscard = discard;
  voiceRecorder._discard = discard;
  voiceRecorder.stop();
}

function appendVoiceNoteMessage(payload) {
  if (!payload?.audioDataUrl || !currentProfile?.is_registered) return;

  const isMe = payload.from === currentUser?.id;
  const row = document.createElement('div');
  row.className = 'msg-row' + (isMe ? ' self' : '');

  const username = payload.username || 'Unknown';
  const initial = username[0]?.toUpperCase() || '?';
  const color = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(username);
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  const name = document.createElement('div');
  name.className = 'msg-username';
  name.textContent = username;

  const text = document.createElement('div');
  text.className = 'msg-text';
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.src = payload.audioDataUrl;
  audio.addEventListener('ended', () => row.remove(), { once: true });
  text.appendChild(audio);

  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = formatTime(payload.createdAt || new Date().toISOString());

  bubble.append(name, text, time);
  row.innerHTML = `<div class="avatar" style="background:${color}">${escHtml(initial)}</div>`;
  row.appendChild(bubble);
  document.getElementById('messages').appendChild(row);
  scrollToBottom();
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

  if (prof?.is_banned) {
    await sbClient.auth.signOut();
    window.location.href = 'index.html?banned=1';
    return;
  }

  currentProfile = prof;
  presenceBaseData = {
    userId: currentUser.id,
    username: currentProfile.username,
    color: currentProfile.avatar_color,
    registered: currentProfile.is_registered,
    cameraOn: false
  };
  document.getElementById('user-badge').textContent = prof.username + (prof.is_registered ? ' \u2713' : ' \ud83d\udc64');
  if (prof.is_registered) {
    document.getElementById('btn-voice-note').style.display = 'inline-flex';
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

  stopRoomVoiceRecorder(true);
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
    if (voiceBtn) voiceBtn.disabled = !currentProfile?.is_registered;
  }
  resetRoomVoiceNoteUi();

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
    .on('broadcast', { event: 'voice-note' }, ({ payload }) => {
      if (!payload || payload.roomId !== room.id || payload.from === currentUser?.id || !currentProfile?.is_registered) return;
      appendVoiceNoteMessage(payload);
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
  const text  = stripHtmlTags(input.value).trim();
  if (!text || !currentRoom) {
    input.value = '';
    return;
  }
  if (currentRoom.is_locked) {
    appendSystemMessage('This room is locked by admin. Messaging is disabled.');
    return;
  }
  if (!rateLimit(`room-message:${currentUser?.id || 'guest'}`, 10, 10_000)) {
    appendSystemMessage('You are sending messages too quickly. Please slow down.');
    return;
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

async function toggleRoomVoiceNote() {
  if (!currentProfile?.is_registered) {
    alert('Voice notes are available for registered users only.');
    return;
  }
  if (!currentRoom) return;
  if (currentRoom.is_locked) {
    appendSystemMessage('This room is locked by admin. Voice notes are disabled.');
    return;
  }

  const btn = document.getElementById('btn-voice-note');
  const timer = document.getElementById('voice-note-timer');
  if (voiceRecorder?.state === 'recording') {
    stopRoomVoiceRecorder(false);
    return;
  }

  if (!rateLimit(`room-voice:${currentUser?.id || 'guest'}`, 3, 60_000)) {
    appendSystemMessage('Voice note limit reached. Please wait a minute and try again.');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    alert('Voice recording is not supported in this browser.');
    return;
  }

  try {
    voiceRecordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    voiceRecorder = new MediaRecorder(voiceRecordingStream);
    voiceRecordingRoomId = currentRoom.id;
    voiceRecorder._discard = false;
    voiceRecorder._roomId = currentRoom.id;
    voiceRecorder._channel = messageChannel;

    voiceRecorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };

    voiceRecorder.onstop = async () => {
      const recorder = voiceRecorder;
      const stream = voiceRecordingStream;
      const discard = recorder?._discard || voiceRecordingDiscard;
      const roomId = recorder?._roomId || voiceRecordingRoomId;
      const channel = recorder?._channel || messageChannel;
      const mimeType = recorder?.mimeType || 'audio/webm';
      resetRoomVoiceNoteUi();
      voiceRecorder = null;
      voiceRecordingStream = null;
      stream?.getTracks().forEach(track => track.stop());

      if (discard || !chunks.length || !channel || roomId !== currentRoom?.id) return;

      const blob = new Blob(chunks, { type: mimeType });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const payload = {
          roomId,
          from: currentUser.id,
          username: currentProfile.username,
          audioDataUrl: reader.result,
          createdAt: new Date().toISOString()
        };
        appendVoiceNoteMessage(payload);
        await channel.send({ type: 'broadcast', event: 'voice-note', payload });
      };
      reader.readAsDataURL(blob);
    };

    voiceRecorder.start();
    voiceRecordingSeconds = 0;
    if (btn) {
      btn.classList.add('recording');
      btn.textContent = '⏹️';
    }
    if (timer) timer.textContent = formatVoiceNoteTimer(voiceRecordingSeconds);
    voiceRecordingTimer = setInterval(() => {
      voiceRecordingSeconds += 1;
      if (timer) timer.textContent = formatVoiceNoteTimer(voiceRecordingSeconds);
      if (voiceRecordingSeconds >= 300) stopRoomVoiceRecorder(false);
    }, 1000);
  } catch (_) {
    resetRoomVoiceNoteUi();
    voiceRecorder = null;
    voiceRecordingStream?.getTracks().forEach(track => track.stop());
    voiceRecordingStream = null;
    alert('Microphone permission is required to record voice notes.');
  }
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
      ${canBanUsers && u.userId !== currentUser?.id ? '<button type="button" class="btn-ban-user" title="Ban user">🚫</button>' : ''}
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

async function inChatBanUser(userId, username) {
  if (!userId || !(currentProfile?.is_admin || currentProfile?.is_mod)) return;
  const reason = prompt(`Ban ${username}? Add a reason (optional):`, 'Violation');
  if (reason === null) return;
  const { error } = await sbClient.from('profiles').update({
    is_banned: true,
    banned_at: new Date().toISOString(),
    banned_by: currentUser.id,
    ban_reason: reason || 'Banned by moderator'
  }).eq('id', userId);

  if (error) {
    appendSystemMessage(`Could not ban ${username}.`);
    return;
  }

  appendSystemMessage(`${username} was banned from the chat.`);
}
