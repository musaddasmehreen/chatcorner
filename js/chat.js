let currentUser = null;
let currentProfile = null;
let currentRoom = null;
let roomWs = null;
let onlineUsers = Object.create(null);
let cameraStates = Object.create(null);

// Voice recording state
let mediaRecorder = null;
let audioChunks = [];
let isVoiceRecording = false;

window.roomWs = null;
window.sendToRoom = sendToRoom;

window.addEventListener('DOMContentLoaded', async () => {
  const sessionRes = await apiFetch('/api/auth/session', { method: 'GET' }).catch(() => null);
  if (!sessionRes?.ok) {
    clearToken();
    window.location.href = 'index.html';
    return;
  }

  const session = await sessionRes.json();
  currentUser = session.user;
  currentProfile = session.profile;
  window.currentUser = currentUser;
  window.currentProfile = currentProfile;

  document.getElementById('user-badge').textContent = `${currentProfile.username}${currentProfile.is_registered ? ' ✓' : ' 👤'}`;
  document.getElementById('audio-bar').classList.remove('hidden');

  await loadRooms();
});

async function loadRooms() {
  const res = await apiFetch('/api/rooms');
  const payload = await res.json().catch(() => ({ data: [] }));
  const rooms = payload.data || [];

  const textList = document.getElementById('room-list');
  const voiceList = document.getElementById('voice-room-list');
  textList.innerHTML = '';
  voiceList.innerHTML = '';

  rooms.forEach((room) => {
    const li = document.createElement('li');
    li.innerHTML = `${room.is_audio_enabled ? '🎙️' : '💬'} ${room.name}`;
    li.onclick = () => enterRoom(room);
    if (room.is_audio_enabled) voiceList.appendChild(li);
    else textList.appendChild(li);
  });

  if (rooms.length) enterRoom(rooms[0]);
}

async function enterRoom(room) {
  if (!room?.id || currentRoom?.id === room.id) return;

  if (roomWs) {
    try { roomWs.close(); } catch (_) {}
    roomWs = null;
    window.roomWs = null;
  }

  if (typeof leaveVoice === 'function') await leaveVoice();
  stopVoiceRecording();

  currentRoom = room;
  document.getElementById('current-room-name').textContent = '# ' + room.name;
  document.getElementById('messages').innerHTML = '';
  onlineUsers = Object.create(null);
  cameraStates = Object.create(null);

  document.querySelectorAll('.room-list li').forEach((li) => {
    li.classList.toggle('active', li.textContent.includes(room.name));
  });

  const audioBar = document.getElementById('audio-bar');
  const msgInput = document.getElementById('msg-input');
  const sendBtn = document.querySelector('.btn-send');
  if (room.is_audio_enabled) audioBar.classList.remove('hidden');
  else audioBar.classList.add('hidden');

  if (room.is_locked) {
    msgInput.disabled = true;
    msgInput.placeholder = 'This room is locked by admin.';
    if (sendBtn) sendBtn.disabled = true;
  } else {
    msgInput.disabled = false;
    msgInput.placeholder = 'Type a message… (Enter to send)';
    if (sendBtn) sendBtn.disabled = false;
  }

  const msgRes = await apiFetch(`/api/rooms/${room.id}/messages?limit=50`);
  const msgPayload = await msgRes.json().catch(() => ({ data: [] }));
  (msgPayload.data || []).forEach((m) => appendMessage(m));
  scrollToBottom();

  const wsUrl = `wss://${location.host}/api/ws/room/${room.id}?token=${encodeURIComponent(getToken() || '')}`;
  roomWs = new WebSocket(wsUrl);
  window.roomWs = roomWs;

  roomWs.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch (_) { return; }

    if (msg.type === 'chat_message') {
      appendMessage(msg);
      scrollToBottom();
      return;
    }

    if (msg.type === 'voice_message') {
      appendVoiceMessage(msg);
      scrollToBottom();
      return;
    }

    if (msg.type === 'presence_sync') {
      onlineUsers = Object.create(null);
      cameraStates = Object.create(null);
      (msg.users || []).forEach((u) => {
        onlineUsers[u.userId] = u;
        cameraStates[u.userId] = !!u.cameraOn;
      });
      renderUserList();
      return;
    }

    if (msg.type === 'presence_join' && msg.user) {
      onlineUsers[msg.user.userId] = msg.user;
      cameraStates[msg.user.userId] = !!msg.user.cameraOn;
      renderUserList();
      return;
    }

    if (msg.type === 'presence_leave') {
      delete onlineUsers[msg.userId];
      delete cameraStates[msg.userId];
      renderUserList();
      return;
    }

    if (msg.type === 'presence_update') {
      cameraStates[msg.userId] = !!msg.cameraOn;
      if (onlineUsers[msg.userId]) onlineUsers[msg.userId].cameraOn = !!msg.cameraOn;
      renderUserList();
      return;
    }

    if (['offer', 'answer', 'ice', 'join_voice', 'leave_voice', 'camera_state'].includes(msg.type)) {
      if (msg.type === 'offer' && typeof handleOffer === 'function') handleOffer(msg);
      if (msg.type === 'answer' && typeof handleAnswer === 'function') handleAnswer(msg);
      if (msg.type === 'ice' && typeof handleIce === 'function') handleIce(msg);
      if (msg.type === 'join_voice' && typeof handlePeerJoin === 'function') handlePeerJoin(msg);
      if (msg.type === 'leave_voice' && typeof handlePeerLeave === 'function') handlePeerLeave(msg);
      if (msg.type === 'camera_state' && typeof handleCameraState === 'function') handleCameraState(msg);
    }
  };

  roomWs.onclose = () => {
    if (window.roomWs === roomWs) window.roomWs = null;
  };

  appendSystemMessage(`You joined #${room.name}`);
}

