let localStream = null;
let peers = Object.create(null);
let peerStreams = Object.create(null);
let peerAudioEls = Object.create(null);
let peerMuted = Object.create(null);
let isMuted = false;
let inVoice = false;
let isCameraOn = false;

let audioCtx = null;
let analyserNodes = Object.create(null);
let analyserData = Object.create(null);
let participantLevels = Object.create(null);
let visualizerFrame = null;
let floatingCameraPeerId = null;

const VISUALIZER_BARS = 28;

window.addEventListener('DOMContentLoaded', () => {
  setupFloatingCameraWindow();
  clearAllVisualizers();
});

async function joinVoice() {
  if (!currentUser) {
    alert('🔒 Please log in to use voice chat.');
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
    } catch (_) {
      alert('Microphone access denied. Please allow microphone in your browser settings.');
      return;
    }
  }

  inVoice = true;
  isMuted = false;
  participantLevels[currentUser.id] = 0;

  document.getElementById('btn-join-voice').classList.add('hidden');
  document.getElementById('btn-leave-voice').classList.remove('hidden');
  document.getElementById('btn-mute').classList.remove('hidden');
  document.getElementById('btn-toggle-camera').classList.remove('hidden');
  document.getElementById('voice-visualizer').classList.remove('hidden');
  document.getElementById('audio-status').textContent = '🎙️ Voice: Connected';
  document.getElementById('btn-mute').textContent = '🔇 Mute';

  updateVideoButtons();
  updateLocalPreview();
  attachAnalyserForStream(currentUser.id, localStream);
  startVisualizerLoop();

  if (typeof setLocalCameraState === 'function') {
    await setLocalCameraState(isCameraOn);
  }

  sendToRoom({
    type: 'join_voice',
    from: currentUser.id,
    username: currentProfile?.username,
    cameraOn: isCameraOn
  });
  await broadcastCameraState();
}

async function leaveVoice() {
  if (!inVoice) return;
  inVoice = false;

  sendToRoom({ type: 'leave_voice', from: currentUser.id });

  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;

  Object.entries(peers).forEach(([peerId, pc]) => {
    try { pc.close(); } catch (_) {}
    cleanupPeerMedia(peerId);
  });
  peers = Object.create(null);

  closeFloatingCamera();
  clearAllVisualizers();
  participantLevels = Object.create(null);

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

  isMuted = false;
  isCameraOn = false;

  if (typeof setLocalCameraState === 'function') await setLocalCameraState(false);
}

function toggleMute() {
  if (!localStream) return;
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
    } catch (_) {
      alert('Camera access denied. Please allow camera in your browser settings.');
      return;
    }
  } else {
    isCameraOn = !isCameraOn;
    localStream.getVideoTracks().forEach((track) => { track.enabled = isCameraOn; });
  }

  updateVideoButtons();
  updateLocalPreview();
  if (typeof setLocalCameraState === 'function') await setLocalCameraState(isCameraOn);
  await broadcastCameraState();
}

async function handlePeerJoin({ from, username, cameraOn }) {
  if (!inVoice || from === currentUser.id || peers[from]) return;
  addPeerTag(from, username);
  updatePeerCameraIcon(from, !!cameraOn);
  if (typeof setUserCameraState === 'function') setUserCameraState(from, !!cameraOn);

  const pc = createPeerConnection(from, username);
  peers[from] = pc;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  sendToRoom({
    type: 'offer',
    from: currentUser.id,
    to: from,
    sdp: offer,
    username: currentProfile?.username,
    cameraOn: isCameraOn
  });
}

async function handleOffer({ from, to, sdp, username, cameraOn }) {
  if (!inVoice || to !== currentUser.id) return;
  addPeerTag(from, username);
  updatePeerCameraIcon(from, !!cameraOn);
  if (typeof setUserCameraState === 'function') setUserCameraState(from, !!cameraOn);

  const pc = createPeerConnection(from, username);
  peers[from] = pc;

  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  sendToRoom({ type: 'answer', from: currentUser.id, to: from, sdp: answer });
}

async function handleAnswer({ from, to, sdp }) {
  if (!inVoice || to !== currentUser.id || !peers[from]) return;
  await peers[from].setRemoteDescription(new RTCSessionDescription(sdp));
}

async function handleIce({ from, to, candidate }) {
  if (!inVoice || to !== currentUser.id || !peers[from]) return;
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

  localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onicecandidate = ({ candidate }) => {
    if (!candidate) return;
    sendToRoom({ type: 'ice', from: currentUser.id, to: peerId, candidate });
  };

  pc.ontrack = ({ streams }) => {
    const stream = streams[0];
    peerStreams[peerId] = stream;
    const videoEl = ensurePeerTile(peerId, username);
    if (videoEl.srcObject !== stream) videoEl.srcObject = stream;
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

  const name = document.createElement('span');
  name.className = 'peer-name';
  name.textContent = `🎙 ${username || 'User'}`;

  const meter = document.createElement('canvas');
  meter.className = 'peer-soundbar mini-soundbar';
  meter.dataset.userId = peerId;
  meter.width = 32;
  meter.height = 10;
  meter.setAttribute('aria-hidden', 'true');

  const cameraBtn = document.createElement('button');
  cameraBtn.type = 'button';
  cameraBtn.className = 'peer-camera-btn hidden';
  cameraBtn.dataset.peerId = peerId;
  cameraBtn.title = 'View camera';
  cameraBtn.textContent = '📷';
  cameraBtn.addEventListener('click', () => {
    openFloatingCamera(peerId, username || getUsernameById(peerId));
  });

  const muteBtn = document.createElement('button');
  muteBtn.type = 'button';
  muteBtn.className = 'peer-mute-btn';
  muteBtn.dataset.peerId = peerId;
  muteBtn.title = 'Mute/Unmute peer';
  muteBtn.textContent = '🔇';
  muteBtn.addEventListener('click', () => togglePeerMute(peerId));

  tag.append(name, meter, cameraBtn, muteBtn);

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

  if (inVoice) document.getElementById('video-grid').classList.remove('hidden');
}

function updateVideoButtons() {
  document.getElementById('btn-toggle-camera').textContent = isCameraOn ? '📷 Camera Off' : '📷 Camera On';
}

function attachVideoTrackToPeers(videoTrack) {
  Object.values(peers).forEach((pc) => {
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) sender.replaceTrack(videoTrack);
    else pc.addTrack(videoTrack, localStream);
  });
}

async function broadcastCameraState() {
  if (!inVoice) return;
  sendToRoom({ type: 'camera_state', from: currentUser.id, cameraOn: isCameraOn });
}

function ensureAudioContext() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioCtx = AudioCtx ? new AudioCtx() : null;
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {});
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
  document.querySelectorAll('.mini-soundbar').forEach((canvas) => {
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
