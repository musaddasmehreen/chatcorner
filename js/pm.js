const pmWindows = {};
const pmMuted = {};
const pmTextHistory = {};
const pmVoiceUrls = {};
const pmRecorders = {};
let pmChannel = null;
let pmTableAvailable = null;
let pmAudioCtx = null;

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { ensurePmRealtime(); }, 600);
});

async function ensurePmRealtime() {
  if (!currentUser?.id || pmChannel) return;

  pmChannel = sbClient.channel('pm-global');
  pmChannel
    .on('broadcast', { event: 'private-message' }, ({ payload }) => {
      if (!payload || payload.to !== currentUser.id) return;
      handleIncomingPm(payload);
    })
    .subscribe();
}

async function openPrivateChat(userId, username) {
  if (!userId || !currentUser?.id || userId === currentUser.id) return;
  await ensurePmRealtime();

  if (pmWindows[userId]) {
    focusPmWindow(userId);
    return;
  }

  const root = document.getElementById('pm-root');
  if (!root) return;

  const wrap = document.createElement('div');
  wrap.className = 'pm-window';
  wrap.dataset.userId = userId;
  wrap.innerHTML = `
    <div class="pm-header">
      <span class="pm-title">💬 ${escHtml(username || getUsernameById(userId))}</span>
      <div class="pm-header-actions">
        <button type="button" class="pm-mute-btn" title="Toggle PM notification sound">${pmMuted[userId] ? '🔇' : '🔊'}</button>
        <button type="button" class="pm-close-btn" title="Close PM">✕</button>
      </div>
    </div>
    <div class="pm-messages"></div>
    <div class="pm-input-row">
      <input class="pm-input" type="text" maxlength="500" placeholder="Type a private message…"/>
      <button type="button" class="pm-record-btn" title="Record voice message">🎙️</button>
      <button type="button" class="pm-send-btn">Send</button>
    </div>
  `;

  root.appendChild(wrap);
  pmWindows[userId] = { el: wrap, userId, username: username || getUsernameById(userId) };

  const input = wrap.querySelector('.pm-input');
  const sendBtn = wrap.querySelector('.pm-send-btn');
  const closeBtn = wrap.querySelector('.pm-close-btn');
  const muteBtn = wrap.querySelector('.pm-mute-btn');
  const recordBtn = wrap.querySelector('.pm-record-btn');

  sendBtn.onclick = () => sendPrivateText(userId);
  input.onkeydown = (e) => {
    if (e.key === 'Enter') sendPrivateText(userId);
  };

  closeBtn.onclick = () => closePrivateChat(userId);
  muteBtn.onclick = () => {
    pmMuted[userId] = !pmMuted[userId];
    muteBtn.textContent = pmMuted[userId] ? '🔇' : '🔊';
  };

  recordBtn.onclick = () => togglePmRecording(userId);

  renderPmTextHistory(userId);
  positionPmWindows();

  if (pmTableAvailable !== false) {
    await loadPmHistoryFromDb(userId);
  }
}

function focusPmWindow(userId) {
  const item = pmWindows[userId];
  if (!item) return;
  item.el.classList.add('pulse');
  setTimeout(() => item.el.classList.remove('pulse'), 250);
}

function closePrivateChat(userId) {
  const win = pmWindows[userId];
  if (!win) return;

  if (pmRecorders[userId]?.state === 'recording') {
    pmRecorders[userId].stop();
  }
  delete pmRecorders[userId];

  cleanupPmVoiceUrls(userId);
  win.el.remove();
  delete pmWindows[userId];
  positionPmWindows();
}

function positionPmWindows() {
  const list = Object.values(pmWindows);
  list.forEach((win, idx) => {
    win.el.style.right = `${12 + (idx * 290)}px`;
  });
}

function getPmInput(userId) {
  return pmWindows[userId]?.el.querySelector('.pm-input');
}

function getPmMessagesBox(userId) {
  return pmWindows[userId]?.el.querySelector('.pm-messages');
}