function sendToRoom(msg) {
  if (!roomWs || roomWs.readyState !== WebSocket.OPEN) return false;
  roomWs.send(JSON.stringify(msg));
  return true;
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text || !currentRoom) return;
  if (currentRoom.is_locked) {
    appendSystemMessage('This room is locked by admin. Messaging is disabled.');
    return;
  }

  input.value = '';
  sendToRoom({
    type: 'chat_message',
    id: crypto.randomUUID(),
    room_id: currentRoom.id,
    content: text
  });
}

function appendMessage(msg) {
  if (msg.type === 'system') {
    appendSystemMessage(msg.content);
    return;
  }

  const isMe = msg.user_id === currentUser?.id;
  const row = document.createElement('div');
  row.className = 'msg-row' + (isMe ? ' self' : '');

  const initial = (msg.username || '?')[0].toUpperCase();
  const color = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username || '');

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.style.background = color;
  avatar.textContent = initial;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  const username = document.createElement('div');
  username.className = 'msg-username';
  username.textContent = msg.username || 'Unknown';

  const text = document.createElement('div');
  text.className = 'msg-text';
  text.textContent = msg.content || '';

  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = formatTime(msg.created_at);

  bubble.append(username, text, time);
  row.append(avatar, bubble);
  document.getElementById('messages').appendChild(row);
}

function appendSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg-system';
  div.textContent = '— ' + text + ' —';
  document.getElementById('messages').appendChild(div);
}

function renderUserList() {
  const ul = document.getElementById('user-list');
  ul.innerHTML = '';

  Object.values(onlineUsers).forEach((u) => {
    const li = document.createElement('li');
    li.className = 'user-item';
    li.dataset.userId = u.userId;
    li.innerHTML = `
      <span class="dot${u.registered ? '' : ' guest'}"></span>
      <button type="button" class="user-name-btn">${escHtml(u.username)}${u.registered ? ' ✓' : ''}</button>
      <canvas class="mini-soundbar" data-user-id="${u.userId}" width="32" height="10" aria-hidden="true"></canvas>
      <button type="button" class="camera-user-btn${cameraStates[u.userId] ? '' : ' hidden'}" data-user-id="${u.userId}" title="View camera">📷</button>
    `;

    li.querySelector('.user-name-btn')?.addEventListener('click', () => {
      if (typeof openPrivateChat === 'function') openPrivateChat(u.userId, u.username);
    });
    li.querySelector('.camera-user-btn')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (typeof openFloatingCamera === 'function') openFloatingCamera(u.userId, u.username);
    });

    ul.appendChild(li);
  });
}

function scrollToBottom() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

function escHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function stringToColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#7c3aed', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1', '#0ea5e9'];
  return colors[Math.abs(hash) % colors.length];
}

function setUserCameraState(userId, cameraOn) {
  if (!userId) return;
  cameraStates[userId] = !!cameraOn;
  if (onlineUsers[userId]) onlineUsers[userId].cameraOn = !!cameraOn;
  renderUserList();
}

