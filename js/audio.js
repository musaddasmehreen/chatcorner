let localStream = null;
let peers = {};
let peerStreams = {};
let peerAudioEls = {};
let peerMuted = {};
let audioChannel = null;
let isMuted = false;
let inVoice = false;
let isCameraOn = false;

let audioCtx = null;
let analyserNodes = {};
let analyserData = {};
let participantLevels = {};
let visualizerFrame = null;
let floatingCameraPeerId = null;

const VISUALIZER_BARS = 28;
const MAX_VOICE_SPEAKERS = 2;
let isListenerMode = false;
let listenerQueue = [];
let voiceJoinAt = null;
let isPromotingSpeaker = false;

window.addEventListener('DOMContentLoaded', () => {
  setupFloatingCameraWindow();
  clearAllVisualizers();
});

async function joinVoice() {
  if (!currentUser) {
    alert('🔒 Please log in to use voice chat.');
    return;
  }
  if (!currentProfile?.is_registered) {
    alert('🔒 Register to join voice rooms.');
    return;
  }
  if (!currentRoom?.is_audio_enabled || inVoice) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    isCameraOn = true;
  } catch (e) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      isCameraOn = false;
      alert('Camera access denied. Joined in audio-only mode.');
    } catch (audioErr) {
      alert('Microphone access denied. Please allow microphone in your browser settings.');
      return;
    }
  }

  inVoice = true;
  isMuted = false;
  isListenerMode = false;
  listenerQueue = [];
  isPromotingSpeaker = false;
  voiceJoinAt = Date.now();
  participantLevels[currentUser.id] = 0;

  document.getElementById('btn-join-voice').classList.add('hidden');
  document.getElementById('btn-leave-voice').classList.remove('hidden');
  document.getElementById('btn-mute').classList.remove('hidden');
  document.getElementById('btn-toggle-camera').classList.remove('hidden');
  document.getElementById('voice-visualizer').classList.remove('hidden');
  updateVoiceStatus();
  document.getElementById('btn-mute').textContent = '🔇 Mute';

  updateVideoButtons();
  updateLocalPreview();
  attachAnalyserForStream(currentUser.id, localStream);
  startVisualizerLoop();

  if (typeof setLocalCameraState === 'function') {
    await setLocalCameraState(isCameraOn);
  }

  audioChannel = sbClient.channel('voice:' + currentRoom.id, {
    config: { presence: { key: currentUser.id } }
  });

  audioChannel
    .on('broadcast', { event: 'offer' }, ({ payload }) => handleOffer(payload))
    .on('broadcast', { event: 'answer' }, ({ payload }) => handleAnswer(payload))
    .on('broadcast', { event: 'ice' }, ({ payload }) => handleIce(payload))
    .on('broadcast', { event: 'join' }, ({ payload }) => handlePeerJoin(payload))
    .on('broadcast', { event: 'leave' }, ({ payload }) => handlePeerLeave(payload))
    .on('broadcast', { event: 'camera-state' }, ({ payload }) => handleCameraState(payload))
    .on('broadcast', { event: 'speaker-left' }, () => {
      maybePromoteFromListenerQueue();
    })
    .on('presence', { event: 'sync' }, () => {
      syncVoiceRoleState();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        syncVoiceRoleState();
        await trackVoicePresence(isListenerMode ? 'listener' : 'speaker');
        await audioChannel.send({
          type: 'broadcast',
          event: 'join',
          payload: {
            from: currentUser.id,
            username: currentProfile.username,
            cameraOn: isCameraOn
          }
        });
        await broadcastCameraState();
      }
    });
}

