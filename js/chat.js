let currentUser = null;
let currentProfile = null;
let currentRoom = null;
let roomWs = null;
let onlineUsers = {};
let cameraStates = {};

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

  currentRoom = room;
  document.getElementById('current-room-name').textContent = '# ' + room.name;
  document.getElementById('messages').innerHTML = '';
  onlineUsers = {};
  cameraStates = {};

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

    if (msg.type === 'presence_sync') {
      onlineUsers = {};
      cameraStates = {};
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
  const div = document.createElement('div');
  div.className = 'msg-row' + (isMe ? ' self' : '');

  const initial = (msg.username || '?')[0].toUpperCase();
  const color = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username || '');

  div.innerHTML = `
    <div class="avatar" style="background:${color}">${initial}</div>
    <div class="msg-bubble">
      <div class="msg-username">${escHtml(msg.username || 'Unknown')}</div>
      <div class="msg-text">${escHtml(msg.content || '')}</div>
      <div class="msg-time">${formatTime(msg.created_at)}</div>
    </div>`;

  document.getElementById('messages').appendChild(div);
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