async function setLocalCameraState(cameraOn) {
  if (!currentUser?.id) return;
  cameraStates[currentUser.id] = !!cameraOn;
  if (onlineUsers[currentUser.id]) onlineUsers[currentUser.id].cameraOn = !!cameraOn;
  renderUserList();
  sendToRoom({ type: 'presence_update', cameraOn: !!cameraOn });
}

function getUsernameById(userId) {
  return onlineUsers[userId]?.username || (userId === currentUser?.id ? currentProfile?.username : 'User');
}

// ── Voice Recording ──────────────────────────────────────────────────────────

async function toggleVoiceRecording() {
  if (isVoiceRecording) {
    stopVoiceRecording();
  } else {
    await startVoiceRecording();
  }
}

async function startVoiceRecording() {
  if (!currentRoom) { appendSystemMessage('Join a room first.'); return; }
  if (isVoiceRecording) return;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (_) {
    appendSystemMessage('Microphone access denied or unavailable.');
    return;
  }

  audioChunks = [];
  const mimeType = ['audio/webm', 'audio/ogg', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };

  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
    audioChunks = [];
    const reader = new FileReader();
    reader.onloadend = async () => { await sendVoiceMessage(reader.result); };
    reader.readAsDataURL(blob);
  };

  mediaRecorder.start();
  isVoiceRecording = true;
  const btn = document.getElementById('btn-voice-record');
  if (btn) { btn.textContent = '⏹️'; btn.classList.add('recording'); btn.title = 'Stop & send recording'; }
}

function stopVoiceRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  mediaRecorder.stop();
  isVoiceRecording = false;
  const btn = document.getElementById('btn-voice-record');
  if (btn) { btn.textContent = '🎤'; btn.classList.remove('recording'); btn.title = 'Record voice message'; }
}

async function sendVoiceMessage(audioDataUrl) {
  if (!currentRoom || !audioDataUrl) return;
  const res = await apiFetch(`/api/rooms/${currentRoom.id}/voice`, {
    method: 'POST',
    body: JSON.stringify({ audio_data: audioDataUrl })
  }).catch(() => null);
  if (!res || !res.ok) appendSystemMessage('Failed to send voice message.');
}

function audioDataUrlToObjectUrl(dataUrl) {
  try {
    const match = /^data:(audio\/[a-z0-9+\-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
    if (!match) return null;
    const mime = match[1];
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch (_) { return null; }
}

function appendVoiceMessage(msg) {
  const expiresAt = typeof msg.expires_at === 'number' ? msg.expires_at : (new Date(msg.created_at).getTime() + 15 * 60 * 1000);
  if (expiresAt <= Date.now()) return; // already expired

  // Convert base64 data URL to a blob: URL so the audio src is never a raw user-controlled URL
  const objectUrl = audioDataUrlToObjectUrl(msg.audio_data);
  if (!objectUrl) return; // invalid or missing audio data — skip

  const isMe = msg.user_id === currentUser?.id;
  const row = document.createElement('div');
  row.className = 'msg-row' + (isMe ? ' self' : '');
  row.dataset.voiceId = msg.id;

  const initial = (msg.username || '?')[0].toUpperCase();
  const color = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username || '');

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.style.background = color;
  avatar.textContent = initial;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble voice-bubble';

  const uname = document.createElement('div');
  uname.className = 'msg-username';
  uname.textContent = msg.username || 'Unknown';

  const micLabel = document.createElement('div');
  micLabel.className = 'voice-label';
  micLabel.textContent = '🎤 Voice message';

  const audioEl = document.createElement('audio');
  audioEl.controls = true;
  audioEl.src = objectUrl; // blob: URL — safe, not a user-controlled URL
  audioEl.className = 'voice-audio-player';

  const footer = document.createElement('div');
  footer.className = 'voice-footer';

  const timeSpan = document.createElement('span');
  timeSpan.className = 'msg-time';
  timeSpan.textContent = formatTime(msg.created_at);

  const countdown = document.createElement('span');
  countdown.className = 'voice-countdown';

  footer.append(timeSpan, countdown);
  bubble.append(uname, micLabel, audioEl, footer);
  row.append(avatar, bubble);
  document.getElementById('messages').appendChild(row);

  updateVoiceCountdown(countdown, row, expiresAt, objectUrl);
}

function updateVoiceCountdown(countdownEl, rowEl, expiresAt, objectUrl) {
  const tick = () => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      rowEl.remove();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return;
    }
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    countdownEl.textContent = ` · Expires in ${m}:${s.toString().padStart(2, '0')}`;
    setTimeout(tick, 1000);
  };
  tick();
}