async function leaveVoice() {
  if (!inVoice) return;
  const wasListener = isListenerMode;
  inVoice = false;

  if (audioChannel) {
    if (!wasListener) {
      await audioChannel.send({
        type: 'broadcast',
        event: 'speaker-left',
        payload: { from: currentUser.id }
      });
    }
    await audioChannel.send({
      type: 'broadcast',
      event: 'leave',
      payload: { from: currentUser.id }
    });
    sbClient.removeChannel(audioChannel);
    audioChannel = null;
  }

  localStream?.getTracks().forEach(t => t.stop());
  localStream = null;

  Object.entries(peers).forEach(([peerId, pc]) => {
    try { pc.close(); } catch (_) {}
    cleanupPeerMedia(peerId);
  });
  peers = {};

  closeFloatingCamera();
  clearAllVisualizers();
  participantLevels = {};

  document.getElementById('video-grid').innerHTML = '';
  document.getElementById('video-grid').classList.add('hidden');
  document.getElementById('local-video').srcObject = null;
  document.getElementById('local-video').classList.add('hidden');
  document.getElementById('peers-list').innerHTML = '';

  document.getElementById('btn-join-voice').classList.remove('hidden');
  document.getElementById('btn-leave-voice').classList.add('hidden');
  document.getElementById('btn-mute').classList.add('hidden');
  document.getElementById('btn-toggle-camera').classList.add('hidden');
  document.getElementById('voice-visualizer').classList.add('hidden');
  document.getElementById('audio-status').textContent = '🎙️ Voice: Off';
  document.getElementById('audio-status').classList.remove('listener-mode');

  isMuted = false;
  isCameraOn = false;
  isListenerMode = false;
  listenerQueue = [];
  voiceJoinAt = null;
  isPromotingSpeaker = false;

  if (typeof setLocalCameraState === 'function') {
    await setLocalCameraState(false);
  }
}

function toggleMute() {
  if (!localStream) return;
  if (isListenerMode) {
    updateVoiceStatus();
    return;
  }
  const track = localStream.getAudioTracks()[0];
  if (!track) return;
  isMuted = !isMuted;
  track.enabled = !isMuted;
  document.getElementById('btn-mute').textContent = isMuted ? '🎙️ Unmute' : '🔇 Mute';
}

async function toggleCamera() {
  if (!inVoice || !localStream) return;

  const videoTracks = localStream.getVideoTracks();
  if (!videoTracks.length && !isCameraOn) {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = videoStream.getVideoTracks()[0];
      localStream.addTrack(videoTrack);
      attachVideoTrackToPeers(videoTrack);
      isCameraOn = true;
    } catch (e) {
      alert('Camera access denied. Please allow camera in your browser settings.');
      return;
    }
  } else {
    isCameraOn = !isCameraOn;
    localStream.getVideoTracks().forEach(track => {
      track.enabled = isCameraOn;
    });
  }

  updateVideoButtons();
  updateLocalPreview();
  if (typeof setLocalCameraState === 'function') {
    await setLocalCameraState(isCameraOn);
  }
  await broadcastCameraState();
}

async function handlePeerJoin({ from, username, cameraOn }) {
  if (from === currentUser.id || peers[from]) return;
  addPeerTag(from, username);
  updatePeerCameraIcon(from, !!cameraOn);
  if (typeof setUserCameraState === 'function') setUserCameraState(from, !!cameraOn);

  const pc = createPeerConnection(from, username);
  peers[from] = pc;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await audioChannel.send({
    type: 'broadcast',
    event: 'offer',
    payload: { from: currentUser.id, to: from, sdp: offer, username: currentProfile.username, cameraOn: isCameraOn }
  });
}

async function handleOffer({ from, to, sdp, username, cameraOn }) {
  if (to !== currentUser.id) return;
  addPeerTag(from, username);
  updatePeerCameraIcon(from, !!cameraOn);
  if (typeof setUserCameraState === 'function') setUserCameraState(from, !!cameraOn);

  const pc = createPeerConnection(from, username);
  peers[from] = pc;

  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await audioChannel.send({
    type: 'broadcast',
    event: 'answer',
    payload: { from: currentUser.id, to: from, sdp: answer }
  });
}