async function sendPrivateText(userId) {
  const input = getPmInput(userId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  input.value = '';

  appendPmTextMessage(userId, {
    from: currentUser.id,
    text,
    createdAt: new Date().toISOString()
  }, true);

  if (!pmTextHistory[userId]) pmTextHistory[userId] = [];
  pmTextHistory[userId].push({ from: currentUser.id, text, createdAt: new Date().toISOString() });

  await persistPmToDb(userId, text);
  await sendPmBroadcast({ to: userId, type: 'text', text });
}

async function handleIncomingPm(payload) {
  const fromUserId = payload.from;
  if (!fromUserId) return;

  const username = payload.username || getUsernameById(fromUserId);
  await openPrivateChat(fromUserId, username);

  if (payload.type === 'voice' && payload.voiceDataUrl) {
    const blob = dataUrlToBlob(payload.voiceDataUrl);
    const url = URL.createObjectURL(blob);
    appendPmVoiceMessage(fromUserId, { from: fromUserId, audioUrl: url }, false);
    trackPmVoiceUrl(fromUserId, url);
    playPmNotification(fromUserId);
    return;
  }

  if (payload.type === 'text') {
    const createdAt = payload.createdAt || new Date().toISOString();
    appendPmTextMessage(fromUserId, { from: fromUserId, text: payload.text || '', createdAt }, false);

    if (!pmTextHistory[fromUserId]) pmTextHistory[fromUserId] = [];
    pmTextHistory[fromUserId].push({ from: fromUserId, text: payload.text || '', createdAt });
    playPmNotification(fromUserId);
  }
}

function appendPmTextMessage(userId, msg, isMe) {
  const box = getPmMessagesBox(userId);
  if (!box) return;

  const row = document.createElement('div');
  row.className = 'pm-msg' + (isMe ? ' self' : '');
  row.innerHTML = `
    <div class="pm-msg-bubble">${escHtml(msg.text || '')}</div>
    <div class="pm-msg-time">${formatTime(msg.createdAt)}</div>
  `;

  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

function appendPmVoiceMessage(userId, msg, isMe) {
  const box = getPmMessagesBox(userId);
  if (!box) return;

  const row = document.createElement('div');
  row.className = 'pm-msg pm-voice' + (isMe ? ' self' : '');
  row.innerHTML = `
    <div class="pm-msg-bubble">
      <audio controls src="${msg.audioUrl}"></audio>
    </div>
    <div class="pm-msg-time">${formatTime(new Date().toISOString())}</div>
  `;

  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

function renderPmTextHistory(userId) {
  const box = getPmMessagesBox(userId);
  if (!box) return;
  box.innerHTML = '';

  (pmTextHistory[userId] || []).forEach(msg => {
    appendPmTextMessage(userId, msg, msg.from === currentUser.id);
  });
}

async function togglePmRecording(userId) {
  const btn = pmWindows[userId]?.el.querySelector('.pm-record-btn');
  if (!btn) return;

  const recorder = pmRecorders[userId];
  if (recorder?.state === 'recording') {
    recorder.stop();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    alert('Voice recording is not supported in this browser.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    const mediaRecorder = new MediaRecorder(stream);
    pmRecorders[userId] = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      btn.classList.remove('recording');
      btn.textContent = '🎙️';
      stream.getTracks().forEach(t => t.stop());

      if (!chunks.length) return;

      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      const audioUrl = URL.createObjectURL(blob);
      trackPmVoiceUrl(userId, audioUrl);
      appendPmVoiceMessage(userId, { from: currentUser.id, audioUrl }, true);

      const voiceDataUrl = await blobToDataUrl(blob);
      await sendPmBroadcast({ to: userId, type: 'voice', voiceDataUrl });
    };

    mediaRecorder.start();
    btn.classList.add('recording');
    btn.textContent = '⏹️';
  } catch (_) {
    alert('Microphone permission is required to record voice messages.');
  }
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

async function persistPmToDb(userId, text) {
  const ok = await ensurePrivateTableSupport();
  if (!ok) return;

  const payload = {
    sender_id: currentUser.id,
    recipient_id: userId,
    content: text,
    type: 'text'
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
  const seen = new Set(existing.map(m => `${m.from}|${m.text}|${m.createdAt}`));

  (data || []).forEach(row => {
    if (row.type && row.type !== 'text') return;
    const item = {
      from: row.sender_id,
      text: row.content || '',
      createdAt: row.created_at || new Date().toISOString()
    };
    const key = `${item.from}|${item.text}|${item.createdAt}`;
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
