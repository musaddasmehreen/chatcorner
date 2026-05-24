const pmWindows = {};
const pmMuted = {};
const pmTextHistory = {};
const pmVoiceUrls = {};
const pmRecorders = {};
const pmCallState = {};
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
        <button type="button" class="pm-call-btn" title="Start voice call">📞</button>
        <button type="button" class="pm-mute-btn" title="Toggle PM notification sound">${pmMuted[userId] ? '🔇' : '🔊'}</button>
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
  const callBtn = wrap.querySelector('.pm-call-btn');
  const acceptBtn = wrap.querySelector('.pm-call-accept');
  const declineBtn = wrap.querySelector('.pm-call-decline');
  const endCallBtn = wrap.querySelector('.pm-call-end');

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
  callBtn.onclick = () => startPmVoiceCall(userId);
  acceptBtn.onclick = () => acceptPmVoiceCall(userId);
  declineBtn.onclick = () => declinePmVoiceCall(userId);
  endCallBtn.onclick = () => endPmVoiceCall(userId);

  if (!currentProfile?.is_registered) {
    recordBtn.style.display = 'none';
    callBtn.style.display = 'none';
  }

  renderPmTextHistory(userId);
  updatePmCallUi(userId);
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

  endPmVoiceCall(userId, false);

  if (pmRecorders[userId]?.state === 'recording') {
    pmRecorders[userId].stop();
  }
  delete pmRecorders[userId];

  cleanupPmVoiceUrls(userId);
  win.el.remove();
  delete pmWindows[userId];
  delete pmCallState[userId];
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

  // FIX 2 — Lock voice notes for guest users
  const audioHtml = currentProfile?.is_registered
    ? `<audio controls src="${msg.audioUrl}"></audio>`
    : '<span class="vn-locked">\uD83D\uDD12 Register to hear voice notes</span>';

  const row = document.createElement('div');
  row.className = 'pm-msg pm-voice' + (isMe ? ' self' : '');
  row.innerHTML = `
    <div class="pm-msg-bubble">
      ${audioHtml}
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
  if (!currentProfile?.is_registered) {
    alert('Voice notes are available for registered users only.');
    return;
  }

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