async function handleAnswer({ from, to, sdp }) {
  if (to !== currentUser.id || !peers[from]) return;
  await peers[from].setRemoteDescription(new RTCSessionDescription(sdp));
}

async function handleIce({ from, to, candidate }) {
  if (to !== currentUser.id || !peers[from]) return;
  try { await peers[from].addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
}

function handleCameraState({ from, cameraOn }) {
  if (!from || from === currentUser.id) return;
  updatePeerCameraIcon(from, !!cameraOn);
  if (typeof setUserCameraState === 'function') setUserCameraState(from, !!cameraOn);
  if (!cameraOn) {
    hidePeerTile(from);
    if (floatingCameraPeerId === from) closeFloatingCamera();
  } else if (peerStreams[from]) {
    ensurePeerTile(from, getUsernameById(from));
  }
}

function handlePeerLeave({ from }) {
  if (!from) return;
  if (peers[from]) {
    try { peers[from].close(); } catch (_) {}
    delete peers[from];
  }
  cleanupPeerMedia(from);
  document.getElementById('peer-' + from)?.remove();
  document.getElementById('video-tile-' + from)?.remove();
  if (typeof setUserCameraState === 'function') setUserCameraState(from, false);
  if (floatingCameraPeerId === from) closeFloatingCamera();
}

function createPeerConnection(peerId, username) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  localStream?.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  pc.onicecandidate = async ({ candidate }) => {
    if (!candidate || !audioChannel) return;
    await audioChannel.send({
      type: 'broadcast',
      event: 'ice',
      payload: { from: currentUser.id, to: peerId, candidate }
    });
  };

  pc.ontrack = ({ streams }) => {
    const stream = streams[0];
    peerStreams[peerId] = stream;
    const videoEl = ensurePeerTile(peerId, username);
    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }
    ensurePeerAudioElement(peerId, stream);
    attachAnalyserForStream(peerId, stream);
  };

  pc.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      handlePeerLeave({ from: peerId });
    }
  };

  return pc;
}

function ensurePeerTile(peerId, username) {
  let tile = document.getElementById('video-tile-' + peerId);
  if (!tile) {
    tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = 'video-tile-' + peerId;

    const videoEl = document.createElement('video');
    videoEl.id = 'video-' + peerId;
    videoEl.autoplay = true;
    videoEl.playsInline = true;

    const label = document.createElement('span');
    label.className = 'video-label';
    label.textContent = username || 'User';

    tile.appendChild(videoEl);
    tile.appendChild(label);
    document.getElementById('video-grid').appendChild(tile);
  }

  const cameraOn = typeof cameraStates !== 'undefined' ? !!cameraStates[peerId] : true;
  tile.classList.toggle('hidden', !cameraOn);
  document.getElementById('video-grid').classList.remove('hidden');
  return tile.querySelector('video');
}

function hidePeerTile(peerId) {
  document.getElementById('video-tile-' + peerId)?.classList.add('hidden');
}

function addPeerTag(peerId, username) {
  const existing = document.getElementById('peer-' + peerId);
  if (existing) return;

  const tag = document.createElement('div');
  tag.className = 'peer-tag';
  tag.id = 'peer-' + peerId;
  tag.innerHTML = `
    <span class="peer-name">🎙 ${escHtml(username || 'User')}</span>
    <canvas class="peer-soundbar mini-soundbar" data-user-id="${peerId}" width="32" height="10" aria-hidden="true"></canvas>
    <button type="button" class="peer-camera-btn hidden" data-peer-id="${peerId}" title="View camera">📷</button>
    <button type="button" class="peer-mute-btn" data-peer-id="${peerId}" title="Mute/Unmute peer">🔇</button>
  `;

  tag.querySelector('.peer-mute-btn')?.addEventListener('click', () => togglePeerMute(peerId));
  tag.querySelector('.peer-camera-btn')?.addEventListener('click', () => {
    openFloatingCamera(peerId, username || getUsernameById(peerId));
  });

  document.getElementById('peers-list').appendChild(tag);
}

function ensurePeerAudioElement(peerId, stream) {
  let audioEl = document.getElementById('audio-peer-' + peerId);
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = 'audio-peer-' + peerId;
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    document.getElementById('audio-elements').appendChild(audioEl);
  }
  if (audioEl.srcObject !== stream) audioEl.srcObject = stream;
  audioEl.volume = peerMuted[peerId] ? 0 : 1;
  peerAudioEls[peerId] = audioEl;
}

function togglePeerMute(peerId) {
  peerMuted[peerId] = !peerMuted[peerId];
  const audioEl = peerAudioEls[peerId] || document.getElementById('audio-peer-' + peerId);
  if (audioEl) audioEl.volume = peerMuted[peerId] ? 0 : 1;
  const btn = document.getElementById('peer-' + peerId)?.querySelector('.peer-mute-btn');
  if (btn) btn.textContent = peerMuted[peerId] ? '🔊' : '🔇';
}

function updatePeerCameraIcon(peerId, cameraOn) {
  const btn = document.getElementById('peer-' + peerId)?.querySelector('.peer-camera-btn');
  if (btn) btn.classList.toggle('hidden', !cameraOn);
}

function cleanupPeerMedia(peerId) {
  delete peerStreams[peerId];
  const audioEl = peerAudioEls[peerId] || document.getElementById('audio-peer-' + peerId);
  if (audioEl) {
    audioEl.srcObject = null;
    audioEl.remove();
  }
  delete peerAudioEls[peerId];
  delete peerMuted[peerId];
  detachAnalyser(peerId);
  delete participantLevels[peerId];
}

function updateLocalPreview() {
  const localVideo = document.getElementById('local-video');
  const hasVideo = !!localStream?.getVideoTracks().length && isCameraOn;

  if (hasVideo) {
    localVideo.srcObject = localStream;
    localVideo.classList.remove('hidden');
  } else {
    localVideo.srcObject = null;
    localVideo.classList.add('hidden');
  }

  if (inVoice) {
    document.getElementById('video-grid').classList.remove('hidden');
  }
}

function updateVideoButtons() {
  document.getElementById('btn-toggle-camera').textContent = isCameraOn ? '📷 Camera Off' : '📷 Camera On';
}

function attachVideoTrackToPeers(videoTrack) {
  Object.values(peers).forEach((pc) => {
    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) sender.replaceTrack(videoTrack);
    else pc.addTrack(videoTrack, localStream);
  });
}

async function broadcastCameraState() {
  if (!audioChannel || !inVoice) return;
  await audioChannel.send({
    type: 'broadcast',
    event: 'camera-state',
    payload: { from: currentUser.id, cameraOn: isCameraOn }
  });
}

function getVoicePresenceParticipants() {
  if (!audioChannel) return [];
  const state = audioChannel.presenceState();
  const users = [];
  Object.values(state).forEach((entries) => {
    entries.forEach((entry) => {
    users.push({
      userId: entry.userId,
      username: entry.username || 'User',
      role: entry.role === 'listener' ? 'listener' : 'speaker',
      joinedAt: Number(entry.joinedAt) || 0
    });
    });
  });
  return users;
}

async function trackVoicePresence(role) {
  if (!audioChannel || !currentUser?.id) return;
  await audioChannel.track({
    userId: currentUser.id,
    username: currentProfile?.username || 'User',
    role,
    joinedAt: voiceJoinAt || Date.now()
  });
}

function updateVoiceStatus(speakerCount = null) {
  const statusEl = document.getElementById('audio-status');
  if (!statusEl) return;
  const count = speakerCount ?? getVoicePresenceParticipants().filter(p => p.role === 'speaker').length;

  if (!inVoice) {
    statusEl.textContent = '🎙️ Voice: Off';
    statusEl.classList.remove('listener-mode');
    return;
  }

  if (isListenerMode) {
    const pos = Math.max(1, listenerQueue.findIndex(item => item.userId === currentUser.id) + 1);
    statusEl.textContent = `👂 Voice: Listening (position ${pos}) • ⏳ Waiting for a slot… (${Math.min(count, MAX_VOICE_SPEAKERS)}/${MAX_VOICE_SPEAKERS} speakers active)`;
    statusEl.classList.add('listener-mode');
    return;
  }

  statusEl.textContent = '🎙️ Voice: Connected';
  statusEl.classList.remove('listener-mode');
}

async function promoteListenerToSpeaker() {
  if (!inVoice || !isListenerMode || isPromotingSpeaker) return;
  isPromotingSpeaker = true;
  try {
    isListenerMode = false;
    isMuted = false;
    const track = localStream?.getAudioTracks()[0];
    if (track) track.enabled = true;
    document.getElementById('btn-mute').textContent = '🔇 Mute';
    await trackVoicePresence('speaker');
    updateVoiceStatus();
  } finally {
    isPromotingSpeaker = false;
  }
}

function maybePromoteFromListenerQueue() {
  if (!inVoice || !isListenerMode || !audioChannel) return;
  const participants = getVoicePresenceParticipants();
  const speakers = participants.filter(p => p.role === 'speaker');
  const listeners = participants
    .filter(p => p.role === 'listener')
    .sort((a, b) => (a.joinedAt - b.joinedAt) || a.userId.localeCompare(b.userId));
  listenerQueue = listeners.map(item => ({ userId: item.userId, username: item.username }));
  if (speakers.length < MAX_VOICE_SPEAKERS && listeners[0]?.userId === currentUser.id) {
    promoteListenerToSpeaker();
  }
  updateVoiceStatus(speakers.length);
}

function syncVoiceRoleState() {
  if (!inVoice || !audioChannel) return;
  const participants = getVoicePresenceParticipants();
  const speakers = participants.filter(p => p.role === 'speaker');
  const listeners = participants
    .filter(p => p.role === 'listener')
    .sort((a, b) => (a.joinedAt - b.joinedAt) || a.userId.localeCompare(b.userId));
  listenerQueue = listeners.map(item => ({ userId: item.userId, username: item.username }));

  const me = participants.find(p => p.userId === currentUser.id);
  if (!me) {
    const shouldListen = speakers.length >= MAX_VOICE_SPEAKERS;
    isListenerMode = shouldListen;
    const track = localStream?.getAudioTracks()[0];
    if (track) track.enabled = !shouldListen;
    isMuted = shouldListen;
    document.getElementById('btn-mute').textContent = shouldListen ? '🎙️ Unmute' : '🔇 Mute';
    trackVoicePresence(shouldListen ? 'listener' : 'speaker').catch(() => {});
  } else {
    isListenerMode = me.role === 'listener';
    const track = localStream?.getAudioTracks()[0];
    if (track && isListenerMode) track.enabled = false;
  }

  maybePromoteFromListenerQueue();
  updateVoiceStatus(speakers.length);
}

function ensureAudioContext() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioCtx = AudioCtx ? new AudioCtx() : null;
  }
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function attachAnalyserForStream(userId, stream) {
  const ctx = ensureAudioContext();
  if (!ctx || !stream) return;

  detachAnalyser(userId);

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.75;
  source.connect(analyser);

  analyserNodes[userId] = { source, analyser };
  analyserData[userId] = new Uint8Array(analyser.frequencyBinCount);
  participantLevels[userId] = 0;
}

function detachAnalyser(userId) {
  const node = analyserNodes[userId];
  if (node) {
    try { node.source.disconnect(); } catch (_) {}
    try { node.analyser.disconnect(); } catch (_) {}
  }
  delete analyserNodes[userId];
  delete analyserData[userId];
}

function sampleAudioLevels() {
  Object.entries(analyserNodes).forEach(([userId, node]) => {
    const data = analyserData[userId];
    if (!data) return;
    node.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    participantLevels[userId] = data.length ? (sum / data.length) / 255 : 0;
  });
}

function drawMainVisualizer() {
  const canvas = document.getElementById('voice-visualizer');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const levels = Object.values(participantLevels);
  const maxLevel = levels.length ? Math.max(...levels) : 0;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(var(--accent-rgb),0.16)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const barWidth = canvas.width / VISUALIZER_BARS;
  for (let i = 0; i < VISUALIZER_BARS; i++) {
    const mod = Math.sin((performance.now() / 220) + i * 0.9) * 0.18;
    const barLevel = Math.max(0.06, Math.min(1, maxLevel + mod));
    const h = barLevel * canvas.height;
    ctx.fillStyle = i % 2 ? 'var(--accent)' : 'var(--accent2)';
    ctx.fillRect(i * barWidth + 1, canvas.height - h, Math.max(2, barWidth - 2), h);
  }
}

function drawMiniSoundbars() {
  const bars = document.querySelectorAll('.mini-soundbar');
  bars.forEach((canvas) => {
    const userId = canvas.dataset.userId;
    const level = participantLevels[userId] || 0;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(var(--accent-rgb),0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const width = Math.max(2, Math.floor(level * canvas.width));
    ctx.fillStyle = level > 0.12 ? 'var(--accent2)' : 'var(--accent)';
    ctx.fillRect(0, 0, width, canvas.height);
  });
}

function visualizerTick() {
  sampleAudioLevels();
  drawMainVisualizer();
  drawMiniSoundbars();
  visualizerFrame = requestAnimationFrame(visualizerTick);
}

function startVisualizerLoop() {
  if (visualizerFrame) return;
  visualizerFrame = requestAnimationFrame(visualizerTick);
}

function clearAllVisualizers() {
  if (visualizerFrame) {
    cancelAnimationFrame(visualizerFrame);
    visualizerFrame = null;
  }

  Object.keys(analyserNodes).forEach(detachAnalyser);

  const main = document.getElementById('voice-visualizer');
  if (main) {
    const ctx = main.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, main.width, main.height);
  }

  document.querySelectorAll('.mini-soundbar').forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}

function setupFloatingCameraWindow() {
  const floatingWindow = document.getElementById('floating-camera-window');
  const header = document.getElementById('floating-camera-header');
  const closeBtn = document.getElementById('floating-camera-close');
  if (!floatingWindow || !header || !closeBtn) return;

  closeBtn.onclick = closeFloatingCamera;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.onmousedown = (e) => {
    dragging = true;
    const rect = floatingWindow.getBoundingClientRect();
    floatingWindow.style.left = rect.left + 'px';
    floatingWindow.style.top = rect.top + 'px';
    floatingWindow.style.right = 'auto';
    floatingWindow.style.bottom = 'auto';
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  };

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    floatingWindow.style.left = `${Math.max(8, e.clientX - offsetX)}px`;
    floatingWindow.style.top = `${Math.max(56, e.clientY - offsetY)}px`;
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });
}

function openFloatingCamera(peerId, username) {
  const stream = peerStreams[peerId];
  const cameraOn = typeof cameraStates !== 'undefined' ? !!cameraStates[peerId] : true;
  if (!stream || !cameraOn) {
    appendSystemMessage?.(`${username || 'User'} camera is currently off.`);
    return;
  }

  const floatingWindow = document.getElementById('floating-camera-window');
  const video = document.getElementById('floating-camera-video');
  const title = document.getElementById('floating-camera-title');
  if (!floatingWindow || !video || !title) return;

  floatingCameraPeerId = peerId;
  title.textContent = `📷 ${username || getUsernameById(peerId)}`;
  video.srcObject = stream;
  floatingWindow.classList.remove('hidden');
}

function closeFloatingCamera() {
  const floatingWindow = document.getElementById('floating-camera-window');
  const video = document.getElementById('floating-camera-video');
  if (video) video.srcObject = null;
  if (floatingWindow) floatingWindow.classList.add('hidden');
  floatingCameraPeerId = null;
}
